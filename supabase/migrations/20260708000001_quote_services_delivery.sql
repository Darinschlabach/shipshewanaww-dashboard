-- Permanent delivery line for quote services (always first row, not removable)

ALTER TABLE quote_services
  ADD COLUMN IF NOT EXISTS is_delivery BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS quote_services_one_delivery_per_lead_idx
  ON quote_services (lead_id)
  WHERE is_delivery = true;

-- Mark an existing "Delivery" row per quote when present
UPDATE quote_services qs
SET is_delivery = true,
    name = 'Delivery'
FROM (
  SELECT DISTINCT ON (lead_id) id
  FROM quote_services
  WHERE LOWER(TRIM(name)) = 'delivery'
  ORDER BY lead_id, sort_order ASC, created_at ASC
) existing
WHERE qs.id = existing.id;

-- Add delivery row for quotes that do not have one yet
INSERT INTO quote_services (lead_id, name, description, price, sort_order, is_delivery)
SELECT l.id, 'Delivery', '', 0, -1, true
FROM leads l
WHERE NOT EXISTS (
  SELECT 1 FROM quote_services qs
  WHERE qs.lead_id = l.id AND qs.is_delivery = true
);

-- Shift non-delivery services down so delivery can sit at sort_order 0
UPDATE quote_services qs
SET sort_order = qs.sort_order + 1
WHERE qs.is_delivery = false
  AND EXISTS (
    SELECT 1 FROM quote_services d
    WHERE d.lead_id = qs.lead_id AND d.is_delivery = true AND d.sort_order < 0
  );

UPDATE quote_services
SET sort_order = 0
WHERE is_delivery = true AND sort_order < 0;
