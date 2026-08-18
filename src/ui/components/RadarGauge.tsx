import type { EngineState } from '../../core/signal/engine'

interface Props {
  score: number
  confidence: number
  side: 'BUY' | 'SELL' | 'NEUTRAL'
  engineState: EngineState
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

export function RadarGauge({ score, confidence, side, engineState }: Props) {
  const safeScore = Number.isFinite(score) ? clamp(score, -3, 3) : 0
  const normalized = (safeScore + 3) / 6
  const angle = Math.PI - normalized * Math.PI
  const needleX = 160 + Math.cos(angle) * 112
  const needleY = 164 - Math.sin(angle) * 112
  const tone = side === 'BUY' ? 'buy' : side === 'SELL' ? 'sell' : 'neutral'
  const sideLabel = side === 'BUY' ? 'ALIM yönü' : side === 'SELL' ? 'SATIM yönü' : 'NÖTR bölge'

  return (
    <figure className="radar-gauge" data-tone={tone} aria-labelledby="radar-score radar-direction">
      <svg className="radar-gauge__svg" viewBox="0 0 320 180" role="img" aria-label={`Bileşik sinyal skoru ${safeScore.toFixed(2)}. ${sideLabel}.`}>
        <title>Bileşik sinyal radarı</title>
        <defs>
          <linearGradient id="radar-arc" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#ef4444" /><stop offset="44%" stopColor="#64748b" />
            <stop offset="56%" stopColor="#3b82f6" /><stop offset="100%" stopColor="#22c55e" />
          </linearGradient>
        </defs>
        <path className="radar-gauge__track" d="M24 164 A136 136 0 0 1 296 164" />
        <path className="radar-gauge__arc" d="M24 164 A136 136 0 0 1 296 164" />
        {[-3, -2, -1, 0, 1, 2, 3].map(value => {
          const a = Math.PI - ((value + 3) / 6) * Math.PI
          const x1 = 160 + Math.cos(a) * 123, y1 = 164 - Math.sin(a) * 123
          const x2 = 160 + Math.cos(a) * 135, y2 = 164 - Math.sin(a) * 135
          const tx = 160 + Math.cos(a) * 151, ty = 166 - Math.sin(a) * 151
          return <g key={value}><line className="radar-gauge__tick" x1={x1} y1={y1} x2={x2} y2={y2} /><text className="radar-gauge__tick-label" x={tx} y={ty}>{value}</text></g>
        })}
        <line className="radar-gauge__needle" x1="160" y1="164" x2={needleX} y2={needleY} />
        <circle className="radar-gauge__hub" cx="160" cy="164" r="7" />
      </svg>
      <figcaption className="radar-gauge__readout">
        <span className="eyebrow">Bileşik skor</span>
        <strong id="radar-score" className="radar-gauge__score numeric">{safeScore.toFixed(2)}</strong>
        <span id="radar-direction" className="radar-gauge__direction">{sideLabel} · {confidence}% güç · {engineState}</span>
      </figcaption>
    </figure>
  )
}
