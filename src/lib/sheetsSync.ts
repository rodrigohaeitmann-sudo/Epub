import type { SavedWord } from '../types'
import { getPendingWords, markSent } from './savedWords'

export interface SyncResult {
  sent: number
  total: number
  lastSyncedAt: number
}

const LAST_SYNC_KEY = 'epub.sheets.lastSync'

export function getLastSync(): number {
  const raw = localStorage.getItem(LAST_SYNC_KEY)
  const n = raw ? Number(raw) : 0
  return Number.isFinite(n) && n > 0 ? n : 0
}

function setLastSync(t: number) {
  localStorage.setItem(LAST_SYNC_KEY, String(t))
}

function toPayload(w: SavedWord) {
  return {
    id: w.id,
    text: w.text,
    kind: w.kind,
    ipa: w.ipa ?? '',
    translations: (w.translations ?? []).join(' / '),
    context: w.context ?? '',
    source: w.source ?? '',
    chapter: w.chapterTitle ?? '',
    savedAt: new Date(w.savedAt).toISOString(),
  }
}

export async function syncToSheets(url: string): Promise<SyncResult> {
  if (!url || !/^https:\/\//.test(url)) {
    throw new Error('Configure a URL do Apps Script primeiro.')
  }
  const pending = await getPendingWords()
  if (pending.length === 0) {
    const now = Date.now()
    setLastSync(now)
    return { sent: 0, total: 0, lastSyncedAt: now }
  }
  // text/plain avoids CORS preflight against Apps Script (which doesn't return
  // proper CORS headers for preflight even when "Anyone" is allowed).
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ words: pending.map(toPayload) }),
  })
  if (!res.ok) throw new Error(`Erro ${res.status} ao enviar para o Sheets.`)
  const body = await res.json().catch(() => ({}) as { ok?: boolean; error?: string })
  if (body && body.ok === false) {
    throw new Error(body.error || 'Resposta de erro do Apps Script.')
  }
  const now = Date.now()
  await markSent(
    pending.map((w) => w.id),
    now,
  )
  setLastSync(now)
  return { sent: pending.length, total: pending.length, lastSyncedAt: now }
}
