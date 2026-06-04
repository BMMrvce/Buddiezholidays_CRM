import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseKey)

export const AGENCY_NAME = import.meta.env.VITE_AGENCY_NAME || 'Travel Agency'
export const AGENCY_WA = import.meta.env.VITE_AGENCY_WHATSAPP || ''
export const AGENCY_PHONE = import.meta.env.VITE_AGENCY_PHONE || ''
export const AGENCY_EMAIL = import.meta.env.VITE_AGENCY_EMAIL || ''
export const BREVO_KEY = import.meta.env.VITE_BREVO_API_KEY || ''
export const BREVO_SENDER_EMAIL = import.meta.env.VITE_BREVO_SENDER_EMAIL || AGENCY_EMAIL
export const BREVO_SENDER_NAME = import.meta.env.VITE_BREVO_SENDER_NAME || AGENCY_NAME
export const SHEET_ID = import.meta.env.VITE_GOOGLE_SHEET_ID || ''
export const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY || ''
