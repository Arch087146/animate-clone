export type ToolId =
  | 'selection'
  | 'subselection'
  | 'lasso'
  | 'pen'
  | 'text'
  | 'line'
  | 'rectangle'
  | 'oval'
  | 'rectPrimitive'
  | 'ovalPrimitive'
  | 'polyStar'
  | 'pencil'
  | 'brush'
  | 'eraser'
  | 'inkBottle'
  | 'paintBucket'
  | 'eyedropper'
  | 'hand'
  | 'zoom'
  | 'bone'
  | 'motionPath'

export type ShapeType =
  | 'rectangle'
  | 'oval'
  | 'line'
  | 'text'
  | 'path'
  | 'polyStar'
  | 'rectPrimitive'
  | 'ovalPrimitive'
  | 'image'

export type Point = { x: number; y: number }

export interface BoneConstraint {
  enabled: boolean
  min: number
  max: number
}

export interface BoneTranslationConstraint {
  enabled: boolean
  min: number
  max: number
}

export interface Bone {
  id: string
  name: string
  x1: number
  y1: number
  x2: number
  y2: number
  parentId: string | null
  boneId?: string | null
  /** Connected bones move with their parent. Alt-drag creates a free bone. */
  connected?: boolean
  /** Locked bones cannot be posed on the stage. */
  locked?: boolean
  /** Rotation limits in degrees relative to the bone's rest angle. */
  rotationMin?: number
  rotationMax?: number
  rotationEnabled?: boolean
  /** Translation limits for dragging the head joint. */
  translateXEnabled?: boolean
  translateXMin?: number
  translateXMax?: number
  translateYEnabled?: boolean
  translateYMin?: number
  translateYMax?: number
  /** Eases the rig when interpolating between pose keyframes. */
  ease?: number
}

export interface LibraryItem {
  id: string
  name: string
  type: 'Graphic' | 'Button' | 'Movie Clip' | 'Sound'
  shapes: Shape[]
  folder?: boolean
}

export interface Shape {
  id: string
  name: string
  type: ShapeType
  x: number
  y: number
  width: number
  height: number
  rotation: number
  fill: string
  stroke: string
  strokeWidth: number
  opacity: number
  visible: boolean
  locked: boolean
  points?: Point[]
  /** Data URL for imported image shapes. */
  imageSrc?: string
  text?: string
  fontSize?: number
  fontFamily?: string
  fontBold?: boolean
  fontItalic?: boolean
  cornerRadius?: number
  innerRadius?: number
  sides?: number
  closed?: boolean
  boneId?: string | null
  flipX?: boolean
  flipY?: boolean
  /** Procedural brush used for path strokes. */
  brush?: {
    id: string
    size: number
    opacity: number
    flowScale?: number
    spacingScale?: number
    scatterScale?: number
  }
}

export interface Keyframe {
  id: string
  start: number
  duration: number
  shapes: Shape[]
  bones: Bone[]
  tween: 'none' | 'motion' | 'shape'
  ease: number
  label?: string
  /** Center-point tracks for tweened shapes, keyed by shape ID. */
  motionPaths?: Record<string, Point[]>
  /** Normalized 0..1 draw times aligned with motionPaths, preserving mouse speed. */
  motionPathTimes?: Record<string, number[]>
  /** Shapes that rotate to face the direction of their motion path. */
  motionPathOrient?: Record<string, boolean>
}

export interface Layer {
  id: string
  name: string
  visible: boolean
  locked: boolean
  outline: boolean
  frames: (Keyframe | null)[]
  color: string
  height: number
}

export interface Project {
  name: string
  width: number
  height: number
  fps: number
  totalFrames: number
  backgroundColor: string
  layers: Layer[]
  library: LibraryItem[]
}

export interface Selection {
  layerId: string | null
  shapeId: string | null
  boneId?: string | null
}

export type AppMode = 'pro' | 'simple'
export type AppScreen = 'home' | 'editor'

export interface ToolSettings {
  brushId: string
  brushSize: number
  brushOpacity: number
  flowScale: number
  spacingScale: number
  scatterScale: number
  smoothing: number
  eraserSize: number
  cornerRadius: number
  starSides: number
  starInnerRadius: number
  fontSize: number
  fontFamily: string
  bold: boolean
  italic: boolean
  motionPathDuration: number
  motionPathSpeed: number
  motionPathUseDrawingSpeed: boolean
  motionPathOrient: boolean
}

export const createToolSettings = (): ToolSettings => ({
  brushId: 'brush_basic_1',
  brushSize: 4,
  brushOpacity: 1,
  flowScale: 1,
  spacingScale: 1,
  scatterScale: 1,
  smoothing: 0.35,
  eraserSize: 20,
  cornerRadius: 8,
  starSides: 5,
  starInnerRadius: 0.45,
  fontSize: 28,
  fontFamily: 'Arial',
  bold: true,
  italic: false,
  motionPathDuration: 30,
  motionPathSpeed: 1,
  motionPathUseDrawingSpeed: true,
  motionPathOrient: false,
})

export interface AppState {
  project: Project
  currentFrame: number
  tool: ToolId
  selection: Selection
  fillColor: string
  strokeColor: string
  strokeWidth: number
  zoom: number
  pan: Point
  playing: boolean
  loop: boolean
  onionSkin: boolean
  showRulers: boolean
  showGrid: boolean
  snapToGrid: boolean
  showBones: boolean
  onionRange: number
  onionOpacity: number
  onionKeyframesOnly: boolean
  theme: 'dark' | 'light'
  mode: AppMode
  screen: AppScreen
  toolSettings: ToolSettings
  showTutorials: boolean
  showToolOptions: boolean
  showPublish: boolean
  showPreferences: boolean
  publishFormat: string
  showTimeline: boolean
  clipboard: Shape[]
  frameClipboard: Keyframe | null
  activePanel: string
  selectedFrames: number[]
  statusMessage: string
  dirty: boolean
}

export const uid = (prefix = 'id') =>
  `${prefix}_${Math.random().toString(36).slice(2, 9)}`

export const createShape = (overrides: Partial<Shape> = {}): Shape => ({
  id: uid('shape'),
  name: 'Shape',
  type: 'rectangle',
  x: 60,
  y: 60,
  width: 100,
  height: 80,
  rotation: 0,
  fill: '#1473e6',
  stroke: '#000000',
  strokeWidth: 1,
  opacity: 1,
  visible: true,
  locked: false,
  ...overrides,
})

export const createKeyframe = (start: number, shapes: Shape[] = [], bones: Bone[] = []): Keyframe => ({
  id: uid('kf'),
  start,
  duration: 1,
  shapes,
  bones,
  tween: 'none',
  ease: 0,
})

export const createLayer = (name: string, totalFrames: number, index = 0): Layer => {
  const frames: (Keyframe | null)[] = Array(totalFrames).fill(null)
  frames[0] = createKeyframe(0, [])
  return {
    id: uid('layer'),
    name,
    visible: true,
    locked: false,
    outline: false,
    frames,
    color: ['#e57373', '#64b5f6', '#81c784', '#ffb74d', '#ba68c8', '#4dd0e1'][index % 6],
    height: 24,
  }
}

export const createInitialProject = (): Project => {
  const layer = createLayer('Layer 1', 60)
  const ball = createShape({
    name: 'Ball',
    type: 'oval',
    x: 120,
    y: 130,
    width: 90,
    height: 90,
    fill: '#1473e6',
    stroke: '#0b4f9e',
    strokeWidth: 2,
  })
  const ground = createShape({
    name: 'Ground',
    type: 'rectangle',
    x: 40,
    y: 300,
    width: 440,
    height: 14,
    fill: '#4caf50',
    stroke: '#2e7d32',
    strokeWidth: 1,
  })
  const bones: Bone[] = [
    { id: 'bone_torso', name: 'Torso', x1: 410, y1: 215, x2: 410, y2: 280, parentId: null },
    { id: 'bone_leg', name: 'Leg', x1: 410, y1: 280, x2: 385, y2: 330, parentId: 'bone_torso' },
    { id: 'bone_arm', name: 'Arm', x1: 410, y1: 230, x2: 455, y2: 250, parentId: 'bone_torso' },
  ]
  const bonesMid = bones.map((b) =>
    b.id === 'bone_leg' ? { ...b, x2: 430, y2: 330 } : b.id === 'bone_arm' ? { ...b, x2: 375, y2: 215 } : b,
  )

  layer.frames[0] = createKeyframe(0, [ground, ball], bones)

  const mid = createKeyframe(20, [
    { ...ground, id: ground.id },
    { ...ball, id: ball.id, y: 40, fill: '#ff4081' },
  ])
  mid.tween = 'motion'
  mid.duration = 20
  mid.bones = bonesMid
  layer.frames[20] = mid

  const end = createKeyframe(40, [
    { ...ground, id: ground.id },
    { ...ball, id: ball.id, x: 370, y: 130, fill: '#ffc107' },
  ])
  end.tween = 'motion'
  end.duration = 20
  end.bones = bones
  layer.frames[40] = end

  return {
    name: 'Untitled-1',
    width: 550,
    height: 400,
    fps: 24,
    totalFrames: 60,
    backgroundColor: '#ffffff',
    layers: [layer],
    library: [],
  }
}
