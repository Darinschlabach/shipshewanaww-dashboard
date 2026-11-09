-- Percent taken off a quote before sales tax. 0 means no discount.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS discount_percent numeric(5,2) NOT NULL DEFAULT 0;

ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_discount_percent_range;
ALTER TABLE leads ADD CONSTRAINT leads_discount_percent_range CHECK (
  discount_percent >= 0 AND discount_percent <= 100
);
