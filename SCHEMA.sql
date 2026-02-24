-- ============================================================
-- BloodSheet Golf — Supabase Postgres Schema
-- Run this entire file in: Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- ─── PROFILES (extends auth.users) ───────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id           UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name    TEXT NOT NULL DEFAULT '',
  avatar_url   TEXT,
  handicap     DECIMAL(4,1) NOT NULL DEFAULT 0.0,
  created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Auto-create a profile row whenever a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── COURSES (cached from RapidAPI) ──────────────────────────
CREATE TABLE IF NOT EXISTS public.courses (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  holes       JSONB NOT NULL DEFAULT '[]',
  cached_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ─── MATCHES ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.matches (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  join_code     TEXT UNIQUE,
  course_id     TEXT REFERENCES public.courses(id),
  format        TEXT NOT NULL CHECK (format IN ('1v1', '2v2')),
  wager_amount  INTEGER NOT NULL DEFAULT 10,
  wager_type    TEXT NOT NULL DEFAULT 'NASSAU' CHECK (wager_type IN ('PER_HOLE', 'NASSAU')),
  status        TEXT NOT NULL DEFAULT 'setup' CHECK (status IN ('setup', 'in_progress', 'completed')),
  side_bets     JSONB NOT NULL DEFAULT '{"greenies":true,"sandies":true,"snake":true,"autoPress":false,"trashValue":5}',
  created_by    UUID REFERENCES public.profiles(id),
  created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- If you already have a matches table, run this to add the column:
-- ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS join_code TEXT UNIQUE;

-- ─── MATCH PLAYERS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.match_players (
  match_id          UUID REFERENCES public.matches(id) ON DELETE CASCADE,
  user_id           UUID REFERENCES public.profiles(id),
  team              TEXT NOT NULL CHECK (team IN ('A', 'B')),
  initial_handicap  DECIMAL(4,1) NOT NULL DEFAULT 0.0,
  avatar_url        TEXT,
  PRIMARY KEY (match_id, user_id)
);

-- If you already have a match_players table, run this to add the column:
-- ALTER TABLE public.match_players ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- ─── HOLE SCORES ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hole_scores (
  match_id     UUID REFERENCES public.matches(id) ON DELETE CASCADE,
  hole_number  INTEGER NOT NULL CHECK (hole_number BETWEEN 1 AND 18),
  player_id    UUID REFERENCES public.profiles(id),
  gross        INTEGER NOT NULL DEFAULT 0,
  net          INTEGER NOT NULL DEFAULT 0,
  trash_dots   TEXT[] DEFAULT '{}',
  PRIMARY KEY (match_id, hole_number, player_id)
);

-- ─── PRESSES ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.presses (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id         UUID REFERENCES public.matches(id) ON DELETE CASCADE,
  start_hole       INTEGER NOT NULL,
  pressed_by_team  TEXT NOT NULL CHECK (pressed_by_team IN ('A', 'B')),
  status           TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  created_at       TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hole_scores  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presses      ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "Profiles viewable by authenticated users"
  ON public.profiles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Courses
CREATE POLICY "Courses viewable by all authenticated"
  ON public.courses FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can cache courses"
  ON public.courses FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update cached courses"
  ON public.courses FOR UPDATE USING (auth.role() = 'authenticated');

-- Matches
CREATE POLICY "Matches viewable by authenticated users"
  ON public.matches FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can create matches"
  ON public.matches FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Match creator can update match"
  ON public.matches FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "Match creator can delete match"
  ON public.matches FOR DELETE USING (auth.uid() = created_by);

-- Match Players
CREATE POLICY "Match players viewable by authenticated users"
  ON public.match_players FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can join matches"
  ON public.match_players FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Hole Scores
-- Any match participant can read/write any score in their match
-- (allows single-device score entry and the match creator to log all players)
CREATE POLICY "Hole scores viewable by authenticated users"
  ON public.hole_scores FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Match participants can insert scores"
  ON public.hole_scores FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM public.match_players WHERE match_id = hole_scores.match_id
    )
  );
CREATE POLICY "Match participants can update scores"
  ON public.hole_scores FOR UPDATE USING (
    auth.uid() IN (
      SELECT user_id FROM public.match_players WHERE match_id = hole_scores.match_id
    )
  );

-- Presses
CREATE POLICY "Presses viewable by authenticated users"
  ON public.presses FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Match players can initiate presses"
  ON public.presses FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ============================================================
-- REALTIME — enable live sync for core tables
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.hole_scores;
ALTER PUBLICATION supabase_realtime ADD TABLE public.presses;
ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
