-- Extend calendar events for weekly schedule UI

ALTER TYPE calendar_event_type ADD VALUE IF NOT EXISTS 'installation';
ALTER TYPE calendar_event_type ADD VALUE IF NOT EXISTS 'personal';
ALTER TYPE calendar_event_type ADD VALUE IF NOT EXISTS 'deadline';
ALTER TYPE calendar_event_type ADD VALUE IF NOT EXISTS 'other';

ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS start_time TIME;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS end_time TIME;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS is_all_day BOOLEAN DEFAULT false;
