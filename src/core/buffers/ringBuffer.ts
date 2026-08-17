/**
 * RingBuffer - sabit boyutlu FIFO
 * Trades için max 1000 kayıt
 */
export class RingBuffer<T> {
  private buf: (T | undefined)[]
  private head = 0
  private tail = 0
  private count = 0

  constructor(private capacity: number) {
    if (!Number.isInteger(capacity) || capacity <= 0) throw new RangeError('RingBuffer capacity must be a positive integer')
    this.buf = new Array(capacity)
  }

  push(item: T): void {
    this.buf[this.tail] = item
    this.tail = (this.tail + 1) % this.capacity
    if (this.count < this.capacity) {
      this.count++
    } else {
      this.head = (this.head + 1) % this.capacity
    }
  }

  toArray(): T[] { return this.lastN(this.count) }

  lastN(limit: number): T[] {
    const requested = Number.isFinite(limit) ? Math.floor(limit) : 0
    const length = Math.max(0, Math.min(this.count, requested))
    const out: T[] = []
    const start = this.count - length
    for (let index = start; index < this.count; index += 1) {
      const value = this.buf[(this.head + index) % this.capacity]
      if (value !== undefined) out.push(value)
    }
    return out
  }

  get size(): number {
    return this.count
  }

  get isFull(): boolean {
    return this.count === this.capacity
  }

  clear(): void {
    this.buf = new Array(this.capacity)
    this.head = 0
    this.tail = 0
    this.count = 0
  }

  last(): T | undefined {
    if (this.count === 0) return undefined
    const idx = (this.tail - 1 + this.capacity) % this.capacity
    return this.buf[idx]
  }
}
