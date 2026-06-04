import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useTable, useToast } from '../lib/hooks.jsx'
import { appendToSheet, leadToSheetRow } from '../lib/sheets'
import { sendEmail, quoteEmailHtml, waLink, waQuoteMessage } from '../lib/comms'
import { format } from 'date-fns'

const STATUSES = ['new','following_up','quote_sent','booked','lost']
const SOURCES  = ['manual','website','whatsapp','referral','instagram','google_ad','walk_in']
const TRIP_TYPES = ['honeymoon','family','corporate','solo','group','pilgrimage']

const statusPill = (s) => {
  const map = {new:'pill-new',following_up:'pill-following',quote_sent:'pill-quote',booked:'pill-booked',lost:'pill-lost'}
  return <span className={`pill ${map[s]||'pill-new'}`}>{s?.replace('_',' ')}</span>
}

const emptyLead = { full_name:'',email:'',phone:'',source:'manual',destination:'',travel_from:'',travel_to:'',travelers:2,budget_min:'',budget_max:'',trip_type:'',status:'new',assigned_agent:'',notes:'',referral_name:'' }

export default function Leads() {
  const { data: leads, loading, refetch } = useTable('leads')
  const { show, Toast } = useToast()
  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState(emptyLead)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [quoteAmount, setQuoteAmount] = useState('')
  const [quoteNotes, setQuoteNotes] = useState('')

  const filtered = leads.filter(l => {
    const matchStatus = filter === 'all' || l.status === filter
    const matchSearch = !search || l.full_name?.toLowerCase().includes(search.toLowerCase()) || l.phone?.includes(search) || l.destination?.toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchSearch
  })

  async function saveLead() {
    const payload = { ...form, travelers: Number(form.travelers)||2, budget_min: form.budget_min||null, budget_max: form.budget_max||null }
    let result
    if (modal === 'edit' && selected) {
      result = await supabase.from('leads').update({...payload, updated_at: new Date().toISOString()}).eq('id', selected.id)
    } else {
      result = await supabase.from('leads').insert([payload]).select().single()
      if (!result.error) await appendToSheet('Leads', leadToSheetRow(result.data))
    }
    if (result.error) { show('Error: ' + result.error.message, 'error'); return }
    show(modal==='edit' ? 'Lead updated' : 'Lead added + synced to Sheets ✓')
    setModal(null); refetch()
  }

  async function updateStatus(id, status) {
    await supabase.from('leads').update({status, updated_at: new Date().toISOString()}).eq('id', id)
    refetch()
  }

  async function deleteLead(id) {
    if (!confirm('Delete this lead?')) return
    await supabase.from('leads').delete().eq('id', id)
    show('Lead deleted'); refetch()
  }

  function openEdit(lead) {
    setSelected(lead)
    setForm({...emptyLead, ...lead, travel_from: lead.travel_from||'', travel_to: lead.travel_to||''})
    setModal('edit')
  }

  async function sendQuote() {
    if (!selected) return
    const d = { clientName: selected.full_name, destination: selected.destination, from: selected.travel_from, to: selected.travel_to, travelers: selected.travelers, amount: quoteAmount, notes: quoteNotes }
    if (selected.email) {
      const res = await sendEmail({ to: selected.email, toName: selected.full_name, subject: `Your Travel Quote — ${selected.destination||'Custom Package'}`, html: quoteEmailHtml(d) })
      if (res.ok) show('Quote email sent via Brevo ✓')
      else show('Email failed: check Brevo key', 'error')
    }
    await updateStatus(selected.id, 'quote_sent')
    setModal(null)
  }

  const F = (k, v) => setForm(f => ({...f, [k]: v}))

  return (
    <div className="page">
      {Toast}
      <div className="page-header">
        <div>
          <div className="page-title">Leads</div>
          <div className="page-sub">All enquiries — {leads.length} total</div>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm(emptyLead); setModal('add') }}>+ Add lead</button>
      </div>

      <div className="filter-bar">
        <input placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
        {['all',...STATUSES].map(s => (
          <button key={s} className={`filter-btn ${filter===s?'active':''}`} onClick={() => setFilter(s)}>
            {s==='all'?'All':s.replace('_',' ')}
            {s!=='all' && <span style={{marginLeft:4,opacity:.7}}>({leads.filter(l=>l.status===s).length})</span>}
          </button>
        ))}
      </div>

      {/* Desktop table */}
      <div className="card desktop-table" style={{padding:0}}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Client</th><th>Destination</th><th>Dates</th><th>Pax</th><th>Source</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={7} style={{textAlign:'center',padding:32,color:'var(--text2)'}}>Loading…</td></tr> :
                filtered.length === 0 ? <tr><td colSpan={7}><div className="empty">No leads found</div></td></tr> :
                filtered.map(l => (
                  <tr key={l.id}>
                    <td>
                      <div style={{fontWeight:500}}>{l.full_name}</div>
                      <div style={{fontSize:11,color:'var(--text2)'}}>{l.phone}</div>
                      {l.email && <div style={{fontSize:11,color:'var(--text2)'}}>{l.email}</div>}
                    </td>
                    <td>{l.destination || <span style={{color:'var(--text3)'}}>—</span>}</td>
                    <td style={{fontSize:12,color:'var(--text2)'}}>
                      {l.travel_from ? format(new Date(l.travel_from),'dd MMM') : '—'}
                      {l.travel_to ? ` → ${format(new Date(l.travel_to),'dd MMM')}` : ''}
                    </td>
                    <td>{l.travelers}</td>
                    <td><span style={{fontSize:11,color:'var(--text2)'}}>{l.source}</span></td>
                    <td>
                      <select value={l.status} onChange={e => updateStatus(l.id, e.target.value)}
                        style={{border:'none',background:'none',fontSize:11,cursor:'pointer',padding:0,width:'auto',appearance:'none'}}>
                        {STATUSES.map(s => <option key={s} value={s}>{s.replace('_',' ')}</option>)}
                      </select><br/>
                      {statusPill(l.status)}
                    </td>
                    <td>
                      <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                        <button className="btn btn-sm" onClick={() => openEdit(l)}>Edit</button>
                        <button className="btn btn-sm btn-wa" onClick={() => window.open(waLink(l.phone, waQuoteMessage({clientName:l.full_name,destination:l.destination,from:l.travel_from,to:l.travel_to,travelers:l.travelers,amount:l.budget_min||0})),'_blank')}>WA</button>
                        {l.email && <button className="btn btn-sm btn-mail" onClick={() => { setSelected(l); setModal('quote') }}>Quote</button>}
                        <button className="btn btn-sm btn-danger" onClick={() => deleteLead(l.id)}>✕</button>
                      </div>
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile card list */}
      <div className="mobile-list">
        {loading ? <div style={{color:'var(--text2)',padding:'20px 0',textAlign:'center'}}>Loading…</div> :
          filtered.length === 0 ? <div className="empty"><div className="empty-icon">◎</div>No leads found</div> :
          filtered.map(l => (
            <div key={l.id} className="mobile-card">
              <div className="mobile-card-row">
                <div style={{minWidth:0}}>
                  <div style={{fontWeight:600,fontSize:14}}>{l.full_name}</div>
                  <div style={{fontSize:12,color:'var(--text2)',marginTop:2}}>{l.phone} {l.email && `· ${l.email}`}</div>
                </div>
                {statusPill(l.status)}
              </div>
              <div style={{display:'flex',gap:16,fontSize:12,color:'var(--text2)',flexWrap:'wrap'}}>
                {l.destination && <span>📍 {l.destination}</span>}
                {l.travel_from && <span>📅 {format(new Date(l.travel_from),'dd MMM')}{l.travel_to && ` → ${format(new Date(l.travel_to),'dd MMM')}`}</span>}
                <span>👥 {l.travelers} pax</span>
                <span>🔗 {l.source}</span>
              </div>
              <div className="mobile-card-actions">
                <button className="btn btn-sm" onClick={() => openEdit(l)}>Edit</button>
                <button className="btn btn-sm btn-wa" onClick={() => window.open(waLink(l.phone, waQuoteMessage({clientName:l.full_name,destination:l.destination,from:l.travel_from,to:l.travel_to,travelers:l.travelers,amount:l.budget_min||0})),'_blank')}>WhatsApp</button>
                {l.email && <button className="btn btn-sm btn-mail" onClick={() => { setSelected(l); setModal('quote') }}>Send quote</button>}
                <button className="btn btn-sm btn-danger" onClick={() => deleteLead(l.id)}>Delete</button>
              </div>
            </div>
          ))
        }
      </div>

      {/* Add/Edit modal */}
      {(modal === 'add' || modal === 'edit') && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <div className="modal-header">
              <div className="modal-title">{modal==='add'?'Add new lead':'Edit lead'}</div>
              <button className="modal-close" onClick={() => setModal(null)}>×</button>
            </div>
            <div className="form-grid">
              <div className="form-group"><label>Full name *</label><input value={form.full_name} onChange={e=>F('full_name',e.target.value)} /></div>
              <div className="form-group"><label>Phone *</label><input type="tel" value={form.phone} onChange={e=>F('phone',e.target.value)} /></div>
              <div className="form-group"><label>Email</label><input type="email" value={form.email} onChange={e=>F('email',e.target.value)} /></div>
              <div className="form-group"><label>Source</label>
                <select value={form.source} onChange={e=>F('source',e.target.value)}>{SOURCES.map(s=><option key={s} value={s}>{s.replace('_',' ')}</option>)}</select>
              </div>
              <div className="form-group"><label>Destination</label><input value={form.destination} onChange={e=>F('destination',e.target.value)} /></div>
              <div className="form-group"><label>Trip type</label>
                <select value={form.trip_type} onChange={e=>F('trip_type',e.target.value)}><option value="">Select…</option>{TRIP_TYPES.map(t=><option key={t} value={t}>{t}</option>)}</select>
              </div>
              <div className="form-group"><label>Travel from</label><input type="date" value={form.travel_from} onChange={e=>F('travel_from',e.target.value)} /></div>
              <div className="form-group"><label>Travel to</label><input type="date" value={form.travel_to} onChange={e=>F('travel_to',e.target.value)} /></div>
              <div className="form-group"><label>Travellers</label><input type="number" min="1" max="50" value={form.travelers} onChange={e=>F('travelers',e.target.value)} /></div>
              <div className="form-group"><label>Budget min (₹)</label><input type="number" value={form.budget_min} onChange={e=>F('budget_min',e.target.value)} /></div>
              <div className="form-group"><label>Budget max (₹)</label><input type="number" value={form.budget_max} onChange={e=>F('budget_max',e.target.value)} /></div>
              <div className="form-group"><label>Status</label>
                <select value={form.status} onChange={e=>F('status',e.target.value)}>{STATUSES.map(s=><option key={s} value={s}>{s.replace('_',' ')}</option>)}</select>
              </div>
              <div className="form-group"><label>Assigned agent</label><input value={form.assigned_agent} onChange={e=>F('assigned_agent',e.target.value)} /></div>
              <div className="form-group full"><label>Notes</label><textarea value={form.notes} onChange={e=>F('notes',e.target.value)} /></div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveLead}>{modal==='add'?'Add + sync to Sheets':'Save changes'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Quote modal */}
      {modal === 'quote' && selected && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <div className="modal-header">
              <div className="modal-title">Send quote — {selected.full_name}</div>
              <button className="modal-close" onClick={() => setModal(null)}>×</button>
            </div>
            <div className="form-grid">
              <div className="form-group full"><label>Quoted amount (₹) *</label><input type="number" value={quoteAmount} onChange={e=>setQuoteAmount(e.target.value)} placeholder="e.g. 45000" /></div>
              <div className="form-group full"><label>Notes / inclusions</label><textarea value={quoteNotes} onChange={e=>setQuoteNotes(e.target.value)} placeholder="What's included, terms…" /></div>
            </div>
            <div style={{background:'var(--surface2)',borderRadius:8,padding:10,margin:'10px 0',fontSize:12,color:'var(--text2)'}}>
              Email → <strong>{selected.email}</strong> via Brevo · WhatsApp → <strong>{selected.phone}</strong>
            </div>
            <div className="modal-footer">
              <button className="btn btn-wa" onClick={() => { window.open(waLink(selected.phone, waQuoteMessage({clientName:selected.full_name,destination:selected.destination,from:selected.travel_from,to:selected.travel_to,travelers:selected.travelers,amount:quoteAmount})),'_blank'); setModal(null) }}>
                WhatsApp
              </button>
              <button className="btn btn-mail" onClick={sendQuote} disabled={!quoteAmount}>Send Email</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
