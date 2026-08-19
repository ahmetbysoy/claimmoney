export type FSMState = 'IDLE' | 'ARMED' | 'FIRED' | 'COOLDOWN';

export interface FSMConfig {
  threshold: number;
  cooldownMs: number;
  hysteresisBand: number;
  minDwellMs: number;
}

const DEFAULT_CONFIG: FSMConfig = {
  threshold: 0.35,
  cooldownMs: 15000,
  hysteresisBand: 0.1,
  minDwellMs: 500,
};

export class DecisionFSM {
  private state: FSMState = 'IDLE';
  private config: FSMConfig;
  private consecutiveCount = 0;
  private lastSide: 'BUY' | 'SELL' | null = null;
  private firstQualifiedAt = 0;
  private firedAt = 0;
  private sideAtFire: 'BUY' | 'SELL' | null = null;

  constructor(config?: Partial<FSMConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  tick(score: number, frameEventTs: number): { fired: boolean; side: 'BUY' | 'SELL' | null } {
    const candidateSide: 'BUY' | 'SELL' = score > 0 ? 'BUY' : 'SELL';
    const absScore = Math.abs(score);
    let fired = false;

    switch (this.state) {
      case 'IDLE':
        if (absScore >= this.config.threshold) {
          this.state = 'ARMED';
          this.consecutiveCount = 1;
          this.lastSide = candidateSide;
          this.firstQualifiedAt = frameEventTs;
        }
        break;
      case 'ARMED': {
        if (candidateSide !== this.lastSide) {
          this.state = 'IDLE';
          this.consecutiveCount = 0;
          this.lastSide = null;
          this.firstQualifiedAt = 0;
          break;
        }
        if (absScore >= this.config.threshold) {
          if (Math.abs(score) < this.config.hysteresisBand) break;
          this.consecutiveCount++;
          if (frameEventTs - this.firstQualifiedAt >= this.config.minDwellMs) {
            this.state = 'FIRED';
            this.firedAt = frameEventTs;
            this.sideAtFire = candidateSide;
            fired = true;
          }
        } else {
          this.state = 'IDLE';
          this.consecutiveCount = 0;
          this.lastSide = null;
          this.firstQualifiedAt = 0;
        }
        break;
      }
      case 'FIRED':
        this.state = 'COOLDOWN';
        this.firedAt = frameEventTs;
        break;
      case 'COOLDOWN':
        if (frameEventTs - this.firedAt >= this.config.cooldownMs) {
          this.state = 'IDLE';
          this.consecutiveCount = 0;
          this.lastSide = null;
          this.firstQualifiedAt = 0;
        }
        break;
    }
    return { fired, side: fired ? this.sideAtFire : null };
  }

  getState(): { state: FSMState; consecutiveCount: number; lastSide: string | null } {
    return { state: this.state, consecutiveCount: this.consecutiveCount, lastSide: this.lastSide };
  }

  reset(): void {
    this.state = 'IDLE'; this.consecutiveCount = 0; this.lastSide = null;
    this.firstQualifiedAt = 0; this.firedAt = 0; this.sideAtFire = null;
  }
}