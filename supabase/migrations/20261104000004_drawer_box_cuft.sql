ALTER TYPE costing_slot_type ADD VALUE IF NOT EXISTS 'drawer_box';
COMMIT;

BEGIN;

CREATE TABLE costing_drawer_box_styles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  price_per_cuft numeric NOT NULL DEFAULT 0,
  supplier text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT costing_drawer_box_styles_name_present CHECK (length(trim(name)) > 0),
  CONSTRAINT costing_drawer_box_styles_price_nonnegative CHECK (price_per_cuft >= 0)
);

CREATE TRIGGER costing_drawer_box_styles_updated_at
  BEFORE UPDATE ON costing_drawer_box_styles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

REVOKE ALL ON TABLE costing_drawer_box_styles FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE costing_drawer_box_styles TO authenticated, service_role;

ALTER TABLE costing_drawer_box_styles ENABLE ROW LEVEL SECURITY;

CREATE POLICY costing_admin_all
  ON costing_drawer_box_styles
  FOR ALL
  TO authenticated
  USING (costing_is_admin())
  WITH CHECK (costing_is_admin());

INSERT INTO costing_drawer_box_styles (name, price_per_cuft, supplier, notes)
VALUES (
  'SAMPLE – Dovetail Maple',
  25.00,
  'Sample supplier',
  'Sample drawer box priced by cubic foot.'
);

INSERT INTO costing_variables (code, name, value, unit, description)
SELECT 'DRAWERBOX_H', 'Drawer box height', 4, 'in', 'Standard drawer box height'
WHERE NOT EXISTS (SELECT 1 FROM costing_variables WHERE code = 'DRAWERBOX_H');

ALTER TABLE costing_components
  ADD COLUMN height_formula text;

ALTER TABLE costing_schedule_items
  ADD COLUMN drawer_box_style_id uuid REFERENCES costing_drawer_box_styles (id) ON DELETE RESTRICT;

INSERT INTO costing_slots (name, slot_type, sort_order)
VALUES ('Drawer Box', 'drawer_box', 8);

INSERT INTO costing_components (
  name,
  slot_id,
  length_formula,
  width_formula,
  height_formula,
  qty_formula,
  labor_minutes,
  exterior_finish_sides,
  interior_finish_sides,
  notes
)
SELECT
  'SAMPLE – Drawer Box',
  slot.id,
  'D - 1',
  'W - (2 * STILE) - DRAWERBOX_CLEAR',
  'DRAWERBOX_H',
  'DRAWERS',
  10,
  0,
  0,
  'Sample drawer box priced by cubic foot.'
FROM costing_slots AS slot
WHERE slot.name = 'Drawer Box';

INSERT INTO costing_template_components (template_id, component_id, sort_order)
SELECT link.template_id, box.id, MIN(link.sort_order)
FROM costing_template_components AS link
JOIN costing_components AS old_component ON old_component.id = link.component_id
JOIN costing_slots AS old_slot ON old_slot.id = old_component.slot_id
JOIN costing_components AS box ON box.name = 'SAMPLE – Drawer Box'
WHERE old_slot.name IN ('Drawer Box Sides', 'Drawer Box Bottoms')
GROUP BY link.template_id, box.id;

DELETE FROM costing_template_components
WHERE component_id IN (
  SELECT component.id
  FROM costing_components AS component
  JOIN costing_slots AS slot ON slot.id = component.slot_id
  WHERE slot.name IN ('Drawer Box Sides', 'Drawer Box Bottoms')
);

DELETE FROM costing_components
WHERE slot_id IN (
  SELECT id FROM costing_slots WHERE name IN ('Drawer Box Sides', 'Drawer Box Bottoms')
);

INSERT INTO costing_schedule_items (schedule_id, slot_id, drawer_box_style_id)
SELECT DISTINCT item.schedule_id, box_slot.id, style.id
FROM costing_schedule_items AS item
JOIN costing_slots AS old_slot ON old_slot.id = item.slot_id
JOIN costing_slots AS box_slot ON box_slot.name = 'Drawer Box'
JOIN costing_drawer_box_styles AS style ON style.name = 'SAMPLE – Dovetail Maple'
WHERE old_slot.name IN ('Drawer Box Sides', 'Drawer Box Bottoms');

DELETE FROM costing_schedule_items
WHERE slot_id IN (
  SELECT id FROM costing_slots WHERE name IN ('Drawer Box Sides', 'Drawer Box Bottoms')
);

DELETE FROM costing_slots
WHERE name IN ('Drawer Box Sides', 'Drawer Box Bottoms');

ALTER TABLE costing_quote_cabinet_parts
  ADD COLUMN height_formula text NOT NULL DEFAULT '',
  ADD COLUMN resolved_height numeric,
  ADD COLUMN drawer_box_name text,
  ADD COLUMN drawer_box_price_per_cuft numeric,
  ADD COLUMN drawer_box_cost numeric NOT NULL DEFAULT 0;

ALTER TABLE costing_quote_cabinet_parts
  ADD CONSTRAINT costing_quote_cabinet_parts_drawer_box_cost_nonnegative
  CHECK (drawer_box_cost >= 0);

ALTER TABLE costing_quote_cabinets
  ADD COLUMN drawer_box_cost numeric NOT NULL DEFAULT 0;

ALTER TABLE costing_quote_cabinets
  ADD CONSTRAINT costing_quote_cabinets_drawer_box_cost_nonnegative
  CHECK (drawer_box_cost >= 0);

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
    IF NEW.material_id IS NULL
       OR NEW.door_style_id IS NOT NULL
       OR NEW.finish_id IS NOT NULL
       OR NEW.drawer_box_style_id IS NOT NULL THEN
      RAISE EXCEPTION 'A material slot can only reference a material';
    END IF;
  ELSIF chosen_slot = 'door' THEN
    IF NEW.door_style_id IS NULL
       OR NEW.material_id IS NOT NULL
       OR NEW.finish_id IS NOT NULL
       OR NEW.drawer_box_style_id IS NOT NULL THEN
      RAISE EXCEPTION 'A door slot can only reference a door style';
    END IF;
  ELSIF chosen_slot::text = 'drawer_box' THEN
    IF NEW.drawer_box_style_id IS NULL
       OR NEW.material_id IS NOT NULL
       OR NEW.door_style_id IS NOT NULL
       OR NEW.finish_id IS NOT NULL THEN
      RAISE EXCEPTION 'A drawer box slot can only reference a drawer box style';
    END IF;
  ELSIF chosen_slot IN ('exterior_finish', 'interior_finish') THEN
    IF NEW.finish_id IS NULL
       OR NEW.material_id IS NOT NULL
       OR NEW.door_style_id IS NOT NULL
       OR NEW.drawer_box_style_id IS NOT NULL THEN
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
      AND (
        material_id IS NULL
        OR door_style_id IS NOT NULL
        OR finish_id IS NOT NULL
        OR drawer_box_style_id IS NOT NULL
      )
  ) THEN
    RAISE EXCEPTION 'This slot has schedule rows that are not materials';
  END IF;

  IF NEW.slot_type = 'door' AND EXISTS (
    SELECT 1 FROM costing_schedule_items
    WHERE slot_id = NEW.id
      AND (
        door_style_id IS NULL
        OR material_id IS NOT NULL
        OR finish_id IS NOT NULL
        OR drawer_box_style_id IS NOT NULL
      )
  ) THEN
    RAISE EXCEPTION 'This slot has schedule rows that are not door styles';
  END IF;

  IF NEW.slot_type::text = 'drawer_box' AND EXISTS (
    SELECT 1 FROM costing_schedule_items
    WHERE slot_id = NEW.id
      AND (
        drawer_box_style_id IS NULL
        OR material_id IS NOT NULL
        OR door_style_id IS NOT NULL
        OR finish_id IS NOT NULL
      )
  ) THEN
    RAISE EXCEPTION 'This slot has schedule rows that are not drawer box styles';
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
        OR item.drawer_box_style_id IS NOT NULL
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
        OR item.drawer_box_style_id IS NOT NULL
        OR finish.finish_type IS NULL
        OR finish.finish_type <> 'clear_coat'
      )
  ) THEN
    RAISE EXCEPTION 'This slot has schedule rows that are not clear coat';
  END IF;

  RETURN NEW;
END;
$$;

COMMIT;
