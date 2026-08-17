import { useCallback, useEffect, useRef } from 'react'
import confetti from 'canvas-confetti'
import { useSettingsStore } from '../../store/settingsStore'

export function useConfetti() {
  const reducedMotion = useSettingsStore(state => state.reducedMotion)
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (timeout.current) clearTimeout(timeout.current) }, [])
  return useCallback((side: 'BUY' | 'SELL') => {
    if (reducedMotion) return
    const colors = side === 'BUY' ? ['#34D399', '#22D3EE', '#A78BFA'] : ['#F87171', '#FBBF24', '#7C8DB0']
    confetti({ particleCount: 45, spread: 65, origin: { y: .6 }, colors, ticks: 150, gravity: .9, scalar: .85 })
    if (timeout.current) clearTimeout(timeout.current)
    timeout.current = setTimeout(() => confetti({ particleCount: 20, spread: 45, origin: { y: .65 }, colors, ticks: 110 }), 120)
  }, [reducedMotion])
}

export function PulseRing({ active, side }: { active: boolean; side: 'BUY' | 'SELL' | 'NEUTRAL' }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!active || side === 'NEUTRAL' || !ref.current) return
    const animation = ref.current.animate([{ transform: 'scale(.8)', opacity: .8 }, { transform: 'scale(1.6)', opacity: 0 }], { duration: 700, easing: 'ease-out' })
    return () => animation.cancel()
  }, [active, side])
  if (!active || side === 'NEUTRAL') return null
  return <div ref={ref} style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `2px solid ${side === 'BUY' ? 'var(--green)' : 'var(--red)'}`, pointerEvents: 'none' }} />
}
