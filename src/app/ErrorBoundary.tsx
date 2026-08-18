import { Component, type ErrorInfo, type ReactNode } from 'react'
import { reportClientError } from '../observability/clientErrorReporter'

interface Props { children: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State { return { error } }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    reportClientError(error, 'react.error-boundary', { componentStack: info.componentStack ? info.componentStack.slice(0, 1_500) : '' })
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <main data-testid="app-error-boundary" role="alert" className="error-page">
        <section className="panel error-card">
          <div className="error-card__mark" aria-hidden="true">!</div>
          <p className="eyebrow">Arayüz koruması</p>
          <h1>ClaimMoney güvenli moda geçti</h1>
          <p>Beklenmeyen arayüz hatası kaydedildi. Açık kâğıt emirler gerçek emir değildir ve hiçbir borsaya gönderilmez.</p>
          <button type="button" className="button button--primary" onClick={() => window.location.reload()}>Uygulamayı yeniden yükle</button>
        </section>
      </main>
    )
  }
}
