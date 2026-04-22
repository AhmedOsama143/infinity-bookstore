-- Auto-create a students row whenever someone signs up via Supabase Auth
-- (email/password, Google, or Facebook). Admin users are skipped.

CREATE OR REPLACE FUNCTION handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.raw_app_meta_data ->> 'role' = 'admin' THEN
    RETURN NEW;
  END IF;

  INSERT INTO students (id, email, full_name, auth_provider)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data ->> 'full_name',
      NEW.raw_user_meta_data ->> 'name',
      split_part(NEW.email, '@', 1)
    ),
    CASE
      WHEN NEW.raw_app_meta_data ->> 'provider' = 'google'   THEN 'google'::auth_provider
      WHEN NEW.raw_app_meta_data ->> 'provider' = 'facebook' THEN 'facebook'::auth_provider
      ELSE 'email'::auth_provider
    END
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Also backfill the existing student for the admin? No — admin stays in admin_users only.
