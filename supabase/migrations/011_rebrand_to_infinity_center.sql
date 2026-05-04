-- Rebrand from "مكتبة إنفينيتي" (Infinity Bookstore) to "مركز إنفينيتي" (Infinity Center).
-- Updates the live `site_content.about` row (seed migrations don't re-run).

UPDATE site_content
   SET body_ar = 'مركز إنفينيتي مركز متخصص في كتب المدرسين للمرحلة الثانوية.' || E'\n' ||
                 'نخدم طلاب كفر الدوار والإسكندرية من ٣ فروع، مع التوصيل لكافة المحافظات.'
 WHERE key = 'about'
   AND body_ar LIKE 'مكتبة إنفينيتي%';
