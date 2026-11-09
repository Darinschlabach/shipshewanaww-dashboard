-- Component-based cabinet costing (test), separate from the live quoting system.
-- Does not alter existing tables, columns, policies, or functions.
-- The only link to live data is costing_quotes.contact_id, which may point at a contact.
--
-- Administrator access is profiles.role = 'owner'. Office and shop cannot read or write.
-- Percent columns are whole numbers: 15 means 15%, 30 means 30%.

CREATE TYPE costing_material_type AS ENUM ('sheet', 'lumber', 'sqft', 'linear_ft', 'each');
CREATE TYPE costing_finish_type AS ENUM ('stain', 'paint', 'glaze', 'clear_coat');
CREATE TYPE costing_slot_type AS ENUM ('material', 'door', 'exterior_finish', 'interior_finish');
CREATE TYPE costing_quote_status AS ENUM ('draft', 'sent');

-- Reads the caller's profile as the definer so office/shop cannot widen their own access.
CREATE OR REPLACE FUNCTION costing_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
      AND role = 'owner'
  );
$$;

REVOKE ALL ON FUNCTION costing_is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION costing_is_admin() TO authenticated;

CREATE OR REPLACE FUNCTION costing_prepare_material()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  sheet_pct numeric;
  lumber_pct numeric;
BEGIN
  IF NEW.material_type = 'sheet' THEN
    IF NEW.sheet_length IS NULL THEN
      NEW.sheet_length := 96;
    END IF;
    IF NEW.sheet_width IS NULL THEN
      NEW.sheet_width := 48;
    END IF;
  END IF;

  -- Sheet goods use the sheet default. Lumber uses the lumber default.
  -- sqft, linear_ft, and each stay at 0 until a value is entered.
  IF NEW.waste_pct IS NULL THEN
    SELECT default_waste_sheet_pct, default_waste_lumber_pct
      INTO sheet_pct, lumber_pct
      FROM costing_settings
      LIMIT 1;

    IF NEW.material_type = 'sheet' THEN
      NEW.waste_pct := COALESCE(sheet_pct, 15);
    ELSIF NEW.material_type = 'lumber' THEN
      NEW.waste_pct := COALESCE(lumber_pct, 30);
    ELSE
      NEW.waste_pct := 0;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION costing_validate_schedule_item()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  chosen_slot costing_slot_type;
  chosen_finish costing_finish_type;
BEGIN
  SELECT slot_type INTO chosen_slot
  FROM costing_slots
  WHERE id = NEW.slot_id;

  IF chosen_slot IS NULL THEN
    RAISE EXCEPTION 'Unknown costing slot';
  END IF;

  IF chosen_slot = 'material' THEN
    IF NEW.material_id IS NULL OR NEW.door_style_id IS NOT NULL OR NEW.finish_id IS NOT NULL THEN
      RAISE EXCEPTION 'A material slot can only reference a material';
    END IF;
  ELSIF chosen_slot = 'door' THEN
    IF NEW.door_style_id IS NULL OR NEW.material_id IS NOT NULL OR NEW.finish_id IS NOT NULL THEN
      RAISE EXCEPTION 'A door slot can only reference a door style';
    END IF;
  ELSIF chosen_slot IN ('exterior_finish', 'interior_finish') THEN
    IF NEW.finish_id IS NULL OR NEW.material_id IS NOT NULL OR NEW.door_style_id IS NOT NULL THEN
      RAISE EXCEPTION 'A finish slot can only reference a finish';
    END IF;

    SELECT finish_type INTO chosen_finish
    FROM costing_finishes
    WHERE id = NEW.finish_id;

    IF chosen_finish IS NULL THEN
      RAISE EXCEPTION 'Unknown costing finish';
    END IF;

    IF chosen_slot = 'exterior_finish' AND chosen_finish NOT IN ('stain', 'paint', 'glaze') THEN
      RAISE EXCEPTION 'Exterior finish must be stain, paint, or glaze';
    END IF;

    IF chosen_slot = 'interior_finish' AND chosen_finish <> 'clear_coat' THEN
      RAISE EXCEPTION 'Interior finish must be a clear coat';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION costing_guard_finish_type()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.finish_type IS NOT DISTINCT FROM OLD.finish_type THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM costing_schedule_items AS item
    JOIN costing_slots AS slot ON slot.id = item.slot_id
    WHERE item.finish_id = NEW.id
      AND slot.slot_type = 'exterior_finish'
      AND NEW.finish_type NOT IN ('stain', 'paint', 'glaze')
  ) OR EXISTS (
    SELECT 1
    FROM costing_schedule_items AS item
    JOIN costing_slots AS slot ON slot.id = item.slot_id
    WHERE item.finish_id = NEW.id
      AND slot.slot_type = 'interior_finish'
      AND NEW.finish_type <> 'clear_coat'
  ) THEN
    RAISE EXCEPTION 'This finish is assigned to a schedule slot that does not allow the new type';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION costing_guard_slot_type()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.slot_type IS NOT DISTINCT FROM OLD.slot_type THEN
    RETURN NEW;
  END IF;

  IF NEW.slot_type = 'material' AND EXISTS (
    SELECT 1 FROM costing_schedule_items
    WHERE slot_id = NEW.id
      AND (material_id IS NULL OR door_style_id IS NOT NULL OR finish_id IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'This slot has schedule rows that are not materials';
  END IF;

  IF NEW.slot_type = 'door' AND EXISTS (
    SELECT 1 FROM costing_schedule_items
    WHERE slot_id = NEW.id
      AND (door_style_id IS NULL OR material_id IS NOT NULL OR finish_id IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'This slot has schedule rows that are not door styles';
  END IF;

  IF NEW.slot_type = 'exterior_finish' AND EXISTS (
    SELECT 1
    FROM costing_schedule_items AS item
    LEFT JOIN costing_finishes AS finish ON finish.id = item.finish_id
    WHERE item.slot_id = NEW.id
      AND (
        item.finish_id IS NULL
        OR item.material_id IS NOT NULL
        OR item.door_style_id IS NOT NULL
        OR finish.finish_type IS NULL
        OR finish.finish_type NOT IN ('stain', 'paint', 'glaze')
      )
  ) THEN
    RAISE EXCEPTION 'This slot has schedule rows that are not stain, paint, or glaze';
  END IF;

  IF NEW.slot_type = 'interior_finish' AND EXISTS (
    SELECT 1
    FROM costing_schedule_items AS item
    LEFT JOIN costing_finishes AS finish ON finish.id = item.finish_id
    WHERE item.slot_id = NEW.id
      AND (
        item.finish_id IS NULL
        OR item.material_id IS NOT NULL
        OR item.door_style_id IS NOT NULL
        OR finish.finish_type IS NULL
        OR finish.finish_type <> 'clear_coat'
      )
  ) THEN
    RAISE EXCEPTION 'This slot has schedule rows that are not clear coat';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION costing_prepare_material() FROM PUBLIC;
REVOKE ALL ON FUNCTION costing_validate_schedule_item() FROM PUBLIC;
REVOKE ALL ON FUNCTION costing_guard_finish_type() FROM PUBLIC;
REVOKE ALL ON FUNCTION costing_guard_slot_type() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION costing_prepare_material() TO authenticated;
GRANT EXECUTE ON FUNCTION costing_validate_schedule_item() TO authenticated;
GRANT EXECUTE ON FUNCTION costing_guard_finish_type() TO authenticated;
GRANT EXECUTE ON FUNCTION costing_guard_slot_type() TO authenticated;

CREATE TABLE costing_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Unique true value so the table can hold only one row.
  one_row boolean NOT NULL DEFAULT true,
  shop_hourly_cost numeric NOT NULL DEFAULT 275.00,
  worker_count integer NOT NULL DEFAULT 5,
  default_margin_pct numeric NOT NULL DEFAULT 30,
  default_waste_sheet_pct numeric NOT NULL DEFAULT 15,
  default_waste_lumber_pct numeric NOT NULL DEFAULT 30,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT costing_settings_one_row UNIQUE (one_row),
  CONSTRAINT costing_settings_one_row_true CHECK (one_row),
  CONSTRAINT costing_settings_workers_positive CHECK (worker_count >= 1),
  CONSTRAINT costing_settings_shop_cost_nonnegative CHECK (shop_hourly_cost >= 0),
  CONSTRAINT costing_settings_margin_range CHECK (default_margin_pct >= 0 AND default_margin_pct < 100),
  CONSTRAINT costing_settings_sheet_waste_nonnegative CHECK (default_waste_sheet_pct >= 0),
  CONSTRAINT costing_settings_lumber_waste_nonnegative CHECK (default_waste_lumber_pct >= 0)
);

CREATE TABLE costing_variables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  name text NOT NULL,
  value numeric NOT NULL,
  unit text NOT NULL DEFAULT 'in',
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT costing_variables_code_unique UNIQUE (code),
  CONSTRAINT costing_variables_code_format CHECK (code ~ '^[A-Z][A-Z0-9_]*$'),
  CONSTRAINT costing_variables_name_present CHECK (length(trim(name)) > 0)
);

CREATE TABLE costing_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  material_type costing_material_type NOT NULL,
  unit_price numeric NOT NULL DEFAULT 0,
  sheet_length numeric,
  sheet_width numeric,
  thickness numeric,
  rough_thickness numeric,
  waste_pct numeric NOT NULL,
  supplier text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT costing_materials_name_present CHECK (length(trim(name)) > 0),
  CONSTRAINT costing_materials_price_nonnegative CHECK (unit_price >= 0),
  CONSTRAINT costing_materials_waste_nonnegative CHECK (waste_pct >= 0),
  CONSTRAINT costing_materials_thickness_positive CHECK (thickness IS NULL OR thickness > 0),
  CONSTRAINT costing_materials_sheet_size CHECK (
    material_type <> 'sheet'
    OR (sheet_length IS NOT NULL AND sheet_length > 0 AND sheet_width IS NOT NULL AND sheet_width > 0)
  ),
  CONSTRAINT costing_materials_lumber_rough CHECK (
    material_type <> 'lumber'
    OR (rough_thickness IS NOT NULL AND rough_thickness > 0)
  )
);

CREATE TRIGGER costing_materials_prepare
  BEFORE INSERT OR UPDATE ON costing_materials
  FOR EACH ROW EXECUTE FUNCTION costing_prepare_material();

CREATE TABLE costing_door_styles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  price_per_sqft numeric NOT NULL DEFAULT 0,
  supplier text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT costing_door_styles_name_present CHECK (length(trim(name)) > 0),
  CONSTRAINT costing_door_styles_price_nonnegative CHECK (price_per_sqft >= 0)
);

CREATE TABLE costing_finishes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  finish_type costing_finish_type NOT NULL,
  price_per_sqft numeric NOT NULL DEFAULT 0,
  notes text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT costing_finishes_name_present CHECK (length(trim(name)) > 0),
  CONSTRAINT costing_finishes_price_nonnegative CHECK (price_per_sqft >= 0)
);

CREATE TRIGGER costing_finishes_guard_type
  BEFORE UPDATE ON costing_finishes
  FOR EACH ROW EXECUTE FUNCTION costing_guard_finish_type();

CREATE TABLE costing_hardware (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL,
  unit_cost numeric NOT NULL DEFAULT 0,
  install_minutes numeric NOT NULL DEFAULT 0,
  markup_pct numeric NOT NULL DEFAULT 0,
  supplier text NOT NULL DEFAULT '',
  sku text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT costing_hardware_name_present CHECK (length(trim(name)) > 0),
  CONSTRAINT costing_hardware_category_present CHECK (length(trim(category)) > 0),
  CONSTRAINT costing_hardware_cost_nonnegative CHECK (unit_cost >= 0),
  CONSTRAINT costing_hardware_minutes_nonnegative CHECK (install_minutes >= 0),
  CONSTRAINT costing_hardware_markup_nonnegative CHECK (markup_pct >= 0)
);

CREATE TABLE costing_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slot_type costing_slot_type NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT costing_slots_name_present CHECK (length(trim(name)) > 0)
);

CREATE TRIGGER costing_slots_guard_type
  BEFORE UPDATE ON costing_slots
  FOR EACH ROW EXECUTE FUNCTION costing_guard_slot_type();

CREATE TABLE costing_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT costing_schedules_name_present CHECK (length(trim(name)) > 0)
);

CREATE TABLE costing_schedule_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES costing_schedules (id) ON DELETE CASCADE,
  slot_id uuid NOT NULL REFERENCES costing_slots (id) ON DELETE RESTRICT,
  material_id uuid REFERENCES costing_materials (id) ON DELETE RESTRICT,
  door_style_id uuid REFERENCES costing_door_styles (id) ON DELETE RESTRICT,
  finish_id uuid REFERENCES costing_finishes (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT costing_schedule_items_one_per_slot UNIQUE (schedule_id, slot_id)
);

CREATE TRIGGER costing_schedule_items_validate
  BEFORE INSERT OR UPDATE ON costing_schedule_items
  FOR EACH ROW EXECUTE FUNCTION costing_validate_schedule_item();

CREATE INDEX costing_schedule_items_schedule_id_idx ON costing_schedule_items (schedule_id);
CREATE INDEX costing_schedule_items_slot_id_idx ON costing_schedule_items (slot_id);

CREATE TABLE costing_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slot_id uuid NOT NULL REFERENCES costing_slots (id) ON DELETE RESTRICT,
  length_formula text NOT NULL,
  width_formula text NOT NULL,
  qty_formula text NOT NULL DEFAULT '1',
  labor_minutes numeric NOT NULL DEFAULT 0,
  exterior_finish_sides integer NOT NULL DEFAULT 0,
  interior_finish_sides integer NOT NULL DEFAULT 0,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT costing_components_name_present CHECK (length(trim(name)) > 0),
  CONSTRAINT costing_components_labor_nonnegative CHECK (labor_minutes >= 0),
  CONSTRAINT costing_components_exterior_sides CHECK (exterior_finish_sides BETWEEN 0 AND 2),
  CONSTRAINT costing_components_interior_sides CHECK (interior_finish_sides BETWEEN 0 AND 2)
);

CREATE INDEX costing_components_slot_id_idx ON costing_components (slot_id);

CREATE TABLE costing_cabinet_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT costing_cabinet_categories_name_present CHECK (length(trim(name)) > 0),
  CONSTRAINT costing_cabinet_categories_name_unique UNIQUE (name)
);

CREATE TABLE costing_cabinet_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category_id uuid NOT NULL REFERENCES costing_cabinet_categories (id) ON DELETE RESTRICT,
  default_height numeric NOT NULL,
  default_width numeric NOT NULL,
  default_depth numeric NOT NULL,
  default_doors integer NOT NULL DEFAULT 0,
  default_drawers integer NOT NULL DEFAULT 0,
  default_shelves integer NOT NULL DEFAULT 0,
  base_labor_minutes numeric NOT NULL DEFAULT 0,
  notes text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT costing_cabinet_templates_name_present CHECK (length(trim(name)) > 0),
  CONSTRAINT costing_cabinet_templates_dimensions_positive CHECK (
    default_height > 0 AND default_width > 0 AND default_depth > 0
  ),
  CONSTRAINT costing_cabinet_templates_counts_nonnegative CHECK (
    default_doors >= 0 AND default_drawers >= 0 AND default_shelves >= 0
  ),
  CONSTRAINT costing_cabinet_templates_labor_nonnegative CHECK (base_labor_minutes >= 0)
);

CREATE INDEX costing_cabinet_templates_category_id_idx ON costing_cabinet_templates (category_id);

CREATE TABLE costing_template_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES costing_cabinet_templates (id) ON DELETE CASCADE,
  component_id uuid NOT NULL REFERENCES costing_components (id) ON DELETE RESTRICT,
  sort_order integer NOT NULL DEFAULT 0,
  length_formula text,
  width_formula text,
  qty_formula text,
  labor_minutes numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT costing_template_components_labor_nonnegative CHECK (
    labor_minutes IS NULL OR labor_minutes >= 0
  )
);

CREATE INDEX costing_template_components_template_id_idx ON costing_template_components (template_id);
CREATE INDEX costing_template_components_component_id_idx ON costing_template_components (component_id);

CREATE TABLE costing_template_hardware (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES costing_cabinet_templates (id) ON DELETE CASCADE,
  hardware_id uuid NOT NULL REFERENCES costing_hardware (id) ON DELETE RESTRICT,
  qty_formula text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT costing_template_hardware_formula_present CHECK (length(trim(qty_formula)) > 0)
);

CREATE INDEX costing_template_hardware_template_id_idx ON costing_template_hardware (template_id);
CREATE INDEX costing_template_hardware_hardware_id_idx ON costing_template_hardware (hardware_id);

CREATE TABLE costing_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_id uuid REFERENCES contacts (id) ON DELETE SET NULL,
  margin_pct numeric NOT NULL DEFAULT 30,
  status costing_quote_status NOT NULL DEFAULT 'draft',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT costing_quotes_name_present CHECK (length(trim(name)) > 0),
  CONSTRAINT costing_quotes_margin_range CHECK (margin_pct >= 0 AND margin_pct < 100)
);

CREATE INDEX costing_quotes_contact_id_idx ON costing_quotes (contact_id);

CREATE TABLE costing_quote_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES costing_quotes (id) ON DELETE CASCADE,
  name text NOT NULL,
  schedule_id uuid REFERENCES costing_schedules (id) ON DELETE RESTRICT,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT costing_quote_rooms_name_present CHECK (length(trim(name)) > 0)
);

CREATE INDEX costing_quote_rooms_quote_id_idx ON costing_quote_rooms (quote_id);
CREATE INDEX costing_quote_rooms_schedule_id_idx ON costing_quote_rooms (schedule_id);

CREATE TABLE costing_quote_cabinets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES costing_quote_rooms (id) ON DELETE CASCADE,
  template_id uuid REFERENCES costing_cabinet_templates (id) ON DELETE SET NULL,
  label text NOT NULL,
  height numeric NOT NULL,
  width numeric NOT NULL,
  depth numeric NOT NULL,
  doors integer NOT NULL DEFAULT 0,
  drawers integer NOT NULL DEFAULT 0,
  shelves integer NOT NULL DEFAULT 0,
  quantity integer NOT NULL DEFAULT 1,
  schedule_override_id uuid REFERENCES costing_schedules (id) ON DELETE RESTRICT,
  base_labor_minutes numeric NOT NULL DEFAULT 0,
  material_cost numeric NOT NULL DEFAULT 0,
  labor_cost numeric NOT NULL DEFAULT 0,
  door_cost numeric NOT NULL DEFAULT 0,
  finish_cost numeric NOT NULL DEFAULT 0,
  hardware_cost numeric NOT NULL DEFAULT 0,
  hardware_markup numeric NOT NULL DEFAULT 0,
  total_cost numeric NOT NULL DEFAULT 0,
  labor_rate_used numeric,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT costing_quote_cabinets_label_present CHECK (length(trim(label)) > 0),
  CONSTRAINT costing_quote_cabinets_dimensions_positive CHECK (height > 0 AND width > 0 AND depth > 0),
  CONSTRAINT costing_quote_cabinets_counts_nonnegative CHECK (doors >= 0 AND drawers >= 0 AND shelves >= 0),
  CONSTRAINT costing_quote_cabinets_quantity_positive CHECK (quantity >= 1),
  CONSTRAINT costing_quote_cabinets_labor_nonnegative CHECK (base_labor_minutes >= 0),
  CONSTRAINT costing_quote_cabinets_costs_nonnegative CHECK (
    material_cost >= 0
    AND labor_cost >= 0
    AND door_cost >= 0
    AND finish_cost >= 0
    AND hardware_cost >= 0
    AND hardware_markup >= 0
    AND total_cost >= 0
    AND (labor_rate_used IS NULL OR labor_rate_used >= 0)
  )
);

CREATE INDEX costing_quote_cabinets_room_id_idx ON costing_quote_cabinets (room_id);
CREATE INDEX costing_quote_cabinets_template_id_idx ON costing_quote_cabinets (template_id);

-- Frozen part copy. Later library edits do not change these rows.
CREATE TABLE costing_quote_cabinet_parts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_id uuid NOT NULL REFERENCES costing_quote_cabinets (id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  name text NOT NULL,
  slot_name text NOT NULL,
  slot_type costing_slot_type NOT NULL,
  length_formula text NOT NULL,
  width_formula text NOT NULL,
  qty_formula text NOT NULL DEFAULT '1',
  resolved_length numeric,
  resolved_width numeric,
  resolved_qty numeric,
  material_name text,
  material_type costing_material_type,
  material_unit_price numeric,
  material_waste_pct numeric,
  sheet_length numeric,
  sheet_width numeric,
  thickness numeric,
  rough_thickness numeric,
  door_style_name text,
  door_price_per_sqft numeric,
  exterior_finish_name text,
  exterior_finish_price_per_sqft numeric,
  interior_finish_name text,
  interior_finish_price_per_sqft numeric,
  exterior_finish_sides integer NOT NULL DEFAULT 0,
  interior_finish_sides integer NOT NULL DEFAULT 0,
  quantity_used numeric,
  quantity_unit text,
  material_cost numeric NOT NULL DEFAULT 0,
  door_cost numeric NOT NULL DEFAULT 0,
  finish_cost numeric NOT NULL DEFAULT 0,
  labor_minutes numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT costing_quote_cabinet_parts_name_present CHECK (length(trim(name)) > 0),
  CONSTRAINT costing_quote_cabinet_parts_sides CHECK (
    exterior_finish_sides BETWEEN 0 AND 2
    AND interior_finish_sides BETWEEN 0 AND 2
  ),
  CONSTRAINT costing_quote_cabinet_parts_costs_nonnegative CHECK (
    material_cost >= 0
    AND door_cost >= 0
    AND finish_cost >= 0
    AND labor_minutes >= 0
  )
);

CREATE INDEX costing_quote_cabinet_parts_cabinet_id_idx ON costing_quote_cabinet_parts (cabinet_id);

-- Frozen hardware copy.
CREATE TABLE costing_quote_cabinet_hardware (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_id uuid NOT NULL REFERENCES costing_quote_cabinets (id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  name text NOT NULL,
  qty_formula text NOT NULL,
  resolved_qty numeric,
  unit_cost numeric NOT NULL DEFAULT 0,
  markup_pct numeric NOT NULL DEFAULT 0,
  install_minutes numeric NOT NULL DEFAULT 0,
  line_cost numeric NOT NULL DEFAULT 0,
  line_markup numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT costing_quote_cabinet_hardware_name_present CHECK (length(trim(name)) > 0),
  CONSTRAINT costing_quote_cabinet_hardware_amounts_nonnegative CHECK (
    unit_cost >= 0
    AND markup_pct >= 0
    AND install_minutes >= 0
    AND line_cost >= 0
    AND line_markup >= 0
  )
);

CREATE INDEX costing_quote_cabinet_hardware_cabinet_id_idx
  ON costing_quote_cabinet_hardware (cabinet_id);

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'costing_settings',
    'costing_variables',
    'costing_materials',
    'costing_door_styles',
    'costing_finishes',
    'costing_hardware',
    'costing_slots',
    'costing_schedules',
    'costing_schedule_items',
    'costing_components',
    'costing_cabinet_categories',
    'costing_cabinet_templates',
    'costing_template_components',
    'costing_template_hardware',
    'costing_quotes',
    'costing_quote_rooms',
    'costing_quote_cabinets',
    'costing_quote_cabinet_parts',
    'costing_quote_cabinet_hardware'
  ]
  LOOP
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at()',
      table_name || '_updated_at',
      table_name
    );
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format(
      'CREATE POLICY costing_admin_all ON %I FOR ALL TO authenticated USING (costing_is_admin()) WITH CHECK (costing_is_admin())',
      table_name
    );
    EXECUTE format('REVOKE ALL ON TABLE %I FROM PUBLIC, anon', table_name);
    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO authenticated, service_role',
      table_name
    );
  END LOOP;
END $$;

INSERT INTO costing_settings (
  shop_hourly_cost,
  worker_count,
  default_margin_pct,
  default_waste_sheet_pct,
  default_waste_lumber_pct
) VALUES (
  275.00,
  5,
  30,
  15,
  30
);

INSERT INTO costing_variables (code, name, value, unit, description) VALUES
  ('TOEKICK', 'Toe kick', 4.5, 'in', 'Height removed from the bottom of a base cabinet'),
  ('STILE', 'Stile', 1.5, 'in', 'Face-frame stile width'),
  ('RAIL', 'Rail', 1.5, 'in', 'Face-frame rail width'),
  ('TOPRAIL', 'Top rail', 1.5, 'in', 'Face-frame top rail width'),
  ('NAILER', 'Nailer', 1.5, 'in', 'Nailer height'),
  ('SCRIBE', 'Scribe', 0, 'in', 'Scribe allowance'),
  ('DRAWERBOX_CLEAR', 'Drawer box clearance', 1, 'in', 'Clearance around a drawer box');

INSERT INTO costing_slots (name, slot_type, sort_order) VALUES
  ('Case Sides', 'material', 1),
  ('Case Bottom', 'material', 2),
  ('Case Top/Stretchers', 'material', 3),
  ('Case Back', 'material', 4),
  ('Nailers', 'material', 5),
  ('Shelves', 'material', 6),
  ('Face Frame', 'material', 7),
  ('Drawer Box Sides', 'material', 8),
  ('Drawer Box Bottoms', 'material', 9),
  ('Doors & Drawer Fronts', 'door', 10),
  ('Exterior Finish', 'exterior_finish', 11),
  ('Interior Finish', 'interior_finish', 12);

INSERT INTO costing_cabinet_categories (name, sort_order) VALUES
  ('Base', 1),
  ('Wall', 2),
  ('Tall', 3),
  ('Vanity', 4),
  ('Specialty', 5);
