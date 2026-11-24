/**
 * Imports David Revoy's CC0 Krita brush bundle as a real brush family.
 *
 * Source: https://www.davidrevoy.com/article1060/krita-brushes-2025-01-bundle
 * Direct: https://www.peppercarrot.com/extras/resources/deevad-bundle_25.01.zip
 *
 * .kpp presets are PNG containers. The preset XML lives in a compressed
 * zTXt/iTXt chunk and may embed the original brush tips as base64 resources.
 * We read the actual Krita settings, convert the embedded tips to grayscale
 * PNG masks, and emit a generated TypeScript manifest with no runtime fetch.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import zlib from 'node:zlib'
import crypto from 'node:crypto'

const URL = 'https://www.peppercarrot.com/extras/resources/deevad-bundle_25.01.zip'
const SHA256 = '4c628a9418fcde63abacafdcb143881f2cbbf907275cb4f72335545841cf8173'
const TEMP_DIR = path.resolve('node_modules/.cache/krita-import')
const OUT_DIR = path.resolve('src/assets/brushes/krita')
const MANIFEST = path.resolve('src/kritaBrushes.generated.ts')
const MAX_TIP = 128

/* ------------------------------- PNG / ZIP ------------------------------- */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([len, body, crc])
}

function encodeGrayPNG(width, height, gray) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 0
  const raw = Buffer.alloc((width + 1) * height)
  for (let y = 0; y < height; y++) {
    gray.copy(raw, y * (width + 1) + 1, y * width, y * width + width)
  }
  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

function paeth(a, b, c) {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  if (pa <= pb && pa <= pc) return a
  return pb <= pc ? b : c
}

/** Decodes the 8-bit PNG variants used by Krita's embedded brush tips. */
function decodePNG(buf) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  if (!buf.subarray(0, 8).equals(sig)) throw new Error('not a PNG')
  let offset = 8
  let ihdr = null
  let palette = null
  let trns = null
  const idat = []
  while (offset + 8 <= buf.length) {
    const len = buf.readUInt32BE(offset)
    const type = buf.toString('ascii', offset + 4, offset + 8)
    const data = buf.subarray(offset + 8, offset + 8 + len)
    if (type === 'IHDR') {
      ihdr = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        depth: data[8],
        color: data[9],
        interlace: data[12],
      }
    } else if (type === 'PLTE') palette = data
    else if (type === 'tRNS') trns = data
    else if (type === 'IDAT') idat.push(data)
    else if (type === 'IEND') break
    offset += 12 + len
  }
  if (!ihdr) throw new Error('PNG has no IHDR')
  if (ihdr.depth !== 8 || ihdr.interlace !== 0) throw new Error(`unsupported PNG depth/interlace ${ihdr.depth}/${ihdr.interlace}`)
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ihdr.color]
  if (!channels) throw new Error(`unsupported PNG colour type ${ihdr.color}`)
  const { width, height } = ihdr
  const stride = width * channels
  const raw = zlib.inflateSync(Buffer.concat(idat))
  if (raw.length < (stride + 1) * height) throw new Error('truncated PNG data')
  const rows = Buffer.alloc(stride * height)
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]
    const src = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride)
    const dst = rows.subarray(y * stride, y * stride + stride)
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? dst[x - channels] : 0
      const b = y > 0 ? rows[(y - 1) * stride + x] : 0
      const c = x >= channels && y > 0 ? rows[(y - 1) * stride + x - channels] : 0
      let v = src[x]
      if (filter === 1) v += a
      else if (filter === 2) v += b
      else if (filter === 3) v += Math.floor((a + b) / 2)
      else if (filter === 4) v += paeth(a, b, c)
      dst[x] = v & 0xff
    }
  }

  const out = Buffer.alloc(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const s = y * stride + x * channels
      const d = (y * width + x) * 4
      let r = 0, g = 0, b = 0, a = 255
      if (ihdr.color === 0) {
        r = g = b = rows[s]
        if (trns && rows.readUInt16BE(s) === trns.readUInt16BE(0)) a = 0
      } else if (ihdr.color === 2) {
        r = rows[s]; g = rows[s + 1]; b = rows[s + 2]
        if (trns && trns.length >= 6 && r === trns.readUInt16BE(0) && g === trns.readUInt16BE(2) && b === trns.readUInt16BE(4)) a = 0
      } else if (ihdr.color === 3) {
        const idx = rows[s]
        const p = idx * 3
        if (palette && p + 2 < palette.length) {
          r = palette[p]; g = palette[p + 1]; b = palette[p + 2]
        }
        if (trns && idx < trns.length) a = trns[idx]
      } else if (ihdr.color === 4) {
        r = g = b = rows[s]
        a = rows[s + 1]
      } else {
        r = rows[s]; g = rows[s + 1]; b = rows[s + 2]; a = rows[s + 3]
      }
      out[d] = r; out[d + 1] = g; out[d + 2] = b; out[d + 3] = a
    }
  }
  return { width, height, pixels: out }
}

/** Parses a GIMP brush header, including the longer header used inside .gih files. */
function parseGBR(buf, headerStart = 0) {
  if (headerStart + 28 > buf.length) return null
  const headerSize = buf.readUInt32BE(headerStart)
  const version = buf.readUInt32BE(headerStart + 4)
  const width = buf.readUInt32BE(headerStart + 8)
  const height = buf.readUInt32BE(headerStart + 12)
  const bytes = buf.readUInt32BE(headerStart + 16)
  if (headerSize < 28 || buf.toString('ascii', headerStart + 20, headerStart + 24) !== 'GIMP') return null
  if (width < 1 || height < 1 || width > 4096 || height > 4096 || ![1, 4].includes(bytes)) return null
  const start = headerStart + headerSize
  if (start + width * height * bytes > buf.length) return null
  const pixels = Buffer.alloc(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    const s = start + i * bytes
    const d = i * 4
    if (bytes === 1) {
      pixels[d] = pixels[d + 1] = pixels[d + 2] = buf[s]
      pixels[d + 3] = 255
    } else {
      pixels[d] = buf[s]
      pixels[d + 1] = buf[s + 1]
      pixels[d + 2] = buf[s + 2]
      pixels[d + 3] = buf[s + 3]
    }
  }
  return { width, height, pixels, version }
}

/** Finds the first valid GIMP brush image inside a Krita .gih brush. */
function parseGIH(buf) {
  const nl1 = buf.indexOf(10)
  const nl2 = buf.indexOf(10, nl1 + 1)
  if (nl2 < 0) return null
  const header = buf.subarray(0, nl2).toString('ascii')
  const cellWidth = Number(header.match(/cellwidth:(\d+)/)?.[1] || 0)
  const cellHeight = Number(header.match(/cellheight:(\d+)/)?.[1] || 0)
  const needle = Buffer.from('GIMP')
  let pos = nl2 + 1
  while ((pos = buf.indexOf(needle, pos)) >= 0) {
    const parsed = parseGBR(buf, pos - 20)
    if (parsed) return { ...parsed, cellWidth, cellHeight }
    pos += 4
  }
  return cellWidth && cellHeight ? { width: cellWidth, height: cellHeight, pixels: null } : null
}

function tipFromResource(buf, filename) {
  const ext = path.extname(filename).toLowerCase()
  if (ext === '.png') return decodePNG(buf)
  if (ext === '.gbr') return parseGBR(buf)
  if (ext === '.gih') return parseGIH(buf)
  return null
}

/** Converts RGBA pixels to a grayscale opacity mask and downsamples it. */
function grayscaleTip(tip, maxSize) {
  if (!tip?.pixels) return null
  const scale = Math.min(1, maxSize / Math.max(tip.width, tip.height))
  const nw = Math.max(1, Math.round(tip.width * scale))
  const nh = Math.max(1, Math.round(tip.height * scale))
  const out = Buffer.alloc(nw * nh)
  for (let y = 0; y < nh; y++) {
    const y0 = Math.floor((y * tip.height) / nh)
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * tip.height) / nh))
    for (let x = 0; x < nw; x++) {
      const x0 = Math.floor((x * tip.width) / nw)
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * tip.width) / nw))
      let sum = 0
      let count = 0
      for (let sy = y0; sy < y1; sy++) {
        for (let sx = x0; sx < x1; sx++) {
          const i = (sy * tip.width + sx) * 4
          const lum = (tip.pixels[i] * 0.299 + tip.pixels[i + 1] * 0.587 + tip.pixels[i + 2] * 0.114) / 255
          sum += lum * (tip.pixels[i + 3] / 255)
          count++
        }
      }
      out[y * nw + x] = Math.round(255 * (count ? sum / count : 0))
    }
  }
  return { width: nw, height: nh, gray: out }
}

function readZip(buf) {
  let eocd = -1
  const min = Math.max(0, buf.length - 66000)
  for (let i = buf.length - 22; i >= min; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break }
  }
  if (eocd < 0) throw new Error('not a ZIP archive')
  const count = buf.readUInt16LE(eocd + 10)
  let pos = buf.readUInt32LE(eocd + 16)
  const entries = new Map()
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(pos) !== 0x02014b50) throw new Error('bad ZIP central directory')
    const method = buf.readUInt16LE(pos + 10)
    const compressedSize = buf.readUInt32LE(pos + 20)
    const nameLen = buf.readUInt16LE(pos + 28)
    const extraLen = buf.readUInt16LE(pos + 30)
    const commentLen = buf.readUInt16LE(pos + 32)
    const local = buf.readUInt32LE(pos + 42)
    const name = buf.toString('utf8', pos + 46, pos + 46 + nameLen)
    entries.set(name, { method, compressedSize, local })
    pos += 46 + nameLen + extraLen + commentLen
  }
  return {
    names: [...entries.keys()],
    read(name) {
      const entry = entries.get(name)
      if (!entry) throw new Error(`ZIP entry not found: ${name}`)
      const p = entry.local
      const nameLen = buf.readUInt16LE(p + 26)
      const extraLen = buf.readUInt16LE(p + 28)
      const start = p + 30 + nameLen + extraLen
      const data = buf.subarray(start, start + entry.compressedSize)
      if (entry.method === 0) return Buffer.from(data)
      if (entry.method === 8) return zlib.inflateRawSync(data)
      throw new Error(`unsupported ZIP compression ${entry.method}`)
    },
  }
}

/* ------------------------------- KPP parse ------------------------------- */

function parseKPP(buf) {
  let offset = 8
  let xml = ''
  while (offset + 8 <= buf.length) {
    const len = buf.readUInt32BE(offset)
    const type = buf.toString('ascii', offset + 4, offset + 8)
    const data = buf.subarray(offset + 8, offset + 8 + len)
    if (type === 'zTXt' || type === 'iTXt') {
      let keyword = ''
      let payload = Buffer.alloc(0)
      let compressed = false
      if (type === 'zTXt') {
        const nul = data.indexOf(0)
        keyword = data.subarray(0, nul).toString('latin1')
        payload = data.subarray(nul + 2)
        compressed = true
      } else {
        const nul1 = data.indexOf(0)
        keyword = data.subarray(0, nul1).toString('latin1')
        let p = nul1 + 1
        compressed = data[p++] === 1
        p++ // compression method
        const nul2 = data.indexOf(0, p)
        p = nul2 + 1
        const nul3 = data.indexOf(0, p)
        p = nul3 + 1
        payload = data.subarray(p)
      }
      if (keyword === 'preset') {
        xml = (compressed ? zlib.inflateSync(payload) : payload).toString('utf8')
        break
      }
    }
    offset += 12 + len
  }
  if (!xml) throw new Error('no preset text chunk')

  const params = {}
  for (const m of xml.matchAll(/<param\b([^>]*)>([\s\S]*?)<\/param>/g)) {
    const name = m[1].match(/name="([^"]*)"/)?.[1]
    if (!name) continue
    const value = m[2]
      .replace(/^\s*<!\[CDATA\[/, '')
      .replace(/\]\]>\s*$/, '')
      .trim()
    params[name] = value
  }
  const resources = [...xml.matchAll(/<resource\b([^>]*)>([\s\S]*?)<\/resource>/g)].map((m) => {
    const attrs = Object.fromEntries([...m[1].matchAll(/(\w+)="([^"]*)"/g)].map((a) => [a[1], a[2]]))
    const data = m[2].replace(/^\s*<!\[CDATA\[/, '').replace(/\]\]>\s*$/, '').trim()
    return { ...attrs, data: Buffer.from(data, 'base64') }
  })
  const root = xml.match(/<Preset\b([^>]*)>/)?.[1] ?? ''
  return {
    name: root.match(/name="([^"]*)"/)?.[1] ?? 'Krita preset',
    paintop: root.match(/paintopid="([^"]*)"/)?.[1] ?? '',
    params,
    resources,
  }
}

const attrsOf = (text) =>
  Object.fromEntries([...(text || '').matchAll(/(\w+)="([^"]*)"/g)].map((m) => [m[1], m[2]]))

const num = (value, fallback) => {
  const n = Number.parseFloat(value)
  return Number.isFinite(n) ? n : fallback
}
const bool = (value) => String(value).toLowerCase() === 'true'
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const round = (v, digits = 4) => Number(v.toFixed(digits))

function textureFromName(name) {
  const n = name.toLowerCase()
  if (n.includes('canvas')) return 'canvas'
  if (n.includes('paper') || n.includes('grain')) return 'paper'
  if (n.includes('rock') || n.includes('snow')) return 'grit'
  if (n.includes('rough') || n.includes('scratch')) return 'rough'
  if (n.includes('fib') || n.includes('straw')) return 'fibrous'
  return undefined
}

function mapPreset(preset, tip, tipMask) {
  const p = preset.params
  const def = p.brush_definition || ''
  const brushAttrs = attrsOf(def.match(/<Brush\b([^>]*)>/)?.[1])
  const maskAttrs = attrsOf(def.match(/<MaskGenerator\b([^>]*)>/)?.[1])
  const lower = `${preset.name} ${brushAttrs.filename || ''}`.toLowerCase()
  const patternName = p['Texture/Pattern/Name'] || ''
  const textureName = `${patternName} ${lower}`

  const scale = num(brushAttrs.scale, 1) * num(p.SizeValue, 1)
  const diameter = num(maskAttrs.diameter || p['Brush/diameter'], 20)
  const sourceSize = tip ? Math.max(tip.width, tip.height) : diameter
  const size = clamp(sourceSize * scale, 2.5, 96)
  const spacing = clamp(num(brushAttrs.spacing || p['Brush/spacing'], 0.1), 0.01, 0.6)
  const opacity = clamp(num(p.OpacityValue, 1), 0.05, 1)
  const flow = clamp(num(p.FlowValue, 1), 0.05, 1)

  const softMask = maskAttrs.id === 'soft' || maskAttrs.type === 'soft'
  const fade = num(maskAttrs.hfade, 0)
  const softness = clamp(
    (softMask ? 0.8 : 0) + fade * 0.65 + num(p['Sharpness/softness'], 0) / 140,
    0,
    0.95,
  )
  const hardness = clamp(1 - softness * 0.75, 0.25, 1)

  const ratio = num(maskAttrs.ratio || p['Brush/aspect'], 1)
  const aspect = tip ? clamp(tip.height / tip.width, 0.12, 1) : clamp(ratio, 0.12, 1)
  const rotation = ((num(brushAttrs.angle, 0) * 180) / Math.PI) % 180

  const scatterRaw = num(p.ScatterValue, 0)
  const scatterEnabled = bool(p['Scattering/AxisX']) || bool(p['Scattering/AxisY'])
  const scatter = !scatterEnabled
    ? 0.02
    : clamp(scatterRaw >= 1 ? 0.02 : scatterRaw * 0.45, 0, 0.35)

  const bristleLike = !/airbrush/.test(lower) && /bristle|rake|streak|scratch|filler|impression|painterly|chisel/.test(lower)
  const softLike = /splat|sponge|debris|chalk|cloud|dotted/.test(lower)
  const bristles = Math.round(clamp(
    bristleLike ? 4 + num(brushAttrs.density, 1) * 3 : softLike ? 2 + num(brushAttrs.density, 1) : 1,
    1,
    12,
  ))

  const textureEnabled = bool(p['Texture/Pattern/Enabled'])
  const textureStrength = clamp(num(p['Texture/Strength/Value'], 1), 0, 1)
  const grain = clamp(
    textureEnabled ? 0.18 + textureStrength * 0.42 : /rock|chalk|rough|scratch|canvas|grain|textured/.test(textureName) ? 0.32 : 0.04,
    0,
    0.7,
  )

  const wetLike = /glaz|water|wet|model|wash/.test(lower)
  const pointy = /pointy|lineart|detail|pencil|thin/.test(lower)
  const streakLike = /bristle|rake|streak|scratch/.test(lower)

  return {
    size: round(size, 3),
    hardness: round(hardness),
    opacity: round(opacity),
    spacing: round(spacing),
    scatter: round(scatter),
    rotation: round(rotation, 2),
    bristles,
    flow: round(flow),
    grain: round(grain),
    taper: round(bool(p.PressureSize) ? (pointy ? 0.42 : 0.2) : 0.05),
    softness: round(softness),
    aspect: round(aspect),
    glow: 0,
    velocitySize: round(bool(p.PressureSize) ? 0.18 : 0),
    velocityOpacity: round(bool(p.PressureOpacity) ? 0.12 : 0),
    wetness: round(wetLike ? 0.28 : 0),
    irregularity: round(clamp((num(maskAttrs.spikes, 2) - 2) * 0.08 + (tip ? 0.22 : 0.08), 0, 0.65)),
    streak: round(streakLike ? 0.72 : 0),
    directionality: round(streakLike || /chisel|flat|tilt/.test(lower) ? 0.85 : 0.15),
    texture: textureFromName(textureName),
    ...(tipMask ? { stampImage: '__TIP__' } : {}),
  }
}

const slug = (value) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

/* --------------------------------- Input --------------------------------- */

async function loadSource() {
  const sourceArg = process.argv.indexOf('--source')
  if (sourceArg >= 0) {
    const dir = path.resolve(process.argv[sourceArg + 1])
    const presetDir = path.join(dir, 'paintoppresets')
    const files = (await fs.readdir(presetDir)).filter((f) => f.endsWith('.kpp')).sort()
    return {
      presets: files.map(async (name) => [name, await fs.readFile(path.join(presetDir, name))]),
      close() {},
      label: dir,
    }
  }

  await fs.mkdir(TEMP_DIR, { recursive: true })
  const zipPath = path.join(TEMP_DIR, 'deevad-bundle_25.01.zip')
  console.log('Downloading David Revoy CC0 Krita bundle…')
  const response = await fetch(URL)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const outer = Buffer.from(await response.arrayBuffer())
  const digest = crypto.createHash('sha256').update(outer).digest('hex')
  if (digest !== SHA256) throw new Error(`SHA256 mismatch: ${digest}`)
  await fs.writeFile(zipPath, outer)
  const outerZip = readZip(outer)
  const bundleName = outerZip.names.find((n) => n.endsWith('.bundle')) || outerZip.names.find((n) => n.endsWith('.zip'))
  if (!bundleName) throw new Error('bundle not found in downloaded archive')
  const bundle = outerZip.read(bundleName)
  const innerZip = readZip(bundle)
  const presets = innerZip.names.filter((n) => n.toLowerCase().endsWith('.kpp')).sort()
  return {
    presets: presets.map(async (name) => [path.basename(name), innerZip.read(name)]),
    close() {},
    label: URL,
  }
}

/* --------------------------------- Main ---------------------------------- */

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true })
  const source = await loadSource()
  const entries = []
  const writtenTips = new Set()
  let skipped = 0

  for (const pending of source.presets) {
    const [filename, buffer] = await pending
    let preset
    try {
      preset = parseKPP(buffer)
    } catch (e) {
      console.warn(`  skip ${filename}: ${e.message}`)
      skipped++
      continue
    }
    // Only real painting presets. Erasers, smudges, deform and experimental
    // paintops cannot be represented by the stroke renderer.
    if (
      preset.paintop !== 'paintbrush' ||
      bool(preset.params.EraserMode) ||
      /^a\)|eraser|smudge|blender|distort|shapes alchemy/i.test(preset.name)
    ) {
      skipped++
      continue
    }

    const def = preset.params.brush_definition || ''
    const brushAttrs = attrsOf(def.match(/<Brush\b([^>]*)>/)?.[1])
    const required = preset.params.requiredBrushFile || preset.params.requiredBrushFilesList?.split(',')[0] || ''
    const wanted = (brushAttrs.filename || required || '').replace(/^.*\//, '')
    const resource = preset.resources.find((r) => r.type === 'brushes' && r.filename === wanted) ||
      preset.resources.find((r) => r.type === 'brushes')
    let tip = null
    let tipMask = null
    if (resource) {
      try {
        tip = tipFromResource(resource.data, resource.filename)
        tipMask = grayscaleTip(tip, MAX_TIP)
      } catch (e) {
        console.warn(`  tip skipped for ${filename}: ${e.message}`)
      }
    }

    const params = mapPreset(preset, tip, tipMask)
    let tipImport = ''
    if (tipMask) {
      const tipName = `krita_${slug(wanted || preset.name)}.png`
      await fs.writeFile(path.join(OUT_DIR, tipName), encodeGrayPNG(tipMask.width, tipMask.height, tipMask.gray))
      writtenTips.add(tipName)
      const varName = `tip${entries.length}`
      tipImport = varName
      params.stampImage = varName
    }
    entries.push({ preset, params, tipImport, tipName: tipMask ? `krita_${slug(wanted || preset.name)}.png` : '' })
  }

  // Put the real pens and lineart brushes first so the default brush is not an
  // airbrush or a texture brush.
  const priority = (name) => {
    const n = name.toLowerCase()
    if (/lineart|pencil|pointy|detail|thin brush|thin basic/i.test(n)) return 0
    if (/bristle|glaz|round|water|wet/i.test(n)) return 1
    if (/splat|sponge|foliage|texture|charcoal|rake/i.test(n)) return 3
    return 2
  }
  entries.sort((a, b) => priority(a.preset.name) - priority(b.preset.name) || a.preset.name.localeCompare(b.preset.name))

  const imports = entries
    .filter((e) => e.tipImport)
    .map((e) => `import ${e.tipImport} from './assets/brushes/krita/${e.tipName}'`)
    .join('\n')
  const body = entries.map((e, i) => {
    const name = e.preset.name.replace(/ - deevad 25\.01$/, '')
    const params = { ...e.params }
    if (params.stampImage) params.stampImage = e.tipImport
    const paramLines = Object.entries(params)
      .map(([key, value]) => {
        // Tip imports must stay identifiers; quoting them makes Electron request
        // a bogus file called "tip6" instead of the bundled PNG asset.
        const encoded = key === 'stampImage' && e.tipImport && value === e.tipImport
          ? value
          : JSON.stringify(value)
        return `      ${key}: ${encoded},`
      })
      .join('\n')
    return `  {
    id: 'krita_cc0_${slug(name)}_${i + 1}',
    name: ${JSON.stringify(`Krita CC0 · ${name}`)},
    family: 'Krita CC0',
    description: 'CC0 Krita preset from David Revoy’s 2025-01 brush bundle.',
    params: {
${paramLines}
    },
  },`
  }).join('\n')
  const manifestSource = `// GENERATED FILE — do not edit. Run \`npm run import:krita\` to refresh.
// Brushes: David Revoy, CC0 1.0 — https://www.davidrevoy.com/article1060/krita-brushes-2025-01-bundle
import type { BrushPreset } from './brushes'
${imports}

export const KRITA_BRUSHES: BrushPreset[] = [
${body}
]
`
  await fs.writeFile(MANIFEST, manifestSource)
  console.log(`Done. ${entries.length} Krita presets (${writtenTips.size} real tips) from ${source.label}; skipped ${skipped}.`)
}

main().catch((e) => { console.error(e); process.exit(1) })
