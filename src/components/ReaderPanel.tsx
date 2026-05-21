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
    <p className="para-en">
      {tokens.map((tok, i) =>
        HAS_LETTER.test(tok) ? (
          <button key={i} type="button" className="word" onClick={() => onWord(tok)}>
            {tok}
          </button>
        ) : (
          <span key={i}>{tok}</span>
        ),
      )}
    </p>
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
  const activeRef = useRef<HTMLDivElement>(null)

  // Center the active paragraph whenever it changes.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [activeParagraph, chapter?.id])

  if (!chapter) {
    return (
      <div className="reader">
        <p className="reader-empty">—</p>
      </div>
    )
  }

  return (
    <div className="reader">
      <h2 className="reader-chapter-title">{chapter.title}</h2>
      {status && <p className="reader-status">{status}</p>}
      {chapter.paragraphs.map((text, i) => {
        const isActive = i === activeParagraph
        return (
          <div
            key={i}
            ref={isActive ? activeRef : undefined}
            className={`para ${isActive ? 'para-active' : ''}`}
            onClick={() => onSelectParagraph(i)}
          >
            {toggles.en && <EnglishText text={text} onWord={setSelected} />}
            {toggles.pt && translation?.[i] && <p className="para-pt">{translation[i]}</p>}
          </div>
        )
      })}
      {selected && <WordPopup word={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
