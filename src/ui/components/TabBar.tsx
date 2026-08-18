import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useUIStore } from '../../store/uiStore'
import type { TabId } from '../../types'

type IconName = 'radar' | 'chart' | 'signals' | 'paper' | 'more' | 'book' | 'research' | 'settings' | 'close'

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    radar: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /><path d="m12 12 6-6M12 4v2M4 12h2" /></>,
    chart: <><path d="M4 19V5M4 19h16" /><path d="m7 15 4-4 3 2 5-7" /></>,
    signals: <><path d="M5 16.5a10 10 0 0 1 14 0M8 13a6 6 0 0 1 8 0M11 9.5a2 2 0 0 1 2 0" /><circle cx="12" cy="18" r="1" /></>,
    paper: <><path d="M5 3h10l4 4v14H5z" /><path d="M15 3v5h4M8 12h8M8 16h5" /></>,
    more: <><circle cx="5" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="19" cy="12" r="1.2" /></>,
    book: <><path d="M4 5h6v14H4zM14 5h6v14h-6zM7 9h1M7 13h1M17 9h-1M17 13h-1" /></>,
    research: <><path d="M9 3v6l-4 8a3 3 0 0 0 2.7 4h8.6a3 3 0 0 0 2.7-4l-4-8V3" /><path d="M7 15h10M8 3h8" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a8 8 0 0 0-1.7-1L14.5 3h-5L9 6.1a8 8 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.5a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.4-1a8 8 0 0 0 1.7 1l.5 3.1h5l.5-3.1a8 8 0 0 0 1.7-1l2.4 1 2-3.4-2-1.5a7 7 0 0 0 .1-1Z" /></>,
    close: <path d="m6 6 12 12M18 6 6 18" />
  }
  return <svg className="nav-button__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

const primary: { id: TabId; label: string; icon: IconName }[] = [
  { id: 'radar', label: 'Radar', icon: 'radar' },
  { id: 'chart', label: 'Chart', icon: 'chart' },
  { id: 'signals', label: 'Sinyaller', icon: 'signals' },
  { id: 'paper', label: 'Portföy', icon: 'paper' }
]

const secondary: { id: TabId; label: string; description: string; icon: IconName }[] = [
  { id: 'microstructure', label: 'Mikroyapı', description: 'Emir defteri ve likidite görünümü', icon: 'book' },
  { id: 'research', label: 'Araştırma', description: 'Gözlem ve kalibrasyon metrikleri', icon: 'research' },
  { id: 'settings', label: 'Ayarlar', description: 'Veri kaynağı ve model parametreleri', icon: 'settings' }
]

export function TabBar() {
  const { tab, setTab } = useUIStore()
  const [open, setOpen] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)
  const moreRef = useRef<HTMLButtonElement>(null)
  const drawerRef = useRef<HTMLElement>(null)
  const secondaryActive = secondary.some(item => item.id === tab)

  const closeDrawer = () => {
    setOpen(false)
    window.requestAnimationFrame(() => moreRef.current?.focus())
  }

  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { closeDrawer(); return }
      if (event.key !== 'Tab' || !drawerRef.current) return
      const focusable = [...drawerRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])')]
      const first = focusable[0], last = focusable.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  const navigate = (id: TabId) => {
    setTab(id)
    if (open) closeDrawer()
  }

  return (
    <>
      <nav className="primary-nav" aria-label="Ana navigasyon">
        <div className="primary-nav__inner">
          {primary.map(item => (
            <button
              type="button"
              key={item.id}
              data-testid={`tab-${item.id}`}
              className="nav-button"
              aria-current={tab === item.id ? 'page' : undefined}
              onClick={() => navigate(item.id)}
            >
              <Icon name={item.icon} />
              <span className="nav-button__label">{item.label}</span>
            </button>
          ))}
          <button
            ref={moreRef}
            type="button"
            data-testid="tab-more"
            className="nav-button"
            data-active={open || secondaryActive}
            aria-expanded={open}
            aria-controls="secondary-navigation"
            onClick={() => setOpen(value => !value)}
          >
            <Icon name="more" />
            <span className="nav-button__label">Daha fazla</span>
          </button>
        </div>
      </nav>

      {open && (
        <>
          <button type="button" className="drawer-backdrop" aria-label="Menüyü kapat" onClick={closeDrawer} />
          <aside ref={drawerRef} id="secondary-navigation" className="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
            <div className="drawer__inner">
              <div className="drawer__handle" aria-hidden="true" />
              <div className="drawer__header">
                <div>
                  <p className="eyebrow">Araçlar</p>
                  <h2 id="drawer-title">İkincil görünümler</h2>
                </div>
                <button ref={closeRef} type="button" className="button button--ghost button--icon" aria-label="Menüyü kapat" onClick={closeDrawer}>
                  <Icon name="close" />
                </button>
              </div>
              <nav className="drawer__nav" aria-label="İkincil navigasyon">
                {secondary.map(item => (
                  <button
                    type="button"
                    key={item.id}
                    data-testid={`tab-${item.id}`}
                    className="drawer-link"
                    aria-current={tab === item.id ? 'page' : undefined}
                    onClick={() => navigate(item.id)}
                  >
                    <Icon name={item.icon} />
                    <span className="drawer-link__copy">
                      <span className="drawer-link__label">{item.label}</span>
                      <span className="drawer-link__description">{item.description}</span>
                    </span>
                  </button>
                ))}
              </nav>
            </div>
          </aside>
        </>
      )}
    </>
  )
}
