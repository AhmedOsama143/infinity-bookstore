-- Rename the "Ascot" (إسكوت) branch to "Sidi Bishr" (سيدي بشر).
-- Slug, coordinates, address, and phone stay unchanged.

UPDATE branches
   SET name_ar = 'فرع سيدي بشر'
 WHERE slug = 'escott';
