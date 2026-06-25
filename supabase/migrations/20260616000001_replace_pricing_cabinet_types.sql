-- Replace pricing catalogue cabinet types with updated base, wall, and tall lineup.

DELETE FROM pricing_cabinet_types;

INSERT INTO pricing_cabinet_types (name, category, base_price, sq_ft_price, sort_order) VALUES
  ('Base – 1 Door', 'Base Cabinets', 34.00, 50.00, 1),
  ('Base – 2 Doors', 'Base Cabinets', 48.00, 53.00, 2),
  ('Base – Open', 'Base Cabinets', 20.00, 45.00, 3),
  ('Base – 2 Drawers', 'Base Cabinets', 50.00, 65.00, 4),
  ('Base – 3 Drawers', 'Base Cabinets', 75.00, 70.00, 5),
  ('Base – 1 Door 1 Drawer', 'Base Cabinets', 59.00, 60.00, 6),
  ('Base – 2 Door 2 Drawers', 'Base Cabinets', 98.00, 68.00, 7),
  ('Base – 2 Doors 1 Drawer', 'Base Cabinets', 73.00, 62.00, 8),
  ('Base – Sink Base', 'Base Cabinets', 30.00, 50.00, 9),
  ('Base – Corner Blind', 'Base Cabinets', 40.00, 45.00, 10),
  ('Base – Corner', 'Base Cabinets', 60.00, 45.00, 11),
  ('Base 1 Drawer', 'Base Cabinets', 200.00, 50.00, 12),
  ('Wall – 1 Door', 'Wall Cabinets', 34.00, 60.00, 13),
  ('Wall – 2 Doors', 'Wall Cabinets', 48.00, 62.00, 14),
  ('Wall – 3 Doors', 'Wall Cabinets', 62.00, 65.00, 15),
  ('Wall – Corner', 'Wall Cabinets', 34.00, 50.00, 16),
  ('Wall – Open', 'Wall Cabinets', 20.00, 50.00, 17),
  ('Wall – 1 Door Glass', 'Wall Cabinets', 44.00, 60.00, 18),
  ('Wall – 2 Door Glass', 'Wall Cabinets', 68.00, 65.00, 19),
  ('Tall – 1 Door Pantry', 'Tall Cabinets', 61.00, 56.00, 20),
  ('Tall – 2 Door Pantry', 'Tall Cabinets', 83.00, 60.00, 21),
  ('Tall – 4 Door Pantry', 'Tall Cabinets', 110.00, 65.00, 22);
