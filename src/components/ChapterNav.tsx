import type { Chapter } from '../types'

interface Props {
  chapters: Chapter[]
  current: number
  onSelect: (index: number) => void
  onClose: () => void
}

export default function ChapterNav({ chapters, current, onSelect, onClose }: Props) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Capítulos</h2>
          <button className="close-btn" aria-label="Fechar" onClick={onClose}>
            ✕
          </button>
        </div>
        <ul className="chapter-list">
          {chapters.map((c, i) => (
            <li key={c.id}>
              <button
                className={`chapter-item ${i === current ? 'chapter-item-on' : ''}`}
                onClick={() => onSelect(i)}
              >
                {c.title}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
