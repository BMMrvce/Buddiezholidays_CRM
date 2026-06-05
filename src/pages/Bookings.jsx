import { useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useTable, useToast } from '../lib/hooks.jsx'
import { waLink } from '../lib/comms'
import { sendEmail } from '../lib/comms'
import { AGENCY_NAME } from '../lib/supabase'
import { format } from 'date-fns'

const CRM_STATUSES = ['new', 'contacted', 'converted', 'archived']
const statusPillClass = { new: 'pill-new', contacted: 'pill-following', converted: 'pill-booked', archived: 'pill-lost' }

const crmStatusPill = (s) => <span className={`pill ${statusPillClass[s] || 'pill-new'}`}>{s || 'new'}</span>

// Pre-filled WhatsApp greeting for a website booking enquiry
function bookingWaMessage(b) {
  return `Hi ${b.full_name}! 👋

Thank you for your enquiry with *${AGENCY_NAME}*.${b.destination ? `\n\nWe'd love to help plan your trip${b.destination ? ` (${b.destination})` : ''}.` : ''} When is a good time to discuss the details?

— ${AGENCY_NAME}`
}

function bookingAckEmailHtml(b) {
  return `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;border:1px solid #eee;border-radius:12px">
  <h2 style="color:#003d8f">Thank you for your enquiry — ${AGENCY_NAME}</h2>
  <p>Dear ${b.full_name},</p>
  <p>We've received your travel enquiry and our team will reach out to you shortly with the best options.</p>
  <table style="width:100%;border-collapse:collapse;margin:16px 0">
    <tr><td style="padding:8px;background:#f3f6fc;font-weight:bold">Vehicle / Destination</td><td style="padding:8px">${b.destination || '—'}</td></tr>
    <tr><td style="padding:8px;background:#f3f6fc;font-weight:bold">Travellers</td><td style="padding:8px">${b.travelers || '—'}</td></tr>
    <tr><td style="padding:8px;background:#f3f6fc;font-weight:bold">Travel dates</td><td style="padding:8px">${b.travel_from || '—'} to ${b.travel_to || '—'}</td></tr>
  </table>
  <p>If anything is urgent, just reply to this email or WhatsApp us.</p>
  <p style="margin-top:24px;font-size:12px;color:#888">— ${AGENCY_NAME} Team</p>
</div>`
}

export default function Bookings() {
  const { data: bookings, loading, refetch } = useTable('bookings')
  const { data: leads } = useTable('leads')
  const { show, Toast } = useToast()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('active')
  const [selected, setSelected] = useState(null)
  const [noteDraft, setNoteDraft] = useState('')

  // booking ids that already exist as leads (avoid duplicate conversion)
  const convertedIds = useMemo(() => new Set(leads.filter(l => l.booking_id).map(l => l.booking_id)), [leads])

  const counts = useMemo(() => ({
    all: bookings.length,
    new: bookings.filter(b => (b.crm_status || 'new') === 'new' && !b.archived).length,
    contacted: bookings.filter(b => b.crm_status === 'contacted' && !b.archived).length,
    converted: bookings.filter(b => b.crm_status === 'converted' || convertedIds.has(b.id)).length,
    archived: bookings.filter(b => b.archived).length,
  }), [bookings, convertedIds])

  const filtered = bookings.filter(b => {
    const status = b.crm_status || 'new'
    const matchSearch = !search || b.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      b.phone?.includes(search) || b.email?.toLowerCase().includes(search.toLowerCase()) ||
      b.destination?.toLowerCase().includes(search.toLowerCase())
    let matchFilter = true
    if (filter === 'active') matchFilter = !b.archived
    else if (filter === 'archived') matchFilter = b.archived
    else if (filter === 'converted') matchFilter = status === 'converted' || convertedIds.has(b.id)
    else matchFilter = status === filter && !b.archived
    return matchSearch && matchFilter
  })

  async function convertToLead(b) {
    if (convertedIds.has(b.id)) { show('Already in the leads pipeline', 'error'); return }
    const { error } = await supabase.from('leads').insert([{
      full_name: b.full_name, email: b.email, phone: b.phone,
      destination: b.destination, travel_from: b.travel_from, travel_to: b.travel_to,
      travelers: b.travelers, notes: b.notes, source: 'website', status: 'new', booking_id: b.id
    }])
    if (error) { show('Error: ' + error.message, 'error'); return }
    await supabase.from('bookings').update({ crm_status: 'converted' }).eq('id', b.id)
    show('Converted to lead in pipeline ✓')
    refetch()
  }

  async function setStatus(b, crm_status) {
    const { error } = await supabase.from('bookings').update({ crm_status }).eq('id', b.id)
    if (error) { show('Error: ' + error.message, 'error'); return }
    refetch()
  }

  async function toggleArchive(b) {
    const { error } = await supabase.from('bookings').update({ archived: !b.archived }).eq('id', b.id)
    if (error) { show('Error: ' + error.message, 'error'); return }
    show(b.archived ? 'Booking restored' : 'Booking archived')
    setSelected(null); refetch()
  }

  async function saveNote(b) {
    const { error } = await supabase.from('bookings').update({ crm_notes: noteDraft }).eq('id', b.id)
    if (error) { show('Error: ' + error.message, 'error'); return }
    show('Note saved ✓')
    setSelected(s => s ? { ...s, crm_notes: noteDraft } : s)
    refetch()
  }

  function openWhatsApp(b) {
    window.open(waLink(b.phone, bookingWaMessage(b)), '_blank')
    if ((b.crm_status || 'new') === 'new') setStatus(b, 'contacted')
  }

  async function sendAck(b) {
    if (!b.email) { show('No email on this booking', 'error'); return }
    const res = await sendEmail({ to: b.email, toName: b.full_name, subject: `We received your enquiry — ${AGENCY_NAME}`, html: bookingAckEmailHtml(b) })
    if (res.ok) { show('Acknowledgement email sent ✓'); if ((b.crm_status || 'new') === 'new') setStatus(b, 'contacted') }
    else show('Email failed: ' + (res.error || 'check Brevo key'), 'error')
  }

  function openDetail(b) {
    setSelected(b)
    setNoteDraft(b.crm_notes || '')
  }

  const FILTERS = [['active', 'Active'], ['new', 'New'], ['contacted', 'Contacted'], ['converted', 'Converted'], ['archived', 'Archived'], ['all', 'All']]

  return (
    <div className="page">
      {Toast}
      <div className="page-header">
        <div>
          <div className="page-title">Web Bookings</div>
          <div className="page-sub">Live enquiries from the Buddiez Holidays website · {counts.all} total</div>
        </div>
        <button className="btn" onClick={refetch}>↻ Refresh</button>
      </div>

      <div className="stats-row">
        <div className="stat-card"><div className="stat-val">{counts.all}</div><div className="stat-label">Total enquiries</div></div>
        <div className="stat-card"><div className="stat-val" style={{ color: 'var(--accent)' }}>{counts.new}</div><div className="stat-label">New / untouched</div></div>
        <div className="stat-card"><div className="stat-val" style={{ color: 'var(--amber)' }}>{counts.contacted}</div><div className="stat-label">Contacted</div></div>
        <div className="stat-card"><div className="stat-val" style={{ color: 'var(--green)' }}>{counts.converted}</div><div className="stat-label">Converted to leads</div></div>
      </div>

      <div className="filter-bar">
        <input placeholder="Search name, phone, email, destination…" value={search} onChange={e => setSearch(e.target.value)} />
        {FILTERS.map(([v, label]) => (
          <button key={v} className={`filter-btn ${filter === v ? 'active' : ''}`} onClick={() => setFilter(v)}>
            {label}{counts[v] != null && <span style={{ marginLeft: 4, opacity: .7 }}>({counts[v]})</span>}
          </button>
        ))}
      </div>

      {/* Desktop table */}
      <div className="card desktop-table" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Client</th><th>Destination</th><th>Travel dates</th>
                <th>Pax</th><th>Booked on</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--text2)' }}>Loading from Supabase…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7}><div className="empty"><div className="empty-icon">✦</div>No bookings found</div></td></tr>
              ) : filtered.map(b => {
                const isConverted = b.crm_status === 'converted' || convertedIds.has(b.id)
                return (
                  <tr key={b.id} style={{ cursor: 'pointer' }} onClick={() => openDetail(b)}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{b.full_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text2)' }}>{b.phone}</div>
                      <div style={{ fontSize: 11, color: 'var(--text2)' }}>{b.email}</div>
                    </td>
                    <td>{b.destination || <span style={{ color: 'var(--text3)' }}>—</span>}</td>
                    <td style={{ fontSize: 12 }}>
                      {b.travel_from ? format(new Date(b.travel_from), 'dd MMM yyyy') : '—'}
                      {b.travel_to ? <><br /><span style={{ color: 'var(--text2)' }}>→ {format(new Date(b.travel_to), 'dd MMM yyyy')}</span></> : ''}
                    </td>
                    <td>{b.travelers}</td>
                    <td style={{ fontSize: 12, color: 'var(--text2)' }}>
                      {b.created_at ? format(new Date(b.created_at), 'dd MMM yyyy') : '—'}
                    </td>
                    <td>{crmStatusPill(isConverted ? 'converted' : (b.crm_status || 'new'))}</td>
                    <td onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        <button className="btn btn-sm btn-wa" title="WhatsApp" onClick={() => openWhatsApp(b)}>WA</button>
                        {b.email && <button className="btn btn-sm btn-mail" title="Send acknowledgement email" onClick={() => sendAck(b)}>Mail</button>}
                        {isConverted
                          ? <button className="btn btn-sm" disabled>✓ In pipeline</button>
                          : <button className="btn btn-sm btn-primary" onClick={() => convertToLead(b)}>→ Pipeline</button>}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile card list */}
      <div className="mobile-list">
        {loading ? <div style={{ color: 'var(--text2)', padding: '20px 0', textAlign: 'center' }}>Loading…</div> :
          filtered.length === 0 ? <div className="empty"><div className="empty-icon">✦</div>No bookings found</div> :
          filtered.map(b => {
            const isConverted = b.crm_status === 'converted' || convertedIds.has(b.id)
            return (
              <div key={b.id} className="mobile-card" onClick={() => openDetail(b)}>
                <div className="mobile-card-row">
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{b.full_name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>{b.phone}{b.email && ` · ${b.email}`}</div>
                  </div>
                  {crmStatusPill(isConverted ? 'converted' : (b.crm_status || 'new'))}
                </div>
                <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text2)', flexWrap: 'wrap' }}>
                  {b.destination && <span>📍 {b.destination}</span>}
                  {b.travel_from && <span>📅 {format(new Date(b.travel_from), 'dd MMM')}{b.travel_to && ` → ${format(new Date(b.travel_to), 'dd MMM')}`}</span>}
                  <span>👥 {b.travelers} pax</span>
                </div>
                <div className="mobile-card-actions" onClick={e => e.stopPropagation()}>
                  <button className="btn btn-sm btn-wa" onClick={() => openWhatsApp(b)}>WhatsApp</button>
                  {b.email && <button className="btn btn-sm btn-mail" onClick={() => sendAck(b)}>Email</button>}
                  {isConverted
                    ? <button className="btn btn-sm" disabled>✓ In pipeline</button>
                    : <button className="btn btn-sm btn-primary" onClick={() => convertToLead(b)}>→ Pipeline</button>}
                </div>
              </div>
            )
          })}
      </div>

      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal" style={{ maxWidth: 540 }} onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <div className="modal-header">
              <div className="modal-title">{selected.full_name}</div>
              <button className="modal-close" onClick={() => setSelected(null)}>×</button>
            </div>

            <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: 'var(--text2)', alignSelf: 'center' }}>Status:</span>
              {CRM_STATUSES.filter(s => s !== 'archived').map(s => (
                <button key={s} className={`filter-btn ${(selected.crm_status || 'new') === s ? 'active' : ''}`}
                  onClick={() => { setStatus(selected, s); setSelected(sel => ({ ...sel, crm_status: s })) }}>{s}</button>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, fontSize: 13 }}>
              {[
                ['Phone', selected.phone], ['Email', selected.email],
                ['Destination', selected.destination || '—'],
                ['Travellers', selected.travelers],
                ['From', selected.travel_from || '—'], ['To', selected.travel_to || '—'],
                ['Booked on', selected.created_at ? format(new Date(selected.created_at), 'dd MMM yyyy HH:mm') : '—'],
              ].map(([k, v]) => (
                <div key={k} style={{ background: 'var(--surface2)', padding: '10px 12px', borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 3 }}>{k}</div>
                  <div style={{ fontWeight: 500, wordBreak: 'break-word' }}>{v}</div>
                </div>
              ))}
              {selected.notes && (
                <div style={{ gridColumn: '1/-1', background: 'var(--surface2)', padding: '10px 12px', borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 3 }}>Customer's notes</div>
                  <div>{selected.notes}</div>
                </div>
              )}
            </div>

            <div className="form-group full" style={{ marginTop: 14 }}>
              <label>Internal CRM note</label>
              <textarea value={noteDraft} onChange={e => setNoteDraft(e.target.value)} placeholder="Add a private note about this enquiry…" />
              <button className="btn btn-sm" style={{ marginTop: 6, alignSelf: 'flex-start' }} onClick={() => saveNote(selected)}>Save note</button>
            </div>

            <div className="modal-footer">
              <button className="btn btn-wa" onClick={() => openWhatsApp(selected)}>WhatsApp</button>
              {selected.email && <button className="btn btn-mail" onClick={() => sendAck(selected)}>Send email</button>}
              <button className="btn" onClick={() => toggleArchive(selected)}>{selected.archived ? 'Restore' : 'Archive'}</button>
              {!(selected.crm_status === 'converted' || convertedIds.has(selected.id)) &&
                <button className="btn btn-primary" onClick={() => { convertToLead(selected); setSelected(null) }}>Move to pipeline</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
