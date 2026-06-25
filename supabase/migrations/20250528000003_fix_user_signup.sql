-- Fix: "Database error creating new user"
-- Cause: profiles trigger blocked by RLS and/or invalid role cast

-- 1. Safer trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  assigned_role user_role := 'office';
  meta_role TEXT;
BEGIN
  meta_role := NEW.raw_user_meta_data->>'role';
  IF meta_role IN ('owner', 'office', 'shop') THEN
    assigned_role := meta_role::user_role;
  END IF;

  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), split_part(NEW.email, '@', 1)),
    NEW.email,
    assigned_role
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- 2. Allow profile rows to be created on signup
DROP POLICY IF EXISTS "profiles_insert_on_signup" ON public.profiles;
CREATE POLICY "profiles_insert_on_signup"
  ON public.profiles
  FOR INSERT
  TO authenticated, service_role
  WITH CHECK (true);

-- 3. Ensure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
