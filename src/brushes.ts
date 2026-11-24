import type { Point } from './types'
import { CC0_BRUSHES } from './cc0Brushes.generated'
import { KRITA_BRUSHES } from './kritaBrushes.generated'

export type BrushFamily =
  | 'Basic' | 'Pencil' | 'Charcoal' | 'Ink' | 'Watercolor' | 'Oil' | 'Chalk' | 'Marker' | 'Airbrush'
  | 'Crayon' | 'Calligraphy' | 'Spray' | 'Neon' | 'Texture' | 'Eraser' | 'Acrylic' | 'Gouache'
  | 'Pastel' | 'Fan' | 'Dry Brush' | 'Splatter' | 'Smudge' | 'Sumi' | 'Technical' | 'Fiber'
  | 'Gel' | 'Knife' | 'Sponge' | 'Stencil' | 'Bamboo' | 'Metallic' | 'Cloud' | 'Fur' | 'CC0' | 'Krita CC0'

export type DabTexture = 'smooth' | 'paper' | 'canvas' | 'grit' | 'rough' | 'fibrous' | 'crackle'
export type DabStamp = 'none' | 'dot' | 'square' | 'leaf' | 'grass' | 'star' | 'brick' | 'splat' | 'cloud' | 'ring' | 'scale' | 'scribble'
export type CleanStroke =
  | 'round' | 'fine' | 'ballpoint' | 'gel' | 'ink' | 'brush'
  | 'felt' | 'marker' | 'highlighter' | 'technical' | 'sign'
  | 'calligraphy' | 'journal' | 'sketch' | 'whiteboard' | 'storyboard'
  | 'taper'

export interface BrushParams {
  /** Base dab diameter in stage pixels. */
  size: number
  /** 0 = very soft edges, 1 = razor sharp. */
  hardness: number
  /** Alpha of each dab before flow is applied. */
  opacity: number
  /** Distance between dabs as a fraction of size. */
  spacing: number
  /** Random positional offset as a fraction of size. */
  scatter: number
  /** Fixed rotation of each dab in degrees. */
  rotation: number
  /** Number of bristles / sub-dabs per stamp. */
  bristles: number
  /** Alpha multiplier for each dab. */
  flow: number
  /** Amount of speckled grain, 0..1. */
  grain: number
  /** How strongly stroke ends taper, 0..1. */
  taper: number
  /** Radial-gradient softness, 0 = hard fill, 1 = full gradient. */
  softness: number
  /** Elongation of each dab (1 = round, 0.25 = narrow calligraphy nib). */
  aspect: number
  /** Canvas shadow blur for glow brushes. */
  glow: number
  /** 0..1 — faster strokes make thinner marks (velocity dynamics). */
  velocitySize?: number
  /** 0..1 — faster strokes deposit less paint. */
  velocityOpacity?: number
  /** 0..1 — wet-paint bleed and edge darkening. */
  wetness?: number
  /** Irregular, noisy dab edge — the basis of realistic dry media. */
  irregularity?: number
  /** Draw bristles as tapered streaks instead of blobs. */
  streak?: number
  /** 0..1 — align bristles to the stroke direction. */
  directionality?: number
  /** Noise texture punched through the finished stroke. */
  texture?: DabTexture
  /** Stamp a shape instead of (or on top of) an elliptical dab. */
  stamp?: DabStamp
  /** Alternate between two hues for multicolour / dual-tip brushes. */
  multicolor?: boolean
  /** Bundled CC0 brush tip image used as a stamp (public-domain GIMP tips). */
  stampImage?: string
  /** Render as a clean vector pen stroke instead of textured dabs. */
  cleanStroke?: CleanStroke
}

export interface BrushPreset {
  id: string
  name: string
  family: BrushFamily
  description: string
  params: BrushParams
}

export interface BrushRenderOptions {
  /** Stable seed so a stroke looks identical on every render. */
  seed?: string | number
  /** Multiplies the preset's base size. */
  sizeScale?: number
  /** Multiplies the alpha of every dab. */
  opacityScale?: number
  /** User multipliers from the tool options bar. */
  flowScale?: number
  spacingScale?: number
  scatterScale?: number
}

/* ------------------------------------------------------------------ *
 * Deterministic pseudo-random + noise helpers                         *
 * ------------------------------------------------------------------ */

function hashSeed(value: string | number): number {
  const text = String(value)
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function noise1(x: number, seed: number): number {
  const i = Math.floor(x)
  const f = x - i
  const u = f * f * (3 - 2 * f)
  const a = ((Math.imul(i ^ seed, 0x45d9f3b) >>> 0) % 1000) / 1000
  const b = ((Math.imul((i + 1) ^ seed, 0x45d9f3b) >>> 0) % 1000) / 1000
  return a + (b - a) * u
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

function darken(hex: string, amount: number): string {
  if (!hex.startsWith('#') || amount <= 0) return hex
  let h = hex.slice(1)
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  const num = parseInt(h, 16)
  if (Number.isNaN(num)) return hex
  const r = Math.round(((num >> 16) & 255) * (1 - amount))
  const g = Math.round(((num >> 8) & 255) * (1 - amount))
  const b = Math.round((num & 255) * (1 - amount))
  return `rgb(${r},${g},${b})`
}

function shiftHue(hex: string, degrees: number): string {
  if (!hex.startsWith('#') || degrees === 0) return hex
  let h = hex.slice(1)
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  const num = parseInt(h, 16)
  if (Number.isNaN(num)) return hex
  const r = ((num >> 16) & 255) / 255
  const g = ((num >> 8) & 255) / 255
  const b = (num & 255) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let hue = 0
  const d = max - min
  if (d !== 0) {
    if (max === r) hue = ((g - b) / d) % 6
    else if (max === g) hue = (b - r) / d + 2
    else hue = (r - g) / d + 4
  }
  hue = (hue * 60 + degrees + 360) % 360
  const l = (max + min) / 2
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1))
  const m = l - c / 2
  let rr = 0, gg = 0, bb = 0
  if (hue < 60) [rr, gg, bb] = [c, x, 0]
  else if (hue < 120) [rr, gg, bb] = [x, c, 0]
  else if (hue < 180) [rr, gg, bb] = [0, c, x]
  else if (hue < 240) [rr, gg, bb] = [0, x, c]
  else if (hue < 300) [rr, gg, bb] = [x, 0, c]
  else [rr, gg, bb] = [c, 0, x]
  return `rgb(${Math.round((rr + m) * 255)},${Math.round((gg + m) * 255)},${Math.round((bb + m) * 255)})`
}

export const BRUSHES: BrushPreset[] = [
  ...KRITA_BRUSHES,
  ...CC0_BRUSHES,
]

export const BRUSH_FAMILIES: BrushFamily[] = Array.from(
  new Set(BRUSHES.map((brush) => brush.family)),
)

const BRUSH_MAP = new Map(BRUSHES.map((brush) => [brush.id, brush]))

export function getBrush(id: string): BrushPreset {
  return BRUSH_MAP.get(id) ?? BRUSHES[0]
}

export function getBrushesByFamily(family: BrushFamily): BrushPreset[] {
  return BRUSHES.filter((brush) => brush.family === family)
}

/* ------------------------------------------------------------------ *
 * Stroke rendering                                                    *
 * ------------------------------------------------------------------ */

function strokeLength(points: Point[]): number {
  let length = 0
  for (let i = 1; i < points.length; i++) length += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)
  return length
}

function pointAt(
  points: Point[],
  speeds: number[],
  maxSpeed: number,
  distance: number,
): { point: Point; angle: number; speed: number } {
  let remaining = distance
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]
    const b = points[i]
    const segment = Math.hypot(b.x - a.x, b.y - a.y)
    if (remaining <= segment || i === points.length - 1) {
      const t = segment === 0 ? 0 : Math.max(0, Math.min(1, remaining / segment))
      return {
        point: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t },
        angle: Math.atan2(b.y - a.y, b.x - a.x),
        speed: maxSpeed > 0 ? lerp(speeds[i - 1] ?? 0, speeds[i] ?? 0, t) / maxSpeed : 0,
      }
    }
    remaining -= segment
  }
  return { point: points[points.length - 1] ?? { x: 0, y: 0 }, angle: 0, speed: 0 }
}

function irregularPath(ctx: CanvasRenderingContext2D, rx: number, ry: number, amount: number, phase: number, rand: () => number) {
  const steps = 12
  for (let s = 0; s <= steps; s++) {
    const a = (s / steps) * Math.PI * 2
    const wobble =
      Math.sin(a * 3 + phase) * 0.4 +
      Math.sin(a * 5 - phase * 1.3) * 0.28 +
      (noise1(a * 2.5 + phase * 3, Math.floor(phase * 100)) - 0.5) * 0.5 +
      (rand() - 0.5) * 0.5
    const r = Math.max(0.15, 1 + amount * wobble)
    const x = Math.cos(a) * rx * r
    const y = Math.sin(a) * ry * r
    if (s === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
}

function dab(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  angle: number,
  color: string,
  alpha: number,
  softness: number,
  irregularity: number,
  phase: number,
  rand: () => number,
) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle + (rand() - 0.5) * 0.2)
  ctx.globalAlpha = clamp01(alpha)
  ctx.fillStyle = color
  ctx.beginPath()
  if (irregularity > 0.02) irregularPath(ctx, Math.max(0.15, rx), Math.max(0.15, ry), irregularity, phase, rand)
  else ctx.ellipse(0, 0, Math.max(0.15, rx), Math.max(0.15, ry), 0, 0, Math.PI * 2)
  if (softness > 0.02) {
    const gradient = ctx.createRadialGradient(0, 0, Math.max(0.1, rx * (1 - softness) * 0.6), 0, 0, Math.max(0.3, rx))
    gradient.addColorStop(0, color)
    gradient.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = gradient
  }
  ctx.fill()
  ctx.restore()
}

function drawStreak(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  length: number,
  width: number,
  angle: number,
  color: string,
  alpha: number,
  rand: () => number,
) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle + (rand() - 0.5) * 0.12)
  ctx.globalAlpha = clamp01(alpha)
  ctx.strokeStyle = color
  ctx.lineCap = 'round'
  ctx.lineWidth = Math.max(0.35, width)
  ctx.beginPath()
  const half = length / 2
  ctx.moveTo(-half, 0)
  ctx.quadraticCurveTo((rand() - 0.5) * width * 2, (rand() - 0.5) * width, half, 0)
  ctx.stroke()
  ctx.restore()
}

/* Cached decoded + colourised CC0 brush tips. The importer writes grayscale
 * PNGs where luminance is the tip's opacity; these helpers turn that into a
 * coloured stamp once per (image, colour) pair so strokes stay fast. */
const TIP_IMAGE_CACHE = new Map<string, HTMLImageElement>()
const TINTED_TIP_CACHE = new Map<string, HTMLCanvasElement>()

function loadTip(src: string): HTMLImageElement | null {
  if (typeof Image === 'undefined') return null
  let img = TIP_IMAGE_CACHE.get(src)
  if (!img) {
    img = new Image()
    img.src = src
    TIP_IMAGE_CACHE.set(src, img)
  }
  return img.complete && img.naturalWidth > 0 ? img : null
}

function colorToRGB(color: string): [number, number, number] {
  const c = document.createElement('canvas')
  c.width = c.height = 1
  const cx = c.getContext('2d')
  if (!cx) return [0, 0, 0]
  cx.fillStyle = color
  cx.fillRect(0, 0, 1, 1)
  const d = cx.getImageData(0, 0, 1, 1).data
  return [d[0], d[1], d[2]]
}

function tintedTip(src: string, color: string): HTMLCanvasElement | null {
  const key = `${src}|${color}`
  const cached = TINTED_TIP_CACHE.get(key)
  if (cached) return cached
  const img = loadTip(src)
  if (!img) return null
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const cx = canvas.getContext('2d')
  if (!cx) return null
  cx.drawImage(img, 0, 0)
  const image = cx.getImageData(0, 0, canvas.width, canvas.height)
  const [r, g, b] = colorToRGB(color)
  const px = image.data
  for (let i = 0; i < px.length; i += 4) {
    const lum = (px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114) / 255
    px[i] = r
    px[i + 1] = g
    px[i + 2] = b
    px[i + 3] = Math.round(px[i + 3] * lum)
  }
  cx.putImageData(image, 0, 0)
  TINTED_TIP_CACHE.set(key, canvas)
  return canvas
}

function drawTipStamp(
  ctx: CanvasRenderingContext2D,
  src: string,
  x: number,
  y: number,
  w: number,
  aspect: number,
  angle: number,
  color: string,
  alpha: number,
) {
  const tip = tintedTip(src, color)
  if (!tip) return false
  const h = Math.max(1, w * (tip.height / tip.width) * aspect)
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  ctx.globalAlpha = clamp01(alpha)
  ctx.drawImage(tip, -w / 2, -h / 2, w, h)
  ctx.restore()
  return true
}

// Warm the image cache so library previews and the first stroke are ready.
if (typeof Image !== 'undefined') {
  for (const brush of [...CC0_BRUSHES, ...KRITA_BRUSHES]) {
    if (brush.params.stampImage) loadTip(brush.params.stampImage)
  }
}

function drawStamp(
  ctx: CanvasRenderingContext2D,
  stamp: DabStamp | undefined,
  x: number,
  y: number,
  r: number,
  angle: number,
  color: string,
  alpha: number,
  rand: () => number,
) {
  if (!stamp || stamp === 'none') return false
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  ctx.globalAlpha = clamp01(alpha)
  ctx.fillStyle = color
  ctx.strokeStyle = color
  ctx.lineWidth = Math.max(0.5, r * 0.16)
  ctx.lineCap = 'round'
  ctx.beginPath()
  switch (stamp) {
    case 'dot':
      ctx.arc(0, 0, r, 0, Math.PI * 2)
      ctx.fill()
      break
    case 'square':
      ctx.rect(-r * 0.75, -r * 0.75, r * 1.5, r * 1.5)
      ctx.fill()
      break
    case 'leaf':
      ctx.moveTo(-r, 0)
      ctx.quadraticCurveTo(0, -r, r, 0)
      ctx.quadraticCurveTo(0, r, -r, 0)
      ctx.fill()
      ctx.beginPath()
      ctx.moveTo(-r * 0.8, 0)
      ctx.lineTo(r * 0.8, 0)
      ctx.stroke()
      break
    case 'grass':
      for (let k = -2; k <= 2; k++) {
        ctx.beginPath()
        ctx.moveTo(k * r * 0.35, 0)
        ctx.quadraticCurveTo(k * r * 0.5 + (rand() - 0.5) * r, -r * (0.7 + rand() * 0.6), k * r * 0.7 + (rand() - 0.5) * r, -r * (1 + rand() * 0.8))
        ctx.stroke()
      }
      break
    case 'star': {
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2 - Math.PI / 2
        const rr = k % 2 === 0 ? r : r * 0.42
        const px = Math.cos(a) * rr, py = Math.sin(a) * rr
        if (k === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.closePath()
      ctx.fill()
      break
    }
    case 'brick':
      ctx.rect(-r, -r * 0.45, r * 2, r * 0.9)
      ctx.fill()
      break
    case 'splat':
      ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2)
      ctx.fill()
      for (let k = 0; k < 5; k++) {
        const a = rand() * Math.PI * 2
        const d = r * (0.7 + rand() * 0.9)
        ctx.beginPath()
        ctx.arc(Math.cos(a) * d, Math.sin(a) * d, r * (0.08 + rand() * 0.22), 0, Math.PI * 2)
        ctx.fill()
      }
      break
    case 'cloud':
      ctx.arc(-r * 0.5, 0, r * 0.55, 0, Math.PI * 2)
      ctx.arc(r * 0.4, -r * 0.1, r * 0.6, 0, Math.PI * 2)
      ctx.arc(0, r * 0.35, r * 0.6, 0, Math.PI * 2)
      ctx.fill()
      break
    case 'ring':
      ctx.arc(0, 0, r * 0.75, 0, Math.PI * 2)
      ctx.stroke()
      break
    case 'scale':
      ctx.arc(-r * 0.2, -r * 0.2, r, Math.PI * 0.1, Math.PI * 0.9)
      ctx.stroke()
      break
    case 'scribble':
      for (let k = -1; k <= 1; k++) {
        ctx.beginPath()
        ctx.moveTo(-r, k * r * 0.45)
        ctx.lineTo(-r * 0.2, k * r * 0.45 - r * 0.3)
        ctx.lineTo(r * 0.3, k * r * 0.45 + r * 0.3)
        ctx.lineTo(r, k * r * 0.45)
        ctx.stroke()
      }
      break
  }
  ctx.restore()
  return true
}

function applyTexture(
  target: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  texture: DabTexture | undefined,
  grain: number,
  rand: () => number,
) {
  if (!texture || texture === 'smooth') return
  const density: Record<Exclude<DabTexture, 'smooth'>, number> = {
    paper: 150, canvas: 95, grit: 70, rough: 55, fibrous: 110, crackle: 130,
  }
  const total = Math.min(9000, Math.max(20, Math.floor((canvas.width * canvas.height) / density[texture])))
  target.save()
  target.globalCompositeOperation = 'destination-out'
  target.fillStyle = '#000'
  const strength = 0.12 + grain * 0.32
  for (let i = 0; i < total; i++) {
    target.globalAlpha = strength * (0.35 + rand() * 0.65)
    const x = rand() * canvas.width
    const y = rand() * canvas.height
    if (texture === 'canvas' || texture === 'fibrous') {
      const w = 1 + rand() * 3.5
      target.fillRect(x, y, w * (texture === 'fibrous' ? 3 : 2), Math.max(0.6, w * 0.35))
    } else if (texture === 'crackle') {
      target.beginPath()
      target.moveTo(x, y)
      target.lineTo(x + (rand() - 0.5) * 7, y + (rand() - 0.5) * 7)
      target.lineTo(x + (rand() - 0.5) * 12, y + (rand() - 0.5) * 12)
      target.lineWidth = 0.6 + rand()
      target.strokeStyle = '#000'
      target.stroke()
    } else {
      const r = (texture === 'grit' ? 0.6 : 0.4) + rand() * (texture === 'rough' ? 2.4 : 1.5)
      target.beginPath()
      target.arc(x, y, r, 0, Math.PI * 2)
      target.fill()
    }
  }
  target.restore()
}

/** Smooth centerline shared by the round pens. */
function traceSmoothStroke(ctx: CanvasRenderingContext2D, points: Point[]) {
  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)
  if (points.length === 2) {
    ctx.lineTo(points[1].x, points[1].y)
    return
  }
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    ctx.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2)
  }
  const last = points[points.length - 1]
  ctx.lineTo(last.x, last.y)
}

/** Fills a ribbon whose half-width can change along the stroke. */
function fillRibbon(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  halfWidthAt: (index: number, angle: number) => number,
) {
  const left: Point[] = []
  const right: Point[] = []
  for (let i = 0; i < points.length; i++) {
    const prev = points[Math.max(0, i - 1)]
    const next = points[Math.min(points.length - 1, i + 1)]
    const angle = points.length > 1 ? Math.atan2(next.y - prev.y, next.x - prev.x) : 0
    const half = Math.max(0.4, halfWidthAt(i, angle))
    const nx = -Math.sin(angle)
    const ny = Math.cos(angle)
    left.push({ x: points[i].x + nx * half, y: points[i].y + ny * half })
    right.push({ x: points[i].x - nx * half, y: points[i].y - ny * half })
  }
  ctx.beginPath()
  ctx.moveTo(left[0].x, left[0].y)
  for (let i = 1; i < left.length; i++) ctx.lineTo(left[i].x, left[i].y)
  for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i].x, right[i].y)
  ctx.closePath()
  ctx.fill()
}

/** Pressure-sensitive stroke used by ink, brush, sign, and sketch pens. */
function strokeTapered(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  size: number,
  taper: number,
  velocitySize: number,
) {
  let maxSpeed = 0.0001
  const speeds = points.slice(1).map((pt, i) => {
    const d = Math.hypot(pt.x - points[i].x, pt.y - points[i].y)
    maxSpeed = Math.max(maxSpeed, d)
    return d
  })
  for (let i = 1; i < points.length; i++) {
    const edge = (i / Math.max(1, points.length - 1)) * 2
    const edgeFade = Math.min(edge, 2 - edge)
    let pressure = 1 - taper * (1 - Math.pow(Math.max(0, edgeFade), 0.45))
    pressure *= 1 - velocitySize * (speeds[i - 1] / maxSpeed) * 0.82
    ctx.lineWidth = Math.max(0.6, size * Math.max(0.08, pressure))
    ctx.beginPath()
    ctx.moveTo(points[i - 1].x, points[i - 1].y)
    ctx.lineTo(points[i].x, points[i].y)
    ctx.stroke()
  }
}

/** Clean vector pens: each nib has its own geometry, width, and finish. */
function renderCleanStroke(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  brush: BrushPreset,
  color: string,
  options: BrushRenderOptions,
) {
  if (!points.length) return
  const p = brush.params
  const kind = p.cleanStroke ?? 'round'
  const sizeScale = options.sizeScale ?? 1
  const size = Math.max(0.5, p.size * sizeScale)
  const alpha = clamp01(p.opacity * p.flow * (options.flowScale ?? 1) * (options.opacityScale ?? 1))
  const seed = hashSeed(options.seed ?? brush.id)

  ctx.save()
  ctx.lineCap = kind === 'technical' ? 'butt' : 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.globalAlpha = alpha
  if (kind === 'highlighter') ctx.globalCompositeOperation = 'multiply'

  if (points.length === 1) {
    ctx.beginPath()
    ctx.arc(points[0].x, points[0].y, size / 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
    return
  }

  switch (kind) {
    case 'ballpoint': {
      ctx.globalAlpha = alpha * 0.38
      ctx.lineWidth = size * 1.35
      traceSmoothStroke(ctx, points)
      ctx.stroke()
      ctx.globalAlpha = alpha
      ctx.lineWidth = size * 0.48
      traceSmoothStroke(ctx, points)
      ctx.stroke()
      break
    }
    case 'gel': {
      ctx.shadowColor = color
      ctx.shadowBlur = Math.max(2, (p.glow ?? 3) * sizeScale)
      ctx.globalAlpha = alpha * 0.45
      ctx.lineWidth = size * 1.3
      traceSmoothStroke(ctx, points)
      ctx.stroke()
      ctx.shadowBlur = 0
      ctx.globalAlpha = alpha
      ctx.lineWidth = size * 0.72
      traceSmoothStroke(ctx, points)
      ctx.stroke()
      break
    }
    case 'ink':
    case 'brush':
    case 'sign':
    case 'sketch':
    case 'taper': {
      let path = points
      if (kind === 'sketch') {
        path = points.map((pt, i) => ({
          x: pt.x + (noise1(i * 0.73, seed) - 0.5) * size * 0.38,
          y: pt.y + (noise1(i * 0.61, seed ^ 0x5bf03635) - 0.5) * size * 0.38,
        }))
      }
      strokeTapered(ctx, path, size, p.taper, p.velocitySize ?? 0)
      break
    }
    case 'felt':
    case 'marker':
    case 'highlighter':
    case 'storyboard': {
      const half = size * (p.aspect ?? 0.7) / 2
      fillRibbon(ctx, points, () => half)
      break
    }
    case 'calligraphy': {
      const rotation = (p.rotation * Math.PI) / 180
      fillRibbon(ctx, points, (_i, angle) =>
        Math.max(size * 0.08, size * Math.abs(Math.sin(rotation - angle)) / 2))
      break
    }
    case 'journal': {
      ctx.globalAlpha = alpha * 0.9
      ctx.lineWidth = size
      traceSmoothStroke(ctx, points)
      ctx.stroke()
      ctx.globalAlpha = alpha * 0.35
      ctx.lineWidth = Math.max(1, size * 0.28)
      traceSmoothStroke(ctx, points.map((pt) => ({ x: pt.x + size * 0.12, y: pt.y - size * 0.12 })))
      ctx.stroke()
      ctx.globalAlpha = alpha
      for (const end of [points[0], points[points.length - 1]]) {
        ctx.beginPath()
        ctx.arc(end.x, end.y, size * 0.32, 0, Math.PI * 2)
        ctx.fill()
      }
      break
    }
    case 'whiteboard': {
      ctx.shadowColor = color
      ctx.shadowBlur = 0.8
      ctx.globalAlpha = alpha * 0.32
      ctx.lineWidth = size * 1.18
      traceSmoothStroke(ctx, points)
      ctx.stroke()
      ctx.shadowBlur = 0
      ctx.globalAlpha = alpha
      ctx.lineWidth = size * 0.86
      traceSmoothStroke(ctx, points)
      ctx.stroke()
      break
    }
    default: {
      ctx.lineWidth = size
      traceSmoothStroke(ctx, points)
      ctx.stroke()
    }
  }
  ctx.restore()
}

/**
 * Paints a stroke with many small overlapping dabs so brushes have real
 * texture instead of a flat canvas line. Rendering is deterministic for a
 * given seed, which keeps strokes stable across redraws and saves.
 */
export function renderBrushStroke(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  brush: BrushPreset,
  color: string,
  options: BrushRenderOptions = {},
) {
  if (points.length < 1) return
  if (brush.params.cleanStroke) return renderCleanStroke(ctx, points, brush, color, options)
  const p = brush.params
  const size = Math.max(0.5, p.size * (options.sizeScale ?? 1))
  const opacityScale = options.opacityScale ?? 1
  const flowScale = options.flowScale ?? 1
  const spacingScale = Math.max(0.2, options.spacingScale ?? 1)
  const scatterScale = options.scatterScale ?? 1
  const step = Math.max(0.7, size * p.spacing * spacingScale)
  const total = strokeLength(points)
  const dabCount = Math.min(1800, Math.max(1, Math.ceil(total / step) + 1))
  const rand = mulberry32(hashSeed(options.seed ?? 'stroke') ^ 0x9e3779b9)
  const texture = p.texture ?? 'smooth'
  const wetness = p.wetness ?? 0
  const useOffscreen = texture !== 'smooth' || wetness > 0

  // Local speed per point — pointer events are roughly uniform in time, so a
  // long segment means a fast gesture. This drives pressure-like dynamics.
  const speeds = new Array<number>(points.length).fill(0)
  let maxSpeed = 0.0001
  for (let i = 1; i < points.length; i++) {
    const d = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)
    speeds[i] = d
    if (d > maxSpeed) maxSpeed = d
  }

  let workCtx = ctx
  let minX = 0, minY = 0
  let workCanvas: HTMLCanvasElement | null = null
  if (useOffscreen && typeof document !== 'undefined') {
    minX = Infinity; minY = Infinity; let maxX = -Infinity; let maxY = -Infinity
    for (const pt of points) {
      minX = Math.min(minX, pt.x); minY = Math.min(minY, pt.y)
      maxX = Math.max(maxX, pt.x); maxY = Math.max(maxY, pt.y)
    }
    const pad = size * (1 + p.scatter * scatterScale * 2) + p.glow + 16
    minX -= pad; minY -= pad; maxX += pad; maxY += pad
    workCanvas = document.createElement('canvas')
    workCanvas.width = Math.max(1, Math.ceil(maxX - minX))
    workCanvas.height = Math.max(1, Math.ceil(maxY - minY))
    const wc = workCanvas.getContext('2d')
    if (wc) {
      workCtx = wc
      workCtx.translate(-minX, -minY)
    } else {
      workCanvas = null
    }
  }

  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  if (p.glow > 0 && !workCanvas) {
    ctx.shadowColor = color
    ctx.shadowBlur = p.glow
  }

  const edgeColor = darken(color, wetness * 0.28)
  const altColor = shiftHue(color, 42)

  for (let i = 0; i < dabCount; i++) {
    const t = dabCount === 1 ? 0 : i / (dabCount - 1)
    const { point, angle, speed } = pointAt(points, speeds, maxSpeed, Math.min(total, t * total))
    const edge = Math.min(t, 1 - t) * 2
    let pressure = 1 - p.taper * (1 - Math.pow(Math.max(0, edge), 0.45))
    pressure *= 1 - (p.velocitySize ?? 0) * speed * 0.82
    pressure = Math.max(0.08, pressure)
    const jitter = 1 + (rand() - 0.5) * 0.2
    const baseRx = (size / 2) * pressure * jitter
    const baseRy = Math.max(0.15, baseRx * p.aspect)
    const rotation = (p.rotation * Math.PI) / 180 + angle * ((p.directionality ?? 0.15) > 0.5 ? 1 : 0.15)
    const scatterX = (rand() - 0.5) * size * p.scatter * scatterScale * 2
    const scatterY = (rand() - 0.5) * size * p.scatter * scatterScale * 2
    const phase = rand() * Math.PI * 2
    const bristles = Math.max(1, Math.round(p.bristles * (0.6 + rand() * 0.8)))
    const dabAlphaBase = p.opacity * p.flow * flowScale * opacityScale * (1 - (p.velocityOpacity ?? 0) * speed * 0.75)

    for (let b = 0; b < bristles; b++) {
      const spread = bristles === 1 ? 0 : (b / (bristles - 1) - 0.5) * 2
      const offsetX = Math.cos(rotation + Math.PI / 2) * spread * baseRx * p.hardness
      const offsetY = Math.sin(rotation + Math.PI / 2) * spread * baseRx * p.hardness
      const along = (rand() - 0.5) * baseRx * 0.4
      const bristleScale = 0.5 + rand() * 0.7
      const alpha = dabAlphaBase * (0.55 + rand() * 0.45) * pressure
      const cx = point.x + scatterX + offsetX + Math.cos(rotation) * along
      const cy = point.y + scatterY + offsetY + Math.sin(rotation) * along
      const useAlt = p.multicolor && (i + b) % 7 === 0
      const dabColor = useAlt ? altColor : wetness > 0 && Math.abs(spread) > 0.55 ? edgeColor : color

      if (p.stampImage) {
        // Bundled CC0 brush tips define the actual mark shape. Until the image
        // decodes, fall back to a normal dab so the stroke is never empty.
        if (!drawTipStamp(workCtx, p.stampImage, cx, cy, baseRx * 2 * bristleScale, p.aspect, rotation, dabColor, alpha)) {
          dab(workCtx, cx, cy, baseRx * bristleScale, Math.max(0.15, baseRy * bristleScale), rotation, dabColor, alpha, p.softness, p.irregularity ?? 0, phase + b, rand)
        }
      } else if ((p.streak ?? 0) > 0.55 && bristles > 2) {
        const len = baseRx * (1.2 + rand() * 1.6) * (p.streak ?? 1)
        drawStreak(workCtx, cx, cy, len, Math.max(0.4, baseRx * 0.16 * bristleScale), rotation, dabColor, alpha, rand)
      } else {
        dab(workCtx, cx, cy, baseRx * bristleScale, Math.max(0.15, baseRy * bristleScale), rotation, dabColor, alpha, p.softness, p.irregularity ?? 0, phase + b, rand)
      }

      if (p.stamp && p.stamp !== 'none' && b === 0) {
        drawStamp(workCtx, p.stamp, cx, cy, Math.max(0.6, baseRx * 0.9), rotation, dabColor, alpha * 0.9, rand)
      }

      if (p.grain > 0.01 && rand() < p.grain) {
        const gx = point.x + scatterX + (rand() - 0.5) * size * 1.25
        const gy = point.y + scatterY + (rand() - 0.5) * size * 1.25
        workCtx.globalAlpha = clamp01(alpha * p.grain * (0.4 + rand() * 0.6))
        workCtx.fillStyle = rand() < 0.5 ? dabColor : '#000000'
        const gs = Math.max(0.25, size * 0.035 * (0.5 + rand()))
        workCtx.beginPath()
        workCtx.arc(gx, gy, gs, 0, Math.PI * 2)
        workCtx.fill()
      }
    }
  }

  if (workCanvas && workCtx !== ctx) {
    if (wetness > 0) {
      // Soft wet bleed — a faint offset copy of the mark.
      workCtx.save()
      workCtx.globalAlpha = 0.18 * wetness
      workCtx.drawImage(workCanvas, 1.5, 1.5)
      workCtx.restore()
    }
    applyTexture(workCtx, workCanvas, texture, p.grain, rand)
    workCtx.setTransform(1, 0, 0, 1, 0, 0)
    if (p.glow > 0) {
      ctx.shadowColor = color
      ctx.shadowBlur = p.glow
    }
    ctx.drawImage(workCanvas, minX, minY)
  }
  ctx.restore()
}

/** Small S-curve used in the brush library and tool options previews. */
export function renderBrushPreview(canvas: HTMLCanvasElement, brush: BrushPreset, color = '#1473e6') {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const width = canvas.width
  const height = canvas.height
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  const points: Point[] = []
  for (let i = 0; i <= 24; i++) {
    const t = i / 24
    points.push({ x: 5 + t * (width - 10), y: height / 2 + Math.sin(t * Math.PI * 1.6) * height * 0.22 })
  }
  renderBrushStroke(ctx, points, brush, color, { seed: `preview_${brush.id}`, sizeScale: Math.min(1.1, 22 / brush.params.size), opacityScale: 1 })
}

/** Smooths a freehand point series. 0 leaves the raw points untouched. */
export function smoothPoints(points: Point[], amount: number): Point[] {
  if (amount <= 0 || points.length < 3) return points
  const passes = Math.round(amount * 3)
  let result = points
  for (let pass = 0; pass < passes; pass++) {
    const next: Point[] = []
    for (let i = 0; i < result.length; i++) {
      if (i === 0 || i === result.length - 1) {
        next.push(result[i])
        continue
      }
      const a = result[i - 1]
      const b = result[i]
      const c = result[i + 1]
      const w = 0.25 + amount * 0.2
      next.push({ x: b.x * (1 - w) + (a.x + c.x) * w * 0.5, y: b.y * (1 - w) + (a.y + c.y) * w * 0.5 })
    }
    result = next
  }
  return result
}
