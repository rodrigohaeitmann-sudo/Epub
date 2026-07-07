import { useState } from 'react'
import type { LoadedBook } from '../types'
import { parseEpub } from '../lib/parseEpub'
import { parseAudioChapters } from '../lib/parseAudioChapters'
import { saveSession } from '../lib/sessionStore'

interface Props {
  onReady: (media: LoadedBook) => void
  // True when a previous session existed but the browser evicted its storage.
  lostSession?: boolean
}

export default function FileSetup({ onReady, lostSession }: Props) {
  const [epub, setEpub] = useState<File | null>(null)
  const [audio, setAudio] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const canStart = epub !== null && audio !== null && !busy

  async function handleStart() {
    if (!epub || !audio) return
    setError('')
    setBusy(true)
    try {
      const parsed = await parseEpub(await epub.arrayBuffer())
      const audioChapters = await parseAudioChapters(audio).catch(() => [])
      const bookId = `${epub.name}:${epub.size}`
      const coverUrl = parsed.coverBlob ? URL.createObjectURL(parsed.coverBlob) : undefined
      const book = {
        title: parsed.title,
        author: parsed.author,
        coverUrl,
        chapters: parsed.chapters,
      }
      // Persist BEFORE handing off so the session survives an immediate
      // close/reload. Audiobook blobs can be large; do it in-band so the user
      // sees the player only after the data is durably in IndexedDB.
      try {
        await saveSession({
          bookId,
          audioBlob: audio,
          coverBlob: parsed.coverBlob,
          book: { title: parsed.title, author: parsed.author, chapters: parsed.chapters },
          audioChapters,
        })
      } catch {
        /* ignore — best-effort persistence */
      }
      onReady({ audioUrl: URL.createObjectURL(audio), bookId, book, audioChapters })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao ler o EPUB.')
      setBusy(false)
    }
  }

  return (
    <div className="setup">
      <h1>Leitor de Audiobook</h1>
      <p className="setup-hint">
        Selecione um EPUB em inglês e o áudio do audiobook. A tradução em português é
        gerada dentro do app conforme você lê.
      </p>

      {lostSession && (
        <p className="setup-lost">
          O navegador apagou os arquivos da sessão anterior para liberar espaço. Carregue o
          livro e o áudio novamente — para evitar que isso se repita, instale o app na tela
          inicial (Compartilhar → Adicionar à Tela de Início) e mantenha espaço livre no
          aparelho.
        </p>
      )}

      <label className="file-field">
        <span>Livro (.epub)</span>
        <input
          type="file"
          accept=".epub,application/epub+zip"
          onChange={(e) => setEpub(e.target.files?.[0] ?? null)}
        />
        {epub && <small>{epub.name}</small>}
      </label>

      <label className="file-field">
        <span>Áudio do audiobook</span>
        <input
          type="file"
          accept="audio/*"
          onChange={(e) => setAudio(e.target.files?.[0] ?? null)}
        />
        {audio && <small>{audio.name}</small>}
      </label>

      {error && <p className="setup-error">{error}</p>}

      <button className="start-btn" disabled={!canStart} onClick={handleStart}>
        {busy ? 'Preparando…' : 'Começar'}
      </button>
    </div>
  )
}
