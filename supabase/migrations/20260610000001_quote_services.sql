-- Manual service lines for quotes (not linked to pricing catalogue)

CREATE TABLE quote_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  description TEXT,
  price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX quote_services_lead_id_idx ON quote_services (lead_id);

ALTER TABLE quote_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all" ON quote_services
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
