import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'

const COLORS = ['#003d8f', '#0057b8', '#e5b326', '#1f9d6b', '#5b8def', '#c9941a', '#97a5bf']

export default function Reports() {
  const [leads, setLeads] = useState([])
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: l }, { data: p }] = await Promise.all([
        supabase.from('leads').select('*'),
        supabase.from('payments').select('*')
      ])
      setLeads(l || [])
      setPayments(p || [])
      setLoading(false)
    }
    load()
  }, [])

  const statusCounts = ['new', 'following_up', 'quote_sent', 'booked', 'lost'].map(s => ({
    name: s.replace('_', ' '), value: leads.filter(l => l.status === s).length
  }))

  const sourceCounts = ['manual', 'website', 'whatsapp', 'referral', 'instagram', 'google_ad', 'walk_in'].map(s => ({
    name: s.replace('_', ' '), value: leads.filter(l => l.source === s).length
  })).filter(x => x.value > 0)

  const destCounts = Object.entries(leads.reduce((acc, l) => {
    if (l.destination) acc[l.destination] = (acc[l.destination] || 0) + 1
    return acc
  }, {})).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8)

  // Monthly revenue - last 6 months
  const monthRevenue = (() => {
    const months = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i)
      const label = d.toLocaleString('en-IN', { month: 'short' })
      const revenue = payments.filter(p => {
        const pd = new Date(p.created_at)
        return pd.getMonth() === d.getMonth() && pd.getFullYear() === d.getFullYear()
      }).reduce((s, p) => s + (p.total_amount || 0), 0)
      months.push({ name: label, revenue: Math.round(revenue) })
    }
    return months
  })()

  const convRate = leads.length ? Math.round(leads.filter(l => l.status === 'booked').length / leads.length * 100) : 0
  const totalRevenue = payments.reduce((s, p) => s + (p.total_amount || 0), 0)
  const totalProfit = payments.reduce((s, p) => s + (p.profit || 0), 0)
  const avgBooking = payments.length ? Math.round(totalRevenue / payments.length) : 0

  if (loading) return <div className="page"><div style={{ color: 'var(--text2)' }}>Loading reports…</div></div>

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Reports</div>
          <div className="page-sub">Business health overview</div>
        </div>
      </div>

      <div className="stats-row">
        <div className="stat-card"><div className="stat-val">{leads.length}</div><div className="stat-label">Total leads</div></div>
        <div className="stat-card"><div className="stat-val" style={{ color: 'var(--green)' }}>{convRate}%</div><div className="stat-label">Conversion rate</div></div>
        <div className="stat-card"><div className="stat-val">₹{(totalRevenue / 1000).toFixed(1)}k</div><div className="stat-label">Total revenue</div></div>
        <div className="stat-card"><div className="stat-val" style={{ color: 'var(--accent)' }}>₹{(totalProfit / 1000).toFixed(1)}k</div><div className="stat-label">Est. profit</div></div>
        <div className="stat-card"><div className="stat-val">₹{(avgBooking / 1000).toFixed(1)}k</div><div className="stat-label">Avg. booking value</div></div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",className:"reports-grid", gap: 16, marginBottom: 16 }}>
        <div className="card">
          <div style={{ fontWeight: 500, marginBottom: 14 }}>Revenue (last 6 months)</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthRevenue}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={v => [`₹${Number(v).toLocaleString('en-IN')}`, 'Revenue']} />
              <Bar dataKey="revenue" fill="#0057b8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div style={{ fontWeight: 500, marginBottom: 14 }}>Lead pipeline</div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={statusCounts} cx="50%" cy="50%" outerRadius={75} dataKey="value" label={({ name, value }) => value > 0 ? `${name} (${value})` : ''} labelLine={false}>
                {statusCounts.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div style={{ fontWeight: 500, marginBottom: 14 }}>Leads by source</div>
          {sourceCounts.length === 0 ? <div style={{ color: 'var(--text2)', fontSize: 13 }}>No data yet</div> : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={sourceCounts} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                <Tooltip />
                <Bar dataKey="value" fill="#e5b326" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card">
          <div style={{ fontWeight: 500, marginBottom: 14 }}>Top destinations</div>
          {destCounts.length === 0 ? <div style={{ color: 'var(--text2)', fontSize: 13 }}>No destinations entered yet</div> : (
            <div>
              {destCounts.map((d, i) => (
                <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <div style={{ width: 20, fontSize: 12, color: 'var(--text2)', textAlign: 'right' }}>{i + 1}</div>
                  <div style={{ flex: 1, fontSize: 13 }}>{d.name}</div>
                  <div style={{ width: 80, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${(d.value / destCounts[0].value) * 100}%`, height: '100%', background: 'var(--accent2)', borderRadius: 3 }} />
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', minWidth: 20 }}>{d.value}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div style={{ fontWeight: 500, marginBottom: 14 }}>Lost lead reasons</div>
        {leads.filter(l => l.status === 'lost' && l.lost_reason).length === 0 ?
          <div style={{ color: 'var(--text2)', fontSize: 13 }}>No lost leads with reasons recorded</div> :
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {Object.entries(leads.filter(l => l.lost_reason).reduce((acc, l) => {
              acc[l.lost_reason] = (acc[l.lost_reason] || 0) + 1; return acc
            }, {})).map(([reason, count]) => (
              <div key={reason} style={{ background: 'var(--red-light)', padding: '6px 12px', borderRadius: 20, fontSize: 12, color: 'var(--red)' }}>
                {reason} ({count})
              </div>
            ))}
          </div>
        }
      </div>
    </div>
  )
}
