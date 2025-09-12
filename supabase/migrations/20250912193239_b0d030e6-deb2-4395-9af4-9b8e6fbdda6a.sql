-- Create user profiles table with enhanced fields
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL,
  email TEXT NOT NULL,
  username TEXT NOT NULL,
  wallet_address TEXT,
  avatar_url TEXT,
  xp INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  total_distance BIGINT DEFAULT 0,
  total_area NUMERIC DEFAULT 0,
  total_runs INTEGER DEFAULT 0,
  referral_code TEXT UNIQUE,
  referred_by UUID,
  referral_count INTEGER DEFAULT 0,
  referral_xp_earned INTEGER DEFAULT 0,
  country TEXT DEFAULT 'Unknown',
  country_code TEXT DEFAULT 'XX',
  city TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own profile" 
ON public.profiles FOR SELECT 
USING (user_id = auth.uid() OR true); -- Public profiles for leaderboard

CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE 
USING (user_id = auth.uid());

CREATE POLICY "Users can insert own profile" 
ON public.profiles FOR INSERT 
WITH CHECK (user_id = auth.uid());

-- Create groups table
CREATE TABLE IF NOT EXISTS public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  country TEXT NOT NULL,
  city TEXT NOT NULL,
  running_area TEXT,
  max_members INTEGER DEFAULT 50,
  current_members INTEGER DEFAULT 0,
  total_distance BIGINT DEFAULT 0,
  weekly_goal INTEGER DEFAULT 100000, -- in meters
  creator_id UUID NOT NULL,
  avatar_url TEXT,
  is_public BOOLEAN DEFAULT true,
  join_code TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS for groups
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

-- Groups policies
CREATE POLICY "Groups are viewable by everyone" 
ON public.groups FOR SELECT 
USING (true);

CREATE POLICY "Users can create groups" 
ON public.groups FOR INSERT 
WITH CHECK (creator_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Group creators can update their groups" 
ON public.groups FOR UPDATE 
USING (creator_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Create group members table
CREATE TABLE IF NOT EXISTS public.group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT DEFAULT 'member', -- member, moderator, admin
  weekly_distance INTEGER DEFAULT 0,
  total_contribution INTEGER DEFAULT 0,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS for group members
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

-- Group members policies
CREATE POLICY "Members can view group members" 
ON public.group_members FOR SELECT 
USING (true);

CREATE POLICY "Users can join groups" 
ON public.group_members FOR INSERT 
WITH CHECK (user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can leave groups" 
ON public.group_members FOR DELETE 
USING (user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Create XP transactions table
CREATE TABLE IF NOT EXISTS public.xp_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL, -- run, territory, referral, challenge, bonus
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS for XP transactions
ALTER TABLE public.xp_transactions ENABLE ROW LEVEL SECURITY;

-- XP transactions policies
CREATE POLICY "Users can view own XP transactions" 
ON public.xp_transactions FOR SELECT 
USING (user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "System can create XP transactions" 
ON public.xp_transactions FOR INSERT 
WITH CHECK (true);

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  referral_code_val TEXT;
BEGIN
  -- Generate unique referral code
  referral_code_val := UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 8));
  
  INSERT INTO public.profiles (
    user_id, 
    email, 
    username,
    referral_code
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1)),
    referral_code_val
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_groups_updated_at BEFORE UPDATE ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON public.profiles(referral_code);
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON public.group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON public.group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_xp_transactions_user_id ON public.xp_transactions(user_id);