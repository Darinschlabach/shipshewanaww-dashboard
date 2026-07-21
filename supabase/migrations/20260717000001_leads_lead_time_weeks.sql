-- Lead time (weeks) shown on quote PDF
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_time_weeks INTEGER NOT NULL DEFAULT 7;
