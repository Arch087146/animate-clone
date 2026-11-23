import { createInitialProject, createKeyframe, createLayer, createShape, type Bone, type Project, type Shape } from './types'

export interface CanvasPreset {
  id: string
  name: string
  detail: string
  width: number
  height: number
  fps: number
  frames: number
  background: string
  icon: string
}

export interface TemplateInfo {
  id: string
  name: string
  description: string
  tag: string
  width: number
  height: number
  frames: number
  accent: string
}

export const CANVAS_PRESETS: CanvasPreset[] = [
  { id: 'default', name: 'Default', detail: 'Classic Animate stage', width: 550, height: 400, fps: 24, frames: 60, background: '#ffffff', icon: 'film' },
  { id: 'hd1080', name: 'HD 1080p', detail: 'Full HD landscape', width: 1920, height: 1080, fps: 30, frames: 90, background: '#ffffff', icon: 'image' },
  { id: 'hd720', name: 'HD 720p', detail: 'Standard landscape', width: 1280, height: 720, fps: 30, frames: 90, background: '#ffffff', icon: 'image' },
  { id: 'square', name: 'Square', detail: 'Social media post', width: 1080, height: 1080, fps: 30, frames: 60, background: '#ffffff', icon: 'oval' },
  { id: 'portrait', name: 'Portrait', detail: 'Story / Reels format', width: 1080, height: 1920, fps: 30, frames: 90, background: '#ffffff', icon: 'rectangle' },
  { id: 'classic', name: 'Classic', detail: '4:3 presentation', width: 800, height: 600, fps: 24, frames: 72, background: '#ffffff', icon: 'film' },
  { id: 'wide', name: 'Cinematic', detail: '21:9 widescreen', width: 1280, height: 548, fps: 24, frames: 96, background: '#000000', icon: 'film' },
  { id: 'icon', name: 'App Icon', detail: 'Small animation', width: 256, height: 256, fps: 24, frames: 36, background: '#ffffff', icon: 'polyStar' },
]

export const TEMPLATES: TemplateInfo[] = [
  { id: 'blank', name: 'Blank Document', description: 'Start with an empty stage and a clean timeline.', tag: 'Starter', width: 550, height: 400, frames: 60, accent: '#1473e6' },
  { id: 'bouncing', name: 'Bouncing Ball', description: 'A classic bouncy ball with motion tweening.', tag: 'Animation', width: 550, height: 400, frames: 60, accent: '#ff4081' },
  { id: 'stickman', name: 'Stick Figure Rig', description: 'A posed stick figure with working bones — move the legs and arms.', tag: 'Rigging', width: 550, height: 400, frames: 48, accent: '#7c4dff' },
  { id: 'walkcycle', name: 'Walk Cycle', description: 'A four-pose walk cycle you can loop forever.', tag: 'Rigging', width: 550, height: 400, frames: 48, accent: '#00bcd4' },
  { id: 'logo', name: 'Logo Sting', description: 'Animated text that scales and fades in.', tag: 'Motion', width: 800, height: 450, frames: 60, accent: '#ffc107' },
  { id: 'sunrise', name: 'Sunrise Scene', description: 'A simple scene with a rising sun and moving clouds.', tag: 'Scene', width: 800, height: 450, frames: 90, accent: '#ff7043' },
]

function blankProject(preset: CanvasPreset): Project {
  const layer = createLayer('Layer 1', preset.frames)
  return {
    name: 'Untitled-1',
    width: preset.width,
    height: preset.height,
    fps: preset.fps,
    totalFrames: preset.frames,
    backgroundColor: preset.background,
    layers: [layer],
    library: [],
  }
}

function stickFigure(): Project {
  const layer = createLayer('Stick Figure', 48)
  const bones: Bone[] = [
    { id: 'sf_torso', name: 'Torso', x1: 275, y1: 150, x2: 275, y2: 245, parentId: null },
    { id: 'sf_head', name: 'Head', x1: 275, y1: 150, x2: 275, y2: 112, parentId: 'sf_torso' },
    { id: 'sf_armL', name: 'Left Arm', x1: 275, y1: 175, x2: 220, y2: 210, parentId: 'sf_torso' },
    { id: 'sf_armR', name: 'Right Arm', x1: 275, y1: 175, x2: 330, y2: 210, parentId: 'sf_torso' },
    { id: 'sf_legL', name: 'Left Leg', x1: 275, y1: 245, x2: 240, y2: 310, parentId: 'sf_torso' },
    { id: 'sf_legL2', name: 'Left Foot', x1: 240, y1: 310, x2: 215, y2: 345, parentId: 'sf_legL' },
    { id: 'sf_legR', name: 'Right Leg', x1: 275, y1: 245, x2: 310, y2: 310, parentId: 'sf_torso' },
    { id: 'sf_legR2', name: 'Right Foot', x1: 310, y1: 310, x2: 335, y2: 345, parentId: 'sf_legR' },
  ]
  const line = (name: string, a: { x: number; y: number }, b: { x: number; y: number }, boneId: string, width = 8): Shape =>
    createShape({
      name, type: 'line', x: Math.min(a.x, b.x), y: Math.min(a.y, b.y),
      width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y),
      points: [a, b], fill: 'none', stroke: '#212121', strokeWidth: width, boneId,
    })
  const shapes: Shape[] = [
    createShape({ name: 'Head', type: 'oval', x: 247, y: 85, width: 56, height: 56, fill: '#ffffff', stroke: '#212121', strokeWidth: 8, boneId: 'sf_head' }),
    line('Body', { x: 275, y: 150 }, { x: 275, y: 245 }, 'sf_torso', 9),
    line('Left Arm', { x: 275, y: 175 }, { x: 220, y: 210 }, 'sf_armL'),
    line('Right Arm', { x: 275, y: 175 }, { x: 330, y: 210 }, 'sf_armR'),
    line('Left Leg', { x: 275, y: 245 }, { x: 240, y: 310 }, 'sf_legL'),
    line('Left Foot', { x: 240, y: 310 }, { x: 215, y: 345 }, 'sf_legL2', 7),
    line('Right Leg', { x: 275, y: 245 }, { x: 310, y: 310 }, 'sf_legR'),
    line('Right Foot', { x: 310, y: 310 }, { x: 335, y: 345 }, 'sf_legR2', 7),
  ]
  const pose = (legAngle: number): Bone[] =>
    bones.map((b) => {
      if (b.id === 'sf_legL') return { ...b, x2: 275 + Math.sin(legAngle) * 68, y2: 245 + Math.cos(legAngle) * 65 }
      if (b.id === 'sf_legL2') return { ...b, x1: 275 + Math.sin(legAngle) * 68, y1: 245 + Math.cos(legAngle) * 65, x2: 220 + Math.sin(legAngle) * 80, y2: 300 + Math.cos(legAngle) * 75 }
      if (b.id === 'sf_armL') return { ...b, x2: 220 - legAngle * 12, y2: 210 + legAngle * 8 }
      return b
    })

  const first = createKeyframe(0, shapes, pose(0.5))
  layer.frames[0] = first
  const mid = createKeyframe(16, shapes, pose(-0.5))
  mid.tween = 'motion'
  mid.duration = 16
  layer.frames[16] = mid
  const end = createKeyframe(32, shapes, pose(0.5))
  end.tween = 'motion'
  end.duration = 16
  layer.frames[32] = end
  return {
    name: 'Stick Figure Rig', width: 550, height: 400, fps: 24, totalFrames: 48,
    backgroundColor: '#ffffff', layers: [layer], library: [],
  }
}

function walkCycle(): Project {
  const layer = createLayer('Walk', 48)
  const bones: Bone[] = [
    { id: 'wc_torso', name: 'Torso', x1: 275, y1: 130, x2: 275, y2: 225, parentId: null },
    { id: 'wc_head', name: 'Head', x1: 275, y1: 130, x2: 275, y2: 90, parentId: 'wc_torso' },
    { id: 'wc_legL', name: 'Left Leg', x1: 275, y1: 225, x2: 240, y2: 290, parentId: 'wc_torso' },
    { id: 'wc_legR', name: 'Right Leg', x1: 275, y1: 225, x2: 310, y2: 290, parentId: 'wc_torso' },
  ]
  const shapes: Shape[] = [
    createShape({ name: 'Head', type: 'oval', x: 252, y: 62, width: 46, height: 46, fill: '#00bcd4', stroke: '#006064', strokeWidth: 4, boneId: 'wc_head' }),
    createShape({ name: 'Body', type: 'line', x: 275, y: 130, width: 0, height: 95, points: [{ x: 275, y: 130 }, { x: 275, y: 225 }], fill: 'none', stroke: '#006064', strokeWidth: 10, boneId: 'wc_torso' }),
    createShape({ name: 'Left Leg', type: 'line', x: 240, y: 225, width: 35, height: 65, points: [{ x: 275, y: 225 }, { x: 240, y: 290 }], fill: 'none', stroke: '#006064', strokeWidth: 8, boneId: 'wc_legL' }),
    createShape({ name: 'Right Leg', type: 'line', x: 275, y: 225, width: 35, height: 65, points: [{ x: 275, y: 225 }, { x: 310, y: 290 }], fill: 'none', stroke: '#006064', strokeWidth: 8, boneId: 'wc_legR' }),
  ]
  const pose = (swing: number): Bone[] => bones.map((b) => {
    if (b.id === 'wc_legL') return { ...b, x2: 275 + swing * 60, y2: 290 - Math.abs(swing) * 18 }
    if (b.id === 'wc_legR') return { ...b, x2: 275 - swing * 60, y2: 290 - Math.abs(swing) * 18 }
    return b
  })
  ;[0, 12, 24, 36].forEach((start, i) => {
    const kf = createKeyframe(start, shapes, pose([0.9, 0, -0.9, 0][i]))
    if (i < 3) { kf.tween = 'motion'; kf.duration = 12 }
    layer.frames[start] = kf
  })
  return {
    name: 'Walk Cycle', width: 550, height: 400, fps: 24, totalFrames: 48,
    backgroundColor: '#f4f9ff', layers: [layer], library: [],
  }
}

function logoSting(): Project {
  const layer = createLayer('Logo', 60)
  const text = createShape({
    name: 'YOUR LOGO', type: 'text', x: 230, y: 175, width: 340, height: 90,
    text: 'YOUR LOGO', fontSize: 62, fill: '#1473e6', stroke: 'none', strokeWidth: 0, opacity: 0,
  })
  const first = createKeyframe(0, [{ ...text, opacity: 0, width: 40 }])
  layer.frames[0] = first
  const mid = createKeyframe(12, [{ ...text, opacity: 1, width: 420 }])
  mid.tween = 'shape'
  mid.duration = 12
  layer.frames[12] = mid
  const hold = createKeyframe(36, [{ ...text, opacity: 1 }])
  hold.duration = 12
  layer.frames[36] = hold
  const end = createKeyframe(48, [{ ...text, opacity: 0 }])
  end.tween = 'motion'
  layer.frames[48] = end
  return {
    name: 'Logo Sting', width: 800, height: 450, fps: 30, totalFrames: 60,
    backgroundColor: '#101522', layers: [layer], library: [],
  }
}

function sunrise(): Project {
  const layer = createLayer('Scene', 90)
  const sun = createShape({ name: 'Sun', type: 'oval', x: 340, y: 300, width: 110, height: 110, fill: '#ffb300', stroke: '#ff8f00', strokeWidth: 3 })
  const ground = createShape({ name: 'Ground', type: 'rectangle', x: 0, y: 380, width: 800, height: 70, fill: '#2e7d32', stroke: 'none', strokeWidth: 0 })
  const cloud = createShape({ name: 'Cloud', type: 'oval', x: 80, y: 90, width: 150, height: 55, fill: '#ffffff', stroke: 'none', strokeWidth: 0, opacity: 0.85 })
  const first = createKeyframe(0, [sun, ground, cloud])
  layer.frames[0] = first
  const mid = createKeyframe(45, [{ ...sun, x: 340, y: 160 }, ground, { ...cloud, x: 480 }])
  mid.tween = 'motion'
  mid.duration = 45
  layer.frames[45] = mid
  return {
    name: 'Sunrise Scene', width: 800, height: 450, fps: 30, totalFrames: 90,
    backgroundColor: '#81d4fa', layers: [layer], library: [],
  }
}

function scaleBone(bone: Bone, sx: number, sy: number): Bone {
  return {
    ...bone,
    x1: bone.x1 * sx, y1: bone.y1 * sy,
    x2: bone.x2 * sx, y2: bone.y2 * sy,
  }
}

function scaleShape(shape: Shape, sx: number, sy: number): Shape {
  return {
    ...shape,
    x: shape.x * sx, y: shape.y * sy,
    width: shape.width * sx, height: shape.height * sy,
    points: shape.points?.map((p) => ({ x: p.x * sx, y: p.y * sy })),
  }
}

/** Makes the canvas preset win over the dimensions hard-coded into a template. */
function applyPreset(project: Project, preset: CanvasPreset): Project {
  const sx = preset.width / project.width
  const sy = preset.height / project.height
  const layers = project.layers.map((layer) => ({
    ...layer,
    frames: Array.from({ length: preset.frames }, (_, i) => {
      const kf = layer.frames[i]
      if (!kf) return null
      const nextIndex = layer.frames.findIndex((next, j) => j > i && !!next)
      return {
        ...kf,
        start: i,
        duration: Math.max(1, (nextIndex < 0 ? preset.frames : nextIndex) - i),
        shapes: kf.shapes.map((shape) => scaleShape(shape, sx, sy)),
        bones: (kf.bones ?? []).map((bone) => scaleBone(bone, sx, sy)),
      }
    }),
  }))
  return {
    ...project,
    width: preset.width,
    height: preset.height,
    fps: preset.fps,
    totalFrames: preset.frames,
    backgroundColor: preset.background,
    layers,
  }
}

export function createTemplateProject(templateId: string, preset?: CanvasPreset): Project {
  if (templateId === 'blank' || !preset) {
    return templateId === 'blank' ? blankProject(preset ?? CANVAS_PRESETS[0]) : baseTemplate(templateId)
  }
  return applyPreset(baseTemplate(templateId), preset)
}

function baseTemplate(templateId: string): Project {
  switch (templateId) {
    case 'bouncing': return createInitialProject()
    case 'stickman': return stickFigure()
    case 'walkcycle': return walkCycle()
    case 'logo': return logoSting()
    case 'sunrise': return sunrise()
    default: return blankProject(CANVAS_PRESETS[0])
  }
}
