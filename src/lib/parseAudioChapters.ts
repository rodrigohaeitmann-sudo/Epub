// Reads embedded chapter markers from an MP4/M4B audiobook file, without
// loading the whole file into memory. Supports two common layouts:
//   1. Nero "chpl" box inside moov/udta.
//   2. QuickTime chapter text track (referenced via tref/chap), used by iTunes.
import type { AudioChapter } from '../types'

const UTF8 = new TextDecoder('utf-8')

function boxType(dv: DataView, off: number): string {
  return String.fromCharCode(
    dv.getUint8(off),
    dv.getUint8(off + 1),
    dv.getUint8(off + 2),
    dv.getUint8(off + 3),
  )
}

function readU64(dv: DataView, off: number): number {
  return dv.getUint32(off) * 2 ** 32 + dv.getUint32(off + 4)
}

interface Box {
  type: string
  payload: number // offset of payload within the DataView
  end: number // offset just past this box
}

function* children(dv: DataView, start: number, end: number): Generator<Box> {
  let off = start
  while (off + 8 <= end) {
    let size = dv.getUint32(off)
    const type = boxType(dv, off + 4)
    let header = 8
    if (size === 1) {
      size = readU64(dv, off + 8)
      header = 16
    } else if (size === 0) {
      size = end - off
    }
    if (size < header || off + size > end) break
    yield { type, payload: off + header, end: off + size }
    off += size
  }
}

function findChild(dv: DataView, start: number, end: number, type: string): Box | null {
  for (const box of children(dv, start, end)) {
    if (box.type === type) return box
  }
  return null
}

async function sliceView(file: Blob, start: number, end: number): Promise<DataView> {
  const buf = await file.slice(start, Math.min(end, file.size)).arrayBuffer()
  return new DataView(buf)
}

// Scan top-level boxes to find the moov box (it may sit before or after mdat).
async function findMoov(file: Blob): Promise<{ start: number; size: number } | null> {
  let off = 0
  while (off + 8 <= file.size) {
    const head = await sliceView(file, off, off + 16)
    let size = head.getUint32(0)
    const type = boxType(head, 4)
    let header = 8
    if (size === 1) {
      size = readU64(head, 8)
      header = 16
    } else if (size === 0) {
      size = file.size - off
    }
    if (size < header) break
    if (type === 'moov') return { start: off, size }
    off += size
  }
  return null
}

function parseChpl(dv: DataView, box: Box): AudioChapter[] {
  let p = box.payload
  const version = dv.getUint8(p)
  p += 4 // version (1) + flags (3)
  if (version !== 0) p += 4 // reserved (version 1)
  const count = dv.getUint8(p)
  p += 1
  const chapters: AudioChapter[] = []
  for (let i = 0; i < count; i++) {
    if (p + 9 > box.end) break
    const start = readU64(dv, p) / 1e7 // 100ns units -> seconds
    p += 8
    const len = dv.getUint8(p)
    p += 1
    if (p + len > box.end) break
    const title = UTF8.decode(new DataView(dv.buffer, dv.byteOffset + p, len)).trim()
    p += len
    chapters.push({ title: title || `Capítulo ${i + 1}`, start })
  }
  return chapters
}

interface SampleTable {
  times: number[] // start time of each sample, in timescale units
  offsets: number[] // absolute file offset of each sample
  sizes: number[]
}

function parseStts(dv: DataView, box: Box): number[] {
  let p = box.payload + 4 // version + flags
  const entryCount = dv.getUint32(p)
  p += 4
  const times: number[] = []
  let t = 0
  for (let i = 0; i < entryCount; i++) {
    const count = dv.getUint32(p)
    const delta = dv.getUint32(p + 4)
    p += 8
    for (let k = 0; k < count; k++) {
      times.push(t)
      t += delta
    }
  }
  return times
}

function parseStsz(dv: DataView, box: Box): number[] {
  let p = box.payload + 4
  const sampleSize = dv.getUint32(p)
  const sampleCount = dv.getUint32(p + 4)
  p += 8
  const sizes: number[] = []
  if (sampleSize !== 0) {
    for (let i = 0; i < sampleCount; i++) sizes.push(sampleSize)
  } else {
    for (let i = 0; i < sampleCount; i++) {
      sizes.push(dv.getUint32(p))
      p += 4
    }
  }
  return sizes
}

function parseChunkOffsets(dv: DataView, stbl: Box): number[] {
  const stco = findChild(dv, stbl.payload, stbl.end, 'stco')
  const co64 = findChild(dv, stbl.payload, stbl.end, 'co64')
  const offsets: number[] = []
  if (stco) {
    let p = stco.payload + 4
    const n = dv.getUint32(p)
    p += 4
    for (let i = 0; i < n; i++) {
      offsets.push(dv.getUint32(p))
      p += 4
    }
  } else if (co64) {
    let p = co64.payload + 4
    const n = dv.getUint32(p)
    p += 4
    for (let i = 0; i < n; i++) {
      offsets.push(readU64(dv, p))
      p += 8
    }
  }
  return offsets
}

function parseStsc(dv: DataView, box: Box): { firstChunk: number; samplesPerChunk: number }[] {
  let p = box.payload + 4
  const n = dv.getUint32(p)
  p += 4
  const out: { firstChunk: number; samplesPerChunk: number }[] = []
  for (let i = 0; i < n; i++) {
    out.push({ firstChunk: dv.getUint32(p), samplesPerChunk: dv.getUint32(p + 4) })
    p += 12
  }
  return out
}

function buildSampleTable(dv: DataView, stbl: Box): SampleTable | null {
  const stts = findChild(dv, stbl.payload, stbl.end, 'stts')
  const stsz = findChild(dv, stbl.payload, stbl.end, 'stsz')
  const stsc = findChild(dv, stbl.payload, stbl.end, 'stsc')
  if (!stts || !stsz || !stsc) return null
  const times = parseStts(dv, stts)
  const sizes = parseStsz(dv, stsz)
  const chunkOffsets = parseChunkOffsets(dv, stbl)
  const stscEntries = parseStsc(dv, stsc)
  if (chunkOffsets.length === 0) return null

  const samplesPerChunk = new Array<number>(chunkOffsets.length).fill(0)
  for (let i = 0; i < stscEntries.length; i++) {
    const first = stscEntries[i].firstChunk
    const next = i + 1 < stscEntries.length ? stscEntries[i + 1].firstChunk : chunkOffsets.length + 1
    for (let c = first; c < next; c++) {
      if (c - 1 < samplesPerChunk.length) samplesPerChunk[c - 1] = stscEntries[i].samplesPerChunk
    }
  }

  const offsets: number[] = []
  let s = 0
  for (let c = 0; c < chunkOffsets.length; c++) {
    let off = chunkOffsets[c]
    for (let k = 0; k < samplesPerChunk[c]; k++) {
      if (s >= sizes.length) break
      offsets.push(off)
      off += sizes[s]
      s++
    }
  }
  return { times, offsets, sizes }
}

// Locate the QuickTime chapter text track inside moov and read its titles.
async function parseQuickTimeChapters(
  file: Blob,
  dv: DataView,
  moovPayload: number,
  moovEnd: number,
): Promise<AudioChapter[]> {
  for (const trak of children(dv, moovPayload, moovEnd)) {
    if (trak.type !== 'trak') continue
    const mdia = findChild(dv, trak.payload, trak.end, 'mdia')
    if (!mdia) continue
    const hdlr = findChild(dv, mdia.payload, mdia.end, 'hdlr')
    if (!hdlr) continue
    const handler = boxType(dv, hdlr.payload + 8) // after version/flags + pre_defined
    if (handler !== 'text' && handler !== 'sbtl') continue

    const mdhd = findChild(dv, mdia.payload, mdia.end, 'mdhd')
    if (!mdhd) continue
    const mdhdVersion = dv.getUint8(mdhd.payload)
    const timescale = dv.getUint32(mdhd.payload + (mdhdVersion === 1 ? 20 : 12))
    if (!timescale) continue

    const minf = findChild(dv, mdia.payload, mdia.end, 'minf')
    if (!minf) continue
    const stbl = findChild(dv, minf.payload, minf.end, 'stbl')
    if (!stbl) continue

    const table = buildSampleTable(dv, stbl)
    if (!table) continue

    const n = Math.min(table.times.length, table.offsets.length, table.sizes.length)
    const chapters: AudioChapter[] = []
    for (let i = 0; i < n; i++) {
      const size = table.sizes[i]
      if (size < 2 || size > 4096) continue
      const sample = await sliceView(file, table.offsets[i], table.offsets[i] + size)
      const len = sample.getUint16(0)
      const title = UTF8.decode(new DataView(sample.buffer, 2, Math.min(len, size - 2))).trim()
      chapters.push({
        title: title || `Capítulo ${i + 1}`,
        start: table.times[i] / timescale,
      })
    }
    if (chapters.length > 0) return chapters
  }
  return []
}

export async function parseAudioChapters(file: Blob): Promise<AudioChapter[]> {
  try {
    const moov = await findMoov(file)
    if (!moov) return []
    const moovBuf = await file.slice(moov.start, moov.start + moov.size).arrayBuffer()
    const dv = new DataView(moovBuf)
    const moovPayload = 8 // after moov header (assumes 32-bit size header)
    const moovEnd = moovBuf.byteLength

    const udta = findChild(dv, moovPayload, moovEnd, 'udta')
    if (udta) {
      const chpl = findChild(dv, udta.payload, udta.end, 'chpl')
      if (chpl) {
        const chapters = parseChpl(dv, chpl)
        if (chapters.length > 0) return chapters
      }
    }

    return await parseQuickTimeChapters(file, dv, moovPayload, moovEnd)
  } catch {
    return []
  }
}
