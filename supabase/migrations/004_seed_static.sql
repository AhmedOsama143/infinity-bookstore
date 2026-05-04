-- Static seed data: branches, shipping rates, site settings, admin mapping.
-- Teacher/book data is seeded by scripts/seed.ts (needs .md parsing + image upload).

-- ============================================================================
-- Site settings singleton
-- ============================================================================
INSERT INTO site_settings (id) VALUES (1)
  ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Branches (3)
-- ============================================================================
INSERT INTO branches (slug, name_ar, city, area, address_ar, phone, whatsapp, latitude, longitude, sort_order) VALUES
  ('tamlik',  'فرع التمليك',     'كفر الدوار',  'التمليك',       'البحيرة — كفر الدوار — التمليك — أمام مسجد الهدي',                            '+201203417049', '201203417049', 31.1489677, 30.1269855, 1),
  ('elgeish', 'فرع شارع الجيش',  'كفر الدوار',  'شارع الجيش',    'البحيرة — كفر الدوار — شارع الجيش — خلف بنك مصر، أمام مول الأصدقاء',        '+201558656542', '201558656542', 31.1324539, 30.1351109, 2),
  ('escott',  'فرع سيدي بشر',    'الإسكندرية',  'سيدي بشر بحري', 'الإسكندرية — سيدي بشر بحري — شارع 17 — فوق النفق (منطقة إسكوت)',              '+201553950043', '201553950043', 31.2599754, 29.9891243, 3)
ON CONFLICT (slug) DO UPDATE SET
  name_ar    = EXCLUDED.name_ar,
  address_ar = EXCLUDED.address_ar,
  phone      = EXCLUDED.phone,
  whatsapp   = EXCLUDED.whatsapp,
  latitude   = EXCLUDED.latitude,
  longitude  = EXCLUDED.longitude;

-- ============================================================================
-- Shipping rates (Alex 60, Alex outskirts 80, Kafr El-Dawwar 30; others TBD)
-- ============================================================================
INSERT INTO shipping_rates (governorate_ar, area_type, price) VALUES
  ('الإسكندرية',  'alexandria_city',       60.00),
  ('الإسكندرية',  'alexandria_outskirts',  80.00),
  ('البحيرة',     'kafr_el_dawwar',        30.00)
ON CONFLICT (governorate_ar, area_type) DO UPDATE SET price = EXCLUDED.price;

-- ============================================================================
-- Link existing admin auth user to admin_users table
-- ============================================================================
INSERT INTO admin_users (id, role, branch_id, mfa_enabled)
SELECT id, 'admin'::admin_role, NULL, false
  FROM auth.users
  WHERE email = 'ammar@infinty.admin'
ON CONFLICT (id) DO UPDATE SET role = 'admin', branch_id = NULL;

-- Mirror app_metadata.role for the JWT-based is_admin() check
UPDATE auth.users
  SET raw_app_meta_data = raw_app_meta_data || jsonb_build_object('role', 'admin')
  WHERE email = 'ammar@infinty.admin';

-- ============================================================================
-- Default site content (editable later from admin)
-- ============================================================================
INSERT INTO site_content (key, title_ar, body_ar) VALUES
  ('about',   'من نحن',
   E'مركز إنفينيتي مركز متخصص في كتب المدرسين للمرحلة الثانوية.\nنخدم طلاب كفر الدوار والإسكندرية من ٣ فروع، مع التوصيل لكافة المحافظات.'),
  ('faq',     'الأسئلة الشائعة', E'سيتم إضافة الأسئلة قريبًا.'),
  ('privacy', 'سياسة الخصوصية', E'سيتم إضافة سياسة الخصوصية قريبًا.'),
  ('terms',   'شروط الاستخدام', E'سيتم إضافة شروط الاستخدام قريبًا.'),
  ('refund',  'سياسة الاسترجاع', E'سيتم إضافة سياسة الاسترجاع قريبًا.'),
  ('shipping_policy', 'سياسة الشحن', E'شحن مجاني للطلبات فوق ٢٥٠٠ جنيه. الإسكندرية ٦٠ جنيه — ضواحي الإسكندرية ٨٠ جنيه — كفر الدوار ٣٠ جنيه.')
ON CONFLICT (key) DO NOTHING;
