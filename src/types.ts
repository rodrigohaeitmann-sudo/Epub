export interface Chapter {
  id: string
  title: string
  paragraphs: string[]
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
}

export interface Settings {
  fontScale: number
  fontFamily: 'system' | 'serif' | 'mono'
  speed: number
}

export interface ReadingPos {
  chapter: number
  paragraph: number
}
