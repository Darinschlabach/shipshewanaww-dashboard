-- Migrate legacy kanban statuses to shop-floor stage names

UPDATE production_jobs SET kanban_status = 'cutting' WHERE kanban_status = 'queued';
UPDATE production_jobs SET kanban_status = 'assembly' WHERE kanban_status = 'in_progress';
UPDATE production_jobs SET kanban_status = 'ready_for_delivery' WHERE kanban_status = 'ready_to_ship';

UPDATE production_jobs SET department = 'Shop Floor' WHERE department IS NULL;
UPDATE production_jobs SET priority = 'medium' WHERE priority IS NULL;
