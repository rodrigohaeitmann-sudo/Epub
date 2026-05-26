import type { RefObject } from 'react'
import type { Book } from '../types'

interface Props {
  audioRef: RefObject<HTMLAudioElement>
  src: string
  book: Book
  currentTime: number
  duration: number
  hasAudioChapters: boolean
  onSeek: (time: number) => void
  onBack: () => void
  onOpenSearch: () => void
  onOpenChapters: () => void
  onOpenAudioChapters: () => void
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
  hasAudioChapters,
  onSeek,
  onBack,
  onOpenSearch,
  onOpenChapters,
  onOpenAudioChapters,
  onOpenSettings,
}: Props) {
  return (
    <div className="audio-stage">
      <div className="stage-top">
        <button className="ov-btn" aria-label="Voltar" onClick={onBack}>
          ←
        </button>
        <div className="stage-title" title={book.title}>
          {book.title}
        </div>
        <div className="stage-actions">
          <button className="ov-btn" aria-label="Buscar no texto" onClick={onOpenSearch}>
            🔍
          </button>
          {hasAudioChapters && (
            <button
              className="ov-btn"
              aria-label="Capítulos do áudio"
              onClick={onOpenAudioChapters}
            >
              🎧
            </button>
          )}
          <button className="ov-btn" aria-label="Capítulos do texto" onClick={onOpenChapters}>
            ☰
          </button>
          <button className="ov-btn" aria-label="Configurações" onClick={onOpenSettings}>
            ⚙
          </button>
        </div>
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
