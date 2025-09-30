-- Fix function search path security warning
-- Update all user-defined functions to have explicit search_path

-- Update the update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

-- Update the award_xp function
CREATE OR REPLACE FUNCTION public.award_xp(p_user_id uuid, p_amount integer, p_type text, p_description text, p_metadata jsonb DEFAULT '{}'::jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
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
$function$;

-- Update the handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
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
$function$;

-- Update the update_updated_at function
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Update the update_leaderboard_entry function
CREATE OR REPLACE FUNCTION public.update_leaderboard_entry(p_user_id uuid, p_category text, p_period text, p_value numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
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
$function$;