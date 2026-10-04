-- Sample seed data — safe to run once after schema.sql
-- Replace phone numbers with real MLA numbers before going live.

INSERT INTO wards (name) VALUES
  ('Amritsar North'),
  ('Jalandhar Central')
ON CONFLICT (name) DO NOTHING;

-- Two MLA accounts + one admin (admin sees all wards)
INSERT INTO users (name, phone, role, ward_id)
SELECT 'MLA - Amritsar North', '+919999900001', 'mla', id FROM wards WHERE name = 'Amritsar North'
ON CONFLICT (phone) DO NOTHING;

INSERT INTO users (name, phone, role, ward_id)
SELECT 'MLA - Jalandhar Central', '+919999900002', 'mla', id FROM wards WHERE name = 'Jalandhar Central'
ON CONFLICT (phone) DO NOTHING;

INSERT INTO users (name, phone, role, ward_id)
VALUES ('Constituency Office Admin', '+919999900000', 'admin', NULL)
ON CONFLICT (phone) DO NOTHING;

INSERT INTO booths (name, ward_id, address)
SELECT 'Booth 1 - Govt School', id, 'Main Road' FROM wards WHERE name = 'Amritsar North'
ON CONFLICT DO NOTHING;

INSERT INTO booths (name, ward_id, address)
SELECT 'Booth 2 - Community Hall', id, 'Sector 5' FROM wards WHERE name = 'Amritsar North'
ON CONFLICT DO NOTHING;

INSERT INTO schemes (name, category, ward_id)
SELECT 'Old Age Pension', 'Welfare', id FROM wards WHERE name = 'Amritsar North'
ON CONFLICT DO NOTHING;

INSERT INTO schemes (name, category, ward_id)
SELECT 'Girl Child Scholarship', 'Education', id FROM wards WHERE name = 'Amritsar North'
ON CONFLICT DO NOTHING;

-- A handful of sample voters showing off religion / caste / sub-caste /
-- relation_name / family_id so the demographic charts have something to
-- render before you import your real spreadsheet.
INSERT INTO voters (voter_card_id, name, relation_name, age, gender, phone, address, religion, caste, sub_caste, family_id, ward_id, booth_id, scheme_id)
SELECT 'PB900001', 'Ranjit Singh', NULL, 58, 'Male', '9812300001', 'House 12, Main Road', 'Sikh', 'Jat', NULL, 'phone:9812300001',
       w.id, b.id, s.id
FROM wards w
LEFT JOIN booths b ON b.ward_id = w.id AND b.name = 'Booth 1 - Govt School'
LEFT JOIN schemes s ON s.ward_id = w.id AND s.name = 'Old Age Pension'
WHERE w.name = 'Amritsar North'
ON CONFLICT (ward_id, voter_card_id) DO NOTHING;

INSERT INTO voters (voter_card_id, name, relation_name, age, gender, phone, address, religion, caste, sub_caste, family_id, ward_id, booth_id, scheme_id)
SELECT 'PB900002', 'Gurpreet Kaur', 'W/O Ranjit Singh', 54, 'Female', '9812300001', 'House 12, Main Road', 'Sikh', 'Jat', NULL, 'phone:9812300001',
       w.id, b.id, NULL
FROM wards w
LEFT JOIN booths b ON b.ward_id = w.id AND b.name = 'Booth 1 - Govt School'
WHERE w.name = 'Amritsar North'
ON CONFLICT (ward_id, voter_card_id) DO NOTHING;

INSERT INTO voters (voter_card_id, name, relation_name, age, gender, phone, address, religion, caste, sub_caste, family_id, ward_id, booth_id, scheme_id)
SELECT 'PB900003', 'Manpreet Singh', 'S/O Ranjit Singh', 27, 'Male', '9812300001', 'House 12, Main Road', 'Sikh', 'Jat', NULL, 'phone:9812300001',
       w.id, b.id, NULL
FROM wards w
LEFT JOIN booths b ON b.ward_id = w.id AND b.name = 'Booth 1 - Govt School'
WHERE w.name = 'Amritsar North'
ON CONFLICT (ward_id, voter_card_id) DO NOTHING;

INSERT INTO voters (voter_card_id, name, relation_name, age, gender, phone, address, religion, caste, sub_caste, family_id, ward_id, booth_id, scheme_id)
SELECT 'PB900004', 'Ramesh Yadav', NULL, 45, 'Male', '9812300099', 'Sector 5', 'Hindu', 'Yadav', 'Ahir', 'phone:9812300099',
       w.id, b2.id, s.id
FROM wards w
LEFT JOIN booths b2 ON b2.ward_id = w.id AND b2.name = 'Booth 2 - Community Hall'
LEFT JOIN schemes s ON s.ward_id = w.id AND s.name = 'Girl Child Scholarship'
WHERE w.name = 'Amritsar North'
ON CONFLICT (ward_id, voter_card_id) DO NOTHING;

INSERT INTO voters (voter_card_id, name, relation_name, age, gender, phone, address, religion, caste, sub_caste, family_id, ward_id, booth_id, scheme_id)
SELECT 'PB900005', 'Fatima Bibi', NULL, 63, 'Female', '9812300055', 'Sector 5', 'Muslim', 'Sheikh', NULL, 'phone:9812300055',
       w.id, b2.id, s.id
FROM wards w
LEFT JOIN booths b2 ON b2.ward_id = w.id AND b2.name = 'Booth 2 - Community Hall'
LEFT JOIN schemes s ON s.ward_id = w.id AND s.name = 'Old Age Pension'
WHERE w.name = 'Amritsar North'
ON CONFLICT (ward_id, voter_card_id) DO NOTHING;
