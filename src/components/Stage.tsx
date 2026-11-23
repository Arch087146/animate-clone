import { useCallback, useEffect, useRef, useState } from 'react'
import { getBrush, smoothPoints } from '../brushes'
import { drawBones, drawSelection, drawShape } from '../draw'
import { Icon } from '../Icon'
import { useStore } from '../store'
import { createShape, type Bone, type Point, type Shape, uid } from '../types'
import { distanceToSegment, findKeyframeIndex, getActiveKeyframe, getRenderBones, getRenderShapes, pointInShape, shapeBounds } from '../utils'
import { ToolOptions } from './ToolOptions'

type DragMode =
  | { kind: 'none' }
  | { kind: 'draw'; start: Point; shape: Shape }
  | { kind: 'path'; points: Point[] }
  | { kind: 'lasso'; points: Point[] }
  | { kind: 'erase'; points: Point[] }
  | { kind: 'boneDraw'; start: Point; parentId: string | null }
  | { kind: 'boneRotate'; bone: Bone; bones: Bone[]; shapes: Shape[]; lastAngle: number; totalAngle: number; layerId: string }
  | { kind: 'boneTranslate'; bone: Bone; bones: Bone[]; shapes: Shape[]; start: Point; layerId: string }
  | { kind: 'point'; index: number; origin: Shape; layerId: string }
  | { kind: 'move'; start: Point; origin: Shape; layerId: string }
  | { kind: 'resize'; start: Point; origin: Shape; layerId: string; handle: string }
  | { kind: 'pan'; start: Point; pan: Point }

const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

function rotatePoint(p: Point, origin: Point, angle: number): Point {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const dx = p.x - origin.x
  const dy = p.y - origin.y
  return { x: origin.x + dx * cos - dy * sin, y: origin.y + dx * sin + dy * cos }
}

function isBoneDescendant(bone: Bone, rootId: string, bones: Bone[]): boolean {
  let current: Bone | undefined = bone
  const seen = new Set<string>()
  while (current?.parentId && !seen.has(current.id)) {
    if (current.connected === false) return false
    if (current.parentId === rootId) return true
    seen.add(current.id)
    current = bones.find((b) => b.id === current!.parentId)
  }
  return false
}

function rotateShapeAround(shape: Shape, pivot: Point, angle: number): Partial<Shape> {
  if (shape.points?.length) {
    const points = shape.points.map((p) => rotatePoint(p, pivot, angle))
    const xs = points.map((p) => p.x)
    const ys = points.map((p) => p.y)
    return {
      points,
      x: Math.min(...xs), y: Math.min(...ys),
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys),
    }
  }
  const center = rotatePoint({ x: shape.x + shape.width / 2, y: shape.y + shape.height / 2 }, pivot, angle)
  return {
    x: center.x - shape.width / 2,
    y: center.y - shape.height / 2,
    rotation: shape.rotation + (angle * 180) / Math.PI,
  }
}

function translateShape(shape: Shape, dx: number, dy: number): Partial<Shape> {
  return {
    x: shape.x + dx,
    y: shape.y + dy,
    points: shape.points?.map((p) => ({ x: p.x + dx, y: p.y + dy })),
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function normalizedAngle(value: number) {
  let a = value
  while (a > Math.PI) a -= Math.PI * 2
  while (a < -Math.PI) a += Math.PI * 2
  return a
}

function selectedNear(bone: Bone, selectedId: string | null | undefined, p: Point, zoom: number) {
  if (bone.id !== selectedId) return false
  return distanceToSegment(p, { x: bone.x1, y: bone.y1 }, { x: bone.x2, y: bone.y2 }) <= 12 / zoom
}

function posepick(p: Point, bones: Bone[], zoom: number): { bone: Bone; onJoint: boolean; part: 'head' | 'tail' | 'body' } | null {
  const headTol = 10 / zoom
  for (const bone of bones) {
    if (Math.hypot(p.x - bone.x1, p.y - bone.y1) <= headTol) return { bone, onJoint: true, part: 'head' }
    if (Math.hypot(p.x - bone.x2, p.y - bone.y2) <= headTol) return { bone, onJoint: true, part: 'tail' }
  }
  for (const bone of bones) {
    if (distanceToSegment(p, { x: bone.x1, y: bone.y1 }, { x: bone.x2, y: bone.y2 }) <= 7 / zoom) {
      return { bone, onJoint: false, part: 'body' }
    }
  }
  return null
}

function pointInPolygon(p: Point, polygon: Point[]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]
    const b = polygon[j]
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}

export function Stage({ compact = false }: { compact?: boolean } = {}) {
  const { state, dispatch } = useStore()
  const { project, zoom, pan, currentFrame, tool, selection } = state
  const settings = state.toolSettings
  const getBrushName = (id: string) => getBrush(id).name
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dragRef = useRef<DragMode>({ kind: 'none' })
  const [draft, setDraft] = useState<Shape | null>(null)
  const [draftBone, setDraftBone] = useState<Bone | null>(null)
  const [penPoints, setPenPoints] = useState<Point[]>([])
  const [lassoPoints, setLassoPoints] = useState<Point[]>([])
  const [cursorPos, setCursorPos] = useState<Point>({ x: 0, y: 0 })
  const [snapJoint, setSnapJoint] = useState<Point | null>(null)

  const toWorld = useCallback((clientX: number, clientY: number): Point => {
    const rect = containerRef.current!.getBoundingClientRect()
    const originX = rect.left + (rect.width - project.width * zoom) / 2 + pan.x
    const originY = rect.top + (rect.height - project.height * zoom) / 2 + pan.y
    return { x: (clientX - originX) / zoom, y: (clientY - originY) / zoom }
  }, [project.width, project.height, zoom, pan])

  const render = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = Math.max(1, Math.round(project.width * zoom))
    canvas.height = Math.max(1, Math.round(project.height * zoom))
    canvas.style.width = `${project.width * zoom}px`
    canvas.style.height = `${project.height * zoom}px`
    const ctx = canvas.getContext('2d')!
    ctx.setTransform(zoom, 0, 0, zoom, 0, 0)
    ctx.fillStyle = project.backgroundColor
    ctx.fillRect(0, 0, project.width, project.height)

    if (state.showGrid) {
      ctx.strokeStyle = '#c8d4e0'
      ctx.lineWidth = 1 / zoom
      ctx.beginPath()
      for (let x = 0; x <= project.width; x += 20) { ctx.moveTo(x, 0); ctx.lineTo(x, project.height) }
      for (let y = 0; y <= project.height; y += 20) { ctx.moveTo(0, y); ctx.lineTo(project.width, y) }
      ctx.stroke()
    }

    if (state.onionSkin) {
      const activeLayer = project.layers.find((l) => l.id === selection.layerId) ?? project.layers[0]
      const offsets: number[] = []
      if (state.onionKeyframesOnly && activeLayer) {
        const starts = activeLayer.frames.map((f, i) => (f ? i : -1)).filter((i) => i >= 0 && i !== currentFrame)
        const previous = [...starts].reverse().find((i) => i < currentFrame)
        const next = starts.find((i) => i > currentFrame)
        if (previous !== undefined) offsets.push(previous - currentFrame)
        if (next !== undefined) offsets.push(next - currentFrame)
      } else {
        for (let offset = -state.onionRange; offset <= state.onionRange; offset++) {
          if (offset !== 0) offsets.push(offset)
        }
      }
      for (const offset of offsets) {
        const f = currentFrame + offset
        if (f < 0 || f >= project.totalFrames) continue
        ctx.save()
        ctx.globalAlpha = state.onionOpacity * (1 - Math.min(1, Math.abs(offset) / (state.onionRange + 1)) * 0.6)
        for (const { shape } of getRenderShapes(project, f)) {
          const ghost = { ...shape, fill: offset < 0 ? '#e53935' : '#43a047', stroke: offset < 0 ? '#e53935' : '#43a047', strokeWidth: 1 }
          drawShape(ctx, ghost)
        }
        ctx.restore()
      }
    }

    for (const { shape } of getRenderShapes(project, currentFrame)) drawShape(ctx, shape)
    if (draft) drawShape(ctx, draft)

    const bones = getRenderBones(project, currentFrame)
    if (state.showBones || tool === 'bone') {
      drawBones(ctx, bones, selection.boneId ?? null, zoom, { snapPoint: snapJoint })
    }
    if (draftBone) drawBones(ctx, [draftBone], draftBone.id, zoom)

    if (selection.shapeId && selection.layerId) {
      const layer = project.layers.find((l) => l.id === selection.layerId)
      const idx = layer ? findKeyframeIndex(layer, currentFrame) : -1
      const kf = idx >= 0 ? layer!.frames[idx] : null
      const from = kf?.shapes.find((s) => s.id === selection.shapeId)
      if (kf && kf.tween !== 'none' && from) {
        let nextKf: ReturnType<typeof getActiveKeyframe> = null
        for (let i = idx + 1; i < layer!.frames.length; i++) {
          if (layer!.frames[i]) { nextKf = layer!.frames[i]; break }
        }
        const to = nextKf?.shapes.find((s) => s.id === selection.shapeId)
        if (to) {
          const a = { x: from.x + from.width / 2, y: from.y + from.height / 2 }
          const b = { x: to.x + to.width / 2, y: to.y + to.height / 2 }
          ctx.save()
          ctx.strokeStyle = kf.tween === 'shape' ? '#43a047' : '#1473e6'
          ctx.fillStyle = ctx.strokeStyle
          ctx.lineWidth = 1.5 / zoom
          ctx.setLineDash([5 / zoom, 4 / zoom])
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
          ctx.setLineDash([])
          for (const pt of [a, b]) { ctx.beginPath(); ctx.arc(pt.x, pt.y, 3 / zoom, 0, Math.PI * 2); ctx.fill() }
          const angle = Math.atan2(b.y - a.y, b.x - a.x)
          ctx.beginPath()
          ctx.moveTo(b.x, b.y)
          ctx.lineTo(b.x - 8 * Math.cos(angle - 0.4) / zoom, b.y - 8 * Math.sin(angle - 0.4) / zoom)
          ctx.lineTo(b.x - 8 * Math.cos(angle + 0.4) / zoom, b.y - 8 * Math.sin(angle + 0.4) / zoom)
          ctx.closePath(); ctx.fill()
          ctx.restore()
        }
      }
    }

    const drawGuide = (points: Point[], color: string, closed: boolean) => {
      if (!points.length) return
      ctx.save()
      ctx.strokeStyle = color
      ctx.fillStyle = '#fff'
      ctx.lineWidth = 1 / zoom
      ctx.setLineDash([4 / zoom, 3 / zoom])
      ctx.beginPath()
      ctx.moveTo(points[0].x, points[0].y)
      for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y)
      if (closed) ctx.closePath()
      ctx.stroke()
      ctx.setLineDash([])
      const s = 5 / zoom
      for (const pt of points) {
        ctx.fillRect(pt.x - s / 2, pt.y - s / 2, s, s)
        ctx.strokeRect(pt.x - s / 2, pt.y - s / 2, s, s)
      }
      ctx.restore()
    }
    drawGuide(penPoints, '#1473e6', false)
    drawGuide(lassoPoints, '#e53935', true)

    const selectedLayer = project.layers.find((l) => l.id === selection.layerId)
    const kf = selectedLayer ? getActiveKeyframe(selectedLayer, currentFrame) : null
    const selected = kf?.shapes.find((s) => s.id === selection.shapeId)
    if (selected && tool !== 'subselection') drawSelection(ctx, selected, zoom)
    if (selected && tool === 'subselection' && selected.points?.length) {
      drawGuide(selected.points, '#1473e6', false)
    }
  }, [project, zoom, currentFrame, state.showGrid, state.onionSkin, state.onionRange, state.onionOpacity, state.showBones, draft, draftBone, selection, penPoints, lassoPoints, tool, snapJoint])

  useEffect(() => { render() }, [render])

  const pickShape = (p: Point): { shape: Shape; layerId: string } | null => {
    for (const layer of [...project.layers].reverse()) {
      if (!layer.visible || layer.locked) continue
      const kf = getActiveKeyframe(layer, currentFrame)
      if (!kf) continue
      for (const shape of [...kf.shapes].reverse()) {
        if (shape.visible && pointInShape(shape, p)) return { shape, layerId: layer.id }
      }
    }
    return null
  }

  const pickBone = (p: Point): Bone | null => {
    const bones = getRenderBones(project, currentFrame)
    const tol = 10 / zoom
    for (const bone of [...bones].reverse()) {
      if (Math.hypot(p.x - bone.x2, p.y - bone.y2) <= tol || Math.hypot(p.x - bone.x1, p.y - bone.y1) <= tol) return bone
    }
    for (const bone of [...bones].reverse()) {
      const dx = bone.x2 - bone.x1
      const dy = bone.y2 - bone.y1
      const len2 = dx * dx + dy * dy || 1
      const t = Math.max(0, Math.min(1, ((p.x - bone.x1) * dx + (p.y - bone.y1) * dy) / len2))
      if (Math.hypot(p.x - (bone.x1 + t * dx), p.y - (bone.y1 + t * dy)) <= tol) return bone
    }
    return null
  }

  const findSnapJoint = (p: Point): { point: Point; bone: Bone } | null => {
    const bones = getRenderBones(project, currentFrame)
    const tol = 14 / zoom
    let best: { point: Point; bone: Bone; d: number } | null = null
    for (const bone of bones) {
      for (const point of [{ x: bone.x2, y: bone.y2 }, { x: bone.x1, y: bone.y1 }]) {
        const d = Math.hypot(p.x - point.x, p.y - point.y)
        if (d <= tol && (!best || d < best.d)) best = { point, bone, d }
      }
    }
    return best ? { point: best.point, bone: best.bone } : null
  }

  const detectHandle = (p: Point, shape: Shape): string | null => {
    const b = shapeBounds(shape)
    const tol = 8 / zoom
    for (let i = 0; i < HANDLES.length; i++) {
      const h = HANDLES[i]
      const hx = h.includes('w') ? b.x : h.includes('e') ? b.x + b.width : b.x + b.width / 2
      const hy = h.includes('n') ? b.y : h.includes('s') ? b.y + b.height : b.y + b.height / 2
      if (Math.abs(p.x - hx) <= tol && Math.abs(p.y - hy) <= tol) return h
    }
    return null
  }

  const applyResize = (origin: Shape, handle: string, dx: number, dy: number): Partial<Shape> => {
    const b = shapeBounds(origin)
    let { x, y, width, height } = b
    if (handle.includes('w')) { x = origin.x + dx; width = origin.width - dx }
    if (handle.includes('e')) { width = origin.width + dx }
    if (handle.includes('n')) { y = origin.y + dy; height = origin.height - dy }
    if (handle.includes('s')) { height = origin.height + dy }
    if (width < 4) width = 4
    if (height < 4) height = 4
    if (origin.points) {
      const minX = Math.min(...origin.points.map((p) => p.x))
      const minY = Math.min(...origin.points.map((p) => p.y))
      const sx = width / Math.max(1, origin.width)
      const sy = height / Math.max(1, origin.height)
      return {
        x, y, width, height,
        points: origin.points.map((p) => ({ x: x + (p.x - minX) * sx, y: y + (p.y - minY) * sy })),
      }
    }
    return { x, y, width, height }
  }

  const eraseAt = (p: Point) => {
    const radius = settings.eraserSize / 2
    for (const layer of [...project.layers].reverse()) {
      if (!layer.visible || layer.locked) continue
      const kf = getActiveKeyframe(layer, currentFrame)
      if (!kf) continue
      for (const shape of [...kf.shapes].reverse()) {
        if (!shape.visible) continue
        if (shape.type === 'path' && shape.points?.length) {
          const remaining = shape.points.filter((pt) => Math.hypot(pt.x - p.x, pt.y - p.y) > radius)
          if (remaining.length === shape.points.length) continue
          if (remaining.length < 2) {
            dispatch({ type: 'DELETE_SHAPE', layerId: layer.id, shapeId: shape.id })
          } else {
            const xs = remaining.map((pt) => pt.x)
            const ys = remaining.map((pt) => pt.y)
            dispatch({
              type: 'UPDATE_SHAPE', layerId: layer.id, shapeId: shape.id,
              patch: {
                points: remaining,
                x: Math.min(...xs), y: Math.min(...ys),
                width: Math.max(...xs) - Math.min(...xs),
                height: Math.max(...ys) - Math.min(...ys),
              },
            })
          }
        } else if (pointInShape(shape, p)) {
          dispatch({ type: 'DELETE_SHAPE', layerId: layer.id, shapeId: shape.id })
        }
      }
    }
  }

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = toWorld(e.clientX, e.clientY)
    e.currentTarget.setPointerCapture(e.pointerId)
    const picked = pickShape(p)

    if (tool === 'hand' || e.button === 1 || e.altKey && tool === 'selection') {
      dragRef.current = { kind: 'pan', start: { x: e.clientX, y: e.clientY }, pan }
      return
    }
    if (tool === 'zoom') {
      dispatch({ type: 'SET_ZOOM', zoom: e.altKey ? zoom / 1.25 : zoom * 1.25 })
      return
    }
    if (tool === 'eyedropper') {
      const canvas = canvasRef.current!
      const rect = canvas.getBoundingClientRect()
      const ctx = canvas.getContext('2d')!
      const px = Math.max(0, Math.min(canvas.width - 1, Math.round((e.clientX - rect.left) * (canvas.width / rect.width))))
      const py = Math.max(0, Math.min(canvas.height - 1, Math.round((e.clientY - rect.top) * (canvas.height / rect.height))))
      const data = ctx.getImageData(px, py, 1, 1).data
      const hex = `#${[data[0], data[1], data[2]].map((v) => v.toString(16).padStart(2, '0')).join('')}`
      dispatch({ type: 'SET_FILL', color: hex })
      dispatch({ type: 'STATUS', message: `Picked color ${hex}` })
      return
    }
    if (tool === 'eraser') {
      dispatch({ type: 'BEGIN_TRANSFORM' })
      dragRef.current = { kind: 'erase', points: [p] }
      eraseAt(p)
      return
    }
    if (tool === 'paintBucket' && picked) {
      dispatch({ type: 'UPDATE_SHAPE', layerId: picked.layerId, shapeId: picked.shape.id, patch: { fill: state.fillColor } })
      return
    }
    if (tool === 'inkBottle' && picked) {
      dispatch({ type: 'UPDATE_SHAPE', layerId: picked.layerId, shapeId: picked.shape.id, patch: { stroke: state.strokeColor, strokeWidth: state.strokeWidth } })
      return
    }
    if (tool === 'text') {
      dispatch({
        type: 'ADD_SHAPE',
        shape: createShape({
          name: 'Text', type: 'text', x: p.x, y: p.y - settings.fontSize / 2, width: 160, height: settings.fontSize * 1.3,
          text: 'Your text here', fontSize: settings.fontSize,
          fontFamily: settings.fontFamily, fontBold: settings.bold, fontItalic: settings.italic,
          fill: state.fillColor, stroke: state.strokeColor,
          strokeWidth: settings.bold ? 0.6 : 0, rotation: settings.italic ? -4 : 0,
        }),
      })
      dispatch({ type: 'SET_TOOL', tool: 'selection' })
      return
    }

    if (tool === 'bone') {
      const bones = getRenderBones(project, currentFrame)
      const near = pickBone(p)
      const layerId = selection.layerId ?? project.layers[0]?.id ?? ''
      const layer = project.layers.find((l) => l.id === layerId)
      const shapes = getActiveKeyframe(layer!, currentFrame)?.shapes ?? []
      const onHead = near && Math.hypot(p.x - near.x1, p.y - near.y1) <= 11 / zoom
      const onTail = near && Math.hypot(p.x - near.x2, p.y - near.y2) <= 11 / zoom

      // Alt-drag anywhere creates a free (unconnected) bone, like Animate.
      if (e.altKey) {
        const start = near && onTail ? { x: near.x2, y: near.y2 } : { x: p.x, y: p.y }
        const newBone: Bone = {
          id: uid('bone'), name: `Bone ${bones.length + 1}`,
          x1: start.x, y1: start.y, x2: start.x, y2: start.y,
          parentId: null, connected: false,
        }
        setDraftBone(newBone)
        setSnapJoint(null)
        dragRef.current = { kind: 'boneDraw', start, parentId: null }
        return
      }

      // Drag from a tail joint to chain a connected child bone. This is the
      // primary Animate rigging gesture, so it takes priority over posing.
      if (near && onTail) {
        const start = { x: near.x2, y: near.y2 }
        const newBone: Bone = {
          id: uid('bone'), name: `Bone ${bones.length + 1}`,
          x1: start.x, y1: start.y, x2: start.x, y2: start.y,
          parentId: near.id, connected: true,
        }
        setDraftBone(newBone)
        setSnapJoint(null)
        dispatch({ type: 'SET_SELECTION', selection: { layerId, shapeId: null, boneId: near.id } })
        dragRef.current = { kind: 'boneDraw', start, parentId: near.id }
        return
      }

      // Dragging the head joint or the bone body poses the rig.
      if (near && (onHead || selectedNear(near, selection.boneId, p, zoom))) {
        dispatch({ type: 'SET_SELECTION', selection: { layerId, shapeId: selection.shapeId ?? null, boneId: near.id } })
        if (!near.locked) {
          dispatch({ type: 'BEGIN_TRANSFORM' })
          if (onHead) {
            dragRef.current = {
              kind: 'boneTranslate', bone: near, bones, shapes,
              start: { x: p.x, y: p.y }, layerId,
            }
          } else {
            dragRef.current = {
              kind: 'boneRotate', bone: near, bones, shapes,
              lastAngle: Math.atan2(p.y - near.y1, p.x - near.x1),
              totalAngle: 0, layerId,
            }
          }
        }
        setSnapJoint(null)
        return
      }

      // Otherwise draw a new root bone. The end can snap to a joint to join
      // an existing armature.
      const newBone: Bone = {
        id: uid('bone'), name: `Bone ${bones.length + 1}`,
        x1: p.x, y1: p.y, x2: p.x, y2: p.y, parentId: null, connected: false,
      }
      setDraftBone(newBone)
      setSnapJoint(null)
      dragRef.current = { kind: 'boneDraw', start: { x: p.x, y: p.y }, parentId: null }
      return
    }

    if (tool === 'pen') {
      setPenPoints((prev) => [...prev, p])
      return
    }
    if (tool === 'lasso') {
      dragRef.current = { kind: 'lasso', points: [p] }
      setLassoPoints([p])
      return
    }

    if (tool === 'selection' || tool === 'subselection') {
      // In Animate you pose an armature with the Selection tool. Bones take
      // priority when you grab a joint, so rigging still works over artwork.
      const poseLayerId = selection.layerId ?? project.layers[0]?.id ?? ''
      const poseLayer = project.layers.find((l) => l.id === poseLayerId)
      const poseBones = poseLayer ? (getActiveKeyframe(poseLayer, currentFrame)?.bones ?? []) : []
      const poseShapes = poseLayer ? (getActiveKeyframe(poseLayer, currentFrame)?.shapes ?? []) : []
      const poseBone = posepick(p, poseBones, zoom)
      if (poseBone && (poseBone.onJoint || !picked)) {
        const bone = poseBone.bone
        dispatch({ type: 'SET_SELECTION', selection: { layerId: poseLayerId, shapeId: null, boneId: bone.id } })
        if (!bone.locked) {
          dispatch({ type: 'BEGIN_TRANSFORM' })
          if (poseBone.onJoint && poseBone.part === 'head') {
            dragRef.current = { kind: 'boneTranslate', bone, bones: poseBones, shapes: poseShapes, start: { x: p.x, y: p.y }, layerId: poseLayerId }
          } else {
            dragRef.current = {
              kind: 'boneRotate', bone, bones: poseBones, shapes: poseShapes, layerId: poseLayerId,
              lastAngle: Math.atan2(p.y - bone.y1, p.x - bone.x1), totalAngle: 0,
            }
          }
        }
        return
      }
      if (tool === 'subselection' && selection.shapeId && selection.layerId) {
        const selLayer = project.layers.find((l) => l.id === selection.layerId)
        const selKf = selLayer ? getActiveKeyframe(selLayer, currentFrame) : null
        const selShape = selKf?.shapes.find((s) => s.id === selection.shapeId)
        if (selShape?.points?.length) {
          let nearest = -1
          let best = 10 / zoom
          selShape.points.forEach((pt, i) => {
            const d = Math.hypot(pt.x - p.x, pt.y - p.y)
            if (d < best) { best = d; nearest = i }
          })
          if (nearest >= 0) {
            dispatch({ type: 'BEGIN_TRANSFORM' })
            dragRef.current = { kind: 'point', index: nearest, origin: selShape, layerId: selection.layerId }
            return
          }
        }
      }
      if (selection.shapeId && picked?.shape.id === selection.shapeId && selection.layerId === picked.layerId) {
        const handle = detectHandle(p, picked.shape)
        dispatch({ type: 'BEGIN_TRANSFORM' })
        if (handle) dragRef.current = { kind: 'resize', start: p, origin: picked.shape, layerId: picked.layerId, handle }
        else dragRef.current = { kind: 'move', start: p, origin: picked.shape, layerId: picked.layerId }
        return
      }
      if (picked) {
        dispatch({ type: 'SET_SELECTION', selection: { layerId: picked.layerId, shapeId: picked.shape.id } })
        const handle = detectHandle(p, picked.shape)
        dispatch({ type: 'BEGIN_TRANSFORM' })
        dragRef.current = handle
          ? { kind: 'resize', start: p, origin: picked.shape, layerId: picked.layerId, handle }
          : { kind: 'move', start: p, origin: picked.shape, layerId: picked.layerId }
      } else {
        dispatch({ type: 'SET_SELECTION', selection: { layerId: selection.layerId, shapeId: null } })
      }
      return
    }

    if (tool === 'pencil' || tool === 'brush') {
      dragRef.current = { kind: 'path', points: [p] }
      return
    }

    const typeMap: Record<string, Shape['type']> = {
      rectangle: 'rectangle', oval: 'oval', line: 'line', rectPrimitive: 'rectPrimitive',
      ovalPrimitive: 'ovalPrimitive', polyStar: 'polyStar',
    }
    const type = typeMap[tool]
    if (type) {
      const shape = createShape({
        name: type === 'line' ? 'Line' : type === 'polyStar' ? 'Star' : type.charAt(0).toUpperCase() + type.slice(1),
        type, x: p.x, y: p.y, width: 0, height: 0,
        fill: type === 'line' ? 'none' : state.fillColor,
        stroke: state.strokeColor, strokeWidth: state.strokeWidth,
        points: type === 'line' ? [p, p] : undefined,
        cornerRadius: settings.cornerRadius, innerRadius: settings.starInnerRadius, sides: settings.starSides,
      })
      dragRef.current = { kind: 'draw', start: p, shape }
      setDraft(shape)
    }
  }

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = toWorld(e.clientX, e.clientY)
    setCursorPos(p)
    const drag = dragRef.current
    if (tool === 'bone' && drag.kind === 'none') {
      const snap = findSnapJoint(p)
      setSnapJoint(snap?.point ?? null)
      const near = pickBone(p)
      e.currentTarget.style.cursor = snap ? 'crosshair' : near ? (near.locked ? 'not-allowed' : 'grab') : 'crosshair'
    } else if (tool === 'bone' && drag.kind !== 'none') {
      e.currentTarget.style.cursor = drag.kind === 'boneTranslate' ? 'grabbing' : 'crosshair'
    }
    if (drag.kind === 'pan') {
      dispatch({ type: 'SET_PAN', pan: { x: drag.pan.x + (e.clientX - drag.start.x), y: drag.pan.y + (e.clientY - drag.start.y) } })
    } else if (drag.kind === 'move') {
      const dx = p.x - drag.start.x
      const dy = p.y - drag.start.y
      dispatch({
        type: 'UPDATE_SHAPE', layerId: drag.layerId, shapeId: drag.origin.id,
        patch: { x: drag.origin.x + dx, y: drag.origin.y + dy, points: drag.origin.points?.map((pt) => ({ x: pt.x + dx, y: pt.y + dy })) },
      })
    } else if (drag.kind === 'resize') {
      dispatch({
        type: 'UPDATE_SHAPE', layerId: drag.layerId, shapeId: drag.origin.id,
        patch: applyResize(drag.origin, drag.handle, p.x - drag.start.x, p.y - drag.start.y),
      })
    } else if (drag.kind === 'point') {
      const points = drag.origin.points!.map((pt, i) => (i === drag.index ? p : pt))
      dispatch({ type: 'UPDATE_SHAPE', layerId: drag.layerId, shapeId: drag.origin.id, patch: { points } })
    } else if (drag.kind === 'boneDraw') {
      const snap = findSnapJoint(p)
      const connect = snap && snap.bone.id !== drag.parentId ? snap : null
      const end = connect ? connect.point : p
      setSnapJoint(connect?.point ?? null)
      // Snapping the end joint to another bone joins the armature, like
      // Animate's joint snapping. Alt-dragged free bones never reconnect.
      setDraftBone((prev) => prev ? {
        ...prev,
        x2: end.x, y2: end.y,
        parentId: connect ? connect.bone.id : drag.parentId,
        connected: connect ? true : prev.connected,
      } : prev)
    } else if (drag.kind === 'boneRotate') {
      let pointerAngle = Math.atan2(p.y - drag.bone.y1, p.x - drag.bone.x1)
      if (e.shiftKey) pointerAngle = Math.round(pointerAngle / (Math.PI / 12)) * (Math.PI / 12)
      let total = drag.totalAngle + normalizedAngle(pointerAngle - drag.lastAngle)
      if (drag.bone.rotationEnabled) {
        total = clamp(
          total,
          ((drag.bone.rotationMin ?? -180) * Math.PI) / 180,
          ((drag.bone.rotationMax ?? 180) * Math.PI) / 180,
        )
      }
      dragRef.current = { ...drag, lastAngle: pointerAngle, totalAngle: total }
      const origin = { x: drag.bone.x1, y: drag.bone.y1 }
      const movedIds = new Set(drag.bones.filter((b) => b.id === drag.bone.id || isBoneDescendant(b, drag.bone.id, drag.bones)).map((b) => b.id))
      const bones = drag.bones.map((b) => {
        if (!movedIds.has(b.id)) return b
        const start = rotatePoint({ x: b.x1, y: b.y1 }, origin, total)
        const end = rotatePoint({ x: b.x2, y: b.y2 }, origin, total)
        return { ...b, x1: start.x, y1: start.y, x2: end.x, y2: end.y }
      })
      const shapePatches = drag.shapes
        .filter((s) => s.boneId && movedIds.has(s.boneId))
        .map((s) => ({ id: s.id, patch: rotateShapeAround(s, origin, total) }))
      dispatch({ type: 'SET_BONES', bones, shapePatches })
    } else if (drag.kind === 'boneTranslate') {
      let dx = p.x - drag.start.x
      let dy = p.y - drag.start.y
      if (drag.bone.translateXEnabled) dx = clamp(dx, drag.bone.translateXMin ?? -project.width, drag.bone.translateXMax ?? project.width)
      if (drag.bone.translateYEnabled) dy = clamp(dy, drag.bone.translateYMin ?? -project.height, drag.bone.translateYMax ?? project.height)
      const movedIds = new Set(drag.bones.filter((b) => b.id === drag.bone.id || isBoneDescendant(b, drag.bone.id, drag.bones)).map((b) => b.id))
      const bones = drag.bones.map((b) => movedIds.has(b.id)
        ? { ...b, x1: b.x1 + dx, y1: b.y1 + dy, x2: b.x2 + dx, y2: b.y2 + dy }
        : b)
      const shapePatches = drag.shapes
        .filter((s) => s.boneId && movedIds.has(s.boneId))
        .map((s) => ({ id: s.id, patch: translateShape(s, dx, dy) }))
      dispatch({ type: 'SET_BONES', bones, shapePatches })
    } else if (drag.kind === 'lasso') {
      const points = [...drag.points, p]
      dragRef.current = { kind: 'lasso', points }
      setLassoPoints(points)
    } else if (drag.kind === 'erase') {
      const points = [...drag.points, p]
      dragRef.current = { kind: 'erase', points }
      eraseAt(p)
    } else if (drag.kind === 'path') {
      const points = [...drag.points, p]
      dragRef.current = { kind: 'path', points }
      const brushId = settings.brushId
      setDraft(createShape({
        name: `${tool === 'brush' ? 'Brush' : 'Pencil'} · ${getBrushName(brushId)}`, type: 'path',
        x: 0, y: 0, width: project.width, height: project.height,
        fill: 'none', stroke: state.strokeColor, strokeWidth: settings.brushSize,
        opacity: settings.brushOpacity,
        brush: {
          id: brushId, size: settings.brushSize, opacity: settings.brushOpacity,
          flowScale: settings.flowScale, spacingScale: settings.spacingScale, scatterScale: settings.scatterScale,
        },
        points, closed: false,
      }))
    } else if (drag.kind === 'draw') {
      let dx = p.x - drag.start.x
      let dy = p.y - drag.start.y
      if (e.shiftKey) { const s = Math.max(Math.abs(dx), Math.abs(dy)); dx = Math.sign(dx) * s; dy = Math.sign(dy) * s }
      if (state.snapToGrid) { dx = Math.round(dx / 20) * 20; dy = Math.round(dy / 20) * 20 }
      const shape: Shape = {
        ...drag.shape,
        x: Math.min(drag.start.x, drag.start.x + dx),
        y: Math.min(drag.start.y, drag.start.y + dy),
        width: Math.abs(dx), height: Math.abs(dy),
        points: drag.shape.type === 'line' ? [drag.start, { x: drag.start.x + dx, y: drag.start.y + dy }] : undefined,
      }
      dragRef.current = { kind: 'draw', start: drag.start, shape }
      setDraft(shape)
    }
  }

  const onPointerUp = () => {
    const drag = dragRef.current
    dragRef.current = { kind: 'none' }
    if (drag.kind === 'draw' && draft && draft.width > 2 && draft.height > 2) {
      dispatch({ type: 'ADD_SHAPE', shape: { ...draft, id: uid('shape') } })
    }
    if (drag.kind === 'path' && drag.points.length > 1) {
      const brushId = settings.brushId
      dispatch({ type: 'ADD_SHAPE', shape: createShape({
        name: `${tool === 'brush' ? 'Brush' : 'Pencil'} · ${getBrushName(brushId)}`, type: 'path',
        x: 0, y: 0, width: project.width, height: project.height,
        fill: 'none', stroke: state.strokeColor, strokeWidth: settings.brushSize,
        opacity: settings.brushOpacity,
        brush: {
          id: brushId, size: settings.brushSize, opacity: settings.brushOpacity,
          flowScale: settings.flowScale, spacingScale: settings.spacingScale, scatterScale: settings.scatterScale,
        },
        points: smoothPoints(drag.points, settings.smoothing), closed: false,
      }) })
    }
    if (drag.kind === 'erase') dispatch({ type: 'END_TRANSFORM' })
    if (drag.kind === 'lasso' && drag.points.length > 2) {
      let found: { shape: Shape; layerId: string } | null = null
      for (const layer of [...project.layers].reverse()) {
        if (!layer.visible || layer.locked) continue
        const kf = getActiveKeyframe(layer, currentFrame)
        if (!kf) continue
        for (const shape of [...kf.shapes].reverse()) {
          const center = { x: shape.x + shape.width / 2, y: shape.y + shape.height / 2 }
          if (pointInPolygon(center, drag.points)) { found = { shape, layerId: layer.id }; break }
        }
        if (found) break
      }
      dispatch({ type: 'SET_SELECTION', selection: found ? { layerId: found.layerId, shapeId: found.shape.id } : { layerId: selection.layerId, shapeId: null } })
      setLassoPoints([])
    }
    if (drag.kind === 'boneDraw' && draftBone) {
      if (Math.hypot(draftBone.x2 - draftBone.x1, draftBone.y2 - draftBone.y1) > 6) {
        dispatch({ type: 'ADD_BONE', bone: draftBone })
      }
      setDraftBone(null)
    }
    if (drag.kind === 'point' || drag.kind === 'boneRotate' || drag.kind === 'boneTranslate') dispatch({ type: 'END_TRANSFORM' })
    if (drag.kind === 'move' || drag.kind === 'resize') dispatch({ type: 'END_TRANSFORM' })
    setDraft(null)
  }

  const onDoubleClick = () => {
    if (penPoints.length > 1) {
      dispatch({ type: 'ADD_SHAPE', shape: createShape({
        name: 'Pen Path', type: 'path', x: 0, y: 0, width: project.width, height: project.height,
        fill: state.fillColor, stroke: state.strokeColor, strokeWidth: state.strokeWidth,
        points: penPoints, closed: false,
      }) })
      setPenPoints([])
    }
  }

  useEffect(() => {
    const clear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setPenPoints([]); setLassoPoints([]) }
    }
    window.addEventListener('keydown', clear)
    return () => window.removeEventListener('keydown', clear)
  }, [])

  const fitStage = () => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    dispatch({ type: 'SET_ZOOM', zoom: Math.min((rect.width - 80) / project.width, (rect.height - 80) / project.height) })
    dispatch({ type: 'SET_PAN', pan: { x: 0, y: 0 } })
  }

  const rulerTicks = (len: number, step = 50) => Array.from({ length: Math.floor(len / step) + 1 }, (_, i) => i * step)

  return (
    <div className="stage-area">
      <div className="stage-toolbar">
        <div className="stage-toolbar-left">
          {!compact && <>
            <button className={`mini-btn ${state.showRulers ? 'active' : ''}`} title="Show/hide rulers" onClick={() => dispatch({ type: 'TOGGLE', key: 'showRulers' })}><Icon name="ruler" size={13} /></button>
            <button className={`mini-btn ${state.showGrid ? 'active' : ''}`} title="Toggle grid" onClick={() => dispatch({ type: 'TOGGLE', key: 'showGrid' })}><Icon name="grid" size={13} /></button>
            <button className={`mini-btn ${state.snapToGrid ? 'active' : ''}`} title="Snap to grid" onClick={() => dispatch({ type: 'TOGGLE', key: 'snapToGrid' })}><Icon name="magnet" size={13} /></button>
            <button className={`mini-btn ${state.showBones ? 'active' : ''}`} title="Show bones" onClick={() => dispatch({ type: 'TOGGLE', key: 'showBones' })}><Icon name="bone" size={14} /></button>
            <button className={`mini-btn ${state.tool === 'bone' ? 'active' : ''}`} title="Bone tool (M)" onClick={() => dispatch({ type: 'SET_TOOL', tool: 'bone' })}><Icon name="motionPath" size={14} /></button>
            <span className="toolbar-divider" />
          </>}
          <button className={`mini-btn ${state.onionSkin ? 'active' : ''}`} title="Onion skin" onClick={() => dispatch({ type: 'TOGGLE', key: 'onionSkin' })}><Icon name="onion" size={14} /></button>
          <span className="stage-label">{compact ? 'Your animation' : 'Scene 1'}</span>
        </div>
        <div className="stage-toolbar-right">
          <span className="zoom-label">{Math.round(zoom * 100)}%</span>
          <input className="zoom-slider" type="range" min="0.1" max="4" step="0.05" value={zoom} onChange={(e) => dispatch({ type: 'SET_ZOOM', zoom: Number(e.target.value) })} />
          <button className="mini-btn" title="Fit in window" onClick={fitStage}><Icon name="center" size={13} /></button>
        </div>
      </div>
      {!compact && <ToolOptions />}

      <div className="stage-viewport" ref={containerRef}>
        {state.showRulers && !compact && (
          <>
            <div className="ruler ruler-h" style={{ left: 18 }}>
              {rulerTicks(project.width).map((t) => (
                <span key={t} className="ruler-tick" style={{ left: t * zoom }}><i />{t === 0 ? '' : t}</span>
              ))}
            </div>
            <div className="ruler ruler-v" style={{ top: 18 }}>
              {rulerTicks(project.height).map((t) => (
                <span key={t} className="ruler-tick" style={{ top: t * zoom }}><i />{t === 0 ? '' : t}</span>
              ))}
            </div>
            <div className="ruler-corner" />
          </>
        )}
        <div
          className="stage-wrap"
          style={{
            transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px))`,
            left: state.showRulers && !compact ? 'calc(50% + 9px)' : '50%',
            top: state.showRulers && !compact ? 'calc(50% + 9px)' : '50%',
          }}
        >
          <canvas
            ref={canvasRef}
            className={`stage-canvas tool-${tool}`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onDoubleClick={onDoubleClick}
            onContextMenu={(e) => e.preventDefault()}
          />
          <div className="stage-shadow" />
        </div>
      </div>

      <div className="stage-footer">
        <span>X: {Math.round(cursorPos.x)} Y: {Math.round(cursorPos.y)}</span>
        <span>W: {project.width} × H: {project.height} px</span>
        <span>{state.statusMessage}</span>
      </div>
    </div>
  )
}
