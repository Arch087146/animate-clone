/**
 * Imports a curated set of CC0 GIMP brushes from
 * https://github.com/vascoalexander/gimp-brush-collection
 *
 * The upstream collection is dedicated to the public domain under CC0 1.0.
 * Each .gbr file is parsed (header + grayscale/RGBA mask), downsampled and
 * written as a PNG brush tip, then a generated TypeScript manifest is emitted
 * so the brushes are bundled by Vite with no runtime network access.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import zlib from 'node:zlib'

const REPO = 'https://raw.githubusercontent.com/vascoalexander/gimp-brush-collection/master'
const API = 'https://api.github.com/repos/vascoalexander/gimp-brush-collection/git/trees/master?recursive=1'
const COLLECTIONS = ['Aqua', 'Dots', 'Fibers', 'Fuzzy', 'Grain', 'Opaque', 'Organic', 'Shapes', 'Spiky', 'Spot', 'Strokes_Thick', 'Strokes_Thin']
const PER_COLLECTION = 12
const MAX_SIZE = 128
const OUT_DIR = path.resolve('src/assets/brushes')
const MANIFEST = path.resolve('src/cc0Brushes.generated.ts')

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

function encodePNG(width, height, gray) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8  // bit depth
  ihdr[9] = 0  // grayscale
  const raw = Buffer.alloc((width + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (width + 1)] = 0
    gray.copy(raw, y * (width + 1) + 1, y * width, y * width + width)
  }
  return Buffer.concat([sig, pngChunk('IHDR', ihdr), pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })), pngChunk('IEND', Buffer.alloc(0))])
}

function parseGBR(buf) {
  if (buf.length < 28) throw new Error('too short')
  const headerSize = buf.readUInt32BE(0)
  const version = buf.readUInt32BE(4)
  const width = buf.readUInt32BE(8)
  const height = buf.readUInt32BE(12)
  const bytes = buf.readUInt32BE(16)
  const magic = buf.toString('ascii', 20, Math.min(headerSize, 30))
  if (!magic.includes('GIMP')) throw new Error('not a GIMP brush')
  if (bytes !== 1 && bytes !== 4) throw new Error(`unsupported bpp ${bytes}`)
  const dataStart = headerSize
  const needed = width * height * bytes
  if (dataStart + needed > buf.length) throw new Error('truncated pixel data')
  return { width, height, bytes, dataStart, version }
}

function downsampleGray(buf, w, h, bpp, start, maxSize) {
  const scale = Math.min(1, maxSize / Math.max(w, h))
  const nw = Math.max(1, Math.round(w * scale))
  const nh = Math.max(1, Math.round(h * scale))
  const out = Buffer.alloc(nw * nh)
  const getGray = (x, y) => {
    const i = start + (y * w + x) * bpp
    return bpp === 1 ? buf[i] : Math.round((buf[i] * 0.299 + buf[i + 1] * 0.587 + buf[i + 2] * 0.114))
  }
  for (let y = 0; y < nh; y++) {
    const y0 = Math.floor(y * h / nh)
    const y1 = Math.max(y0 + 1, Math.floor((y + 1) * h / nh))
    for (let x = 0; x < nw; x++) {
      const x0 = Math.floor(x * w / nw)
      const x1 = Math.max(x0 + 1, Math.floor((x + 1) * w / nw))
      let sum = 0
      let count = 0
      for (let sy = y0; sy < y1; sy++) {
        for (let sx = x0; sx < x1; sx++) {
          sum += getGray(sx, sy)
          count++
        }
      }
      out[y * nw + x] = count ? Math.round(sum / count) : 0
    }
  }
  return { width: nw, height: nh, gray: out }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function fetchWithRetry(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return Buffer.from(await res.arrayBuffer())
    } catch (e) {
      if (i === tries - 1) throw e
      await sleep(400 * (i + 1))
    }
  }
}

const humanize = (name) => name
  .replace(/\.gbr$/i, '')
  .replace(/[_-]+/g, ' ')
  .replace(/\b\w/g, (c) => c.toUpperCase())
  .trim()

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true })
  console.log('Fetching upstream brush list…')
  const tree = await (await fetch(API)).json()
  const selected = []
  for (const col of COLLECTIONS) {
    const files = tree.tree
      .filter((e) => e.path.startsWith(`${col}/`) && e.path.toLowerCase().endsWith('.gbr'))
      .sort((a, b) => a.path.localeCompare(b.path))
    const stride = Math.max(1, Math.floor(files.length / PER_COLLECTION))
    const picks = []
    for (let i = 0; i < files.length && picks.length < PER_COLLECTION; i += stride) picks.push(files[i])
    selected.push(...picks)
    console.log(`  ${col}: ${picks.length} of ${files.length}`)
  }
  console.log(`Converting ${selected.length} CC0 brushes…`)

  const manifest = []
  let ok = 0
  for (let i = 0; i < selected.length; i++) {
    const file = selected[i]
    const id = file.path.replace(/[^\w]+/g, '_').replace(/_gbr$/i, '').toLowerCase()
    const outName = `${id}.png`
    try {
      const buf = await fetchWithRetry(`${REPO}/${encodeURI(file.path)}`)
      const gbr = parseGBR(buf)
      const img = downsampleGray(buf, gbr.width, gbr.height, gbr.bytes, gbr.dataStart, MAX_SIZE)
      await fs.writeFile(path.join(OUT_DIR, outName), encodePNG(img.width, img.height, img.gray))
      manifest.push({
        id: `cc0_${id}`,
        name: humanize(file.path.split('/')[1]),
        collection: file.path.split('/')[0],
        file: outName,
        spacing: 0.08,
      })
      ok++
      if ((i + 1) % 12 === 0) console.log(`  ${i + 1}/${selected.length}`)
    } catch (e) {
      console.warn(`  skip ${file.path}: ${e.message}`)
    }
  }

  const imports = manifest.map((b, i) => `import tip${i} from './assets/brushes/${b.file}'`).join('\n')
  const entries = manifest.map((b, i) => `  {
    id: '${b.id}',
    name: 'CC0 ${b.collection.replace(/_/g, ' ')} · ${b.name}',
    family: 'CC0',
    description: 'Public-domain GIMP brush tip from the Vasco Alexander CC0 collection.',
    params: {
      size: 42, hardness: 0.9, opacity: 0.9, spacing: ${b.spacing}, scatter: 0.02,
      rotation: 0, bristles: 1, flow: 0.9, grain: 0, taper: 0.15, softness: 0.15,
      aspect: 1, glow: 0, stampImage: tip${i},
    },
  },`).join('\n')
  const source = `// GENERATED FILE — do not edit. Run \`npm run import:brushes\` to refresh.\nimport type { BrushPreset } from './brushes'\n${imports}\n\nexport const CC0_BRUSHES: BrushPreset[] = [\n${entries}\n]\n`
  await fs.writeFile(MANIFEST, source)
  console.log(`Done. ${ok} brushes written, manifest: ${MANIFEST}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
