import { BREVO_KEY, AGENCY_NAME, AGENCY_WA, AGENCY_PHONE, AGENCY_EMAIL, BREVO_SENDER_EMAIL, BREVO_SENDER_NAME } from './supabase'

// ── SHARED EMAIL SHELL (branded blue + gold, matches website) ──
const BRAND = { blue: '#003d8f', blue2: '#0057b8', gold: '#e5b326', goldDeep: '#c9941a', ink: '#122036', soft: '#57698a' }

function emailShell({ kicker, title, bodyHtml }) {
  const contact = [AGENCY_PHONE && `📞 ${AGENCY_PHONE}`, AGENCY_EMAIL && `✉ ${AGENCY_EMAIL}`].filter(Boolean).join('  ·  ')
  return `
<div style="margin:0;padding:0;background:#f3f6fc;">
  <div style="max-width:640px;margin:0 auto;padding:20px;font-family:Arial,Helvetica,sans-serif;color:${BRAND.ink};">
    <div style="overflow:hidden;border-radius:20px;box-shadow:0 18px 40px rgba(0,61,143,.16);">
      <div style="background:linear-gradient(135deg,${BRAND.blue} 0%,${BRAND.blue2} 60%,${BRAND.gold} 140%);padding:26px 28px;color:#fff;">
        ${kicker ? `<div style="font-size:11px;letter-spacing:.26em;text-transform:uppercase;font-weight:700;opacity:.9;">${kicker}</div>` : ''}
        <h1 style="margin:8px 0 0;font-size:24px;line-height:1.2;">${title}</h1>
        <div style="margin-top:8px;font-size:13px;opacity:.92;">${AGENCY_NAME} · Your Journey, Our Comfort</div>
      </div>
      <div style="background:#fff;padding:26px 28px;">
        ${bodyHtml}
      </div>
      <div style="background:#f3f6fc;padding:16px 28px;border-top:1px solid #e3e9f4;text-align:center;font-size:12px;color:${BRAND.soft};">
        ${contact || ''}
        <div style="margin-top:6px;">© ${new Date().getFullYear()} ${AGENCY_NAME}</div>
      </div>
    </div>
  </div>
</div>`
}

// ── BREVO EMAIL ──────────────────────────────────────────────
export async function sendEmail({ to, toName, subject, html, text }) {
  if (!BREVO_KEY) return { ok: false, error: 'Brevo key not set' }
  if (!BREVO_SENDER_EMAIL) return { ok: false, error: 'Sender email not set' }
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': BREVO_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      sender: { name: BREVO_SENDER_NAME || AGENCY_NAME, email: BREVO_SENDER_EMAIL },
      to: [{ email: to, name: toName }],
      subject,
      htmlContent: html,
      ...(text ? { textContent: text } : {})
    })
  })
  return { ok: res.ok, status: res.status }
}

// ── EMAIL TEMPLATES ──────────────────────────────────────────
export function quoteEmailHtml({ clientName, destination, from, to, travelers, amount, notes }) {
  const body = `
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6">Dear ${clientName}, thank you for your enquiry. Here is your personalised travel quote:</p>
    <table style="width:100%;border-collapse:collapse;margin:0 0 8px">
      <tr><td style="padding:9px 0;font-size:13px;color:#57698a">Destination</td><td style="padding:9px 0;font-size:13px;color:#122036;font-weight:600;text-align:right">${destination || '—'}</td></tr>
      <tr><td style="padding:9px 0;font-size:13px;color:#57698a">Travel dates</td><td style="padding:9px 0;font-size:13px;color:#122036;font-weight:600;text-align:right">${from || '—'} to ${to || '—'}</td></tr>
      <tr><td style="padding:9px 0;font-size:13px;color:#57698a">Travellers</td><td style="padding:9px 0;font-size:13px;color:#122036;font-weight:600;text-align:right">${travelers}</td></tr>
    </table>
    <div style="background:linear-gradient(135deg,#003d8f,#0057b8);color:#fff;border-radius:14px;padding:16px 18px;margin:6px 0 14px;display:flex;justify-content:space-between;align-items:center">
      <span style="font-size:13px;opacity:.9">Quoted amount</span>
      <span style="font-size:22px;font-weight:800">₹${Number(amount || 0).toLocaleString('en-IN')}</span>
    </div>
    ${notes ? `<p style="background:#fbf3da;border:1px solid #f0dba6;padding:12px 14px;border-radius:10px;font-size:14px;line-height:1.6;color:#7a5a12">${notes}</p>` : ''}
    <p style="margin:14px 0 0;font-size:14px;color:#57698a">To confirm your booking, just reply to this email or WhatsApp us.</p>`
  return emailShell({ kicker: 'Your Travel Quote', title: destination ? `${destination} package` : 'Custom travel quote', bodyHtml: body })
}

export function itineraryEmailHtml({ clientName, title, days }) {
  const dayRows = (days || []).map((d, i) => `
    <div style="margin-bottom:14px;padding:14px 16px;border:1px solid #e3e9f4;border-radius:14px;background:#f5f8fd">
      <strong style="color:#003d8f;font-size:14px">Day ${i + 1}${d.date ? ` — ${d.date}` : ''}${d.city ? ` · ${d.city}` : ''}</strong>
      ${d.activities ? `<p style="margin:8px 0 0;font-size:14px;line-height:1.6;color:#122036">${d.activities}</p>` : ''}
      <div style="margin-top:8px;font-size:13px;color:#57698a">
        ${d.hotel ? `<div style="margin:3px 0">🏨 ${d.hotel}</div>` : ''}
        ${d.meals ? `<div style="margin:3px 0">🍽 ${d.meals}</div>` : ''}
        ${d.transport ? `<div style="margin:3px 0">🚗 ${d.transport}</div>` : ''}
      </div>
    </div>`).join('')
  const body = `
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6">Dear ${clientName}, here is your day-by-day travel plan. We can't wait to host you!</p>
    ${dayRows}
    <p style="margin:18px 0 0;font-size:14px;color:#57698a">Have a question or want a change? Just reply to this email or WhatsApp us.</p>`
  return emailShell({ kicker: 'Your Itinerary', title, bodyHtml: body })
}

export function followupEmailHtml({ clientName, type, message }) {
  const body = `
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6">Dear ${clientName},</p>
    <p style="margin:0;font-size:15px;line-height:1.6">${message}</p>`
  return emailShell({ kicker: type, title: `A quick note from ${AGENCY_NAME}`, bodyHtml: body })
}

// ── INVOICE / PAYMENT RECEIPT ────────────────────────────────
function money(n) { return `₹${Number(n || 0).toLocaleString('en-IN')}` }

export function invoiceNumber(payment) {
  const d = payment?.created_at ? new Date(payment.created_at) : new Date()
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`
  const tail = String(payment?.id || '').replace(/\D/g, '').slice(0, 4) || String(Date.now()).slice(-4)
  return `BH-${ymd}-${tail}`
}

// Branded invoice + thank-you email, sent automatically when status → paid
export function invoiceEmailHtml({ clientName, destination, payment, invoiceNo }) {
  const total = Number(payment.total_amount || 0)
  const advance = Number(payment.advance_paid || 0)
  const discount = Number(payment.discount || 0)
  const balance = Number(payment.balance_due != null ? payment.balance_due : total - advance)
  const rows = [
    ['Package / destination', destination || '—'],
    ['Invoice number', invoiceNo],
    ['Invoice date', new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })],
    payment.payment_mode ? ['Payment mode', String(payment.payment_mode).toUpperCase()] : null,
    payment.payment_ref ? ['Payment reference', payment.payment_ref] : null,
  ].filter(Boolean)

  const detailRows = rows.map(([k, v]) => `
    <tr>
      <td style="padding:9px 0;font-size:13px;color:#57698a">${k}</td>
      <td style="padding:9px 0;font-size:13px;color:#122036;font-weight:600;text-align:right">${v}</td>
    </tr>`).join('')

  const amountRows = [
    ['Package total', money(total)],
    discount > 0 ? ['Discount', `\u2013 ${money(discount)}`] : null,
    ['Amount received', money(advance)],
  ].filter(Boolean).map(([k, v]) => `
    <tr>
      <td style="padding:8px 0;font-size:14px;color:#122036">${k}</td>
      <td style="padding:8px 0;font-size:14px;color:#122036;text-align:right">${v}</td>
    </tr>`).join('')

  const body = `
    <div style="background:#e4f5ee;color:#1f7d57;border:1px solid #bce6d4;border-radius:12px;padding:12px 14px;font-size:14px;font-weight:600;margin-bottom:18px">
      \u2713 Payment received — thank you!
    </div>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6">
      Dear ${clientName}, thank you for booking with <strong>${AGENCY_NAME}</strong>.
      We're delighted to confirm your payment. Here is your invoice for your records.
    </p>

    <table style="width:100%;border-collapse:collapse;margin:0 0 6px">
      ${detailRows}
    </table>

    <div style="border-top:1px dashed #cdd8ec;margin:10px 0 6px"></div>

    <table style="width:100%;border-collapse:collapse">
      ${amountRows}
      <tr>
        <td style="padding:12px 0 0;font-size:15px;color:#003d8f;font-weight:700;border-top:2px solid #003d8f">Balance due</td>
        <td style="padding:12px 0 0;font-size:18px;color:${balance > 0 ? '#b8801f' : '#1f9d6b'};font-weight:800;text-align:right;border-top:2px solid #003d8f">${money(balance)}</td>
      </tr>
    </table>

    ${balance > 0
      ? `<p style="margin:18px 0 0;font-size:13px;color:#57698a">A balance of <strong>${money(balance)}</strong> remains${payment.balance_due_date ? ` and is due by <strong>${payment.balance_due_date}</strong>` : ''}. We'll share a reminder closer to the date.</p>`
      : `<p style="margin:18px 0 0;font-size:14px;color:#1f9d6b;font-weight:600">Your booking is fully paid. We can't wait to make your trip memorable! \u2708\ufe0f</p>`}

    <p style="margin:18px 0 0;font-size:13px;color:#57698a">This is a computer-generated invoice and does not require a signature.</p>`

  return emailShell({ kicker: 'Payment Receipt', title: `Invoice ${invoiceNo}`, bodyHtml: body })
}

export function invoiceEmailText({ clientName, destination, payment, invoiceNo }) {
  const total = Number(payment.total_amount || 0)
  const advance = Number(payment.advance_paid || 0)
  const balance = Number(payment.balance_due != null ? payment.balance_due : total - advance)
  return [
    `Payment received — thank you, ${clientName}!`,
    '',
    `Invoice: ${invoiceNo}`,
    `Package/destination: ${destination || '—'}`,
    `Package total: ${money(total)}`,
    `Amount received: ${money(advance)}`,
    `Balance due: ${money(balance)}`,
    payment.payment_mode ? `Mode: ${String(payment.payment_mode).toUpperCase()}` : '',
    payment.payment_ref ? `Reference: ${payment.payment_ref}` : '',
    '',
    `Thank you for booking with ${AGENCY_NAME}.`,
  ].filter(Boolean).join('\n')
}

// WhatsApp invoice / thank-you summary
export function waInvoiceMessage({ clientName, destination, payment, invoiceNo }) {
  const total = Number(payment.total_amount || 0)
  const advance = Number(payment.advance_paid || 0)
  const balance = Number(payment.balance_due != null ? payment.balance_due : total - advance)
  return `Hi ${clientName}! 🙏

We've received your payment — *thank you* for booking with *${AGENCY_NAME}*!

🧾 *Invoice:* ${invoiceNo}
📦 *Package:* ${destination || '—'}
💳 *Received:* ${money(advance)}
${balance > 0 ? `⏳ *Balance due:* ${money(balance)}${payment.balance_due_date ? ` by ${payment.balance_due_date}` : ''}` : '✅ *Status:* Fully paid'}

A detailed invoice has been emailed to you. We can't wait to host you! ✈️`
}

// ── WHATSAPP via wa.me deep link ─────────────────────────────
// Opens WhatsApp on agent's device with pre-filled message
// Agent sends it manually — zero API cost, zero setup

export function waLink(phone, message) {
  const clean = phone.replace(/\D/g, '')
  const num = clean.startsWith('91') ? clean : `91${clean}`
  return `https://wa.me/${num}?text=${encodeURIComponent(message)}`
}

export function waQuoteMessage({ clientName, destination, from, to, travelers, amount }) {
  return `Hi ${clientName}! 👋

Here's your travel quote from *${AGENCY_NAME}*:

🌍 *Destination:* ${destination || '—'}
📅 *Dates:* ${from || '—'} → ${to || '—'}
👥 *Travellers:* ${travelers}
💰 *Quote:* ₹${Number(amount).toLocaleString('en-IN')}

To confirm your booking, just reply here or call us. We'll take care of everything! ✈️`
}

export function waItineraryMessage({ clientName, title, days }) {
  const dayLines = (days || []).slice(0, 5).map((d, i) =>
    `*Day ${i + 1}* (${d.date || '—'}) — ${d.city || ''}: ${d.activities || ''}`
  ).join('\n')
  return `Hi ${clientName}! Here's your itinerary for *${title}* ✈️\n\n${dayLines}\n\n${days.length > 5 ? `...and ${days.length - 5} more days. Full details sent to your email!` : ''}\n\n_— ${AGENCY_NAME}_`
}

export function waFollowupMessage({ clientName, message }) {
  return `Hi ${clientName}! 👋\n\n${message}\n\n_— ${AGENCY_NAME}_`
}

export function waReminderMessage({ clientName, type, details }) {
  const msgs = {
    balance_reminder: `Hi ${clientName}, just a reminder that your balance payment of *₹${details?.amount?.toLocaleString('en-IN') || '—'}* is due on *${details?.date || '—'}*. Please transfer at your earliest. 🙏`,
    visa_reminder: `Hi ${clientName}, please ensure your visa application is submitted. Your travel date is *${details?.date || '—'}*. Let us know if you need help! 🛂`,
    pre_departure: `Hi ${clientName}! Your trip to *${details?.destination || '—'}* is in a few days! 🎉\n\nPlease carry: valid ID, visa docs, travel insurance, and booking confirmations. Have a wonderful trip! ✈️`,
    post_trip: `Hi ${clientName}! Hope you had an amazing trip to *${details?.destination || '—'}* 🌟\n\nWe'd love to hear your feedback. A quick Google review would mean the world to us! 🙏`
  }
  return msgs[type] || `Hi ${clientName}, greetings from ${AGENCY_NAME}!`
}
