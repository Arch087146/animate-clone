import { drawShape, preloadImage } from './draw'
import { addRecent } from './recents'
import type { Keyframe, Layer, Project } from './types'
import { getRenderShapes } from './utils'

function download(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function renderProjectFrame(project: Project, frame: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = project.width
  canvas.height = project.height
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = project.backgroundColor
  ctx.fillRect(0, 0, project.width, project.height)
  for (const { shape } of getRenderShapes(project, frame)) drawShape(ctx, shape)
  return canvas
}

export function exportPNG(project: Project, frame: number) {
  renderProjectFrame(project, frame).toBlob((blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${project.name}_frame${frame + 1}.png`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, 'image/png')
}

export interface ImportedImage {
  name: string
  src: string
  width: number
  height: number
}

/** Opens the OS file picker and reads one or more images as data URLs. */
export function importImages(onImages: (images: ImportedImage[]) => void) {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/png,image/jpeg,image/gif,image/webp,image/svg+xml,image/*'
  input.multiple = true
  input.onchange = async () => {
    const files = [...(input.files ?? [])]
    if (!files.length) return
    const results: ImportedImage[] = []
    for (const file of files) {
      try {
        const src = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(String(reader.result))
          reader.onerror = () => reject(reader.error)
          reader.readAsDataURL(file)
        })
        const img = await preloadImage(src)
        results.push({
          name: file.name.replace(/\.[^.]+$/, ''),
          src,
          width: img.naturalWidth || 300,
          height: img.naturalHeight || 200,
        })
      } catch (error) {
        alert(`Could not import ${file.name}: ${(error as Error).message}`)
      }
    }
    if (results.length) onImages(results)
  }
  input.click()
}

export function exportJSON(project: Project) {
  addRecent(project)
  download(JSON.stringify(project, null, 2), `${project.name}.json`, 'application/json')
}

const finite = (value: unknown, fallback: number, min: number, max: number) => {
  const n = Number(value)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}

/** Repairs older or hand-edited project files instead of letting them crash the reducer. */
export function normalizeProject(raw: unknown): Project {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid project file')
  const data = raw as Record<string, any>
  if (!Array.isArray(data.layers)) throw new Error('Project has no layers')

  const width = Math.round(finite(data.width, 550, 1, 8192))
  const height = Math.round(finite(data.height, 400, 1, 8192))
  const fps = Math.round(finite(data.fps, 24, 1, 120))
  const totalFrames = Math.round(finite(data.totalFrames, 60, 1, 1000))
  const backgroundColor = typeof data.backgroundColor === 'string' && data.backgroundColor
    ? data.backgroundColor : '#ffffff'

  const layers: Layer[] = data.layers.map((rawLayer: Record<string, any>, layerIndex: number) => {
    const source = rawLayer ?? {}
    const frames: (Keyframe | null)[] = Array.from({ length: totalFrames }, (_, frameIndex) => {
      const rawFrame = Array.isArray(source.frames) ? source.frames[frameIndex] : null
      if (!rawFrame || typeof rawFrame !== 'object') return null
      const start = Math.round(finite(rawFrame.start, frameIndex, 0, totalFrames - 1))
      const duration = Math.round(finite(rawFrame.duration, 1, 1, totalFrames - start))
      return {
        ...rawFrame,
        id: typeof rawFrame.id === 'string' ? rawFrame.id : `kf_${layerIndex}_${frameIndex}`,
        start,
        duration,
        shapes: Array.isArray(rawFrame.shapes) ? rawFrame.shapes : [],
        bones: Array.isArray(rawFrame.bones) ? rawFrame.bones : [],
        tween: rawFrame.tween === 'motion' || rawFrame.tween === 'shape' ? rawFrame.tween : 'none',
        ease: finite(rawFrame.ease, 0, -1, 1),
      } as Keyframe
    })
    return {
      ...source,
      id: typeof source.id === 'string' ? source.id : `layer_${layerIndex}`,
      name: typeof source.name === 'string' ? source.name : `Layer ${layerIndex + 1}`,
      visible: source.visible !== false,
      locked: !!source.locked,
      frames,
    } as Layer
  })

  return {
    ...data,
    name: typeof data.name === 'string' && data.name ? data.name : 'Untitled',
    width,
    height,
    fps,
    totalFrames,
    backgroundColor,
    layers,
    library: Array.isArray(data.library) ? data.library : [],
  } as Project
}

/** Makes saved image data URLs paint immediately after a project is reopened. */
export async function preloadProjectImages(project: Project): Promise<void> {
  const sources = new Set<string>()
  for (const layer of project.layers) {
    for (const frame of layer.frames) {
      for (const shape of frame?.shapes ?? []) {
        if (shape.imageSrc) sources.add(shape.imageSrc)
      }
    }
  }
  await Promise.all([...sources].map((src) => preloadImage(src).catch(() => undefined)))
}

export function openProjectFile(callback: (project: Project) => void) {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json,application/json'
  input.onchange = async () => {
    const file = input.files?.[0]
    if (!file) return
    try {
      const data = normalizeProject(JSON.parse(await file.text()))
      await preloadProjectImages(data)
      addRecent(data)
      callback(data)
    } catch (error) {
      alert(`Could not open project: ${(error as Error).message}`)
    }
  }
  input.click()
}

const escapeHTML = (value: string) => value.replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]!))

export function exportAnimationHTML(project: Project, options?: { fps?: number }) {
  const frames: string[] = []
  for (let f = 0; f < project.totalFrames; f++) {
    frames.push(renderProjectFrame(project, f).toDataURL('image/png'))
  }
  const fps = Math.max(1, Number(options?.fps) || project.fps || 24)
  const name = escapeHTML(project.name)
  const background = JSON.stringify(project.backgroundColor || '#ffffff')
  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>${name}</title>
<style>
body{margin:0;background:#1e1e1e;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font:12px Arial;color:#ccc}
canvas{background:${background};box-shadow:0 8px 40px #0008;image-rendering:auto}
.controls{margin-top:14px;display:flex;gap:8px;align-items:center}
button{background:#333;color:#fff;border:1px solid #555;padding:5px 12px;cursor:pointer;border-radius:3px}
</style></head><body>
<canvas id="c" width="${project.width}" height="${project.height}"></canvas>
<div class="controls"><button id="play">Pause</button><span id="label">Frame 1 / ${project.totalFrames}</span></div>
<script>
const imgs=[${frames.map((f) => JSON.stringify(f)).join(',')}];
const c=document.getElementById('c'),x=c.getContext('2d'),label=document.getElementById('label');
let i=0,playing=true,last=performance.now(),acc=0;const interval=${1000 / fps};
function draw(){const im=cache[i];if(im.complete)x.drawImage(im,0,0);label.textContent='Frame '+(i+1)+' / ${project.totalFrames}'}
const cache=imgs.map(src=>{const im=new Image();im.onload=draw;im.src=src;return im});
function loop(now){acc+=now-last;last=now;if(playing&&acc>=interval){acc=0;i=(i+1)%imgs.length;draw()}requestAnimationFrame(loop)}
cache[0]?.addEventListener('load',draw,{once:true});draw();requestAnimationFrame(loop);
document.getElementById('play').onclick=e=>{playing=!playing;e.target.textContent=playing?'Pause':'Play'};
</script></body></html>`
  download(html, `${project.name}_animation.html`, 'text/html')
}
