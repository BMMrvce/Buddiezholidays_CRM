import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useTable, useToast } from '../lib/hooks.jsx'
import { sendEmail, itineraryEmailHtml, waLink, waItineraryMessage } from '../lib/comms'
import { format } from 'date-fns'

const emptyDay = { date: '', city: '', activities: '', hotel: '', meals: '', transport: '', notes: '' }

export default function ItineraryPage() {
  const { data: itineraries, loading, refetch } = useTable('itineraries')
  const { data: leads } = useTable('leads')
  const { show, Toast } = useToast()
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({ title: '', lead_id: '', days: [{ ...emptyDay }] })
  const [preview, setPreview] = useState(null)
  const [share, setShare] = useState(null)         // itinerary being shared
  const [shareTo, setShareTo] = useState({ lead_id: '', name: '', email: '', phone: '' })

  function addDay() { setForm(f => ({ ...f, days: [...f.days, { ...emptyDay }] })) }
  function removeDay(i) { setForm(f => ({ ...f, days: f.days.filter((_, idx) => idx !== i) })) }
  function updateDay(i, key, val) {
    setForm(f => {
      const days = [...f.days]; days[i] = { ...days[i], [key]: val }; return { ...f, days }
    })
  }

  async function saveItinerary() {
    const { error } = await supabase.from('itineraries').insert([{
      title: form.title, lead_id: form.lead_id || null, days: form.days
    }])
    if (error) { show('Error: ' + error.message, 'error'); return }
    show('Itinerary saved ✓'); setModal(null); refetch()
  }

  // Open the share sheet, pre-filling the linked lead's details if present
  function openShare(itin) {
    const lead = leads.find(l => l.id === itin.lead_id)
    setShareTo({ lead_id: lead?.id || '', name: lead?.full_name || '', email: lead?.email || '', phone: lead?.phone || '' })
    setShare(itin)
  }

  async function markShared(itin) {
    await supabase.from('itineraries').update({ shared_at: new Date().toISOString() }).eq('id', itin.id)
    refetch()
  }

  function shareViaWhatsApp() {
    if (!share) return
    if (!shareTo.phone) { show('Enter a phone number', 'error'); return }
    const clientName = shareTo.name || 'there'
    window.open(waLink(shareTo.phone, waItineraryMessage({ clientName, title: share.title, days: share.days })), '_blank')
    markShared(share); show('WhatsApp opened ✓'); setShare(null)
  }

  async function shareViaEmail() {
    if (!share) return
    if (!shareTo.email) { show('Enter an email address', 'error'); return }
    const clientName = shareTo.name || 'there'
    const res = await sendEmail({
      to: shareTo.email, toName: clientName,
      subject: `Your Itinerary — ${share.title}`,
      html: itineraryEmailHtml({ clientName, title: share.title, days: share.days })
    })
    if (res.ok) { show('Itinerary emailed ✓'); markShared(share); setShare(null) }
    else show('Email failed: ' + (res.error || 'check Brevo key'), 'error')
  }

  return (
    <div className="page">
      {Toast}
      <div className="page-header">
        <div>
          <div className="page-title">Itineraries</div>
          <div className="page-sub">Build & share day-by-day trip plans</div>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm({ title: '', lead_id: '', days: [{ ...emptyDay }] }); setModal('build') }}>
          + New itinerary
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
        {loading ? <div style={{ color: 'var(--text2)' }}>Loading…</div> :
          itineraries.length === 0 ? (
            <div className="card">
              <div className="empty"><div className="empty-icon">◈</div>No itineraries yet. Build your first one!</div>
            </div>
          ) : itineraries.map(itin => {
            const lead = leads.find(l => l.id === itin.lead_id)
            return (
              <div key={itin.id} className="card">
                <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{itin.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 10 }}>
                  {(itin.days || []).length} days
                  {lead && ` · ${lead.full_name}`}
                  {itin.shared_at && <span style={{ color: 'var(--green)', marginLeft: 8 }}>✓ Shared</span>}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 14 }}>
                  {(itin.days || []).slice(0, 3).map((d, i) => (
                    <div key={i} style={{ padding: '3px 0', borderBottom: '1px solid var(--border)' }}>
                      <strong>Day {i + 1}</strong> {d.city && `· ${d.city}`} {d.activities && `— ${d.activities.slice(0, 50)}…`}
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button className="btn btn-sm" onClick={() => setPreview(itin)}>Preview</button>
                  <button className="btn btn-sm btn-primary" onClick={() => openShare(itin)}>Share</button>
                  <button className="btn btn-sm btn-danger" onClick={async () => { await supabase.from('itineraries').delete().eq('id', itin.id); refetch() }}>✕</button>
                </div>
              </div>
            )
          })
        }
      </div>

      {modal === 'build' && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" style={{ maxWidth: 760 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Build itinerary</div>
              <button className="modal-close" onClick={() => setModal(null)}>×</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 16 }}>
              <div className="form-group"><label>Itinerary title *</label><input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Goa 5 Nights Family Package" /></div>
              <div className="form-group"><label>Link to lead (optional)</label>
                <select value={form.lead_id} onChange={e => setForm(f => ({ ...f, lead_id: e.target.value }))}>
                  <option value="">No lead linked</option>
                  {leads.map(l => <option key={l.id} value={l.id}>{l.full_name} — {l.destination || '—'}</option>)}
                </select>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginBottom: 12 }}>
              <div style={{ fontWeight: 500, marginBottom: 10 }}>Day-by-day plan</div>
              {form.days.map((day, i) => (
                <div key={i} style={{ background: 'var(--surface2)', borderRadius: 8, padding: 12, marginBottom: 10, border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <strong style={{ fontSize: 13 }}>Day {i + 1}</strong>
                    {form.days.length > 1 && <button className="btn btn-sm btn-danger" onClick={() => removeDay(i)}>Remove</button>}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
                    <div className="form-group"><label>Date</label><input type="date" value={day.date} onChange={e => updateDay(i, 'date', e.target.value)} /></div>
                    <div className="form-group"><label>City</label><input value={day.city} onChange={e => updateDay(i, 'city', e.target.value)} /></div>
                    <div className="form-group"><label>Hotel</label><input value={day.hotel} onChange={e => updateDay(i, 'hotel', e.target.value)} /></div>
                    <div className="form-group" style={{ gridColumn: '1/-1' }}><label>Activities</label><input value={day.activities} onChange={e => updateDay(i, 'activities', e.target.value)} /></div>
                    <div className="form-group"><label>Meals</label><input value={day.meals} placeholder="Breakfast, Dinner" onChange={e => updateDay(i, 'meals', e.target.value)} /></div>
                    <div className="form-group"><label>Transport</label><input value={day.transport} onChange={e => updateDay(i, 'transport', e.target.value)} /></div>
                    <div className="form-group"><label>Notes</label><input value={day.notes} onChange={e => updateDay(i, 'notes', e.target.value)} /></div>
                  </div>
                </div>
              ))}
              <button className="btn" onClick={addDay}>+ Add day</button>
            </div>

            <div className="modal-footer">
              <button className="btn" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveItinerary}>Save itinerary</button>
            </div>
          </div>
        </div>
      )}

      {share && (
        <div className="modal-overlay" onClick={() => setShare(null)}>
          <div className="modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <div className="modal-header">
              <div className="modal-title">Share itinerary</div>
              <button className="modal-close" onClick={() => setShare(null)}>×</button>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 14 }}>
              <strong style={{ color: 'var(--text)' }}>{share.title}</strong> · {(share.days || []).length} days
            </div>
            <div className="form-grid">
              <div className="form-group full"><label>Select client from pipeline</label>
                <select value={shareTo.lead_id || ''} onChange={e => {
                  const l = leads.find(x => x.id === e.target.value)
                  setShareTo(s => ({ ...s, lead_id: e.target.value, name: l?.full_name || s.name, email: l?.email || s.email, phone: l?.phone || s.phone }))
                }}>
                  <option value="">— Choose a lead (or enter manually) —</option>
                  {leads.map(l => <option key={l.id} value={l.id}>{l.full_name} — {l.phone}{l.destination ? ` · ${l.destination}` : ''}</option>)}
                </select>
              </div>
              <div className="form-group full"><label>Recipient name</label>
                <input value={shareTo.name} onChange={e => setShareTo(s => ({ ...s, name: e.target.value }))} placeholder="Client name" /></div>
              <div className="form-group full"><label>Phone (for WhatsApp)</label>
                <input value={shareTo.phone} onChange={e => setShareTo(s => ({ ...s, phone: e.target.value }))} placeholder="e.g. 919XXXXXXXXX" /></div>
              <div className="form-group full"><label>Email</label>
                <input type="email" value={shareTo.email} onChange={e => setShareTo(s => ({ ...s, email: e.target.value }))} placeholder="client@example.com" /></div>
            </div>
            <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: 10, margin: '12px 0', fontSize: 12, color: 'var(--text2)' }}>
              WhatsApp sends a summary with a deep link · Email sends the full branded day-by-day plan.
            </div>
            <div className="modal-footer">
              <button className="btn btn-wa" onClick={shareViaWhatsApp}>WhatsApp</button>
              <button className="btn btn-mail" onClick={shareViaEmail}>Email</button>
            </div>
          </div>
        </div>
      )}

      {preview && (
        <div className="modal-overlay" onClick={() => setPreview(null)}>
          <div className="modal" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{preview.title}</div>
              <button className="modal-close" onClick={() => setPreview(null)}>×</button>
            </div>
            {(preview.days || []).map((d, i) => (
              <div key={i} style={{ borderLeft: '3px solid var(--accent2)', paddingLeft: 14, marginBottom: 16 }}>
                <div style={{ fontWeight: 600, color: 'var(--accent)', marginBottom: 4 }}>Day {i + 1}{d.date ? ` — ${d.date}` : ''}{d.city ? ` · ${d.city}` : ''}</div>
                {d.activities && <div style={{ fontSize: 13, marginBottom: 4 }}>{d.activities}</div>}
                <div style={{ fontSize: 12, color: 'var(--text2)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {d.hotel && <span>🏨 {d.hotel}</span>}
                  {d.meals && <span>🍽 {d.meals}</span>}
                  {d.transport && <span>🚗 {d.transport}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
