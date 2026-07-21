CREATE TABLE production_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
  for_room TEXT NOT NULL,
  subject TEXT NOT NULL,
  due_date DATE NOT NULL DEFAULT CURRENT_DATE,
  completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX production_tasks_job_id_idx ON production_tasks(job_id);

ALTER TABLE production_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all" ON production_tasks
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
