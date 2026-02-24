import { create } from 'zustand';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Match, MatchPlayer, HoleScore, Press, Course } from '../types';

// ─── helpers: snake_case DB ↔ camelCase TS ────────────────────

function genJoinCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function dbToMatch(row: Record<string, unknown>): Match {
  return {
    id: row.id as string,
    joinCode: (row.join_code as string | null) ?? undefined,
    courseId: row.course_id as string,
    format: row.format as Match['format'],
    wagerAmount: row.wager_amount as number,
    wagerType: row.wager_type as Match['wagerType'],
    status: row.status as Match['status'],
    sideBets: row.side_bets as Match['sideBets'],
    createdBy: row.created_by as string,
  };
}

function dbToPlayer(row: Record<string, unknown>): MatchPlayer {
  const p: MatchPlayer = {
    userId: row.user_id as string,
    team: row.team as 'A' | 'B',
    initialHandicap: row.initial_handicap as number,
  };
  if (row.guest_name) p.guestName = row.guest_name as string;
  return p;
}

function dbToScore(row: Record<string, unknown>): HoleScore {
  return {
    matchId: row.match_id as string,
    holeNumber: row.hole_number as number,
    playerId: row.player_id as string,
    gross: row.gross as number,
    net: row.net as number,
    trashDots: (row.trash_dots as string[]) ?? [],
  };
}

function dbToPress(row: Record<string, unknown>): Press {
  return {
    id: row.id as string,
    matchId: row.match_id as string,
    startHole: row.start_hole as number,
    pressedByTeam: row.pressed_by_team as 'A' | 'B',
    status: row.status as Press['status'],
  };
}

// ─── Store ────────────────────────────────────────────────────

interface StagedPlayer {
  userId: string;
  fullName: string;
  handicap: number;
  team: 'A' | 'B';
  isGuest?: boolean;
  avatarUrl?: string;
}

interface MatchStoreState {
  matchId: string | null;
  match: Match | null;
  course: Course | null;
  players: MatchPlayer[];
  scores: HoleScore[];
  presses: Press[];
  loading: boolean;
  error: string | null;
  _channel: RealtimeChannel | null;

  // Persisted setup state (survives navigate-away to AddPlayer and back)
  pendingFormat: '1v1' | '2v2';
  setPendingFormat: (format: '1v1' | '2v2') => void;

  // Staged before match is created — set by AddPlayer, flushed in createMatch
  stagedPlayers: StagedPlayer[];
  stagePlayer: (player: StagedPlayer) => void;
  removeStagedPlayer: (userId: string) => void;

  createMatch: (
    matchData: Omit<Match, 'id'>,
    course: Course,
    createdBy: string
  ) => Promise<string>;

  loadMatch: (matchId: string) => Promise<void>;

  addPlayerToMatch: (matchId: string, player: MatchPlayer) => Promise<void>;

  saveScore: (score: HoleScore) => Promise<void>;

  initiatePress: (press: Omit<Press, 'id'>) => Promise<void>;

  completeMatch: (matchId: string) => Promise<void>;

  // Refresh only scores + presses — does NOT touch the subscription channel
  refreshScores: (matchId: string) => Promise<void>;

  subscribeToMatch: (matchId: string) => void;

  unsubscribe: () => void;

  clearMatch: () => void;
}

export const useMatchStore = create<MatchStoreState>((set, get) => ({
  matchId: localStorage.getItem('activeMatchId'),
  match: null,
  course: null,
  players: [],
  scores: [],
  presses: [],
  loading: false,
  error: null,
  _channel: null,
  pendingFormat: '1v1',
  stagedPlayers: [],

  setPendingFormat(format) {
    set({ pendingFormat: format });
  },

  stagePlayer(player) {
    set((state) => {
      // Replace if same userId already staged (e.g. re-selecting), otherwise append
      const filtered = state.stagedPlayers.filter((p) => p.userId !== player.userId);
      return { stagedPlayers: [...filtered, player] };
    });
  },

  removeStagedPlayer(userId) {
    set((state) => ({ stagedPlayers: state.stagedPlayers.filter((p) => p.userId !== userId) }));
  },

  // ── Create a new match row in Supabase ──────────────────────
  async createMatch(matchData, course, createdBy) {
    set({ loading: true, error: null });

    // Upsert course cache
    await supabase.from('courses').upsert({
      id: course.id,
      name: course.name,
      holes: course.holes,
    });

    const joinCode = genJoinCode();

    const { data, error } = await supabase
      .from('matches')
      .insert({
        join_code: joinCode,
        course_id: course.id,
        format: matchData.format,
        wager_amount: matchData.wagerAmount,
        wager_type: matchData.wagerType,
        status: 'in_progress',
        side_bets: matchData.sideBets,
        created_by: createdBy,
      })
      .select()
      .single();

    if (error || !data) {
      set({ loading: false, error: error?.message ?? 'Failed to create match' });
      throw new Error(error?.message ?? 'Failed to create match');
    }

    const match = dbToMatch(data as Record<string, unknown>);
    localStorage.setItem('activeMatchId', match.id);

    // Fetch creator's handicap for accurate initial_handicap
    const { data: creatorProfile } = await supabase
      .from('profiles')
      .select('handicap')
      .eq('id', createdBy)
      .single();
    const creatorHandicap = (creatorProfile as { handicap: number } | null)?.handicap ?? 0;

    // Add the creator as Team A player
    await supabase.from('match_players').insert({
      match_id: match.id,
      user_id: createdBy,
      team: 'A',
      initial_handicap: creatorHandicap,
    });

    const creatorPlayer: MatchPlayer = {
      userId: createdBy,
      team: 'A',
      initialHandicap: creatorHandicap,
    };

    const allPlayers: MatchPlayer[] = [creatorPlayer];

    // Flush all staged players (teammates + opponents)
    const staged = get().stagedPlayers;
    for (const sp of staged) {
      await supabase.from('match_players').insert({
        match_id: match.id,
        user_id: sp.userId,
        team: sp.team,
        initial_handicap: sp.handicap,
        guest_name: sp.isGuest ? sp.fullName : null,
      });

      allPlayers.push({
        userId: sp.userId,
        team: sp.team,
        initialHandicap: sp.handicap,
        ...(sp.isGuest ? { guestName: sp.fullName } : {}),
      });
    }

    set({
      matchId: match.id,
      match,
      course,
      players: allPlayers,
      scores: [],
      presses: [],
      stagedPlayers: [],
      loading: false,
    });

    get().subscribeToMatch(match.id);
    return match.id;
  },

  // ── Load an existing match with all related data ────────────
  async loadMatch(matchId) {
    set({ loading: true, error: null });

    const [matchRes, playersRes, scoresRes, pressesRes] = await Promise.all([
      supabase.from('matches').select('*, courses(*)').eq('id', matchId).single(),
      supabase.from('match_players').select('*').eq('match_id', matchId),
      supabase.from('hole_scores').select('*').eq('match_id', matchId),
      supabase.from('presses').select('*').eq('match_id', matchId),
    ]);

    if (matchRes.error || !matchRes.data) {
      set({ loading: false, error: 'Match not found' });
      return;
    }

    const row = matchRes.data as Record<string, unknown>;
    const courseRow = row.courses as Record<string, unknown> | null;

    const match = dbToMatch(row);
    const course: Course | null = courseRow
      ? { id: courseRow.id as string, name: courseRow.name as string, holes: courseRow.holes as Course['holes'] }
      : null;

    set({
      matchId,
      match,
      course,
      players: (playersRes.data ?? []).map(dbToPlayer),
      scores: (scoresRes.data ?? []).map(dbToScore),
      presses: (pressesRes.data ?? []).map(dbToPress),
      loading: false,
    });

    get().subscribeToMatch(matchId);
  },

  // ── Add a player to the match ───────────────────────────────
  async addPlayerToMatch(matchId, player) {
    const { error } = await supabase.from('match_players').insert({
      match_id: matchId,
      user_id: player.userId,
      team: player.team,
      initial_handicap: player.initialHandicap,
    });

    if (!error) {
      set((state) => ({ players: [...state.players, player] }));
    }
  },

  // ── Save / update a hole score ──────────────────────────────
  async saveScore(score) {
    // Always update local state immediately (optimistic)
    set((state) => {
      const idx = state.scores.findIndex(
        (s) => s.holeNumber === score.holeNumber && s.playerId === score.playerId
      );
      if (idx >= 0) {
        const updated = [...state.scores];
        updated[idx] = score;
        return { scores: updated };
      }
      return { scores: [...state.scores, score] };
    });

    // Always write scores to the DB. Guests are now supported in the schema.
    const { error } = await supabase.from('hole_scores').upsert({
      match_id: score.matchId,
      hole_number: score.holeNumber,
      player_id: score.playerId,
      gross: score.gross,
      net: score.net,
      trash_dots: score.trashDots,
    });
    if (error) console.error('[saveScore] DB error:', error.message, score);
  },

  // ── Initiate a press ────────────────────────────────────────
  async initiatePress(press) {
    const { data, error } = await supabase
      .from('presses')
      .insert({
        match_id: press.matchId,
        start_hole: press.startHole,
        pressed_by_team: press.pressedByTeam,
        status: 'active',
      })
      .select()
      .single();

    if (!error && data) {
      set((state) => ({
        presses: [...state.presses, dbToPress(data as Record<string, unknown>)],
      }));
    }
  },

  // ── Mark match completed ────────────────────────────────────
  async completeMatch(matchId) {
    await supabase.from('matches').update({ status: 'completed' }).eq('id', matchId);
    set((state) => ({
      match: state.match ? { ...state.match, status: 'completed' } : null,
    }));
    localStorage.removeItem('activeMatchId');
  },

  // ── Refresh scores + presses only (no subscription teardown) ─
  async refreshScores(matchId) {
    const [scoresRes, pressesRes] = await Promise.all([
      supabase.from('hole_scores').select('*').eq('match_id', matchId),
      supabase.from('presses').select('*').eq('match_id', matchId),
    ]);
    set({
      scores: (scoresRes.data ?? []).map(dbToScore),
      presses: (pressesRes.data ?? []).map(dbToPress),
    });
  },

  // ── Real-time subscription ──────────────────────────────────
  subscribeToMatch(matchId) {
    const existing = get()._channel;
    if (existing) existing.unsubscribe();

    const channel = supabase
      .channel(`match-${matchId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'hole_scores', filter: `match_id=eq.${matchId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') return;
          const score = dbToScore(payload.new as Record<string, unknown>);
          set((state) => {
            const idx = state.scores.findIndex(
              (s) => s.holeNumber === score.holeNumber && s.playerId === score.playerId
            );
            if (idx >= 0) {
              const updated = [...state.scores];
              updated[idx] = score;
              return { scores: updated };
            }
            return { scores: [...state.scores, score] };
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'presses', filter: `match_id=eq.${matchId}` },
        (payload) => {
          const press = dbToPress(payload.new as Record<string, unknown>);
          set((state) => {
            if (state.presses.find((p) => p.id === press.id)) return state;
            return { presses: [...state.presses, press] };
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${matchId}` },
        (payload) => {
          set({ match: dbToMatch(payload.new as Record<string, unknown>) });
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] Subscribed to match', matchId);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('[Realtime] Subscription issue, retrying…', status, err);
          // Back off and reconnect
          setTimeout(() => {
            if (get().matchId === matchId) get().subscribeToMatch(matchId);
          }, 3000);
        }
      });

    set({ _channel: channel });
  },

  unsubscribe() {
    const channel = get()._channel;
    if (channel) {
      channel.unsubscribe();
      set({ _channel: null });
    }
  },

  clearMatch() {
    get().unsubscribe();
    localStorage.removeItem('activeMatchId');
    set({
      matchId: null,
      match: null,
      course: null,
      players: [],
      scores: [],
      presses: [],
      error: null,
      _channel: null,
      stagedPlayers: [],
      pendingFormat: '1v1',
    });
  },
}));
