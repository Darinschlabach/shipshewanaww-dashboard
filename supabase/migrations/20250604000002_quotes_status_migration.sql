-- Migrate legacy lead statuses and backfill quote metadata

UPDATE leads SET status = 'draft' WHERE status = 'new_inquiry';
UPDATE leads SET status = 'sent' WHERE status = 'quote_sent';

UPDATE leads
SET sent_at = (updated_at AT TIME ZONE 'UTC')::date
WHERE status = 'sent' AND sent_at IS NULL;

UPDATE leads
SET quote_number = sub.qn
FROM (
  SELECT
    id,
    'Q-' || to_char(created_at, 'YY') ||
    lpad(row_number() OVER (ORDER BY created_at)::text, 3, '0') AS qn
  FROM leads
  WHERE quote_number IS NULL
) AS sub
WHERE leads.id = sub.id;

UPDATE leads SET source = 'Direct Customer' WHERE source IS NULL;
UPDATE leads SET designer = 'Darin Hochstetler' WHERE designer IS NULL OR designer = '';
