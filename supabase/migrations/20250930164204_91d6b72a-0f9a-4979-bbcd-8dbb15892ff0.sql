-- Create a public view for leaderboard/community features with aggregated data
CREATE OR REPLACE VIEW public.public_run_stats AS
SELECT 
  r.id,
  u.name as user_name,
  u.avatar_url,
  r.distance,
  r.duration,
  r.area,
  r.created_at,
  r.xp_earned
FROM runs r
JOIN users u ON r.user_id = u.id
WHERE r.created_at > now() - interval '30 days'; -- Only show recent runs

-- Grant access to the public view
GRANT SELECT ON public.public_run_stats TO anon, authenticated;

-- FIX: Infinite recursion in lobby_participants
-- Create a security definer function to check lobby membership
CREATE OR REPLACE FUNCTION public.is_lobby_participant(lobby_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user is creator or participant
  RETURN EXISTS (
    SELECT 1 
    FROM private_lobbies pl
    LEFT JOIN lobby_participants lp ON lp.lobby_id = pl.id
    LEFT JOIN profiles p ON (p.id = pl.creator_id OR p.id = lp.user_id)
    WHERE pl.id = lobby_uuid 
    AND p.user_id = auth.uid()
  );
END;
$$;

-- Drop the problematic recursive policy
DROP POLICY IF EXISTS "Participants can view lobby members" ON public.lobby_participants;

-- Create a new policy using the security definer function
CREATE POLICY "Participants can view lobby members secure" 
ON public.lobby_participants 
FOR SELECT 
USING (public.is_lobby_participant(lobby_id));

-- Similarly fix the lobbies view policy
DROP POLICY IF EXISTS "Lobbies are viewable by participants" ON public.private_lobbies;

CREATE POLICY "Lobbies are viewable by participants secure" 
ON public.private_lobbies 
FOR SELECT 
USING (
  creator_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  ) 
  OR public.is_lobby_participant(id)
);

-- Remove SECURITY DEFINER from public views to prevent RLS bypass
DROP VIEW IF EXISTS public.public_profiles CASCADE;
DROP VIEW IF EXISTS public.public_users CASCADE;

-- Recreate public_profiles view without SECURITY DEFINER
CREATE VIEW public.public_profiles AS
SELECT 
  id,
  username,
  avatar_url,
  level,
  xp,
  total_runs,
  total_distance,
  total_area,
  country,
  country_code,
  created_at
FROM profiles;

-- Recreate public_users view without SECURITY DEFINER  
CREATE VIEW public.public_users AS
SELECT 
  id,
  name,
  avatar_url,
  created_at
FROM users;

-- Grant appropriate permissions
GRANT SELECT ON public.public_profiles TO anon, authenticated;
GRANT SELECT ON public.public_users TO anon, authenticated;