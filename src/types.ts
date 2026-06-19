export interface Chapter {
  id: string
  title: string
  paragraphs: string[]
}

export interface AudioChapter {
  title: string
  start: number // seconds
}

export interface Book {
  title: string
  author?: string
  coverUrl?: string
  chapters: Chapter[]
}

export type TrackKey = 'en' | 'pt'

export type Toggles = Record<TrackKey, boolean>

// PT translation per chapter, indexed by chapter id -> array aligned to paragraphs.
export type Translations = Record<string, string[]>

export interface LoadedBook {
  audioUrl: string
  bookId: string
  book: Book
  audioChapters: AudioChapter[]
}

export interface Settings {
  fontScale: number
  fontFamily: 'system' | 'serif' | 'mono'
  speed: number
  lineOffset: number // visual shift of the PT pane relative to the EN pane, in text lines
  sheetsUrl: string // Google Apps Script Web App endpoint for saved-word sync
}

export interface ReadingPos {
  chapter: number
  paragraph: number
}

export interface SavedWord {
  id: string
  text: string
  kind: 'word' | 'expression'
  ipa?: string
  translations?: string[]
  context?: string
  source?: string
  chapterTitle?: string
  savedAt: number
  sentAt?: number
}
