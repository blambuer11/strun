-- CRITICAL SECURITY FIX: Remove public access to sensitive profile data

-- Drop existing view first if it exists
DROP VIEW IF EXISTS public.public_profiles CASCADE;

-- First drop ALL existing policies on profiles table
DROP POLICY IF EXISTS "Users can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users view own profile only" ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile only" ON public.profiles;
DROP POLICY IF EXISTS "Users insert own profile only" ON public.profiles;

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

-- Create a NEW public view for leaderboard/public data that EXCLUDES sensitive fields
-- This protects: email, wallet_address, referral_code, referred_by, referral_xp_earned, city
CREATE VIEW public.public_profiles AS
SELECT 
  p.id,
  p.username,
  p.avatar_url,
  p.xp,
  p.level,
  p.total_distance,
  p.total_area,
  p.total_runs,
  p.country,
  p.country_code,
  p.created_at
FROM public.profiles p;

-- Grant public access to the SAFE VIEW only
GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- SECURITY VERIFICATION:
-- The profiles table now:
-- 1. BLOCKS public access to email addresses ✅
-- 2. BLOCKS public access to wallet addresses ✅
-- 3. BLOCKS public access to referral codes ✅
-- 4. BLOCKS public access to city (precise location) ✅
-- 5. ONLY allows users to see their OWN full profile ✅
-- 6. Public can ONLY access the safe view with non-sensitive data ✅