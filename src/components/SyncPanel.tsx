import { useEffect, useState } from 'react'
import type { SavedWord } from '../types'
import { getAllWords, getCounts } from '../lib/savedWords'
import { getLastSync, syncToSheets } from '../lib/sheetsSync'

interface Props {
  sheetsUrl: string
  onChangeUrl: (url: string) => void
  onClose: () => void
  onChanged?: () => void
}

function formatLastSync(t: number): { abs: string; rel: string } {
  if (!t) return { abs: 'Nunca sincronizado', rel: '' }
  const d = new Date(t)
  const hh = d.getHours().toString().padStart(2, '0')
  const mm = d.getMinutes().toString().padStart(2, '0')
  const today = new Date()
  const sameDay =
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  const dayLabel = sameDay ? 'Hoje' : `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`
  const abs = `${dayLabel}, ${hh}:${mm}`
  const diff = Date.now() - t
  const mins = Math.floor(diff / 60000)
  let rel = ''
  if (mins < 1) rel = 'agora'
  else if (mins < 60) rel = `há ${mins} min`
  else if (mins < 60 * 24) rel = `há ${Math.floor(mins / 60)} h`
  else rel = `há ${Math.floor(mins / 1440)} d`
  return { abs, rel }
}

export default function SyncPanel({ sheetsUrl, onChangeUrl, onClose, onChanged }: Props) {
  const [urlDraft, setUrlDraft] = useState(sheetsUrl)
  const [words, setWords] = useState<SavedWord[]>([])
  const [counts, setCounts] = useState({ total: 0, pending: 0 })
  const [lastSync, setLastSync] = useState<number>(getLastSync())
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  async function refresh() {
    const all = await getAllWords()
    setWords(all)
    setCounts(await getCounts())
    setLastSync(getLastSync())
  }

  useEffect(() => {
    void refresh()
  }, [])

  useEffect(() => {
    setUrlDraft(sheetsUrl)
  }, [sheetsUrl])

  async function handlePaste() {
    try {
      const t = await navigator.clipboard.readText()
      if (t) setUrlDraft(t.trim())
    } catch {
      setMsg({ kind: 'err', text: 'Não foi possível ler da área de transferência.' })
    }
  }

  function handleSaveUrl() {
    const trimmed = urlDraft.trim()
    onChangeUrl(trimmed)
    setMsg({ kind: 'ok', text: 'URL salva.' })
  }

  async function handleSync() {
    setMsg(null)
    setBusy(true)
    try {
      const result = await syncToSheets(sheetsUrl)
      await refresh()
      onChanged?.()
      setMsg({
        kind: 'ok',
        text:
          result.sent > 0
            ? `${result.sent} palavra${result.sent === 1 ? '' : 's'} enviada${result.sent === 1 ? '' : 's'}.`
            : 'Nada pendente para enviar.',
      })
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Falha na sincronização.' })
    } finally {
      setBusy(false)
    }
  }

  const connected = !!sheetsUrl
  const last = formatLastSync(lastSync)
  const recent = words.slice(0, 12)

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-tall" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Sincronização</h2>
          <button className="close-btn" aria-label="Fechar" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="sync-status">
          <div className="sync-status-line">
            <span className={`sync-dot ${connected ? 'sync-dot-on' : 'sync-dot-off'}`} />
            <span className={`sync-state ${connected ? 'sync-state-on' : 'sync-state-off'}`}>
              {connected ? 'Conectado' : 'Não configurado'}
            </span>
          </div>
          <div className="sync-last-label">Última sincronização</div>
          <div className="sync-last-value">
            {last.abs}
            {last.rel ? ` · ${last.rel}` : ''}
          </div>
          <div className="sync-counts">
            <div>
              <div className="sync-count-num">{counts.total}</div>
              <div className="sync-count-label">palavras salvas</div>
            </div>
            <div>
              <div className="sync-count-num sync-count-num-amber">{counts.pending}</div>
              <div className="sync-count-label">pendentes de envio</div>
            </div>
          </div>
        </div>

        <button
          className="sync-primary"
          onClick={handleSync}
          disabled={busy || !sheetsUrl}
        >
          {busy ? '⟳ Sincronizando…' : '⟳ Sincronizar agora'}
        </button>

        <div>
          <div className="sync-url-label">URL do script do Google Planilhas</div>
          <div className="sync-url-row">
            <span aria-hidden>🔗</span>
            <input
              className="sync-url-input"
              type="url"
              inputMode="url"
              placeholder="https://script.google.com/macros/…"
              value={urlDraft}
              onChange={(e) => setUrlDraft(e.target.value)}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>
          <div className="sync-url-actions">
            <button className="sync-url-btn" onClick={handlePaste}>
              Colar
            </button>
            <button className="sync-url-btn sync-url-btn-primary" onClick={handleSaveUrl}>
              Salvar URL
            </button>
          </div>
          {msg && (
            <p className={`sync-msg ${msg.kind === 'err' ? 'sync-msg-err' : 'sync-msg-ok'}`}>
              {msg.text}
            </p>
          )}
        </div>

        {recent.length > 0 && (
          <div>
            <div className="sync-recent-label">Salvas recentemente</div>
            <div className="sync-recent">
              {recent.map((w) => (
                <span
                  key={w.id}
                  className={`sync-tag ${w.sentAt ? '' : 'sync-tag-pending'}`}
                  title={w.sentAt ? 'Enviada' : 'Pendente'}
                >
                  {w.text}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
