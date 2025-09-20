-- Fix SECURITY DEFINER view security issue
-- Drop the existing view with SECURITY DEFINER
DROP VIEW IF EXISTS public.public_profiles;

-- Recreate the view without SECURITY DEFINER
-- This view shows only public profile information
CREATE VIEW public.public_profiles AS
SELECT 
  id,
  username,
  avatar_url,
  country,
  country_code,
  level,
  xp,
  total_distance,
  total_area,
  total_runs,
  created_at
FROM public.profiles;

-- Grant access to the view
GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- Fix critical XP transaction vulnerability
-- Remove the overly permissive INSERT policy
DROP POLICY IF EXISTS "Create XP transactions" ON public.xp_transactions;

-- Create a security definer function for system XP awards
CREATE OR REPLACE FUNCTION public.award_xp(
  p_user_id UUID,
  p_amount INTEGER,
  p_type TEXT,
  p_description TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transaction_id UUID;
  v_profile_id UUID;
BEGIN
  -- Verify the user exists and get their profile id
  SELECT id INTO v_profile_id 
  FROM profiles 
  WHERE user_id = p_user_id;
  
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;
  
  -- Award XP only for valid transaction types
  IF p_type NOT IN ('run', 'referral', 'challenge', 'competition', 'bonus') THEN
    RAISE EXCEPTION 'Invalid XP transaction type';
  END IF;
  
  -- Insert the XP transaction
  INSERT INTO xp_transactions (user_id, amount, type, description, metadata)
  VALUES (v_profile_id, p_amount, p_type, p_description, p_metadata)
  RETURNING id INTO v_transaction_id;
  
  -- Update user's XP balance
  UPDATE profiles 
  SET xp = xp + p_amount,
      updated_at = now()
  WHERE id = v_profile_id;
  
  RETURN v_transaction_id;
END;
$$;

-- Create policy for users to view their own XP transactions (keep existing)
-- The SELECT policy already exists and is correct

-- Fix leaderboard entries vulnerability
DROP POLICY IF EXISTS "System can manage leaderboard" ON public.leaderboard_entries;

-- Create a security definer function for leaderboard updates
CREATE OR REPLACE FUNCTION public.update_leaderboard_entry(
  p_user_id UUID,
  p_category TEXT,
  p_period TEXT,
  p_value NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id UUID;
  v_country TEXT;
BEGIN
  -- Get profile info
  SELECT id, country INTO v_profile_id, v_country
  FROM profiles 
  WHERE user_id = p_user_id;
  
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;
  
  -- Upsert leaderboard entry
  INSERT INTO leaderboard_entries (user_id, category, period, value, country)
  VALUES (v_profile_id, p_category, p_period, p_value, v_country)
  ON CONFLICT (user_id, category, period) 
  DO UPDATE SET 
    value = EXCLUDED.value,
    updated_at = now(),
    country = EXCLUDED.country;
  
  -- Update ranks (simplified, you may want more complex ranking logic)
  WITH ranked AS (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY category, period 
      ORDER BY value DESC
    ) as new_rank
    FROM leaderboard_entries
    WHERE category = p_category AND period = p_period
  )
  UPDATE leaderboard_entries le
  SET 
    previous_rank = rank,
    rank = r.new_rank
  FROM ranked r
  WHERE le.id = r.id;
END;
$$;

-- Add audit logging for sensitive operations
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  old_values JSONB,
  new_values JSONB,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on audit logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only system can insert audit logs
CREATE POLICY "System inserts audit logs" ON public.audit_logs
  FOR INSERT 
  WITH CHECK (false);

-- Users can view their own audit logs
CREATE POLICY "Users view own audit logs" ON public.audit_logs
  FOR SELECT 
  USING (user_id IN (
    SELECT id FROM profiles WHERE profiles.user_id = auth.uid()
  ));

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);