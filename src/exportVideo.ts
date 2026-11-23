import { drawBones, drawShape } from './draw'
import { exportAnimationHTML, exportJSON } from './io'
import type { Project } from './types'
import { getRenderBones, getRenderShapes } from './utils'

export type VideoFormat = 'mp4' | 'webm' | 'mkv' | 'mov' | 'avi' | 'gif' | 'apng' | 'pngseq' | 'sheet' | 'html' | 'json'

export const VIDEO_FORMATS: { id: VideoFormat; label: string; ext: string; note: string }[] = [
  { id: 'mp4', label: 'MP4 (H.264)', ext: 'mp4', note: 'Best for sharing — plays everywhere' },
  { id: 'webm', label: 'WebM (VP9)', ext: 'webm', note: 'Small files, great quality' },
  { id: 'mkv', label: 'MKV (Matroska)', ext: 'mkv', note: 'Lossless-friendly container' },
  { id: 'mov', label: 'QuickTime MOV', ext: 'mov', note: 'For video editing workflows' },
  { id: 'avi', label: 'AVI', ext: 'avi', note: 'Maximum compatibility' },
  { id: 'gif', label: 'Animated GIF', ext: 'gif', note: 'Loops anywhere, no audio' },
  { id: 'apng', label: 'Animated PNG', ext: 'png', note: 'Crisp, full-color transparency' },
  { id: 'pngseq', label: 'PNG image sequence', ext: 'png', note: 'One frame per file, for compositing' },
  { id: 'sheet', label: 'Sprite sheet + atlas', ext: 'png', note: 'All frames packed into one PNG with JSON map' },
  { id: 'html', label: 'Animated HTML', ext: 'html', note: 'Self-contained interactive page' },
  { id: 'json', label: 'Project JSON', ext: 'json', note: 'Reopen and keep editing' },
]

export interface ExportOptions {
  format: VideoFormat
  fps: number
  quality: number
  scale: number
  loop: number
  includeBones: boolean
}

export const defaultExportOptions: ExportOptions = {
  format: 'mp4', fps: 0, quality: 85, scale: 1, loop: 0, includeBones: false,
}

function outputSize(project: Project, scale: number) {
  // Encoders require even dimensions for most pixel formats.
  const even = (v: number) => Math.max(2, Math.round(v / 2) * 2)
  return { width: even(project.width * scale), height: even(project.height * scale) }
}

function paintFrame(canvas: HTMLCanvasElement, project: Project, frame: number, options: ExportOptions) {
  const ctx = canvas.getContext('2d')!
  const { width, height } = outputSize(project, options.scale)
  ctx.setTransform(width / project.width, 0, 0, height / project.height, 0, 0)
  ctx.fillStyle = project.backgroundColor
  ctx.fillRect(0, 0, project.width, project.height)
  for (const { shape } of getRenderShapes(project, frame)) drawShape(ctx, shape)
  if (options.includeBones) {
    const bones = getRenderBones(project, frame)
    if (bones.length) drawBones(ctx, bones, null, 1)
  }
}

function makeCanvas(project: Project, options: ExportOptions) {
  const canvas = document.createElement('canvas')
  const { width, height } = outputSize(project, options.scale)
  canvas.width = width
  canvas.height = height
  return canvas
}

async function canvasPNG(canvas: HTMLCanvasElement): Promise<ArrayBuffer> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('Could not encode a frame')
  return blob.arrayBuffer()
}

/** Renders every timeline frame to a PNG buffer for the encoder. */
export async function captureFrames(
  project: Project,
  options: ExportOptions,
  onProgress: (fraction: number, label: string) => void,
): Promise<ArrayBuffer[]> {
  const canvas = makeCanvas(project, options)
  const frames: ArrayBuffer[] = []
  for (let f = 0; f < project.totalFrames; f++) {
    paintFrame(canvas, project, f, options)
    frames.push(await canvasPNG(canvas))
    onProgress((f + 1) / project.totalFrames, `Rendering frame ${f + 1} of ${project.totalFrames}`)
    // Yield so the progress UI can paint between frames.
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  }
  return frames
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function recorderMime(format: VideoFormat) {
  const candidates: Record<string, string[]> = {
    mp4: ['video/mp4;codecs=avc1.42E01E', 'video/mp4'],
    webm: ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'],
    mkv: ['video/webm;codecs=vp9', 'video/webm'],
    mov: ['video/mp4', 'video/webm'],
    avi: ['video/webm', 'video/mp4'],
    gif: ['video/webm', 'video/mp4'],
    apng: ['video/webm', 'video/mp4'],
    pngseq: ['video/webm'],
    html: ['video/webm'],
    json: ['video/webm'],
  }
  return (candidates[format] ?? []).find((m) => MediaRecorder.isTypeSupported(m)) ?? null
}

/** Browser fallback used when running outside Electron (e.g. `npm run dev`). */
async function exportWithMediaRecorder(project: Project, options: ExportOptions, onProgress: (fraction: number, label: string) => void) {
  if (typeof MediaRecorder === 'undefined') throw new Error('Video recording is not available in this browser')
  if (['gif', 'apng', 'pngseq', 'sheet', 'html', 'json'].includes(options.format)) {
    throw new Error(`${options.format.toUpperCase()} export requires the desktop app. Open Publish Settings from the installed app.`)
  }
  const mime = recorderMime(options.format)
  if (!mime) throw new Error('This browser cannot record video')
  const canvas = makeCanvas(project, options)
  paintFrame(canvas, project, 0, options)
  const stream = canvas.captureStream(options.fps || project.fps)
  const bits = Math.round((options.quality / 100) * 8_000_000)
  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: bits })
  const chunks: BlobPart[] = []
  recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data) }
  let timeout = 0
  const stopped = new Promise<void>((resolve, reject) => {
    recorder.onstop = () => resolve()
    ;(recorder as any).onerror = (event: any) => reject(new Error(event?.error?.message || 'Recording failed'))
    timeout = window.setTimeout(() => reject(new Error('Recording timed out')), 30000)
  })
  try {
    recorder.start()
    const interval = 1000 / Math.max(1, options.fps || project.fps)
    for (let f = 0; f < project.totalFrames; f++) {
      paintFrame(canvas, project, f, options)
      await new Promise<void>((resolve) => setTimeout(resolve, interval))
      onProgress((f + 1) / project.totalFrames, `Recording frame ${f + 1} of ${project.totalFrames}`)
    }
    recorder.stop()
    await stopped
    const ext = mime.includes('mp4') ? 'mp4' : 'webm'
    downloadBlob(new Blob(chunks, { type: mime }), `${project.name}.${ext}`)
    if (ext !== options.format) {
      onProgress(1, `Saved as .${ext} (this browser cannot encode ${options.format.toUpperCase()})`)
    }
  } finally {
    window.clearTimeout(timeout)
    stream.getTracks().forEach((t) => t.stop())
  }
}

/** Packs every frame into one PNG plus a JSON atlas for game/sprite workflows. */
async function exportSpriteSheet(project: Project, options: ExportOptions, onProgress: (fraction: number, label: string) => void) {
  const cell = outputSize(project, options.scale)
  const total = Math.max(1, project.totalFrames)
  const cols = Math.ceil(Math.sqrt(total))
  const rows = Math.ceil(total / cols)
  const sheet = document.createElement('canvas')
  sheet.width = cols * cell.width
  sheet.height = rows * cell.height
  if (sheet.width > 16384 || sheet.height > 16384) {
    throw new Error('Sprite sheet is too large. Reduce the scale or frame count.')
  }
  const ctx = sheet.getContext('2d')!
  const source = makeCanvas(project, options)
  const frames: { filename: string; frame: number; x: number; y: number; width: number; height: number }[] = []

  for (let f = 0; f < total; f++) {
    paintFrame(source, project, f, options)
    const x = (f % cols) * cell.width
    const y = Math.floor(f / cols) * cell.height
    ctx.drawImage(source, x, y)
    frames.push({
      filename: `${project.name}_${String(f).padStart(4, '0')}.png`,
      frame: f, x, y, width: cell.width, height: cell.height,
    })
    onProgress((f + 1) / total, `Packing frame ${f + 1} of ${total}`)
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  }

  const blob = await new Promise<Blob | null>((resolve) => sheet.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('Could not encode the sprite sheet')
  downloadBlob(blob, `${project.name}_spritesheet.png`)
  const atlas = {
    frames,
    meta: {
      app: 'Animate',
      image: `${project.name}_spritesheet.png`,
      size: { w: sheet.width, h: sheet.height },
      scale: options.scale,
      fps: options.fps || project.fps,
    },
  }
  downloadBlob(new Blob([JSON.stringify(atlas, null, 2)], { type: 'application/json' }), `${project.name}_atlas.json`)
}

/** Export the project through the Publish dialog. */
export async function exportProject(
  project: Project,
  options: ExportOptions,
  onProgress: (fraction: number, label: string) => void,
): Promise<string> {
  if (options.format === 'html') {
    onProgress(0.4, 'Building HTML animation...')
    exportAnimationHTML(project, options)
    onProgress(1, 'HTML animation saved')
    return 'HTML animation saved'
  }
  if (options.format === 'json') {
    onProgress(0.4, 'Saving project...')
    exportJSON(project)
    onProgress(1, 'Project saved')
    return 'Project saved'
  }
  if (options.format === 'sheet') {
    onProgress(0.02, 'Building sprite sheet...')
    await exportSpriteSheet(project, options, (p, label) => onProgress(p, label))
    return 'Sprite sheet and atlas saved'
  }

  const api = window.electronAPI
  if (api?.exportVideo) {
    onProgress(0.02, 'Rendering frames...')
    const frames = await captureFrames(project, options, (p, label) => onProgress(p * 0.6, label))
    onProgress(0.65, 'Encoding video...')
    const result = await api.exportVideo({
      name: project.name,
      format: options.format,
      fps: options.fps || project.fps,
      width: outputSize(project, options.scale).width,
      height: outputSize(project, options.scale).height,
      quality: options.quality,
      scale: options.scale,
      loop: options.loop,
      frames,
    })
    if (result.cancelled) {
      onProgress(1, 'Export cancelled')
      return 'Export cancelled'
    }
    if (result.message) throw new Error(result.message)
    onProgress(1, `Saved ${result.path ?? 'file'}`)
    return `Saved ${result.path ?? 'file'}`
  }

  onProgress(0.02, 'Recording video...')
  await exportWithMediaRecorder(project, options, (p, label) => onProgress(p, label))
  return 'Video saved'
}
