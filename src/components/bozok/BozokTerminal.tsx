'use client';

import { useState, useCallback } from 'react';
import { useBozokWorker, type ConnStatus } from '@/hooks/use-bozok-worker';
import BookPanel from './panels/BookPanel';
import FlowPanel from './panels/FlowPanel';
import DepthPanel from './panels/DepthPanel';
import SignalsPanel from './panels/SignalsPanel';
import LevelsPanel from './panels/LevelsPanel';
import MarketsPanel from './panels/MarketsPanel';
import PerfPanel from './panels/PerfPanel';
import SettingsPanel from './panels/SettingsPanel';

// ─── Tab Config ──────────────────────────────────────────────────────────

interface Tab {
  id: string;
  label: string;
  shortLabel: string;
  icon: string;
}

const TABS: Tab[] = [
  { id: 'book', label: 'Book', shortLabel: 'B', icon: '📊' },
  { id: 'flow', label: 'Flow', shortLabel: 'F', icon: '📈' },
  { id: 'depth', label: 'Depth', shortLabel: 'D', icon: '📐' },
  { id: 'signals', label: 'Signals', shortLabel: 'S', icon: '⚡' },
  { id: 'levels', label: 'Levels', shortLabel: 'L', icon: '🎯' },
  { id: 'markets', label: 'Markets', shortLabel: 'M', icon: '🌐' },
  { id: 'perf', label: 'Perf', shortLabel: 'P', icon: '📈' },
  { id: 'settings', label: 'Settings', shortLabel: '⚙', icon: '⚙' },
];

const CONN_DOT: Record<ConnStatus, string> = {
  connected: 'bg-[#00c896] shadow-[0_0_6px_#00c896]',
  connecting: 'bg-[#ffa502] shadow-[0_0_6px_#ffa502] animate-pulse',
  disconnected: 'bg-[#556a85]',
  error: 'bg-[#ff4757] shadow-[0_0_6px_#ff4757]',
};

const CONN_LABEL: Record<ConnStatus, string> = {
  connected: 'LIVE',
  connecting: 'CONNECTING...',
  disconnected: 'OFFLINE',
  error: 'ERROR',
};

// ─── Component ───────────────────────────────────────────────────────────

export default function BozokTerminal() {
  const { state, connStatus, symbol, setSymbol, sendConfig, armPlan, cancelPlan, resetWorker } = useBozokWorker();
  const [activeTab, setActiveTab] = useState('book');
  const [symbolInput, setSymbolInput] = useState('BTC-USDT');

  const handleConnect = useCallback(() => {
    if (symbolInput.trim()) {
      setSymbol(symbolInput.trim().toUpperCase());
    }
  }, [symbolInput, setSymbol]);

  const handleDisconnect = useCallback(() => {
    setSymbol('');
    setSymbolInput('');
  }, [setSymbol]);

  const signalCount = state.sigs.length;
  const highConfCount = state.sigs.filter(s => s.c >= 80).length;

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden" style={{ backgroundColor: '#080c14', color: '#e8edf5' }}>
      {/* ── Header ── */}
      <header className="flex-shrink-0 border-b px-3 py-2 flex items-center gap-3" style={{ borderColor: '#1c2940', backgroundColor: '#0a0e17' }}>
        {/* Logo & version */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-sm font-bold tracking-wider" style={{ color: '#06b6d4' }}>BOZOK</span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: '#151d2e', color: '#556a85' }}>v4.0</span>
        </div>

        {/* Symbol input */}
        <div className="flex-1 flex items-center gap-2 max-w-md">
          <div className="flex-1 relative">
            <input
              type="text"
              value={symbolInput}
              onChange={e => setSymbolInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleConnect()}
              placeholder="BTC-USDT"
              className="w-full px-3 py-1.5 rounded text-xs font-mono focus:outline-none"
              style={{
                backgroundColor: '#151d2e',
                border: '1px solid #1c2940',
                color: '#e8edf5',
              }}
            />
          </div>
          {!symbol ? (
            <button
              onClick={handleConnect}
              className="px-3 py-1.5 rounded text-xs font-medium transition-colors"
              style={{ backgroundColor: '#00c896', color: '#080c14' }}
            >
              CONNECT
            </button>
          ) : (
            <button
              onClick={handleDisconnect}
              className="px-3 py-1.5 rounded text-xs font-medium transition-colors"
              style={{ backgroundColor: '#ff4757', color: '#fff' }}
            >
              DISC
            </button>
          )}
        </div>

        {/* Connection status */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`w-2 h-2 rounded-full ${CONN_DOT[connStatus]}`} />
          <span className="text-[10px] font-mono" style={{ color: '#8b9cb8' }}>
            {CONN_LABEL[connStatus]}
          </span>
        </div>

        {/* Signal badge */}
        {signalCount > 0 && (
          <div className="flex-shrink-0 flex items-center gap-1">
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded"
              style={{ backgroundColor: highConfCount > 0 ? '#ff475730' : '#202d42', color: highConfCount > 0 ? '#ff4757' : '#8b9cb8' }}>
              ⚡ {signalCount}{highConfCount > 0 ? ` (${highConfCount}!)` : ''}
            </span>
          </div>
        )}

        {/* Reset button */}
        <button
          onClick={resetWorker}
          className="flex-shrink-0 px-2 py-1 rounded text-[10px] transition-colors"
          style={{ backgroundColor: '#151d2e', color: '#556a85', border: '1px solid #1c2940' }}
          title="Reset engine"
        >
          ↺
        </button>
      </header>

      {/* ── Content Area ── */}
      <main className="flex-1 min-h-0 overflow-hidden">
        {activeTab === 'book' && <BookPanel state={state} />}
        {activeTab === 'flow' && <FlowPanel state={state} />}
        {activeTab === 'depth' && <DepthPanel state={state} />}
        {activeTab === 'signals' && <SignalsPanel state={state} />}
        {activeTab === 'levels' && <LevelsPanel state={state} onArmPlan={armPlan} onCancelPlan={cancelPlan} />}
        {activeTab === 'markets' && <MarketsPanel state={state} />}
        {activeTab === 'perf' && <PerfPanel state={state} />}
        {activeTab === 'settings' && <SettingsPanel sendConfig={sendConfig} />}
      </main>

      {/* ── Bottom Navigation ── */}
      <nav className="flex-shrink-0 flex items-stretch border-t" style={{ borderColor: '#1c2940', backgroundColor: '#0a0e17' }}>
        {TABS.map(tab => {
          const isActive = activeTab === tab.id;
          const badge = tab.id === 'signals' && signalCount > 0 ? signalCount : 0;
          const highBadge = tab.id === 'signals' && highConfCount > 0 ? highConfCount : 0;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex flex-col items-center justify-center py-2 relative transition-colors min-h-[52px] ${
                isActive ? '' : ''
              }`}
              style={{
                backgroundColor: isActive ? '#151d2e' : 'transparent',
                borderTop: isActive ? '2px solid #06b6d4' : '2px solid transparent',
              }}
            >
              <span className="text-base leading-none">{tab.icon}</span>
              <span
                className="text-[9px] mt-0.5 font-medium"
                style={{ color: isActive ? '#e8edf5' : '#556a85' }}
              >
                {tab.shortLabel}
              </span>
              {/* Badge */}
              {badge > 0 && (
                <span
                  className="absolute top-1 right-1/4 min-w-[14px] h-[14px] flex items-center justify-center rounded-full text-[8px] font-bold leading-none px-1"
                  style={{
                    backgroundColor: highBadge > 0 ? '#ff4757' : '#202d42',
                    color: highBadge > 0 ? '#fff' : '#8b9cb8',
                  }}
                >
                  {badge}
                </span>
              )}
              {/* Plan indicator on Levels tab */}
              {tab.id === 'levels' && state.planState !== 'NEUTRAL' && (
                <span className="absolute top-1 left-1/4 w-2 h-2 rounded-full"
                  style={{
                    backgroundColor: state.planState === 'ARMED' ? '#00c896' : '#ffa502',
                    boxShadow: state.planState === 'ARMED' ? '0 0 6px #00c896' : '0 0 6px #ffa502',
                  }}
                />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
