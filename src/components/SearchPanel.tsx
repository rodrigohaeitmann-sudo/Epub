import { useEffect, useMemo, useRef, useState } from 'react'
import type { Chapter } from '../types'

interface Snippet {
  before: string
  hit: string
  after: string
}

interface Match {
  chapterIdx: number
  paragraphIdx: number
  chapterTitle: string
  snippet: Snippet
}

interface Props {
  chapters: Chapter[]
  onSelect: (chapterIdx: number, paragraphIdx: number) => void
  onClose: () => void
}

const MAX_RESULTS = 80
const SNIPPET_CTX = 50

function buildSnippet(text: string, lowerText: string, q: string): Snippet | null {
  const idx = lowerText.indexOf(q)
  if (idx < 0) return null
  const start = Math.max(0, idx - SNIPPET_CTX)
  const end = Math.min(text.length, idx + q.length + SNIPPET_CTX)
  return {
    before: (start > 0 ? '… ' : '') + text.slice(start, idx),
    hit: text.slice(idx, idx + q.length),
    after: text.slice(idx + q.length, end) + (end < text.length ? ' …' : ''),
  }
}

export default function SearchPanel({ chapters, onSelect, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(query.trim().toLowerCase()), 150)
    return () => clearTimeout(id)
  }, [query])

  const results = useMemo<Match[]>(() => {
    if (debouncedQ.length < 2) return []
    const out: Match[] = []
    for (let ci = 0; ci < chapters.length && out.length < MAX_RESULTS; ci++) {
      const ch = chapters[ci]
      for (let pi = 0; pi < ch.paragraphs.length && out.length < MAX_RESULTS; pi++) {
        const text = ch.paragraphs[pi]
        const snippet = buildSnippet(text, text.toLowerCase(), debouncedQ)
        if (snippet) out.push({ chapterIdx: ci, paragraphIdx: pi, chapterTitle: ch.title, snippet })
      }
    }
    return out
  }, [chapters, debouncedQ])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-tall" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Buscar no texto</h2>
          <button className="close-btn" aria-label="Fechar" onClick={onClose}>
            ✕
          </button>
        </div>
        <input
          ref={inputRef}
          type="search"
          className="search-input"
          placeholder="Trecho ou palavra do audiobook…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />
        {debouncedQ.length >= 2 && (
          <p className="search-meta">
            {results.length === 0
              ? 'Nenhum resultado.'
              : `${results.length}${results.length === MAX_RESULTS ? '+' : ''} resultado${results.length === 1 ? '' : 's'}`}
          </p>
        )}
        <ul className="search-list">
          {results.map((r, i) => (
            <li key={i}>
              <button
                className="search-item"
                onClick={() => onSelect(r.chapterIdx, r.paragraphIdx)}
              >
                <span className="search-item-chapter">{r.chapterTitle}</span>
                <span className="search-item-snippet">
                  {r.snippet.before}
                  <mark>{r.snippet.hit}</mark>
                  {r.snippet.after}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
