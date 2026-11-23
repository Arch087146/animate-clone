import type { Point } from './types'
import { CC0_BRUSHES } from './cc0Brushes.generated'

export type BrushFamily =
  | 'Pencil' | 'Charcoal' | 'Ink' | 'Watercolor' | 'Oil' | 'Chalk' | 'Marker' | 'Airbrush'
  | 'Crayon' | 'Calligraphy' | 'Spray' | 'Neon' | 'Texture' | 'Eraser' | 'Acrylic' | 'Gouache'
  | 'Pastel' | 'Fan' | 'Dry Brush' | 'Splatter' | 'Smudge' | 'Sumi' | 'Technical' | 'Fiber'
  | 'Gel' | 'Knife' | 'Sponge' | 'Stencil' | 'Bamboo' | 'Metallic' | 'Cloud' | 'Fur' | 'CC0'

export type DabTexture = 'smooth' | 'paper' | 'canvas' | 'grit' | 'rough' | 'fibrous' | 'crackle'
export type DabStamp = 'none' | 'dot' | 'square' | 'leaf' | 'grass' | 'star' | 'brick' | 'splat' | 'cloud' | 'ring' | 'scale' | 'scribble'

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

/* ------------------------------------------------------------------ *
 * Preset catalogue — 32 families × 20 variants = 640 brushes          *
 * ------------------------------------------------------------------ */

type NumericBrushParam =
  | 'size' | 'hardness' | 'opacity' | 'spacing' | 'scatter' | 'rotation' | 'bristles'
  | 'flow' | 'grain' | 'taper' | 'softness' | 'aspect' | 'glow' | 'velocitySize'
  | 'velocityOpacity' | 'wetness' | 'irregularity' | 'streak' | 'directionality'

type FamilySpec = {
  family: BrushFamily
  description: string
  names: string[]
  base: BrushParams
  ranges?: Partial<Record<NumericBrushParam, [number, number]>>
  vary?: (i: number, p: BrushParams, n: number) => BrushParams
}

const specs: FamilySpec[] = [
  {
    family: 'Pencil', description: 'Sharp, grainy drawing pencils from hard to soft.',
    names: 'HB,2H,4H,6H,2B,4B,6B,8B,Graphite,Sketch,Technical,Drafting,Fineline,Soft Core,Smudged,Blueprint,Carpentry,Tailor,Artist,Mechanical'.split(','),
    base: { size: 3, hardness: 0.92, opacity: 0.72, spacing: 0.18, scatter: 0.04, rotation: 0, bristles: 2, flow: 0.9, grain: 0.35, taper: 0.35, softness: 0.1, aspect: 1, glow: 0, irregularity: 0.12, texture: 'paper' },
    ranges: { size: [1.4, 7], hardness: [1, 0.6], opacity: [0.55, 0.92], grain: [0.2, 0.65], irregularity: [0.06, 0.3] },
    vary: (i, p) => ({ ...p, rotation: (i * 17) % 180 }),
  },
  {
    family: 'Charcoal', description: 'Dry, crumbly charcoal with heavy tooth and dust.',
    names: 'Vine,Willow,Compressed,Soft,Hard,Extra Dark,Smudge,Dusty,Rough,Fine Grain,Wood,Powder,Conté,Sepia,White,Snow,Walnut,Dove,Restoration,Vine Dark'.split(','),
    base: { size: 16, hardness: 0.35, opacity: 0.6, spacing: 0.11, scatter: 0.42, rotation: 0, bristles: 9, flow: 0.55, grain: 0.9, taper: 0.2, softness: 0.45, aspect: 1, glow: 0, irregularity: 0.55, texture: 'rough', velocityOpacity: 0.2 },
    ranges: { size: [8, 28], scatter: [0.25, 0.7], flow: [0.35, 0.8], irregularity: [0.4, 0.8], bristles: [5, 16] },
  },
  {
    family: 'Ink', description: 'Clean, opaque linework with smooth pressure taper.',
    names: 'Fine Liner,Tech Pen,Brush Pen,Gel Pen,Rollerball,Fountain,Nib,Calligraphy Ink,Sumi,India Ink,Gloss,Matte,White Ink,Blue Ink,Red Ink,Bold Marker,Drawing,Comics,Archival,Sepia Ink'.split(','),
    base: { size: 5, hardness: 1, opacity: 1, spacing: 0.09, scatter: 0, rotation: 0, bristles: 1, flow: 1, grain: 0, taper: 0.7, softness: 0, aspect: 1, glow: 0, velocitySize: 0.55, velocityOpacity: 0.15 },
    ranges: { size: [1.5, 17], taper: [0.4, 0.9], velocitySize: [0.3, 0.75] },
    vary: (i, p) => ({ ...p, bristles: i % 4 === 0 ? 2 : 1, rotation: i % 3 === 0 ? 30 : 0 }),
  },
  {
    family: 'Watercolor', description: 'Transparent washes that bloom and pool like real pigment.',
    names: 'Wash,Wet on Wet,Dry Brush,Granulating,Cobalt,Ochre,Rose,Indigo,Sienna,Umber,Viridian,Mauve,Lavender,Sepia Wash,Clear Wash,Periwinkle,Cerulean,Crimson,Sap Green,Payne Grey'.split(','),
    base: { size: 28, hardness: 0.08, opacity: 0.34, spacing: 0.06, scatter: 0.3, rotation: 0, bristles: 10, flow: 0.22, grain: 0.25, taper: 0.1, softness: 1, aspect: 1, glow: 0, wetness: 0.8, irregularity: 0.2, texture: 'paper' },
    ranges: { size: [14, 52], flow: [0.12, 0.44], scatter: [0.12, 0.5], wetness: [0.45, 1], bristles: [6, 18] },
  },
  {
    family: 'Oil', description: 'Thick, textured strokes with visible bristle streaks.',
    names: 'Flat,Filbert,Round,Bright,Fan,Stippling,Palette Knife,Impasto,Titanium,Crimson,Ultramarine,Sap Green,Burnt Sienna,Raw Umber,Ivory,Blending,Hog Bristle,Sable,Synthetic,Long Flat'.split(','),
    base: { size: 22, hardness: 0.7, opacity: 0.9, spacing: 0.13, scatter: 0.12, rotation: 0, bristles: 11, flow: 0.85, grain: 0.2, taper: 0.2, softness: 0.15, aspect: 0.8, glow: 0, streak: 0.85, directionality: 0.9, irregularity: 0.18, texture: 'canvas' },
    ranges: { size: [10, 40], streak: [0.5, 1], bristles: [6, 18], irregularity: [0.1, 0.3] },
    vary: (i, p) => ({ ...p, aspect: [1, 0.6, 1, 0.35, 0.25][i % 5], rotation: i % 2 ? -18 : 18 }),
  },
  {
    family: 'Chalk', description: 'Powdery chalk and pastel with broken, dusty edges.',
    names: 'White,Black,Red,Blue,Yellow,Green,Pastel Pink,Pastel Blue,Pastel Mint,Pastel Peach,Soft,Hard,Fine,Dusty,Board,Sidewalk,Chalkboard,Colored,Thick,Antique'.split(','),
    base: { size: 20, hardness: 0.4, opacity: 0.6, spacing: 0.1, scatter: 0.3, rotation: 0, bristles: 9, flow: 0.5, grain: 0.8, taper: 0.15, softness: 0.5, aspect: 1, glow: 0, irregularity: 0.7, texture: 'rough' },
    ranges: { size: [10, 34], grain: [0.45, 0.95], flow: [0.3, 0.85], irregularity: [0.5, 0.9] },
  },
  {
    family: 'Marker', description: 'Semi-transparent felt tips that darken where strokes overlap.',
    names: 'Fine,Medium,Broad,Chisel,Highlighter,Pastel,Neon Pink,Neon Yellow,Sky,Coral,Mint,Lilac,Black,Grey,Double End,Brush Tip,Alcohol,Water Based,Felt,Permanent'.split(','),
    base: { size: 12, hardness: 0.85, opacity: 0.45, spacing: 0.08, scatter: 0.02, rotation: 0, bristles: 3, flow: 0.45, grain: 0.05, taper: 0.25, softness: 0.15, aspect: 1, glow: 0 },
    ranges: { size: [3, 26], opacity: [0.25, 0.7], velocityOpacity: [0, 0.2] },
    vary: (i, p) => ({ ...p, aspect: i % 4 === 1 ? 0.45 : 1, rotation: i % 4 === 1 ? 45 : 0 }),
  },
  {
    family: 'Airbrush', description: 'Feathered spray with soft radial falloff.',
    names: 'Fine,Medium,Broad,Soft,Feather,Halo,Cloud,Mist,Vignette,Skin Tone,Shading,Highlight,Shadow,Gradient,Large Soft,Extra Wide,Spot,Fade,Air Gun,Precision'.split(','),
    base: { size: 36, hardness: 0, opacity: 0.22, spacing: 0.04, scatter: 0.18, rotation: 0, bristles: 5, flow: 0.16, grain: 0, taper: 0.1, softness: 1, aspect: 1, glow: 0 },
    ranges: { size: [14, 76], flow: [0.08, 0.32], bristles: [3, 9] },
  },
  {
    family: 'Crayon', description: 'Waxy, broken-colour strokes with paper texture.',
    names: 'Red,Orange,Yellow,Green,Blue,Purple,Brown,Black,White,Peach,Turquoise,Magenta,Lime,Navy,Grey,Multicolour,Wax,Oil Pastel,Children,Artist'.split(','),
    base: { size: 13, hardness: 0.65, opacity: 0.72, spacing: 0.1, scatter: 0.16, rotation: 0, bristles: 6, flow: 0.6, grain: 0.65, taper: 0.2, softness: 0.25, aspect: 1, glow: 0, irregularity: 0.4, texture: 'paper' },
    ranges: { size: [7, 24], grain: [0.35, 0.85], scatter: [0.08, 0.32], irregularity: [0.25, 0.6] },
    vary: (i, p) => ({ ...p, multicolor: i === 15 }),
  },
  {
    family: 'Calligraphy', description: 'Angled nib strokes with thick/thin pressure changes.',
    names: 'Fine Nib,Broad Nib,Italic,Copperplate,Blackletter,Roundhand,Brush Script,Chisel,Slanted,Wide Edge,Small Caps,Signature,Ornamental,Modern,Classic,Bold Script,Reed Pen,Steel Nib,Gothic,Rustic'.split(','),
    base: { size: 16, hardness: 0.95, opacity: 0.95, spacing: 0.06, scatter: 0, rotation: -35, bristles: 1, flow: 0.95, grain: 0.02, taper: 0.6, softness: 0.05, aspect: 0.28, glow: 0, velocitySize: 0.65 },
    ranges: { size: [8, 32], velocitySize: [0.4, 0.85], aspect: [0.18, 0.5] },
    vary: (i, p) => ({ ...p, rotation: -45 + (i % 4) * 6 }),
  },
  {
    family: 'Spray', description: 'Loose dots and speckles for texture and spray paint.',
    names: 'Fine,Medium,Coarse,Wide,Splatter,Speckle,Stipple,Dust,Sand,Glitter,Snow,Stars,Confetti,Dot Grid,Random,Paint Spray,Graffiti,Fine Mist,Heavy,Sparse'.split(','),
    base: { size: 26, hardness: 0.8, opacity: 0.6, spacing: 0.1, scatter: 1.1, rotation: 0, bristles: 18, flow: 0.35, grain: 0.2, taper: 0.05, softness: 0.2, aspect: 1, glow: 0, stamp: 'dot' },
    ranges: { size: [12, 58], bristles: [10, 26], scatter: [0.6, 1.9] },
    vary: (i, p) => ({ ...p, stamp: (['dot', 'dot', 'square', 'star'] as DabStamp[])[i % 4] }),
  },
  {
    family: 'Neon', description: 'Glowing strokes for signs, light, and electric effects.',
    names: 'Cyan,Magenta,Lime,Orange,Violet,White,Blue,Red,Yellow,Green,Pink,Ice,Fire,Laser,Soft Glow,Pulse,Electric,Aurora,Halo,Beam'.split(','),
    base: { size: 9, hardness: 0.6, opacity: 0.9, spacing: 0.09, scatter: 0.03, rotation: 0, bristles: 3, flow: 0.7, grain: 0, taper: 0.2, softness: 0.5, aspect: 1, glow: 12 },
    ranges: { size: [4, 22], glow: [5, 26], flow: [0.45, 0.95] },
  },
  {
    family: 'Texture', description: 'Specialty brushes with irregular, patterned marks.',
    names: 'Dry Wall,Concrete,Brick,Fabric,Wood Grain,Leaves,Grass,Clouds,Rocks,Bubbles,Cracks,Fingerprint,Sponge,Foam,Noise,Static,Cobblestone,Sand,Gravel,Moss'.split(','),
    base: { size: 30, hardness: 0.5, opacity: 0.55, spacing: 0.12, scatter: 0.55, rotation: 0, bristles: 12, flow: 0.4, grain: 0.9, taper: 0.1, softness: 0.45, aspect: 1, glow: 0, irregularity: 0.65, texture: 'grit', stamp: 'none' },
    ranges: { size: [14, 54], bristles: [7, 20], grain: [0.6, 1], irregularity: [0.45, 0.85] },
    vary: (i, p) => ({
      ...p,
      stamp: (['none', 'brick', 'leaf', 'grass', 'cloud', 'ring', 'scribble', 'splat'] as DabStamp[])[i % 8],
      rotation: (i * 23) % 180,
    }),
  },
  {
    family: 'Eraser', description: 'Soft and hard erasers for cleaning up strokes.',
    names: 'Soft Eraser,Hard Eraser,Fine Eraser,Wide Eraser,Block Eraser,Kneaded,Vinyl,Gum,Precision,Angle,Masking,Blending Stump,Tortillon,Sandpaper,Eraser Shield,Powder Eraser,Magic,Draft,Compact,Gel'.split(','),
    base: { size: 16, hardness: 0.6, opacity: 1, spacing: 0.1, scatter: 0, rotation: 0, bristles: 1, flow: 1, grain: 0, taper: 0, softness: 0.4, aspect: 1, glow: 0 },
    ranges: { size: [4, 46], hardness: [0.3, 1], softness: [0.15, 0.9] },
  },
  {
    family: 'Acrylic', description: 'Heavy-body acrylic with dense, opaque coverage.',
    names: 'Flat,Round,Filbert,Bright,Fan,Heavy Body,Soft Body,Dry,Wet,Impasto,Titanium,Crimson,Cobalt,Ochre,Sienna,Umber,Ivory,Vivid,Matte,Gloss'.split(','),
    base: { size: 20, hardness: 0.78, opacity: 0.95, spacing: 0.12, scatter: 0.1, rotation: 0, bristles: 10, flow: 0.9, grain: 0.18, taper: 0.15, softness: 0.18, aspect: 0.9, glow: 0, streak: 0.7, directionality: 0.8, irregularity: 0.15, texture: 'canvas' },
    ranges: { size: [8, 38], streak: [0.4, 0.95], bristles: [5, 16] },
    vary: (i, p) => ({ ...p, aspect: [1, 0.7, 1, 0.4, 0.3][i % 5] }),
  },
  {
    family: 'Gouache', description: 'Opaque watercolour with a soft, chalky finish.',
    names: 'Wash,Opaque,Dry,Wet,Blend,Chalky,Matte,Satin,Crimson,Ultramarine,Ochre,Viridian,Umber,Ivory,Sepia,Rose,Cobalt,Sap Green,Burnt Orange,Payne Grey'.split(','),
    base: { size: 22, hardness: 0.55, opacity: 0.82, spacing: 0.1, scatter: 0.16, rotation: 0, bristles: 9, flow: 0.7, grain: 0.35, taper: 0.18, softness: 0.35, aspect: 1, glow: 0, wetness: 0.35, irregularity: 0.3, texture: 'paper' },
    ranges: { size: [10, 40], opacity: [0.6, 0.95], wetness: [0.1, 0.6], irregularity: [0.2, 0.45] },
  },
  {
    family: 'Pastel', description: 'Soft and hard pastels with creamy, powdery layering.',
    names: 'Soft,Hard,Pencil,Charcoal Pastel,PanPastel,Dusty,Creamy,Powdery,Rose,Sky,Mint,Peach,Lavender,Ochre,Umber,Slate,Ivory,Crimson,Cobalt,Sage'.split(','),
    base: { size: 24, hardness: 0.35, opacity: 0.7, spacing: 0.08, scatter: 0.34, rotation: 0, bristles: 12, flow: 0.6, grain: 0.85, taper: 0.15, softness: 0.6, aspect: 1, glow: 0, irregularity: 0.6, texture: 'paper' },
    ranges: { size: [10, 44], flow: [0.35, 0.9], irregularity: [0.4, 0.8], softness: [0.4, 0.85] },
  },
  {
    family: 'Fan', description: 'Fan bristles for dry, dispersed, multi-strand marks.',
    names: 'Wide Fan,Narrow Fan,Dry Fan,Fan Blending,Fine Fan,Flat Fan,Bristle Fan,Soft Fan,Hog Fan,Sable Fan,Crimson Fan,Gold Fan,Dusty Fan,Cross Fan,Mini Fan,Jumbo Fan,Wide Soft,Dry Sweep,Grass Fan,Texture Fan'.split(','),
    base: { size: 26, hardness: 0.5, opacity: 0.62, spacing: 0.1, scatter: 0.22, rotation: 0, bristles: 16, flow: 0.55, grain: 0.4, taper: 0.12, softness: 0.35, aspect: 0.55, glow: 0, streak: 0.95, directionality: 1, irregularity: 0.3, texture: 'fibrous' },
    ranges: { size: [12, 48], bristles: [10, 24], streak: [0.7, 1], scatter: [0.1, 0.4] },
    vary: (i, p) => ({ ...p, rotation: -30 + (i % 5) * 15 }),
  },
  {
    family: 'Dry Brush', description: 'Scratchy, skipping strokes that catch only the texture.',
    names: 'Fine,Medium,Broad,Scratchy,Broken,Grainy,Rough,Dusty,Sweep,Scrape,Pencil Dry,Ink Dry,Paint Dry,Flat Dry,Round Dry,Wide Dry,Textured,Skipping,Stipple Dry,Edge Dry'.split(','),
    base: { size: 18, hardness: 0.7, opacity: 0.65, spacing: 0.1, scatter: 0.3, rotation: 0, bristles: 12, flow: 0.5, grain: 0.9, taper: 0.15, softness: 0.25, aspect: 0.8, glow: 0, irregularity: 0.85, texture: 'rough', velocityOpacity: 0.35 },
    ranges: { size: [8, 38], irregularity: [0.6, 1], grain: [0.7, 1], velocityOpacity: [0.2, 0.55] },
  },
  {
    family: 'Splatter', description: 'Paint flings, droplets, drips, and messy bursts.',
    names: 'Fine Splash,Heavy Splash,Drips,Droplets,Specks,Spatter,Paint Fling,Ink Splat,Mud,Rain,Spray Paint,Blob,Rays,Burst,Fine Mist,Large Blob,Crimson Splat,Black Splat,Blue Splat,Gold Splat'.split(','),
    base: { size: 30, hardness: 0.85, opacity: 0.75, spacing: 0.18, scatter: 1.6, rotation: 0, bristles: 14, flow: 0.6, grain: 0.3, taper: 0.05, softness: 0.2, aspect: 1, glow: 0, stamp: 'splat' },
    ranges: { size: [12, 64], scatter: [0.9, 2.2], bristles: [8, 22] },
  },
  {
    family: 'Smudge', description: 'Blend and soften existing paint with finger-like marks.',
    names: 'Soft Smudge,Finger,Blending Stump,Tortillon,Tissue,Brush Blend,Wet Blend,Dry Blend,Charcoal Smudge,Pastel Smudge,Ink Smudge,Water Smudge,Oil Blend,Acrylic Blend,Sharp Smudge,Wide Smudge,Point Smudge,Graphite Blend,Dust Blend,Clean Blend'.split(','),
    base: { size: 24, hardness: 0.15, opacity: 0.3, spacing: 0.06, scatter: 0.12, rotation: 0, bristles: 7, flow: 0.25, grain: 0.15, taper: 0.1, softness: 1, aspect: 1, glow: 0, wetness: 0.5 },
    ranges: { size: [10, 52], flow: [0.12, 0.4], softness: [0.8, 1] },
  },
  {
    family: 'Sumi', description: 'Expressive East-Asian ink strokes with dry-brush fly-white.',
    names: 'Sumi Brush,Bamboo Ink,Dry Sumi,Wet Sumi,Fine Line,Broad Stroke,Splash Ink,Fly White,Kasa,Katsu,Bokashi,Tarashikomi,Ori,Nami,Kaze,Yama,Kawa,Sora,Hana,Tsubaki'.split(','),
    base: { size: 24, hardness: 0.7, opacity: 0.88, spacing: 0.07, scatter: 0.12, rotation: 0, bristles: 14, flow: 0.8, grain: 0.45, taper: 0.6, softness: 0.4, aspect: 0.85, glow: 0, streak: 0.8, directionality: 0.9, irregularity: 0.5, texture: 'fibrous', velocitySize: 0.7 },
    ranges: { size: [8, 48], velocitySize: [0.4, 0.9], irregularity: [0.3, 0.75], streak: [0.5, 1] },
  },
  {
    family: 'Technical', description: 'Precise drafting liners in exact metric widths.',
    names: '0.3 mm,0.5 mm,0.7 mm,0.9 mm,1.0 mm,2.0 mm,Rapidograph,Rotring,Drafting Pen,Isogram,Stencil,Ruler Pen,Compass Pen,Fine Liner,Micron,Pigment Liner,Archival Fineliners,Graphite,Non Photo Blue,Sepia Technical'.split(','),
    base: { size: 2, hardness: 1, opacity: 1, spacing: 0.06, scatter: 0, rotation: 0, bristles: 1, flow: 1, grain: 0, taper: 0.1, softness: 0, aspect: 1, glow: 0 },
    ranges: { size: [0.7, 5], taper: [0.05, 0.25] },
  },
  {
    family: 'Fiber', description: 'Natural and synthetic fiber tips with firm, even flow.',
    names: 'Fine Fiber,Medium Fiber,Broad Fiber,Chisel Fiber,Brush Fiber,Soft Fiber,Firm Fiber,Nylon,Polyester,Natural,Synthetic Flat,Synthetic Round,Detail Fiber,Broad Tip,Eraser Fiber,Ink Fiber,Paint Fiber,Marker Fiber,Calligraphy Fiber,Highlight Fiber'.split(','),
    base: { size: 12, hardness: 0.85, opacity: 0.85, spacing: 0.08, scatter: 0.03, rotation: 0, bristles: 5, flow: 0.8, grain: 0.12, taper: 0.25, softness: 0.15, aspect: 1, glow: 0, streak: 0.4, irregularity: 0.1 },
    ranges: { size: [3, 28], bristles: [2, 10], streak: [0.1, 0.6] },
    vary: (i, p) => ({ ...p, aspect: i % 5 === 3 ? 0.4 : 1, rotation: i % 5 === 3 ? 45 : 0 }),
  },
  {
    family: 'Gel', description: 'Smooth gel ink with metallic, neon, and glitter finishes.',
    names: 'Fine Gel,Medium Gel,Broad Gel,White Gel,Metallic Gel,Neon Gel,Glitter Gel,Pastel Gel,Black Gel,Blue Gel,Red Gel,Green Gel,Purple Gel,Gold Gel,Silver Gel,Clear Gel,Gel Roller,Gel Ink,Jel Pen,Opal Gel'.split(','),
    base: { size: 8, hardness: 0.95, opacity: 0.95, spacing: 0.07, scatter: 0, rotation: 0, bristles: 1, flow: 0.95, grain: 0.08, taper: 0.3, softness: 0.08, aspect: 1, glow: 0, multicolor: false },
    ranges: { size: [2, 16], grain: [0.02, 0.3], glow: [0, 6] },
    vary: (i, p) => ({ ...p, multicolor: i >= 18 }),
  },
  {
    family: 'Knife', description: 'Palette-knife scrapes, smears, and sculpted paint edges.',
    names: 'Palette Knife,Painting Knife,Spatula,Straight Knife,Angled Knife,Small Knife,Large Knife,Flexible Knife,Stiff Knife,Crimson Knife,Impasto Knife,Scraper,Scratcher,Texture Knife,Flat Knife,Pointed Knife,Wide Knife,Fine Knife,Steel Knife,Plastic Knife'.split(','),
    base: { size: 28, hardness: 0.9, opacity: 0.92, spacing: 0.16, scatter: 0.08, rotation: 20, bristles: 4, flow: 0.9, grain: 0.3, taper: 0.1, softness: 0.05, aspect: 0.35, glow: 0, streak: 0.9, directionality: 1, irregularity: 0.4, texture: 'crackle' },
    ranges: { size: [12, 52], irregularity: [0.25, 0.6], streak: [0.7, 1] },
    vary: (i, p) => ({ ...p, rotation: -35 + (i % 6) * 14 }),
  },
  {
    family: 'Sponge', description: 'Porous sponge dabbers for mottled, irregular texture.',
    names: 'Fine Sponge,Medium Sponge,Coarse Sponge,Natural Sponge,Synthetic Sponge,Sea Sponge,Foam Sponge,Block Sponge,Round Sponge,Flat Sponge,Dry Sponge,Wet Sponge,Paint Sponge,Ink Sponge,Texture Sponge,Brick Sponge,Cloud Sponge,Speck Sponge,Fine Pore,Mega Pore'.split(','),
    base: { size: 32, hardness: 0.4, opacity: 0.55, spacing: 0.18, scatter: 0.6, rotation: 0, bristles: 14, flow: 0.45, grain: 0.95, taper: 0.05, softness: 0.5, aspect: 1, glow: 0, irregularity: 0.9, texture: 'grit', stamp: 'none' },
    ranges: { size: [14, 60], scatter: [0.3, 1], irregularity: [0.7, 1] },
    vary: (i, p) => ({ ...p, texture: (['grit', 'rough', 'paper'] as DabTexture[])[i % 3] }),
  },
  {
    family: 'Stencil', description: 'Repeating pattern stamps for grids, motifs, and halftones.',
    names: 'Dots,Squares,Hex,Grid,Stripes,Chevrons,Stars,Hearts,Arrows,Crosses,Triangles,Circles,Raindrops,Snowflakes,Leaves,Flowers,Grunge,Distressed,Halftone,Noise Stencil'.split(','),
    base: { size: 26, hardness: 0.9, opacity: 0.7, spacing: 0.28, scatter: 0.15, rotation: 0, bristles: 4, flow: 0.6, grain: 0.2, taper: 0.05, softness: 0.1, aspect: 1, glow: 0, stamp: 'dot' },
    ranges: { size: [12, 50], spacing: [0.2, 0.5], bristles: [2, 8] },
    vary: (i, p) => ({
      ...p,
      stamp: (['dot', 'square', 'star', 'leaf', 'ring', 'scale', 'scribble', 'grass'] as DabStamp[])[i % 8],
      rotation: (i * 15) % 180,
    }),
  },
  {
    family: 'Bamboo', description: 'Split bamboo and reed pens with organic, fibrous marks.',
    names: 'Fine Bamboo,Medium Bamboo,Broad Bamboo,Split Bamboo,Reed,Rush,Cane,Fine Reed,Broad Reed,Bamboo Brush,Ink Bamboo,Dry Bamboo,Wet Bamboo,Bamboo Splinter,Charred Bamboo,Green Bamboo,Bamboo Leaf,Bamboo Stem,Bamboo Skin,Rustic Bamboo'.split(','),
    base: { size: 14, hardness: 0.85, opacity: 0.85, spacing: 0.08, scatter: 0.08, rotation: 0, bristles: 7, flow: 0.75, grain: 0.4, taper: 0.45, softness: 0.3, aspect: 0.8, glow: 0, streak: 0.7, directionality: 0.85, irregularity: 0.45, texture: 'fibrous', velocitySize: 0.5 },
    ranges: { size: [5, 30], streak: [0.4, 0.9], irregularity: [0.3, 0.65], velocitySize: [0.3, 0.7] },
  },
  {
    family: 'Metallic', description: 'Shimmering metallic and iridescent foil finishes.',
    names: 'Gold,Silver,Bronze,Copper,Brass,Chrome,Steel,Pewter,Rose Gold,Platinum,Iridescent,Holographic,Pearl,Metallic Red,Metallic Blue,Metallic Green,Metallic Purple,Metallic Black,Metallic White,Glitter Gold'.split(','),
    base: { size: 12, hardness: 0.85, opacity: 0.9, spacing: 0.09, scatter: 0.06, rotation: 0, bristles: 5, flow: 0.8, grain: 0.35, taper: 0.2, softness: 0.2, aspect: 1, glow: 4, multicolor: false },
    ranges: { size: [4, 26], grain: [0.2, 0.6], glow: [2, 10] },
    vary: (i, p) => ({ ...p, multicolor: i >= 10 }),
  },
  {
    family: 'Cloud', description: 'Soft atmospheric washes for clouds, mist, and smoke.',
    names: 'Soft Cloud,Wispy Cloud,Cumulus,Cirrus,Stratus,Storm Cloud,Mist,Fog,Smoke,Steam,Vapor,Cotton,Feather Cloud,Cloud Wash,Dramatic,Sunset Cloud,Grey Cloud,White Cloud,Ink Cloud,Cloud Edge'.split(','),
    base: { size: 48, hardness: 0, opacity: 0.22, spacing: 0.05, scatter: 0.3, rotation: 0, bristles: 9, flow: 0.18, grain: 0.08, taper: 0.05, softness: 1, aspect: 1, glow: 0, wetness: 0.5 },
    ranges: { size: [22, 90], flow: [0.1, 0.3], scatter: [0.15, 0.5], wetness: [0.2, 0.8] },
  },
  {
    family: 'Fur', description: 'Layered strands for animal fur, hair, and feathers.',
    names: 'Fine Fur,Medium Fur,Long Fur,Short Fur,Curly Fur,Straight Fur,Sparse Fur,Dense Fur,Animal Fur,Brush Fur,Dry Fur,Wet Fur,Layered Fur,Tiger Fur,Zebra Fur,Fox Fur,Bear Fur,Cat Fur,Dog Fur,Fur Blend'.split(','),
    base: { size: 20, hardness: 0.6, opacity: 0.7, spacing: 0.08, scatter: 0.2, rotation: 0, bristles: 14, flow: 0.6, grain: 0.35, taper: 0.6, softness: 0.4, aspect: 0.5, glow: 0, streak: 1, directionality: 1, irregularity: 0.35, velocitySize: 0.4 },
    ranges: { size: [8, 40], bristles: [8, 22], taper: [0.35, 0.85], streak: [0.8, 1] },
    vary: (i, p) => ({ ...p, rotation: -40 + (i % 6) * 16 }),
  },
]

export const BRUSHES: BrushPreset[] = [
  ...specs.flatMap((spec) =>
    spec.names.map((name, i) => {
      const t = spec.names.length > 1 ? i / (spec.names.length - 1) : 0
      const p: BrushParams = { ...spec.base }
      if (spec.ranges) {
        for (const key of Object.keys(spec.ranges) as NumericBrushParam[]) {
          const range = spec.ranges[key]
          if (range) (p as unknown as Record<string, number>)[key] = lerp(range[0], range[1], t)
        }
      }
      const finalParams = spec.vary ? spec.vary(i, p, spec.names.length) : p
      return {
        id: `brush_${spec.family.toLowerCase().replace(/\s+/g, '')}_${i + 1}`,
        name: `${spec.family} ${name}`,
        family: spec.family,
        description: spec.description,
        params: finalParams,
      }
    }),
  ),
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
  for (const brush of CC0_BRUSHES) {
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
