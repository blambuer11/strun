-- Drop existing trigger to recreate it
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Recreate the handle_new_user function with better error handling
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
  -- Check if profile already exists to prevent duplicates
  IF EXISTS (SELECT 1 FROM public.profiles WHERE user_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  -- Generate unique referral code
  referral_code_val := UPPER(SUBSTRING(MD5(RANDOM()::TEXT || NOW()::TEXT), 1, 8));
  
  -- Get referral code from metadata if exists
  ref_code := NEW.raw_user_meta_data->>'referral_code';
  
  -- Find referrer if code provided
  IF ref_code IS NOT NULL THEN
    SELECT id INTO referrer_profile_id FROM public.profiles WHERE referral_code = ref_code;
  END IF;
  
  -- Insert profile with error handling
  BEGIN
    INSERT INTO public.profiles (
      user_id, 
      email, 
      username,
      referral_code,
      referred_by,
      level,
      xp,
      total_runs,
      total_distance,
      total_area,
      referral_count,
      referral_xp_earned
    )
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1)),
      referral_code_val,
      referrer_profile_id,
      1,
      CASE WHEN referrer_profile_id IS NOT NULL THEN 100 ELSE 0 END,
      0,
      0,
      0,
      0,
      0
    );
  EXCEPTION
    WHEN unique_violation THEN
      -- Profile already exists, ignore
      RETURN NEW;
    WHEN OTHERS THEN
      -- Log error but don't block user creation
      RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
      RETURN NEW;
  END;
  
  -- If referred, update referrer stats (non-blocking)
  IF referrer_profile_id IS NOT NULL THEN
    BEGIN
      -- Update referrer's count
      UPDATE public.profiles 
      SET referral_count = referral_count + 1,
          referral_xp_earned = referral_xp_earned + 500,
          xp = xp + 500
      WHERE id = referrer_profile_id;
      
      -- Log XP transaction for referrer
      INSERT INTO public.xp_transactions (user_id, amount, type, description)
      VALUES (referrer_profile_id, 500, 'referral', 'Referral bonus');
    EXCEPTION
      WHEN OTHERS THEN
        -- Don't block on referral updates
        NULL;
    END;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recreate trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Ensure the profiles table has proper RLS for inserts
DROP POLICY IF EXISTS "Anyone can insert profiles" ON public.profiles;

-- Create a more permissive insert policy that allows both users and the system
CREATE POLICY "Users and system can insert profiles"
ON public.profiles FOR INSERT
WITH CHECK (
  auth.uid() = user_id OR 
  auth.uid() IS NULL -- Allow system/trigger inserts
);