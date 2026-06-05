import { useState } from 'react'
import { supabase, AGENCY_NAME } from '../lib/supabase'
import { useTable, useToast } from '../lib/hooks.jsx'
import { sendEmail, waLink, invoiceEmailHtml, invoiceEmailText, invoiceNumber, waInvoiceMessage } from '../lib/comms'

const MODES = ['upi', 'cash', 'neft', 'card', 'cheque']
const empty = { lead_id: '', total_amount: '', advance_paid: '', balance_due_date: '', payment_mode: 'upi', vendor_cost: '', discount: '', discount_reason: '', payment_ref: '', status: 'pending', refund_amount: '' }

const statusPill = (s) => {
  const map = { pending: 'pill-pending', partial: 'pill-partial', paid: 'pill-paid', refunded: 'pill-following' }
  return <span className={`pill ${map[s] || 'pill-pending'}`}>{s}</span>
}

const num = (v) => Number(v || 0)
const isFullyPaid = (total, advance) => num(total) > 0 && num(advance) >= num(total)
// derive status from amounts (refunded is kept as a manual choice)
function deriveStatus(total, advance, current) {
  if (current === 'refunded') return 'refunded'
  if (isFullyPaid(total, advance)) return 'paid'
  if (num(advance) > 0) return 'partial'
  return 'pending'
}

export default function Payments() {
  const { data: payments, loading, refetch } = useTable('payments')
  const { data: leads } = useTable('leads')
  const { show, Toast } = useToast()
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(empty)
  const [editId, setEditId] = useState(null)
  const [busy, setBusy] = useState(null)

  const withLead = payments.map(p => ({ ...p, lead: leads.find(l => l.id === p.lead_id) }))
  const totalRevenue = payments.reduce((s, p) => s + num(p.total_amount), 0)
  const totalCollected = payments.reduce((s, p) => s + num(p.advance_paid), 0)
  const totalPending = payments.reduce((s, p) => s + num(p.balance_due), 0)
  const totalProfit = payments.reduce((s, p) => s + num(p.profit), 0)

  // Email a branded invoice + thank-you. Returns true on success.
  async function sendInvoice(payment, lead, { silent } = {}) {
    if (!lead) { if (!silent) show('No client linked to this payment', 'error'); return false }
    if (!lead.email) { if (!silent) show('Linked client has no email on file', 'error'); return false }
    const invoiceNo = payment.invoice_no || invoiceNumber(payment)
    const res = await sendEmail({
      to: lead.email, toName: lead.full_name,
      subject: `Invoice ${invoiceNo} — payment received · ${AGENCY_NAME}`,
      html: invoiceEmailHtml({ clientName: lead.full_name, destination: lead.destination, payment, invoiceNo }),
      text: invoiceEmailText({ clientName: lead.full_name, destination: lead.destination, payment, invoiceNo }),
    })
    if (res.ok) {
      await supabase.from('payments').update({ invoice_no: invoiceNo, invoice_sent_at: new Date().toISOString() }).eq('id', payment.id)
      if (!silent) show('Invoice emailed ✓')
      refetch()
      return true
    }
    if (!silent) show('Invoice email failed: ' + (res.error || 'check Brevo key'), 'error')
    return false
  }

  function openAdd() { setForm(empty); setEditId(null); setModal(true) }
  function openEdit(p) {
    // Completed (fully paid) payments are locked — no edits allowed.
    if (isFullyPaid(p.total_amount, p.advance_paid)) { show('Completed payments are locked', 'error'); return }
    setForm({
      lead_id: p.lead_id || '', total_amount: p.total_amount ?? '', advance_paid: p.advance_paid ?? '',
      balance_due_date: p.balance_due_date || '', payment_mode: p.payment_mode || 'upi',
      vendor_cost: p.vendor_cost ?? '', discount: p.discount ?? '', discount_reason: p.discount_reason || '',
      payment_ref: p.payment_ref || '', status: p.status || 'pending', refund_amount: p.refund_amount ?? '',
    })
    setEditId(p.id)
    setModal(true)
  }

  async function save() {
    if (!form.lead_id) { show('Select a client', 'error'); return }
    if (!form.total_amount) { show('Enter the total amount', 'error'); return }
    const total = num(form.total_amount)
    const advance = num(form.advance_paid)
    const status = deriveStatus(total, advance, form.status)
    const payload = {
      ...form, total_amount: total, advance_paid: advance,
      vendor_cost: num(form.vendor_cost), discount: num(form.discount), refund_amount: num(form.refund_amount),
      status,
    }

    let row, error
    if (editId) {
      const existing = payments.find(p => p.id === editId)
      ;({ data: row, error } = await supabase.from('payments').update(payload).eq('id', editId).select().single())
      if (error) { show('Error: ' + error.message, 'error'); return }
      setModal(false); refetch()
      const lead = leads.find(l => l.id === row.lead_id)
      // Send invoice only when the balance is now fully cleared and not already sent
      if (isFullyPaid(total, advance) && !existing?.invoice_sent_at) {
        const ok = await sendInvoice(row, lead, { silent: true })
        show(ok ? 'Payment fully received · invoice sent ✓' : 'Updated · invoice not sent (check client email / Brevo)', ok ? 'ok' : 'error')
      } else if (isFullyPaid(total, advance)) {
        show('Payment updated · already invoiced')
      } else {
        show(`Saved · balance ₹${(total - advance).toLocaleString('en-IN')} pending`)
      }
    } else {
      ;({ data: row, error } = await supabase.from('payments').insert([payload]).select().single())
      if (error) { show('Error: ' + error.message, 'error'); return }
      setModal(false); refetch()
      const lead = leads.find(l => l.id === row.lead_id)
      if (isFullyPaid(total, advance)) {
        const ok = await sendInvoice(row, lead, { silent: true })
        show(ok ? 'Payment fully received · invoice sent ✓' : 'Saved · invoice not sent (check client email / Brevo)', ok ? 'ok' : 'error')
      } else {
        show(`Payment saved · balance ₹${(total - advance).toLocaleString('en-IN')} pending`)
      }
    }
  }

  // Mark a refund manually (kept simple)
  async function markRefunded(p) {
    setBusy(p.id)
    const { error } = await supabase.from('payments').update({ status: 'refunded' }).eq('id', p.id)
    setBusy(null)
    if (error) show('Error: ' + error.message, 'error')
    else { show('Marked refunded'); refetch() }
  }

  const liveTotal = num(form.total_amount)
  const liveAdvance = num(form.advance_paid)
  const liveBalance = liveTotal - liveAdvance
  const liveFull = isFullyPaid(liveTotal, liveAdvance)

  return (
    <div className="page">
      {Toast}
      <div className="page-header">
        <div>
          <div className="page-title">Payments</div>
          <div className="page-sub">Track advances, balances & profit · invoice auto-sends on full payment</div>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add payment</button>
      </div>

      <div className="stats-row">
        <div className="stat-card"><div className="stat-val">₹{(totalRevenue / 1000).toFixed(1)}k</div><div className="stat-label">Total revenue</div></div>
        <div className="stat-card"><div className="stat-val" style={{ color: 'var(--green)' }}>₹{(totalCollected / 1000).toFixed(1)}k</div><div className="stat-label">Collected</div></div>
        <div className="stat-card"><div className="stat-val" style={{ color: 'var(--red)' }}>₹{(totalPending / 1000).toFixed(1)}k</div><div className="stat-label">Pending balance</div></div>
        <div className="stat-card"><div className="stat-val" style={{ color: 'var(--accent)' }}>₹{(totalProfit / 1000).toFixed(1)}k</div><div className="stat-label">Est. profit</div></div>
      </div>

      <div className="card desktop-table" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Client</th><th>Total</th><th>Received</th><th>Balance</th><th>Due date</th><th>Status</th><th>Invoice</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32 }}>Loading…</td></tr> :
                withLead.length === 0 ? <tr><td colSpan={8}><div className="empty"><div className="empty-icon">◆</div>No payments yet</div></td></tr> :
                withLead.map(p => {
                  const fully = isFullyPaid(p.total_amount, p.advance_paid)
                  return (
                    <tr key={p.id}>
                      <td>
                        <div style={{ fontWeight: 500 }}>{p.lead?.full_name || '—'}</div>
                        <div style={{ fontSize: 11, color: 'var(--text2)' }}>{p.lead?.destination || ''}</div>
                      </td>
                      <td style={{ fontWeight: 500 }}>₹{num(p.total_amount).toLocaleString('en-IN')}</td>
                      <td style={{ color: 'var(--green)' }}>₹{num(p.advance_paid).toLocaleString('en-IN')}</td>
                      <td style={{ color: num(p.balance_due) > 0 ? 'var(--red)' : 'var(--green)', fontWeight: 500 }}>
                        ₹{num(p.balance_due).toLocaleString('en-IN')}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text2)' }}>{p.balance_due_date || '—'}</td>
                      <td>{statusPill(p.status)}</td>
                      <td>
                        {p.invoice_sent_at
                          ? <span className="pill pill-paid" title={`Sent ${new Date(p.invoice_sent_at).toLocaleString('en-IN')}`}>✓ sent</span>
                          : fully
                            ? <button className="btn btn-sm btn-mail" disabled={!p.lead?.email} title={p.lead?.email ? '' : 'No client email'} onClick={() => sendInvoice(p, p.lead)}>Send</button>
                            : <span style={{ fontSize: 11, color: 'var(--text3)' }}>on full payment</span>}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {fully ? (
                            <>
                              {p.invoice_sent_at && <button className="btn btn-sm" onClick={() => sendInvoice(p, p.lead)}>↻ Resend</button>}
                              {p.lead?.phone && <button className="btn btn-sm btn-wa" title="WhatsApp invoice summary"
                                onClick={() => window.open(waLink(p.lead.phone, waInvoiceMessage({ clientName: p.lead.full_name, destination: p.lead.destination, payment: p, invoiceNo: p.invoice_no || invoiceNumber(p) })), '_blank')}>WA</button>}
                              {!p.invoice_sent_at && !p.lead?.phone && <span style={{ fontSize: 11, color: 'var(--text3)' }}>—</span>}
                            </>
                          ) : (
                            <button className="btn btn-sm" onClick={() => openEdit(p)}>Record payment</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              }
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile card list */}
      <div className="mobile-list">
        {loading ? <div style={{ color: 'var(--text2)', padding: '20px 0', textAlign: 'center' }}>Loading…</div> :
          withLead.length === 0 ? <div className="empty"><div className="empty-icon">◆</div>No payments yet</div> :
          withLead.map(p => {
            const fully = isFullyPaid(p.total_amount, p.advance_paid)
            return (
              <div key={p.id} className="mobile-card">
                <div className="mobile-card-row">
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{p.lead?.full_name || '—'}</div>
                    {p.lead?.destination && <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>{p.lead.destination}</div>}
                  </div>
                  {statusPill(p.status)}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13, margin: '8px 0' }}>
                  <div><span style={{ color: 'var(--text2)' }}>Total: </span>₹{num(p.total_amount).toLocaleString('en-IN')}</div>
                  <div><span style={{ color: 'var(--text2)' }}>Received: </span><span style={{ color: 'var(--green)' }}>₹{num(p.advance_paid).toLocaleString('en-IN')}</span></div>
                  <div><span style={{ color: 'var(--text2)' }}>Balance: </span><span style={{ color: num(p.balance_due) > 0 ? 'var(--red)' : 'var(--green)', fontWeight: 600 }}>₹{num(p.balance_due).toLocaleString('en-IN')}</span></div>
                  <div><span style={{ color: 'var(--text2)' }}>Due: </span>{p.balance_due_date || '—'}</div>
                </div>
                <div className="mobile-card-actions">
                  {fully ? (
                    <>
                      {p.invoice_sent_at
                        ? <button className="btn btn-sm" onClick={() => sendInvoice(p, p.lead)}>↻ Resend invoice</button>
                        : <button className="btn btn-sm btn-mail" disabled={!p.lead?.email} onClick={() => sendInvoice(p, p.lead)}>Send invoice</button>}
                      {p.lead?.phone && <button className="btn btn-sm btn-wa"
                        onClick={() => window.open(waLink(p.lead.phone, waInvoiceMessage({ clientName: p.lead.full_name, destination: p.lead.destination, payment: p, invoiceNo: p.invoice_no || invoiceNumber(p) })), '_blank')}>WhatsApp</button>}
                    </>
                  ) : (
                    <button className="btn btn-sm btn-primary" onClick={() => openEdit(p)}>Record payment</button>
                  )}
                </div>
              </div>
            )
          })
        }
      </div>

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <div className="modal-header">
              <div className="modal-title">{editId ? 'Update payment' : 'Add payment record'}</div>
              <button className="modal-close" onClick={() => setModal(false)}>×</button>
            </div>
            <div className="form-grid">
              <div className="form-group full"><label>Client (lead) *</label>
                <select value={form.lead_id} onChange={e => setForm(f => ({ ...f, lead_id: e.target.value }))}>
                  <option value="">Select lead…</option>
                  {leads.map(l => <option key={l.id} value={l.id}>{l.full_name} — {l.destination || l.phone}</option>)}
                </select>
              </div>
              <div className="form-group"><label>Total package amount (₹) *</label><input type="number" value={form.total_amount} onChange={e => setForm(f => ({ ...f, total_amount: e.target.value }))} /></div>
              <div className="form-group"><label>Total received so far (₹)</label><input type="number" value={form.advance_paid} onChange={e => setForm(f => ({ ...f, advance_paid: e.target.value }))} placeholder="cumulative amount received" /></div>
              <div className="form-group"><label>Balance due date</label><input type="date" value={form.balance_due_date} onChange={e => setForm(f => ({ ...f, balance_due_date: e.target.value }))} /></div>
              <div className="form-group"><label>Payment mode</label>
                <select value={form.payment_mode} onChange={e => setForm(f => ({ ...f, payment_mode: e.target.value }))}>
                  {MODES.map(m => <option key={m} value={m}>{m.toUpperCase()}</option>)}
                </select>
              </div>
              <div className="form-group"><label>Vendor / cost price (₹)</label><input type="number" value={form.vendor_cost} onChange={e => setForm(f => ({ ...f, vendor_cost: e.target.value }))} /></div>
              <div className="form-group"><label>Discount given (₹)</label><input type="number" value={form.discount} onChange={e => setForm(f => ({ ...f, discount: e.target.value }))} /></div>
              <div className="form-group"><label>Payment ref / UTR</label><input value={form.payment_ref} onChange={e => setForm(f => ({ ...f, payment_ref: e.target.value }))} /></div>

              <div className="form-group full" style={{ background: liveFull ? 'var(--green-light)' : 'var(--amber-light)', padding: 12, borderRadius: 10, gridColumn: '1/-1' }}>
                {liveTotal > 0 ? (
                  liveFull ? (
                    <div style={{ fontSize: 13, color: 'var(--green)', fontWeight: 600 }}>
                      ✓ Fully paid — a branded invoice + thank-you email will be sent to the client automatically on save.
                    </div>
                  ) : (
                    <div style={{ fontSize: 13, color: 'var(--amber)' }}>
                      Balance pending: <strong>₹{Math.max(0, liveBalance).toLocaleString('en-IN')}</strong>. No invoice is sent yet — update the “received” amount once the balance is paid and the invoice will be sent automatically.
                    </div>
                  )
                ) : <div style={{ fontSize: 13, color: 'var(--text2)' }}>Enter the total amount to continue.</div>}
                {liveTotal > 0 && (form.vendor_cost || form.discount) ? (
                  <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 6 }}>
                    Est. profit: <strong>₹{(liveTotal - num(form.vendor_cost) - num(form.discount)).toLocaleString('en-IN')}</strong>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setModal(false)}>Cancel</button>
              {editId && form.status !== 'refunded' && <button className="btn btn-danger" onClick={() => { markRefunded({ id: editId }); setModal(false) }}>Mark refunded</button>}
              <button className="btn btn-primary" onClick={save}>{editId ? (liveFull ? 'Save & send invoice' : 'Save') : 'Save payment'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
