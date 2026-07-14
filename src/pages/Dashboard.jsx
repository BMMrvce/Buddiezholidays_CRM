import { useEffect, useState } from 'react'
import { supabase, AGENCY_NAME } from '../lib/supabase'
import { useAuth } from '../lib/auth.jsx'
import { format } from 'date-fns'

const statusPill = (s) => {
  const map = { new:'pill-new', following_up:'pill-following', quote_sent:'pill-quote', booked:'pill-booked', lost:'pill-lost' }
  return <span className={`pill ${map[s]||'pill-new'}`}>{s?.replace('_',' ')}</span>
}

export default function Dashboard({ onNavigate }) {
  const { displayName } = useAuth()
  const [stats, setStats] = useState({ total: 0, today: 0, website: 0, new: 0 })
  const [recentLeads, setRecentLeads] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const today = new Date().toISOString().split('T')[0]
      const [rTotal, rToday, rWebsite, rNew, rRecent] = await Promise.allSettled([
        supabase.from('leads').select('*', { count: 'exact', head: true }),
        supabase.from('leads').select('*', { count: 'exact', head: true }).gte('created_at', today),
        supabase.from('leads').select('*', { count: 'exact', head: true }).eq('source', 'website'),
        supabase.from('leads').select('*', { count: 'exact', head: true }).eq('status', 'new'),
        supabase.from('leads').select('*').order('created_at', { ascending: false }).limit(10),
      ])
      const val = (r) => r.status === 'fulfilled' ? r.value : {}
      setStats({
        total:   val(rTotal).count   || 0,
        today:   val(rToday).count   || 0,
        website: val(rWebsite).count || 0,
        new:     val(rNew).count     || 0,
      })
      setRecentLeads(val(rRecent).data || [])
      setLoading(false)
    }
    load()
  }, [])

  const greeting = new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Good {greeting}{displayName ? `, ${displayName}` : ''} ✦</div>
          <div className="page-sub">{AGENCY_NAME} · {format(new Date(), 'EEEE, d MMMM yyyy')}</div>
        </div>
        <button className="btn btn-primary" onClick={() => onNavigate('leads')}>View all leads</button>
      </div>

      <div className="stats-row">
        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => onNavigate('leads')}>
          <div className="stat-val">{stats.total}</div>
          <div className="stat-label">Total leads</div>
          {stats.today > 0 && <div className="stat-delta delta-up">+{stats.today} today</div>}
        </div>
        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => onNavigate('leads')}>
          <div className="stat-val" style={{ color: stats.new > 0 ? 'var(--accent)' : 'inherit' }}>{stats.new}</div>
          <div className="stat-label">New (unread)</div>
        </div>
        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => onNavigate('leads')}>
          <div className="stat-val">{stats.website}</div>
          <div className="stat-label">From website</div>
        </div>
        <div className="stat-card">
          <div className="stat-val">{stats.today}</div>
          <div className="stat-label">Today's enquiries</div>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <strong style={{ fontSize: 14 }}>Recent leads</strong>
          <button className="btn btn-sm" onClick={() => onNavigate('leads')}>View all</button>
        </div>

        {loading ? (
          <div style={{ color: 'var(--text2)', fontSize: 13 }}>Loading…</div>
        ) : recentLeads.length === 0 ? (
          <div className="empty" style={{ padding: '28px 0' }}>
            <div className="empty-icon">◎</div>
            No leads yet — submit the contact form on the website to see them here.
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Name</th><th>Phone</th><th>Destination</th><th>Source</th><th>Status</th><th>Date</th></tr>
              </thead>
              <tbody>
                {recentLeads.map(l => (
                  <tr key={l.id} style={{ cursor: 'pointer' }} onClick={() => onNavigate('leads')}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{l.full_name}</div>
                      {l.email && <div style={{ fontSize: 11, color: 'var(--text2)' }}>{l.email}</div>}
                    </td>
                    <td style={{ fontSize: 12 }}>{l.phone}</td>
                    <td style={{ fontSize: 12 }}>{l.destination || '—'}</td>
                    <td><span style={{ fontSize: 11, color: 'var(--text2)' }}>{l.source}</span></td>
                    <td>{statusPill(l.status)}</td>
                    <td style={{ fontSize: 11, color: 'var(--text2)' }}>
                      {format(new Date(l.created_at), 'dd MMM, HH:mm')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
