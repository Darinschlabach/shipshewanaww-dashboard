-- Rooms linked to jobs
CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  wood_species TEXT,
  door_style TEXT,
  finish_type TEXT CHECK (finish_type IN ('Painted', 'Stained')),
  finish_color TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX rooms_job_id_idx ON rooms(job_id);

ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all" ON rooms
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
