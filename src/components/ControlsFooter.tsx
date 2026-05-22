interface Props {
  isPlaying: boolean
  onTogglePlay: () => void
  onSkip: (seconds: number) => void
}

export default function ControlsFooter({ isPlaying, onTogglePlay, onSkip }: Props) {
  return (
    <div className="controls">
      <button className="ctrl ctrl-skip" aria-label="Retroceder 15 segundos" onClick={() => onSkip(-15)}>
        <span className="skip-icon">↺</span>
        <span className="skip-num">15</span>
      </button>
      <button className="ctrl ctrl-skip" aria-label="Retroceder 5 segundos" onClick={() => onSkip(-5)}>
        <span className="skip-icon">↺</span>
        <span className="skip-num">5</span>
      </button>
      <button
        className="ctrl ctrl-play"
        aria-label={isPlaying ? 'Pausar' : 'Reproduzir'}
        onClick={onTogglePlay}
      >
        {isPlaying ? '⏸' : '▶'}
      </button>
      <button className="ctrl ctrl-skip" aria-label="Avançar 5 segundos" onClick={() => onSkip(5)}>
        <span className="skip-icon">↻</span>
        <span className="skip-num">5</span>
      </button>
      <button className="ctrl ctrl-skip" aria-label="Avançar 15 segundos" onClick={() => onSkip(15)}>
        <span className="skip-icon">↻</span>
        <span className="skip-num">15</span>
      </button>
    </div>
  )
}
