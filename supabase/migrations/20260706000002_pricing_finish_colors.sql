CREATE TABLE pricing_finish_colors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER pricing_finish_colors_updated_at
  BEFORE UPDATE ON pricing_finish_colors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE pricing_finish_colors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all" ON pricing_finish_colors
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO pricing_finish_colors (name, sort_order) VALUES
  ('White', 1),
  ('Off White', 2),
  ('Gray', 3),
  ('Black', 4),
  ('Espresso', 5),
  ('Natural', 6);
