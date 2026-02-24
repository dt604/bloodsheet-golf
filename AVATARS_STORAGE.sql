-- Run this in the Supabase Dashboard SQL Editor to set up Avatar uploads!

-- 1. Create a public bucket named 'avatars' (if it doesn't exist)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Drop existing policies to prevent conflicts if re-running
DROP POLICY IF EXISTS "Avatar images are publicly accessible." ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload an avatar." ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update an avatar." ON storage.objects;

-- 3. Set permissive access policies for the avatars bucket
CREATE POLICY "Avatar images are publicly accessible."
  ON storage.objects FOR SELECT
  USING ( bucket_id = 'avatars' );

CREATE POLICY "Anyone can upload an avatar."
  ON storage.objects FOR INSERT
  WITH CHECK ( bucket_id = 'avatars' AND auth.role() = 'authenticated' );

CREATE POLICY "Anyone can update an avatar."
  ON storage.objects FOR UPDATE
  USING ( bucket_id = 'avatars' AND auth.role() = 'authenticated' );
