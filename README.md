# Shipshewana Woodworks Management

Business management web app for Shipshewana Woodworks custom cabinet shop.

## Stack

- **Next.js 15** (App Router) + TypeScript
- **Tailwind CSS 4**
- **Supabase** (Auth + PostgreSQL)
- **Tabler Icons**

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Supabase project

1. Create a project at [supabase.com](https://supabase.com)
2. Copy `.env.local.example` to `.env.local` and add your URL and anon key:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

### 3. Run migrations

In the Supabase SQL Editor, run these files in order:

1. `supabase/migrations/20250528000001_initial_schema.sql`
2. `supabase/migrations/20250528000002_seed_data.sql`

Or use the Supabase CLI:

```bash
npx supabase link
npx supabase db push
```

### 4. Create your first user

In Supabase Dashboard → Authentication → Users → Add user (email + password).

Update the profile role if needed:

```sql
UPDATE profiles SET role = 'owner', full_name = 'Darin' WHERE email = 'your@email.com';
```

### 5. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you’ll be redirected to `/login`.

## Pages

| Route | Description |
|-------|-------------|
| `/dashboard` | Overview, alerts, metrics, jobs table |
| `/leads` | Lead pipeline, convert to job |
| `/jobs` | Job list with stage filters |
| `/jobs/[id]` | Job detail, pipeline, tracks, notes |
| `/contacts` | Contact directory |
| `/production` | Kanban board (drag & drop) |
| `/purchasing` | Purchase orders |
| `/calendar` | Monthly calendar |
| `/catalogue` | Product catalogue |
| `/admin` | Users & permissions |

## Brand colors

- Sidebar: `#6B1A2A`
- Cream accent: `#F5F0E8`
