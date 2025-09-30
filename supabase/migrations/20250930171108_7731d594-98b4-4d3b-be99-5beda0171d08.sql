-- Fix security issue: Remove anonymous access to leaderboard_stats
-- Only authenticated users should be able to view the leaderboard

-- First, revoke anonymous access to the leaderboard
REVOKE SELECT ON public.leaderboard_stats FROM anon;

-- Keep authenticated user access
-- The view already filters to only show users with public privacy settings

-- Add comment explaining the security model
COMMENT ON VIEW public.leaderboard_stats IS 'Leaderboard showing top 100 users who opted-in to public visibility - authenticated users only';

-- Also update the public_profiles view to remove anonymous access if it exists
REVOKE ALL ON public.public_profiles FROM anon;

-- Create a more secure anonymous leaderboard that doesn't expose personal data
CREATE OR REPLACE VIEW public.anonymous_leaderboard AS
SELECT 
  ROW_NUMBER() OVER (ORDER BY p.xp DESC) as rank,
  p.level,
  p.xp,
  p.total_runs,
  p.total_distance,
  p.country, -- Only country, no personal identifiers
  'Player' || ROW_NUMBER() OVER (ORDER BY p.xp DESC) as display_name -- Generic names
FROM public.profiles p
WHERE 
  p.level > 0
  AND EXISTS (
    SELECT 1 FROM public.user_settings us
    WHERE us.user_id = p.id
    AND (us.privacy_mode = 'public' OR us.privacy_mode IS NULL)
  )
ORDER BY p.xp DESC
LIMIT 100;

-- This anonymous view can be accessed by anyone but doesn't expose personal data
GRANT SELECT ON public.anonymous_leaderboard TO anon;
GRANT SELECT ON public.anonymous_leaderboard TO authenticated;

COMMENT ON VIEW public.anonymous_leaderboard IS 'Anonymous leaderboard data for public display - no personal information exposed';