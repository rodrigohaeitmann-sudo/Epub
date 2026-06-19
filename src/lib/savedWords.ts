import type { SavedWord } from '../types'

const DB_NAME = 'epub-saved-words'
const STORE = 'words'
const VERSION = 1

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' })
        store.createIndex('savedAt', 'savedAt')
        store.createIndex('sentAt', 'sentAt')
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode)
        const req = run(t.objectStore(STORE))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      }),
  )
}

function genId(): string {
  return `w_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export async function saveWord(input: Omit<SavedWord, 'id' | 'savedAt'>): Promise<SavedWord> {
  const word: SavedWord = { ...input, id: genId(), savedAt: Date.now() }
  await tx('readwrite', (s) => s.put(word))
  return word
}

export async function getAllWords(): Promise<SavedWord[]> {
  const all = await tx<SavedWord[]>('readonly', (s) => s.getAll() as IDBRequest<SavedWord[]>)
  return all.sort((a, b) => b.savedAt - a.savedAt)
}

export async function getPendingWords(): Promise<SavedWord[]> {
  const all = await getAllWords()
  return all.filter((w) => !w.sentAt)
}

export async function markSent(ids: string[], sentAt = Date.now()): Promise<void> {
  if (ids.length === 0) return
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction(STORE, 'readwrite')
    const store = t.objectStore(STORE)
    let remaining = ids.length
    for (const id of ids) {
      const req = store.get(id)
      req.onsuccess = () => {
        const w = req.result as SavedWord | undefined
        if (w) {
          w.sentAt = sentAt
          store.put(w)
        }
        if (--remaining === 0) resolve()
      }
      req.onerror = () => reject(req.error)
    }
  })
}

export interface SavedCounts {
  total: number
  pending: number
}

export async function getCounts(): Promise<SavedCounts> {
  const all = await getAllWords()
  return { total: all.length, pending: all.filter((w) => !w.sentAt).length }
}
