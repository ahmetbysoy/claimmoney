interface Props {
  label: string
  value: number
  min?: number
  max?: number
  format?: (v: number) => string
  onClick?: () => void
}

export function MeterBar({ label, value, min = -1, max = 1, format, onClick }: Props) {
  const safeValue = Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : 0
  const normalized = ((safeValue - min) / (max - min)) * 100
  const tone = safeValue > 0.08 ? 'buy' : safeValue < -0.08 ? 'sell' : 'neutral'
  const Tag = onClick ? 'button' : 'div'
  const output = format ? format(safeValue) : safeValue.toFixed(2)
  const bipolar = min < 0 && max > 0

  return (
    <Tag className="metric-tile" data-tone={tone} {...(onClick ? { type: 'button' as const, onClick } : {})}>
      <span className="metric-tile__top"><span className="metric-tile__label">{label}</span><span className="metric-tile__value">{output}</span></span>
      {bipolar ? (
        <span className="metric-axis" role="img" aria-label={`${label}: ${output}`}>
          <progress className="metric-axis__negative" value={Math.max(0, -safeValue)} max={Math.abs(min)} aria-hidden="true" />
          <progress className="metric-axis__positive" value={Math.max(0, safeValue)} max={max} aria-hidden="true" />
        </span>
      ) : <progress value={normalized} max="100" aria-label={`${label}: ${output}`} />}
      <span className="metric-tile__scale"><span>{min}</span><span>{max}</span></span>
    </Tag>
  )
}
