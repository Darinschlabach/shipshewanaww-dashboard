-- Extend quotes (leads) with fields and statuses for the Quotes module

ALTER TABLE leads ADD COLUMN IF NOT EXISTS quote_number TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'Direct Customer';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS designer TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS sent_at DATE;

ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'draft';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'sent';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'revision';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'approved';
