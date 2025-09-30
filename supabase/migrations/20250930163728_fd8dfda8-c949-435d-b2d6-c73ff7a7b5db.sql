-- Fix security issue: Restrict users table access to prevent email harvesting
-- Users should only be able to view their own data

-- First, drop the existing overly permissive policy
DROP POLICY IF EXISTS "Users can view all users" ON public.users;

-- Create a new policy that only allows users to view their own data
-- This uses the email from the JWT token to match against the user's email
CREATE POLICY "Users can view own data only" 
ON public.users 
FOR SELECT 
USING (email = (auth.jwt() ->> 'email'::text));

-- Keep the existing INSERT policy as it's already properly restricted
-- Keep the existing UPDATE policy as it's already properly restricted

-- Create a public view for non-sensitive user information that can be displayed in the UI
-- This view excludes email addresses and only shows public-facing information
CREATE OR REPLACE VIEW public.public_users AS
SELECT 
  id,
  name,
  avatar_url,
  created_at
FROM public.users;

-- Grant access to the public view
GRANT SELECT ON public.public_users TO anon, authenticated;

-- Add comment to explain the security model
COMMENT ON VIEW public.public_users IS 'Public-facing user information view that excludes sensitive data like email addresses. Use this view when displaying user information in public contexts like posts, comments, or group members.';

COMMENT ON POLICY "Users can view own data only" ON public.users IS 'Security policy that prevents email harvesting by restricting users to only view their own data. This protects user privacy and prevents spam/phishing attacks.';