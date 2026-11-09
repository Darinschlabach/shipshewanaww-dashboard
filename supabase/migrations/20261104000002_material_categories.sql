CREATE TABLE costing_material_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT costing_material_categories_name_present CHECK (length(trim(name)) > 0),
  CONSTRAINT costing_material_categories_name_unique UNIQUE (name)
);

CREATE TRIGGER costing_material_categories_updated_at
  BEFORE UPDATE ON costing_material_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

REVOKE ALL ON TABLE costing_material_categories FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE costing_material_categories TO authenticated, service_role;

ALTER TABLE costing_material_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY costing_admin_all
  ON costing_material_categories
  FOR ALL
  TO authenticated
  USING (costing_is_admin())
  WITH CHECK (costing_is_admin());

INSERT INTO costing_material_categories (name, sort_order) VALUES
  ('Plywood', 1),
  ('Hardwood', 2),
  ('MDF', 3),
  ('Melamine', 4),
  ('Veneer', 5),
  ('Other', 6);

ALTER TABLE costing_materials
  ADD COLUMN category_id uuid REFERENCES costing_material_categories (id) ON DELETE RESTRICT;

UPDATE costing_materials AS material
SET category_id = category.id
FROM costing_material_categories AS category
WHERE category.name = CASE material.material_type
  WHEN 'sheet' THEN 'Plywood'
  WHEN 'lumber' THEN 'Hardwood'
  ELSE 'Other'
END;

ALTER TABLE costing_materials
  ALTER COLUMN category_id SET NOT NULL;

CREATE INDEX costing_materials_category_id_idx ON costing_materials (category_id);
