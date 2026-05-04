-- Allow guest students for dashboard manual orders (walk-ins without auth accounts).
-- Drop the auth.users FK so we can insert students without a corresponding auth row.
-- Registered users still get id = auth.users.id via the handle_new_user trigger.
-- Guests get a fresh UUID and is_guest=true so reporting can distinguish them.

ALTER TABLE students
  DROP CONSTRAINT students_id_fkey;

ALTER TABLE students
  ALTER COLUMN id SET DEFAULT uuid_generate_v4();

ALTER TABLE students
  ADD COLUMN is_guest BOOLEAN NOT NULL DEFAULT false;

-- Phone lookups are now common (dashboard manual entry dedups by phone).
CREATE INDEX IF NOT EXISTS idx_students_phone ON students(phone) WHERE phone IS NOT NULL;
