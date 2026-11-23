const { app, BrowserWindow, ipcMain, Menu, shell, protocol, dialog } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const fsp = fs.promises
const os = require('node:os')
const { spawn } = require('node:child_process')

const dist = path.join(__dirname, '..', 'dist')

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, bypassCSP: true } },
])

function createWindow() {
  const win = new BrowserWindow({
    width: 1600,
    height: 980,
    minWidth: 1080,
    minHeight: 680,
    frame: false,
    backgroundColor: '#d4d4d4',
    icon: path.join(__dirname, '..', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  Menu.setApplicationMenu(null)

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    win.loadURL('app://./index.html')
  }

  win.webContents.on('did-fail-load', (_event, code, description) => {
    console.error('[animate] failed to load:', code, description)
  })
  win.webContents.on('did-finish-load', async () => {
    console.log('[animate] loaded:', win.webContents.getTitle())
    try {
      const info = await win.webContents.executeJavaScript(
        `({ root: document.getElementById('root')?.children.length ?? -1, screen: document.querySelector('.home-screen') ? 'home' : document.querySelector('.simple-workspace') ? 'simple' : 'pro', canvas: !!document.querySelector('canvas'), theme: document.querySelector('.app-shell')?.className, tools: document.querySelectorAll('.tool-btn, .simple-tool').length })`
      )
      console.log('[animate] render check:', JSON.stringify(info))
    } catch (err) {
      console.error('[animate] render check failed:', err)
    }
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

ipcMain.on('win:minimize', ({ sender }) => BrowserWindow.fromWebContents(sender)?.minimize())
ipcMain.on('win:maximize', ({ sender }) => {
  const win = BrowserWindow.fromWebContents(sender)
  if (!win) return
  if (win.isMaximized()) win.unmaximize()
  else win.maximize()
})
ipcMain.on('win:close', ({ sender }) => BrowserWindow.fromWebContents(sender)?.close())

/* ------------------------------------------------------------------ *
 * Video / image export
 * ------------------------------------------------------------------ */

function ffmpegPath() {
  try {
    const bundled = require('ffmpeg-static')
    if (bundled && fs.existsSync(bundled)) return bundled
  } catch (err) {
    console.warn('[animate] ffmpeg-static unavailable:', err.message)
  }
  const unpacked = path.join(
    process.resourcesPath || '', 'app.asar.unpacked', 'node_modules', 'ffmpeg-static',
    process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg',
  )
  if (fs.existsSync(unpacked)) return unpacked
  return 'ffmpeg'
}

function safeFileName(name) {
  return String(name || 'Animation').replace(/[<>:"\\|?*\x00-\x1f]/g, '_').slice(0, 80) || 'Animation'
}

const EXPORT_FORMATS = {
  mp4: { ext: 'mp4', name: 'MP4 video', mime: 'video/mp4' },
  webm: { ext: 'webm', name: 'WebM video', mime: 'video/webm' },
  mkv: { ext: 'mkv', name: 'Matroska video', mime: 'video/x-matroska' },
  mov: { ext: 'mov', name: 'QuickTime movie', mime: 'video/quicktime' },
  avi: { ext: 'avi', name: 'AVI video', mime: 'video/x-msvideo' },
  gif: { ext: 'gif', name: 'Animated GIF', mime: 'image/gif' },
  apng: { ext: 'png', name: 'Animated PNG', mime: 'image/png' },
}

function ffmpegArgs(format, payload, inputPattern, output) {
  const q = Math.max(0, Math.min(100, payload.quality ?? 85))
  const h264Crf = Math.round(40 - q * 0.24)
  const vp9Crf = Math.round(45 - q * 0.35)
  const mpegQ = Math.round(31 - q * 0.29)
  const base = ['-y', '-framerate', String(payload.fps || 24), '-i', inputPattern]

  switch (format) {
    case 'mp4':
      return [...base, '-c:v', 'libx264', '-preset', 'medium', '-crf', String(h264Crf), '-pix_fmt', 'yuv420p', '-movflags', '+faststart', output]
    case 'mkv':
      return [...base, '-c:v', 'libx264', '-preset', 'medium', '-crf', String(h264Crf), '-pix_fmt', 'yuv420p', output]
    case 'mov':
      return [...base, '-c:v', 'libx264', '-preset', 'medium', '-crf', String(h264Crf), '-pix_fmt', 'yuv420p', output]
    case 'webm':
      return [...base, '-c:v', 'libvpx-vp9', '-crf', String(vp9Crf), '-b:v', '0', '-row-mt', '1', '-pix_fmt', 'yuv420p', output]
    case 'avi':
      return [...base, '-c:v', 'mpeg4', '-q:v', String(mpegQ), '-pix_fmt', 'yuv420p', output]
    case 'gif':
      return [...base, '-filter_complex', '[0:v]split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse', '-loop', String(payload.loop ?? 0), output]
    case 'apng':
      return [...base, '-c:v', 'apng', '-plays', String(payload.loop ?? 0), output]
    default:
      return [...base, output]
  }
}

function runFFmpeg(binary, args, totalSeconds, sender) {
  return new Promise((resolve, reject) => {
    // -progress is an output option, so insert it before the output filename.
    const withProgress = [...args.slice(0, -1), '-progress', 'pipe:1', '-nostats', args[args.length - 1]]
    const proc = spawn(binary, withProgress, { windowsHide: true })
    let stderr = ''
    const progress = (fraction) => {
      if (!sender.isDestroyed()) sender.send('export:progress', fraction)
    }
    proc.stderr.on('data', (chunk) => { stderr = (stderr + chunk.toString()).slice(-4000) })
    proc.stdout.on('data', (chunk) => {
      const match = chunk.toString().match(/out_time_ms=(\d+)/)
      if (match && totalSeconds > 0) {
        const fraction = Math.min(0.99, Number(match[1]) / 1e6 / totalSeconds)
        progress(fraction)
      }
    })
    proc.on('error', (err) => reject(new Error(`Could not start ffmpeg: ${err.message}`)))
    proc.on('close', (code) => {
      if (code === 0) { progress(1); resolve() }
      else reject(new Error(stderr.trim().split('\n').slice(-4).join('\n') || `ffmpeg exited with code ${code}`))
    })
  })
}

ipcMain.handle('export:video', async (event, payload) => {
  const format = String(payload.format || 'mp4')
  const safe = safeFileName(payload.name)
  const frames = payload.frames || []
  if (!frames.length) return { cancelled: false, message: 'There are no frames to export' }

  if (format === 'pngseq') {
    const picked = await dialog.showOpenDialog({
      title: 'Choose a folder for the image sequence',
      properties: ['openDirectory', 'createDirectory'],
    })
    if (picked.canceled) return { cancelled: true }
    const folder = picked.filePaths[0]
    try {
      for (let i = 0; i < frames.length; i++) {
        await fsp.writeFile(path.join(folder, `${safe}_${String(i).padStart(5, '0')}.png`), Buffer.from(frames[i]))
      }
      return { cancelled: false, path: folder }
    } catch (err) {
      return { cancelled: false, message: err.message }
    }
  }

  const spec = EXPORT_FORMATS[format]
  if (!spec) return { cancelled: false, message: `Unsupported format: ${format}` }

  const saved = await dialog.showSaveDialog({
    title: `Export ${spec.name}`,
    defaultPath: path.join(app.getPath('videos'), `${safe}.${spec.ext}`),
    filters: [{ name: spec.name, extensions: [spec.ext] }, { name: 'All files', extensions: ['*'] }],
  })
  if (saved.canceled) return { cancelled: true }
  const output = saved.filePath

  const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'animate-export-'))
  try {
    for (let i = 0; i < frames.length; i++) {
      await fsp.writeFile(path.join(tmp, `frame_${String(i).padStart(5, '0')}.png`), Buffer.from(frames[i]))
    }
    const stagedOutput = path.join(tmp, `output.${spec.ext}`)
    const args = ffmpegArgs(format, payload, path.join(tmp, 'frame_%05d.png'), stagedOutput)
    const seconds = frames.length / Math.max(1, payload.fps || 24)
    await runFFmpeg(ffmpegPath(), args, seconds, event.sender)
    // Only overwrite the user's chosen file after encoding succeeds.
    await fsp.copyFile(stagedOutput, output)
    return { cancelled: false, path: output }
  } catch (err) {
    console.error('[animate] export failed:', err.message)
    return { cancelled: false, message: err.message }
  } finally {
    try { await fsp.rm(tmp, { recursive: true, force: true }) } catch { /* ignore */ }
  }
})

app.whenReady().then(() => {
  protocol.registerFileProtocol('app', (request, callback) => {
    const urlPath = decodeURIComponent(request.url.replace(/^app:\/\//, '').split('?')[0])
    callback({ path: path.normalize(path.join(dist, urlPath || 'index.html')) })
  })
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
