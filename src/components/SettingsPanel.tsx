import type { Settings } from '../types'

interface Props {
  settings: Settings
  onChange: (settings: Settings) => void
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

const SPEEDS: { label: string; value: number }[] = [
  { label: '0,75×', value: 0.75 },
  { label: '1×', value: 1 },
  { label: '1,25×', value: 1.25 },
  { label: '1,5×', value: 1.5 },
]

const clamp = (n: number) => Math.max(-30, Math.min(30, n))
const formatOffset = (n: number) => (n > 0 ? `+${n}` : String(n))

export default function SettingsPanel({ settings, onChange, onClose }: Props) {
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
          <span className="setting-label">Velocidade do áudio</span>
          <div className="opt-row">
            {SPEEDS.map((o) => (
              <button
                key={o.value}
                className={`opt ${settings.speed === o.value ? 'opt-on' : ''}`}
                onClick={() => set({ speed: o.value })}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div className="setting">
          <span className="setting-label">Sincronia da tradução</span>
          <span className="setting-hint">Desloca a tradução em relação ao texto, em parágrafos.</span>
          <div className="stepper">
            <button
              className="opt stepper-btn"
              aria-label="Menos um parágrafo"
              onClick={() => set({ syncOffset: clamp(settings.syncOffset - 1) })}
            >
              −
            </button>
            <span className="stepper-value">{formatOffset(settings.syncOffset)}</span>
            <button
              className="opt stepper-btn"
              aria-label="Mais um parágrafo"
              onClick={() => set({ syncOffset: clamp(settings.syncOffset + 1) })}
            >
              +
            </button>
            {settings.syncOffset !== 0 && (
              <button className="opt stepper-reset" onClick={() => set({ syncOffset: 0 })}>
                Zerar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
