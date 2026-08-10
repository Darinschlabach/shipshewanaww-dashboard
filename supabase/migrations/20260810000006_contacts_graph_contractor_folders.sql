-- Contractor contact folders under Jobs and Quotes SharePoint roots.
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS graph_drive_id TEXT,
  ADD COLUMN IF NOT EXISTS graph_jobs_folder_item_id TEXT,
  ADD COLUMN IF NOT EXISTS graph_quotes_folder_item_id TEXT,
  ADD COLUMN IF NOT EXISTS graph_jobs_folder_web_url TEXT,
  ADD COLUMN IF NOT EXISTS graph_quotes_folder_web_url TEXT;
