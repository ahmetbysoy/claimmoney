import type { LucideIcon } from 'lucide-react'
import { Activity, BarChart3, LineChart, List, Radar, Settings } from 'lucide-react'
import { useUIStore } from '../../store/uiStore'
import type { TabId } from '../../types'

const tabs: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: 'radar', label: 'Radar', icon: Radar }, { id: 'chart', label: 'Chart', icon: LineChart },
  { id: 'signals', label: 'Sinyal', icon: List }, { id: 'microstructure', label: 'Mikro', icon: Activity },
  { id: 'paper', label: 'Paper', icon: BarChart3 }, { id: 'settings', label: 'Ayar', icon: Settings }
]
export function TabBar() {
  const tab = useUIStore(state => state.tab), setTab = useUIStore(state => state.setTab)
  return <nav aria-label="Ana navigasyon" style={{ display: 'flex', borderTop: '1px solid var(--border-soft)', background: 'rgba(255,255,255,.92)', padding: '6px 5px calc(6px + env(safe-area-inset-bottom))', gap: 3 }}>
    {tabs.map(item => {
      const Icon = item.icon, active = tab === item.id
      return <button key={item.id} data-testid={`tab-${item.id}`} onClick={() => setTab(item.id)} aria-current={active ? 'page' : undefined} className="touch-target" style={{
        flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '7px 1px', borderRadius: 12,
        border: active ? '1px solid var(--pink)' : '1px solid transparent', background: active ? 'var(--pink-soft)' : 'transparent',
        color: active ? 'var(--pink-deep)' : 'var(--muted)', fontSize: 8, fontWeight: active ? 700 : 500, cursor: 'pointer'
      }}><Icon size={14} />{item.label}</button>
    })}
  </nav>
}
