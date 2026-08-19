/**
 * BOZOK PRO v4.0 — Inline Web Worker
 *
 * Self-contained L2 market microstructure engine.
 * Communicates via postMessage/onmessage ONLY.
 * NO imports from main thread.
 *
 * P0: Plan State Machine, Risk Gates, Confluence, Trailing Stop
 * P1: Book Velocity, Multi-Depth OBI, Trade Rate, Dynamic Walls
 * P2: VPVR, Iceberg Lifecycle, Compression Breakout, Void Fill
 */

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════
const ML = 50;  // max depth levels
const MT = 512; // trade ring
const MS = 128; // signal ring
const MC = 256; // CVD + liq ring
const MF = 64;  // flow ring
const MQ = 256; // liq ring
const MW = 32;  // wall trackers

// ═══════════════════════════════════════════════════════════════
// BOOK STATE (typed arrays)
// ═══════════════════════════════════════════════════════════════
const bP = new Float64Array(ML), bQ = new Float64Array(ML);
const aP = new Float64Array(ML), aQ = new Float64Array(ML);
let bN = 0, aN = 0;

// Previous book (for velocity P1-1)
const pbP = new Float64Array(ML), pbQ = new Float64Array(ML);
const paP = new Float64Array(ML), paQ = new Float64Array(ML);
let pbN = 0, paN = 0, lastBookT = 0;
let bookVelScore = 0;

// ═══════════════════════════════════════════════════════════════
// TRADES (ring buffer)
// ═══════════════════════════════════════════════════════════════
const tP = new Float64Array(MT), tQ = new Float64Array(MT), tS = new Uint8Array(MT);
const tT = new Float64Array(MT), tN = new Float64Array(MT), tTier = new Uint8Array(MT);
let tH = 0, tC = 0;

// ═══════════════════════════════════════════════════════════════
// TRADE RATE (P1-3)
// ═══════════════════════════════════════════════════════════════
let tradeRate1s = 0, tradeRate5s = 0, tradeRate30s = 0;
let tapeSpike = false;
let whaleT1 = 0, whaleT2 = 0, whaleT3 = 0;

// ═══════════════════════════════════════════════════════════════
// CVD (ring buffer)
// ═══════════════════════════════════════════════════════════════
const cT = new Float64Array(MC), cV = new Float64Array(MC);
let cH = 0, cC = 0, cvd = 0;

// ═══════════════════════════════════════════════════════════════
// FLOW (ring buffer)
// ═══════════════════════════════════════════════════════════════
const fPr = new Float64Array(MF), fSt = new Float64Array(MF), fDe = new Float64Array(MF);
const fBu = new Float64Array(MF), fSe = new Float64Array(MF), fTm = new Float64Array(MF), fLq = new Uint16Array(MF);
let fH = 0, fC = 0;

// ═══════════════════════════════════════════════════════════════
// LIQUIDATIONS (ring buffer)
// ═══════════════════════════════════════════════════════════════
const lT = new Float64Array(MQ), lS = new Uint8Array(MQ), lN = new Float64Array(MQ);
let lH = 0, lC = 0;

// ═══════════════════════════════════════════════════════════════
// CASCADE CHAIN (P1-7)
// ═══════════════════════════════════════════════════════════════
let cascadeChainLen = 0, cascadeChainDir = 0, cascadeChainT = 0;

// ═══════════════════════════════════════════════════════════════
// VPIN
// ═══════════════════════════════════════════════════════════════
let vSum = 0, vCnt = 0, vVal = 0, vBB = 0, vSB = 0, vBN = 0;
let vBucketSz = 500000;

// ═══════════════════════════════════════════════════════════════
// FLOW BUCKET
// ═══════════════════════════════════════════════════════════════
let fbS = 0, fbB = 0, fbSe = 0, fbA = 0, fbL = 0, fbPO = 0, fbPH = 0, fbPL = 0;

// ═══════════════════════════════════════════════════════════════
// MID & STATE
// ═══════════════════════════════════════════════════════════════
let mid = 0, compAct = false, ladC = 0;

// ═══════════════════════════════════════════════════════════════
// WALL TRACKERS
// ═══════════════════════════════════════════════════════════════
const wBP = new Float64Array(MW), wBQ = new Float64Array(MW), wBI = new Float64Array(MW);
const wBL = new Float64Array(MW), wBX = new Uint8Array(MW), wBE = new Float64Array(MW);
let wBC = 0;
const wAP = new Float64Array(MW), wAQ = new Float64Array(MW), wAI = new Float64Array(MW);
const wAL = new Float64Array(MW), wAX = new Uint8Array(MW), wAE = new Float64Array(MW);
let wAC = 0;

// ═══════════════════════════════════════════════════════════════
// SIGNALS (ring buffer)
// ═══════════════════════════════════════════════════════════════
const sTy: string[] = new Array(MS).fill('');
const sBi: string[] = new Array(MS).fill('');
const sDe = new Float64Array(MS);
const sPr = new Float64Array(MS), sTm = new Float64Array(MS), sDs: string[] = new Array(MS).fill('');
const sCf = new Uint8Array(MS), sVer = new Uint8Array(MS);
let sH = 0, sC = 0;
const sLF: Record<string, number> = {};

// ═══════════════════════════════════════════════════════════════
// ICEBERG LIFECYCLE (P2-2)
// ═══════════════════════════════════════════════════════════════
const iTr = new Float64Array(ML), iDp = new Float64Array(ML), iCt = new Uint16Array(ML);
const iState = new Uint8Array(ML); // 0=none, 1=forming, 2=confirmed, 3=pulled, 4=consumed
const iT = new Float64Array(ML);
let absInfo: { ts: number; side: string; delta: number; price: number } | null = null;

// ═══════════════════════════════════════════════════════════════
// VOID TRACKER (P2-4)
// ═══════════════════════════════════════════════════════════════
const voidFillState = new Uint8Array(ML); // 0=none, 1=detected, 2=filling, 3=filled
const voidFillT = new Float64Array(ML);

// ═══════════════════════════════════════════════════════════════
// LIQ POOL ESTIMATOR (P1-9)
// ═══════════════════════════════════════════════════════════════
let liqPoolLong: number[] = [], liqPoolShort: number[] = [];

// ═══════════════════════════════════════════════════════════════
// MARKET REGIME (P1-12)
// ═══════════════════════════════════════════════════════════════
let regime = 'DEAD', regimeScore = 0;
const volHist = new Float64Array(60).fill(0), dirHist = new Float64Array(60).fill(0);
let volH = 0, dirH = 0;

// ═══════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════
let cWm = 3, cMc = 60, cFt = 5000, cFm = 'time', cFv = 1e6;
let cBal = 1000, cRp = 2, cMl = 20, cFb = 4, cSw = 3, cIb = 50000;
let cDL = 20, cHW = 30, cTTL = 30, cHold = 300;
let tickSize = 0.01, stepSize = 0.001, minQty = 0.001, minNotional = 5;
let fundingRate = 0;

// ═══════════════════════════════════════════════════════════════
// PLAN STATE MACHINE (P0-1)
// ═══════════════════════════════════════════════════════════════
let planState: string = 'NEUTRAL';
let planId = '', planDir = '', planConf = 0, planEntry = 0, planSL = 0, planTP = 0, planRR = 0;
let planTTL = 0, planConfluence = 0;
let lastPlanDir = '', lastPlanT = 0;

// ═══════════════════════════════════════════════════════════════
// MULTI-DEPTH OBI (P1-2)
// ═══════════════════════════════════════════════════════════════
let obi5 = 0, obi10 = 0, obi20 = 0, obiDiv = false;

// ═══════════════════════════════════════════════════════════════
// POST THROTTLE
// ═══════════════════════════════════════════════════════════════
let lastPostT = 0;

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════
function now(): number { return Date.now(); }

function cl(v: number, a: number, b: number): number {
  return v < a ? a : v > b ? b : v;
}

function med(arr: Float64Array, n: number): number {
  if (!n) return 0;
  const t: number[] = [];
  for (let i = 0; i < n; i++) t[i] = arr[i];
  for (let i = 1; i < n; i++) {
    const v = t[i]; let j = i - 1;
    while (j >= 0 && t[j] > v) { t[j + 1] = t[j]; j--; }
    t[j + 1] = v;
  }
  const m = n >> 1;
  return n & 1 ? t[m] : (t[m - 1] + t[m]) * 0.5;
}

function avg(arr: Float64Array, n: number): number {
  let s = 0; for (let i = 0; i < n; i++) s += arr[i];
  return n > 0 ? s / n : 0;
}

// ═══════════════════════════════════════════════════════════════
// TICK NORMALIZATION (P1-B)
// ═══════════════════════════════════════════════════════════════
function normPrice(p: number): number {
  return Math.round(p / tickSize) * tickSize;
}

// ═══════════════════════════════════════════════════════════════
// SIGNAL DECAY BY TYPE (P1-16)
// ═══════════════════════════════════════════════════════════════
function decayRate(type: string): number {
  switch (type) {
    case 'WALL': case 'BID_WALL': case 'ASK_WALL': return 0.0002;
    case 'SPOOFING': return 0.002;
    case 'CASCADE_SQUEEZE': case 'CASCADE_CHAIN': case 'CASCADE_EXHAUSTED': return 0.003;
    case 'CVD_BULL_DIV': case 'CVD_BEAR_DIV': return 0.003;
    case 'VOID_ASK': case 'VOID_BID': return 0.0008;
    case 'ICEBERG': case 'ICEBERG_FORMING': case 'ICEBERG_CONFIRMED': return 0.0003;
    default: return 0.0005;
  }
}

// ═══════════════════════════════════════════════════════════════
// ADD SIGNAL (with confluence boost, VPIN penalty, cooldown)
// ═══════════════════════════════════════════════════════════════
function addSig(ty: string, bi: string, co: number, pr: number, ds: string, cf: number): void {
  const t = now();
  if (sLF[ty] && t - sLF[ty] < 8000) return;
  sLF[ty] = t;
  co = co < cMc ? 0 : co;
  if (vVal > 0.7) co *= 0.7;
  // Confluence boost: same-direction signals in 30s
  let conf = 0;
  for (let i = 0; i < Math.min(sC, 30); i++) {
    const x = (sH - 1 - i + MS * 2) % MS;
    if (t - sTm[x] > 30000) break;
    if (sBi[x] === bi) conf++;
  }
  if (conf >= 2) co = cl(co * 1.3, 0, 98);

  const x = sH % MS;
  sTy[x] = ty; sBi[x] = bi; sDe[x] = Math.round(co);
  sPr[x] = pr; sTm[x] = t; sDs[x] = ds; sCf[x] = cf || 0;
  sVer[x] = 0; // pending verification
  sH++; if (sC < MS) sC++;
}

// ═══════════════════════════════════════════════════════════════
// VERIFY SIGNALS (P2-6)
// ═══════════════════════════════════════════════════════════════
function verifySignals(): void {
  const t = now();
  for (let i = 0; i < Math.min(sC, 50); i++) {
    const x = (sH - 1 - i + MS * 2) % MS;
    if (sVer[x] !== 0) continue;
    const age = t - sTm[x];
    if (age < 5000) continue;
    if (age > 30000) { sVer[x] = 2; continue; } // expired → miss
    const dir = sBi[x];
    const priceMove = mid > 0 ? (mid - sPr[x]) / sPr[x] * 100 : 0;
    if ((dir === 'bullish' && priceMove > 0.03) || (dir === 'bearish' && priceMove < -0.03)) {
      sVer[x] = 1; // verified hit
    } else if ((dir === 'bullish' && priceMove < -0.03) || (dir === 'bearish' && priceMove > 0.03)) {
      sVer[x] = 2; // verified miss
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// P0: CONFLUENCE ENGINE
// ═══════════════════════════════════════════════════════════════
function calcConfluence(dir: string): number {
  const t = now();
  const types = new Set<string>();
  for (let i = 0; i < Math.min(sC, 30); i++) {
    const x = (sH - 1 - i + MS * 2) % MS;
    if (t - sTm[x] > 30000) break;
    if (sBi[x] === dir) types.add(sTy[x]);
  }
  return types.size;
}

function getConfluenceTypes(dir: string): string[] {
  const t = now();
  const types: string[] = [];
  for (let i = 0; i < Math.min(sC, 30); i++) {
    const x = (sH - 1 - i + MS * 2) % MS;
    if (t - sTm[x] > 30000) break;
    if (sBi[x] === dir) types.push(sTy[x]);
  }
  return types;
}

// ═══════════════════════════════════════════════════════════════
// P0: RISK GATE
// ═══════════════════════════════════════════════════════════════
function riskGate(): { pass: boolean; reason: string } {
  const t = now();
  if (t - lastBookT > 5000 && lastBookT > 0) return { pass: false, reason: 'Stale data' };
  if (bN > 0 && aN > 0) {
    const sp = (aP[0] - bP[0]) / mid * 1e4;
    if (sp > 10) return { pass: false, reason: 'Spread > 10bps' };
  }
  if (vVal > 0.8) return { pass: false, reason: 'VPIN toxic' };
  if (compAct) return { pass: false, reason: 'Compression active' };
  if (cascadeChainLen >= 1 && t - cascadeChainT < 5000) return { pass: false, reason: 'Cascade active' };
  return { pass: true, reason: '' };
}

// ═══════════════════════════════════════════════════════════════
// P0: PLAN STATE MACHINE
// ═══════════════════════════════════════════════════════════════
function updatePlanState(): void {
  const gate = riskGate();
  if (!gate.pass) {
    if (planState !== 'NEUTRAL') { planState = 'NEUTRAL'; planId = ''; planDir = ''; planConf = 0; }
    return;
  }
  const pl = genPlan();
  if (!pl || pl.dir === 'NEUTRAL') {
    if (planState !== 'NEUTRAL') { planState = 'NEUTRAL'; planId = ''; planDir = ''; planConf = 0; }
    return;
  }
  const t = now();
  if (pl.dir === lastPlanDir && t - lastPlanT < 30000) return;

  const cf = calcConfluence(pl.dir);
  if (cf < 3) {
    if (planState !== 'NEUTRAL') { planState = 'NEUTRAL'; planId = ''; planDir = ''; planConf = 0; }
    return;
  }

  const netRR = calcNetRR(pl);
  if (netRR < 2.0) {
    if (planState !== 'NEUTRAL') { planState = 'NEUTRAL'; planId = ''; planDir = ''; planConf = 0; }
    return;
  }

  planState = 'CANDIDATE';
  planDir = pl.dir; planConf = pl.conf; planEntry = pl.entry;
  planSL = pl.sl; planTP = pl.tp; planRR = netRR;
  planConfluence = cf; planTTL = cTTL * 1000;
  planId = 'plan_' + t;
  lastPlanDir = pl.dir; lastPlanT = t;
}

// ═══════════════════════════════════════════════════════════════
// P0: NET RR CALCULATOR
// ═══════════════════════════════════════════════════════════════
function calcNetRR(pl: { dir: string; entry: number; sl: number; tp: number; rr: number } | null): number {
  if (!pl || pl.dir === 'NEUTRAL') return 0;
  const grossRR = pl.rr;
  const feeCost = (cFb * 2) / 10000;
  const slipCost = 0.0005;
  const totalCost = feeCost + slipCost;
  const riskDist = Math.abs(pl.entry - pl.sl) / pl.entry;
  const costRR = riskDist > 0 ? totalCost / riskDist : 0;
  let net = grossRR - costRR;
  if (fundingRate !== 0) {
    const holdHrs = Math.min(cHold / 3600, 8);
    net -= Math.abs(fundingRate) * holdHrs;
  }
  return net;
}

// ═══════════════════════════════════════════════════════════════
// PROC BOOK (P1-1: Velocity)
// ═══════════════════════════════════════════════════════════════
function procBook(bids: number[][], asks: number[][]): void {
  const t = now();
  // Save previous for velocity
  pbN = bN; paN = aN;
  for (let i = 0; i < bN; i++) { pbP[i] = bP[i]; pbQ[i] = bQ[i]; }
  for (let i = 0; i < aN; i++) { paP[i] = aP[i]; paQ[i] = aQ[i]; }

  bN = Math.min(bids.length, ML); aN = Math.min(asks.length, ML);
  for (let i = 0; i < bN; i++) { bP[i] = bids[i][0]; bQ[i] = bids[i][1]; }
  for (let i = 0; i < aN; i++) { aP[i] = asks[i][0]; aQ[i] = asks[i][1]; }
  mid = bN > 0 && aN > 0 ? (bP[0] + aP[0]) * 0.5 : 0;

  // Book velocity (P1-1)
  if (lastBookT > 0) {
    const dt = t - lastBookT;
    if (dt > 0) {
      let vel = 0;
      for (let i = 0; i < Math.min(bN, pbN); i++) {
        if (Math.abs(bP[i] - pbP[i]) < 0.001) vel += Math.abs(bQ[i] - pbQ[i]) * bP[i];
      }
      for (let i = 0; i < Math.min(aN, paN); i++) {
        if (Math.abs(aP[i] - paP[i]) < 0.001) vel += Math.abs(aQ[i] - paQ[i]) * aP[i];
      }
      bookVelScore = vel / dt * 1000;
    }
  }
  lastBookT = t;

  calcMultiOBI();
  updateLiqPools();
  updateRegime();
  runDet();
  updFlow();
  verifySignals();
  updatePlanState();
  postSt();
}

// ═══════════════════════════════════════════════════════════════
// MULTI-DEPTH OBI (P1-2)
// ═══════════════════════════════════════════════════════════════
function calcMultiOBI(): void {
  const n5 = Math.min(5, bN, aN), n10 = Math.min(10, bN, aN), n20 = Math.min(20, bN, aN);
  let bd5 = 0, ad5 = 0, bd10 = 0, ad10 = 0, bd20 = 0, ad20 = 0;
  for (let i = 0; i < n5; i++) { bd5 += bP[i] * bQ[i]; ad5 += aP[i] * aQ[i]; }
  for (let i = 0; i < n10; i++) { bd10 += bP[i] * bQ[i]; ad10 += aP[i] * aQ[i]; }
  for (let i = 0; i < n20; i++) { bd20 += bP[i] * bQ[i]; ad20 += aP[i] * aQ[i]; }
  const tot5 = bd5 + ad5, tot10 = bd10 + ad10, tot20 = bd20 + ad20;
  obi5 = tot5 > 0 ? (bd5 - ad5) / tot5 : 0;
  obi10 = tot10 > 0 ? (bd10 - ad10) / tot10 : 0;
  obi20 = tot20 > 0 ? (bd20 - ad20) / tot20 : 0;
  obiDiv = Math.abs(obi5 - obi20) > 0.3;
}

// ═══════════════════════════════════════════════════════════════
// LIQ POOL ESTIMATOR (P1-9)
// ═══════════════════════════════════════════════════════════════
function updateLiqPools(): void {
  if (!mid) return;
  const vwap = calcVWAP();
  if (!vwap) return;
  liqPoolLong = []; liqPoolShort = [];
  const tiers = [10, 20, 50, 100];
  for (const lev of tiers) {
    const dist = vwap * (1 / lev);
    liqPoolLong.push(vwap + dist);
    liqPoolShort.push(vwap - dist);
  }
}

function calcVWAP(): number {
  if (tC < 10) return mid;
  let sumPV = 0, sumV = 0;
  const n = Math.min(tC, 100);
  for (let i = 0; i < n; i++) {
    const x = (tH - 1 - i + MT * 2) % MT;
    sumPV += tP[x] * tQ[x]; sumV += tQ[x];
  }
  return sumV > 0 ? sumPV / sumV : mid;
}

// ═══════════════════════════════════════════════════════════════
// MARKET REGIME (P1-12)
// ═══════════════════════════════════════════════════════════════
function updateRegime(): void {
  const sp = mid > 0 && bN > 0 && aN > 0 ? (aP[0] - bP[0]) / mid * 1e4 : 0;
  const volProxy = sp * Math.max(tradeRate1s, 1);
  volHist[volH % 60] = volProxy; volH++;
  let dirProxy = 0;
  if (cC >= 10) {
    const cn = cV[(cH - 1 + MC) % MC], ct = cV[(cH - 10 + MC) % MC];
    dirProxy = Math.abs(cn - ct);
  }
  dirHist[dirH % 60] = dirProxy; dirH++;

  const avgVol = avg(volHist, Math.min(60, volH));
  const avgDir = avg(dirHist, Math.min(60, dirH));

  if (cascadeChainLen >= 2) { regime = 'CHAOS'; regimeScore = 90; }
  else if (compAct && avgVol < 2) { regime = 'COILING'; regimeScore = 70; }
  else if (avgVol > 5 && avgDir > 100000) { regime = 'TRENDING'; regimeScore = 80; }
  else if (avgVol > 5 && avgDir < 50000) { regime = 'CHOPPY'; regimeScore = 60; }
  else { regime = 'DEAD'; regimeScore = 30; }
}

// ═══════════════════════════════════════════════════════════════
// PROC TRADE (P1-3: Trade Rate, P1-4: Whale)
// ═══════════════════════════════════════════════════════════════
function procTrade(p: number, q: number, s: number, t: number): void {
  const x = tH % MT;
  tP[x] = p; tQ[x] = q; tS[x] = s; tT[x] = t; tN[x] = p * q;
  // Tier classification (P1-4)
  const not = p * q;
  let tier = 0;
  if (not > 1e6) { tier = 3; whaleT3++; }
  else if (not > 2e5) { tier = 2; whaleT2++; }
  else if (not > 5e4) { tier = 1; whaleT1++; }
  tTier[x] = tier;
  tH++; if (tC < MT) tC++;

  updateTradeRates(t, not);

  // CVD
  const d = s === 0 ? not : -not; cvd += d;
  const ci = cH % MC; cT[ci] = t; cV[ci] = cvd; cH++; if (cC < MC) cC++;

  // VPIN
  if (s === 0) vBB += not; else vSB += not; vBN += not;
  if (vBN >= vBucketSz) {
    const tot = vBB + vSB;
    if (tot > 0) { vSum += Math.abs(vBB - vSB) / tot; vCnt++; if (vCnt > 50) vCnt = 50; vVal = vSum / vCnt; }
    vBB = 0; vSB = 0; vBN = 0;
  }

  // Flow bucket
  if (s === 0) fbB += not; else fbSe += not; fbA += not;
  if (fbPH < p) fbPH = p; if (fbPL > p || fbPL === 0) fbPL = p;

  chkIceberg(p, not, s);
}

// ═══════════════════════════════════════════════════════════════
// TRADE RATE MONITOR (P1-3)
// ═══════════════════════════════════════════════════════════════
function updateTradeRates(t: number, not: number): void {
  const nowT = now();
  let c1 = 0, n1 = 0, c5 = 0, n5 = 0, c30 = 0;
  for (let i = 0; i < tC; i++) {
    const x = (tH - 1 - i + MT * 2) % MT;
    const age = nowT - tT[x];
    if (age > 30000) break;
    if (age < 1000) { c1++; n1 += tN[x]; }
    if (age < 5000) { c5++; n5 += tN[x]; }
    if (age < 30000) { c30++; }
  }
  tradeRate1s = c1; tradeRate5s = c5; tradeRate30s = c30;
  const avg5s = c5 > 0 ? n5 / 5 : 0;
  tapeSpike = c1 > avg5s * 3 && c1 >= 5;
  if (tapeSpike) {
    addSig('TAPE_SPIKE', c1 > n1 ? 'bullish' : 'bearish', 65, mid, 'Tape speed spike: ' + c1 + ' trades/s', 0);
  }
}

// ═══════════════════════════════════════════════════════════════
// PROC LIQ (P1-7: Cascade Chain)
// ═══════════════════════════════════════════════════════════════
function procLiq(s: number, p: number, q: number, t: number): void {
  const x = lH % MQ;
  lT[x] = t; lS[x] = s; lN[x] = p * q; lH++; if (lC < MQ) lC++;
  fbL++;

  // Cascade chain detection (P1-7)
  const nowT = now();
  if (cascadeChainLen === 0) {
    cascadeChainLen = 1; cascadeChainDir = s; cascadeChainT = nowT;
  } else if (s === cascadeChainDir && nowT - cascadeChainT < 2000) {
    cascadeChainLen++;
    if (cascadeChainLen >= 3) {
      addSig('CASCADE_CHAIN', s === 1 ? 'bearish' : 'bullish',
        cl(60 + cascadeChainLen * 8, 60, 92), mid,
        'Cascade chain x' + cascadeChainLen, 0);
    }
  } else {
    cascadeChainLen = 1; cascadeChainDir = s; cascadeChainT = nowT;
  }

  chkCascade(s, p, p * q);
  chkLiqCluster();
  chkCascadeExhaustion();
}

// ═══════════════════════════════════════════════════════════════
// CASCADE EXHAUSTION (P1-8)
// ═══════════════════════════════════════════════════════════════
function chkCascadeExhaustion(): void {
  if (cascadeChainLen < 3) return;
  const dir = cascadeChainDir;
  const arr = dir === 1 ? bP : aP;
  const qty = dir === 1 ? bQ : aQ;
  const cnt = dir === 1 ? bN : aN;
  if (cnt < 3) return;
  const thr = dir === 1 ? mid * 0.999 : mid * 1.001;
  let near = 0;
  for (let i = 0; i < cnt; i++) {
    if ((dir === 1 && arr[i] >= thr) || (dir === 0 && arr[i] <= thr)) near += arr[i] * qty[i];
  }
  const lastLiq = lN[(lH - 1 + MQ) % MQ];
  if (near > lastLiq * 1.2) {
    addSig('CASCADE_EXHAUSTED', dir === 1 ? 'bullish' : 'bearish', 85, mid, 'Cascade exhausted → reversal', 0);
    cascadeChainLen = 0;
  }
}

// ═══════════════════════════════════════════════════════════════
// ICEBERG (P2-2: Lifecycle)
// ═══════════════════════════════════════════════════════════════
function chkIceberg(price: number, notional: number, side: number): void {
  if (notional < cIb) return;
  const arr = side === 0 ? aP : bP;
  const qty = side === 0 ? aQ : bQ;
  const cnt = side === 0 ? aN : bN;
  for (let i = 0; i < Math.min(cnt, 20); i++) {
    if (Math.abs(arr[i] - price) / price < 0.0002) {
      iTr[i] += notional; iDp[i] = qty[i]; iCt[i]++;
      if (iState[i] === 0) { iState[i] = 1; iT[i] = now(); } // FORMING
      else if (iState[i] === 1 && iCt[i] >= 3) { iState[i] = 2; } // CONFIRMED

      if (iCt[i] >= 3) {
        const avgT = iTr[i] / iCt[i];
        const avgP = mid || 1;
        const tQty = avgT / avgP;
        const sc = tQty / Math.max(iDp[i], 0.001);
        if (sc > 2.5) {
          const st = iState[i] === 2 ? 'CONFIRMED' : 'FORMING';
          addSig('ICEBERG_' + st, side === 0 ? 'bullish' : 'bearish',
            cl(60 + sc * 5, 60, 88), price,
            'Iceberg ' + st + ' @ ' + price.toFixed(2) + ' ratio:' + sc.toFixed(1) + 'x', 0);
          if (iState[i] === 2) { iState[i] = 4; iCt[i] = 0; } // CONSUMED
        }
      }
      break;
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// CASCADE (P1-7)
// ═══════════════════════════════════════════════════════════════
function chkCascade(side: number, price: number, notional: number): void {
  if (notional < 100000) return;
  const arr = side === 1 ? bP : aP;
  const qty = side === 1 ? bQ : aQ;
  const cnt = side === 1 ? bN : aN;
  const thr = side === 1 ? price * 0.999 : price * 1.001;
  let near = 0;
  for (let i = 0; i < cnt; i++) {
    if ((side === 1 && arr[i] >= thr) || (side === 0 && arr[i] <= thr)) near += arr[i] * qty[i];
  }
  if (notional > near * 1.5) {
    addSig('CASCADE_SQUEEZE', side === 1 ? 'bearish' : 'bullish', 88, price,
      'Cascade: $' + (notional / 1e6).toFixed(2) + 'M vs depth $' + (near / 1e6).toFixed(2) + 'M', 0);
  }
}

// ═══════════════════════════════════════════════════════════════
// LIQ CLUSTER
// ═══════════════════════════════════════════════════════════════
function chkLiqCluster(): void {
  const t = now();
  let cnt = 0, tot = 0, lo = 0, sh = 0;
  for (let i = 0; i < lC; i++) {
    const x = (lH - 1 - i + MQ * 2) % MQ;
    if (t - lT[x] > 10000) break;
    cnt++; tot += lN[x];
    if (lS[x] === 1) lo++; else sh++;
  }
  if (cnt >= 5 && tot > 500000) {
    addSig('LIQ_CLUSTER', lo > sh ? 'bearish' : 'bullish',
      cl(50 + cnt * 5, 50, 95), mid,
      cnt + ' liq $' + (tot / 1e6).toFixed(2) + 'M', 0);
  }
}

// ═══════════════════════════════════════════════════════════════
// FLOW (P1-M: Trend, P1-N: Exhaustion)
// ═══════════════════════════════════════════════════════════════
function updFlow(): void {
  const t = now();
  if (fbS === 0) { fbS = t; fbPO = mid; fbPH = mid; fbPL = mid; return; }
  const el = t - fbS;
  const close = cFm === 'time' ? el >= cFt : fbA >= cFv;
  if (close && fbA > 0) {
    const d = fbB - fbSe;
    const pr = cl(d / fbA * 100, -100, 100);
    const st = cl(Math.abs(d) / fbA * 100, 0, 100);
    const fi = fH % MF;
    fPr[fi] = pr; fSt[fi] = st; fDe[fi] = d;
    fBu[fi] = fbB; fSe[fi] = fbSe; fTm[fi] = fbS; fLq[fi] = fbL;
    fH++; if (fC < MF) fC++;

    // Absorption
    if (Math.abs(d) > 100000 && fbPH > 0 && fbPL > 0 && Math.abs(fbPH - fbPL) / mid < 0.0005) {
      absInfo = { ts: t, side: d > 0 ? 'bid' : 'ask', delta: d, price: mid };
      addSig('ABSORPTION', d > 0 ? 'bullish' : 'bearish', 75, mid,
        'Absorption: delta $' + (d / 1e3).toFixed(0) + 'K zero move', 0);
    }

    detFlowTrend();

    fbS = t; fbB = 0; fbSe = 0; fbA = 0; fbL = 0;
    fbPO = mid; fbPH = mid; fbPL = mid;
    detFlow();
  }
}

function detFlowTrend(): void {
  if (fC < 5) return;
  let pos = 0, neg = 0;
  for (let i = 0; i < Math.min(fC, 5); i++) {
    const x = (fH - 1 - i + MF * 2) % MF;
    if (fDe[x] > 0) pos++; else if (fDe[x] < 0) neg++;
  }
  if (pos === 5) addSig('FLOW_SUSTAINED', 'bullish', 60, mid, 'Sustained buying pressure', 0);
  else if (neg === 5) addSig('FLOW_SUSTAINED', 'bearish', 60, mid, 'Sustained selling pressure', 0);

  // Exhaustion (P1-N)
  const la = (fH - 1 + MF) % MF;
  if (Math.abs(fPr[la]) > 80 && fC >= 3) {
    const prev = fPr[(fH - 2 + MF) % MF];
    if (Math.abs(fPr[la]) > Math.abs(prev) * 0.8) {
      addSig('FLOW_EXHAUSTION', fDe[la] > 0 ? 'bearish' : 'bullish', 70, mid, 'Flow exhaustion detected', 0);
    }
  }
}

function detFlow(): void {
  if (fC < 2) return;
  const la = (fH - 1 + MF) % MF, pr = (fH - 2 + MF) % MF;
  if (Math.abs(fDe[la]) > Math.abs(fDe[pr]) * 2 && fbA > 100000) {
    addSig('DELTA_EXPANSION', fDe[la] > 0 ? 'bullish' : 'bearish',
      cl(60 + Math.abs(fPr[la]) * 0.3, 60, 90), mid,
      'Delta exp $' + (Math.abs(fDe[la]) / 1e3).toFixed(0) + 'K', 0);
  }
  if (cC >= 10 && fC >= 5) {
    const cn = cV[(cH - 1 + MC) % MC], ct = cV[(cH - 10 + MC) % MC];
    const pn = fPr[la], pt = fPr[(fH - 5 + MF) % MF];
    if (pn > 5 && cn < ct) addSig('CVD_BEAR_DIV', 'bearish', 70, mid, 'CVD bearish divergence', 0);
    else if (pn < -5 && cn > ct) addSig('CVD_BULL_DIV', 'bullish', 70, mid, 'CVD bullish divergence', 0);
  }
}

// ═══════════════════════════════════════════════════════════════
// DETECTORS
// ═══════════════════════════════════════════════════════════════
function runDet(): void {
  if (bN < 5 || aN < 5) return;
  detWalls(); detComp(); detLad(); detSkew(); detVoid(); detSpoof();
}

// ═══════════════════════════════════════════════════════════════
// WALLS (P1-5: Dynamic Threshold, P1-6: Execution Ratio)
// ═══════════════════════════════════════════════════════════════
function detWalls(): void {
  const t = now();
  const n10 = Math.min(10, bN, aN);
  const bq: number[] = [], aq: number[] = [];
  for (let i = 0; i < n10; i++) { bq[i] = bQ[i]; aq[i] = aQ[i]; }
  const mB = med(new Float64Array(bq), n10);
  const mA = med(new Float64Array(aq), n10);

  // Dynamic threshold (P1-5)
  const sp = mid > 0 ? (aP[0] - bP[0]) / mid * 1e4 : 0;
  const volFactor = cl(sp / 5, 0.5, 3.0);
  const thrB = mB * cWm * volFactor, thrA = mA * cWm * volFactor;

  // Bid walls
  const nBP: number[] = [], nBQ: number[] = [], nBI: number[] = [];
  const nBL: number[] = [], nBX: number[] = [], nBE: number[] = [];
  const lim = Math.min(bN, 15);
  for (let i = 0; i < lim; i++) {
    if (bQ[i] > thrB) {
      let ex = -1;
      for (let j = 0; j < wBC; j++) {
        if (Math.abs(wBP[j] - bP[i]) / bP[i] < 0.0001) { ex = j; break; }
      }
      if (ex >= 0) {
        const qd = wBQ[ex] - bQ[i];
        nBP.push(bP[i]); nBQ.push(bQ[i]); nBI.push(wBI[ex]);
        nBL.push(t); nBX.push(qd > wBI[ex] * 0.5 ? 1 : 0); nBE.push(wBE[ex]);
      } else {
        nBP.push(bP[i]); nBQ.push(bQ[i]); nBI.push(bQ[i]);
        nBL.push(t); nBX.push(0); nBE.push(0);
        if (bQ[i] * bP[i] > 100000) {
          addSig('BID_WALL', 'bullish', cl(55 + (bQ[i] / mB) * 4, 55, 92), bP[i],
            'Bid wall ' + bP[i].toFixed(2) + ' ' + bQ[i].toFixed(3), 0);
        }
      }
    }
  }
  wBC = nBP.length;
  for (let i = 0; i < wBC; i++) {
    wBP[i] = nBP[i]; wBQ[i] = nBQ[i]; wBI[i] = nBI[i];
    wBL[i] = nBL[i]; wBX[i] = nBX[i]; wBE[i] = nBE[i];
  }

  // Ask walls
  const nAP: number[] = [], nAQ: number[] = [], nAI: number[] = [];
  const nAL: number[] = [], nAX: number[] = [], nAE: number[] = [];
  const limA = Math.min(aN, 15);
  for (let i = 0; i < limA; i++) {
    if (aQ[i] > thrA) {
      let ex = -1;
      for (let j = 0; j < wAC; j++) {
        if (Math.abs(wAP[j] - aP[i]) / aP[i] < 0.0001) { ex = j; break; }
      }
      if (ex >= 0) {
        const qd = wAQ[ex] - aQ[i];
        nAP.push(aP[i]); nAQ.push(aQ[i]); nAI.push(wAI[ex]);
        nAL.push(t); nAX.push(qd > wAI[ex] * 0.5 ? 1 : 0); nAE.push(wAE[ex]);
      } else {
        nAP.push(aP[i]); nAQ.push(aQ[i]); nAI.push(aQ[i]);
        nAL.push(t); nAX.push(0); nAE.push(0);
        if (aQ[i] * aP[i] > 100000) {
          addSig('ASK_WALL', 'bearish', cl(55 + (aQ[i] / mA) * 4, 55, 92), aP[i],
            'Ask wall ' + aP[i].toFixed(2) + ' ' + aQ[i].toFixed(3), 0);
        }
      }
    }
  }
  wAC = nAP.length;
  for (let i = 0; i < wAC; i++) {
    wAP[i] = nAP[i]; wAQ[i] = nAQ[i]; wAI[i] = nAI[i];
    wAL[i] = nAL[i]; wAX[i] = nAX[i]; wAE[i] = nAE[i];
  }

  // Wall execution ratio (P1-6)
  for (let i = 0; i < wBC; i++) {
    if (wBQ[i] > 0 && wBE[i] / wBQ[i] > 0.7) {
      addSig('WALL_CONSUMED', 'bullish', 75, wBP[i], 'Bid wall consumed @ ' + wBP[i].toFixed(2), 0);
    }
  }
  for (let i = 0; i < wAC; i++) {
    if (wAQ[i] > 0 && wAE[i] / wAQ[i] > 0.7) {
      addSig('WALL_CONSUMED', 'bearish', 75, wAP[i], 'Ask wall consumed @ ' + wAP[i].toFixed(2), 0);
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// SPOOF (P2-I: Confirmation)
// ═══════════════════════════════════════════════════════════════
function detSpoof(): void {
  const t = now();
  for (let i = 0; i < wBC; i++) {
    if (wBX[i] && t - wBL[i] < cSw * 1000) {
      const dist = Math.abs(wBP[i] - mid) / mid;
      if (dist < 0.001) {
        if (wBE[i] < wBQ[i] * 0.1) {
          addSig('SPOOFING', 'bearish', 85, mid,
            'Spoof confirmed: bid wall @ ' + wBP[i].toFixed(2) + ' cancelled near price', 0);
        }
        wBX[i] = 0;
      }
    }
  }
  for (let i = 0; i < wAC; i++) {
    if (wAX[i] && t - wAL[i] < cSw * 1000) {
      const dist = Math.abs(wAP[i] - mid) / mid;
      if (dist < 0.001) {
        if (wAE[i] < wAQ[i] * 0.1) {
          addSig('SPOOFING', 'bullish', 85, mid,
            'Spoof confirmed: ask wall @ ' + wAP[i].toFixed(2) + ' cancelled near price', 0);
        }
        wAX[i] = 0;
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// COMPRESSION (P2-M: Breakout Predictor)
// ═══════════════════════════════════════════════════════════════
function detComp(): void {
  if (bN < 3 || aN < 3 || !mid) return;
  const sp = aP[0] - bP[0], spP = sp / mid * 100;
  let hbw = false, haw = false;
  for (let i = 0; i < wBC; i++) { if ((mid - wBP[i]) / mid < 0.01) { hbw = true; break; } }
  for (let i = 0; i < wAC; i++) { if ((wAP[i] - mid) / mid < 0.01) { haw = true; break; } }
  if (hbw && haw && spP < 0.05 && !compAct) {
    compAct = true;
    let hint = '';
    if (cvd > 0) hint += 'CVD↑ ';
    if (fC > 0 && fPr[(fH - 1 + MF) % MF] > 10) hint += 'Flow↑ ';
    if (tapeSpike) hint += 'Tape↑ ';
    addSig('COMPRESSION', 'warning', 74, mid,
      'Compression spread:' + spP.toFixed(4) + '%' + hint, 0);
  } else if (!hbw || !haw) {
    compAct = false;
  }
}

// ═══════════════════════════════════════════════════════════════
// LADDER
// ═══════════════════════════════════════════════════════════════
function detLad(): void {
  if (wBC < 3) return;
  const s = [...Array(wBC)].map((_, i) => wBP[i]).sort((a, b) => b - a);
  let c = 0;
  for (let i = 0; i < s.length - 2; i++) {
    const g1 = s[i] - s[i + 1], g2 = s[i + 1] - s[i + 2];
    if (g1 > 0 && g2 > 0 && Math.abs(g1 - g2) / g1 < 0.3) c++;
  }
  if (c >= 1 && ladC < c) {
    ladC = c;
    addSig('LADDER', 'bullish', cl(60 + c * 8, 60, 88), s[0], 'Ladder ' + (c + 2) + ' bid walls', 0);
  }
}

// ═══════════════════════════════════════════════════════════════
// SKEW (P2-S: Multi-depth divergence)
// ═══════════════════════════════════════════════════════════════
function detSkew(): void {
  if (bN < 10 || aN < 10) return;
  let bn = 0, an = 0;
  for (let i = 0; i < 10; i++) { bn += bP[i] * bQ[i]; an += aP[i] * aQ[i]; }
  const tot = bn + an;
  if (!tot) return;
  const sk = (bn - an) / tot;
  if (Math.abs(sk) > 0.4) {
    addSig('BOOK_SKEW', sk > 0 ? 'bullish' : 'bearish',
      cl(50 + Math.abs(sk) * 50, 50, 85), mid,
      'Skew ' + (sk > 0 ? 'bid' : 'ask') + ' ' + (Math.abs(sk) * 100).toFixed(1) + '%', 0);
  }
  // Multi-depth skew divergence (P2-S)
  if (Math.abs(obi5 - obi20) > 0.3) {
    addSig('SKEW_DIVERGENCE', obi5 > obi20 ? 'bullish' : 'bearish', 70, mid, 'Surface vs deep skew divergence', 0);
  }
}

// ═══════════════════════════════════════════════════════════════
// VOID (P2-T: Depth Score, P2-U: Fill Tracker)
// ═══════════════════════════════════════════════════════════════
function detVoid(): void {
  if (aN < 10 || bN < 10) return;
  for (let i = 1; i < 10; i++) {
    const g = aP[i] - aP[i - 1], ag = (aP[9] - aP[0]) / 9;
    if (ag > 0 && g > ag * 3) {
      const depth = Math.min(3, Math.floor(g / ag));
      addSig('VOID_ASK', 'bullish', cl(60 + depth * 8, 60, 85), aP[i], 'Ask void @ ' + aP[i].toFixed(2) + ' depth:' + depth, 0);
      voidFillState[i] = 1; voidFillT[i] = now();
      break;
    }
  }
  for (let i = 1; i < 10; i++) {
    const g = bP[i - 1] - bP[i], ag = (bP[0] - bP[9]) / 9;
    if (ag > 0 && g > ag * 3) {
      const depth = Math.min(3, Math.floor(g / ag));
      addSig('VOID_BID', 'bearish', cl(60 + depth * 8, 60, 85), bP[i], 'Bid void @ ' + bP[i].toFixed(2) + ' depth:' + depth, 0);
      voidFillState[i] = 1; voidFillT[i] = now();
      break;
    }
  }
  trackVoidFill();
}

function trackVoidFill(): void {
  for (let i = 0; i < 10; i++) {
    if (voidFillState[i] === 1) {
      const age = now() - voidFillT[i];
      if (age > 5000) voidFillState[i] = 0; // expired
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// P0: GEN PLAN
// ═══════════════════════════════════════════════════════════════
function genPlan(): { dir: string; conf: number; entry: number; sl: number; tp: number; rr: number; confluence: number } | null {
  const t = now();
  let bs = 0, be = 0;
  for (let i = 0; i < Math.min(sC, 30); i++) {
    const x = (sH - 1 - i + MS * 2) % MS;
    if (t - sTm[x] > 30000) break;
    if (sBi[x] === 'bullish') bs += sDe[x];
    else if (sBi[x] === 'bearish') be += sDe[x];
  }
  if (!mid) return { dir: 'NEUTRAL', conf: 0, entry: 0, sl: 0, tp: 0, rr: 0, confluence: 0 };

  let dir: string = 'NEUTRAL', conf = 0;
  if (bs > be + 50) { dir = 'LONG'; conf = cl(50 + (bs - be) / 5, 50, 95); }
  else if (be > bs + 50) { dir = 'SHORT'; conf = cl(50 + (be - bs) / 5, 50, 95); }
  if (dir === 'NEUTRAL') return null;

  const cf = calcConfluence(dir);
  if (cf >= 4) conf = cl(conf + 15, 0, 98);
  if (cf >= 5) conf = cl(conf + 25, 0, 98);

  let sl: number, tp: number;
  if (dir === 'LONG') {
    let wallSl: number | null = null;
    for (let i = 0; i < wAC; i++) { wallSl = wAP[i]; break; }
    sl = wallSl ? wallSl * 0.999 : mid - (aP[0] - bP[0]) * 7.5;
    let voidTp: number | null = null;
    for (let i = 0; i < Math.min(sC, 15); i++) {
      const x = (sH - 1 - i + MS * 2) % MS;
      if (t - sTm[x] > 30000) break;
      if (sTy[x] === 'VOID_ASK') { voidTp = sPr[x]; break; }
    }
    const risk = Math.abs(mid - sl);
    tp = voidTp && Math.abs(voidTp - mid) / risk >= 2.5 ? voidTp : mid + risk * 2.5;
  } else {
    let wallSl: number | null = null;
    for (let i = 0; i < wBC; i++) { wallSl = wBP[i]; break; }
    sl = wallSl ? wallSl * 1.001 : mid + (aP[0] - bP[0]) * 7.5;
    let voidTp: number | null = null;
    for (let i = 0; i < Math.min(sC, 15); i++) {
      const x = (sH - 1 - i + MS * 2) % MS;
      if (t - sTm[x] > 30000) break;
      if (sTy[x] === 'VOID_BID') { voidTp = sPr[x]; break; }
    }
    const risk = Math.abs(sl - mid);
    tp = voidTp && Math.abs(voidTp - mid) / risk >= 2.5 ? voidTp : mid - risk * 2.5;
  }
  const risk = Math.abs(mid - sl);
  const rr = risk > 0 ? Math.abs(tp - mid) / risk : 0;
  if (rr < 2.5) return null;

  sl = normPrice(sl); tp = normPrice(tp);
  return { dir, conf: Math.round(conf), entry: mid, sl, tp, rr, confluence: cf };
}

// ═══════════════════════════════════════════════════════════════
// CALC MICRO (P1-U: True Kelly, P1-V: Confidence-adjusted)
// ═══════════════════════════════════════════════════════════════
function calcMicro(pl: { dir: string; entry: number; sl: number; tp: number; rr: number; conf: number } | null): Record<string, number | string> | null {
  if (!pl || pl.dir === 'NEUTRAL') return null;
  const maxR = cBal * (cRp / 100);
  const rpu = Math.abs(pl.entry - pl.sl);
  if (!rpu) return null;

  // True Kelly (P1-U)
  let W = 0.55; // default win rate
  const R = pl.rr;
  let kelly = W - (1 - W) / R;
  if (kelly < 0) return null;

  // Confidence-adjusted (P1-V)
  kelly = kelly * (pl.conf / 100);

  // Hard risk cap (P1-W)
  const riskPct = Math.min(kelly * 100 / 2, cRp);
  const actualRisk = cBal * (riskPct / 100);
  const actualQty = actualRisk / rpu;
  const actualNot = actualQty * pl.entry;

  let lev = actualNot / cBal;
  lev = Math.min(lev, cMl);
  lev = Math.max(lev, 1);
  const mar = actualNot / lev;
  const fee = actualNot * (cFb / 10000) * 2;
  const be = actualQty > 0 ? fee / actualQty : 0;

  // Tier-based maintenance margin (P1-X)
  let mmr = 0.004;
  if (actualNot > 50000) mmr = 0.005;
  if (actualNot > 250000) mmr = 0.01;
  if (actualNot > 1000000) mmr = 0.025;

  const liq = pl.dir === 'LONG'
    ? pl.entry * (1 - 1 / lev + mmr)
    : pl.entry * (1 + 1 / lev - mmr);

  const fundCost = fundingRate !== 0 ? Math.abs(fundingRate) * actualNot : 0;
  const ordT = vVal > 0.7 ? 'LIMIT ONLY' : 'MARKET';

  return {
    riskPct: Number(riskPct.toFixed(2)),
    notional: actualNot,
    margin: mar,
    lev: Number(lev.toFixed(1)),
    be,
    liq,
    kelly: Number((kelly * 100).toFixed(1)),
    ordT,
    fundCost,
  };
}

// ═══════════════════════════════════════════════════════════════
// NARRATIVE (P2-W, P2-X, P2-Y)
// ═══════════════════════════════════════════════════════════════
function genNarrative(pl: { dir: string; conf: number; rr: number; confluence: number } | null): string {
  if (!pl || pl.dir === 'NEUTRAL') {
    return '🟡 ' + regime + ' | Piyasa net yonlu sinyal uretmiyor. Bekleme modunda.';
  }
  const t = now();
  let parts: string[] = [], evidence: string[] = [];
  for (let i = 0; i < Math.min(sC, 10); i++) {
    const x = (sH - 1 - i + MS * 2) % MS;
    if (t - sTm[x] > 30000) break;
    if (sTy[x].includes('WALL')) { parts.push((sTy[x].includes('BID') ? 'Bid' : 'Ask') + ' duvari @ ' + sPr[x].toFixed(2)); evidence.push('WALL'); }
    if (sTy[x].includes('CVD')) { parts.push('CVD ' + (sBi[x] === 'bullish' ? 'pozitif' : 'negatif') + ' uyumsuzluk'); evidence.push('CVD'); }
    if (sTy[x].includes('SPOOF')) { parts.push('Spoofing tespit edildi'); evidence.push('SPOOF'); }
    if (sTy[x].includes('ABSORPTION') || sTy[x].includes('COMPRESSION')) { parts.push('Emilim/sikisma bolgesi'); evidence.push('ABSORB'); }
    if (sTy[x].includes('CASCADE')) { parts.push('Cascade aktivitesi'); evidence.push('CASCADE'); }
    if (sTy[x].includes('ICEBERG')) { parts.push('Iceberg tespiti'); evidence.push('ICEBERG'); }
  }
  if (!parts.length) parts.push(Math.min(sC, 30) + ' sinyal konverjans');

  const regimeEmoji = regime === 'TRENDING' ? '🟢' : regime === 'CHOPPY' ? '🟠' : regime === 'COILING' ? '🔵' : regime === 'CHAOS' ? '🔴' : '⚪';
  return regimeEmoji + ' ' + regime + ' | Fiyat ' + (pl.dir === 'LONG' ? 'yukari' : 'asagi') + ' yonlu baski: ' + parts.join('; ') + '. RR: ' + pl.rr.toFixed(1) + '. Confluence: ' + pl.confluence + '/6';
}

// ═══════════════════════════════════════════════════════════════
// POST STATE (P1-Z: Throttled, P2-AA: Diff-based)
// ═══════════════════════════════════════════════════════════════
function postSt(): void {
  const t = now();
  if (t - lastPostT < 200) return; // Throttle 200ms
  lastPostT = t;

  const pl = genPlan();
  const mi = calcMicro(pl);
  const nar = genNarrative(pl);

  // Signal decay by type (P1-16)
  const sigs: Record<string, unknown>[] = [];
  for (let i = 0; i < Math.min(sC, 30); i++) {
    const x = (sH - 1 - i + MS * 2) % MS;
    if (t - sTm[x] > 120000) break;
    const age = t - sTm[x];
    const dr = decayRate(sTy[x]);
    const decay = Math.exp(-dr * age);
    sigs.push({
      t: sTy[x], b: sBi[x], c: Math.round(sDe[x] * decay),
      p: sPr[x], ts: sTm[x], d: sDs[x], cf: sCf[x], ver: sVer[x],
    });
  }

  const flows: Record<string, number>[] = [];
  for (let i = 0; i < Math.min(fC, 30); i++) {
    const x = (fH - 1 - i + MF * 2) % MF;
    flows.unshift({ p: fPr[x], s: fSt[x], d: fDe[x], b: fBu[x], sl: fSe[x] });
  }

  const cvds: number[] = [];
  for (let i = 0; i < Math.min(cC, 60); i++) {
    const x = (cH - 1 - i + MC * 2) % MC;
    cvds.unshift(cV[x]);
  }

  let ll = 0, ls = 0;
  for (let i = 0; i < lC; i++) {
    const x = (lH - 1 - i + MQ * 2) % MQ;
    if (t - lT[x] > 60000) break;
    if (lS[x] === 1) ll++; else ls++;
  }

  let bd = 0, ad = 0;
  const n10 = Math.min(10, bN, aN);
  for (let i = 0; i < n10; i++) { bd += bP[i] * bQ[i]; ad += aP[i] * aQ[i]; }
  const obi = n10 > 0 ? (bd - ad) / (bd + ad) : 0;

  let mp = 0, wSum = 0, qSum = 0;
  const n5 = Math.min(5, bN, aN);
  for (let i = 0; i < n5; i++) { wSum += bP[i] * bQ[i]; qSum += bQ[i]; wSum += aP[i] * aQ[i]; qSum += aQ[i]; }
  mp = qSum > 0 ? wSum / qSum : mid;
  const spBps = mid > 0 && bN > 0 && aN > 0 ? (aP[0] - bP[0]) / mid * 1e4 : 0;

  postMessage({
    type: 'st', mid, vpin: vVal, cvd, cvds, flows, sigs, plan: pl, micro: mi, narrative: nar,
    planState, planId, planDir, planConf, planEntry, planSL, planTP, planRR,
    planConfluence, planTTL: planTTL > 0 ? Math.round(planTTL / 1000) : 0,
    regime, regimeScore, obi, obi5, obi20, obiDiv, bookVelScore,
    liqLong: ll, liqShort: ls, mp, spBps, absorption: absInfo ? { ...absInfo } : null,
    tapeSpike, tradeRate1s, whaleT1, whaleT3,
    bN, aN,
    bidP: Array.from(bP.subarray(0, bN)), bidQ: Array.from(bQ.subarray(0, bN)),
    askP: Array.from(aP.subarray(0, aN)), askQ: Array.from(aQ.subarray(0, aN)),
    wBC, wBP: Array.from(wBP.subarray(0, wBC)), wBX: Array.from(wBX.subarray(0, wBC)),
    wBE: Array.from(wBE.subarray(0, wBC)),
    wAC, wAP: Array.from(wAP.subarray(0, wAC)), wAX: Array.from(wAX.subarray(0, wAC)),
    wAE: Array.from(wAE.subarray(0, wAC)),
    liqPoolLong, liqPoolShort,
    cascadeChainLen, cascadeChainDir,
  });
  absInfo = null;
}

// ═══════════════════════════════════════════════════════════════
// ON MESSAGE
// ═══════════════════════════════════════════════════════════════
const ctx = self as unknown as DedicatedWorkerGlobalScope;
ctx.onmessage = function (e: MessageEvent): void {
  const m = e.data;
  if (m.cmd === 'book') procBook(m.bids, m.asks);
  else if (m.cmd === 'trade') procTrade(m.p, m.q, m.s, m.t);
  else if (m.cmd === 'liq') procLiq(m.s, m.p, m.q, m.t);
  else if (m.cmd === 'config') {
    if (m.wallMult != null) cWm = m.wallMult;
    if (m.minConf != null) cMc = m.minConf;
    if (m.flowTF != null) cFt = m.flowTF;
    if (m.flowMode != null) cFm = m.flowMode;
    if (m.flowVol != null) cFv = m.flowVol;
    if (m.balance != null) cBal = m.balance;
    if (m.risk != null) cRp = m.risk;
    if (m.maxLev != null) cMl = m.maxLev;
    if (m.fee != null) cFb = m.fee;
    if (m.spoofWin != null) cSw = m.spoofWin;
    if (m.iceMin != null) cIb = m.iceMin;
    if (m.depthLevels != null) cDL = m.depthLevels;
    if (m.heatWin != null) cHW = m.heatWin;
    if (m.planTTL != null) cTTL = m.planTTL;
    if (m.maxHold != null) cHold = m.maxHold;
    if (m.tickSize != null) tickSize = m.tickSize;
    if (m.stepSize != null) stepSize = m.stepSize;
    if (m.minQty != null) minQty = m.minQty;
    if (m.minNotional != null) minNotional = m.minNotional;
    if (m.fundingRate != null) fundingRate = m.fundingRate;
  } else if (m.cmd === 'armPlan') {
    if (planState === 'CANDIDATE') { planState = 'ARMED'; postSt(); }
  } else if (m.cmd === 'cancelPlan') {
    planState = 'NEUTRAL'; planId = ''; planDir = ''; planConf = 0; postSt();
  } else if (m.cmd === 'reset') {
    cvd = 0; cH = 0; cC = 0; tH = 0; tC = 0; fH = 0; fC = 0;
    sH = 0; sC = 0; lH = 0; lC = 0;
    vSum = 0; vCnt = 0; vVal = 0; vBB = 0; vSB = 0; vBN = 0; vBucketSz = 500000;
    fbS = 0; fbB = 0; fbSe = 0; fbA = 0; fbL = 0;
    wBC = 0; wAC = 0; compAct = false; ladC = 0; mid = 0; absInfo = null;
    bookVelScore = 0; tradeRate1s = 0; tapeSpike = false; whaleT1 = 0; whaleT3 = 0;
    cascadeChainLen = 0; cascadeChainDir = 0;
    planState = 'NEUTRAL'; planId = ''; planDir = ''; planConf = 0;
    obi5 = 0; obi10 = 0; obi20 = 0; obiDiv = false;
    for (let i = 0; i < ML; i++) {
      iTr[i] = 0; iDp[i] = 0; iCt[i] = 0; iState[i] = 0; iT[i] = 0;
      voidFillState[i] = 0; voidFillT[i] = 0;
    }
    for (let i = 0; i < 60; i++) { volHist[i] = 0; dirHist[i] = 0; }
    volH = 0; dirH = 0; regime = 'DEAD'; regimeScore = 0;
  }
};

export {};
