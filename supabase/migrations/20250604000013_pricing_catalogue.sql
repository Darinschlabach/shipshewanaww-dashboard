-- Pricing catalogue: variables used in quotes

CREATE TYPE pricing_catalogue_status AS ENUM ('active', 'inactive');

CREATE TABLE pricing_wood_species (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  multiplier NUMERIC(6, 3) NOT NULL DEFAULT 1,
  status pricing_catalogue_status NOT NULL DEFAULT 'active',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE pricing_finish_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  multiplier NUMERIC(6, 3) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE pricing_door_styles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  multiplier NUMERIC(6, 3) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER pricing_wood_species_updated_at
  BEFORE UPDATE ON pricing_wood_species
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER pricing_finish_types_updated_at
  BEFORE UPDATE ON pricing_finish_types
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER pricing_door_styles_updated_at
  BEFORE UPDATE ON pricing_door_styles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE pricing_wood_species ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_finish_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_door_styles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all" ON pricing_wood_species FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON pricing_finish_types FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON pricing_door_styles FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO pricing_wood_species (name, description, multiplier, status, sort_order) VALUES
  ('Paint Grade Maple', 'Paint-grade maple for painted finishes', 1.00, 'active', 1),
  ('White Oak', 'Standard white oak', 1.25, 'active', 2),
  ('Rift White Oak', 'Rift-cut white oak grain', 1.35, 'active', 3),
  ('Red Oak', 'Standard red oak', 1.15, 'active', 4),
  ('Cherry', 'Select cherry hardwood', 1.40, 'active', 5),
  ('Walnut', 'Premium walnut', 1.55, 'active', 6),
  ('Hickory', 'Rustic hickory', 1.30, 'active', 7);

INSERT INTO pricing_finish_types (name, multiplier, sort_order) VALUES
  ('Clear Finish', 1.00, 1),
  ('Stain', 1.10, 2),
  ('Paint', 1.05, 3),
  ('Specialty Finish', 1.25, 4);

INSERT INTO pricing_door_styles (name, multiplier, sort_order) VALUES
  ('Shaker', 1.00, 1),
  ('Beaded Shaker', 1.08, 2),
  ('Raised Panel', 1.15, 3),
  ('Slab', 0.95, 4);
