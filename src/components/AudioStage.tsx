import type { RefObject } from 'react'
import type { Book } from '../types'

interface Props {
  audioRef: RefObject<HTMLAudioElement>
  src: string
  book: Book
  currentTime: number
  duration: number
  onSeek: (time: number) => void
  onBack: () => void
  onOpenChapters: () => void
  onOpenSettings: () => void
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const mm = h > 0 ? m.toString().padStart(2, '0') : String(m)
  return `${h > 0 ? h + ':' : ''}${mm}:${s.toString().padStart(2, '0')}`
}

export default function AudioStage({
  audioRef,
  src,
  book,
  currentTime,
  duration,
  onSeek,
  onBack,
  onOpenChapters,
  onOpenSettings,
}: Props) {
  return (
    <div className="audio-stage">
      <div className="stage-top">
        <button className="ov-btn" aria-label="Voltar" onClick={onBack}>
          ←
        </button>
        <div className="stage-actions">
          <button className="ov-btn" aria-label="Capítulos" onClick={onOpenChapters}>
            ☰
          </button>
          <button className="ov-btn" aria-label="Configurações" onClick={onOpenSettings}>
            ⚙
          </button>
        </div>
      </div>

      <div className="stage-cover">
        {book.coverUrl ? (
          <img src={book.coverUrl} alt={book.title} />
        ) : (
          <div className="stage-cover-fallback">{book.title.slice(0, 1).toUpperCase()}</div>
        )}
      </div>

      <div className="stage-meta">
        <div className="stage-title">{book.title}</div>
        {book.author && <div className="stage-author">{book.author}</div>}
      </div>

      <div className="stage-seek">
        <span className="time">{formatTime(currentTime)}</span>
        <input
          className="seek"
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={Math.min(currentTime, duration || 0)}
          onChange={(e) => onSeek(Number(e.target.value))}
        />
        <span className="time">{formatTime(duration)}</span>
      </div>

      <audio ref={audioRef} src={src} preload="metadata" />
    </div>
  )
}
