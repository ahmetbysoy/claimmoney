export interface Clock {
  now(): number
}

export const systemClock: Clock = { now: () => Date.now() }

export class ManualClock implements Clock {
  constructor(private time = 0) {}
  now(): number { return this.time }
  set(time: number): void { this.time = time }
  advance(ms: number): void { this.time += ms }
}
