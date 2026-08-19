'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createBozokWorker, type BozokWorkerHandle, type WorkerMessageHandler } from '@/lib/engine/worker/create-worker';

// ─── Worker State ───────────────────────────────────────────────────────

export interface WorkerFlow {
  p: number;
  s: number;
  d: number;
  b: number;
  sl: number;
}

export interface WorkerSignal {
  t: string;
  b: string;
  c: number;
  p: number;
  ts: number;
  d: string;
  cf: number;
  ver: number;
}

export interface WorkerPlan {
  dir: string;
  conf: number;
  rr: number;
  confluence: number;
  entry: number;
  sl: string;
  tp: string;
  riskPct?: number;
  notional?: number;
  margin?: number;
  lev?: number;
  be?: number;
  liq?: number;
  kelly?: number;
  ordT?: string;
  fundCost?: number;
}

export interface WorkerMicro {
  riskPct: number;
  notional: number;
  margin: number;
  lev: number;
  be: number;
  liq: number;
  kelly: number;
  ordT: string;
  fundCost: number;
}

export interface WorkerAbsorption {
  side: string;
  level: number;
  ratio: number;
  notional: number;
  ts: number;
}

export interface BozokState {
  mid: number;
  vpin: number;
  cvd: number;
  cvds: number[];
  flows: WorkerFlow[];
  sigs: WorkerSignal[];
  plan: WorkerPlan | null;
  micro: WorkerMicro | null;
  narrative: string;
  planState: string;
  planId: string;
  planDir: string;
  planConf: number;
  planEntry: number;
  planSL: number;
  planTP: number;
  planRR: number;
  planConfluence: number;
  planTTL: number;
  regime: string;
  regimeScore: number;
  obi: number;
  obi5: number;
  obi20: number;
  obiDiv: boolean;
  bookVelScore: number;
  liqLong: number;
  liqShort: number;
  mp: number;
  spBps: number;
  absorption: WorkerAbsorption | null;
  tapeSpike: boolean;
  tradeRate1s: number;
  whaleT1: number;
  whaleT3: number;
  bN: number;
  aN: number;
  bidP: number[];
  bidQ: number[];
  askP: number[];
  askQ: number[];
  wBC: number;
  wBP: number[];
  wBX: number[];
  wBE: number[];
  wAC: number;
  wAP: number[];
  wAX: number[];
  wAE: number[];
  liqPoolLong: number[];
  liqPoolShort: number[];
  cascadeChainLen: number;
  cascadeChainDir: number;
}

const INITIAL_STATE: BozokState = {
  mid: 0, vpin: 0, cvd: 0, cvds: [], flows: [], sigs: [],
  plan: null, micro: null, narrative: '',
  planState: 'NEUTRAL', planId: '', planDir: '', planConf: 0,
  planEntry: 0, planSL: 0, planTP: 0, planRR: 0,
  planConfluence: 0, planTTL: 0,
  regime: 'DEAD', regimeScore: 0,
  obi: 0, obi5: 0, obi20: 0, obiDiv: false, bookVelScore: 0,
  liqLong: 0, liqShort: 0, mp: 0, spBps: 0, absorption: null,
  tapeSpike: false, tradeRate1s: 0, whaleT1: 0, whaleT3: 0,
  bN: 0, aN: 0, bidP: [], bidQ: [], askP: [], askQ: [],
  wBC: 0, wBP: [], wBX: [], wBE: [],
  wAC: 0, wAP: [], wAX: [], wAE: [],
  liqPoolLong: [], liqPoolShort: [],
  cascadeChainLen: 0, cascadeChainDir: 0,
};

export type ConnStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

const OKX_WS_URL = 'wss://ws.okx.com:8443/ws/v5/public';

// ─── OKX Message Processing (standalone, no React deps) ──────────────────

function processOkxMessage(
  text: string,
  sendToWorker: (msg: Record<string, unknown>) => void,
  bookSeqRef: { current: number },
): void {
  if (text.includes('"event":"subscribe"') || text.includes('"event":"error"')) return;

  let parsed: Record<string, unknown>;
  try { parsed = JSON.parse(text); } catch { return; }

  const arg = parsed.arg as { channel: string } | undefined;
  if (!arg) return;

  if (arg.channel === 'books5') {
    const data = (parsed.data as { bids: string[][]; asks: string[][]; ts: string }[])?.[0];
    if (!data) return;
    const bids: number[][] = data.bids.map(b => [parseFloat(b[0]), parseFloat(b[1])]);
    const asks: number[][] = data.asks.map(a => [parseFloat(a[0]), parseFloat(a[1])]);
    bookSeqRef.current++;
    sendToWorker({ cmd: 'book', bids, asks, ts: parseInt(data.ts, 10), seq: bookSeqRef.current });
  }

  if (arg.channel === 'trades') {
    const trades = parsed.data as { px: string; sz: string; side: string; ts: string }[];
    if (!trades) return;
    for (const tr of trades) {
      sendToWorker({
        cmd: 'trade',
        p: parseFloat(tr.px), q: parseFloat(tr.sz),
        s: tr.side === 'buy' ? 0 : 1, t: parseInt(tr.ts, 10),
      });
    }
  }
}

// ─── Hook ───────────────────────────────────────────────────────────────

export function useBozokWorker() {
  const [state, setState] = useState<BozokState>(INITIAL_STATE);
  const [connStatus, setConnStatus] = useState<ConnStatus>('disconnected');
  const [symbol, setSymbolRaw] = useState('');
  const workerRef = useRef<BozokWorkerHandle | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempts = useRef(0);
  const bookSeqRef = useRef(0);
  const mountedRef = useRef(true);
  const connectFnRef = useRef<(id: string) => void>(() => {});

  // Handle worker messages
  const handleMessage: WorkerMessageHandler = useCallback((msg) => {
    if (!mountedRef.current) return;
    if (msg.type === 'st') {
      setState(prev => ({ ...prev, ...msg.diff }));
    } else if (msg.type === 'error') {
      console.error('[BozokWorker]', msg.msg);
    }
  }, []);

  // Create worker on mount
  useEffect(() => {
    mountedRef.current = true;
    let handle: BozokWorkerHandle | null = null;
    (async () => {
      try {
        handle = await createBozokWorker(handleMessage);
        if (mountedRef.current) workerRef.current = handle;
      } catch (err) {
        console.error('[BozokWorker] Failed to create worker:', err);
      }
    })();
    return () => { mountedRef.current = false; handle?.terminate(); workerRef.current = null; };
  }, [handleMessage]);

  // Cleanup WS helper
  const cleanupWs = useCallback(() => {
    if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close(); wsRef.current = null; }
    if (reconnectTimer.current) { clearTimeout(reconnectTimer.current); reconnectTimer.current = null; }
  }, []);

  // Connect/disconnect on unmount
  useEffect(() => {
    return () => { cleanupWs(); };
  }, [cleanupWs]);

  // The connection function — stored in ref so reconnect can call latest version
  const doConnect = useCallback((instId: string) => {
    if (!instId) return;
    cleanupWs();
    reconnectAttempts.current = 0;
    setConnStatus('connecting');

    const ws = new WebSocket(OKX_WS_URL);
    wsRef.current = ws;

    const sendToWorker = (msg: Record<string, unknown>) => { workerRef.current?.send(msg as never); };

    ws.onopen = () => {
      if (!mountedRef.current) return;
      setConnStatus('connected');
      reconnectAttempts.current = 0;
      ws.send(JSON.stringify({
        op: 'subscribe',
        args: [{ channel: 'books5', instId }, { channel: 'trades', instId }],
      }));
      workerRef.current?.send({ cmd: 'reset' });
      bookSeqRef.current = 0;
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      wsRef.current = null;
      setConnStatus(prev => prev === 'connected' ? 'disconnected' : prev);
      if (instId) {
        const delay = Math.min(1000 * 2 ** reconnectAttempts.current, 30000);
        reconnectAttempts.current++;
        reconnectTimer.current = setTimeout(() => connectFnRef.current(instId), delay);
      }
    };

    ws.onerror = () => { if (mountedRef.current) setConnStatus('error'); };

    ws.onmessage = (evt: MessageEvent) => {
      if (!mountedRef.current || !workerRef.current) return;
      try {
        const raw = evt.data;
        if (raw instanceof Blob) {
          const reader = new FileReader();
          reader.onload = () => { if (typeof reader.result === 'string') processOkxMessage(reader.result, sendToWorker, bookSeqRef); };
          reader.readAsText(raw);
          return;
        }
        processOkxMessage(typeof raw === 'string' ? raw : new TextDecoder().decode(raw), sendToWorker, bookSeqRef);
      } catch { /* ignore */ }
    };
  }, [cleanupWs]);

  // Keep ref in sync
  useEffect(() => { connectFnRef.current = doConnect; }, [doConnect]);

  // setSymbol: handles both connect and disconnect, no effect needed
  const setSymbol = useCallback((newSymbol: string) => {
    const trimmed = newSymbol.trim();
    if (trimmed === symbol) return;

    if (!trimmed) {
      cleanupWs();
      setSymbolRaw('');
      setState(INITIAL_STATE);
      setConnStatus('disconnected');
      return;
    }

    const instId = trimmed.endsWith('-SWAP') ? trimmed : `${trimmed}-SWAP`;
    setSymbolRaw(trimmed);
    doConnect(instId);
  }, [symbol, cleanupWs, doConnect]);

  const sendConfig = useCallback((cfg: Record<string, unknown>) => {
    workerRef.current?.send({ cmd: 'config', ...cfg } as never);
  }, []);

  const armPlan = useCallback(() => { workerRef.current?.send({ cmd: 'armPlan' }); }, []);

  const cancelPlan = useCallback(() => { workerRef.current?.send({ cmd: 'cancelPlan' }); }, []);

  const resetWorker = useCallback(() => {
    workerRef.current?.send({ cmd: 'reset' });
    setState(INITIAL_STATE);
    bookSeqRef.current = 0;
  }, []);

  return {
    state, connStatus, symbol, setSymbol,
    sendConfig, armPlan, cancelPlan, resetWorker,
  };
}
