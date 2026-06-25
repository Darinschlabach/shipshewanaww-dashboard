-- Backfill PO numbers and received percentages

UPDATE purchase_orders
SET po_number = sub.pn
FROM (
  SELECT
    id,
    'PO-' || to_char(created_at, 'YY') ||
    lpad(row_number() OVER (ORDER BY created_at)::text, 3, '0') AS pn
  FROM purchase_orders
  WHERE po_number IS NULL
) AS sub
WHERE purchase_orders.id = sub.id;

UPDATE purchase_orders SET received_percent = 100
WHERE status IN ('delivered', 'archived') AND (received_percent IS NULL OR received_percent = 0);

UPDATE purchase_orders SET received_percent = 0
WHERE status = 'not_ordered' AND (received_percent IS NULL);

UPDATE purchase_orders SET received_percent = 50
WHERE status = 'ordered'
  AND received_percent = 0
  AND mod(abs(hashtext(id::text)), 3) = 0;

UPDATE purchase_orders SET received_percent = 75
WHERE status = 'ordered'
  AND received_percent = 0
  AND mod(abs(hashtext(id::text)), 3) = 1;
