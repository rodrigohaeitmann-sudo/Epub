import type { AudioChapter } from '../types'

interface Props {
  chapters: AudioChapter[]
  currentTime: number
  onSelect: (start: number) => void
  onClose: () => void
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const mm = h > 0 ? m.toString().padStart(2, '0') : String(m)
  return `${h > 0 ? h + ':' : ''}${mm}:${s.toString().padStart(2, '0')}`
}

export default function AudioChapterNav({ chapters, currentTime, onSelect, onClose }: Props) {
  let current = -1
  for (let i = 0; i < chapters.length; i++) {
    if (chapters[i].start <= currentTime + 0.5) current = i
    else break
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Capítulos do áudio</h2>
          <button className="close-btn" aria-label="Fechar" onClick={onClose}>
            ✕
          </button>
        </div>
        <ul className="chapter-list">
          {chapters.map((c, i) => (
            <li key={i}>
              <button
                className={`chapter-item ${i === current ? 'chapter-item-on' : ''}`}
                onClick={() => onSelect(c.start)}
              >
                <span className="chapter-item-title">{c.title}</span>
                <span className="chapter-item-time">{formatTime(c.start)}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
