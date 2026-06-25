-- Link quotes (leads) to jobs for job financials quote lists

ALTER TABLE leads ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES jobs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS leads_job_id_idx ON leads (job_id);

-- Backfill job_id from converted quotes
UPDATE leads
SET job_id = converted_job_id
WHERE converted_job_id IS NOT NULL AND job_id IS NULL;
