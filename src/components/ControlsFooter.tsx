interface Props {
  isPlaying: boolean
  onPrev: () => void
  onTogglePlay: () => void
  onNext: () => void
}

export default function ControlsFooter({ isPlaying, onPrev, onTogglePlay, onNext }: Props) {
  return (
    <div className="controls">
      <button className="ctrl" aria-label="Parágrafo anterior" onClick={onPrev}>
        ⏮
      </button>
      <button
        className="ctrl ctrl-play"
        aria-label={isPlaying ? 'Pausar' : 'Reproduzir'}
        onClick={onTogglePlay}
      >
        {isPlaying ? '⏸' : '▶'}
      </button>
      <button className="ctrl" aria-label="Próximo parágrafo" onClick={onNext}>
        ⏭
      </button>
    </div>
  )
}
