# Buddiez Holidays — CRM

Internal CRM for Buddiez Holidays: manage website booking enquiries, leads, itineraries, payments, follow-ups and reports. Built with React + Vite, Supabase, and a PWA install option.

## Features
- Live sync with the website's Supabase `bookings` table
- Leads pipeline, follow-ups, itineraries (shareable via WhatsApp & email)
- Payments with auto-sent branded invoice + thank-you email on full payment
- Supabase email/password authentication (staff-only access)
- Installable PWA, glassmorphic responsive UI

## Getting started

```bash
npm install
cp .env.example .env   # then fill in your values
npm run dev
```

## Environment variables
See `.env.example`. Set the same values as Vercel environment variables for deployment. All client-side config is prefixed `VITE_`.

| Variable | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase project URL (same project as the website) |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon public key |
| `VITE_AGENCY_NAME` | Agency display name |
| `VITE_AGENCY_WHATSAPP` / `VITE_AGENCY_PHONE` / `VITE_AGENCY_EMAIL` | Contact details used in messages |
| `VITE_BREVO_API_KEY` / `VITE_BREVO_SENDER_EMAIL` / `VITE_BREVO_SENDER_NAME` | Brevo transactional email |

## Database setup
Run `supabase_migration.sql` in the Supabase SQL Editor. It unlocks CRM read/update access to `bookings`, adds CRM tracking columns, and creates the `leads`, `itineraries`, `payments` and `followups` tables.

## Authentication
Create staff accounts in Supabase → Authentication → Users. There is no public sign-up.

## Deploy (Vercel)
This repo includes `vercel.json` (Vite framework + SPA rewrites). Import the repo into Vercel, add the `VITE_*` environment variables, and deploy. Build command `npm run build`, output `dist`.
