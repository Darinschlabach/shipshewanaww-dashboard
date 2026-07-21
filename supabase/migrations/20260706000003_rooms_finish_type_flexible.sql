-- Only drop the old constraint if the rooms table already exists.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'rooms'
  ) THEN
    ALTER TABLE public.rooms DROP CONSTRAINT IF EXISTS rooms_finish_type_check;
  END IF;
END $$;

INSERT INTO pricing_finish_types (name, multiplier, sort_order)
SELECT 'Painted', 1.05, 5
WHERE NOT EXISTS (
  SELECT 1 FROM pricing_finish_types WHERE name ILIKE 'Painted'
);

INSERT INTO pricing_finish_types (name, multiplier, sort_order)
SELECT 'Stained', 1.10, 6
WHERE NOT EXISTS (
  SELECT 1 FROM pricing_finish_types WHERE name ILIKE 'Stained'
);
