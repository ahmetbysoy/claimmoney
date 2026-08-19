'use client';

import { useState } from 'react';

interface SettingGroup {
  title: string;
  settings: Setting[];
}

interface Setting {
  key: string;
  label: string;
  type: 'toggle' | 'number' | 'text';
  value: string | number | boolean;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}

interface Props {
  sendConfig: (cfg: Record<string, unknown>) => void;
}

const DEFAULT_SETTINGS: SettingGroup[] = [
  {
    title: 'Data',
    settings: [
      { key: 'tickSize', label: 'Tick Size', type: 'number', value: 0.01, step: 0.01 },
      { key: 'stepSize', label: 'Step Size', type: 'number', value: 0.001, step: 0.001 },
      { key: 'minNotional', label: 'Min Notional', type: 'number', value: 5.0, step: 0.5, unit: '$' },
      { key: 'depthLevels', label: 'Depth Levels', type: 'number', value: 25, min: 5, max: 50, step: 1 },
    ],
  },
  {
    title: 'Flow',
    settings: [
      { key: 'flowTF', label: 'Flow Timeframe', type: 'number', value: 5000, step: 1000, unit: 'ms' },
      { key: 'flowMode', label: 'Flow Mode', type: 'toggle', value: true },
      { key: 'flowVol', label: 'Volume Weighted', type: 'toggle', value: false },
      { key: 'whaleT1', label: 'Whale T1 Threshold', type: 'number', value: 50000, step: 10000, unit: '$' },
      { key: 'whaleT2', label: 'Whale T2 Threshold', type: 'number', value: 200000, step: 50000, unit: '$' },
      { key: 'whaleT3', label: 'Whale T3 Threshold', type: 'number', value: 1000000, step: 100000, unit: '$' },
    ],
  },
  {
    title: 'Detectors',
    settings: [
      { key: 'wallMult', label: 'Wall Multiplier', type: 'number', value: 3.0, min: 1, max: 10, step: 0.5 },
      { key: 'minConf', label: 'Min Confidence', type: 'number', value: 40, min: 0, max: 100, step: 5, unit: '%' },
      { key: 'spoofWin', label: 'Spoof Window', type: 'number', value: 10000, step: 1000, unit: 'ms' },
      { key: 'iceMin', label: 'Iceberg Min Hits', type: 'number', value: 3, min: 1, max: 10, step: 1 },
    ],
  },
  {
    title: 'Risk',
    settings: [
      { key: 'balance', label: 'Balance', type: 'number', value: 10000, step: 1000, unit: '$' },
      { key: 'risk', label: 'Risk Per Trade', type: 'number', value: 2.0, min: 0.1, max: 10, step: 0.1, unit: '%' },
      { key: 'maxLev', label: 'Max Leverage', type: 'number', value: 20, min: 1, max: 125, step: 1, unit: 'x' },
      { key: 'fee', label: 'Fee (bps)', type: 'number', value: 4.0, step: 0.5 },
      { key: 'planTTL', label: 'Plan TTL', type: 'number', value: 30000, step: 5000, unit: 'ms' },
      { key: 'fundingRate', label: 'Funding Rate', type: 'number', value: 0.01, step: 0.001, unit: '%/h' },
    ],
  },
  {
    title: 'Webhook',
    settings: [
      { key: 'webhookUrl', label: 'Webhook URL', type: 'text', value: '' },
      { key: 'webhookEnabled', label: 'Enable Webhook', type: 'toggle', value: false },
    ],
  },
  {
    title: 'UI',
    settings: [
      { key: 'heatWin', label: 'Heatmap Window', type: 'number', value: 5000, step: 1000, unit: 'ms' },
    ],
  },
];

export default function SettingsPanel({ sendConfig }: Props) {
  const [groups, setGroups] = useState<SettingGroup[]>(DEFAULT_SETTINGS);
  const [expandedGroup, setExpandedGroup] = useState<string | null>('Data');

  const updateSetting = (groupTitle: string, key: string, value: string | number | boolean) => {
    setGroups(prev => prev.map(g => {
      if (g.title !== groupTitle) return g;
      return {
        ...g,
        settings: g.settings.map(s => s.key === key ? { ...s, value } : s),
      };
    }));

    // Send to worker immediately
    const cfg: Record<string, unknown> = {};
    cfg[key] = typeof value === 'boolean' ? value : Number(value);
    sendConfig(cfg);
  };

  const toggleGroup = (title: string) => {
    setExpandedGroup(prev => prev === title ? null : title);
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto p-3 gap-2">
      {groups.map(group => (
        <div key={group.title} className="bg-[#0f1520] rounded-lg border border-[#1c2940] overflow-hidden">
          <button
            onClick={() => toggleGroup(group.title)}
            className="w-full flex items-center justify-between px-3 py-2.5 text-left"
          >
            <span className="text-xs font-medium text-[#e8edf5]">{group.title}</span>
            <span className="text-[#556a85] text-xs">{expandedGroup === group.title ? '▼' : '▶'}</span>
          </button>

          {expandedGroup === group.title && (
            <div className="px-3 pb-3 space-y-3 border-t border-[#1c2940] pt-2">
              {group.settings.map(setting => (
                <div key={setting.key} className="flex items-center justify-between">
                  <label className="text-[10px] text-[#8b9cb8]">{setting.label}</label>
                  {setting.type === 'toggle' ? (
                    <button
                      onClick={() => updateSetting(group.title, setting.key, !setting.value)}
                      className={`w-9 h-5 rounded-full relative transition-colors ${
                        setting.value ? 'bg-[#3b82f6]' : 'bg-[#202d42]'
                      }`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                        setting.value ? 'translate-x-4' : 'translate-x-0.5'
                      }`} />
                    </button>
                  ) : setting.type === 'number' ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={setting.value as number}
                        min={setting.min}
                        max={setting.max}
                        step={setting.step}
                        onChange={e => updateSetting(group.title, setting.key, parseFloat(e.target.value) || 0)}
                        className="w-20 bg-[#151d2e] border border-[#1c2940] rounded px-2 py-1 text-[10px] font-mono text-[#e8edf5] text-right focus:outline-none focus:border-[#3b82f6]"
                      />
                      {setting.unit && <span className="text-[9px] text-[#556a85] w-6">{setting.unit}</span>}
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={setting.value as string}
                      onChange={e => updateSetting(group.title, setting.key, e.target.value)}
                      className="w-40 bg-[#151d2e] border border-[#1c2940] rounded px-2 py-1 text-[10px] font-mono text-[#e8edf5] text-right focus:outline-none focus:border-[#3b82f6]"
                      placeholder="Enter URL..."
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Version info */}
      <div className="text-center text-[9px] text-[#556a85] py-2">
        BOZOK PRO v4.0 — Worker Engine
      </div>
    </div>
  );
}
