-- Shared id for all occurrences in a recurring series (null = single event).
ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS recurrence_series_id UUID;

CREATE INDEX IF NOT EXISTS calendar_events_recurrence_series_id_idx
  ON calendar_events (recurrence_series_id)
  WHERE recurrence_series_id IS NOT NULL;
