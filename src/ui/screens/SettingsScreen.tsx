import { useEffect, useMemo, useState } from 'react'
import { useSettingsStore } from '../../store/settingsStore'
import { useMarketRuntime } from '../../app/RuntimeContext'

const FALLBACK_FUTURES = ['BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XRPUSDT','DOGEUSDT','ADAUSDT','AVAXUSDT','DOTUSDT','LINKUSDT','LTCUSDT','BCHUSDT','FILUSDT','ARBUSDT','OPUSDT','SUIUSDT','APTUSDT','PEPEUSDT','SHIBUSDT','WIFUSDT','ENAUSDT','TAOUSDT','NEARUSDT','UNIUSDT','ATOMUSDT','XLMUSDT','VETUSDT','ICPUSDT','FETUSDT','RNDRUSDT','INJUSDT','SEIUSDT','TIAUSDT','JUPUSDT','PYTHUSDT','BONKUSDT','FLOKIUSDT','ORDIUSDT','1000PEPEUSDT']

function normalizeFuturesSymbol(input: string) {
  const clean = input.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
  return clean ? (clean.endsWith('USDT') ? clean : `${clean}USDT`) : ''
}
const asRecord = (value: unknown): Record<string, unknown> | null => typeof value === 'object' && value !== null ? value as Record<string, unknown> : null
function parseFuturesSymbols(value: unknown, source: 'okx' | 'binance') {
  const payload = asRecord(value), rows = source === 'okx' ? payload?.data : payload?.symbols
  if (!Array.isArray(rows)) return []
  return rows.flatMap(rowValue => {
    const row = asRecord(rowValue)
    if (!row) return []
    if (source === 'okx') {
      const instrument = String(row.instId ?? '')
      return row.state === 'live' && instrument.endsWith('-USDT-SWAP') ? [instrument.replace('-USDT-SWAP', 'USDT').replace('-', '')] : []
    }
    return row.status === 'TRADING' && row.contractType === 'PERPETUAL' && row.quoteAsset === 'USDT' ? [String(row.symbol ?? '')] : []
  }).filter(Boolean)
}

export function SettingsScreen() {
  const settings = useSettingsStore()
  const runtime = useMarketRuntime()
  const [coinInput, setCoinInput] = useState(settings.symbol.replace('-', ''))
  const [showDropdown, setShowDropdown] = useState(false)
  const [futuresCoins, setFuturesCoins] = useState<string[]>(FALLBACK_FUTURES)

  useEffect(() => {
    const controller = new AbortController()
    const url = settings.source === 'okx' ? 'https://www.okx.com/api/v5/public/instruments?instType=SWAP' : 'https://fapi.binance.com/fapi/v1/exchangeInfo'
    fetch(url, { signal: controller.signal }).then(response => response.json() as Promise<unknown>).then(data => {
      const symbols = parseFuturesSymbols(data, settings.source)
      if (symbols.length > 20) setFuturesCoins(symbols.filter(symbol => !symbol.includes('_')))
    }).catch(error => { if (!(error instanceof DOMException && error.name === 'AbortError')) setFuturesCoins(FALLBACK_FUTURES) })
    return () => controller.abort()
  }, [settings.source])

  const filteredCoins = useMemo(() => {
    const query = coinInput.toUpperCase()
    return (query ? futuresCoins.filter(coin => coin.includes(query)) : futuresCoins).slice(0, 8)
  }, [coinInput, futuresCoins])

  const selectCoin = (coin: string) => {
    const normalized = normalizeFuturesSymbol(coin)
    if (!normalized) return
    setCoinInput(normalized); setShowDropdown(false)
    if (normalized !== settings.symbol.replace('-', '')) settings.setSymbol(normalized)
  }
  const weightLabels = { w1: 'CVD', w2: 'OBI', w3: 'Velocity', w4: 'Microprice', w5: 'VPIN', w6: 'Detector' } as const
  const total = Object.values(settings.weights).reduce((sum, value) => sum + value, 0)

  const toggles = [
    { label: 'Sesli uyarı', description: 'Yalnızca yeni teyitli sinyalde kısa ton.', value: settings.sound, set: settings.setSound },
    { label: 'Haptik geri bildirim', description: 'Desteklenen mobil tarayıcılarda sinyal titreşimi.', value: settings.haptics, set: settings.setHaptics },
    { label: 'Azaltılmış hareket', description: 'Arayüz geçişlerini en aza indirir.', value: settings.reducedMotion, set: settings.setReducedMotion }
  ]

  return (
    <section className="screen" data-testid="screen-settings">
      <div className="screen-heading"><div className="screen-heading__copy"><p className="eyebrow">Yapılandırma</p><h1>Ayarlar</h1><p className="screen-heading__description">Veri kaynağı, futures sembolü ve karar modeli parametreleri.</p></div></div>

      <div className="settings-grid">
        <div className="panel settings-panel">
          <div className="panel__header"><div><p className="eyebrow">Piyasa</p><h2>Kaynak ve sembol</h2></div><span className="status-badge">{settings.symbol}</span></div>
          <div className="panel__body settings-stack">
            <div className="field"><span className="field__label">Borsa kaynağı</span><div className="segmented settings-source">{(['okx', 'binance'] as const).map(source => <button key={source} type="button" data-testid={`source-${source}`} className="segmented__button" aria-pressed={settings.source === source} onClick={() => settings.setSource(source)}>{source.toUpperCase()}</button>)}</div><span className="field__hint">OKX varsayılan; erişim ağ ve bölgeye göre değişebilir.</span></div>
            <div className="field symbol-picker"><label className="field__label" htmlFor="symbol-input">Futures sembolü</label><div className="symbol-picker__input-row"><input id="symbol-input" className="input mono" data-testid="symbol-input" role="combobox" aria-expanded={showDropdown} aria-controls="symbol-options" aria-autocomplete="list" value={coinInput} onChange={event => { setCoinInput(event.target.value.toUpperCase()); setShowDropdown(true) }} onFocus={() => setShowDropdown(true)} onBlur={() => window.setTimeout(() => setShowDropdown(false), 150)} onKeyDown={event => { if (event.key === 'Enter') selectCoin(coinInput) }} placeholder="BTCUSDT" /><button type="button" className="button button--primary" data-testid="symbol-submit" onClick={() => selectCoin(coinInput)}>Seç</button></div>
              {showDropdown && <div id="symbol-options" className="symbol-options" role="listbox">{filteredCoins.map(coin => <button type="button" role="option" aria-selected={coin === settings.symbol.replace('-', '')} key={coin} onMouseDown={() => selectCoin(coin)}>{coin}<span>{coin === settings.symbol.replace('-', '') ? 'Aktif' : ''}</span></button>)}{!filteredCoins.length && <p>Sonuç yok. Enter ile {normalizeFuturesSymbol(coinInput)} sembolünü kullanın.</p>}</div>}
              <span className="field__hint">Aktif sözleşme: {settings.source === 'okx' ? settings.symbol.replace('USDT', '-USDT-SWAP') : settings.symbol}</span>
            </div>
          </div>
        </div>

        <div className="panel settings-panel">
          <div className="panel__header"><div><p className="eyebrow">Karar modeli</p><h2>İndikatör ağırlıkları</h2></div><span className="status-badge">Normalize %100</span></div>
          <div className="panel__body settings-stack">
            {(Object.keys(weightLabels) as (keyof typeof weightLabels)[]).map(key => <label className="weight-control" key={key}><span><b>{weightLabels[key]}</b><output className="numeric">{Math.round(settings.weights[key] / total * 100)}%</output></span><input className="range" type="range" min="0" max="1" step="0.05" value={settings.weights[key]} onChange={event => settings.setWeights({ ...settings.weights, [key]: Number(event.target.value) })} /></label>)}
            <p className="field__hint">Ağırlıklar her değişiklikte güvenli biçimde yeniden normalize edilir.</p>
          </div>
        </div>
      </div>

      <div className="panel settings-panel"><div className="panel__header"><div><p className="eyebrow">Sinyal politikası</p><h2>Eşik ve teyit</h2></div></div><div className="panel__body control-grid">
        <label className="weight-control"><span><b>Eşik</b><output className="numeric">{settings.threshold.toFixed(1)}</output></span><input className="range" type="range" min="0.3" max="1.2" step="0.1" value={settings.threshold} onChange={event => settings.setThreshold(Number(event.target.value))} /></label>
        <label className="weight-control"><span><b>Cooldown</b><output className="numeric">{settings.cooldown}s</output></span><input className="range" type="range" min="5" max="30" step="1" value={settings.cooldown} onChange={event => settings.setCooldown(Number(event.target.value))} /></label>
        <label className="weight-control"><span><b>Aynı yön teyidi</b><output className="numeric">{settings.confirmations}</output></span><input className="range" type="range" min="1" max="5" step="1" value={settings.confirmations} onChange={event => settings.setConfirmations(Number(event.target.value))} /></label>
      </div></div>

      <div className="settings-grid">
        <div className="panel settings-panel"><div className="panel__header"><div><p className="eyebrow">Erişilebilirlik</p><h2>Geri bildirim</h2></div></div><div className="panel__body">{toggles.map(toggle => <div className="toggle-row" key={toggle.label}><div className="toggle-row__copy"><span className="toggle-row__title">{toggle.label}</span><span className="toggle-row__description">{toggle.description}</span></div><button type="button" className="toggle" role="switch" aria-label={toggle.label} aria-checked={toggle.value} onClick={() => toggle.set(!toggle.value)} /></div>)}</div></div>
        <div className="panel settings-panel"><div className="panel__header"><div><p className="eyebrow">QA araçları</p><h2>Test sinyali</h2></div></div><div className="panel__body settings-stack"><p className="text-secondary">Yalnızca arayüz ve kâğıt işlem akışını doğrulamak için işaretli test sinyali üretir.</p><div className="button-row"><button type="button" data-testid="inject-buy" className="button button--buy" onClick={() => runtime?.injectTestSignal('BUY')}>Test ALIM üret</button><button type="button" data-testid="inject-sell" className="button button--sell" onClick={() => runtime?.injectTestSignal('SELL')}>Test SATIM üret</button></div></div></div>
      </div>
      <div className="notice notice--warning">Ayar değişiklikleri bir strateji önerisi değildir. ClaimMoney araştırma ve simülasyon aracıdır.</div>
    </section>
  )
}
