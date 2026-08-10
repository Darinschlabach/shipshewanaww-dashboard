-- Nested folders under Production Drawings for jobs.
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS graph_face_frame_drawings_item_id TEXT,
  ADD COLUMN IF NOT EXISTS graph_assembly_drawings_item_id TEXT;
