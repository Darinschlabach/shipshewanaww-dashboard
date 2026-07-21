ALTER TABLE drafting_questions
  ADD COLUMN IF NOT EXISTS answered_on DATE;

UPDATE drafting_questions
SET answered_on = asked_on
WHERE status = 'answered' AND answered_on IS NULL;
