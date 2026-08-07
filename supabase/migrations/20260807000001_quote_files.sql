-- Quote file metadata (drawings / misc uploads per quote/lead).
CREATE TABLE IF NOT EXISTS quote_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  storage_path TEXT NOT NULL UNIQUE,
  drawing_category TEXT NOT NULL
    CHECK (drawing_category IN ('provided_drawings', 'production_drawings', 'misc')),
  file_type TEXT NOT NULL DEFAULT 'doc'
    CHECK (file_type IN ('pdf', 'image', 'spreadsheet', 'folder', 'doc')),
  size_bytes BIGINT NOT NULL DEFAULT 0 CHECK (size_bytes >= 0),
  uploaded_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_by_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS quote_files_quote_id_idx ON quote_files (quote_id);
CREATE INDEX IF NOT EXISTS quote_files_category_idx
  ON quote_files (quote_id, drawing_category);

ALTER TABLE quote_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quote_files_auth_all" ON quote_files;
CREATE POLICY "quote_files_auth_all" ON quote_files
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Private storage bucket for quote file binaries.
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('quote-files', 'quote-files', false, 52428800)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "quote_files_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "quote_files_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "quote_files_storage_update" ON storage.objects;
DROP POLICY IF EXISTS "quote_files_storage_delete" ON storage.objects;

CREATE POLICY "quote_files_storage_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'quote-files');

CREATE POLICY "quote_files_storage_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'quote-files');

CREATE POLICY "quote_files_storage_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'quote-files')
  WITH CHECK (bucket_id = 'quote-files');

CREATE POLICY "quote_files_storage_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'quote-files');
