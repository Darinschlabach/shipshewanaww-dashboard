-- Extend purchase orders for the Purchasing module UI

ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS po_number TEXT;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS received_percent INTEGER DEFAULT 0;
