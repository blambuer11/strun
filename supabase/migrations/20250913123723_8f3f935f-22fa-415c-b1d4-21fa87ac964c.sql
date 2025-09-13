-- CRITICAL SECURITY FIX: Remove public access to sensitive profile data

-- First drop ALL existing policies on profiles table
DROP POLICY IF EXISTS "Users can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

-- Now create the SECURE policies
-- Users can only view their own complete profile (with all sensitive data)
CREATE POLICY "Users view own profile only" 
ON public.profiles FOR SELECT 
USING (user_id = auth.uid());

-- Users can update only their own profile
CREATE POLICY "Users update own profile only" 
ON public.profiles FOR UPDATE 
USING (user_id = auth.uid());

-- Users can insert only their own profile
CREATE POLICY "Users insert own profile only" 
ON public.profiles FOR INSERT 
WITH CHECK (user_id = auth.uid());

-- Create a public view for leaderboard/public data that EXCLUDES sensitive fields
-- This protects: email, wallet_address, referral_code, referred_by, referral_xp_earned
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
  country,  -- Country is ok for public leaderboard
  country_code,
  created_at
FROM public.profiles;

-- Grant public access to the SAFE VIEW only (not the table!)
GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- Create a secure function to get user's own sensitive data
CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS TABLE (
  id UUID,
  user_id UUID,
  email TEXT,
  username TEXT,
  wallet_address TEXT,
  avatar_url TEXT,
  xp INTEGER,
  level INTEGER,
  total_distance BIGINT,
  total_area NUMERIC,
  total_runs INTEGER,
  referral_code TEXT,
  referred_by UUID,
  referral_count INTEGER,
  referral_xp_earned INTEGER,
  country TEXT,
  country_code TEXT,
  city TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT * FROM public.profiles
  WHERE user_id = auth.uid();
$$;

-- Create function to safely get another user's PUBLIC data only
CREATE OR REPLACE FUNCTION public.get_user_public_data(profile_id UUID)
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
SET search_path = public
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

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_xp_desc ON public.profiles(xp DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_total_distance_desc ON public.profiles(total_distance DESC);

-- SECURITY SUMMARY:
-- ✅ Email addresses are now PROTECTED (only visible to account owner)
-- ✅ Wallet addresses are now PROTECTED
-- ✅ Referral codes are now PROTECTED  
-- ✅ City/precise location is now PROTECTED
-- ✅ Public can only see: username, avatar, XP, level, distance, area, country
-- ✅ Leaderboards can still function using the public_profiles view