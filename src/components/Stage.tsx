import { useCallback, useEffect, useRef, useState } from 'react'
import { getBrush, smoothPoints } from '../brushes'
import { drawBones, drawSelection, drawShape, drawShapeOutline } from '../draw'
import { useStore } from '../store'
import { createShape, type Bone, type Point, type Shape, uid } from '../types'
import { distanceToSegment, findKeyframeIndex, getActiveKeyframe, getRenderBones, getRenderShapes, pointInShape, shapeBounds } from '../utils'
import { ToolOptions } from './ToolOptions'

type DragMode =
  | { kind: 'none' }
  | { kind: 'draw'; start: Point; shape: Shape }
  | { kind: 'path'; id: string; points: Point[]; raw: Point; anchor: Point }
  | { kind: 'lasso'; points: Point[] }
  | { kind: 'erase'; points: Point[] }
  | { kind: 'boneDraw'; start: Point; parentId: string | null }
  | { kind: 'rigTranslate'; bones: Bone[]; shapes: Shape[]; start: Point; layerId: string }
  | { kind: 'boneRotate'; bone: Bone; bones: Bone[]; shapes: Shape[]; lastAngle: number; totalAngle: number; layerId: string }
  | { kind: 'boneTranslate'; bone: Bone; bones: Bone[]; shapes: Shape[]; start: Point; layerId: string }
  | { kind: 'point'; index: number; origin: Shape; layerId: string }
  | { kind: 'move'; start: Point; origin: Shape; layerId: string }
  | { kind: 'resize'; start: Point; origin: Shape; layerId: string; handle: string }
  | { kind: 'motionPathDraw'; layerId: string; shapeId: string; points: Point[]; times: number[]; startedAt: number }
  | { kind: 'motionPathEdit'; layerId: string; shapeId: string; points: Point[]; times?: number[]; index: number }
  | { kind: 'pan'; start: Point; pan: Point }

const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

type PathDragMode = Extract<DragMode, { kind: 'path' }>
type ClientPoint = { x: number; y: number }

function pointerSamples(e: React.PointerEvent<HTMLCanvasElement>): ClientPoint[] {
  const native = e.nativeEvent
  const getCoalesced = (native as PointerEvent & { getCoalescedEvents?: () => PointerEvent[] }).getCoalescedEvents
  const coalesced = typeof getCoalesced === 'function' ? getCoalesced.call(native) : []
  const events = coalesced.length ? coalesced : []
  const last = events[events.length - 1]
  if (!last || last.clientX !== native.clientX || last.clientY !== native.clientY) events.push(native)
  return events.map((sample) => ({ x: sample.clientX, y: sample.clientY }))
}

function lerpPoint(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}

function minStrokeStep(brushSize: number, zoom: number): number {
  return Math.max(0.25, Math.min(1.5, brushSize / (zoom * 6)))
}

function stabilizerRadius(smoothing: number, brushSize: number, zoom: number): number {
  const amount = clamp(smoothing, 0, 1)
  return (2 + brushSize * 0.7 + amount * 18) / Math.max(0.25, zoom)
}

function appendStrokePoint(points: Point[], point: Point, minStep: number): void {
  const last = points[points.length - 1]
  if (last && Math.hypot(point.x - last.x, point.y - last.y) < minStep) return
  points.push(point)
}

/** Krita-style stabilizer: the stroke follows the cursor once it leaves a small radius. */
function addStabilizedSample(
  drag: PathDragMode,
  raw: Point,
  smoothing: number,
  brushSize: number,
  zoom: number,
): void {
  drag.raw = raw
  const radius = stabilizerRadius(smoothing, brushSize, zoom)
  const minStep = minStrokeStep(brushSize, zoom)
  const dx = raw.x - drag.anchor.x
  const dy = raw.y - drag.anchor.y
  const distance = Math.hypot(dx, dy)
  if (distance < minStep) return
  const travel = Math.max(0, distance - radius)
  if (travel === 0) return
  const follow = 0.72 - clamp(smoothing, 0, 1) * 0.5
  const pull = Math.min(1, follow + travel / (radius * 3.5))
  const move = travel * pull
  drag.anchor = {
    x: drag.anchor.x + (dx / distance) * move,
    y: drag.anchor.y + (dy / distance) * move,
  }
  appendStrokePoint(drag.points, drag.anchor, minStep)
}

/** Bring the stabilized tail to the release point so the stroke ends under the cursor. */
function settleStroke(
  drag: PathDragMode,
  smoothing: number,
  brushSize: number,
  zoom: number,
): void {
  const distance = Math.hypot(drag.raw.x - drag.anchor.x, drag.raw.y - drag.anchor.y)
  if (distance < minStrokeStep(brushSize, zoom)) return
  const radius = Math.max(1, stabilizerRadius(smoothing, brushSize, zoom))
  const steps = Math.min(12, Math.max(1, Math.ceil(distance / (radius * 0.6))))
  for (let i = 1; i <= steps; i++) drag.points.push(lerpPoint(drag.anchor, drag.raw, i / steps))
  drag.anchor = drag.raw
}

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
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const dragRef = useRef<DragMode>({ kind: 'none' })
  const [draft, setDraft] = useState<Shape | null>(null)
  const [draftBone, setDraftBone] = useState<Bone | null>(null)
  const [penPoints, setPenPoints] = useState<Point[]>([])
  const [lassoPoints, setLassoPoints] = useState<Point[]>([])
  const [motionPathDraft, setMotionPathDraft] = useState<Point[] | null>(null)
  const [snapJoint, setSnapJoint] = useState<Point | null>(null)
  const pathDraftFrameRef = useRef<number | null>(null)
  const pendingPathDraftRef = useRef<{ id: string; points: Point[] } | null>(null)

  const toWorld = useCallback((clientX: number, clientY: number, rect = containerRef.current!.getBoundingClientRect()): Point => {
    const originX = rect.left + (rect.width - project.width * zoom) / 2 + pan.x
    const originY = rect.top + (rect.height - project.height * zoom) / 2 + pan.y
    return { x: (clientX - originX) / zoom, y: (clientY - originY) / zoom }
  }, [project.width, project.height, zoom, pan])

  const makeStrokeShape = (points: Point[], id: string): Shape => createShape({
    id,
    name: `${tool === 'brush' ? 'Brush' : 'Pencil'} · ${getBrushName(settings.brushId)}`,
    type: 'path',
    x: 0, y: 0, width: project.width, height: project.height,
    fill: 'none', stroke: state.strokeColor, strokeWidth: settings.brushSize,
    opacity: settings.brushOpacity,
    brush: {
      id: settings.brushId, size: settings.brushSize, opacity: settings.brushOpacity,
      flowScale: settings.flowScale, spacingScale: settings.spacingScale, scatterScale: settings.scatterScale,
    },
    points: smoothPoints(points, settings.smoothing), closed: false,
  })

  const clearLiveStroke = useCallback(() => {
    const overlay = overlayRef.current
    if (!overlay) return
    const ctx = overlay.getContext('2d')
    if (!ctx) return
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, overlay.width, overlay.height)
  }, [])

  const paintLiveStroke = (shape: Shape) => {
    const overlay = overlayRef.current
    if (!overlay) return
    const ctx = overlay.getContext('2d')
    if (!ctx) return
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, overlay.width, overlay.height)
    ctx.setTransform(zoom, 0, 0, zoom, 0, 0)
    drawShape(ctx, shape)
  }

  const flushPathDraft = () => {
    pathDraftFrameRef.current = null
    const pending = pendingPathDraftRef.current
    if (!pending) return
    paintLiveStroke(makeStrokeShape(pending.points, pending.id))
  }

  useEffect(() => () => {
    if (pathDraftFrameRef.current !== null) cancelAnimationFrame(pathDraftFrameRef.current)
  }, [])

  const render = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const width = Math.max(1, Math.round(project.width * zoom))
    const height = Math.max(1, Math.round(project.height * zoom))
    if (canvas.width !== width) canvas.width = width
    if (canvas.height !== height) canvas.height = height
    canvas.style.width = `${project.width * zoom}px`
    canvas.style.height = `${project.height * zoom}px`
    const overlay = overlayRef.current
    if (overlay) {
      if (overlay.width !== width) overlay.width = width
      if (overlay.height !== height) overlay.height = height
      overlay.style.width = canvas.style.width
      overlay.style.height = canvas.style.height
    }
    clearLiveStroke()
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

    for (const { shape, layer } of getRenderShapes(project, currentFrame)) {
      if (layer.outline) drawShapeOutline(ctx, shape, layer.color, zoom)
      else drawShape(ctx, shape)
    }
    if (draft) drawShape(ctx, draft)

    const bones = getRenderBones(project, currentFrame)
    if (state.showBones || tool === 'bone') {
      drawBones(ctx, bones, selection.boneId ?? null, zoom, { snapPoint: snapJoint })
    }
    if (draftBone) drawBones(ctx, [draftBone], draftBone.id, zoom)

    const drawGuide = (points: Point[], color: string, closed: boolean, pencil = false) => {
      if (!points.length) return
      ctx.save()
      ctx.strokeStyle = color
      ctx.fillStyle = '#fff'
      ctx.lineWidth = (pencil ? 1.5 : 1) / zoom
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      if (!pencil) ctx.setLineDash([4 / zoom, 3 / zoom])
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

    if (selection.shapeId && selection.layerId) {
      const layer = project.layers.find((l) => l.id === selection.layerId)
      const idx = layer ? findKeyframeIndex(layer, currentFrame) : -1
      const kf = idx >= 0 ? layer!.frames[idx] : null
      const from = kf?.shapes.find((s) => s.id === selection.shapeId)
      if (kf && kf.tween !== 'none' && from) {
        const color = kf.tween === 'shape' ? '#43a047' : '#1473e6'
        const path = kf.motionPaths?.[selection.shapeId]
        if (path && path.length > 1) {
          drawGuide(path, color, false, true)
          const tip = path[path.length - 1]
          const prev = path[path.length - 2]
          const angle = Math.atan2(tip.y - prev.y, tip.x - prev.x)
          ctx.save()
          ctx.fillStyle = color
          ctx.beginPath()
          ctx.moveTo(tip.x, tip.y)
          ctx.lineTo(tip.x - 8 * Math.cos(angle - 0.4) / zoom, tip.y - 8 * Math.sin(angle - 0.4) / zoom)
          ctx.lineTo(tip.x - 8 * Math.cos(angle + 0.4) / zoom, tip.y - 8 * Math.sin(angle + 0.4) / zoom)
          ctx.closePath(); ctx.fill()
          ctx.restore()
        }
      }
    }

    drawGuide(penPoints, '#1473e6', false)
    drawGuide(lassoPoints, '#e53935', true)
    if (motionPathDraft) drawGuide(motionPathDraft, '#8e24aa', false, true)

    const selectedLayer = project.layers.find((l) => l.id === selection.layerId)
    const kf = selectedLayer ? getActiveKeyframe(selectedLayer, currentFrame) : null
    const selected = kf?.shapes.find((s) => s.id === selection.shapeId)
    if (selected && tool !== 'subselection') drawSelection(ctx, selected, zoom)
    if (selected && tool === 'subselection' && selected.points?.length) {
      drawGuide(selected.points, '#1473e6', false)
    }
  }, [project, zoom, currentFrame, state.showGrid, state.onionSkin, state.onionRange, state.onionOpacity, state.showBones, draft, draftBone, selection, penPoints, lassoPoints, motionPathDraft, tool, snapJoint, clearLiveStroke])

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

    if (tool === 'motionPath') {
      const layerId = picked?.layerId ?? selection.layerId ?? project.layers[0]?.id
      const shapeId = picked?.shape.id ?? selection.shapeId
      if (!layerId || !shapeId) {
        dispatch({ type: 'STATUS', message: 'Draw over an object, or select one, then sketch its path' })
        return
      }
      const layer = project.layers.find((l) => l.id === layerId)
      const kf = layer ? getActiveKeyframe(layer, currentFrame) : null
      const shape = kf?.shapes.find((s) => s.id === shapeId) ?? picked?.shape
      if (!shape) {
        dispatch({ type: 'STATUS', message: 'Draw over an object, or select one, then sketch its path' })
        return
      }
      if (selection.layerId !== layerId || selection.shapeId !== shapeId) {
        dispatch({ type: 'SET_SELECTION', selection: { layerId, shapeId, boneId: null } })
      }
      const existing = kf?.motionPaths?.[shapeId]
      if (existing?.length) {
        const handleIndex = existing.findIndex((pt) => Math.hypot(pt.x - p.x, pt.y - p.y) <= 8 / zoom)
        if (handleIndex >= 0) {
          const points = existing.map((pt) => ({ ...pt }))
          dragRef.current = {
            kind: 'motionPathEdit', layerId, shapeId, points,
            times: kf?.motionPathTimes?.[shapeId], index: handleIndex,
          }
          setMotionPathDraft(points)
          return
        }
      }
      // Sketching over the object starts at its center; sketching elsewhere
      // starts exactly where the pencil touched so the object can jump anywhere.
      const start = pointInShape(shape, p)
        ? { x: shape.x + shape.width / 2, y: shape.y + shape.height / 2 }
        : { x: p.x, y: p.y }
      const points = [start]
      dragRef.current = { kind: 'motionPathDraw', layerId, shapeId, points, times: [0], startedAt: performance.now() }
      setMotionPathDraft(points)
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

      // Whole-character posing: grab any limb and the entire rig, including
      // feet and bound artwork, moves together as one piece.
      if (settings.poseMode === 'character' && near && !near.locked) {
        dispatch({ type: 'SET_SELECTION', selection: { layerId, shapeId: null, boneId: near.id } })
        dispatch({ type: 'BEGIN_TRANSFORM' })
        dragRef.current = { kind: 'rigTranslate', bones, shapes, start: { x: p.x, y: p.y }, layerId }
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
      const strokeId = uid('shape')
      dragRef.current = { kind: 'path', id: strokeId, points: [p], raw: p, anchor: p }
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
    const drag = dragRef.current
    if (tool === 'bone' && drag.kind === 'none') {
      const snap = findSnapJoint(p)
      setSnapJoint(snap?.point ?? null)
      const near = pickBone(p)
      e.currentTarget.style.cursor = snap ? 'crosshair' : near ? (near.locked ? 'not-allowed' : 'grab') : 'crosshair'
    } else if (tool === 'bone' && drag.kind !== 'none') {
      e.currentTarget.style.cursor = drag.kind === 'boneTranslate' || drag.kind === 'rigTranslate' ? 'grabbing' : 'crosshair'
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
    } else if (drag.kind === 'rigTranslate') {
      const dx = p.x - drag.start.x
      const dy = p.y - drag.start.y
      const bones = drag.bones.map((b) => ({ ...b, x1: b.x1 + dx, y1: b.y1 + dy, x2: b.x2 + dx, y2: b.y2 + dy }))
      const shapePatches = drag.shapes
        .filter((s) => s.boneId)
        .map((s) => ({ id: s.id, patch: translateShape(s, dx, dy) }))
      dispatch({ type: 'SET_BONES', bones, shapePatches })
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
    } else if (drag.kind === 'motionPathDraw') {
      const last = drag.points[drag.points.length - 1]
      if (Math.hypot(p.x - last.x, p.y - last.y) < 2 / zoom) return
      const points = [...drag.points, p]
      const times = [...drag.times, Math.max(drag.times[drag.times.length - 1] + 1, performance.now() - drag.startedAt)]
      dragRef.current = { ...drag, points, times }
      setMotionPathDraft(points)
    } else if (drag.kind === 'motionPathEdit') {
      const points = drag.points.map((pt, i) => i === drag.index ? p : pt)
      dragRef.current = { ...drag, points }
      setMotionPathDraft(points)
    } else if (drag.kind === 'lasso') {
      const points = [...drag.points, p]
      dragRef.current = { kind: 'lasso', points }
      setLassoPoints(points)
    } else if (drag.kind === 'erase') {
      const points = [...drag.points, p]
      dragRef.current = { kind: 'erase', points }
      eraseAt(p)
    } else if (drag.kind === 'path') {
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return
      for (const sample of pointerSamples(e)) {
        addStabilizedSample(drag, toWorld(sample.x, sample.y, rect), settings.smoothing, settings.brushSize, zoom)
      }
      pendingPathDraftRef.current = { id: drag.id, points: drag.points }
      if (pathDraftFrameRef.current === null) pathDraftFrameRef.current = requestAnimationFrame(flushPathDraft)
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

  const onPointerUp = (e?: React.PointerEvent<HTMLCanvasElement>) => {
    let drag = dragRef.current
    if (drag.kind === 'motionPathDraw' && e) {
      const p = toWorld(e.clientX, e.clientY)
      const last = drag.points[drag.points.length - 1]
      if (Math.hypot(p.x - last.x, p.y - last.y) >= 2 / zoom) {
        drag = {
          ...drag,
          points: [...drag.points, p],
          times: [...drag.times, Math.max(drag.times[drag.times.length - 1] + 1, performance.now() - drag.startedAt)],
        }
      }
    }
    if (drag.kind === 'path' && e) {
      const rect = containerRef.current?.getBoundingClientRect()
      if (rect) {
        for (const sample of pointerSamples(e)) {
          addStabilizedSample(drag, toWorld(sample.x, sample.y, rect), settings.smoothing, settings.brushSize, zoom)
        }
      }
      settleStroke(drag, settings.smoothing, settings.brushSize, zoom)
    }
    if (pathDraftFrameRef.current !== null) cancelAnimationFrame(pathDraftFrameRef.current)
    pathDraftFrameRef.current = null
    pendingPathDraftRef.current = null
    dragRef.current = { kind: 'none' }
    if (drag.kind === 'draw' && draft && draft.width > 2 && draft.height > 2) {
      dispatch({ type: 'ADD_SHAPE', shape: { ...draft, id: uid('shape') } })
    }
    if (drag.kind === 'path' && drag.points.length > 1) {
      dispatch({ type: 'ADD_SHAPE', shape: makeStrokeShape(drag.points, drag.id) })
    }
    if (drag.kind === 'motionPathDraw' && drag.points.length > 1) {
      dispatch({ type: 'SET_MOTION_PATH', layerId: drag.layerId, shapeId: drag.shapeId, points: drag.points, times: drag.times })
    }
    if (drag.kind === 'motionPathEdit' && drag.points.length > 1) {
      dispatch({ type: 'UPDATE_MOTION_PATH', layerId: drag.layerId, shapeId: drag.shapeId, points: drag.points, times: drag.times })
    }
    if (drag.kind === 'motionPathDraw' || drag.kind === 'motionPathEdit') setMotionPathDraft(null)
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
    if (drag.kind === 'point' || drag.kind === 'boneRotate' || drag.kind === 'boneTranslate' || drag.kind === 'rigTranslate') dispatch({ type: 'END_TRANSFORM' })
    if (drag.kind === 'move' || drag.kind === 'resize') dispatch({ type: 'END_TRANSFORM' })
    clearLiveStroke()
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
      if (e.key === 'Escape') { setPenPoints([]); setLassoPoints([]); setMotionPathDraft(null) }
    }
    window.addEventListener('keydown', clear)
    return () => window.removeEventListener('keydown', clear)
  }, [])

  return (
    <div className="stage-area">
      {!compact && state.showToolOptions && <ToolOptions />}

      <div className="stage-viewport" ref={containerRef}>
        <div
          className="stage-wrap"
          style={{
            transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px))`,
            left: '50%',
            top: '50%',
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
          <canvas ref={overlayRef} className="stroke-overlay" aria-hidden="true" />
          <div className="stage-shadow" />
        </div>
      </div>
    </div>
  )
}
