-- Update profiles table with additional fields
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS username TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS referral_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS referral_xp_earned INTEGER DEFAULT 0;

-- Create index for faster referral lookups
CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON public.profiles(referral_code);

-- Create storage bucket for avatars
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for avatars
CREATE POLICY "Avatar images are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = (
    SELECT id::text FROM profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own avatar" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = (
    SELECT id::text FROM profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their own avatar" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = (
    SELECT id::text FROM profiles WHERE user_id = auth.uid()
  )
);

-- Update handle_new_user function to include referral logic
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  referral_code_val TEXT;
  ref_code TEXT;
  referrer_profile_id UUID;
BEGIN
  -- Generate unique referral code
  referral_code_val := UPPER(SUBSTRING(MD5(RANDOM()::TEXT || NOW()::TEXT), 1, 8));
  
  -- Get referral code from metadata if exists
  ref_code := NEW.raw_user_meta_data->>'referral_code';
  
  -- Find referrer if code provided
  IF ref_code IS NOT NULL THEN
    SELECT id INTO referrer_profile_id FROM public.profiles WHERE referral_code = ref_code;
  END IF;
  
  -- Insert profile
  INSERT INTO public.profiles (
    user_id, 
    email, 
    username,
    referral_code,
    referred_by
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1)),
    referral_code_val,
    referrer_profile_id
  );
  
  -- If referred, update referrer stats and give XP bonus
  IF referrer_profile_id IS NOT NULL THEN
    -- Update referrer's count
    UPDATE public.profiles 
    SET referral_count = referral_count + 1,
        referral_xp_earned = referral_xp_earned + 500,
        xp = xp + 500
    WHERE id = referrer_profile_id;
    
    -- Log XP transaction for referrer
    INSERT INTO public.xp_transactions (user_id, amount, type, description)
    VALUES (referrer_profile_id, 500, 'referral', 'Referral bonus');
    
    -- Give new user bonus XP
    UPDATE public.profiles 
    SET xp = 100
    WHERE user_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Settings table for user preferences
CREATE TABLE IF NOT EXISTS public.user_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  notifications_enabled BOOLEAN DEFAULT true,
  location_sharing BOOLEAN DEFAULT true,
  health_integration_google BOOLEAN DEFAULT false,
  health_integration_apple BOOLEAN DEFAULT false,
  privacy_mode TEXT DEFAULT 'public' CHECK (privacy_mode IN ('public', 'friends', 'private')),
  language TEXT DEFAULT 'en',
  theme TEXT DEFAULT 'dark',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies for settings
CREATE POLICY "Users can view own settings" 
ON public.user_settings 
FOR SELECT 
USING (user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own settings" 
ON public.user_settings 
FOR INSERT 
WITH CHECK (user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own settings" 
ON public.user_settings 
FOR UPDATE 
USING (user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Create trigger for settings updated_at
CREATE TRIGGER update_user_settings_updated_at
BEFORE UPDATE ON public.user_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();