-- Additional contacts linked to a quote (lead)

CREATE TABLE lead_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (lead_id, contact_id)
);

CREATE INDEX lead_contacts_lead_id_idx ON lead_contacts (lead_id);

ALTER TABLE lead_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all" ON lead_contacts FOR ALL TO authenticated USING (true) WITH CHECK (true);
