-- ============================================================
-- BloodSheet Golf — Emoji Reactions Migration
-- Run this in Supabase SQL Editor AFTER SCHEMA_SOCIAL.sql
-- ============================================================

-- Add reaction_type column (existing rows default to 'heart')
ALTER TABLE public.feed_likes
  ADD COLUMN IF NOT EXISTS reaction_type TEXT DEFAULT 'heart' NOT NULL;

-- Allow users to update their own reaction (change emoji type)
CREATE POLICY "feed_likes_update"
  ON public.feed_likes FOR UPDATE
  USING (auth.uid() = user_id);
