-- Seed data for development (run after initial schema)
-- Safe to re-run: uses fixed UUIDs with ON CONFLICT DO NOTHING

INSERT INTO contacts (id, first_name, last_name, email, phone) VALUES
  ('a0000001-0000-4000-8000-000000000001', 'Jake', 'Smith', 'jake@email.com', '(574) 555-0101'),
  ('a0000001-0000-4000-8000-000000000002', 'Lisa', 'Brown', 'lisa@email.com', '(574) 555-0102'),
  ('a0000001-0000-4000-8000-000000000003', 'Tom', 'Lee', 'tom@email.com', '(574) 555-0103'),
  ('a0000001-0000-4000-8000-000000000004', 'Ana', 'Garcia', 'ana@email.com', '(574) 555-0104')
ON CONFLICT (id) DO NOTHING;

INSERT INTO jobs (id, name, customer_id, stage, start_date, due_date, total_value, notes, quote_approved_at, design_approved_at, billing_collected, delivery_scheduled_at) VALUES
  ('b0000001-0000-4000-8000-000000000001', 'Smith kitchen remodel', 'a0000001-0000-4000-8000-000000000001', 'production', '2025-05-01', '2025-06-04', 18400, '', '2025-05-03', '2025-05-10', 4600, NULL),
  ('b0000001-0000-4000-8000-000000000002', 'Brown master bath', 'a0000001-0000-4000-8000-000000000002', 'design', '2025-05-15', '2025-06-18', 9200, '', NULL, NULL, 0, NULL),
  ('b0000001-0000-4000-8000-000000000003', 'Lee home office', 'a0000001-0000-4000-8000-000000000003', 'delivery', '2025-04-20', '2025-05-30', 6750, '', '2025-04-25', '2025-05-01', 6750, '2025-05-30'),
  ('b0000001-0000-4000-8000-000000000004', 'Garcia mudroom', 'a0000001-0000-4000-8000-000000000004', 'quote', NULL, NULL, 4100, '', NULL, NULL, 0, NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO leads (id, customer_name, project_type, est_value, status, notes) VALUES
  ('c0000001-0000-4000-8000-000000000001', 'Dave Norton', 'Kitchen remodel', 12000, 'quote_sent', ''),
  ('c0000001-0000-4000-8000-000000000002', 'Paula Hess', 'Master bathroom', 4500, 'new_inquiry', ''),
  ('c0000001-0000-4000-8000-000000000003', 'Rick Tanner', 'Home office', 8200, 'quote_sent', ''),
  ('c0000001-0000-4000-8000-000000000004', 'Greg Mason', 'Mudroom', 5800, 'lost', 'Went with competitor')
ON CONFLICT (id) DO NOTHING;

INSERT INTO purchase_orders (id, job_id, item_name, vendor, amount, status, ordered_at, delivered_at, expected_delivery) VALUES
  ('d0000001-0000-4000-8000-000000000001', 'b0000001-0000-4000-8000-000000000001', 'Sheet goods — maple', 'Menards', 1240, 'ordered', now() - interval '5 days', NULL, CURRENT_DATE - interval '2 days'),
  ('d0000001-0000-4000-8000-000000000002', 'b0000001-0000-4000-8000-000000000001', 'Hardware — hinges', 'Blum', 380, 'ordered', now() - interval '3 days', NULL, CURRENT_DATE + interval '3 days'),
  ('d0000001-0000-4000-8000-000000000003', 'b0000001-0000-4000-8000-000000000002', 'Crown molding', 'Hardwoods Inc', 220, 'not_ordered', NULL, NULL, CURRENT_DATE + interval '14 days'),
  ('d0000001-0000-4000-8000-000000000004', 'b0000001-0000-4000-8000-000000000001', 'Paint — BM Chantilly', 'SW', 180, 'delivered', now() - interval '10 days', now() - interval '2 days', NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO production_jobs (id, job_id, kanban_status, due_date) VALUES
  ('e0000001-0000-4000-8000-000000000001', 'b0000001-0000-4000-8000-000000000004', 'queued', '2025-06-05'),
  ('e0000001-0000-4000-8000-000000000002', 'b0000001-0000-4000-8000-000000000001', 'in_progress', '2025-06-04'),
  ('e0000001-0000-4000-8000-000000000003', 'b0000001-0000-4000-8000-000000000002', 'finishing', '2025-06-18'),
  ('e0000001-0000-4000-8000-000000000004', 'b0000001-0000-4000-8000-000000000003', 'ready_to_ship', '2025-05-30')
ON CONFLICT (job_id) DO NOTHING;

INSERT INTO catalogue_items (id, name, description, price, category) VALUES
  ('f0000001-0000-4000-8000-000000000001', 'Base cabinet — 24"', 'Standard base unit, soft-close hinges included', 285, 'Cabinet boxes'),
  ('f0000001-0000-4000-8000-000000000002', 'Wall cabinet — 30"', 'Upper wall mount, adjustable shelving', 195, 'Cabinet boxes'),
  ('f0000001-0000-4000-8000-000000000003', 'Shaker door — painted', 'MDF core, primed and painted to spec', 95, 'Doors'),
  ('f0000001-0000-4000-8000-000000000004', 'Drawer box — dovetail', 'Solid maple, undermount slides', 65, 'Hardware')
ON CONFLICT (id) DO NOTHING;

INSERT INTO calendar_events (id, job_id, title, event_type, event_date) VALUES
  ('01000001-0000-4000-8000-000000000001', 'b0000001-0000-4000-8000-000000000003', 'Lee delivery', 'delivery', '2025-06-04'),
  ('01000001-0000-4000-8000-000000000002', 'b0000001-0000-4000-8000-000000000002', 'Brown delivery', 'delivery', '2025-06-18'),
  ('01000001-0000-4000-8000-000000000003', 'b0000001-0000-4000-8000-000000000004', 'Garcia start', 'production', '2025-06-05'),
  ('01000001-0000-4000-8000-000000000004', 'b0000001-0000-4000-8000-000000000001', 'Miller due', 'production', '2025-06-11')
ON CONFLICT (id) DO NOTHING;
