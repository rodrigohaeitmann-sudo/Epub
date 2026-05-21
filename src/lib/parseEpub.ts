import { unzipSync, strFromU8 } from 'fflate'
import type { Chapter } from '../types'

export interface ParsedEpub {
  title: string
  author?: string
  coverBlob?: Blob
  chapters: Chapter[]
}

type Files = Record<string, Uint8Array>

const BLOCK_SELECTOR = 'h1,h2,h3,h4,h5,h6,p,li,blockquote'

function dirname(path: string): string {
  const i = path.lastIndexOf('/')
  return i === -1 ? '' : path.slice(0, i + 1)
}

// Resolve an href (relative to `baseDir`) into a normalized zip key.
function resolvePath(baseDir: string, href: string): string {
  const rel = href.split('#')[0]
  const parts = (baseDir + rel).split('/')
  const out: string[] = []
  for (const part of parts) {
    if (part === '..') out.pop()
    else if (part !== '.' && part !== '') out.push(part)
  }
  return out.join('/')
}

function getFile(files: Files, path: string): Uint8Array | undefined {
  if (files[path]) return files[path]
  try {
    const decoded = decodeURIComponent(path)
    if (files[decoded]) return files[decoded]
  } catch {
    /* ignore */
  }
  // Last resort: case-insensitive match.
  const lower = path.toLowerCase()
  const key = Object.keys(files).find((k) => k.toLowerCase() === lower)
  return key ? files[key] : undefined
}

function readText(files: Files, path: string): string {
  const data = getFile(files, path)
  return data ? strFromU8(data) : ''
}

function parseXml(text: string): Document {
  return new DOMParser().parseFromString(text, 'application/xml')
}

function findOpfPath(files: Files): string {
  const container = readText(files, 'META-INF/container.xml')
  const doc = parseXml(container)
  const rootfile = doc.querySelector('rootfile')
  const fullPath = rootfile?.getAttribute('full-path')
  if (!fullPath) throw new Error('EPUB inválido: container.xml sem rootfile')
  return fullPath
}

function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

function extractParagraphs(html: string): string[] {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const blocks = Array.from(doc.body?.querySelectorAll(BLOCK_SELECTOR) ?? [])
  // Keep only "leaf" blocks so a blockquote/li wrapping <p> isn't counted twice.
  const leaves = blocks.filter((el) => !blocks.some((o) => o !== el && el.contains(o)))
  const source = leaves.length > 0 ? leaves : doc.body ? [doc.body] : []
  const out: string[] = []
  for (const el of source) {
    const text = normalizeWhitespace(el.textContent ?? '')
    if (text) out.push(text)
  }
  return out
}

function firstHeading(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const h = doc.querySelector('h1,h2,h3,h4,h5,h6,title')
  return normalizeWhitespace(h?.textContent ?? '')
}

// Map of spine-document path -> human title, from the EPUB nav (toc.ncx or nav.xhtml).
function buildTocTitles(files: Files, opfDir: string, opf: Document): Map<string, string> {
  const titles = new Map<string, string>()

  // EPUB 2: toc.ncx referenced from spine[@toc] -> manifest item.
  const tocId = opf.querySelector('spine')?.getAttribute('toc')
  const manifestItems = Array.from(opf.querySelectorAll('manifest > item'))
  const ncxItem = tocId
    ? manifestItems.find((it) => it.getAttribute('id') === tocId)
    : manifestItems.find((it) => it.getAttribute('media-type') === 'application/x-dtbncx+xml')
  if (ncxItem) {
    const ncxPath = resolvePath(opfDir, ncxItem.getAttribute('href') || '')
    const ncx = parseXml(readText(files, ncxPath))
    for (const np of Array.from(ncx.querySelectorAll('navPoint'))) {
      const src = np.querySelector('content')?.getAttribute('src')
      const label = normalizeWhitespace(np.querySelector('navLabel > text')?.textContent ?? '')
      if (src && label) titles.set(resolvePath(dirname(ncxPath), src), label)
    }
  }

  // EPUB 3: nav document (item with properties="nav").
  const navItem = manifestItems.find((it) =>
    (it.getAttribute('properties') || '').split(/\s+/).includes('nav'),
  )
  if (navItem) {
    const navPath = resolvePath(opfDir, navItem.getAttribute('href') || '')
    const nav = new DOMParser().parseFromString(readText(files, navPath), 'text/html')
    for (const a of Array.from(nav.querySelectorAll('nav a[href]'))) {
      const href = a.getAttribute('href') || ''
      const label = normalizeWhitespace(a.textContent ?? '')
      if (href && label) titles.set(resolvePath(dirname(navPath), href), label)
    }
  }

  return titles
}

function findCover(
  files: Files,
  opfDir: string,
  opf: Document,
): { data: Uint8Array; type: string } | undefined {
  const items = Array.from(opf.querySelectorAll('manifest > item'))
  let coverItem = items.find((it) =>
    (it.getAttribute('properties') || '').split(/\s+/).includes('cover-image'),
  )
  if (!coverItem) {
    const metaCover = opf.querySelector('metadata > meta[name="cover"]')?.getAttribute('content')
    if (metaCover) coverItem = items.find((it) => it.getAttribute('id') === metaCover)
  }
  if (!coverItem) return undefined
  const href = coverItem.getAttribute('href')
  if (!href) return undefined
  const data = getFile(files, resolvePath(opfDir, href))
  if (!data) return undefined
  return { data, type: coverItem.getAttribute('media-type') || 'image/jpeg' }
}

export async function parseEpub(buffer: ArrayBuffer): Promise<ParsedEpub> {
  const files = unzipSync(new Uint8Array(buffer))

  const opfPath = findOpfPath(files)
  const opfDir = dirname(opfPath)
  const opf = parseXml(readText(files, opfPath))

  const title =
    normalizeWhitespace(opf.querySelector('metadata title')?.textContent ?? '') || 'Sem título'
  const author =
    normalizeWhitespace(opf.querySelector('metadata creator')?.textContent ?? '') || undefined

  const idToHref = new Map<string, string>()
  for (const item of Array.from(opf.querySelectorAll('manifest > item'))) {
    const id = item.getAttribute('id')
    const href = item.getAttribute('href')
    if (id && href) idToHref.set(id, href)
  }

  const tocTitles = buildTocTitles(files, opfDir, opf)

  const chapters: Chapter[] = []
  const spineRefs = Array.from(opf.querySelectorAll('spine > itemref'))
  let n = 0
  for (const ref of spineRefs) {
    const idref = ref.getAttribute('idref')
    if (!idref) continue
    const href = idToHref.get(idref)
    if (!href) continue
    const path = resolvePath(opfDir, href)
    const html = readText(files, path)
    if (!html) continue
    const paragraphs = extractParagraphs(html)
    if (paragraphs.length === 0) continue
    n += 1
    const chapterTitle =
      tocTitles.get(path) || firstHeading(html) || `Capítulo ${n}`
    chapters.push({ id: path, title: chapterTitle, paragraphs })
  }

  if (chapters.length === 0) throw new Error('Não encontrei texto legível no EPUB.')

  const cover = findCover(files, opfDir, opf)
  const coverBlob = cover
    ? new Blob([cover.data as unknown as BlobPart], { type: cover.type })
    : undefined

  return { title, author, coverBlob, chapters }
}
