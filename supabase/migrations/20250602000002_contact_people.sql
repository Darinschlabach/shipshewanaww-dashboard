-- Associated people for contacts (employees, etc.)

CREATE TABLE contact_people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  positions TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX contact_people_contact_id_idx ON contact_people (contact_id);

CREATE TRIGGER contact_people_updated_at BEFORE UPDATE ON contact_people
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE contact_people ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all" ON contact_people FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
