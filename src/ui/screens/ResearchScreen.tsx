import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { useMarketRuntime } from '../../app/RuntimeContext'
import { buildResearchReport, type ResearchGroupMetric } from '../../performance/researchAnalytics'
import { LocalResearchRepository, RESEARCH_HORIZONS, type ResearchObservation } from '../../performance/researchRepository'
import { downloadJson } from '../../performance/persistence'
import type { HorizonKey } from '../../core/performance/signalTracker'

const repository = new LocalResearchRepository()
const pct = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(3)}%`
const readinessLabel = { collecting: 'Veri toplanıyor', exploratory: 'Keşifsel', 'review-ready': 'İncelemeye hazır' } as const

function Metric({ label, value }: { label: string; value: string }) { return <div className="research-metric"><span className="eyebrow">{label}</span><strong className="numeric">{value}</strong></div> }
function Progress({ label, value }: { label: string; value: number }) { return <div className="research-progress"><div><span>{label}</span><span className="numeric">{value.toFixed(0)}%</span></div><progress value={value} max="100" aria-label={`${label} yüzde ${value.toFixed(0)}`} /></div> }
function GroupTable({ title, items, note }: { title: string; items: ResearchGroupMetric[]; note?: string }) {
  return <div className="panel research-table"><div className="panel__header"><h2>{title}</h2><span className="status-badge">{items.length} grup</span></div><div className="compact-rows">{!items.length ? <div className="empty-state compact-empty"><p>Yeterli olgun sonuç yok.</p></div> : items.slice(0, 12).map(item => <div key={item.key} className="compact-row"><span><strong>{item.key}</strong><small>n={item.samples}</small></span><span className={`numeric ${item.expectancy >= 0 ? 'text-buy' : 'text-sell'}`}>{(item.winRate * 100).toFixed(0)}% win<small>{pct(item.expectancy)} exp</small></span></div>)}</div>{note && <div className="notice">{note}</div>}</div>
}

export function ResearchScreen() {
  const runtime = useMarketRuntime()
  const [observations, setObservations] = useState<ResearchObservation[]>(() => repository.list())
  const [horizon, setHorizon] = useState<HorizonKey>('60s')
  const [savedAt, setSavedAt] = useState(0)
  const [importStatus, setImportStatus] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const refresh = useCallback(() => { if (runtime) repository.upsert(runtime.exportResearchObservations()); setObservations(repository.list()); setSavedAt(Date.now()) }, [runtime])

  useEffect(() => { refresh(); const timer = window.setInterval(refresh, 15_000); return () => window.clearInterval(timer) }, [refresh])
  const report = useMemo(() => buildResearchReport(observations, horizon), [observations, horizon])
  const sampleProgress = Math.min(100, report.eligible / report.targetSamples * 100)
  const dayProgress = Math.min(100, report.spanDays / 7 * 100)

  const importDataset = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget, file = input.files?.[0]
    if (!file) return
    try {
      const result = repository.import(JSON.parse(await file.text()))
      setObservations(repository.list()); setSavedAt(Date.now())
      setImportStatus(`${result.saved} gözlem içe aktarıldı${result.dropped ? `, ${result.dropped} eski gözlem düşürüldü` : ''}.`)
    } catch (error) { setImportStatus(`İçe aktarma hatası: ${error instanceof Error ? error.message : String(error)}`) }
    finally { input.value = '' }
  }
  const clear = () => { if (!window.confirm('Yerel araştırma gözlemleri silinsin mi? Bu işlem geri alınamaz.')) return; repository.clear(); setObservations([]); setSavedAt(Date.now()); setImportStatus('Yerel dataset silindi.') }

  return (
    <section className="screen" data-testid="screen-research">
      <div className="screen-heading"><div className="screen-heading__copy"><p className="eyebrow">Kanıt katmanı</p><h1>Araştırma</h1><p className="screen-heading__description">Olgun forward-return örneklerini, rejimleri ve kalibrasyon kalitesini inceleyin.</p></div><span className={`status-badge ${report.readiness === 'review-ready' ? 'status-badge--buy' : 'status-badge--warning'}`}>{readinessLabel[report.readiness]}</span></div>

      <div className="panel research-readiness"><div className="panel__body research-readiness__layout"><div><p className="eyebrow">Hazırlık kapısı</p><strong>{report.eligible} / {report.targetSamples}</strong><p className="text-secondary">Test sinyalleri hariç, yalnızca olgunlaşmış gözlemler.</p></div><div className="research-progress-stack"><Progress label="Olgun örnek" value={sampleProgress} /><Progress label={`Zaman penceresi ${report.spanDays.toFixed(1)}/7 gün`} value={dayProgress} /></div></div><div className="research-metrics-grid"><Metric label="Yerelde saklı" value={String(report.totalStored)} /><Metric label="Bekleyen" value={String(report.pending)} /><Metric label="Test hariç" value={String(report.excludedTest)} /><Metric label="WF fold" value={String(report.walkForward.folds)} /></div></div>

      <div className="panel"><div className="panel__header"><div><p className="eyebrow">Ölçüm ufku</p><h2>Forward return penceresi</h2></div><div className="segmented research-horizons">{RESEARCH_HORIZONS.map(item => <button type="button" key={item} data-testid={`research-horizon-${item}`} className="segmented__button" aria-pressed={horizon === item} onClick={() => setHorizon(item)}>{item}</button>)}</div></div><div className="panel__body text-secondary">Sonuçlar seçili <strong>{horizon}</strong> ufkunda yüzde forward return olarak raporlanır.</div></div>

      <div className="research-group-grid"><GroupTable title="Rejim performansı" items={report.byRegime} /><GroupTable title="Dedektör katkısı" items={report.byDetector} note="Gruplar nedensel attribution değildir; bir sinyal birden fazla grupta bulunabilir." /><GroupTable title="Sembol performansı" items={report.bySymbol} /></div>

      <div className="research-lower-grid">
        <div className="panel"><div className="panel__header"><div><p className="eyebrow">Kalibrasyon</p><h2>Skor ve sonuç</h2></div></div><div className="compact-rows">{!report.calibration.length ? <div className="empty-state compact-empty"><p>Olgunlaşmış sonuç bekleniyor.</p></div> : report.calibration.map(bin => <div key={bin.lower} className="compact-row"><span><strong className="numeric">|score| {bin.lower.toFixed(2)}–{bin.upper.toFixed(2)}</strong><small>n={bin.samples}</small></span><span className="numeric">Gözlenen {(bin.observedWinRate * 100).toFixed(0)}%<small>Shrunk {(bin.shrunkenProbability * 100).toFixed(0)}%</small></span></div>)}</div></div>
        <div className="panel"><div className="panel__header"><div><p className="eyebrow">Purged</p><h2>Walk-forward</h2></div></div><div className="panel__body">{!report.walkForward.aggregate ? <div className="empty-state compact-empty"><p>En az 30 olgun örnek gerekli.</p></div> : <div className="research-metrics-grid"><Metric label="Test örneği" value={String(report.walkForward.aggregate.samples)} /><Metric label="Win rate" value={`${(report.walkForward.aggregate.winRate * 100).toFixed(1)}%`} /><Metric label="Expectancy" value={pct(report.walkForward.aggregate.expectancy)} /><Metric label="Max DD" value={`${report.walkForward.aggregate.maxDrawdown.toFixed(3)}pt`} /></div>}</div></div>
      </div>

      <div className="panel"><div className="panel__header"><div><p className="eyebrow">Yerel dataset</p><h2>Veri araçları</h2></div><div className="button-row"><button type="button" data-testid="research-checkpoint" className="button" onClick={refresh}>Checkpoint</button><button type="button" className="button" onClick={() => downloadJson(`claimmoney-research-${Date.now()}.json`, { ...repository.export(), report })}>Dataset dışa aktar</button><button type="button" className="button" onClick={() => fileInput.current?.click()}>Dataset içe aktar</button><input ref={fileInput} data-testid="research-import-input" hidden type="file" accept=".json,application/json" onChange={importDataset} /><button type="button" className="button button--sell" onClick={clear}>Yerel veriyi sil</button></div></div><div className="panel__body settings-stack">{importStatus && <div className={`notice ${importStatus.includes('hatası') ? 'notice--error' : ''}`}>{importStatus}</div>}<p className="text-muted">{savedAt ? `Son checkpoint ${new Date(savedAt).toLocaleTimeString('tr-TR')}` : 'Checkpoint bekleniyor'} · Veriler yalnızca bu tarayıcıda tutulur.</p></div></div>
      <div className="notice notice--warning">“İncelemeye hazır” etiketi kârlılık veya istatistiksel anlamlılık kanıtı değildir.</div>
    </section>
  )
}
