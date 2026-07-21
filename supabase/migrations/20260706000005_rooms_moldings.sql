CREATE TABLE pricing_base_moldings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE pricing_crown_moldings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER pricing_base_moldings_updated_at
  BEFORE UPDATE ON pricing_base_moldings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER pricing_crown_moldings_updated_at
  BEFORE UPDATE ON pricing_crown_moldings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE pricing_base_moldings ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_crown_moldings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all" ON pricing_base_moldings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "auth_all" ON pricing_crown_moldings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS base_molding TEXT,
  ADD COLUMN IF NOT EXISTS crown_molding TEXT;
