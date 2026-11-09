BEGIN;

CREATE TABLE costing_schedule_component_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES costing_schedules (id) ON DELETE CASCADE,
  component_id uuid NOT NULL REFERENCES costing_components (id) ON DELETE CASCADE,
  material_id uuid REFERENCES costing_materials (id) ON DELETE RESTRICT,
  door_style_id uuid REFERENCES costing_door_styles (id) ON DELETE RESTRICT,
  finish_id uuid REFERENCES costing_finishes (id) ON DELETE RESTRICT,
  drawer_box_style_id uuid REFERENCES costing_drawer_box_styles (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT costing_schedule_component_overrides_unique UNIQUE (schedule_id, component_id)
);

CREATE TRIGGER costing_schedule_component_overrides_updated_at
  BEFORE UPDATE ON costing_schedule_component_overrides
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX costing_schedule_component_overrides_component_id_idx
  ON costing_schedule_component_overrides (component_id);

CREATE OR REPLACE FUNCTION costing_validate_schedule_component_override()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  chosen_slot costing_slot_type;
  chosen_finish costing_finish_type;
BEGIN
  SELECT slot.slot_type INTO chosen_slot
  FROM costing_components AS component
  JOIN costing_slots AS slot ON slot.id = component.slot_id
  WHERE component.id = NEW.component_id;

  IF chosen_slot IS NULL THEN
    RAISE EXCEPTION 'Unknown costing component';
  END IF;

  IF chosen_slot = 'material' THEN
    IF NEW.material_id IS NULL
       OR NEW.door_style_id IS NOT NULL
       OR NEW.finish_id IS NOT NULL
       OR NEW.drawer_box_style_id IS NOT NULL THEN
      RAISE EXCEPTION 'A material component override can only reference a material';
    END IF;
  ELSIF chosen_slot = 'door' THEN
    IF NEW.door_style_id IS NULL
       OR NEW.material_id IS NOT NULL
       OR NEW.finish_id IS NOT NULL
       OR NEW.drawer_box_style_id IS NOT NULL THEN
      RAISE EXCEPTION 'A door component override can only reference a door style';
    END IF;
  ELSIF chosen_slot = 'drawer_box' THEN
    IF NEW.drawer_box_style_id IS NULL
       OR NEW.material_id IS NOT NULL
       OR NEW.door_style_id IS NOT NULL
       OR NEW.finish_id IS NOT NULL THEN
      RAISE EXCEPTION 'A drawer box component override can only reference a drawer box style';
    END IF;
  ELSIF chosen_slot IN ('exterior_finish', 'interior_finish') THEN
    IF NEW.finish_id IS NULL
       OR NEW.material_id IS NOT NULL
       OR NEW.door_style_id IS NOT NULL
       OR NEW.drawer_box_style_id IS NOT NULL THEN
      RAISE EXCEPTION 'A finish component override can only reference a finish';
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

CREATE TRIGGER costing_schedule_component_overrides_validate
  BEFORE INSERT OR UPDATE ON costing_schedule_component_overrides
  FOR EACH ROW EXECUTE FUNCTION costing_validate_schedule_component_override();

REVOKE ALL ON TABLE costing_schedule_component_overrides FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE costing_schedule_component_overrides TO authenticated, service_role;

ALTER TABLE costing_schedule_component_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY costing_admin_all
  ON costing_schedule_component_overrides
  FOR ALL
  TO authenticated
  USING (costing_is_admin())
  WITH CHECK (costing_is_admin());

COMMIT;
