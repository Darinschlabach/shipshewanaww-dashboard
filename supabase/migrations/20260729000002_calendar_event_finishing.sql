-- Add finishing to calendar_event_type (used by schedule bubbles).
ALTER TYPE calendar_event_type ADD VALUE IF NOT EXISTS 'finishing';

NOTIFY pgrst, 'reload schema';
