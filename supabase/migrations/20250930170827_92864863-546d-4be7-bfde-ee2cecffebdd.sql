-- Fix profiles table RLS policies for proper insert and update
DROP POLICY IF EXISTS "Users insert own profile only" ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile only" ON public.profiles;
DROP POLICY IF EXISTS "Users view own profile only" ON public.profiles;

-- Create new policies that work properly
CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = user_id);

-- Also allow the system to create profiles via trigger
CREATE POLICY "System can insert profiles"
ON public.profiles FOR INSERT
WITH CHECK (true);

-- Make sure wallet_address can be updated
ALTER TABLE public.profiles 
ALTER COLUMN wallet_address TYPE text;