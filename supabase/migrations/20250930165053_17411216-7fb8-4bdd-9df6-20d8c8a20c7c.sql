-- GÜVENLIK DÜZELTMESI: public_profiles view'ını daha güvenli hale getir

-- Önce mevcut view'ı kaldır
DROP VIEW IF EXISTS public.public_profiles CASCADE;

-- Yeni güvenli view oluştur - sadece gerçekten public olması gereken veriler
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
  CASE 
    WHEN p.country IS NOT NULL THEN p.country 
    ELSE 'Unknown' 
  END as country,
  CASE 
    WHEN p.country_code IS NOT NULL THEN p.country_code 
    ELSE 'XX' 
  END as country_code,
  DATE(p.created_at) as created_at -- Sadece tarih, saat bilgisi gizli
FROM public.profiles p
WHERE 
  p.username IS NOT NULL -- Sadece username belirlenmiş profiller
  AND p.level > 0 -- Aktif kullanıcılar
  AND (
    -- Kullanıcı kendi profilini her zaman görebilir
    p.user_id = auth.uid()
    OR 
    -- Diğer kullanıcılar sadece public profilleri görebilir
    p.user_id IN (
      SELECT user_id 
      FROM public.user_settings 
      WHERE privacy_mode = 'public'
      OR privacy_mode IS NULL -- Default public
    )
  );

-- Sadece authenticated kullanıcılar erişebilsin
REVOKE ALL ON public.public_profiles FROM anon;
GRANT SELECT ON public.public_profiles TO authenticated;

-- View için açıklama ekle
COMMENT ON VIEW public.public_profiles IS 'Public leaderboard view - respects user privacy settings';

-- Privacy ayarını kontrol eden güvenli bir fonksiyon oluştur
CREATE OR REPLACE FUNCTION public.is_profile_public(profile_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Kullanıcı kendi profilini her zaman görebilir
  IF profile_user_id = auth.uid() THEN
    RETURN true;
  END IF;
  
  -- Privacy ayarını kontrol et
  RETURN EXISTS (
    SELECT 1 
    FROM public.user_settings 
    WHERE user_id IN (
      SELECT id FROM public.profiles WHERE user_id = profile_user_id
    )
    AND (privacy_mode = 'public' OR privacy_mode IS NULL)
  );
END;
$$;

-- Alternatif: Sadece liderlik tablosu için aggregated view
CREATE OR REPLACE VIEW public.leaderboard_stats AS
SELECT 
  p.id,
  p.username,
  p.avatar_url,
  p.level,
  p.xp,
  p.total_runs,
  p.total_distance,
  p.country, -- Sadece ülke, şehir bilgisi yok
  ROW_NUMBER() OVER (ORDER BY p.xp DESC) as global_rank,
  ROW_NUMBER() OVER (PARTITION BY p.country ORDER BY p.xp DESC) as country_rank
FROM public.profiles p
WHERE 
  p.username IS NOT NULL
  AND p.level > 0
  AND EXISTS (
    SELECT 1 FROM public.user_settings us
    WHERE us.user_id = p.id
    AND (us.privacy_mode = 'public' OR us.privacy_mode IS NULL)
  )
ORDER BY p.xp DESC
LIMIT 100; -- Sadece top 100

-- Leaderboard view'a erişim izni
GRANT SELECT ON public.leaderboard_stats TO anon;
GRANT SELECT ON public.leaderboard_stats TO authenticated;

COMMENT ON VIEW public.leaderboard_stats IS 'Public leaderboard showing top 100 users who opted-in to public visibility';

-- User settings tablosunda privacy mode varsayılan değerini güncelle
ALTER TABLE public.user_settings 
ALTER COLUMN privacy_mode SET DEFAULT 'public';

-- Mevcut kullanıcılar için default privacy ayarı ekle
INSERT INTO public.user_settings (user_id, privacy_mode)
SELECT p.id, 'public'
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_settings us WHERE us.user_id = p.id
)
ON CONFLICT (user_id) DO NOTHING;