-- Enable uuid extension if needed
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Drop existing tables if they exist (for clean setup)
DROP TABLE IF EXISTS public.group_members CASCADE;
DROP TABLE IF EXISTS public.groups CASCADE;
DROP TABLE IF EXISTS public.posts CASCADE;
DROP TABLE IF EXISTS public.runs CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- Users (keyed by email)
CREATE TABLE public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  name text,
  avatar_url text,
  wallet text, -- Sui address
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Runs (one per saved run)
CREATE TABLE public.runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email text NOT NULL REFERENCES public.users(email) ON DELETE CASCADE,
  date date NOT NULL DEFAULT current_date,
  route jsonb NOT NULL, -- GeoJSON LineString coordinates
  polygon jsonb, -- buffered polygon GeoJSON
  bbox jsonb, -- { lonMin, latMin, lonMax, latMax }
  area_m2 numeric,
  walrus_cid text, -- optional: walrus content identifier
  nft_minted boolean DEFAULT false,
  nft_token_id text, -- optional: on chain token id
  created_at timestamptz DEFAULT now()
);

-- Posts
CREATE TABLE public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email text NOT NULL REFERENCES public.users(email) ON DELETE CASCADE,
  content text,
  run_id uuid REFERENCES public.runs(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Groups
CREATE TABLE public.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  location jsonb NOT NULL, -- { lng: number, lat: number }
  owner_email text NOT NULL REFERENCES public.users(email) ON DELETE CASCADE,
  image_walrus_cid text, -- optional group image
  created_at timestamptz DEFAULT now()
);

-- Group members
CREATE TABLE public.group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE,
  user_email text REFERENCES public.users(email) ON DELETE CASCADE,
  role text DEFAULT 'member',
  joined_at timestamptz DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX idx_runs_date ON public.runs(date);
CREATE INDEX idx_runs_user_email ON public.runs(user_email);
CREATE INDEX idx_posts_user_email ON public.posts(user_email);
CREATE INDEX idx_groups_owner_email ON public.groups(owner_email);
CREATE INDEX idx_group_members_user_email ON public.group_members(user_email);

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users
CREATE POLICY "Anyone can view users" 
ON public.users FOR SELECT 
USING (true);

CREATE POLICY "Users can insert own profile" 
ON public.users FOR INSERT 
WITH CHECK (email = (auth.jwt() ->> 'email'::text));

CREATE POLICY "Users can update own profile" 
ON public.users FOR UPDATE 
USING (email = (auth.jwt() ->> 'email'::text));

-- RLS Policies for runs
CREATE POLICY "Anyone can view runs" 
ON public.runs FOR SELECT 
USING (true);

CREATE POLICY "Users can create own runs" 
ON public.runs FOR INSERT 
WITH CHECK (user_email = (auth.jwt() ->> 'email'::text));

CREATE POLICY "Users can update own runs" 
ON public.runs FOR UPDATE 
USING (user_email = (auth.jwt() ->> 'email'::text));

-- RLS Policies for posts
CREATE POLICY "Anyone can view posts" 
ON public.posts FOR SELECT 
USING (true);

CREATE POLICY "Users can create own posts" 
ON public.posts FOR INSERT 
WITH CHECK (user_email = (auth.jwt() ->> 'email'::text));

CREATE POLICY "Users can update own posts" 
ON public.posts FOR UPDATE 
USING (user_email = (auth.jwt() ->> 'email'::text));

CREATE POLICY "Users can delete own posts" 
ON public.posts FOR DELETE 
USING (user_email = (auth.jwt() ->> 'email'::text));

-- RLS Policies for groups
CREATE POLICY "Anyone can view groups" 
ON public.groups FOR SELECT 
USING (true);

CREATE POLICY "Users can create groups" 
ON public.groups FOR INSERT 
WITH CHECK (owner_email = (auth.jwt() ->> 'email'::text));

CREATE POLICY "Users can update own groups" 
ON public.groups FOR UPDATE 
USING (owner_email = (auth.jwt() ->> 'email'::text));

-- RLS Policies for group_members
CREATE POLICY "Anyone can view group members" 
ON public.group_members FOR SELECT 
USING (true);

CREATE POLICY "Users can join groups" 
ON public.group_members FOR INSERT 
WITH CHECK (user_email = (auth.jwt() ->> 'email'::text));

CREATE POLICY "Users can leave groups" 
ON public.group_members FOR DELETE 
USING (user_email = (auth.jwt() ->> 'email'::text));