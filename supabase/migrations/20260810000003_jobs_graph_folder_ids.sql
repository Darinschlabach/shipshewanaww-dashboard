-- Store Microsoft Graph DriveItem IDs for job SharePoint folders.
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS graph_drive_id TEXT,
  ADD COLUMN IF NOT EXISTS graph_folder_item_id TEXT,
  ADD COLUMN IF NOT EXISTS graph_web_url TEXT,
  ADD COLUMN IF NOT EXISTS graph_provided_drawings_item_id TEXT,
  ADD COLUMN IF NOT EXISTS graph_quote_forms_item_id TEXT,
  ADD COLUMN IF NOT EXISTS graph_misc_item_id TEXT,
  ADD COLUMN IF NOT EXISTS graph_production_drawings_item_id TEXT,
  ADD COLUMN IF NOT EXISTS graph_cv_client_drawings_item_id TEXT,
  ADD COLUMN IF NOT EXISTS graph_appliance_specs_item_id TEXT,
  ADD COLUMN IF NOT EXISTS graph_purchase_orders_item_id TEXT,
  ADD COLUMN IF NOT EXISTS graph_invoices_item_id TEXT;

CREATE INDEX IF NOT EXISTS jobs_graph_folder_item_id_idx
  ON jobs (graph_folder_item_id)
  WHERE graph_folder_item_id IS NOT NULL;
