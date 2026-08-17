let context: AudioContext | null = null
export interface NotificationOptions { sound?: boolean; haptics?: boolean; volume?: number }

export async function unlockAudio(): Promise<boolean> {
  const ctx = getContext()
  if (!ctx) return false
  try { if (ctx.state === 'suspended') await ctx.resume(); return ctx.state === 'running' }
  catch { return false }
}
function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!context) {
    const Constructor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Constructor) return null
    try { context = new Constructor() } catch { return null }
  }
  return context
}
function tone(frequency: number, durationMs: number, type: OscillatorType, volume: number): void {
  const ctx = getContext(); if (!ctx) return
  void ctx.resume()
  const oscillator = ctx.createOscillator(), gain = ctx.createGain(), now = ctx.currentTime
  oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, now)
  gain.gain.setValueAtTime(0.001, now); gain.gain.exponentialRampToValueAtTime(Math.max(0.001, volume), now + 0.008)
  gain.gain.exponentialRampToValueAtTime(0.001, now + durationMs / 1000)
  oscillator.connect(gain); gain.connect(ctx.destination); oscillator.start(now); oscillator.stop(now + durationMs / 1000)
}
function vibrate(pattern: number | number[]): void { if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(pattern) }
export function playBuy(options: NotificationOptions = { sound: true, haptics: true }): void {
  if (options.sound !== false) tone(880, 80, 'sine', options.volume ?? 0.25)
  if (options.haptics !== false) vibrate(60)
}
export function playSell(options: NotificationOptions = { sound: true, haptics: true }): void {
  if (options.sound !== false) tone(330, 120, 'sine', options.volume ?? 0.25)
  if (options.haptics !== false) vibrate([40, 30, 40])
}
export function playDisconnect(options: NotificationOptions = { sound: true, haptics: false }): void {
  if (options.sound !== false) tone(200, 150, 'square', options.volume ?? 0.15)
}
export function playTest(side: 'BUY' | 'SELL', options?: NotificationOptions): void { side === 'BUY' ? playBuy(options) : playSell(options) }
export function disposeAudio(): void { void context?.close(); context = null }
