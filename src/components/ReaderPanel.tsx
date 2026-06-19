import { useEffect, useRef, useState } from 'react'
import type { Chapter, Toggles } from '../types'
import { saveWord } from '../lib/savedWords'
import WordPopup from './WordPopup'

interface Props {
  chapter: Chapter | null
  translation?: string[]
  toggles: Toggles
  activeParagraph: number
  jumpKey: number
  lineOffset: number
  bookTitle?: string
  onChangeLineOffset: (n: number) => void
  onSelectParagraph: (index: number) => void
  onWordSaved?: () => void
  status?: string | null
}

const HAS_LETTER = /[a-zA-Z]/
const OVERLAY_HIDE_MS = 2800

// Drop surrounding punctuation/quotes, keep apostrophes/hyphens inside the word.
function cleanWord(tok: string): string {
  return tok.replace(/^[^\p{L}]+/u, '').replace(/[^\p{L}]+$/u, '')
}

function EnglishText({
  text,
  onWord,
}: {
  text: string
  onWord: (w: string, context: string) => void
}) {
  const tokens = text.split(/(\s+)/)
  return (
    <>
      {tokens.map((tok, i) =>
        HAS_LETTER.test(tok) ? (
          <button
            key={i}
            type="button"
            className="word"
            onClick={(e) => {
              // A short click counts as a word lookup; if the user is dragging
              // to select an expression, the parent selection handler takes over.
              const sel = window.getSelection()
              if (sel && sel.toString().trim().length > 1) return
              e.stopPropagation()
              onWord(cleanWord(tok), text)
            }}
          >
            {tok}
          </button>
        ) : (
          <span key={i}>{tok}</span>
        ),
      )}
    </>
  )
}

const formatOffset = (n: number) => (n > 0 ? `+${n}` : String(n))

export default function ReaderPanel({
  chapter,
  translation,
  toggles,
  activeParagraph,
  jumpKey,
  lineOffset,
  bookTitle,
  onChangeLineOffset,
  onSelectParagraph,
  onWordSaved,
  status,
}: Props) {
  const [selected, setSelected] = useState<string | null>(null)
  const [selectedContext, setSelectedContext] = useState<string | null>(null)
  const [overlayVisible, setOverlayVisible] = useState(false)
  const [expression, setExpression] = useState<string | null>(null)
  const [expressionSaved, setExpressionSaved] = useState(false)
  const ptRef = useRef<HTMLDivElement>(null)
  const enRef = useRef<HTMLDivElement>(null)
  const ptParas = useRef<Array<HTMLDivElement | null>>([])
  const enParas = useRef<Array<HTMLDivElement | null>>([])
  const syncing = useRef(false)
  const lastChapterId = useRef<string | null>(null)
  const lastJumpKey = useRef<number>(-1)
  const hideTimer = useRef<number | null>(null)
  const posTimer = useRef<number | null>(null)

  const showEn = toggles.en
  const showPt = toggles.pt
  const dual = showEn && showPt

  // Measure the rendered PT line-height so the offset is in actual text lines.
  function lineHeightPx(): number {
    const el = ptParas.current.find((p) => p) || enParas.current.find((p) => p)
    if (!el) return 24
    const lh = parseFloat(getComputedStyle(el).lineHeight)
    return Number.isFinite(lh) && lh > 0 ? lh : 24
  }

  function offsetPx(): number {
    return lineOffset * lineHeightPx()
  }

  // Two-way scroll sync between panes, with the PT pane offset by N lines.
  function syncFromEn() {
    const en = enRef.current
    const pt = ptRef.current
    if (!en || !pt || syncing.current) return
    syncing.current = true
    const enMax = en.scrollHeight - en.clientHeight
    const ptMax = pt.scrollHeight - pt.clientHeight
    const ratio = enMax > 0 ? en.scrollTop / enMax : 0
    pt.scrollTop = Math.max(0, Math.min(ptMax, ratio * ptMax + offsetPx()))
    requestAnimationFrame(() => {
      syncing.current = false
    })
  }

  function syncFromPt() {
    const en = enRef.current
    const pt = ptRef.current
    if (!en || !pt || syncing.current) return
    syncing.current = true
    const enMax = en.scrollHeight - en.clientHeight
    const ptMax = pt.scrollHeight - pt.clientHeight
    const ratio = ptMax > 0 ? (pt.scrollTop - offsetPx()) / ptMax : 0
    en.scrollTop = Math.max(0, Math.min(enMax, ratio * enMax))
    requestAnimationFrame(() => {
      syncing.current = false
    })
  }

  // Bring the active paragraph to the top of each pane on a chapter change OR
  // an explicit jump (chapter list, search). Plain paragraph clicks (word
  // lookup) leave jumpKey alone, so they only highlight without scrolling.
  useEffect(() => {
    if (!chapter) return
    const chapterChanged = lastChapterId.current !== chapter.id
    const jumped = lastJumpKey.current !== jumpKey
    if (!chapterChanged && !jumped) return
    lastChapterId.current = chapter.id
    lastJumpKey.current = jumpKey
    syncing.current = true
    const toTop = (
      pane: HTMLDivElement | null,
      el: HTMLElement | null | undefined,
      extra = 0,
    ) => {
      if (pane && el) pane.scrollTop = Math.max(0, el.offsetTop - 12 + extra)
    }
    if (showPt) toTop(ptRef.current, ptParas.current[activeParagraph], dual ? offsetPx() : 0)
    if (showEn) toTop(enRef.current, enParas.current[activeParagraph])
    const id = requestAnimationFrame(() => {
      syncing.current = false
    })
    return () => cancelAnimationFrame(id)
  }, [activeParagraph, chapter?.id, jumpKey, showEn, showPt, dual])

  // Re-apply the line offset (visually nudge PT) whenever it changes.
  useEffect(() => {
    if (!dual) return
    syncFromEn()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineOffset, dual])

  function reveal() {
    setOverlayVisible(true)
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = window.setTimeout(() => setOverlayVisible(false), OVERLAY_HIDE_MS)
  }

  useEffect(() => {
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current)
    }
  }, [])

  function adjust(delta: number) {
    onChangeLineOffset(lineOffset + delta)
    reveal()
  }

  // While the user scrolls, find the paragraph at the top of the viewport and
  // save it as the current reading position. Debounced so we only commit once
  // scrolling settles.
  function scheduleTrackPos() {
    if (posTimer.current != null) clearTimeout(posTimer.current)
    posTimer.current = window.setTimeout(() => {
      posTimer.current = null
      if (!chapter) return
      const enPane = enRef.current
      const ptPane = ptRef.current
      const pane = enPane || ptPane
      const paras = enPane ? enParas.current : ptParas.current
      if (!pane) return
      const target = pane.scrollTop + 13 // matches the toTop offset (12) plus 1px fuzz
      let topIdx = 0
      for (let i = 0; i < paras.length; i++) {
        const el = paras[i]
        if (!el) continue
        if (el.offsetTop > target) break
        topIdx = i
      }
      if (topIdx !== activeParagraph) onSelectParagraph(topIdx)
    }, 250)
  }

  // Cancel any pending position update when the chapter switches so we don't
  // overwrite the new chapter's restored position with the old one.
  useEffect(() => {
    if (posTimer.current != null) {
      clearTimeout(posTimer.current)
      posTimer.current = null
    }
  }, [chapter?.id])

  useEffect(() => {
    return () => {
      if (posTimer.current != null) clearTimeout(posTimer.current)
    }
  }, [])

  // Watch text selection inside the EN pane → show a floating Save bar.
  useEffect(() => {
    function onSel() {
      const sel = window.getSelection()
      if (!sel || sel.rangeCount === 0) {
        setExpression(null)
        return
      }
      const txt = sel.toString().trim()
      if (txt.length < 2) {
        setExpression(null)
        return
      }
      const en = enRef.current
      if (!en) return
      const node = sel.anchorNode
      if (!node || !en.contains(node instanceof Element ? node : node.parentNode!)) {
        setExpression(null)
        return
      }
      setExpression(txt)
      setExpressionSaved(false)
    }
    document.addEventListener('selectionchange', onSel)
    return () => document.removeEventListener('selectionchange', onSel)
  }, [])

  async function saveExpression() {
    if (!expression) return
    await saveWord({
      text: expression,
      kind: 'expression',
      source: bookTitle,
      chapterTitle: chapter?.title,
      context: expression,
    })
    setExpressionSaved(true)
    onWordSaved?.()
    window.setTimeout(() => {
      window.getSelection()?.removeAllRanges()
      setExpression(null)
      setExpressionSaved(false)
    }, 1100)
  }

  if (!chapter) {
    return (
      <div className="reader">
        <p className="reader-empty">—</p>
      </div>
    )
  }

  const paras = chapter.paragraphs
  ptParas.current = []
  enParas.current = []

  return (
    <div className="reader">
      <div className="reader-chapter-title">{chapter.title}</div>
      <div className="panes">
        {showPt && (
          <div
            className={`pane pane-pt ${dual ? '' : 'pane-solo'}`}
            ref={ptRef}
            onScroll={() => {
              if (dual) syncFromPt()
              scheduleTrackPos()
            }}
            onClick={dual ? reveal : undefined}
          >
            {status && <p className="reader-status">{status}</p>}
            {paras.map((_, i) => (
              <div
                key={i}
                ref={(el) => {
                  ptParas.current[i] = el
                }}
                className={`para ${i === activeParagraph ? 'para-active' : ''}`}
                onClick={() => onSelectParagraph(i)}
              >
                <p className="para-pt">{translation?.[i] ?? ''}</p>
              </div>
            ))}
            {dual && overlayVisible && (
              <div className="sync-overlay-wrap">
                <div
                  className="sync-overlay"
                  onClick={(e) => {
                    e.stopPropagation()
                    reveal()
                  }}
                >
                  <button
                    className="sync-btn"
                    aria-label="Retroceder uma linha"
                    onClick={() => adjust(-1)}
                  >
                    −
                  </button>
                  <span className="sync-value">{formatOffset(lineOffset)} linhas</span>
                  <button
                    className="sync-btn"
                    aria-label="Avançar uma linha"
                    onClick={() => adjust(1)}
                  >
                    +
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {showEn && (
          <div
            className={`pane pane-en ${dual ? '' : 'pane-solo'}`}
            ref={enRef}
            onScroll={() => {
              if (dual) syncFromEn()
              scheduleTrackPos()
            }}
          >
            {paras.map((text, i) => (
              <div
                key={i}
                ref={(el) => {
                  enParas.current[i] = el
                }}
                className={`para ${i === activeParagraph ? 'para-active' : ''}`}
                onClick={() => onSelectParagraph(i)}
              >
                <p className="para-en">
                  <EnglishText
                    text={text}
                    onWord={(w, ctx) => {
                      setSelected(w)
                      setSelectedContext(ctx)
                    }}
                  />
                </p>
              </div>
            ))}
            {expression && (
              <div className="expr-bar" onClick={(e) => e.stopPropagation()}>
                <span className="expr-bar-label">
                  {expressionSaved ? '✓ Expressão salva' : 'Trecho selecionado'}
                </span>
                <button
                  className="expr-bar-btn"
                  disabled={expressionSaved}
                  onClick={saveExpression}
                >
                  🔖 {expressionSaved ? 'Salva' : 'Salvar expressão'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {selected && (
        <WordPopup
          word={selected}
          context={selectedContext ?? undefined}
          source={bookTitle}
          chapterTitle={chapter?.title}
          onClose={() => {
            setSelected(null)
            setSelectedContext(null)
          }}
          onSaved={onWordSaved}
        />
      )}
    </div>
  )
}
