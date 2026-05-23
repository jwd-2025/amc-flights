# AMC Flight Tracker

Event flight tracker — guests enter flight info, admins manage pickups/dropoffs, drivers see their assignments.

## Features

- Phone-number login (no password needed)
- Guests enter arrival/departure flights + accommodation
- Automatic flight status updates every 4 hours (via AviationStack)
- Change history on every flight
- In-app notifications for flight changes (shown on next open, only for future flights)
- Admin dashboard: edit guests, assign drivers to pickups/dropoffs
- Driver dashboard: see assigned runs, mark complete

## Roles

| Role | Access |
|------|--------|
| `guest` | Own dashboard, own flights, own accommodation |
| `driver` | Assigned transfers only |
| `admin` | Everything + guest/transfer management |

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor → New Query**, paste the contents of `supabase/schema.sql`, and run it
3. At the bottom of that file, uncomment the seed query and replace the phone number with yours to create your admin account
4. Go to **Settings → API** and copy:
   - Project URL → `VITE_SUPABASE_URL`
   - `anon` key → `VITE_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`

### 2. AviationStack (optional, enables auto flight lookup)

1. Sign up at [aviationstack.com](https://aviationstack.com) — free tier: 500 req/month
2. Copy your API key → `VITE_AVIATIONSTACK_KEY` and `AVIATIONSTACK_KEY`

### 3. Netlify

1. Connect this GitHub repo in the [Netlify dashboard](https://netlify.com)
2. Build settings are auto-detected from `netlify.toml`
3. Add environment variables in **Site → Environment Variables**:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `AVIATIONSTACK_KEY` *(optional)*

### 4. First admin account

After running the Supabase schema, run this in the SQL Editor (replace phone + name):

```sql
insert into profiles (phone, name, email, role)
values ('+12145550000', 'Your Name', 'you@example.com', 'admin');
```

Then log into the app with that phone number — you'll land on the admin dashboard.

## Local development

```bash
cp .env.example .env
# fill in .env with your Supabase keys
npm install
npm run dev
```

## Tech stack

- React + Vite + Tailwind CSS
- Supabase (database, open RLS policies)
- Netlify (hosting + scheduled functions for flight updates)
- AviationStack API (free tier)
- React Router v6
- Day.js
