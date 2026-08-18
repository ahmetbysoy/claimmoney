interface Props {
  code: string
  label: string
  value: number
  min?: number
  max?: number
  format?: (value: number) => string
  note?: string
  description?: string
  priority?: 'critical' | 'supporting'
  tone?: 'buy' | 'sell' | 'warning' | 'neutral'
  history?: number[]
  onClick?: () => void
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

export function MeterBar({
  code,
  label,
  value,
  min = -1,
  max = 1,
  format,
  note,
  description,
  priority = 'supporting',
  tone,
  history = [],
  onClick
}: Props) {
  const safeValue = Number.isFinite(value) ? clamp(value, min, max) : 0
  const bipolar = min < 0 && max > 0
  const signedRatio = safeValue < 0 ? safeValue / Math.abs(min) : safeValue / max
  const resolvedTone = tone ?? (signedRatio > 0.035 ? 'buy' : signedRatio < -0.035 ? 'sell' : 'neutral')
  const output = format ? format(value) : value.toFixed(2)
  const meterStart = bipolar ? 100 : 8
  const meterEnd = bipolar
    ? 100 + clamp(signedRatio, -1, 1) * 92
    : 8 + clamp((safeValue - min) / (max - min), 0, 1) * 184
  const samples = history.length ? history : [safeValue]
  const points = samples.map((sample, index) => {
    const x = samples.length === 1 ? 100 : index / (samples.length - 1) * 200
    const y = 31 - clamp((sample - min) / (max - min), 0, 1) * 27
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')

  return (
    <button
      type="button"
      className="feature-cell"
      data-priority={priority}
      data-tone={resolvedTone}
      aria-label={`${label}: ${output}${note ? `, ${note}` : ''}. Detayı aç.`}
      onClick={onClick}
    >
      <span className="feature-cell__header">
        <span className="feature-cell__code mono">{code}</span>
        <span className="feature-cell__live"><i aria-hidden="true" />CANLI</span>
      </span>
      <span className="feature-cell__reading">
        <strong className="numeric">{output}</strong>
        {note && <span>{note}</span>}
      </span>
      <span className="feature-cell__label">{label}</span>
      <span
        className="feature-cell__meter"
        role="meter"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={safeValue}
        aria-valuetext={output}
      >
        <svg viewBox="0 0 200 16" preserveAspectRatio="none" aria-hidden="true">
          <line className="feature-cell__meter-track" x1="8" y1="8" x2="192" y2="8" />
          {bipolar && <line className="feature-cell__meter-zero" x1="100" y1="2" x2="100" y2="14" />}
          <line className="feature-cell__meter-value" x1={meterStart} y1="8" x2={meterEnd} y2="8" />
        </svg>
      </span>
      {priority === 'critical' && (
        <span className="feature-cell__sparkline" aria-hidden="true">
          <svg viewBox="0 0 200 34" preserveAspectRatio="none"><polyline points={points} /></svg>
        </span>
      )}
      <span className="feature-cell__footer">
        <span>{description}</span><span aria-hidden="true">Detay ↗</span>
      </span>
    </button>
  )
}
