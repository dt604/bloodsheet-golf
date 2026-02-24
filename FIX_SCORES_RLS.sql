-- RLS policies to allow the scorekeeper to insert/update scores for everyone in their match.
-- Run this in the Supabase Dashboard SQL Editor!

-- Drop any restrictive or incorrect older policies
DROP POLICY IF EXISTS "Users can insert their own scores" ON public.hole_scores;
DROP POLICY IF EXISTS "Users can update their own scores" ON public.hole_scores;
DROP POLICY IF EXISTS "Match participants can insert scores" ON public.hole_scores;
DROP POLICY IF EXISTS "Match participants can update scores" ON public.hole_scores;
DROP POLICY IF EXISTS "Match participants can read scores" ON public.hole_scores;

-- Create correct permissive policies
CREATE POLICY "Match participants can read scores"
  ON public.hole_scores FOR SELECT USING (
    auth.role() = 'authenticated'
  );

CREATE POLICY "Match participants can insert scores"
  ON public.hole_scores FOR INSERT WITH CHECK (
    auth.uid() IN (SELECT user_id FROM public.match_players WHERE match_id = hole_scores.match_id)
    OR auth.uid() IN (SELECT created_by FROM public.matches WHERE id = hole_scores.match_id)
  );

CREATE POLICY "Match participants can update scores"
  ON public.hole_scores FOR UPDATE USING (
    auth.uid() IN (SELECT user_id FROM public.match_players WHERE match_id = hole_scores.match_id)
    OR auth.uid() IN (SELECT created_by FROM public.matches WHERE id = hole_scores.match_id)
  );
