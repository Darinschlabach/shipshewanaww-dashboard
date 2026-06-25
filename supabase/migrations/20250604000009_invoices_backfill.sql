-- Backfill invoices from jobs and sample payments

INSERT INTO invoices (
  invoice_number,
  job_id,
  customer_id,
  customer_name,
  invoice_date,
  due_date,
  amount,
  balance,
  status
)
SELECT
  'INV-' || LPAD((24000 + ROW_NUMBER() OVER (ORDER BY j.created_at))::TEXT, 5, '0'),
  j.id,
  j.customer_id,
  COALESCE(c.name, 'Unknown Customer'),
  COALESCE(j.quote_approved_at, (j.created_at AT TIME ZONE 'UTC')::DATE),
  j.due_date,
  j.total_value,
  GREATEST(j.total_value - j.billing_collected, 0),
  CASE
    WHEN j.total_value - j.billing_collected <= 0 THEN 'paid'::invoice_status
    WHEN j.due_date IS NOT NULL AND j.due_date < CURRENT_DATE THEN 'overdue'::invoice_status
    ELSE 'open'::invoice_status
  END
FROM jobs j
LEFT JOIN contacts c ON c.id = j.customer_id
WHERE j.stage <> 'quote' AND j.total_value > 0
  AND NOT EXISTS (SELECT 1 FROM invoices LIMIT 1);

INSERT INTO invoice_payments (invoice_id, amount, paid_at, method)
SELECT
  i.id,
  i.amount - i.balance,
  i.updated_at,
  'Check'
FROM invoices i
WHERE i.balance < i.amount AND i.amount - i.balance > 0
  AND NOT EXISTS (SELECT 1 FROM invoice_payments LIMIT 1);
