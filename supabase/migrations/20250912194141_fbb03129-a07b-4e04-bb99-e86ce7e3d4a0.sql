-- CRITICAL SECURITY FIX: Remove public access to sensitive profile data

-- Drop the insecure public policy
DROP POLICY IF EXISTS "Users can view profiles" ON public.profiles;

-- Create secure policies that protect sensitive data
-- Users can only view their own complete profile
CREATE POLICY "Users can view own profile" 
ON public.profiles FOR SELECT 
USING (user_id = auth.uid());

-- Create a public view for leaderboard/public data that excludes sensitive fields
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT 
  id,
  username,
  avatar_url,
  xp,
  level,
  total_distance,
  total_area,
  total_runs,
  country,  -- Country is ok for leaderboard
  country_code,
  created_at
FROM public.profiles;

-- Grant public access to the safe view only
GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- Create policy for users to search other users (only non-sensitive data)
-- This is done through the view, not the table

-- Add function to get another user's public data safely
CREATE OR REPLACE FUNCTION public.get_user_public_profile(profile_id UUID)
RETURNS TABLE (
  id UUID,
  username TEXT,
  avatar_url TEXT,
  xp INTEGER,
  level INTEGER,
  total_distance BIGINT,
  total_area NUMERIC,
  country TEXT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT 
    id,
    username,
    avatar_url,
    xp,
    level,
    total_distance,
    total_area,
    country
  FROM public.profiles
  WHERE id = profile_id;
$$;

-- Update group policies to use profile IDs correctly
DROP POLICY IF EXISTS "Users can create groups" ON public.groups;
CREATE POLICY "Users can create groups" 
ON public.groups FOR INSERT 
WITH CHECK (
  creator_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Group creators can update" ON public.groups;
CREATE POLICY "Group creators can update" 
ON public.groups FOR UPDATE 
USING (
  creator_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  )
);

-- Fix group members policies
DROP POLICY IF EXISTS "Join groups" ON public.group_members;
CREATE POLICY "Join groups" 
ON public.group_members FOR INSERT 
WITH CHECK (
  user_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Leave groups" ON public.group_members;
CREATE POLICY "Leave groups" 
ON public.group_members FOR DELETE 
USING (
  user_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  )
);

-- Fix XP transactions policy
DROP POLICY IF EXISTS "View own XP transactions" ON public.xp_transactions;
CREATE POLICY "View own XP transactions" 
ON public.xp_transactions FOR SELECT 
USING (
  user_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  )
);

-- Add index for performance on the view
CREATE INDEX IF NOT EXISTS idx_profiles_xp ON public.profiles(xp DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_total_distance ON public.profiles(total_distance DESC);

-- IMPORTANT: Email, wallet_address, referral_code, and other sensitive data 
-- are now ONLY accessible to the user themselves