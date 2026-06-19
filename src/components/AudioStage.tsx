import type { RefObject } from 'react'
import type { AudioChapter, Book } from '../types'

interface Props {
  audioRef: RefObject<HTMLAudioElement>
  src: string
  book: Book
  currentTime: number
  duration: number
  audioChapters: AudioChapter[]
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

function formatRemaining(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0min'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}min`
  return `${m}min`
}

function currentChapterIdx(chapters: AudioChapter[], time: number): number {
  let idx = -1
  for (let i = 0; i < chapters.length; i++) {
    if (chapters[i].start <= time + 0.5) idx = i
    else break
  }
  return idx
}

export default function AudioStage({
  audioRef,
  src,
  book,
  currentTime,
  duration,
  audioChapters,
  onSeek,
  onBack,
  onOpenSearch,
  onOpenChapters,
  onOpenAudioChapters,
  onOpenSettings,
}: Props) {
  const hasChapters = audioChapters.length > 0
  const chapIdx = hasChapters ? currentChapterIdx(audioChapters, currentTime) : -1
  const chapter = chapIdx >= 0 ? audioChapters[chapIdx] : null
  const chapterStart = chapter ? chapter.start : 0
  const chapterEnd =
    chapter && chapIdx + 1 < audioChapters.length
      ? audioChapters[chapIdx + 1].start
      : duration || 0
  const chapterDuration = Math.max(0, chapterEnd - chapterStart)
  const chapterPos = Math.max(0, Math.min(chapterDuration, currentTime - chapterStart))

  const seekMax = chapter ? chapterDuration : duration || 0
  const seekValue = chapter ? chapterPos : Math.min(currentTime, duration || 0)
  const leftLabel = chapter ? formatTime(chapterPos) : formatTime(currentTime)
  const rightLabel = chapter ? formatTime(chapterDuration) : formatTime(duration)

  const pct = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0
  const remaining = duration > 0 ? Math.max(0, duration - currentTime) : 0

  return (
    <div className="audio-stage">
      <div className="stage-top">
        <button className="ov-btn" aria-label="Voltar" onClick={onBack}>
          ←
        </button>
        <div
          className="book-progress"
          role="img"
          aria-label={`${Math.round(pct)} por cento concluído, ${formatRemaining(remaining)} restantes de ${book.title}`}
        >
          <div className="book-progress-fill" style={{ width: `${pct}%` }} />
          <div className="book-progress-text">
            <span className="book-progress-pct">{Math.round(pct)}%</span>
            <span className="book-progress-rem">−{formatRemaining(remaining)}</span>
          </div>
        </div>
        <div className="stage-actions">
          <button className="ov-btn" aria-label="Buscar no texto" onClick={onOpenSearch}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <line x1="16.5" y1="16.5" x2="22" y2="22" />
            </svg>
          </button>
          {hasChapters && (
            <button
              className="ov-btn"
              aria-label="Capítulos do áudio"
              onClick={onOpenAudioChapters}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 18V6l12-2v12" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
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

      {chapter && (
        <div className="stage-chapter" title={chapter.title}>
          {chapter.title}
        </div>
      )}

      <div className="stage-seek">
        <span className="time">{leftLabel}</span>
        <input
          className="seek"
          type="range"
          min={0}
          max={seekMax}
          step={0.1}
          value={seekValue}
          onChange={(e) => onSeek(chapterStart + Number(e.target.value))}
        />
        <span className="time">{rightLabel}</span>
      </div>

      <audio ref={audioRef} src={src} preload="metadata" />
    </div>
  )
}
