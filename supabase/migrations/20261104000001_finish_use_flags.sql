-- Let a finish be used on the exterior, the interior, or both.
-- finish_type stays in the table so old rows are not rewritten, and the app no longer reads it.

BEGIN;

ALTER TABLE costing_finishes
  ADD COLUMN use_exterior boolean NOT NULL DEFAULT false,
  ADD COLUMN use_interior boolean NOT NULL DEFAULT false;

UPDATE costing_finishes
SET use_exterior = true,
    use_interior = false
WHERE finish_type IN ('stain', 'paint', 'glaze');

UPDATE costing_finishes
SET use_exterior = false,
    use_interior = true
WHERE finish_type = 'clear_coat';

ALTER TABLE costing_finishes
  ALTER COLUMN finish_type DROP NOT NULL;

ALTER TABLE costing_finishes
  ADD CONSTRAINT costing_finishes_used_on_a_side
  CHECK (use_exterior OR use_interior);

CREATE OR REPLACE FUNCTION costing_validate_schedule_item()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  chosen_slot costing_slot_type;
  allow_exterior boolean;
  allow_interior boolean;
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

    SELECT use_exterior, use_interior INTO allow_exterior, allow_interior
    FROM costing_finishes
    WHERE id = NEW.finish_id;

    IF allow_exterior IS NULL THEN
      RAISE EXCEPTION 'Unknown costing finish';
    END IF;

    IF chosen_slot = 'exterior_finish' AND NOT allow_exterior THEN
      RAISE EXCEPTION 'Exterior finish must be marked for exterior use';
    END IF;

    IF chosen_slot = 'interior_finish' AND NOT allow_interior THEN
      RAISE EXCEPTION 'Interior finish must be marked for interior use';
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
  IF NEW.use_exterior IS NOT DISTINCT FROM OLD.use_exterior
     AND NEW.use_interior IS NOT DISTINCT FROM OLD.use_interior THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM costing_schedule_items AS item
    JOIN costing_slots AS slot ON slot.id = item.slot_id
    WHERE item.finish_id = NEW.id
      AND slot.slot_type = 'exterior_finish'
      AND NOT NEW.use_exterior
  ) OR EXISTS (
    SELECT 1
    FROM costing_schedule_items AS item
    JOIN costing_slots AS slot ON slot.id = item.slot_id
    WHERE item.finish_id = NEW.id
      AND slot.slot_type = 'interior_finish'
      AND NOT NEW.use_interior
  ) THEN
    RAISE EXCEPTION 'This finish is assigned to a schedule slot that does not allow that use';
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
        OR finish.use_exterior IS NOT TRUE
      )
  ) THEN
    RAISE EXCEPTION 'This slot has schedule rows that are not exterior finishes';
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
        OR finish.use_interior IS NOT TRUE
      )
  ) THEN
    RAISE EXCEPTION 'This slot has schedule rows that are not interior finishes';
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.costing_schedule_component_overrides') IS NULL THEN
    RETURN;
  END IF;

  EXECUTE $fn$
    CREATE OR REPLACE FUNCTION costing_validate_schedule_component_override()
    RETURNS trigger
    LANGUAGE plpgsql
    SET search_path = public
    AS $body$
    DECLARE
      chosen_slot costing_slot_type;
      chosen_exterior boolean;
      chosen_interior boolean;
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
      ELSIF chosen_slot::text = 'drawer_box' THEN
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

        SELECT use_exterior, use_interior INTO chosen_exterior, chosen_interior
        FROM costing_finishes
        WHERE id = NEW.finish_id;

        IF chosen_exterior IS NULL AND chosen_interior IS NULL THEN
          RAISE EXCEPTION 'Unknown costing finish';
        END IF;

        IF chosen_slot = 'exterior_finish' AND chosen_exterior IS NOT TRUE THEN
          RAISE EXCEPTION 'Exterior finish must be marked for exterior use';
        END IF;

        IF chosen_slot = 'interior_finish' AND chosen_interior IS NOT TRUE THEN
          RAISE EXCEPTION 'Interior finish must be marked for interior use';
        END IF;
      END IF;

      RETURN NEW;
    END;
    $body$
  $fn$;
END $$;

COMMIT;
