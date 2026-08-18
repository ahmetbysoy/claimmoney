import type { EngineState } from '../../core/signal/engine'

interface Props {
  score: number
  confidence: number
  threshold: number
  side: 'BUY' | 'SELL' | 'NEUTRAL'
  engineState: EngineState
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

const pointOnArc = (value: number, radius: number) => {
  const normalized = (clamp(value, -3, 3) + 3) / 6
  const angle = Math.PI - normalized * Math.PI
  return { x: 180 + Math.cos(angle) * radius, y: 216 - Math.sin(angle) * radius }
}

export function RadarGauge({ score, confidence, threshold, side, engineState }: Props) {
  const safeScore = Number.isFinite(score) ? clamp(score, -3, 3) : 0
  const needle = pointOnArc(safeScore, 108)
  const buyThreshold = pointOnArc(threshold, 132)
  const sellThreshold = pointOnArc(-threshold, 132)
  const tone = side === 'BUY' ? 'buy' : side === 'SELL' ? 'sell' : 'neutral'
  const sideLabel = side === 'BUY' ? 'ALIM baskısı' : side === 'SELL' ? 'SATIM baskısı' : 'Denge bölgesi'

  return (
    <figure className="radar-gauge" data-tone={tone} aria-labelledby="radar-score radar-direction">
      <svg className="radar-gauge__svg" viewBox="0 0 360 250" role="img" aria-label={`Bileşik sinyal skoru ${safeScore.toFixed(2)}. ${sideLabel}.`}>
        <title>Bileşik sinyal spektrum göstergesi</title>
        <defs>
          <linearGradient id="ion-spectrum" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#ff5964" />
            <stop offset="42%" stopColor="#615a70" />
            <stop offset="50%" stopColor="#8c5cff" />
            <stop offset="58%" stopColor="#615a70" />
            <stop offset="100%" stopColor="#2edb8a" />
          </linearGradient>
          <radialGradient id="ion-hub">
            <stop offset="0%" stopColor="#f4f1fa" />
            <stop offset="45%" stopColor="#c4b0ff" />
            <stop offset="100%" stopColor="#8c5cff" stopOpacity="0" />
          </radialGradient>
        </defs>

        <path className="radar-gauge__lattice radar-gauge__lattice--outer" d="M48 216 A132 132 0 0 1 312 216" />
        <path className="radar-gauge__lattice" d="M78 216 A102 102 0 0 1 282 216" />
        <path className="radar-gauge__lattice radar-gauge__lattice--inner" d="M108 216 A72 72 0 0 1 252 216" />
        <path className="radar-gauge__spectrum" d="M48 216 A132 132 0 0 1 312 216" />
        <line className="radar-gauge__baseline" x1="42" y1="216" x2="318" y2="216" />
        <line className="radar-gauge__threshold radar-gauge__threshold--sell" x1={sellThreshold.x} y1={sellThreshold.y - 7} x2={sellThreshold.x} y2={sellThreshold.y + 7} />
        <line className="radar-gauge__threshold radar-gauge__threshold--buy" x1={buyThreshold.x} y1={buyThreshold.y - 7} x2={buyThreshold.x} y2={buyThreshold.y + 7} />

        {[-3, -2, -1, 0, 1, 2, 3].map(value => {
          const inner = pointOnArc(value, 119)
          const outer = pointOnArc(value, 132)
          const label = pointOnArc(value, 149)
          return <g key={value}><line className="radar-gauge__tick" x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} /><text className="radar-gauge__tick-label" x={label.x} y={label.y}>{value > 0 ? `+${value}` : value}</text></g>
        })}

        <line className="radar-gauge__needle-shadow" x1="180" y1="216" x2={needle.x} y2={needle.y} />
        <line className="radar-gauge__needle" x1="180" y1="216" x2={needle.x} y2={needle.y} />
        <circle className="radar-gauge__hub-glow" cx="180" cy="216" r="18" />
        <circle className="radar-gauge__hub" cx="180" cy="216" r="6" />
      </svg>
      <figcaption className="radar-gauge__readout">
        <span className="eyebrow">COMPOSITE / 03</span>
        <strong id="radar-score" className="radar-gauge__score numeric">{safeScore > 0 ? '+' : ''}{safeScore.toFixed(2)}</strong>
        <span id="radar-direction" className="radar-gauge__direction">{sideLabel}</span>
      </figcaption>
      <div className="radar-gauge__telemetry" aria-label={`Sinyal gücü yüzde ${confidence}, motor durumu ${engineState}`}>
        <span><i />GÜÇ <strong className="numeric">{confidence}%</strong></span>
        <span>MOTOR <strong>{engineState}</strong></span>
        <span>EŞİK <strong className="numeric">±{threshold.toFixed(2)}</strong></span>
      </div>
    </figure>
  )
}
