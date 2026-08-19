import type { TradingSession, SessionExport, Signal, Position } from './types';
import { generateId } from './helpers';
import { crc32c } from './okx-integration';

export class SessionManager {
  private sessions: Map<string, TradingSession> = new Map();

  createSession(name: string, equity: number): TradingSession {
    const session: TradingSession = {
      id: generateId('ses'),
      name,
      startedAt: Date.now(),
      signals: [],
      positions: [],
      startEquity: equity,
      currentEquity: equity,
      peakEquity: equity,
      maxDrawdown: 0,
      totalFees: 0,
      winRate: 0,
      profitFactor: 0,
      sharpeRatio: 0,
    };
    this.sessions.set(session.id, session);
    return session;
  }

  closeSession(sessionId: string): TradingSession | undefined {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.endedAt = Date.now();
      this.recalculateMetrics(session);
    }
    return session;
  }

  addSignal(sessionId: string, signal: Signal): void {
    const session = this.sessions.get(sessionId);
    if (session) session.signals.push(signal);
  }

  addPosition(sessionId: string, position: Position): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.positions.push(position);
      session.totalFees += position.fee;
    }
  }

  getSession(sessionId: string): TradingSession | undefined {
    return this.sessions.get(sessionId);
  }

  getAllSessions(): TradingSession[] {
    return Array.from(this.sessions.values());
  }

  exportSession(sessionId: string): SessionExport {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);
    const sessionJson = JSON.stringify(session);
    return {
      version: '2.0.0',
      exportedAt: Date.now(),
      session,
      checksum: crc32c(sessionJson),
    };
  }

  importSession(data: string): TradingSession {
    const parsed = JSON.parse(data) as SessionExport;
    const sessionJson = JSON.stringify(parsed.session);
    const checksum = crc32c(sessionJson);
    if (checksum !== parsed.checksum) throw new Error('Session checksum mismatch');
    this.sessions.set(parsed.session.id, parsed.session);
    return parsed.session;
  }

  purgeWalkForward(sessions: TradingSession[], keepN: number): TradingSession[] {
    if (sessions.length <= keepN) return sessions;
    return sessions.slice(-keepN);
  }

  private recalculateMetrics(session: TradingSession): void {
    const closed = session.positions.filter((p) => p.status !== 'open');
    const wins = closed.filter((p) => p.pnl > 0);
    const losses = closed.filter((p) => p.pnl <= 0);

    session.winRate = closed.length > 0 ? wins.length / closed.length : 0;
    const grossWin = wins.reduce((s, p) => s + p.pnl, 0);
    const grossLoss = Math.abs(losses.reduce((s, p) => s + p.pnl, 0));
    session.profitFactor = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0;

    const pnls = closed.map((p) => p.pnl);
    const avgPnl = pnls.length > 0 ? pnls.reduce((a, b) => a + b, 0) / pnls.length : 0;
    const stdPnl =
      pnls.length > 1
        ? Math.sqrt(pnls.reduce((s, p) => s + (p - avgPnl) ** 2, 0) / (pnls.length - 1))
        : 0;
    session.sharpeRatio = stdPnl > 0 ? (avgPnl / stdPnl) * Math.sqrt(252) : 0;

    session.currentEquity = session.startEquity + session.positions.reduce((s, p) => s + p.pnl, 0);
    session.peakEquity = Math.max(session.startEquity, session.currentEquity);
    session.maxDrawdown = session.peakEquity > 0 ? (session.peakEquity - session.currentEquity) / session.peakEquity : 0;
  }
}