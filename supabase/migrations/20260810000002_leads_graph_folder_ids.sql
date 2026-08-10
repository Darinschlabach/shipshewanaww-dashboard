-- Store Microsoft Graph DriveItem IDs for quote SharePoint folders.
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS graph_drive_id TEXT,
  ADD COLUMN IF NOT EXISTS graph_folder_item_id TEXT,
  ADD COLUMN IF NOT EXISTS graph_web_url TEXT,
  ADD COLUMN IF NOT EXISTS graph_provided_drawings_item_id TEXT,
  ADD COLUMN IF NOT EXISTS graph_quote_forms_item_id TEXT,
  ADD COLUMN IF NOT EXISTS graph_misc_item_id TEXT;

CREATE INDEX IF NOT EXISTS leads_graph_folder_item_id_idx
  ON leads (graph_folder_item_id)
  WHERE graph_folder_item_id IS NOT NULL;
