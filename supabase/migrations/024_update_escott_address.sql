-- Drop the legacy "إسكوت" (Ascot) landmark from the Sidi Bishr branch address.
-- The branch was renamed in 010; this updates the address text to match.
-- Slug, name, coordinates, and phone stay unchanged.

UPDATE branches
   SET address_ar = 'الإسكندرية — سيدي بشر بحري — شارع 17 — فوق النفق (منطقة سيدي بشر)'
 WHERE slug = 'escott';
