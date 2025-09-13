-- Fix the SECURITY DEFINER view warning
-- Drop and recreate functions with proper search_path

-- First fix the handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
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

-- Fix the update_updated_at function
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER 
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;