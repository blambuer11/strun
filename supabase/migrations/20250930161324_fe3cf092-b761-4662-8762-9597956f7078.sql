-- Drop existing tables if they exist (for clean migration)
DROP TABLE IF EXISTS group_members CASCADE;
DROP TABLE IF EXISTS groups CASCADE;
DROP TABLE IF EXISTS posts CASCADE;
DROP TABLE IF EXISTS runs CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Users table (separate from profiles for clean structure)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  wallet TEXT,
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Runs table for tracking running sessions
CREATE TABLE runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  route JSONB NOT NULL, -- GeoJSON LineString
  area NUMERIC,
  distance NUMERIC,
  duration INTEGER, -- seconds
  avg_pace NUMERIC,
  calories_burned INTEGER,
  xp_earned INTEGER DEFAULT 0,
  nft_minted BOOLEAN DEFAULT FALSE,
  nft_metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Posts table for community feed
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  run_id UUID REFERENCES runs(id) ON DELETE SET NULL,
  image_url TEXT,
  likes_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Groups table
CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  location JSONB, -- {lat, lng}
  avatar_url TEXT,
  created_by UUID REFERENCES users(id) ON DELETE CASCADE,
  is_public BOOLEAN DEFAULT TRUE,
  max_members INTEGER DEFAULT 50,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Group members junction table
CREATE TABLE group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member', -- 'admin', 'member'
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users
CREATE POLICY "Users can view all users" ON users
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid()::text = wallet OR email = auth.jwt()->>'email');

CREATE POLICY "Users can insert own profile" ON users
  FOR INSERT WITH CHECK (email = auth.jwt()->>'email');

-- RLS Policies for runs
CREATE POLICY "Users can view all runs" ON runs
  FOR SELECT USING (true);

CREATE POLICY "Users can create own runs" ON runs
  FOR INSERT WITH CHECK (user_id IN (
    SELECT id FROM users WHERE email = auth.jwt()->>'email'
  ));

CREATE POLICY "Users can update own runs" ON runs
  FOR UPDATE USING (user_id IN (
    SELECT id FROM users WHERE email = auth.jwt()->>'email'
  ));

-- RLS Policies for posts
CREATE POLICY "Anyone can view posts" ON posts
  FOR SELECT USING (true);

CREATE POLICY "Users can create own posts" ON posts
  FOR INSERT WITH CHECK (user_id IN (
    SELECT id FROM users WHERE email = auth.jwt()->>'email'
  ));

CREATE POLICY "Users can update own posts" ON posts
  FOR UPDATE USING (user_id IN (
    SELECT id FROM users WHERE email = auth.jwt()->>'email'
  ));

CREATE POLICY "Users can delete own posts" ON posts
  FOR DELETE USING (user_id IN (
    SELECT id FROM users WHERE email = auth.jwt()->>'email'
  ));

-- RLS Policies for groups
CREATE POLICY "Anyone can view public groups" ON groups
  FOR SELECT USING (is_public = true);

CREATE POLICY "Users can create groups" ON groups
  FOR INSERT WITH CHECK (created_by IN (
    SELECT id FROM users WHERE email = auth.jwt()->>'email'
  ));

CREATE POLICY "Group creators can update their groups" ON groups
  FOR UPDATE USING (created_by IN (
    SELECT id FROM users WHERE email = auth.jwt()->>'email'
  ));

-- RLS Policies for group_members
CREATE POLICY "Anyone can view group members" ON group_members
  FOR SELECT USING (true);

CREATE POLICY "Users can join groups" ON group_members
  FOR INSERT WITH CHECK (user_id IN (
    SELECT id FROM users WHERE email = auth.jwt()->>'email'
  ));

CREATE POLICY "Users can leave groups" ON group_members
  FOR DELETE USING (user_id IN (
    SELECT id FROM users WHERE email = auth.jwt()->>'email'
  ));

-- Create indexes for performance
CREATE INDEX idx_runs_user_id ON runs(user_id);
CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_posts_run_id ON posts(run_id);
CREATE INDEX idx_groups_created_by ON groups(created_by);
CREATE INDEX idx_group_members_group_id ON group_members(group_id);
CREATE INDEX idx_group_members_user_id ON group_members(user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for users table
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();