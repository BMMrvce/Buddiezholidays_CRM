import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useTable, useToast } from '../lib/hooks.jsx'
import { sendEmail, followupEmailHtml, waLink, waFollowupMessage, waReminderMessage } from '../lib/comms'
import { format, isPast, isToday } from 'date-fns'

const TYPES = ['call','whatsapp','email','quote','visa_reminder','balance_reminder','pre_departure','post_trip']
const TYPE_MSGS = {
  balance_reminder: (lead) => ({ msg: 'Your balance payment is due soon. Please transfer the remaining amount at the earliest to confirm your booking.' }),
  visa_reminder: () => ({ msg: 'Please ensure your visa application is submitted at the earliest. Contact us if you need any help.' }),
  pre_departure: (lead) => ({ msg: 'Your trip is just around the corner! Please ensure all documents — visa, passport, insurance, and confirmations — are ready.', details: { destination: lead?.destination } }),
  post_trip: (lead) => ({ msg: 'Hope you had an amazing trip! A quick Google review would mean the world to our team.', details: { destination: lead?.destination } }),
  quote: () => ({ msg: 'Following up on the travel quote we sent. Please let us know if you have any questions.' }),
}

export default function FollowUps() {
  const { data: followups, loading, refetch } = useTable('followups')
  const { data: leads } = useTable('leads')
  const { show, Toast } = useToast()
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ lead_id:'', type:'call', due_date:'', channel:'whatsapp', notes:'' })
  const [filter, setFilter] = useState('pending')

  const withLead = followups.map(f => ({...f, lead: leads.find(l => l.id === f.lead_id)}))

  const counts = {
    pending: withLead.filter(f=>!f.done).length,
    overdue: withLead.filter(f=>!f.done && f.due_date && isPast(new Date(f.due_date)) && !isToday(new Date(f.due_date))).length,
    today: withLead.filter(f=>!f.done && f.due_date && isToday(new Date(f.due_date))).length,
    done: withLead.filter(f=>f.done).length,
    all: withLead.length,
  }

  const filtered = withLead.filter(f => {
    if (filter==='pending') return !f.done
    if (filter==='overdue') return !f.done && f.due_date && isPast(new Date(f.due_date)) && !isToday(new Date(f.due_date))
    if (filter==='today') return !f.done && f.due_date && isToday(new Date(f.due_date))
    if (filter==='done') return f.done
    return true
  }).sort((a,b) => new Date(a.due_date) - new Date(b.due_date))

  async function saveFollowup() {
    const { error } = await supabase.from('followups').insert([form])
    if (error) { show('Error: ' + error.message,'error'); return }
    show('Follow-up scheduled ✓'); setModal(false); refetch()
  }

  async function markDone(id) {
    await supabase.from('followups').update({done:true, done_at:new Date().toISOString()}).eq('id',id)
    show('Marked done ✓'); refetch()
  }

  async function sendFollowup(f, channelOverride) {
    const lead = f.lead
    if (!lead) return show('No lead linked','error')
    const channel = channelOverride || f.channel
    const msgFn = TYPE_MSGS[f.type]
    const { msg, details } = msgFn ? msgFn(lead) : { msg: f.notes || 'Follow-up from our team.' }
    if (channel === 'whatsapp' || channel === 'call') {
      const waMsg = ['visa_reminder','balance_reminder','pre_departure','post_trip'].includes(f.type)
        ? waReminderMessage({clientName:lead.full_name, type:f.type, details:{...details, amount:f.notes}})
        : waFollowupMessage({clientName:lead.full_name, message:msg})
      window.open(waLink(lead.phone, waMsg),'_blank')
      show('WhatsApp opened ✓')
    } else if (channel === 'email' && lead.email) {
      const res = await sendEmail({ to:lead.email, toName:lead.full_name, subject:`${f.type.replace('_',' ')} — from your travel agent`, html:followupEmailHtml({clientName:lead.full_name, type:f.type.replace('_',' '), message:msg}) })
      if (res.ok) show('Email sent via Brevo ✓')
      else show('Email failed: check Brevo key','error')
    }
  }

  const rowStyle = (f) => {
    if (f.done) return {}
    if (f.due_date && isPast(new Date(f.due_date)) && !isToday(new Date(f.due_date))) return { borderLeft: '3px solid var(--red)', borderRadius: '0 10px 10px 0' }
    if (f.due_date && isToday(new Date(f.due_date))) return { borderLeft: '3px solid var(--amber)', borderRadius: '0 10px 10px 0' }
    return {}
  }

  return (
    <div className="page">
      {Toast}
      <div className="page-header">
        <div><div className="page-title">Follow-ups</div><div className="page-sub">Reminders, nudges & scheduled messages</div></div>
        <button className="btn btn-primary" onClick={() => { setForm({lead_id:'',type:'call',due_date:'',channel:'whatsapp',notes:''}); setModal(true) }}>+ Schedule</button>
      </div>

      <div className="filter-bar">
        {[['pending','Pending'],['overdue','🔴 Overdue'],['today','🟡 Today'],['done','Done'],['all','All']].map(([v,label]) => (
          <button key={v} className={`filter-btn ${filter===v?'active':''}`} onClick={() => setFilter(v)}>
            {label} ({counts[v]})
          </button>
        ))}
      </div>

      {/* Desktop table */}
      <div className="card desktop-table" style={{padding:0}}>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Client</th><th>Type</th><th>Due date</th><th>Channel</th><th>Notes</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={7} style={{textAlign:'center',padding:32}}>Loading…</td></tr> :
                filtered.length === 0 ? <tr><td colSpan={7}><div className="empty">Nothing here</div></td></tr> :
                filtered.map(f => (
                  <tr key={f.id}>
                    <td><div style={{fontWeight:500}}>{f.lead?.full_name||'—'}</div><div style={{fontSize:11,color:'var(--text2)'}}>{f.lead?.phone}</div></td>
                    <td style={{fontSize:12}}>{f.type?.replace(/_/g,' ')}</td>
                    <td style={{fontSize:12,color:!f.done&&f.due_date&&isPast(new Date(f.due_date))&&!isToday(new Date(f.due_date))?'var(--red)':f.due_date&&isToday(new Date(f.due_date))?'var(--amber)':'inherit',fontWeight:f.due_date&&isToday(new Date(f.due_date))?600:400}}>
                      {f.due_date ? format(new Date(f.due_date),'dd MMM yyyy') : '—'}
                    </td>
                    <td><span className="pill pill-new">{f.channel}</span></td>
                    <td style={{fontSize:12,color:'var(--text2)',maxWidth:140}}>{f.notes||'—'}</td>
                    <td>{f.done ? <span className="pill pill-paid">Done</span> : <span className="pill pill-pending">Pending</span>}</td>
                    <td>{!f.done && (
                      <div style={{display:'flex',gap:4}}>
                        <button className="btn btn-sm btn-wa" onClick={()=>sendFollowup(f,'whatsapp')}>WA</button>
                        {f.lead?.email && <button className="btn btn-sm btn-mail" onClick={()=>sendFollowup(f,'email')}>Mail</button>}
                        <button className="btn btn-sm" onClick={()=>markDone(f.id)}>✓</button>
                      </div>
                    )}</td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile list */}
      <div className="mobile-list">
        {loading ? <div style={{textAlign:'center',padding:20,color:'var(--text2)'}}>Loading…</div> :
          filtered.length === 0 ? <div className="empty"><div className="empty-icon">◷</div>Nothing here</div> :
          filtered.map(f => (
            <div key={f.id} className="mobile-card" style={rowStyle(f)}>
              <div className="mobile-card-row">
                <div style={{minWidth:0}}>
                  <div style={{fontWeight:600,fontSize:14}}>{f.lead?.full_name||'—'}</div>
                  <div style={{fontSize:12,color:'var(--text2)',marginTop:2}}>{f.type?.replace(/_/g,' ')} · {f.channel}</div>
                </div>
                {f.done ? <span className="pill pill-paid">Done</span> : <span className="pill pill-pending">{f.due_date&&isToday(new Date(f.due_date))?'Today':f.due_date&&isPast(new Date(f.due_date))?'Overdue':'Pending'}</span>}
              </div>
              <div style={{fontSize:12,color:'var(--text2)'}}>📅 Due: {f.due_date ? format(new Date(f.due_date),'dd MMM yyyy') : '—'}</div>
              {f.notes && <div style={{fontSize:12,color:'var(--text2)',marginTop:4}}>{f.notes}</div>}
              {!f.done && (
                <div className="mobile-card-actions">
                  <button className="btn btn-sm btn-wa" onClick={()=>sendFollowup(f,'whatsapp')}>WhatsApp</button>
                  {f.lead?.email && <button className="btn btn-sm btn-mail" onClick={()=>sendFollowup(f,'email')}>Email</button>}
                  <button className="btn btn-sm btn-primary" onClick={()=>markDone(f.id)}>✓ Done</button>
                </div>
              )}
            </div>
          ))
        }
      </div>

      {modal && (
        <div className="modal-overlay" onClick={()=>setModal(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-handle"/>
            <div className="modal-header">
              <div className="modal-title">Schedule follow-up</div>
              <button className="modal-close" onClick={()=>setModal(false)}>×</button>
            </div>
            <div className="form-grid">
              <div className="form-group full"><label>Client *</label>
                <select value={form.lead_id} onChange={e=>setForm(f=>({...f,lead_id:e.target.value}))}>
                  <option value="">Select lead…</option>
                  {leads.map(l=><option key={l.id} value={l.id}>{l.full_name} — {l.phone}</option>)}
                </select>
              </div>
              <div className="form-group"><label>Type *</label>
                <select value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>
                  {TYPES.map(t=><option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
                </select>
              </div>
              <div className="form-group"><label>Due date *</label><input type="date" value={form.due_date} onChange={e=>setForm(f=>({...f,due_date:e.target.value}))} /></div>
              <div className="form-group"><label>Channel</label>
                <select value={form.channel} onChange={e=>setForm(f=>({...f,channel:e.target.value}))}>
                  <option value="whatsapp">WhatsApp</option><option value="email">Email</option><option value="call">Call</option>
                </select>
              </div>
              <div className="form-group full"><label>Notes</label><textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Amount due, context…" /></div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={()=>setModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveFollowup}>Schedule</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
