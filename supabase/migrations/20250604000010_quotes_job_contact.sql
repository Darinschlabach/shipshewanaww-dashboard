-- Job address and linked contact on quotes (leads)

ALTER TABLE leads ADD COLUMN IF NOT EXISTS job_address TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL;
