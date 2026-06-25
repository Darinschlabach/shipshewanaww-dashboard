-- Extend production kanban stages and job metadata

ALTER TYPE kanban_status ADD VALUE IF NOT EXISTS 'cutting';
ALTER TYPE kanban_status ADD VALUE IF NOT EXISTS 'edgebanding';
ALTER TYPE kanban_status ADD VALUE IF NOT EXISTS 'assembly';
ALTER TYPE kanban_status ADD VALUE IF NOT EXISTS 'ready_for_delivery';

ALTER TABLE production_jobs ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium';
ALTER TABLE production_jobs ADD COLUMN IF NOT EXISTS assignee TEXT;
ALTER TABLE production_jobs ADD COLUMN IF NOT EXISTS department TEXT DEFAULT 'Shop Floor';
