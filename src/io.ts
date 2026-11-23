import { drawShape, preloadImage } from './draw'
import { addRecent } from './recents'
import type { Project } from './types'
import { getRenderShapes } from './utils'

function download(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
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

export function openProjectFile(callback: (project: Project) => void) {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json,application/json'
  input.onchange = async () => {
    const file = input.files?.[0]
    if (!file) return
    try {
      const data = JSON.parse(await file.text()) as Project
      if (!data.layers || !Array.isArray(data.layers) || !data.width) throw new Error('Invalid project')
      addRecent(data)
      callback(data)
    } catch (error) {
      alert(`Could not open project: ${(error as Error).message}`)
    }
  }
  input.click()
}

export function exportAnimationHTML(project: Project) {
  const frames: string[] = []
  for (let f = 0; f < project.totalFrames; f++) {
    frames.push(renderProjectFrame(project, f).toDataURL('image/png'))
  }
  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>${project.name}</title>
<style>
body{margin:0;background:#1e1e1e;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font:12px Arial;color:#ccc}
canvas{background:${project.backgroundColor};box-shadow:0 8px 40px #0008;image-rendering:auto}
.controls{margin-top:14px;display:flex;gap:8px;align-items:center}
button{background:#333;color:#fff;border:1px solid #555;padding:5px 12px;cursor:pointer;border-radius:3px}
</style></head><body>
<canvas id="c" width="${project.width}" height="${project.height}"></canvas>
<div class="controls"><button id="play">Pause</button><span id="label">Frame 1 / ${project.totalFrames}</span></div>
<script>
const imgs=[${frames.map((f) => JSON.stringify(f)).join(',')}];
const c=document.getElementById('c'),x=c.getContext('2d'),label=document.getElementById('label');
let i=0,playing=true,last=performance.now(),acc=0;const interval=1000/${project.fps};
function load(n){const im=new Image();im.src=imgs[n];return im}
const cache=imgs.map(load);
function draw(){const im=cache[i];if(im.complete)x.drawImage(im,0,0);label.textContent='Frame '+(i+1)+' / ${project.totalFrames}'}
function loop(now){acc+=now-last;last=now;if(playing&&acc>=interval){acc=0;i=(i+1)%imgs.length;draw()}requestAnimationFrame(loop)}
draw();requestAnimationFrame(loop);
document.getElementById('play').onclick=e=>{playing=!playing;e.target.textContent=playing?'Pause':'Play'};
</script></body></html>`
  download(html, `${project.name}_animation.html`, 'text/html')
}
