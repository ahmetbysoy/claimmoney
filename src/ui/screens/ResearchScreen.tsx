import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { useMarketRuntime } from '../../app/RuntimeContext'
import { buildResearchReport, type ResearchGroupMetric } from '../../performance/researchAnalytics'
import { LocalResearchRepository, RESEARCH_HORIZONS, type ResearchObservation } from '../../performance/researchRepository'
import { downloadJson } from '../../performance/persistence'
import type { HorizonKey } from '../../core/performance/signalTracker'

const repository = new LocalResearchRepository()
const pct = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(3)}%`
const readinessLabel = { collecting: 'VERİ TOPLANIYOR', exploratory: 'KEŞİFSEL', 'review-ready': 'İNCELEMEYE HAZIR' } as const

export function ResearchScreen() {
  const runtime = useMarketRuntime()
  const [observations, setObservations] = useState<ResearchObservation[]>(() => repository.list())
  const [horizon, setHorizon] = useState<HorizonKey>('60s')
  const [savedAt, setSavedAt] = useState(0)
  const [importStatus, setImportStatus] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  const refresh = useCallback(() => {
    if (runtime) repository.upsert(runtime.exportResearchObservations())
    setObservations(repository.list())
    setSavedAt(Date.now())
  }, [runtime])

  useEffect(() => {
    refresh()
    const timer = window.setInterval(refresh, 15_000)
    return () => window.clearInterval(timer)
  }, [refresh])

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
    } catch (error) {
      setImportStatus(`İçe aktarma hatası: ${error instanceof Error ? error.message : String(error)}`)
    } finally { input.value = '' }
  }

  const clear = () => {
    if (!window.confirm('Yerel araştırma gözlemleri silinsin mi? Bu işlem geri alınamaz.')) return
    repository.clear(); setObservations([]); setSavedAt(Date.now()); setImportStatus('Yerel dataset silindi.')
  }

  return <div data-testid="screen-research" className="scrollbar-thin" style={{ padding: 14, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 11 }}>
    <section style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
        <div><div style={title}>RESEARCH DATASET</div><div style={{ fontSize: 20, fontWeight: 900 }}>{readinessLabel[report.readiness]}</div></div>
        <span style={{ ...badge, color: report.readiness === 'review-ready' ? 'var(--green)' : report.readiness === 'exploratory' ? 'var(--amber)' : 'var(--purple-deep)' }}>{report.eligible} örnek</span>
      </div>
      <div style={muted}>Yalnızca olgunlaşmış forward-return sonuçları kullanılır. Test sinyalleri rapordan otomatik çıkarılır.</div>
      <Progress label={`Örnek ${report.eligible}/${report.targetSamples}`} value={sampleProgress} />
      <Progress label={`Zaman penceresi ${report.spanDays.toFixed(1)}/7 gün`} value={dayProgress} />
      <div style={grid}><Metric label="Yerelde saklı" value={String(report.totalStored)} /><Metric label="Bekleyen" value={String(report.pending)} /><Metric label="Test hariç" value={String(report.excludedTest)} /><Metric label="WF fold" value={String(report.walkForward.folds)} /></div>
    </section>

    <section style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}><div style={title}>ÖLÇÜM UFUKLARI</div><div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {RESEARCH_HORIZONS.map(item => <button key={item} onClick={() => setHorizon(item)} data-testid={`research-horizon-${item}`} style={{ ...button, background: horizon === item ? 'var(--purple-soft)' : 'white', color: horizon === item ? 'var(--purple-deep)' : 'var(--muted)' }}>{item}</button>)}
      </div></div>
      <div style={muted}>Seçili ufuk: <b>{horizon}</b>. Sonuçlar yüzde forward return olarak raporlanır.</div>
    </section>

    <GroupTable title="REJİM PERFORMANSI" items={report.byRegime} />
    <GroupTable title="DETECTOR KATKISI" items={report.byDetector} note="Sinyaller birden çok detector grubunda yer alabilir; bu tablo nedensel attribution değildir." />
    <GroupTable title="SEMBOL PERFORMANSI" items={report.bySymbol} />

    <section style={card}>
      <div style={title}>KALİBRASYON</div>
      {!report.calibration.length ? <div style={muted}>Olgunlaşmış sonuç bekleniyor.</div> : report.calibration.map(bin => <div key={bin.lower} style={row}>
        <span>|score| {bin.lower.toFixed(2)}–{bin.upper.toFixed(2)} <small style={muted}>n={bin.samples}</small></span>
        <span style={{ textAlign: 'right' }}>Gözlenen {(bin.observedWinRate * 100).toFixed(0)}% • shrunk {(bin.shrunkenProbability * 100).toFixed(0)}%<br /><small style={{ color: Math.abs(bin.calibrationGap) <= .1 ? 'var(--green)' : 'var(--amber)' }}>confidence gap {(bin.calibrationGap * 100).toFixed(0)}pp</small></span>
      </div>)}
      <div style={muted}>Küçük örneklerde Beta(2,2) shrinkage hesaplanır; ekran gözlenen oranı ve güven farkını gösterir.</div>
    </section>

    <section style={card}>
      <div style={title}>PURGED WALK-FORWARD</div>
      {!report.walkForward.aggregate ? <div style={muted}>En az 30 olgun örnek gerekli.</div> : <div style={grid}>
        <Metric label="Test örneği" value={String(report.walkForward.aggregate.samples)} />
        <Metric label="Win rate" value={`${(report.walkForward.aggregate.winRate * 100).toFixed(1)}%`} />
        <Metric label="Expectancy" value={pct(report.walkForward.aggregate.expectancy)} />
        <Metric label="Max DD" value={`${report.walkForward.aggregate.maxDrawdown.toFixed(3)}pt`} />
      </div>}
    </section>

    <section style={{ ...card, display: 'flex', flexDirection: 'column', gap: 7 }}>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        <button data-testid="research-checkpoint" style={button} onClick={refresh}>Checkpoint</button>
        <button style={button} onClick={() => downloadJson(`claimmoney-research-${Date.now()}.json`, { ...repository.export(), report })}>Dataset dışa aktar</button>
        <button style={button} onClick={() => fileInput.current?.click()}>Dataset içe aktar</button>
        <input ref={fileInput} data-testid="research-import-input" hidden type="file" accept=".json,application/json" onChange={importDataset} />
        <button style={{ ...button, color: 'var(--red)' }} onClick={clear}>Yerel veriyi sil</button>
      </div>
      {importStatus && <div style={{ ...muted, color: importStatus.includes('hatası') ? 'var(--red)' : 'var(--green)' }}>{importStatus}</div>}
      <div style={muted}>{savedAt ? `Son checkpoint ${new Date(savedAt).toLocaleTimeString()}` : 'Checkpoint bekleniyor'} • Veriler yalnızca bu tarayıcıda tutulur.</div>
      <div style={{ ...muted, color: 'var(--amber)' }}>Sekme görünür ve canlı akış bağlı kalmalıdır. “İncelemeye hazır” etiketi kârlılık kanıtı değildir.</div>
    </section>
  </div>
}

function GroupTable({ title: label, items, note }: { title: string; items: ResearchGroupMetric[]; note?: string }) {
  return <section style={card}><div style={title}>{label}</div>{!items.length ? <div style={muted}>Yeterli sonuç yok.</div> : items.slice(0, 12).map(item => <div key={item.key} style={row}>
    <span style={{ fontWeight: 700 }}>{item.key}<br /><small style={muted}>n={item.samples}</small></span>
    <span style={{ textAlign: 'right', color: item.expectancy >= 0 ? 'var(--green)' : 'var(--red)' }}>{(item.winRate * 100).toFixed(0)}% win<br /><small>{pct(item.expectancy)} exp</small></span>
  </div>)}{note && <div style={muted}>{note}</div>}</section>
}
function Progress({ label, value }: { label: string; value: number }) { return <div style={{ marginTop: 7 }}><div style={{ ...muted, display: 'flex', justifyContent: 'space-between' }}><span>{label}</span><span>{value.toFixed(0)}%</span></div><div style={{ height: 7, borderRadius: 99, overflow: 'hidden', background: 'var(--surface-2)' }}><div style={{ height: '100%', width: `${value}%`, background: 'linear-gradient(90deg,var(--purple),var(--cyan))' }} /></div></div> }
function Metric({ label, value }: { label: string; value: string }) { return <div style={{ padding: 8, borderRadius: 10, background: 'rgba(255,255,255,.75)' }}><div style={muted}>{label}</div><b>{value}</b></div> }
const card = { padding: 12, borderRadius: 14, background: 'rgba(255,255,255,.72)', border: '1px solid var(--border-soft)' }
const title = { fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 800, color: 'var(--purple-deep)', marginBottom: 6 }
const muted = { fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--muted)', marginTop: 2 }
const badge = { border: '1px solid var(--border)', borderRadius: 999, padding: '5px 8px', fontFamily: 'var(--font-mono)', fontSize: 9, whiteSpace: 'nowrap' as const }
const button = { border: '1px solid var(--border)', borderRadius: 8, background: 'white', padding: '6px 8px', fontSize: 8, cursor: 'pointer' }
const grid = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginTop: 8 }
const row = { display: 'flex', justifyContent: 'space-between', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--border-soft)', fontFamily: 'var(--font-mono)', fontSize: 10 }
