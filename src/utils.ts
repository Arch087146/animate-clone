import type { Bone, Keyframe, Layer, Point, Project, Shape } from './types'

export function getActiveKeyframe(layer: Layer, frame: number): Keyframe | null {
  for (let i = frame; i >= 0; i--) {
    const kf = layer.frames[i]
    if (kf && kf.start + kf.duration > frame) return kf
  }
  return null
}

export function findKeyframeIndex(layer: Layer, frame: number): number {
  for (let i = frame; i >= 0; i--) {
    const kf = layer.frames[i]
    if (kf && kf.start + kf.duration > frame) return i
  }
  return -1
}

export function getNextKeyframe(layer: Layer, index: number): Keyframe | null {
  for (let i = index + 1; i < layer.frames.length; i++) {
    if (layer.frames[i]) return layer.frames[i]
  }
  return null
}

function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  const n = parseInt(h || '000000', 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`
}

export function lerpColor(a: string, b: string, t: number): string {
  if (!a?.startsWith('#') || !b?.startsWith('#')) return t < 0.5 ? a : b
  const [r1, g1, b1] = hexToRgb(a)
  const [r2, g2, b2] = hexToRgb(b)
  return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t)
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

function easeValue(t: number, ease: number): number {
  if (!ease) return t
  if (ease > 0) return Math.pow(t, 1 + ease * 2)
  return 1 - Math.pow(1 - t, 1 - ease * 2)
}

function interpolateShape(a: Shape, b: Shape | undefined, t: number, shapeTween: boolean): Shape {
  if (!b) return a
  const base: Shape = { ...a }
  base.x = lerp(a.x, b.x, t)
  base.y = lerp(a.y, b.y, t)
  base.rotation = lerp(a.rotation, b.rotation, t)
  base.opacity = lerp(a.opacity, b.opacity, t)
  if (shapeTween) {
    base.width = lerp(a.width, b.width, t)
    base.height = lerp(a.height, b.height, t)
    base.fill = lerpColor(a.fill, b.fill, t)
    base.stroke = lerpColor(a.stroke, b.stroke, t)
    base.strokeWidth = lerp(a.strokeWidth, b.strokeWidth, t)
    if (a.points && b.points && a.points.length === b.points.length) {
      base.points = a.points.map((p, i) => ({ x: lerp(p.x, b.points![i].x, t), y: lerp(p.y, b.points![i].y, t) }))
    }
  }
  return base
}

export interface RenderShape {
  shape: Shape
  layer: Layer
  keyframe: Keyframe | null
  interpolated: boolean
}

export function getRenderShapes(project: Project, frame: number): RenderShape[] {
  const result: RenderShape[] = []
  for (const layer of project.layers) {
    if (!layer.visible) continue
    const idx = findKeyframeIndex(layer, frame)
    if (idx < 0) continue
    const kf = layer.frames[idx]!
    const next = getNextKeyframe(layer, idx)
    let shapes = kf.shapes
    let interpolated = false
    if (next && kf.tween !== 'none' && next.start > kf.start) {
      const raw = (frame - kf.start) / (next.start - kf.start)
      const t = easeValue(Math.max(0, Math.min(1, raw)), kf.ease)
      const nextById = new Map(next.shapes.map((s) => [s.id, s]))
      shapes = kf.shapes.map((s) => interpolateShape(s, nextById.get(s.id), t, kf.tween === 'shape'))
      interpolated = true
    }
    for (const shape of shapes) {
      if (shape.visible) result.push({ shape, layer, keyframe: kf, interpolated })
    }
  }
  return result
}

export function getRenderBones(project: Project, frame: number): Bone[] {
  const result: Bone[] = []
  for (const layer of project.layers) {
    if (!layer.visible) continue
    const idx = findKeyframeIndex(layer, frame)
    if (idx < 0) continue
    const kf = layer.frames[idx]!
    const bones = kf.bones ?? []
    const next = getNextKeyframe(layer, idx)
    if (next && kf.tween !== 'none' && next.start > kf.start && bones.length) {
      const raw = Math.max(0, Math.min(1, (frame - kf.start) / (next.start - kf.start)))
      const nextById = new Map((next.bones ?? []).map((b) => [b.id, b]))
      result.push(...bones.map((b) => {
        const n = nextById.get(b.id)
        if (!n) return b
        // A bone's own ease overrides the keyframe ease so each joint of a
        // rig can have its own timing, just like Animate's bone properties.
        const t = easeValue(raw, b.ease ?? kf.ease)
        return {
          ...b,
          x1: lerp(b.x1, n.x1, t), y1: lerp(b.y1, n.y1, t),
          x2: lerp(b.x2, n.x2, t), y2: lerp(b.y2, n.y2, t),
        }
      }))
    } else {
      result.push(...bones)
    }
  }
  return result
}

export function pointInShape(shape: Shape, p: Point): boolean {
  const cx = shape.x + shape.width / 2
  const cy = shape.y + shape.height / 2
  let { x, y } = p
  if (shape.rotation) {
    const rad = (-shape.rotation * Math.PI) / 180
    const dx = x - cx
    const dy = y - cy
    x = cx + dx * Math.cos(rad) - dy * Math.sin(rad)
    y = cy + dx * Math.sin(rad) + dy * Math.cos(rad)
  }
  if (shape.type === 'oval' || shape.type === 'ovalPrimitive') {
    const rx = Math.max(1, shape.width / 2)
    const ry = Math.max(1, shape.height / 2)
    return ((x - cx) ** 2) / (rx ** 2) + ((y - cy) ** 2) / (ry ** 2) <= 1
  }
  if (shape.type === 'line' && shape.points?.length === 2) {
    const [a, b] = shape.points
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len2 = dx * dx + dy * dy || 1
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / len2))
    const px = a.x + t * dx
    const py = a.y + t * dy
    return Math.hypot(x - px, y - py) <= Math.max(5, shape.strokeWidth + 3)
  }
  if (shape.type === 'path' && shape.points && shape.points.length > 1) {
    return shape.points.some((pt) => Math.hypot(x - pt.x, y - pt.y) < 7)
  }
  const pad = 2
  return x >= shape.x - pad && x <= shape.x + shape.width + pad && y >= shape.y - pad && y <= shape.y + shape.height + pad
}

export function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy || 1
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

export function shapeBounds(shape: Shape) {
  if (shape.type === 'line' && shape.points?.length === 2) {
    const [a, b] = shape.points
    return {
      x: Math.min(a.x, b.x),
      y: Math.min(a.y, b.y),
      width: Math.abs(b.x - a.x),
      height: Math.abs(b.y - a.y),
    }
  }
  return { x: shape.x, y: shape.y, width: shape.width, height: shape.height }
}
