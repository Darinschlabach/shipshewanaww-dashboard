-- Combine first_name + last_name into a single name field

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS name TEXT;

UPDATE contacts
SET name = TRIM(CONCAT(first_name, ' ', last_name))
WHERE name IS NULL AND first_name IS NOT NULL;

UPDATE contacts
SET name = COALESCE(NULLIF(name, ''), 'Unknown')
WHERE name IS NULL OR TRIM(name) = '';

ALTER TABLE contacts ALTER COLUMN name SET NOT NULL;

ALTER TABLE contacts DROP COLUMN IF EXISTS first_name;
ALTER TABLE contacts DROP COLUMN IF EXISTS last_name;
