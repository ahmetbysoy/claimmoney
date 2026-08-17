export interface SessionSnapshot {
  version: 1
  sessionId: string
  symbol: string
  strategyVersion: string
  startedAt: number
  endedAt?: number
  payload: Record<string, unknown>
}

export interface SessionRepository {
  save(snapshot: SessionSnapshot): Promise<void>
  list(): Promise<SessionSnapshot[]>
  remove(sessionId: string): Promise<void>
}

export class LocalSessionRepository implements SessionRepository {
  constructor(private readonly key = 'claimmoney-sessions', private readonly maxSessions = 25) {}
  async save(snapshot: SessionSnapshot): Promise<void> {
    if (typeof localStorage === 'undefined') return
    const sessions = (await this.list()).filter(item => item.sessionId !== snapshot.sessionId)
    sessions.unshift(structuredClone(snapshot))
    localStorage.setItem(this.key, JSON.stringify(sessions.slice(0, this.maxSessions)))
  }
  async list(): Promise<SessionSnapshot[]> {
    if (typeof localStorage === 'undefined') return []
    try {
      const parsed = JSON.parse(localStorage.getItem(this.key) ?? '[]')
      return Array.isArray(parsed) ? parsed.filter(item => item?.version === 1) : []
    } catch { return [] }
  }
  async remove(sessionId: string): Promise<void> {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(this.key, JSON.stringify((await this.list()).filter(item => item.sessionId !== sessionId)))
  }
}

export function downloadText(filename: string, text: string, type = 'text/plain'): void {
  if (typeof document === 'undefined') return
  const url = URL.createObjectURL(new Blob([text], { type }))
  const anchor = document.createElement('a')
  anchor.href = url; anchor.download = filename; anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function downloadJson(filename: string, data: unknown): void {
  downloadText(filename, JSON.stringify(data, null, 2), 'application/json')
}
