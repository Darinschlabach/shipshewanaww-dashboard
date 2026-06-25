-- Quote room line items: qty, dimensions, catalogue pricing for calculated totals

ALTER TABLE quote_room_items ADD COLUMN IF NOT EXISTS qty INT;
ALTER TABLE quote_room_items ADD COLUMN IF NOT EXISTS width_in NUMERIC(8, 2);
ALTER TABLE quote_room_items ADD COLUMN IF NOT EXISTS length_in NUMERIC(8, 2);
ALTER TABLE quote_room_items ADD COLUMN IF NOT EXISTS height_in NUMERIC(8, 2);
ALTER TABLE quote_room_items ADD COLUMN IF NOT EXISTS catalogue_id UUID;
ALTER TABLE quote_room_items ADD COLUMN IF NOT EXISTS catalogue_source TEXT;
ALTER TABLE quote_room_items ADD COLUMN IF NOT EXISTS base_price NUMERIC(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE quote_room_items ADD COLUMN IF NOT EXISTS sq_ft_price NUMERIC(12, 2) NOT NULL DEFAULT 0;

-- Existing rows: treat stored price as base when catalogue fields were not set
UPDATE quote_room_items
SET base_price = price
WHERE base_price = 0 AND price > 0;
