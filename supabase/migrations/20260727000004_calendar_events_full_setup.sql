-- Run this once in Supabase SQL Editor to enable full calendar features.
-- Safe to re-run (uses IF NOT EXISTS / DROP IF EXISTS).
--
-- Privacy model:
--   production → visible to all authenticated users
--   personal   → visible only to the owning user (user_id)

-- Event types (must exist before any UPDATE referencing them)
ALTER TYPE calendar_event_type ADD VALUE IF NOT EXISTS 'installation';
ALTER TYPE calendar_event_type ADD VALUE IF NOT EXISTS 'personal';
ALTER TYPE calendar_event_type ADD VALUE IF NOT EXISTS 'deadline';
ALTER TYPE calendar_event_type ADD VALUE IF NOT EXISTS 'other';
ALTER TYPE calendar_event_type ADD VALUE IF NOT EXISTS 'drafting';
ALTER TYPE calendar_event_type ADD VALUE IF NOT EXISTS 'shop_closed';
ALTER TYPE calendar_event_type ADD VALUE IF NOT EXISTS 'finishing';

-- Time fields
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS start_time TIME;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS end_time TIME;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS is_all_day BOOLEAN DEFAULT false;

-- Details
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS description TEXT;

-- Ownership / privacy
ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS calendar_scope TEXT NOT NULL DEFAULT 'production';

ALTER TABLE calendar_events
  DROP CONSTRAINT IF EXISTS calendar_events_calendar_scope_check;

ALTER TABLE calendar_events
  ADD CONSTRAINT calendar_events_calendar_scope_check
  CHECK (calendar_scope IN ('production', 'personal'));

-- Backfill older personal-type rows into the personal scope
UPDATE calendar_events
SET calendar_scope = 'personal'
WHERE event_type::text IN ('personal', 'other')
  AND calendar_scope = 'production';

CREATE INDEX IF NOT EXISTS calendar_events_user_id_idx
  ON calendar_events (user_id);

CREATE INDEX IF NOT EXISTS calendar_events_scope_idx
  ON calendar_events (calendar_scope);

ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

-- Replace any open "everyone can see everything" policy
DROP POLICY IF EXISTS "auth_all" ON calendar_events;
DROP POLICY IF EXISTS "calendar_events_select" ON calendar_events;
DROP POLICY IF EXISTS "calendar_events_insert" ON calendar_events;
DROP POLICY IF EXISTS "calendar_events_update" ON calendar_events;
DROP POLICY IF EXISTS "calendar_events_delete" ON calendar_events;

-- Production: shared. Personal: owner only.
CREATE POLICY "calendar_events_select" ON calendar_events
  FOR SELECT TO authenticated
  USING (
    calendar_scope = 'production'
    OR (
      calendar_scope = 'personal'
      AND user_id IS NOT NULL
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "calendar_events_insert" ON calendar_events
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      calendar_scope = 'production'
      OR (
        calendar_scope = 'personal'
        AND user_id = auth.uid()
      )
    )
  );

CREATE POLICY "calendar_events_update" ON calendar_events
  FOR UPDATE TO authenticated
  USING (
    calendar_scope = 'production'
    OR (
      calendar_scope = 'personal'
      AND user_id = auth.uid()
    )
  )
  WITH CHECK (
    calendar_scope = 'production'
    OR (
      calendar_scope = 'personal'
      AND user_id IS NOT NULL
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "calendar_events_delete" ON calendar_events
  FOR DELETE TO authenticated
  USING (
    calendar_scope = 'production'
    OR (
      calendar_scope = 'personal'
      AND user_id = auth.uid()
    )
  );

-- Refresh PostgREST schema cache so new columns are visible immediately
NOTIFY pgrst, 'reload schema';
