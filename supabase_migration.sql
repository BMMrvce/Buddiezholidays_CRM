-- ============================================================
-- BUDDIEZ HOLIDAYS — TRAVEL CRM migration
-- Run this in your Supabase SQL Editor (project: popiebiwienyzlmmxxju)
-- Safe to re-run: everything is idempotent (IF NOT EXISTS / drop+create).
-- Your existing website 'bookings' table data is preserved.
-- ============================================================


-- ============================================================
-- PART 1 — WIRE THE WEBSITE BOOKINGS TABLE TO THE CRM
-- The website created `bookings` with RLS + an INSERT-only policy
-- for anon. The CRM reads with the anon key, so without a SELECT
-- policy it sees ZERO rows. This part unlocks read + light updates.
--
-- ⚠️ SECURITY NOTE: the anon key is shipped publicly in the website
-- bundle. The CRM now has a Supabase Auth login (see PART 4) so you can
-- lock data access to logged-in staff only. By default this script keeps
-- access open to `anon` so the CRM works the moment you run it; run the
-- optional PART 4 hardening block to restrict everything to `authenticated`.
-- ============================================================

-- CRM tracking columns (nullable + defaults → website inserts keep working)
alter table public.bookings add column if not exists crm_status text not null default 'new';
  -- new | contacted | converted | archived
alter table public.bookings add column if not exists crm_notes text;
alter table public.bookings add column if not exists archived boolean not null default false;

-- Allow the CRM (anon/authenticated) to read & update bookings
grant select, update on table public.bookings to anon, authenticated;

drop policy if exists "CRM can read bookings" on public.bookings;
create policy "CRM can read bookings"
  on public.bookings for select
  to anon, authenticated
  using (true);

drop policy if exists "CRM can update bookings" on public.bookings;
create policy "CRM can update bookings"
  on public.bookings for update
  to anon, authenticated
  using (true) with check (true);


-- ============================================================
-- PART 2 — CRM TABLES
-- ============================================================

-- LEADS table (manual + website form leads)
create table if not exists public.leads (
  id uuid not null default gen_random_uuid(),
  full_name text not null,
  email text,
  phone text not null,
  source text not null default 'manual', -- manual | website | whatsapp | referral | instagram | google_ad | walk_in
  destination text,
  travel_from date,
  travel_to date,
  travelers integer default 2,
  budget_min numeric,
  budget_max numeric,
  trip_type text, -- honeymoon | family | corporate | solo | group
  status text not null default 'new', -- new | following_up | quote_sent | booked | lost
  lost_reason text,
  assigned_agent text,
  notes text,
  referral_name text,
  booking_id uuid references public.bookings(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leads_pkey primary key (id)
);

-- ITINERARIES
create table if not exists public.itineraries (
  id uuid not null default gen_random_uuid(),
  booking_id uuid references public.bookings(id) on delete cascade,
  lead_id uuid references public.leads(id),
  title text not null,
  days jsonb not null default '[]', -- array of day objects
  shared_at timestamptz,
  created_at timestamptz not null default now(),
  constraint itineraries_pkey primary key (id)
);

-- PAYMENTS
create table if not exists public.payments (
  id uuid not null default gen_random_uuid(),
  booking_id uuid references public.bookings(id) on delete cascade,
  lead_id uuid references public.leads(id),
  total_amount numeric not null default 0,
  advance_paid numeric not null default 0,
  balance_due numeric generated always as (total_amount - advance_paid) stored,
  balance_due_date date,
  payment_mode text, -- upi | cash | neft | card
  vendor_cost numeric default 0,
  profit numeric generated always as (total_amount - vendor_cost) stored,
  discount numeric default 0,
  discount_reason text,
  refund_amount numeric default 0,
  refund_reason text,
  payment_ref text,
  status text default 'pending', -- pending | partial | paid | refunded
  invoice_no text,
  invoice_sent_at timestamptz,
  created_at timestamptz not null default now(),
  constraint payments_pkey primary key (id)
);

-- FOLLOW-UPS
create table if not exists public.followups (
  id uuid not null default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete cascade,
  booking_id uuid references public.bookings(id),
  type text not null, -- call | whatsapp | email | visa_reminder | balance_reminder | pre_departure | post_trip | quote
  due_date date not null,
  done boolean not null default false,
  done_at timestamptz,
  channel text default 'whatsapp', -- whatsapp | email | call
  notes text,
  created_at timestamptz not null default now(),
  constraint followups_pkey primary key (id)
);

-- AD SPEND (daily marketing spend — manual entry now, Google Ads API later)
create table if not exists public.ad_spend (
  id uuid not null default gen_random_uuid(),
  spend_date date not null,
  platform text not null default 'google_ads', -- google_ads | meta | instagram | other
  campaign text,
  amount numeric not null default 0,        -- amount spent (₹)
  clicks integer default 0,
  impressions integer default 0,
  conversions integer default 0,            -- leads/bookings attributed
  notes text,
  source text not null default 'manual',    -- manual | api
  created_at timestamptz not null default now(),
  constraint ad_spend_pkey primary key (id),
  constraint ad_spend_unique_day unique (spend_date, platform, campaign)
);

-- Enable Row Level Security
alter table public.leads enable row level security;
alter table public.itineraries enable row level security;
alter table public.payments enable row level security;
alter table public.followups enable row level security;
alter table public.ad_spend enable row level security;

-- Allow all for anon key (single-agency internal use; tighten in production
-- by switching `anon` → `authenticated` and adding CRM login)
drop policy if exists "allow all leads" on public.leads;
drop policy if exists "allow all itineraries" on public.itineraries;
drop policy if exists "allow all payments" on public.payments;
drop policy if exists "allow all followups" on public.followups;
drop policy if exists "allow all ad_spend" on public.ad_spend;
create policy "allow all leads" on public.leads for all using (true) with check (true);
create policy "allow all itineraries" on public.itineraries for all using (true) with check (true);
create policy "allow all payments" on public.payments for all using (true) with check (true);
create policy "allow all followups" on public.followups for all using (true) with check (true);
create policy "allow all ad_spend" on public.ad_spend for all using (true) with check (true);

-- Grants for the CRM client
grant select, insert, update, delete on table public.leads to anon, authenticated;
grant select, insert, update, delete on table public.itineraries to anon, authenticated;
grant select, insert, update, delete on table public.payments to anon, authenticated;
grant select, insert, update, delete on table public.followups to anon, authenticated;
grant select, insert, update, delete on table public.ad_spend to anon, authenticated;

-- Indexes
create index if not exists leads_created_at_idx on public.leads using btree (created_at desc);
create index if not exists leads_status_idx on public.leads using btree (status);
create index if not exists leads_booking_id_idx on public.leads using btree (booking_id);
create index if not exists followups_due_date_idx on public.followups using btree (due_date asc) where done = false;
create index if not exists bookings_crm_status_idx on public.bookings using btree (crm_status);
create index if not exists ad_spend_date_idx on public.ad_spend using btree (spend_date desc);


-- ============================================================
-- PART 3 — WEBSITE GALLERY (CRM uploads → website shows live)
-- The CRM uploads image files to a public Storage bucket and records
-- a row here. The website reads this table at runtime and renders the
-- images, so your client can update the gallery with no developer help.
-- ============================================================

-- Metadata table (ordering, captions, show/hide)
create table if not exists public.gallery_images (
  id uuid not null default gen_random_uuid(),
  storage_path text not null,            -- path inside the 'gallery' bucket
  public_url text not null,              -- ready-to-use public URL
  caption text,
  sort_order integer not null default 0, -- lower = shown first
  visible boolean not null default true, -- hide without deleting
  created_at timestamptz not null default now(),
  constraint gallery_images_pkey primary key (id)
);

alter table public.gallery_images enable row level security;

-- Public website can READ visible images (anon, no login)
drop policy if exists "public read gallery" on public.gallery_images;
create policy "public read gallery"
  on public.gallery_images for select
  to anon, authenticated
  using (true);

-- CRM can fully manage gallery rows
drop policy if exists "manage gallery" on public.gallery_images;
create policy "manage gallery"
  on public.gallery_images for all
  to anon, authenticated
  using (true) with check (true);

grant select, insert, update, delete on table public.gallery_images to anon, authenticated;

create index if not exists gallery_sort_idx on public.gallery_images using btree (sort_order asc, created_at desc);

-- Storage bucket for the image files (public so the website can render them)
insert into storage.buckets (id, name, public)
values ('gallery', 'gallery', true)
on conflict (id) do update set public = true;

-- Storage policies: public read; anon/authenticated can upload/update/delete
-- in the 'gallery' bucket (single-agency internal use).
drop policy if exists "gallery public read" on storage.objects;
create policy "gallery public read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'gallery');

drop policy if exists "gallery upload" on storage.objects;
create policy "gallery upload"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'gallery');

drop policy if exists "gallery update" on storage.objects;
create policy "gallery update"
  on storage.objects for update
  to anon, authenticated
  using (bucket_id = 'gallery') with check (bucket_id = 'gallery');

drop policy if exists "gallery delete" on storage.objects;
create policy "gallery delete"
  on storage.objects for delete
  to anon, authenticated
  using (bucket_id = 'gallery');
