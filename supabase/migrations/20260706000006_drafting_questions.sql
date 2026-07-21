CREATE TABLE drafting_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
  for_room TEXT NOT NULL,
  question TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'answered')),
  asked_on DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX drafting_questions_job_id_idx ON drafting_questions(job_id);

ALTER TABLE drafting_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all" ON drafting_questions
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
