-- Extended contact fields: fax, address, contact type

CREATE TYPE contact_type AS ENUM (
  'Customers',
  'Vendors',
  'Contractors',
  'Employees'
);

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS fax TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS contact_type contact_type NOT NULL DEFAULT 'Customers';
