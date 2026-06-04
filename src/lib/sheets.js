import { SHEET_ID, GOOGLE_API_KEY } from './supabase'

const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets'

// Append a row to a named sheet tab
export async function appendToSheet(sheetName, values) {
  if (!SHEET_ID || !GOOGLE_API_KEY) return { ok: false, error: 'Sheet not configured' }
  const range = `${sheetName}!A1`
  const url = `${SHEETS_BASE}/${SHEET_ID}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&key=${GOOGLE_API_KEY}`
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [values] })
    })
    return { ok: res.ok }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}

// Sync a lead row to Sheets
export function leadToSheetRow(lead) {
  return [
    lead.id,
    lead.created_at ? new Date(lead.created_at).toLocaleDateString('en-IN') : '',
    lead.full_name,
    lead.phone,
    lead.email || '',
    lead.source,
    lead.destination || '',
    lead.travel_from || '',
    lead.travel_to || '',
    lead.travelers,
    lead.budget_min ? `${lead.budget_min}-${lead.budget_max}` : '',
    lead.trip_type || '',
    lead.status,
    lead.assigned_agent || '',
    lead.notes || ''
  ]
}

// Sync a booking row to Sheets
export function bookingToSheetRow(b) {
  return [
    b.id,
    b.created_at ? new Date(b.created_at).toLocaleDateString('en-IN') : '',
    b.full_name,
    b.phone,
    b.email,
    b.destination || '',
    b.travel_from || '',
    b.travel_to || '',
    b.travelers,
    b.notes || ''
  ]
}
