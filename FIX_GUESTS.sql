ALTER TABLE public.match_players 
  DROP CONSTRAINT IF EXISTS match_players_user_id_fkey,
  ADD COLUMN IF NOT EXISTS guest_name TEXT;

ALTER TABLE public.hole_scores 
  DROP CONSTRAINT IF EXISTS hole_scores_player_id_fkey;
