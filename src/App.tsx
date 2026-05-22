import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { LoadedBook, ReadingPos, Settings, Toggles, TrackKey, Translations } from './types'
import { useAudio } from './hooks/useAudio'
import { loadSession, loadTranslations, saveTranslation } from './lib/sessionStore'
import { translateParagraphs } from './lib/translate'
import FileSetup from './components/FileSetup'
import AudioStage from './components/AudioStage'
import TextToggles from './components/TextToggles'
import ReaderPanel from './components/ReaderPanel'
import ControlsFooter from './components/ControlsFooter'
import ChapterNav from './components/ChapterNav'
import AudioChapterNav from './components/AudioChapterNav'
import SettingsPanel from './components/SettingsPanel'

const TOGGLES_KEY = 'epub.toggles'
const SETTINGS_KEY = 'epub.settings'
const DEFAULT_TOGGLES: Toggles = { en: true, pt: true }
const DEFAULT_SETTINGS: Settings = { fontScale: 1, fontFamily: 'system', speed: 1 }

const FONT_STACKS: Record<Settings['fontFamily'], string> = {
  system: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  mono: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
}

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw) return { ...fallback, ...JSON.parse(raw) }
  } catch {
    /* ignore */
  }
  return fallback
}

function loadPos(bookId?: string): ReadingPos {
  if (!bookId) return { chapter: 0, paragraph: 0 }
  try {
    const raw = localStorage.getItem(`epub.pos.${bookId}`)
    if (raw) return JSON.parse(raw)
  } catch {
    /* ignore */
  }
  return { chapter: 0, paragraph: 0 }
}

export default function App() {
  const [media, setMedia] = useState<LoadedBook | null>(null)
  const [restoring, setRestoring] = useState(true)
  const [toggles, setToggles] = useState<Toggles>(() => loadJson(TOGGLES_KEY, DEFAULT_TOGGLES))
  const [settings, setSettings] = useState<Settings>(() => loadJson(SETTINGS_KEY, DEFAULT_SETTINGS))
  const [pos, setPos] = useState<ReadingPos>({ chapter: 0, paragraph: 0 })
  const [translations, setTranslations] = useState<Translations>({})
  const [transStatus, setTransStatus] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [showChapters, setShowChapters] = useState(false)
  const [showAudioChapters, setShowAudioChapters] = useState(false)
  const inFlight = useRef<Set<string>>(new Set())

  const { audioRef, currentTime, duration, isPlaying, togglePlay, seekTo } = useAudio(media?.bookId)

  useEffect(() => {
    localStorage.setItem(TOGGLES_KEY, JSON.stringify(toggles))
  }, [toggles])

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  }, [settings])

  // Reopen the last session automatically (e.g. after the app is backgrounded).
  useEffect(() => {
    loadSession()
      .then((session) => {
        if (session) {
          const coverUrl = session.coverBlob
            ? URL.createObjectURL(session.coverBlob)
            : undefined
          setMedia({
            audioUrl: URL.createObjectURL(session.audioBlob),
            bookId: session.bookId,
            book: { ...session.book, coverUrl },
            audioChapters: session.audioChapters ?? [],
          })
        }
      })
      .catch(() => undefined)
      .finally(() => setRestoring(false))
  }, [])

  // Load reading position + cached translations whenever the book changes.
  useEffect(() => {
    const id = media?.bookId
    if (!id) return
    setPos(loadPos(id))
    loadTranslations(id)
      .then(setTranslations)
      .catch(() => setTranslations({}))
  }, [media?.bookId])

  useEffect(() => {
    const id = media?.bookId
    if (id) localStorage.setItem(`epub.pos.${id}`, JSON.stringify(pos))
  }, [pos, media?.bookId])

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = settings.speed
  }, [settings.speed, media?.bookId, audioRef])

  const chapters = media?.book.chapters ?? []
  const chapterIndex = Math.min(Math.max(pos.chapter, 0), Math.max(0, chapters.length - 1))
  const chapter = chapters[chapterIndex] ?? null
  const paraCount = chapter?.paragraphs.length ?? 0
  const paragraphIndex = Math.min(Math.max(pos.paragraph, 0), Math.max(0, paraCount - 1))

  // Translate the current chapter on demand when PT is enabled.
  useEffect(() => {
    if (!media || !toggles.pt || !chapter) {
      setTransStatus(null)
      return
    }
    if (translations[chapter.id]) {
      setTransStatus(null)
      return
    }
    if (inFlight.current.has(chapter.id)) return

    inFlight.current.add(chapter.id)
    setTransStatus('Preparando tradução…')
    translateParagraphs(
      chapter.paragraphs,
      (p) => setTransStatus(`Traduzindo… ${p.done}/${p.total}`),
      (loaded) => setTransStatus(`Baixando modelo de tradução… ${Math.round(loaded * 100)}%`),
    )
      .then((pt) => {
        setTranslations((t) => ({ ...t, [chapter.id]: pt }))
        void saveTranslation(media.bookId, chapter.id, pt).catch(() => {})
        setTransStatus(null)
      })
      .catch((e) => {
        setTransStatus(e instanceof Error ? e.message : 'Falha na tradução.')
      })
      .finally(() => {
        inFlight.current.delete(chapter.id)
      })
  }, [media, toggles.pt, chapter, translations])

  function handleToggle(key: TrackKey) {
    setToggles((t) => ({ ...t, [key]: !t[key] }))
  }

  function nextParagraph() {
    setPos((p) => {
      const ci = Math.min(Math.max(p.chapter, 0), chapters.length - 1)
      const count = chapters[ci]?.paragraphs.length ?? 0
      if (p.paragraph < count - 1) return { chapter: ci, paragraph: p.paragraph + 1 }
      if (ci < chapters.length - 1) return { chapter: ci + 1, paragraph: 0 }
      return p
    })
  }

  function prevParagraph() {
    setPos((p) => {
      const ci = Math.min(Math.max(p.chapter, 0), chapters.length - 1)
      if (p.paragraph > 0) return { chapter: ci, paragraph: p.paragraph - 1 }
      if (ci > 0) {
        const prevCount = chapters[ci - 1].paragraphs.length
        return { chapter: ci - 1, paragraph: Math.max(0, prevCount - 1) }
      }
      return p
    })
  }

  function goToChapter(i: number) {
    setPos({ chapter: i, paragraph: 0 })
    setShowChapters(false)
  }

  function selectParagraph(i: number) {
    setPos({ chapter: chapterIndex, paragraph: i })
  }

  function handleBack() {
    if (media) {
      URL.revokeObjectURL(media.audioUrl)
      if (media.book.coverUrl) URL.revokeObjectURL(media.book.coverUrl)
    }
    setMedia(null)
    setTranslations({})
  }

  if (restoring) {
    return <div className="splash" />
  }

  if (!media) {
    return <FileSetup onReady={setMedia} />
  }

  const stageStyle = {
    '--sub-scale': String(settings.fontScale),
    '--sub-font': FONT_STACKS[settings.fontFamily],
  } as CSSProperties

  return (
    <div className="player" style={stageStyle}>
      <AudioStage
        audioRef={audioRef}
        src={media.audioUrl}
        book={media.book}
        currentTime={currentTime}
        duration={duration}
        hasAudioChapters={media.audioChapters.length > 0}
        onSeek={seekTo}
        onBack={handleBack}
        onOpenChapters={() => setShowChapters(true)}
        onOpenAudioChapters={() => setShowAudioChapters(true)}
        onOpenSettings={() => setShowSettings(true)}
      />
      <TextToggles toggles={toggles} onToggle={handleToggle} />
      <ReaderPanel
        chapter={chapter}
        translation={chapter ? translations[chapter.id] : undefined}
        toggles={toggles}
        activeParagraph={paragraphIndex}
        onSelectParagraph={selectParagraph}
        status={transStatus}
      />
      <ControlsFooter
        isPlaying={isPlaying}
        onPrev={prevParagraph}
        onTogglePlay={togglePlay}
        onNext={nextParagraph}
      />
      {showChapters && (
        <ChapterNav
          chapters={chapters}
          current={chapterIndex}
          onSelect={goToChapter}
          onClose={() => setShowChapters(false)}
        />
      )}
      {showAudioChapters && (
        <AudioChapterNav
          chapters={media.audioChapters}
          currentTime={currentTime}
          onSelect={(start) => {
            seekTo(start)
            setShowAudioChapters(false)
          }}
          onClose={() => setShowAudioChapters(false)}
        />
      )}
      {showSettings && (
        <SettingsPanel
          settings={settings}
          onChange={setSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  )
}
