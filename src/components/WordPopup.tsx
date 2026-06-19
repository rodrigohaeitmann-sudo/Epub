import { useEffect, useState } from 'react'
import { canSpeak, lookup, speak, type WordInfo } from '../lib/dictionary'
import { saveWord } from '../lib/savedWords'

interface Props {
  word: string
  context?: string
  source?: string
  chapterTitle?: string
  onClose: () => void
  onSaved?: () => void
}

export default function WordPopup({
  word,
  context,
  source,
  chapterTitle,
  onClose,
  onSaved,
}: Props) {
  const [info, setInfo] = useState<WordInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let alive = true
    setLoading(true)
    setInfo(null)
    setSaved(false)
    lookup(word)
      .then((res) => {
        if (alive) setInfo(res)
      })
      .catch(() => {
        if (alive) setInfo({ word, matched: null, ipa: null, translations: [] })
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [word])

  // Speak the word as soon as the popup opens.
  useEffect(() => {
    speak(word)
  }, [word])

  const display = info?.word || word.trim()

  async function handleSave() {
    if (saved) return
    await saveWord({
      text: display,
      kind: 'word',
      ipa: info?.ipa ?? undefined,
      translations: info?.translations ?? [],
      context,
      source,
      chapterTitle,
    })
    setSaved(true)
    onSaved?.()
  }

  return (
    <div className="word-sheet-backdrop" onClick={onClose}>
      <div className="word-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="word-sheet-grip" />
        <div className="word-sheet-head">
          <div className="word-sheet-term-block">
            <div className="word-sheet-term">{display}</div>
            {info?.ipa && <div className="word-sheet-ipa">/{info.ipa}/</div>}
          </div>
          {canSpeak() && (
            <button className="word-sheet-listen" onClick={() => speak(display)} aria-label="Ouvir">
              ♪ Ouvir
            </button>
          )}
        </div>

        {loading && <p className="word-sheet-status">Carregando…</p>}

        {!loading && info && info.translations.length > 0 && (
          <ul className="word-sheet-trans">
            {info.translations.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        )}

        {!loading && info && info.translations.length === 0 && (
          <p className="word-sheet-status">Tradução não encontrada no dicionário offline.</p>
        )}

        <p className="word-sheet-hint">
          💡 Selecione um trecho na legenda para salvar uma expressão inteira.
        </p>

        <div className="word-sheet-actions">
          <button
            className={`word-sheet-save ${saved ? 'word-sheet-save-on' : ''}`}
            onClick={handleSave}
            disabled={saved || loading}
          >
            {saved ? '✓ Salva' : '🔖 Salvar palavra'}
          </button>
          <button className="word-sheet-close" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
