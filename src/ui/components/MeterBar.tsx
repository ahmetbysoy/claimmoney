type Props = { label: string; value: number; displayValue?: string; color: string; range?: number }
export function MeterBar({ label, value, displayValue, color, range = 2 }: Props) {
  const normalized = Math.max(-1, Math.min(1, value / range)), magnitude = Math.abs(normalized) * 50
  const positive = value > .05, negative = value < -.05
  return <div style={{ flex: 1, minWidth: 42, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
    <div role="meter" aria-label={label} aria-valuenow={value} style={{ width: 40, height: 112, background: 'rgba(255,255,255,.9)', borderRadius: 14, border: '1px solid var(--border-soft)', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 1, background: 'rgba(124,141,176,.35)', zIndex: 2 }} />
      <div style={{ position: 'absolute', left: 4, right: 4, height: `${magnitude}%`, top: positive ? `${50 - magnitude}%` : '50%', background: positive ? color : negative ? 'var(--red)' : 'var(--purple-soft)', borderRadius: 8, transition: 'height .2s, top .2s', boxShadow: Math.abs(normalized) > .5 ? `0 0 10px ${positive ? color : 'var(--red)'}` : 'none' }} />
    </div>
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--muted)' }}>{label}</div>
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 800, color: positive ? color : negative ? 'var(--red)' : 'var(--text)' }}>{displayValue ?? value.toFixed(2)}</div>
  </div>
}
