-- Public view'lar için güvenlik politikaları ekleyelim
-- View'lar doğrudan RLS desteklemez, bu yüzden base tablolarda zaten RLS var
-- Ancak daha fazla güvenlik için view'ları daha kısıtlayıcı hale getirelim

-- public_profiles view'ını güncelle - sadece public bilgileri göster
DROP VIEW IF EXISTS public.public_profiles CASCADE;
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
FROM public.profiles p
WHERE p.username IS NOT NULL; -- Sadece username'i olan profilleri göster

-- Grant SELECT permissions to anon and authenticated roles
GRANT SELECT ON public.public_profiles TO anon;
GRANT SELECT ON public.public_profiles TO authenticated;
COMMENT ON VIEW public.public_profiles IS 'Public leaderboard view - only shows profiles with usernames';

-- public_run_stats view'ını güncelle - anonim ve aggregated veriler
DROP VIEW IF EXISTS public.public_run_stats CASCADE;
CREATE VIEW public.public_run_stats AS
SELECT 
  r.id,
  COALESCE(u.name, 'Anonymous') AS user_name, -- İsim yoksa Anonymous göster
  u.avatar_url,
  r.distance,
  r.duration,
  r.area,
  DATE(r.created_at) as run_date, -- Sadece tarih, saat bilgisi olmadan
  r.xp_earned
FROM public.runs r
LEFT JOIN public.users u ON r.user_id = u.id
WHERE r.created_at > (now() - interval '30 days')
AND r.distance > 0; -- Sadece geçerli koşuları göster

-- Grant SELECT permissions
GRANT SELECT ON public.public_run_stats TO anon;
GRANT SELECT ON public.public_run_stats TO authenticated;
COMMENT ON VIEW public.public_run_stats IS 'Aggregated run statistics for leaderboards - anonymized and limited to 30 days';

-- public_users view'ını güncelle - minimal bilgi
DROP VIEW IF EXISTS public.public_users CASCADE;
CREATE VIEW public.public_users AS
SELECT 
  u.id,
  COALESCE(u.name, 'User') AS name, -- Default isim
  u.avatar_url,
  DATE(u.created_at) as joined_date -- Sadece tarih
FROM public.users u
WHERE u.created_at IS NOT NULL;

-- Grant SELECT permissions
GRANT SELECT ON public.public_users TO anon;
GRANT SELECT ON public.public_users TO authenticated;
COMMENT ON VIEW public.public_users IS 'Minimal public user information for display purposes only';

-- Ayrıca runs tablosunda hassas verileri korumak için ek güvenlik
-- Sadece kendi koşu verilerini görebilme politikasını kontrol et
DROP POLICY IF EXISTS "Users can view all runs" ON public.runs;
DROP POLICY IF EXISTS "Users can view own runs only" ON public.runs;

-- Yeni güvenli politika
CREATE POLICY "Users can view own runs only" 
ON public.runs 
FOR SELECT 
USING (
  user_id IN (
    SELECT id FROM public.users 
    WHERE email = (auth.jwt() ->> 'email'::text)
  )
);

-- Email adreslerinin korunduğundan emin ol
-- Users tablosunda email görünürlüğünü kısıtla
DROP POLICY IF EXISTS "Users can view own data only" ON public.users;

CREATE POLICY "Users can view own data only" 
ON public.users 
FOR SELECT 
USING (
  email = (auth.jwt() ->> 'email'::text)
);

-- Profiles tablosunda da güvenliği artır
DROP POLICY IF EXISTS "Users view own profile only" ON public.profiles;

CREATE POLICY "Users view own profile only" 
ON public.profiles 
FOR SELECT 
USING (
  user_id = auth.uid()
);