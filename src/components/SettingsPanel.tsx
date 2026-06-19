import type { Settings } from '../types'

interface Props {
  settings: Settings
  pendingWords: number
  onChange: (settings: Settings) => void
  onOpenSync: () => void
  onClose: () => void
}

const SCALES: { label: string; value: number }[] = [
  { label: 'Pequeno', value: 0.85 },
  { label: 'Médio', value: 1 },
  { label: 'Grande', value: 1.2 },
  { label: 'Enorme', value: 1.4 },
]

const FONTS: { label: string; value: Settings['fontFamily'] }[] = [
  { label: 'Padrão', value: 'system' },
  { label: 'Serifada', value: 'serif' },
  { label: 'Mono', value: 'mono' },
]

const SPEED_MIN = 0.6
const SPEED_MAX = 2.0
const SPEED_STEP = 0.05

const roundSpeed = (n: number) => Math.round(n * 20) / 20

function formatSpeed(n: number): string {
  const v = roundSpeed(n)
  const s = v.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
  return s.replace('.', ',') + '×'
}

export default function SettingsPanel({
  settings,
  pendingWords,
  onChange,
  onOpenSync,
  onClose,
}: Props) {
  const set = (patch: Partial<Settings>) => onChange({ ...settings, ...patch })

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Configurações</h2>
          <button className="close-btn" aria-label="Fechar" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="setting">
          <span className="setting-label">Tamanho da fonte</span>
          <div className="opt-row">
            {SCALES.map((o) => (
              <button
                key={o.value}
                className={`opt ${settings.fontScale === o.value ? 'opt-on' : ''}`}
                onClick={() => set({ fontScale: o.value })}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div className="setting">
          <span className="setting-label">Fonte</span>
          <div className="opt-row">
            {FONTS.map((o) => (
              <button
                key={o.value}
                className={`opt ${settings.fontFamily === o.value ? 'opt-on' : ''}`}
                onClick={() => set({ fontFamily: o.value })}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div className="setting">
          <div className="setting-head">
            <span className="setting-label">Velocidade do áudio</span>
            <span className="setting-value">{formatSpeed(settings.speed)}</span>
          </div>
          <input
            className="speed-slider"
            type="range"
            min={SPEED_MIN}
            max={SPEED_MAX}
            step={SPEED_STEP}
            value={settings.speed}
            onChange={(e) => set({ speed: roundSpeed(Number(e.target.value)) })}
          />
          <div className="speed-ticks">
            <span>{formatSpeed(SPEED_MIN)}</span>
            <span>1×</span>
            <span>{formatSpeed(SPEED_MAX)}</span>
          </div>
        </div>

        <button className="setting-link" onClick={onOpenSync}>
          <span>🔖 Palavras salvas e sincronização</span>
          <span className="setting-link-meta">
            {pendingWords > 0
              ? `${pendingWords} pendente${pendingWords === 1 ? '' : 's'}`
              : settings.sheetsUrl
                ? 'Conectado'
                : 'Configurar'}
          </span>
          <span className="setting-link-chev">›</span>
        </button>

      </div>
    </div>
  )
}
