-- Per-room pricing multipliers (wood, finish, door) — cabinets only
-- UUID refs only (no FK) so this runs even if pricing catalogue tables are added separately.

ALTER TABLE quote_rooms ADD COLUMN IF NOT EXISTS wood_species_id UUID;
ALTER TABLE quote_rooms ADD COLUMN IF NOT EXISTS finish_type_id UUID;
ALTER TABLE quote_rooms ADD COLUMN IF NOT EXISTS door_style_id UUID;
