-- Enable Realtime for users table
-- This file ensures that the users table publishes changes to realtime subscribers

-- Add the users table to the realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.users;

-- Ensure RLS is enabled
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first (if any)
DROP POLICY IF EXISTS "Users can see own data" ON public.users;
DROP POLICY IF EXISTS "Users can listen to own changes" ON public.users;

-- Create permissive policies for realtime (since we use Telegram auth, not Supabase auth)
CREATE POLICY "Allow realtime updates" ON public.users
  FOR ALL USING (true);

-- Allow realtime access for all (since we control access via Telegram auth)
CREATE POLICY "Allow realtime select" ON public.users
  FOR SELECT USING (true);

-- Grant realtime access
GRANT SELECT ON public.users TO anon;
GRANT SELECT ON public.users TO authenticated;

-- Ensure supabase_realtime_admin has access
GRANT ALL ON public.users TO supabase_realtime_admin;