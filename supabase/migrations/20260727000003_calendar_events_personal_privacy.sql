-- Personal calendar privacy: each user only sees their own personal events.
-- Production events remain visible to all authenticated users.

ALTER TYPE calendar_event_type ADD VALUE IF NOT EXISTS 'installation';
ALTER TYPE calendar_event_type ADD VALUE IF NOT EXISTS 'personal';
ALTER TYPE calendar_event_type ADD VALUE IF NOT EXISTS 'deadline';
ALTER TYPE calendar_event_type ADD VALUE IF NOT EXISTS 'other';

ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS calendar_scope TEXT NOT NULL DEFAULT 'production';

ALTER TABLE calendar_events
  DROP CONSTRAINT IF EXISTS calendar_events_calendar_scope_check;

ALTER TABLE calendar_events
  ADD CONSTRAINT calendar_events_calendar_scope_check
  CHECK (calendar_scope IN ('production', 'personal'));

-- Backfill older personal/other events into the personal scope
UPDATE calendar_events
SET calendar_scope = 'personal'
WHERE event_type::text IN ('personal', 'other')
  AND (calendar_scope IS NULL OR calendar_scope = 'production');

CREATE INDEX IF NOT EXISTS calendar_events_user_id_idx
  ON calendar_events (user_id);

CREATE INDEX IF NOT EXISTS calendar_events_scope_idx
  ON calendar_events (calendar_scope);

DROP POLICY IF EXISTS "auth_all" ON calendar_events;

DROP POLICY IF EXISTS "calendar_events_select" ON calendar_events;
DROP POLICY IF EXISTS "calendar_events_insert" ON calendar_events;
DROP POLICY IF EXISTS "calendar_events_update" ON calendar_events;
DROP POLICY IF EXISTS "calendar_events_delete" ON calendar_events;

CREATE POLICY "calendar_events_select" ON calendar_events
  FOR SELECT TO authenticated
  USING (
    calendar_scope = 'production'
    OR user_id = auth.uid()
  );

CREATE POLICY "calendar_events_insert" ON calendar_events
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "calendar_events_update" ON calendar_events
  FOR UPDATE TO authenticated
  USING (
    calendar_scope = 'production'
    OR user_id = auth.uid()
  )
  WITH CHECK (
    calendar_scope = 'production'
    OR user_id = auth.uid()
  );

CREATE POLICY "calendar_events_delete" ON calendar_events
  FOR DELETE TO authenticated
  USING (
    calendar_scope = 'production'
    OR user_id = auth.uid()
  );
