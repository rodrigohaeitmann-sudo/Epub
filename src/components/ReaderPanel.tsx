import { useEffect, useRef, useState } from 'react'
import type { Chapter, Toggles } from '../types'
import WordPopup from './WordPopup'

interface Props {
  chapter: Chapter | null
  translation?: string[]
  toggles: Toggles
  activeParagraph: number
  onSelectParagraph: (index: number) => void
  status?: string | null
}

const HAS_LETTER = /[a-zA-Z]/

function EnglishText({ text, onWord }: { text: string; onWord: (w: string) => void }) {
  const tokens = text.split(/(\s+)/)
  return (
    <>
      {tokens.map((tok, i) =>
        HAS_LETTER.test(tok) ? (
          <button key={i} type="button" className="word" onClick={() => onWord(tok)}>
            {tok}
          </button>
        ) : (
          <span key={i}>{tok}</span>
        ),
      )}
    </>
  )
}

export default function ReaderPanel({
  chapter,
  translation,
  toggles,
  activeParagraph,
  onSelectParagraph,
  status,
}: Props) {
  const [selected, setSelected] = useState<string | null>(null)
  const ptRef = useRef<HTMLDivElement>(null)
  const enRef = useRef<HTMLDivElement>(null)
  const ptParas = useRef<Array<HTMLDivElement | null>>([])
  const enParas = useRef<Array<HTMLDivElement | null>>([])
  const syncing = useRef(false)

  const showEn = toggles.en
  const showPt = toggles.pt
  const dual = showEn && showPt

  // Bring the active paragraph to the top of each visible pane.
  useEffect(() => {
    syncing.current = true
    const toTop = (pane: HTMLDivElement | null, el: HTMLElement | null | undefined) => {
      if (pane && el) pane.scrollTop = Math.max(0, el.offsetTop - 12)
    }
    if (showPt) toTop(ptRef.current, ptParas.current[activeParagraph])
    if (showEn) toTop(enRef.current, enParas.current[activeParagraph])
    const id = requestAnimationFrame(() => {
      syncing.current = false
    })
    return () => cancelAnimationFrame(id)
  }, [activeParagraph, chapter?.id, showEn, showPt, dual])

  // Keep both panes at the same relative scroll position.
  function handleSync(from: HTMLDivElement | null, to: HTMLDivElement | null) {
    if (!from || !to || syncing.current) return
    syncing.current = true
    const denom = from.scrollHeight - from.clientHeight
    const ratio = denom > 0 ? from.scrollTop / denom : 0
    to.scrollTop = ratio * (to.scrollHeight - to.clientHeight)
    requestAnimationFrame(() => {
      syncing.current = false
    })
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
            onScroll={dual ? () => handleSync(ptRef.current, enRef.current) : undefined}
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
          </div>
        )}

        {showEn && (
          <div
            className={`pane pane-en ${dual ? '' : 'pane-solo'}`}
            ref={enRef}
            onScroll={dual ? () => handleSync(enRef.current, ptRef.current) : undefined}
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
                  <EnglishText text={text} onWord={setSelected} />
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {selected && <WordPopup word={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
