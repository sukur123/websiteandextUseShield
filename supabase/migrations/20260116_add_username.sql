-- Add username column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text;

-- Optional: Add constraint for uniqueness if desired
-- ALTER TABLE public.profiles ADD CONSTRAINT profiles_username_key UNIQUE (username);
