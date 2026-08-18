interface Props {
  connection: 'connected' | 'connecting' | 'disconnected'
  source: string
  symbol: string
}

export function Header({ connection, source, symbol }: Props) {
  const connected = connection === 'connected'
  return (
    <header className="app-header">
      <div className="app-header__inner">
        <div className="brand">
          <div className="brand__mark" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M3 14.5 7.1 9l3 2.8L16.8 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M13 4h3.8v3.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <div className="brand__name">ClaimMoney</div>
            <div className="brand__meta"><span>{symbol}</span><span className="brand__separator">/</span><span>{source}</span></div>
          </div>
        </div>
        <div className="header-status">
          <div className="connection-pill" data-testid="connection-status" data-state={connection} data-connected={connected} role="status" aria-live="polite">
            <span className="connection-dot" aria-hidden="true" />
            <span className="connection-pill__label">{connected ? 'Canlı veri' : connection === 'connecting' ? 'Bağlanıyor' : 'Bağlantı kesildi'}</span>
          </div>
        </div>
      </div>
    </header>
  )
}
