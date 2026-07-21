-- Fields used by the job Purchasing tab UI

ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS po_number TEXT;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS received_percent INTEGER DEFAULT 0;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS po_type TEXT;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS received_amount NUMERIC(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS ui_status TEXT;

UPDATE purchase_orders
SET title = item_name
WHERE title IS NULL;
