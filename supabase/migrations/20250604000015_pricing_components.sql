-- Components for pricing catalogue (same structure as cabinet types)

CREATE TABLE pricing_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  base_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  sq_ft_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX pricing_components_category_idx ON pricing_components (category);

CREATE TRIGGER pricing_components_updated_at
  BEFORE UPDATE ON pricing_components
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE pricing_components ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all" ON pricing_components FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO pricing_components (name, category, base_price, sq_ft_price, sort_order) VALUES
  ('Crown Molding', 'Molding & Trim', 85, 12, 1),
  ('Light Rail', 'Molding & Trim', 65, 10, 2),
  ('Scribe Filler', 'Molding & Trim', 45, 8, 3),
  ('Toe Kick', 'Molding & Trim', 55, 9, 4),
  ('Soft-Close Hinges (pair)', 'Hardware', 28, 0, 5),
  ('Drawer Slides — Undermount', 'Hardware', 95, 0, 6),
  ('Pull-Out Shelves', 'Hardware', 120, 0, 7),
  ('Lazy Susan Mechanism', 'Hardware', 185, 0, 8),
  ('Glass Shelf Clips (set)', 'Hardware', 22, 0, 9),
  ('LED Under-Cabinet Strip', 'Lighting', 140, 18, 10),
  ('Puck Light Kit', 'Lighting', 75, 0, 11),
  ('Quartz Countertop — Standard', 'Surfaces', 0, 68, 12),
  ('Butcher Block Top', 'Surfaces', 320, 42, 13),
  ('Corbels (pair)', 'Accessories', 110, 0, 14),
  ('Farmhouse Sink Cutout', 'Accessories', 150, 0, 15),
  ('Appliance Panel — Dishwasher', 'Accessories', 280, 35, 16),
  ('Wine Rack Insert', 'Accessories', 195, 0, 17),
  ('Trash Pull-Out Kit', 'Accessories', 165, 0, 18);
