import { useEffect, useRef } from 'react'
import { createChart, ColorType, CrosshairMode, type CandlestickData, type HistogramData,
  type IChartApi, type ISeriesApi, type SeriesMarker, type UTCTimestamp } from 'lightweight-charts'
import { useDataStore } from '../../store/dataStore'

const theme = { bg: '#0b1220', text: '#9aacbf', grid: '#1b2a40', buy: '#22c55e', sell: '#ef4444', cyan: '#22d3ee', warning: '#f59e0b' }

export function ChartScreen() {
  const candles = useDataStore(state => state.candles)
  const flowCandles = useDataStore(state => state.flowCandles)
  const signals = useDataStore(state => state.signals)
  const containerRef = useRef<HTMLDivElement>(null)
  const flowRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const flowChartRef = useRef<IChartApi | null>(null)
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const histRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const flowSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const initializedRef = useRef(false)
  const flowInitializedRef = useRef(false)

  useEffect(() => {
    if (!containerRef.current) return
    const common = {
      layout: { background: { type: ColorType.Solid, color: theme.bg }, textColor: theme.text, fontFamily: 'Inter, system-ui, sans-serif' },
      grid: { vertLines: { color: theme.grid }, horzLines: { color: theme.grid } },
      rightPriceScale: { borderColor: theme.grid },
      timeScale: { borderColor: theme.grid, timeVisible: true, secondsVisible: false }
    }
    const chart = createChart(containerRef.current, { ...common, width: containerRef.current.clientWidth, height: 350, crosshair: { mode: CrosshairMode.Normal } })
    chartRef.current = chart
    const candleSeries = chart.addCandlestickSeries({ upColor: theme.buy, downColor: theme.sell, borderVisible: false, wickUpColor: theme.buy, wickDownColor: theme.sell })
    candleSeriesRef.current = candleSeries
    histRef.current = chart.addHistogramSeries({ color: theme.cyan, priceFormat: { type: 'volume' }, priceScaleId: '', priceLineVisible: false })
    chart.priceScale('').applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } })

    if (flowRef.current) {
      const flowChart = createChart(flowRef.current, { ...common, width: flowRef.current.clientWidth, height: 150 })
      flowChartRef.current = flowChart
      flowSeriesRef.current = flowChart.addHistogramSeries({ priceFormat: { type: 'price', precision: 1, minMove: 0.1 }, priceLineVisible: false })
      flowChart.priceScale('right').applyOptions({ scaleMargins: { top: 0.1, bottom: 0.1 } })
    }

    const observer = new ResizeObserver(() => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth })
      if (flowRef.current && flowChartRef.current) flowChartRef.current.applyOptions({ width: flowRef.current.clientWidth })
    })
    observer.observe(containerRef.current)
    if (flowRef.current) observer.observe(flowRef.current)
    return () => { observer.disconnect(); chart.remove(); flowChartRef.current?.remove() }
  }, [])

  useEffect(() => {
    if (!candleSeriesRef.current || candles.length === 0) return
    const candleData: CandlestickData<UTCTimestamp>[] = candles.map(candle => ({ time: candle.time as UTCTimestamp, open: candle.open, high: candle.high, low: candle.low, close: candle.close }))
    const volumeDelta: HistogramData<UTCTimestamp>[] = candles.map(candle => {
      const delta = (candle.buyVolume ?? 0) - (candle.sellVolume ?? 0)
      return { time: candle.time as UTCTimestamp, value: delta, color: delta >= 0 ? 'rgba(34,197,94,.55)' : 'rgba(239,68,68,.55)' }
    })
    if (!initializedRef.current) {
      candleSeriesRef.current.setData(candleData); histRef.current?.setData(volumeDelta); chartRef.current?.timeScale().fitContent(); initializedRef.current = true
    } else {
      candleSeriesRef.current.update(candleData[candleData.length - 1]); histRef.current?.update(volumeDelta[volumeDelta.length - 1])
    }
    const markers = signals.filter(signal => signal.ts).slice(0, 20).map((signal): SeriesMarker<UTCTimestamp> => ({
      time: (Math.floor(signal.ts / 1000 / 15) * 15) as UTCTimestamp,
      position: signal.side === 'BUY' ? 'belowBar' : 'aboveBar', color: signal.side === 'BUY' ? theme.buy : theme.sell,
      shape: signal.side === 'BUY' ? 'arrowUp' : 'arrowDown', text: `${signal.side} ${signal.confidence}%`
    })).reverse()
    candleSeriesRef.current.setMarkers(markers)
  }, [candles, signals])

  useEffect(() => {
    if (!flowSeriesRef.current || flowCandles.length === 0) return
    const data: HistogramData<UTCTimestamp>[] = flowCandles.map(frame => ({
      time: Math.floor(frame.ts / 1000) as UTCTimestamp, value: frame.pressureClose,
      color: frame.absorption ? 'rgba(245,158,11,.9)' : frame.pressureClose >= 0 ? 'rgba(34,197,94,.65)' : 'rgba(239,68,68,.65)'
    }))
    if (!flowInitializedRef.current) { flowSeriesRef.current.setData(data); flowChartRef.current?.timeScale().fitContent(); flowInitializedRef.current = true }
    else flowSeriesRef.current.update(data[data.length - 1])
  }, [flowCandles])

  const last = flowCandles.at(-1)
  const profile = last?.volumeProfile ?? []
  const topLevels = [...profile].sort((a, b) => b.total - a.total).slice(0, 8)

  return (
    <section className="screen" data-testid="screen-chart">
      <div className="screen-heading"><div className="screen-heading__copy"><p className="eyebrow">Fiyat keşfi</p><h1>Chart</h1><p className="screen-heading__description">15 saniyelik mum, gerçek işlem deltası ve akış basıncı.</p></div><span className="status-badge">{candles.length} mum</span></div>
      <div className="chart-grid">
        <div className="panel chart-panel"><div className="panel__header"><div><p className="eyebrow">Yerel toplama</p><h2>15s mum grafiği</h2></div><div className="chart-legend"><span><i className="legend-swatch legend-swatch--buy" />Alış</span><span><i className="legend-swatch legend-swatch--sell" />Satış</span></div></div><div ref={containerRef} className="chart-canvas" aria-label="Fiyat mum grafiği" /></div>
        <div className="panel chart-panel"><div className="panel__header"><div><p className="eyebrow">−100 — +100</p><h2>Akış basıncı</h2></div><span className="status-badge status-badge--warning">Amber: absorpsiyon</span></div><div ref={flowRef} className="chart-canvas chart-canvas--flow" aria-label="Akış basıncı grafiği" /></div>
      </div>
      <div className="panel footprint-panel">
        <div className="panel__header"><div><p className="eyebrow">Son akış kovası</p><h2>Hacim profili</h2></div><span className="status-badge">{last ? `POC ${last.pocPrice.toFixed(2)}` : 'Veri bekleniyor'}</span></div>
        {!last || !topLevels.length ? <div className="empty-state"><p>İşlem akışı bekleniyor.</p></div> : <div className="footprint-table">
          <div className="footprint-table__head"><span>Fiyat</span><span>Alış</span><span>Dağılım</span><span>Satış</span></div>
          {topLevels.map(level => {
            const buyShare = level.total ? level.buyVol / level.total * 100 : 50
            const absorption = last.absorptionLevels.some(item => Math.abs(item.price - level.price) < 0.01)
            return <div key={level.price} className="footprint-row" data-absorption={absorption}>
              <strong className="numeric">{level.price.toFixed(2)}</strong><span className="numeric text-buy">{level.buyVol.toFixed(0)}</span>
              <progress value={buyShare} max="100" aria-label={`Alış payı yüzde ${buyShare.toFixed(0)}`} /><span className="numeric text-sell">{level.sellVol.toFixed(0)}</span>
            </div>
          })}
        </div>}
      </div>
      <div className="notice">Mumlar yerel 15 saniye toplama ile oluşturulur. İşaretler teyitli sinyalleri; alt hacim ise gerçek alış−satış deltasını gösterir.</div>
    </section>
  )
}
