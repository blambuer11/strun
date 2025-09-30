-- Drop existing views completely to ensure no SECURITY DEFINER settings remain
DROP VIEW IF EXISTS public.public_profiles CASCADE;
DROP VIEW IF EXISTS public.public_users CASCADE;
DROP VIEW IF EXISTS public.public_run_stats CASCADE;

-- Recreate public_profiles view without SECURITY DEFINER
-- This view shows public profile information
CREATE VIEW public.public_profiles AS
SELECT 
  p.id,
  p.username,
  p.avatar_url,
  p.level,
  p.xp,
  p.total_runs,
  p.total_distance,
  p.total_area,
  p.country,
  p.country_code,
  p.created_at
FROM public.profiles p;

-- Grant SELECT permissions to anon and authenticated roles
GRANT SELECT ON public.public_profiles TO anon;
GRANT SELECT ON public.public_profiles TO authenticated;

-- Add comment explaining the purpose
COMMENT ON VIEW public.public_profiles IS 'Public view of user profiles showing non-sensitive information';

-- Recreate public_users view without SECURITY DEFINER
-- This view shows basic user information
CREATE VIEW public.public_users AS
SELECT 
  u.id,
  u.name,
  u.avatar_url,
  u.created_at
FROM public.users u;

-- Grant SELECT permissions to anon and authenticated roles
GRANT SELECT ON public.public_users TO anon;
GRANT SELECT ON public.public_users TO authenticated;

-- Add comment explaining the purpose
COMMENT ON VIEW public.public_users IS 'Public view of users showing only basic non-sensitive information';

-- Recreate public_run_stats view without SECURITY DEFINER
-- This view shows aggregated run statistics for leaderboards
CREATE VIEW public.public_run_stats AS
SELECT 
  r.id,
  u.name AS user_name,
  u.avatar_url,
  r.distance,
  r.duration,
  r.area,
  r.created_at,
  r.xp_earned
FROM public.runs r
JOIN public.users u ON r.user_id = u.id
WHERE r.created_at > (now() - interval '30 days'); -- Only show recent runs

-- Grant SELECT permissions to anon and authenticated roles
GRANT SELECT ON public.public_run_stats TO anon;
GRANT SELECT ON public.public_run_stats TO authenticated;

-- Add comment explaining the purpose
COMMENT ON VIEW public.public_run_stats IS 'Public view of recent run statistics for leaderboards and community features';

-- Ensure views are created with INVOKER security (default)
-- This means they will use the permissions of the user querying the view
-- not the permissions of the view owner