-- First drop all existing policies on profiles
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "System can insert profiles" ON public.profiles;

-- Now create clean policies
CREATE POLICY "Anyone can insert profiles"
ON public.profiles FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users update own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users view own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = user_id);