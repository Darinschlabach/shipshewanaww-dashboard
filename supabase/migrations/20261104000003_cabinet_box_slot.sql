BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM costing_slots WHERE name = 'Cabinet Box') THEN
    RAISE EXCEPTION 'A slot named Cabinet Box already exists';
  END IF;

  IF (
    SELECT COUNT(*)
    FROM costing_slots
    WHERE name IN (
      'Case Bottom',
      'Case Sides',
      'Case Top/Stretchers',
      'Case Back',
      'Nailers'
    )
  ) <> 5 THEN
    RAISE EXCEPTION 'Expected all five case slots to still exist';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM costing_schedules AS schedule
    WHERE NOT EXISTS (
      SELECT 1
      FROM costing_schedule_items AS item
      JOIN costing_slots AS slot ON slot.id = item.slot_id
      WHERE item.schedule_id = schedule.id
        AND slot.name = 'Case Sides'
        AND item.material_id IS NOT NULL
    )
    AND NOT EXISTS (
      SELECT 1
      FROM costing_schedule_items AS item
      JOIN costing_slots AS slot ON slot.id = item.slot_id
      WHERE item.schedule_id = schedule.id
        AND slot.name = 'Case Bottom'
        AND item.material_id IS NOT NULL
    )
  ) THEN
    RAISE EXCEPTION 'A schedule has no material in Case Sides or Case Bottom';
  END IF;
END $$;

INSERT INTO costing_slots (name, slot_type, sort_order)
VALUES ('Cabinet Box', 'material', 1);

UPDATE costing_components AS component
SET slot_id = box.id
FROM costing_slots AS box
WHERE box.name = 'Cabinet Box'
  AND component.slot_id IN (
    SELECT id
    FROM costing_slots
    WHERE name IN (
      'Case Bottom',
      'Case Sides',
      'Case Top/Stretchers',
      'Case Back',
      'Nailers'
    )
  );

INSERT INTO costing_schedule_items (schedule_id, slot_id, material_id)
SELECT
  schedule.id,
  box.id,
  COALESCE(sides.material_id, bottom.material_id)
FROM costing_schedules AS schedule
JOIN costing_slots AS box ON box.name = 'Cabinet Box'
LEFT JOIN costing_slots AS sides_slot ON sides_slot.name = 'Case Sides'
LEFT JOIN costing_schedule_items AS sides
  ON sides.schedule_id = schedule.id
 AND sides.slot_id = sides_slot.id
LEFT JOIN costing_slots AS bottom_slot ON bottom_slot.name = 'Case Bottom'
LEFT JOIN costing_schedule_items AS bottom
  ON bottom.schedule_id = schedule.id
 AND bottom.slot_id = bottom_slot.id;

DELETE FROM costing_schedule_items
WHERE slot_id IN (
  SELECT id
  FROM costing_slots
  WHERE name IN (
    'Case Bottom',
    'Case Sides',
    'Case Top/Stretchers',
    'Case Back',
    'Nailers'
  )
);

DELETE FROM costing_slots
WHERE name IN (
  'Case Bottom',
  'Case Sides',
  'Case Top/Stretchers',
  'Case Back',
  'Nailers'
);

COMMIT;
