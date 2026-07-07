import type { Chapter, Translations } from '../types'

export interface BulkProgress {
  done: number
  total: number
  title: string
}

interface Props {
  chapters: Chapter[]
  current: number
  translations: Translations
  bulk: BulkProgress | null
  onTranslateAll: () => void
  onCancelBulk: () => void
  onSelect: (index: number) => void
  onClose: () => void
}

export default function ChapterNav({
  chapters,
  current,
  translations,
  bulk,
  onTranslateAll,
  onCancelBulk,
  onSelect,
  onClose,
}: Props) {
  const translated = chapters.filter((c) => translations[c.id]).length
  const remaining = chapters.length - translated
  const allDone = remaining === 0

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Capítulos</h2>
          <button className="close-btn" aria-label="Fechar" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="offline-box">
          <div className="offline-info">
            <span className="offline-title">Traduções offline</span>
            <span className="offline-meta">
              {translated} de {chapters.length} capítulos salvos no aparelho
            </span>
          </div>
          {bulk ? (
            <div className="offline-run">
              <div className="offline-bar">
                <div
                  className="offline-bar-fill"
                  style={{ width: `${bulk.total > 0 ? (bulk.done / bulk.total) * 100 : 0}%` }}
                />
              </div>
              <div className="offline-run-row">
                <span className="offline-run-label" title={bulk.title}>
                  Traduzindo {bulk.done + 1}/{bulk.total}: {bulk.title}
                </span>
                <button className="offline-cancel" onClick={onCancelBulk}>
                  Parar
                </button>
              </div>
            </div>
          ) : (
            <button className="offline-btn" disabled={allDone} onClick={onTranslateAll}>
              {allDone
                ? '✓ Todos os capítulos traduzidos'
                : `Traduzir ${remaining} capítulo${remaining === 1 ? '' : 's'} restante${remaining === 1 ? '' : 's'}`}
            </button>
          )}
        </div>

        <ul className="chapter-list">
          {chapters.map((c, i) => (
            <li key={c.id}>
              <button
                className={`chapter-item ${i === current ? 'chapter-item-on' : ''}`}
                onClick={() => onSelect(i)}
              >
                <span className="chapter-item-title">{c.title}</span>
                {translations[c.id] && (
                  <span className="chapter-item-done" title="Tradução salva no aparelho">
                    ✓
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
