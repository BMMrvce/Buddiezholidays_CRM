import { useState } from 'react'
import Dashboard from './pages/Dashboard'
import Leads from './pages/Leads'
import Bookings from './pages/Bookings'
import ItineraryPage from './pages/ItineraryPage'
import Payments from './pages/Payments'
import FollowUps from './pages/FollowUps'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import Login from './pages/Login'
import { AGENCY_NAME } from './lib/supabase'
import { useAuth } from './lib/auth.jsx'
import logo from './assets/logo.png'
import './App.css'

const NAV = [
  { id: 'dashboard', label: 'Home',      icon: '⬡' },
  { id: 'leads',     label: 'Leads',     icon: '◎' },
  { id: 'bookings',  label: 'Bookings',  icon: '✦' },
  { id: 'itinerary', label: 'Itinerary', icon: '◈' },
  { id: 'followups', label: 'Follow-ups',icon: '◷' },
  { id: 'payments',  label: 'Payments',  icon: '◆' },
  { id: 'reports',   label: 'Reports',   icon: '▣' },
  { id: 'settings',  label: 'Settings',  icon: '◉' },
]

// Only show 5 items in bottom nav (most used)
const MOBILE_NAV = ['dashboard','leads','followups','payments','settings']

const PAGES = { Dashboard, Leads, Bookings, ItineraryPage, FollowUps, Payments, Reports, Settings }
const PAGE_MAP = {
  dashboard: 'Dashboard', leads: 'Leads', bookings: 'Bookings',
  itinerary: 'ItineraryPage', followups: 'FollowUps',
  payments: 'Payments', reports: 'Reports', settings: 'Settings'
}

export default function App() {
  const { user, loading, signOut } = useAuth()
  const [page, setPage] = useState('dashboard')
  const [sideOpen, setSideOpen] = useState(true)
  const PageComp = PAGES[PAGE_MAP[page]]

  if (loading) {
    return (
      <div className="auth-screen">
        <div style={{ color: 'var(--text2)', fontSize: 14 }}>Loading…</div>
      </div>
    )
  }

  if (!user) return <Login />

  return (
    <div className="app-root">
      {/* Desktop/Tablet Sidebar */}
      <aside className={`sidebar ${sideOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-brand">
          <img src={logo} alt={AGENCY_NAME} className="brand-logo" />
          <span className="brand-name">{AGENCY_NAME}</span>
        </div>
        <nav className="sidebar-nav">
          {NAV.map(n => (
            <button
              key={n.id}
              className={`nav-item ${page === n.id ? 'active' : ''}`}
              onClick={() => setPage(n.id)}
            >
              <span className="nav-icon">{n.icon}</span>
              <span className="nav-label">{n.label}</span>
            </button>
          ))}
        </nav>
        <button className="nav-item" onClick={signOut} title="Sign out">
          <span className="nav-icon">⎋</span>
          <span className="nav-label">Sign out</span>
        </button>
        <button className="sidebar-toggle" onClick={() => setSideOpen(o => !o)}>
          {sideOpen ? '←' : '→'}
        </button>
      </aside>

      {/* Main content */}
      <main className="main-content">
        <PageComp onNavigate={setPage} />
      </main>

      {/* Mobile bottom nav */}
      <nav className="mobile-nav">
        <div className="mobile-nav-inner">
          {MOBILE_NAV.map(id => {
            const n = NAV.find(x => x.id === id)
            return (
              <button
                key={id}
                className={`mobile-nav-item ${page === id ? 'active' : ''}`}
                onClick={() => setPage(id)}
              >
                <div className={`mob-icon-wrap`}>
                  <div className="mob-icon">{n.icon}</div>
                </div>
                <span>{n.label}</span>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
