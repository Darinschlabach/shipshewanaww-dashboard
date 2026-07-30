-- Custom calendar categories:
--   production → visible to all authenticated users
--   personal   → visible only to the owning user

CREATE TABLE IF NOT EXISTS calendar_custom_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  color TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('personal', 'production')),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT calendar_custom_categories_owner_check CHECK (
    (scope = 'production' AND user_id IS NULL)
    OR (scope = 'personal' AND user_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS calendar_custom_categories_scope_idx
  ON calendar_custom_categories (scope);

CREATE INDEX IF NOT EXISTS calendar_custom_categories_user_id_idx
  ON calendar_custom_categories (user_id);

ALTER TABLE calendar_custom_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "calendar_custom_categories_select" ON calendar_custom_categories;
DROP POLICY IF EXISTS "calendar_custom_categories_insert" ON calendar_custom_categories;
DROP POLICY IF EXISTS "calendar_custom_categories_update" ON calendar_custom_categories;
DROP POLICY IF EXISTS "calendar_custom_categories_delete" ON calendar_custom_categories;

CREATE POLICY "calendar_custom_categories_select" ON calendar_custom_categories
  FOR SELECT TO authenticated
  USING (
    scope = 'production'
    OR (scope = 'personal' AND user_id = auth.uid())
  );

CREATE POLICY "calendar_custom_categories_insert" ON calendar_custom_categories
  FOR INSERT TO authenticated
  WITH CHECK (
    (scope = 'production' AND user_id IS NULL)
    OR (scope = 'personal' AND user_id = auth.uid())
  );

CREATE POLICY "calendar_custom_categories_update" ON calendar_custom_categories
  FOR UPDATE TO authenticated
  USING (
    scope = 'production'
    OR (scope = 'personal' AND user_id = auth.uid())
  )
  WITH CHECK (
    (scope = 'production' AND user_id IS NULL)
    OR (scope = 'personal' AND user_id = auth.uid())
  );

CREATE POLICY "calendar_custom_categories_delete" ON calendar_custom_categories
  FOR DELETE TO authenticated
  USING (
    scope = 'production'
    OR (scope = 'personal' AND user_id = auth.uid())
  );
