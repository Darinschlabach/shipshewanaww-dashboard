-- Minutes before event to remind the user (null = no reminder).
ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS reminder_minutes INTEGER;

ALTER TABLE calendar_events
  DROP CONSTRAINT IF EXISTS calendar_events_reminder_minutes_check;

ALTER TABLE calendar_events
  ADD CONSTRAINT calendar_events_reminder_minutes_check
  CHECK (reminder_minutes IS NULL OR reminder_minutes > 0);
