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
  const [stats, setStats] = useState({ leads:0, bookings:0, newBookings:0, todayLeads:0, pendingFollowups:0, revenue:0, pendingPayments:0 })
  const [recentLeads, setRecentLeads] = useState([])
  const [newBookings, setNewBookings] = useState([])
  const [overdueFollowups, setOverdueFollowups] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const today = new Date().toISOString().split('T')[0]
      const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0,0,0,0)
      const val = (r, fallback) => r.status === 'fulfilled' ? r.value : fallback
      const [
        rLeadCount, rBookingCount, rNewBookingCount, rTodayCount, rFollowupCount,
        rRecentL, rNewB, rOverdueF, rPayData
      ] = await Promise.allSettled([
        supabase.from('leads').select('*',{count:'exact',head:true}),
        supabase.from('bookings').select('*',{count:'exact',head:true}),
        supabase.from('bookings').select('*',{count:'exact',head:true}).or('crm_status.eq.new,crm_status.is.null'),
        supabase.from('leads').select('*',{count:'exact',head:true}).gte('created_at',today),
        supabase.from('followups').select('*',{count:'exact',head:true}).eq('done',false).lte('due_date',today),
        supabase.from('leads').select('*').order('created_at',{ascending:false}).limit(5),
        supabase.from('bookings').select('*').order('created_at',{ascending:false}).limit(5),
        supabase.from('followups').select('*, leads(full_name,phone)').eq('done',false).lte('due_date',today).limit(5),
        supabase.from('payments').select('total_amount,balance_due,status').gte('created_at',startOfMonth.toISOString())
      ])
      const leadCount = val(rLeadCount,{}).count
      const bookingCount = val(rBookingCount,{}).count
      const newBookingCount = val(rNewBookingCount,{}).count
      const todayCount = val(rTodayCount,{}).count
      const followupCount = val(rFollowupCount,{}).count
      const payData = val(rPayData,{}).data
      const revenue = (payData||[]).reduce((s,p)=>s+(p.total_amount||0),0)
      const pendingPayments = (payData||[]).reduce((s,p)=>s+(p.balance_due||0),0)
      setStats({ leads:leadCount||0, bookings:bookingCount||0, newBookings:newBookingCount||0, todayLeads:todayCount||0, pendingFollowups:followupCount||0, revenue, pendingPayments })
      setRecentLeads(val(rRecentL,{}).data||[])
      setNewBookings(val(rNewB,{}).data||[])
      setOverdueFollowups(val(rOverdueF,{}).data||[])
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
          <div className="page-sub">{AGENCY_NAME} · {format(new Date(),'EEEE, d MMMM yyyy')}</div>
        </div>
      </div>

      <div className="stats-row">
        <div className="stat-card" style={{cursor:'pointer'}} onClick={()=>onNavigate('leads')}>
          <div className="stat-val">{stats.leads}</div>
          <div className="stat-label">Total leads</div>
          {stats.todayLeads > 0 && <div className="stat-delta delta-up">+{stats.todayLeads} today</div>}
        </div>
        <div className="stat-card" style={{cursor:'pointer'}} onClick={()=>onNavigate('bookings')}>
          <div className="stat-val" style={{color:stats.newBookings>0?'var(--accent)':'inherit'}}>{stats.bookings}</div>
          <div className="stat-label">Web bookings</div>
          {stats.newBookings > 0 && <div className="stat-delta delta-up">{stats.newBookings} new</div>}
        </div>
        <div className="stat-card" style={{cursor:'pointer'}} onClick={()=>onNavigate('followups')}>
          <div className="stat-val" style={{color:stats.pendingFollowups>0?'var(--amber)':'inherit'}}>{stats.pendingFollowups}</div>
          <div className="stat-label">Overdue follow-ups</div>
        </div>
        <div className="stat-card" style={{cursor:'pointer'}} onClick={()=>onNavigate('payments')}>
          <div className="stat-val">₹{(stats.revenue/1000).toFixed(0)}k</div>
          <div className="stat-label">Revenue (month)</div>
        </div>
        <div className="stat-card">
          <div className="stat-val" style={{color:stats.pendingPayments>0?'var(--red)':'inherit'}}>₹{(stats.pendingPayments/1000).toFixed(0)}k</div>
          <div className="stat-label">Pending dues</div>
        </div>
      </div>

      <div className="dash-grid" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:20}}>
        <div className="card">
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
            <strong style={{fontSize:14}}>Latest website bookings</strong>
            <button className="btn btn-sm" onClick={()=>onNavigate('bookings')}>View all</button>
          </div>
          {loading ? <div style={{color:'var(--text2)',fontSize:13}}>Loading…</div> :
            newBookings.length === 0 ? <div className="empty" style={{padding:'20px 0'}}><div className="empty-icon">✦</div>No bookings yet</div> :
            newBookings.map(b => (
              <div key={b.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:'1px solid var(--border)',gap:8,cursor:'pointer'}} onClick={()=>onNavigate('bookings')}>
                <div style={{minWidth:0}}>
                  <div style={{fontWeight:500,fontSize:13,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{b.full_name}</div>
                  <div style={{fontSize:11,color:'var(--text2)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{b.destination||'—'} · {b.travelers} pax</div>
                </div>
                <span className={`pill ${b.crm_status==='converted'?'pill-booked':b.crm_status==='contacted'?'pill-following':'pill-new'}`}>{b.crm_status||'new'}</span>
              </div>
            ))
          }
        </div>

        <div className="card">
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
            <strong style={{fontSize:14}}>Recent leads</strong>
            <button className="btn btn-sm" onClick={()=>onNavigate('leads')}>View all</button>
          </div>
          {loading ? <div style={{color:'var(--text2)',fontSize:13}}>Loading…</div> :
            recentLeads.length === 0 ? <div className="empty" style={{padding:'20px 0'}}><div className="empty-icon">◎</div>No leads yet</div> :
            recentLeads.map(l => (
              <div key={l.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:'1px solid var(--border)',gap:8}}>
                <div style={{minWidth:0}}>
                  <div style={{fontWeight:500,fontSize:13,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{l.full_name}</div>
                  <div style={{fontSize:11,color:'var(--text2)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{l.destination||'—'} · {l.source}</div>
                </div>
                {statusPill(l.status)}
              </div>
            ))
          }
        </div>

        <div className="card">
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
            <strong style={{fontSize:14,color:overdueFollowups.length>0?'var(--amber)':'inherit'}}>
              Follow-ups {overdueFollowups.length>0&&`(${overdueFollowups.length})`}
            </strong>
            <button className="btn btn-sm" onClick={()=>onNavigate('followups')}>View all</button>
          </div>
          {loading ? <div style={{color:'var(--text2)',fontSize:13}}>Loading…</div> :
            overdueFollowups.length === 0 ? <div className="empty" style={{padding:'20px 0'}}><div className="empty-icon">✓</div>All caught up!</div> :
            overdueFollowups.map(f => (
              <div key={f.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:'1px solid var(--border)',gap:8}}>
                <div style={{minWidth:0}}>
                  <div style={{fontWeight:500,fontSize:13,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{f.leads?.full_name||'—'}</div>
                  <div style={{fontSize:11,color:'var(--text2)'}}>{f.type?.replace('_',' ')} · due {f.due_date}</div>
                </div>
                <span className="pill pill-following">overdue</span>
              </div>
            ))
          }
        </div>
      </div>

      {/* Quick nav cards for mobile */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))',gap:10}}>
        {[
          {id:'bookings',icon:'✦',label:'Web bookings',sub:'View form submissions'},
          {id:'itinerary',icon:'◈',label:'Itineraries',sub:'Build & share plans'},
          {id:'reports',icon:'▣',label:'Reports',sub:'Business overview'},
        ].map(item => (
          <div key={item.id} className="card" style={{cursor:'pointer',textAlign:'center',padding:'16px 12px'}} onClick={()=>onNavigate(item.id)}>
            <div style={{fontSize:24,marginBottom:6}}>{item.icon}</div>
            <div style={{fontWeight:500,fontSize:13}}>{item.label}</div>
            <div style={{fontSize:11,color:'var(--text2)',marginTop:2}}>{item.sub}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
