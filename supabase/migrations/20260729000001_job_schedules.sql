CREATE TABLE IF NOT EXISTS job_schedules (
  job_id UUID PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
  fabricating_start DATE,
  finishing_start DATE,
  delivery_date DATE,
  color TEXT NOT NULL DEFAULT 'red'
    CHECK (color IN ('red', 'blue', 'purple', 'orange', 'yellow')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE job_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "job_schedules_auth_all" ON job_schedules;
CREATE POLICY "job_schedules_auth_all" ON job_schedules
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
