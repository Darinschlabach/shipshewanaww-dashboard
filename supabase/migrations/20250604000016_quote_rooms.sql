-- Rooms and line items for quotes (leads)

CREATE TABLE quote_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX quote_rooms_lead_id_idx ON quote_rooms (lead_id);

CREATE TYPE quote_room_item_category AS ENUM ('cabinets', 'components', 'labor');

CREATE TABLE quote_room_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES quote_rooms(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL,
  description TEXT,
  qty_size TEXT,
  price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  category quote_room_item_category NOT NULL DEFAULT 'cabinets',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX quote_room_items_room_id_idx ON quote_room_items (room_id);

ALTER TABLE quote_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_room_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all" ON quote_rooms
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "auth_all" ON quote_room_items
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
