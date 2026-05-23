-- ============================================================
-- AMC Flight Tracker — Supabase Schema
-- Run this in: Supabase Dashboard > SQL Editor > New Query
-- ============================================================

-- Profiles: all users (guests, drivers, admins)
create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  phone text unique not null,
  name text,
  email text,
  role text not null default 'guest' check (role in ('guest', 'driver', 'admin')),
  created_at timestamptz default now()
);

-- Accommodations: hotel or local housing per guest
create table if not exists accommodations (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  type text default 'hotel' check (type in ('hotel', 'local_housing')),
  name text,
  address text,
  contact_info text,
  check_in date,
  check_out date,
  notes text,
  updated_at timestamptz default now()
);

-- Flights: arrivals and departures per guest
create table if not exists flights (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  direction text not null check (direction in ('arrival', 'departure')),
  flight_number text not null,
  airline text,
  origin_code text,
  origin_name text,
  destination_code text,
  destination_name text,
  scheduled_time timestamptz,
  actual_time timestamptz,
  status text default 'scheduled' check (status in ('scheduled', 'in_air', 'landed', 'delayed', 'cancelled', 'diverted')),
  terminal text,
  gate text,
  baggage_claim text,
  notes text,
  api_last_checked timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Flight history: change log for each flight
create table if not exists flight_history (
  id uuid primary key default gen_random_uuid(),
  flight_id uuid not null references flights(id) on delete cascade,
  changed_at timestamptz default now(),
  changed_by uuid references profiles(id) on delete set null, -- null = system update
  changes jsonb not null default '{}'
);

-- Transfers: pickups and dropoffs
create table if not exists transfers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  flight_id uuid references flights(id) on delete set null,
  transfer_type text not null check (transfer_type in ('pickup', 'dropoff')),
  driver_id uuid references profiles(id) on delete set null,
  scheduled_time timestamptz,
  pickup_location text,
  dropoff_location text,
  status text default 'pending' check (status in ('pending', 'assigned', 'in_progress', 'completed')),
  notes text,
  completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Notifications: per-guest, for flight changes
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  flight_id uuid references flights(id) on delete cascade,
  message text not null,
  seen boolean default false,
  created_at timestamptz default now()
);

-- ============================================================
-- Row Level Security
-- Since we use phone-based auth (no Supabase Auth), we open
-- up the tables and rely on app-level access control.
-- Tighten these policies if you add Supabase Auth later.
-- ============================================================

alter table profiles enable row level security;
alter table accommodations enable row level security;
alter table flights enable row level security;
alter table flight_history enable row level security;
alter table transfers enable row level security;
alter table notifications enable row level security;

-- Allow all operations via anon key (app controls access by profile role)
-- Note: switch these to authenticated-only policies if you add Supabase Auth
create policy "open_profiles"      on profiles      for all using (true) with check (true);
create policy "open_accommodations" on accommodations for all using (true) with check (true);
create policy "open_flights"       on flights        for all using (true) with check (true);
create policy "open_flight_history" on flight_history for all using (true) with check (true);
create policy "open_transfers"     on transfers      for all using (true) with check (true);
create policy "open_notifications" on notifications  for all using (true) with check (true);

-- ============================================================
-- Seed: create your first admin account
-- Replace the phone number with yours (format: +12145551234)
-- ============================================================

-- insert into profiles (phone, name, email, role)
-- values ('+12145550000', 'Admin Name', 'admin@example.com', 'admin')
-- on conflict (phone) do update set role = 'admin';
