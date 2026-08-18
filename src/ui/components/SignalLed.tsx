interface Props { active: boolean; type: 'buy' | 'sell' | 'neutral'; label: string }

export function SignalLed({ active, type, label }: Props) {
  return (
    <span className="signal-led" data-active={active} data-kind={type}>
      <span className="signal-led__lamp" aria-hidden="true" />
      <span>{label}</span>
    </span>
  )
}
