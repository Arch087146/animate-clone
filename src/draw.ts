import { getBrush, renderBrushStroke } from './brushes'
import type { Bone, Point, Shape } from './types'

const imageCache = new Map<string, HTMLImageElement>()
const pendingImages = new Set<string>()

/** Preload an image so imported artwork paints on the very first frame. */
export function preloadImage(src: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(src)
  if (cached?.complete) return Promise.resolve(cached)
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => { imageCache.set(src, img); pendingImages.delete(src); resolve(img) }
    img.onerror = () => { pendingImages.delete(src); reject(new Error('Could not load image')) }
    img.src = src
    if (!pendingImages.has(src)) pendingImages.add(src)
  })
}

export function drawShape(ctx: CanvasRenderingContext2D, shape: Shape) {
  ctx.save()
  ctx.globalAlpha = shape.opacity
  const cx = shape.x + shape.width / 2
  const cy = shape.y + shape.height / 2
  const fx = shape.flipX ? -1 : 1
  const fy = shape.flipY ? -1 : 1
  if (shape.rotation || fx < 0 || fy < 0) {
    ctx.translate(cx, cy)
    if (shape.rotation) ctx.rotate((shape.rotation * Math.PI) / 180)
    if (fx < 0 || fy < 0) ctx.scale(fx, fy)
    ctx.translate(-cx, -cy)
  }
  ctx.fillStyle = shape.fill === 'none' ? 'rgba(0,0,0,0)' : shape.fill
  ctx.strokeStyle = shape.stroke === 'none' ? 'rgba(0,0,0,0)' : shape.stroke
  ctx.lineWidth = shape.strokeWidth
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  switch (shape.type) {
    case 'image': {
      if (shape.imageSrc) {
        let img = imageCache.get(shape.imageSrc)
        if (!img) {
          img = new Image()
          img.onload = () => imageCache.set(shape.imageSrc!, img!)
          img.src = shape.imageSrc
        }
        if (img.complete && img.naturalWidth) {
          ctx.drawImage(img, shape.x, shape.y, shape.width, shape.height)
        } else {
          ctx.fillStyle = '#e6e6e6'
          ctx.fillRect(shape.x, shape.y, shape.width, shape.height)
        }
      }
      break
    }
    case 'rectangle':
    case 'rectPrimitive': {
      const r = shape.type === 'rectPrimitive' ? shape.cornerRadius ?? 0 : 0
      ctx.beginPath()
      ctx.roundRect(shape.x, shape.y, shape.width, shape.height, Math.max(0, Math.min(r, shape.width / 2, shape.height / 2)))
      ctx.fill()
      if (shape.strokeWidth > 0) ctx.stroke()
      break
    }
    case 'oval':
    case 'ovalPrimitive': {
      ctx.beginPath()
      ctx.ellipse(cx, cy, Math.max(0.1, shape.width / 2), Math.max(0.1, shape.height / 2), 0, 0, Math.PI * 2)
      ctx.fill()
      if (shape.strokeWidth > 0) ctx.stroke()
      break
    }
    case 'line': {
      const pts = shape.points?.length === 2 ? shape.points : [
        { x: shape.x, y: shape.y },
        { x: shape.x + shape.width, y: shape.y + shape.height },
      ]
      ctx.beginPath()
      ctx.moveTo(pts[0].x, pts[0].y)
      ctx.lineTo(pts[1].x, pts[1].y)
      ctx.stroke()
      break
    }
    case 'path': {
      if (!shape.points?.length) break
      if (shape.brush) {
        const brush = getBrush(shape.brush.id)
        ctx.globalAlpha = 1
        renderBrushStroke(ctx, shape.points, brush, shape.stroke === 'none' ? shape.fill : shape.stroke, {
          seed: shape.id,
          sizeScale: shape.brush.size / brush.params.size,
          opacityScale: shape.opacity * shape.brush.opacity,
          flowScale: shape.brush.flowScale,
          spacingScale: shape.brush.spacingScale,
          scatterScale: shape.brush.scatterScale,
        })
        break
      }
      ctx.beginPath()
      ctx.moveTo(shape.points[0].x, shape.points[0].y)
      for (let i = 1; i < shape.points.length; i++) ctx.lineTo(shape.points[i].x, shape.points[i].y)
      if (shape.closed) ctx.closePath()
      if (shape.fill !== 'none' && shape.closed) ctx.fill()
      if (shape.strokeWidth > 0) ctx.stroke()
      break
    }
    case 'polyStar': {
      const sides = Math.max(3, shape.sides ?? 5)
      const inner = shape.innerRadius ?? 0.45
      const rx = shape.width / 2
      const ry = shape.height / 2
      ctx.beginPath()
      for (let i = 0; i < sides * 2; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / sides
        const k = i % 2 === 0 ? 1 : inner
        const px = cx + Math.cos(a) * rx * k
        const py = cy + Math.sin(a) * ry * k
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.closePath()
      ctx.fill()
      if (shape.strokeWidth > 0) ctx.stroke()
      break
    }
    case 'text': {
      const size = shape.fontSize ?? 28
      ctx.font = `${shape.fontItalic ? 'italic ' : ''}${shape.fontBold === false ? 400 : 600} ${size}px ${shape.fontFamily ?? 'Arial'}, sans-serif`
      ctx.textBaseline = 'top'
      ctx.fillStyle = shape.fill
      ctx.fillText(shape.text ?? 'Text', shape.x, shape.y)
      if (shape.strokeWidth > 0) {
        ctx.strokeStyle = shape.stroke
        ctx.strokeText(shape.text ?? 'Text', shape.x, shape.y)
      }
      break
    }
  }
  ctx.restore()
}

/** Authoring-only layer outline rendering, matching Animate's outline swatches. */
export function drawShapeOutline(ctx: CanvasRenderingContext2D, shape: Shape, color: string, scale: number) {
  ctx.save()
  ctx.globalAlpha = shape.opacity
  const cx = shape.x + shape.width / 2
  const cy = shape.y + shape.height / 2
  const fx = shape.flipX ? -1 : 1
  const fy = shape.flipY ? -1 : 1
  if (shape.rotation || fx < 0 || fy < 0) {
    ctx.translate(cx, cy)
    if (shape.rotation) ctx.rotate((shape.rotation * Math.PI) / 180)
    if (fx < 0 || fy < 0) ctx.scale(fx, fy)
    ctx.translate(-cx, -cy)
  }
  ctx.strokeStyle = color
  ctx.lineWidth = Math.max(0.75, 1 / Math.max(0.1, scale))
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  switch (shape.type) {
    case 'image':
      ctx.strokeRect(shape.x, shape.y, shape.width, shape.height)
      break
    case 'rectangle':
    case 'rectPrimitive': {
      const r = shape.type === 'rectPrimitive' ? shape.cornerRadius ?? 0 : 0
      ctx.beginPath()
      ctx.roundRect(shape.x, shape.y, shape.width, shape.height, Math.max(0, Math.min(r, shape.width / 2, shape.height / 2)))
      ctx.stroke()
      break
    }
    case 'oval':
    case 'ovalPrimitive':
      ctx.beginPath()
      ctx.ellipse(cx, cy, Math.max(0.1, shape.width / 2), Math.max(0.1, shape.height / 2), 0, 0, Math.PI * 2)
      ctx.stroke()
      break
    case 'line': {
      const pts = shape.points?.length === 2 ? shape.points : [
        { x: shape.x, y: shape.y },
        { x: shape.x + shape.width, y: shape.y + shape.height },
      ]
      ctx.beginPath()
      ctx.moveTo(pts[0].x, pts[0].y)
      ctx.lineTo(pts[1].x, pts[1].y)
      ctx.stroke()
      break
    }
    case 'path': {
      if (!shape.points?.length) break
      ctx.beginPath()
      ctx.moveTo(shape.points[0].x, shape.points[0].y)
      for (let i = 1; i < shape.points.length; i++) ctx.lineTo(shape.points[i].x, shape.points[i].y)
      if (shape.closed) ctx.closePath()
      ctx.stroke()
      break
    }
    case 'polyStar': {
      const sides = Math.max(3, shape.sides ?? 5)
      const inner = shape.innerRadius ?? 0.45
      const rx = shape.width / 2
      const ry = shape.height / 2
      ctx.beginPath()
      for (let i = 0; i < sides * 2; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / sides
        const k = i % 2 === 0 ? 1 : inner
        const px = cx + Math.cos(a) * rx * k
        const py = cy + Math.sin(a) * ry * k
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.closePath()
      ctx.stroke()
      break
    }
    case 'text': {
      const size = shape.fontSize ?? 28
      ctx.font = `${shape.fontItalic ? 'italic ' : ''}${shape.fontBold === false ? 400 : 600} ${size}px ${shape.fontFamily ?? 'Arial'}, sans-serif`
      ctx.textBaseline = 'top'
      ctx.strokeText(shape.text ?? 'Text', shape.x, shape.y)
      break
    }
  }
  ctx.restore()
}

export interface BoneOverlayOptions {
  /** Point the Bone tool would snap to when starting a new bone. */
  snapPoint?: { x: number; y: number } | null
  /** Bone being dragged out from a joint. */
  draftParent?: Bone | null
}

/**
 * Draws the armature overlay in the same visual language as Animate's Bone
 * tool: tapered bones, white joint handles, orange for the active bone, and a
 * dashed target circle when a joint is available for chaining.
 */
export function drawBones(
  ctx: CanvasRenderingContext2D,
  bones: Bone[],
  selectedId: string | null,
  scale: number,
  options: BoneOverlayOptions = {},
) {
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  for (const bone of bones) {
    const selected = bone.id === selectedId
    const locked = !!bone.locked
    const color = selected ? '#ff8a00' : locked ? '#9aa0a6' : '#7c4dff'
    const angle = Math.atan2(bone.y2 - bone.y1, bone.x2 - bone.x1)
    const nx = -Math.sin(angle)
    const ny = Math.cos(angle)
    const headW = (selected ? 3.2 : 2.4) / scale
    const tailW = (selected ? 1.8 : 1.2) / scale

    ctx.beginPath()
    ctx.moveTo(bone.x1 + nx * headW, bone.y1 + ny * headW)
    ctx.lineTo(bone.x2 + nx * tailW, bone.y2 + ny * tailW)
    ctx.lineTo(bone.x2 - nx * tailW, bone.y2 - ny * tailW)
    ctx.lineTo(bone.x1 - nx * headW, bone.y1 - ny * headW)
    ctx.closePath()
    ctx.fillStyle = color
    ctx.fill()

    // Head joint — square when the bone is not connected to a parent.
    const headR = (selected ? 6 : 5) / scale
    ctx.lineWidth = 2 / scale
    ctx.strokeStyle = color
    ctx.fillStyle = '#fff'
    if (bone.connected === false) {
      ctx.fillRect(bone.x1 - headR, bone.y1 - headR, headR * 2, headR * 2)
      ctx.strokeRect(bone.x1 - headR, bone.y1 - headR, headR * 2, headR * 2)
    } else {
      ctx.beginPath()
      ctx.arc(bone.x1, bone.y1, headR, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    }

    // Tail joint is where a child can be chained.
    ctx.beginPath()
    ctx.arc(bone.x2, bone.y2, (selected ? 4.2 : 3.4) / scale, 0, Math.PI * 2)
    ctx.fillStyle = selected ? '#fff' : color
    ctx.fill()
    ctx.strokeStyle = selected ? '#ff8a00' : '#fff'
    ctx.lineWidth = 1.4 / scale
    ctx.stroke()

    if (locked) {
      ctx.fillStyle = locked ? '#fff' : color
      ctx.beginPath()
      ctx.arc(bone.x1, bone.y1, 1.5 / scale, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  if (options.draftParent) {
    const parent = options.draftParent
    ctx.setLineDash([4 / scale, 3 / scale])
    ctx.strokeStyle = '#00bcd4'
    ctx.lineWidth = 1.5 / scale
    ctx.beginPath()
    ctx.arc(parent.x2, parent.y2, 10 / scale, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])
  }

  if (options.snapPoint) {
    ctx.strokeStyle = '#00e5ff'
    ctx.lineWidth = 1.6 / scale
    ctx.setLineDash([3 / scale, 3 / scale])
    ctx.beginPath()
    ctx.arc(options.snapPoint.x, options.snapPoint.y, 10 / scale, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.beginPath()
    ctx.moveTo(options.snapPoint.x - 4 / scale, options.snapPoint.y)
    ctx.lineTo(options.snapPoint.x + 4 / scale, options.snapPoint.y)
    ctx.moveTo(options.snapPoint.x, options.snapPoint.y - 4 / scale)
    ctx.lineTo(options.snapPoint.x, options.snapPoint.y + 4 / scale)
    ctx.stroke()
  }
  ctx.restore()
}

export function drawSelection(ctx: CanvasRenderingContext2D, shape: Shape, scale: number) {
  ctx.save()
  ctx.lineJoin = 'round'
  ctx.setLineDash([])
  const pad = 6 / scale
  const x = shape.x - pad
  const y = shape.y - pad
  const w = shape.width + pad * 2
  const h = shape.height + pad * 2
  const radius = Math.min(2.5 / scale, w / 2, h / 2)

  // A light halo keeps the box readable on both dark artwork and white stages.
  ctx.strokeStyle = 'rgba(255,255,255,0.95)'
  ctx.lineWidth = 3.5 / scale
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, radius)
  ctx.stroke()
  ctx.strokeStyle = '#0b6efd'
  ctx.lineWidth = 1.25 / scale
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, radius)
  ctx.stroke()

  const s = 8 / scale
  const handles = [
    [x, y], [x + w / 2, y], [x + w, y],
    [x, y + h / 2], [x + w, y + h / 2],
    [x, y + h], [x + w / 2, y + h], [x + w, y + h],
  ]
  for (const [hx, hy] of handles) {
    const hx0 = hx - s / 2
    const hy0 = hy - s / 2
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.28)'
    ctx.shadowBlur = 2
    ctx.shadowOffsetY = 1
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.roundRect(hx0, hy0, s, s, 1.5 / scale)
    ctx.fill()
    ctx.restore()
    ctx.strokeStyle = '#0b6efd'
    ctx.lineWidth = 1.25 / scale
    ctx.beginPath()
    ctx.roundRect(hx0, hy0, s, s, 1.5 / scale)
    ctx.stroke()
  }
  ctx.restore()
}

/** Subselection anchors: same clean overlay language, but for vector points. */
export function drawPointSelection(ctx: CanvasRenderingContext2D, points: Point[], scale: number, closed = false) {
  if (!points.length) return
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  const trace = () => {
    ctx.beginPath()
    ctx.moveTo(points[0].x, points[0].y)
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y)
    if (closed) ctx.closePath()
  }
  ctx.setLineDash([])
  ctx.strokeStyle = 'rgba(255,255,255,0.95)'
  ctx.lineWidth = 3.5 / scale
  trace()
  ctx.stroke()
  ctx.strokeStyle = '#0b6efd'
  ctx.lineWidth = 1.25 / scale
  ctx.setLineDash([5 / scale, 4 / scale])
  trace()
  ctx.stroke()
  ctx.setLineDash([])

  const r = 4.5 / scale
  for (const point of points) {
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.25)'
    ctx.shadowBlur = 2
    ctx.shadowOffsetY = 1
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(point.x, point.y, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
    ctx.strokeStyle = '#0b6efd'
    ctx.lineWidth = 1.25 / scale
    ctx.beginPath()
    ctx.arc(point.x, point.y, r, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.restore()
}
