-- Cabinet types for pricing catalogue

CREATE TABLE pricing_cabinet_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  base_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  sq_ft_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX pricing_cabinet_types_category_idx ON pricing_cabinet_types (category);

CREATE TRIGGER pricing_cabinet_types_updated_at
  BEFORE UPDATE ON pricing_cabinet_types
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE pricing_cabinet_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all" ON pricing_cabinet_types FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO pricing_cabinet_types (name, category, base_price, sq_ft_price, sort_order) VALUES
  ('Drawer Base Cabinet', 'Base Cabinets', 550, 95, 1),
  ('Single Door Base', 'Base Cabinets', 480, 88, 2),
  ('Double Door Base', 'Base Cabinets', 620, 92, 3),
  ('Sink Base Cabinet', 'Base Cabinets', 590, 90, 4),
  ('Blind Corner Base', 'Base Cabinets', 710, 98, 5),
  ('Standard Wall Cabinet', 'Wall Cabinets', 320, 72, 6),
  ('Wall Cabinet — Glass Doors', 'Wall Cabinets', 410, 78, 7),
  ('Microwave Wall Cabinet', 'Wall Cabinets', 380, 75, 8),
  ('Open Wall Shelf', 'Wall Cabinets', 260, 65, 9),
  ('Pantry Tall Cabinet', 'Tall Cabinets', 890, 105, 10),
  ('Oven Tall Cabinet', 'Tall Cabinets', 820, 100, 11),
  ('Utility Tall Cabinet', 'Tall Cabinets', 760, 98, 12),
  ('Lazy Susan Corner', 'Base Cabinets', 680, 96, 13),
  ('Pull-Out Trash Base', 'Base Cabinets', 540, 91, 14),
  ('Spice Pull-Out', 'Wall Cabinets', 290, 70, 15),
  ('Appliance Garage', 'Wall Cabinets', 450, 80, 16),
  ('Wine Rack Base', 'Base Cabinets', 510, 89, 17),
  ('Desk Drawer Base', 'Base Cabinets', 600, 94, 18);
