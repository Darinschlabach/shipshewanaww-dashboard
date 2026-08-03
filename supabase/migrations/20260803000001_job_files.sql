-- Job file metadata (drawings / misc uploads per job).
CREATE TABLE IF NOT EXISTS job_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS job_files_job_id_idx ON job_files (job_id);
CREATE INDEX IF NOT EXISTS job_files_category_idx
  ON job_files (job_id, drawing_category);

ALTER TABLE job_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "job_files_auth_all" ON job_files;
CREATE POLICY "job_files_auth_all" ON job_files
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Private storage bucket for job file binaries.
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('job-files', 'job-files', false, 52428800)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "job_files_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "job_files_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "job_files_storage_update" ON storage.objects;
DROP POLICY IF EXISTS "job_files_storage_delete" ON storage.objects;

CREATE POLICY "job_files_storage_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'job-files');

CREATE POLICY "job_files_storage_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'job-files');

CREATE POLICY "job_files_storage_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'job-files')
  WITH CHECK (bucket_id = 'job-files');

CREATE POLICY "job_files_storage_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'job-files');
