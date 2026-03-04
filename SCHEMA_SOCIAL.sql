-- ============================================================
-- BloodSheet Golf — Social Features Schema
-- Run this in Supabase SQL Editor after SCHEMA.sql
-- ============================================================

-- ─── FEED LIKES ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.feed_likes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_item_id TEXT NOT NULL,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (feed_item_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_feed_likes_item ON public.feed_likes(feed_item_id);
CREATE INDEX IF NOT EXISTS idx_feed_likes_user ON public.feed_likes(user_id);

-- ─── FEED COMMENTS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.feed_comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_item_id TEXT NOT NULL,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body        TEXT NOT NULL CHECK (char_length(body) <= 500),
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_feed_comments_item ON public.feed_comments(feed_item_id);

-- ─── RLS ────────────────────────────────────────────────────
ALTER TABLE public.feed_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feed_likes_select"
  ON public.feed_likes FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "feed_likes_insert"
  ON public.feed_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "feed_likes_delete"
  ON public.feed_likes FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "feed_comments_select"
  ON public.feed_comments FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "feed_comments_insert"
  ON public.feed_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "feed_comments_delete"
  ON public.feed_comments FOR DELETE
  USING (auth.uid() = user_id);

-- ─── REALTIME ───────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.feed_likes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.feed_comments;
