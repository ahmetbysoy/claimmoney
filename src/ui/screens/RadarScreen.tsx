import { useMemo, useState } from 'react'
import { useDataStore } from '../../store/dataStore'
import { useSettingsStore } from '../../store/settingsStore'
import { RadarGauge } from '../components/RadarGauge'
import { MeterBar } from '../components/MeterBar'
import { PriceTicker } from '../components/PriceTicker'

const descriptions: Record<string, string> = {
  CVD: 'İşlem akışındaki agresif alış ve satış farkının standartlaştırılmış görünümü.',
  OBI: 'İlk emir defteri kademelerindeki alış ve satış likiditesi arasındaki normalize fark.',
  VEL: 'Kısa dönem fiyat hareket hızının standartlaştırılmış yönsel katkısı.',
  MIC: 'Mikro fiyat ile işlem fiyatı arasındaki normalize edilmiş sapma.',
  VPIN: 'Hacim kovalarında gözlenen akış toksisitesinin 0–1 arası özeti.',
  DET: 'Aktif mikroyapı dedektörlerinin yönsel bileşik katkısı.'
}

export function RadarScreen() {
  const metrics = useDataStore(state => state.metrics)
  const engineState = useDataStore(state => state.engineState)
  const signals = useDataStore(state => state.signals)
  const price = useDataStore(state => state.price)
  const regime = useDataStore(state => state.regime)
  const symbol = useDataStore(state => state.symbol)
  const threshold = useSettingsStore(state => state.threshold)
  const [selectedFeature, setSelectedFeature] = useState<number | null>(null)

  const score = metrics.score
  const confidence = Math.min(100, Math.round((Math.abs(score) / 3) * 100))
  const side: 'BUY' | 'SELL' | 'NEUTRAL' = score > threshold ? 'BUY' : score < -threshold ? 'SELL' : 'NEUTRAL'
  const tone = side === 'BUY' ? 'buy' : side === 'SELL' ? 'sell' : 'neutral'
  const lastSignal = signals[0]
  const features = useMemo(() => [
    ['CVD', metrics.cvdZ, -3, 3, metrics.cvdZ.toFixed(2)] as const,
    ['OBI', metrics.obi, -1, 1, metrics.obi.toFixed(2)] as const,
    ['VEL', metrics.velocityZ, -3, 3, metrics.velocityZ.toFixed(2)] as const,
    ['MIC', metrics.microDev, -1, 1, metrics.microDev.toFixed(2)] as const,
    ['VPIN', metrics.vpin, 0, 1, `${metrics.vpin.toFixed(2)} · ${metrics.vpinLabel}`] as const,
    ['DET', metrics.detectorScore, -1, 1, metrics.detectorScore.toFixed(2)] as const
  ], [metrics])
  const selected = selectedFeature === null ? null : features[selectedFeature]

  return (
    <section className="screen radar-screen" data-testid="screen-radar">
      <div className="screen-heading">
        <div className="screen-heading__copy">
          <p className="eyebrow">Canlı analiz</p><h1>Sinyal radarı</h1>
          <p className="screen-heading__description">Mikroyapı ve işlem akışından üretilen açıklanabilir bileşik görünüm.</p>
        </div>
        <span className={`status-badge ${metrics.quality === 'good' ? 'status-badge--buy' : 'status-badge--warning'}`}>
          <span className="status-dot" aria-hidden="true" />Veri {metrics.quality}
        </span>
      </div>

      <div className="radar-layout">
        <div className="panel radar-hero">
          <div className="radar-hero__ticker"><PriceTicker price={price} symbol={symbol} /></div>
          <RadarGauge score={score} confidence={confidence} side={side} engineState={engineState} />
          <div className="radar-confirmation" data-tone={tone}>
            <div><p className="eyebrow">Karar durumu</p><strong>{side}</strong></div>
            <div className="radar-confirmation__count numeric">{Math.abs(score).toFixed(2)}<span> / {threshold.toFixed(2)}</span></div>
          </div>
        </div>

        <div className="panel feature-panel">
          <div className="panel__header"><div><p className="eyebrow">Model girdileri</p><h2>Özellik katkıları</h2></div><span className="status-badge">6 metrik</span></div>
          <div className="panel__body metric-grid">
            {features.map(([label, value, min, max], index) => <MeterBar key={label} label={label} value={value} min={min} max={max} onClick={() => setSelectedFeature(index)} />)}
          </div>
        </div>
      </div>

      <div className="radar-meta-grid">
        <div className="panel panel--flat radar-stat"><span className="eyebrow">Piyasa rejimi</span><strong>{regime.regime}</strong><small>{(regime.confidence * 100).toFixed(0)}% sınıflandırma güveni</small></div>
        <div className="panel panel--flat radar-stat"><span className="eyebrow">Son teyitli sinyal</span><strong className={lastSignal?.side === 'BUY' ? 'text-buy' : lastSignal?.side === 'SELL' ? 'text-sell' : ''}>{lastSignal ? lastSignal.side : 'Yok'}</strong><small>{lastSignal ? new Date(lastSignal.ts).toLocaleTimeString('tr-TR') : 'Eşik ve filtreler izleniyor'}</small></div>
        <div className="panel panel--flat radar-stat"><span className="eyebrow">Karar modeli</span><strong>Şeffaf ağırlıklı skor</strong><small>Tek başına işlem emri değildir</small></div>
      </div>

      {selected && (
        <div className="metric-detail" role="dialog" aria-modal="true" aria-labelledby="metric-detail-title">
          <button type="button" className="metric-detail__backdrop" aria-label="Detayı kapat" onClick={() => setSelectedFeature(null)} />
          <div className="metric-detail__panel panel">
            <div className="panel__header"><div><p className="eyebrow">Özellik detayı</p><h2 id="metric-detail-title">{selected[0]}</h2></div><button type="button" className="button button--ghost" onClick={() => setSelectedFeature(null)}>Kapat</button></div>
            <div className="panel__body metric-detail__body">
              <strong className="metric-detail__value numeric">{selected[4]}</strong><p>{descriptions[selected[0]]}</p>
              <p className="text-muted">Bu değer tek başına işlem kararı değildir; bileşik skor içinde ağırlıklı bir girdidir.</p>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
