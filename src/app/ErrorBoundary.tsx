import { Component, type ErrorInfo, type ReactNode } from 'react'
import { reportClientError } from '../observability/clientErrorReporter'

interface Props { children: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State { return { error } }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    reportClientError(error, 'react.error-boundary', {
      componentStack: info.componentStack ? info.componentStack.slice(0, 1_500) : ''
    })
  }

  render() {
    if (!this.state.error) return this.props.children
    return <main data-testid="app-error-boundary" role="alert" style={{
      minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24,
      background: '#fff7fb', color: '#31243a', fontFamily: 'system-ui, sans-serif'
    }}>
      <section style={{ width: 'min(480px, 100%)', padding: 24, borderRadius: 20, background: 'white', border: '1px solid #eaddec', boxShadow: '0 18px 50px rgba(77, 39, 89, .12)' }}>
        <div style={{ fontSize: 32 }}>🛟</div>
        <h1 style={{ marginBottom: 8 }}>ClaimMoney güvenli moda geçti</h1>
        <p style={{ lineHeight: 1.5, color: '#6f6275' }}>Beklenmeyen arayüz hatası kaydedildi. Açık paper emirler gerçek emir değildir ve hiçbir borsaya gönderilmez.</p>
        <button onClick={() => window.location.reload()} style={{ width: '100%', marginTop: 12, padding: 12, border: 0, borderRadius: 12, background: '#7c3aed', color: 'white', fontWeight: 700, cursor: 'pointer' }}>Uygulamayı yeniden yükle</button>
      </section>
    </main>
  }
}
