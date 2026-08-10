-- Production Drawings folder DriveItem ID for jobs.
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS graph_production_drawings_item_id TEXT;
