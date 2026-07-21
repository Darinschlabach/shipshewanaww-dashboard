ALTER TABLE production_tasks
  ADD COLUMN IF NOT EXISTS details TEXT;
