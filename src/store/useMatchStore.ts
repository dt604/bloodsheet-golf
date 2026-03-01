import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { Match, MatchAttestation, MatchPlayer, HoleScore, Press, Course, PoolPlayer, MatchSlot, GroupMatchEntry, GroupState } from '../types';

// ─── helpers: snake_case DB ↔ camelCase TS ────────────────────

function genJoinCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function genId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
}

function dbToMatch(row: Record<string, unknown>): Match {
  return {
    id: row.id as string,
    joinCode: (row.join_code as string | null) ?? undefined,
    courseId: row.course_id as string,
    groupId: (row.group_id as string | null) ?? undefined,
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
  attestations: MatchAttestation[];
  loading: boolean;
  error: string | null;
  _channel: any | null; // Keep a ref to the real-time channel

  // Persisted setup state (survives navigate-away to AddPlayer and back)
  pendingFormat: '1v1' | '2v2' | 'skins';
  currentStep: number;
  lastScoreUpdate: { playerId: string; holeNumber: number; timestamp: number } | null;

  // Actions
  setPendingFormat: (fmt: '1v1' | '2v2' | 'skins') => void;
  setCurrentStep: (step: number) => void;

  // Staged before match is created — set by AddPlayer, flushed in createMatch (2v2)
  stagedPlayers: StagedPlayer[];
  stagePlayer: (player: StagedPlayer) => void;
  removeStagedPlayer: (userId: string) => void;
  updateStagedPlayerHandicap: (userId: string, handicap: number) => void;
  updateStagedPlayerTeam: (userId: string, team: 'A' | 'B') => void;

  // ── Multi-match 1v1 group state ──────────────────────────────
  // Pool of all players in today's group (set during setup, cleared after createMatchGroup)
  poolPlayers: PoolPlayer[];
  // Up to 5 match pairings; each is creator vs one pool player
  matchSlots: MatchSlot[];
  // Set after createMatchGroup; null in single-match / 2v2 mode
  groupState: GroupState | null;
  // Convenience array of all matchIds in the active group ([] when single match)
  activeMatchIds: string[];

  addPoolPlayer: (player: PoolPlayer) => void;
  removePoolPlayer: (userId: string) => void;
  updatePoolPlayerHandicap: (userId: string, handicap: number) => void;
  addMatchSlot: (defaultWager: number) => void;
  removeMatchSlot: (slotId: string) => void;
  setSlotPlayer1: (slotId: string, player1Id: string | null) => void;
  setSlotOpponent: (slotId: string, opponentId: string | null) => void;
  setSlotWager: (slotId: string, wager: number) => void;
  createMatchGroup: (
    sharedData: { courseId: string; wagerType: 'NASSAU'; status: 'in_progress'; sideBets: Match['sideBets']; createdBy: string },
    course: Course,
    createdBy: string,
    creatorHcp: number
  ) => Promise<void>;
  createSkinsMatch: (
    sharedData: { courseId: string; wagerAmount: number; status: 'in_progress'; sideBets: Match['sideBets']; createdBy: string },
    course: Course,
    createdBy: string,
    creatorHcp: number
  ) => Promise<void>;
  refreshGroupScores: () => Promise<void>;
  // ─────────────────────────────────────────────────────────────

  createMatch: (
    matchData: Omit<Match, 'id'>,
    course: Course,
    createdBy: string,
    creatorHandicapOverride?: number
  ) => Promise<string>;

  loadMatch: (matchId: string) => Promise<void>;

  addPlayerToMatch: (matchId: string, player: MatchPlayer) => Promise<void>;

  saveScore: (score: HoleScore) => Promise<void>;

  initiatePress: (press: Omit<Press, 'id'>) => Promise<void>;

  completeMatch: (matchId: string) => Promise<void>;

  // ── Attestation actions ───────────────────────────────────────
  submitForAttestation: (matchId: string) => Promise<void>;
  attestMatch: (matchId: string) => Promise<void>;
  loadAttestations: (matchId: string) => Promise<void>;
  sendReminder: (matchId: string, targetUserId: string) => void;
  // ─────────────────────────────────────────────────────────────

  deleteMatch: (matchId: string) => Promise<void>;

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
  attestations: [],
  loading: false,
  error: null,
  _channel: null,
  pendingFormat: '1v1',
  lastScoreUpdate: null,
  stagedPlayers: [],
  poolPlayers: [],
  matchSlots: [{ id: genId(), player1Id: null, opponentId: null, wager: 10 }],
  groupState: null,
  activeMatchIds: [],
  currentStep: 1,

  setPendingFormat: (fmt) => set({
    pendingFormat: fmt,
    currentStep: 2, // Auto-advance to Players step after format selection
    // Clear opposing-mode staging when switching formats
    ...(fmt === '2v2'
      ? { poolPlayers: [], matchSlots: [{ id: genId(), player1Id: null, opponentId: null, wager: 10 }] }
      : { stagedPlayers: [] }
    ),
  }),

  setCurrentStep: (step) => set({ currentStep: step }),

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

  updateStagedPlayerHandicap(userId, handicap) {
    set((state) => ({
      stagedPlayers: state.stagedPlayers.map((p) =>
        p.userId === userId ? { ...p, handicap } : p
      ),
    }));
  },

  updateStagedPlayerTeam(userId, team) {
    set((state) => ({
      stagedPlayers: state.stagedPlayers.map((p) =>
        p.userId === userId ? { ...p, team } : p
      ),
    }));
  },

  // ── Player pool actions (1v1 multi-match setup) ─────────────
  addPoolPlayer(player) {
    set((state) => {
      const filtered = state.poolPlayers.filter((p) => p.userId !== player.userId);
      return { poolPlayers: [...filtered, player] };
    });
  },

  removePoolPlayer(userId) {
    set((state) => ({
      poolPlayers: state.poolPlayers.filter((p) => p.userId !== userId),
      // Also clear any slot that referenced this player
      matchSlots: state.matchSlots.map((s) =>
        s.opponentId === userId ? { ...s, opponentId: null } : s
      ),
    }));
  },

  updatePoolPlayerHandicap(userId, handicap) {
    set((state) => ({
      poolPlayers: state.poolPlayers.map((p) =>
        p.userId === userId ? { ...p, handicap } : p
      ),
    }));
  },

  addMatchSlot(defaultWager) {
    set((state) => {
      if (state.matchSlots.length >= 5) return state;
      return { matchSlots: [...state.matchSlots, { id: genId(), player1Id: null, opponentId: null, wager: defaultWager }] };
    });
  },

  removeMatchSlot(slotId) {
    set((state) => ({
      matchSlots: state.matchSlots.filter((s) => s.id !== slotId),
    }));
  },

  setSlotPlayer1(slotId, player1Id) {
    set((state) => ({
      matchSlots: state.matchSlots.map((s) =>
        s.id === slotId ? { ...s, player1Id } : s
      ),
    }));
  },

  setSlotOpponent(slotId, opponentId) {
    set((state) => ({
      matchSlots: state.matchSlots.map((s) =>
        s.id === slotId ? { ...s, opponentId } : s
      ),
    }));
  },

  setSlotWager(slotId, wager) {
    set((state) => ({
      matchSlots: state.matchSlots.map((s) =>
        s.id === slotId ? { ...s, wager } : s
      ),
    }));
  },

  // ── Create a group of 1v1 matches sharing course/side-bets ──
  async createMatchGroup(sharedData, course, createdBy, creatorHcp) {
    const { matchSlots, poolPlayers } = get();
    const validSlots = matchSlots.filter((s) => s.opponentId !== null);
    if (validSlots.length === 0) throw new Error('Select at least one opponent');

    set({ loading: true, error: null });

    // Upsert course cache
    await supabase.from('courses').upsert({
      id: course.id,
      name: course.name,
      holes: course.holes,
    });

    const groupId = genId();
    const createdEntries: GroupMatchEntry[] = [];

    for (const slot of validSlots) {
      const opponent = poolPlayers.find((p) => p.userId === slot.opponentId);
      if (!opponent) continue;

      // Resolve player 1: null means the creator
      const p1IsCreator = !slot.player1Id || slot.player1Id === createdBy;
      const p1Pool = p1IsCreator ? null : poolPlayers.find((p) => p.userId === slot.player1Id);
      const p1Id = p1IsCreator ? createdBy : (p1Pool?.userId ?? createdBy);
      const p1Hcp = p1IsCreator ? creatorHcp : (p1Pool?.handicap ?? 0);
      const p1IsGuest = !p1IsCreator && (p1Pool?.isGuest ?? false);
      const p1AvatarUrl = !p1IsCreator ? (p1Pool?.avatarUrl ?? null) : null;
      const p1GuestName = p1IsGuest ? (p1Pool?.fullName ?? null) : null;

      const { data, error } = await supabase
        .from('matches')
        .insert({
          join_code: genJoinCode(),
          course_id: course.id,
          format: '1v1',
          wager_amount: slot.wager,
          wager_type: sharedData.wagerType,
          status: 'in_progress',
          side_bets: sharedData.sideBets,
          created_by: createdBy,
          group_id: groupId,
        })
        .select()
        .single();

      if (error || !data) continue;

      const match = dbToMatch(data as Record<string, unknown>);

      await supabase.from('match_players').insert({
        match_id: match.id,
        user_id: p1Id,
        team: 'A',
        initial_handicap: p1Hcp,
        guest_name: p1GuestName,
        avatar_url: p1AvatarUrl,
      });

      await supabase.from('match_players').insert({
        match_id: match.id,
        user_id: opponent.userId,
        team: 'B',
        initial_handicap: opponent.handicap,
        guest_name: opponent.isGuest ? opponent.fullName : null,
        avatar_url: opponent.avatarUrl ?? null,
      });

      const creatorPlayer: MatchPlayer = {
        userId: p1Id,
        team: 'A',
        initialHandicap: p1Hcp,
        ...(p1IsGuest && p1GuestName ? { guestName: p1GuestName } : {}),
        ...(p1AvatarUrl ? { avatarUrl: p1AvatarUrl } : {}),
      };
      const opponentPlayer: MatchPlayer = {
        userId: opponent.userId,
        team: 'B',
        initialHandicap: opponent.handicap,
        ...(opponent.isGuest ? { guestName: opponent.fullName } : {}),
        ...(opponent.avatarUrl ? { avatarUrl: opponent.avatarUrl } : {}),
      };

      createdEntries.push({
        matchId: match.id,
        match,
        players: [creatorPlayer, opponentPlayer],
        scores: [],
        presses: [],
      });
    }

    if (createdEntries.length === 0) {
      set({ loading: false, error: 'Failed to create any matches' });
      throw new Error('Failed to create any matches');
    }

    const primary = createdEntries[0];
    const allMatchIds = createdEntries.map((e) => e.matchId);

    // Build union of unique pool players for state.players
    const seenIds = new Set<string>();
    const allPlayers: MatchPlayer[] = [];
    for (const entry of createdEntries) {
      for (const p of entry.players) {
        if (!seenIds.has(p.userId)) {
          seenIds.add(p.userId);
          allPlayers.push(p);
        }
      }
    }

    localStorage.setItem('activeMatchId', primary.matchId);

    set({
      matchId: primary.matchId,
      match: primary.match,
      course,
      players: allPlayers,
      scores: [],
      presses: [],
      activeMatchIds: allMatchIds,
      groupState: { groupId, matches: createdEntries },
      poolPlayers: [],
      matchSlots: [{ id: genId(), player1Id: null, opponentId: null, wager: 10 }],
      loading: false,
    });

    get().subscribeToMatch(primary.matchId);
  },

  // ── Create a single skins match with 2-4 individual players ─
  async createSkinsMatch(sharedData, course, createdBy, creatorHcp) {
    const { poolPlayers } = get();
    if (poolPlayers.length < 1) throw new Error('Add at least one other player');

    set({ loading: true, error: null });

    await supabase.from('courses').upsert({
      id: course.id,
      name: course.name,
      holes: course.holes,
    });

    const { data, error } = await supabase
      .from('matches')
      .insert({
        join_code: genJoinCode(),
        course_id: course.id,
        format: 'skins',
        wager_amount: sharedData.wagerAmount,
        wager_type: 'NASSAU', // sentinel; skins logic is driven by format
        status: 'in_progress',
        side_bets: sharedData.sideBets,
        created_by: createdBy,
        group_id: null,
      })
      .select()
      .single();

    if (error || !data) {
      set({ loading: false, error: error?.message ?? 'Failed to create skins match' });
      throw new Error(error?.message ?? 'Failed to create skins match');
    }

    const match = dbToMatch(data as Record<string, unknown>);
    localStorage.setItem('activeMatchId', match.id);

    // Creator — team 'A' (all skins players share team 'A' to satisfy DB constraint)
    await supabase.from('match_players').insert({
      match_id: match.id,
      user_id: createdBy,
      team: 'A',
      initial_handicap: creatorHcp,
    });

    const allPlayers: MatchPlayer[] = [{
      userId: createdBy,
      team: 'A',
      initialHandicap: creatorHcp,
    }];

    // Remaining players from pool
    for (const p of poolPlayers) {
      await supabase.from('match_players').insert({
        match_id: match.id,
        user_id: p.userId,
        team: 'A',
        initial_handicap: p.handicap,
        guest_name: p.isGuest ? p.fullName : null,
        avatar_url: p.avatarUrl ?? null,
      });
      allPlayers.push({
        userId: p.userId,
        team: 'A',
        initialHandicap: p.handicap,
        ...(p.isGuest ? { guestName: p.fullName } : {}),
        ...(p.avatarUrl ? { avatarUrl: p.avatarUrl } : {}),
      });
    }

    set({
      matchId: match.id,
      match,
      course,
      players: allPlayers,
      scores: [],
      presses: [],
      activeMatchIds: [match.id],
      groupState: null,
      poolPlayers: [],
      loading: false,
    });

    get().subscribeToMatch(match.id);
  },

  // ── Refresh scores + presses for all matches in the group ───
  async refreshGroupScores() {
    const { groupState } = get();
    if (!groupState) return;

    const results = await Promise.all(
      groupState.matches.map((entry) =>
        Promise.all([
          supabase.from('hole_scores').select('*').eq('match_id', entry.matchId),
          supabase.from('presses').select('*').eq('match_id', entry.matchId),
        ])
      )
    );

    set((state) => {
      if (!state.groupState) return state;
      const newMatches = state.groupState.matches.map((entry, i) => ({
        ...entry,
        scores: (results[i][0].data ?? []).map(dbToScore),
        presses: (results[i][1].data ?? []).map(dbToPress),
      }));
      const primaryIdx = newMatches.findIndex((m) => m.matchId === state.matchId);

      // Detect score changes across ALL matches in the group for ping
      let latestChange: typeof state.lastScoreUpdate | null = null;
      for (const newEntry of newMatches) {
        const oldEntry = state.groupState!.matches.find(m => m.matchId === newEntry.matchId);
        if (!oldEntry) continue;
        for (const s of newEntry.scores) {
          const prev = oldEntry.scores.find(
            (p) => p.holeNumber === s.holeNumber && p.playerId === s.playerId
          );
          if (!prev || prev.gross !== s.gross) {
            if (!latestChange || s.holeNumber >= latestChange.holeNumber) {
              latestChange = { playerId: s.playerId, holeNumber: s.holeNumber, timestamp: Date.now() };
            }
          }
        }
      }

      return {
        groupState: { ...state.groupState, matches: newMatches },
        scores: primaryIdx >= 0 ? newMatches[primaryIdx].scores : state.scores,
        presses: primaryIdx >= 0 ? newMatches[primaryIdx].presses : state.presses,
        ...(latestChange ? { lastScoreUpdate: latestChange } : {}),
      };
    });
  },

  // ── Create a new match row in Supabase ──────────────────────
  async createMatch(matchData, course, createdBy, creatorHandicapOverride) {
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

    // Determine creator's handicap (use override if provided, otherwise fetch from profile)
    let creatorHandicap = creatorHandicapOverride;
    if (creatorHandicap === undefined) {
      const { data: creatorProfile } = await supabase
        .from('profiles')
        .select('handicap')
        .eq('id', createdBy)
        .single();
      creatorHandicap = (creatorProfile as { handicap: number } | null)?.handicap ?? 0;
    }

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
        avatar_url: sp.avatarUrl ?? null,
      });

      allPlayers.push({
        userId: sp.userId,
        team: sp.team,
        initialHandicap: sp.handicap,
        ...(sp.isGuest ? { guestName: sp.fullName } : {}),
        ...(sp.avatarUrl ? { avatarUrl: sp.avatarUrl } : {}),
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

    try {
      // 1. Fetch the primary match row
      const { data: primaryRow, error: pError } = await supabase
        .from('matches')
        .select('*, courses(*)')
        .eq('id', matchId)
        .single();

      if (pError || !primaryRow) {
        set({ loading: false, error: 'Match not found' });
        return;
      }

      const match = dbToMatch(primaryRow as Record<string, unknown>);
      const courseRow = (primaryRow as any).courses;
      const course: Course | null = courseRow
        ? { id: courseRow.id as string, name: courseRow.name as string, holes: courseRow.holes as Course['holes'] }
        : null;

      localStorage.setItem('activeMatchId', match.id);

      // 2. Resolve Group context if it's a multi-match pairing
      if (match.groupId) {
        const { data: gMatchesRows } = await supabase
          .from('matches')
          .select('*')
          .eq('group_id', match.groupId);

        if (gMatchesRows && gMatchesRows.length > 0) {
          const allMatchIds = gMatchesRows.map(m => m.id);
          const [pAll, sAll, prAll] = await Promise.all([
            supabase.from('match_players').select('*').in('match_id', allMatchIds),
            supabase.from('hole_scores').select('*').in('match_id', allMatchIds),
            supabase.from('presses').select('*').in('match_id', allMatchIds),
          ]);

          const entries: GroupMatchEntry[] = gMatchesRows.map(mRow => {
            const mId = mRow.id;
            return {
              matchId: mId,
              match: dbToMatch(mRow),
              players: (pAll.data ?? []).filter((p: any) => p.match_id === mId).map(dbToPlayer),
              scores: (sAll.data ?? []).filter((s: any) => s.match_id === mId).map(dbToScore),
              presses: (prAll.data ?? []).filter((pr: any) => pr.match_id === mId).map(dbToPress),
            };
          });

          // Build unified unique players list (creator + all opponents)
          const seen = new Set<string>();
          const allPlayers: MatchPlayer[] = [];
          for (const entry of entries) {
            for (const p of entry.players) {
              if (!seen.has(p.userId)) {
                seen.add(p.userId);
                allPlayers.push(p);
              }
            }
          }

          const primaryEntry = entries.find(e => e.matchId === matchId) || entries[0];
          set({
            matchId: primaryEntry.matchId,
            match: primaryEntry.match,
            course,
            players: allPlayers,
            scores: primaryEntry.scores,
            presses: primaryEntry.presses,
            activeMatchIds: allMatchIds,
            groupState: { groupId: match.groupId, matches: entries },
            loading: false,
          });
        }
      } else {
        // 3. Simple Single Match Load
        const [pRes, sRes, prRes] = await Promise.all([
          supabase.from('match_players').select('*').eq('match_id', matchId),
          supabase.from('hole_scores').select('*').eq('match_id', matchId),
          supabase.from('presses').select('*').eq('match_id', matchId),
        ]);

        set({
          matchId,
          match,
          course,
          players: (pRes.data ?? []).map(dbToPlayer),
          scores: (sRes.data ?? []).map(dbToScore),
          presses: (prRes.data ?? []).map(dbToPress),
          activeMatchIds: [matchId],
          groupState: null,
          loading: false,
        });
      }

      get().subscribeToMatch(matchId);
    } catch (err) {
      console.error('[loadMatch] Group initialization failed:', err);
      set({ loading: false, error: 'Failed to initialize match group' });
    }
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
    // Optimistic local update — handles both single-match and group mode
    set((state) => {
      const newState: Partial<MatchStoreState> = {};

      // Update flat scores array when this is the primary match
      if (score.matchId === state.matchId) {
        const idx = state.scores.findIndex(
          (s) => s.holeNumber === score.holeNumber && s.playerId === score.playerId
        );
        if (idx >= 0) {
          const updated = [...state.scores];
          updated[idx] = score;
          newState.scores = updated;
        } else {
          newState.scores = [...state.scores, score];
        }
      }

      // Also update the relevant groupState entry
      if (state.groupState) {
        const matchIdx = state.groupState.matches.findIndex((m) => m.matchId === score.matchId);
        if (matchIdx >= 0) {
          const entry = state.groupState.matches[matchIdx];
          const scoreIdx = entry.scores.findIndex(
            (s) => s.holeNumber === score.holeNumber && s.playerId === score.playerId
          );
          const newScores = [...entry.scores];
          if (scoreIdx >= 0) newScores[scoreIdx] = score;
          else newScores.push(score);
          const newMatches = [...state.groupState.matches];
          newMatches[matchIdx] = { ...entry, scores: newScores };
          newState.groupState = { ...state.groupState, matches: newMatches };
        }
      }

      return newState;
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

  // ── Transition match to pending_attestation + fire emails ────
  async submitForAttestation(matchId) {
    await supabase.from('matches').update({ status: 'pending_attestation' }).eq('id', matchId);
    set((state) => ({
      match: state.match?.id === matchId
        ? { ...state.match, status: 'pending_attestation' }
        : state.match,
    }));
    // Fire-and-forget: send attestation request emails
    supabase.functions.invoke('request-attest', {
      body: { matchId, appUrl: window.location.origin },
    }).catch((err) => console.error('[attest] Email send failed:', err));
  },

  // ── Record current user's attestation ───────────────────────
  async attestMatch(matchId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const attestation: MatchAttestation = {
      matchId,
      userId: user.id,
      attestedAt: new Date().toISOString(),
    };
    const { error } = await supabase.from('match_attestations').insert({
      match_id: matchId,
      user_id: user.id,
    });
    if (!error) {
      set((state) => ({
        attestations: state.attestations.some(
          (a) => a.matchId === matchId && a.userId === user.id
        )
          ? state.attestations
          : [...state.attestations, attestation],
      }));
    }
    // DB trigger auto-completes the match; realtime will update status
  },

  // ── Load attestations for a match ───────────────────────────
  async loadAttestations(matchId) {
    const { data } = await supabase
      .from('match_attestations')
      .select('*')
      .eq('match_id', matchId);
    set({
      attestations: (data ?? []).map((row: Record<string, unknown>) => ({
        matchId: row.match_id as string,
        userId: row.user_id as string,
        attestedAt: row.attested_at as string,
      })),
    });
  },

  // ── Send reminder email to a specific player ─────────────────
  sendReminder(matchId, targetUserId) {
    supabase.functions.invoke('request-attest', {
      body: { matchId, targetUserId, appUrl: window.location.origin },
    }).catch((err) => console.error('[attest] Reminder send failed:', err));
  },

  // ── Permanently delete a match and all related data ─────────
  async deleteMatch(matchId) {
    await supabase.from('matches').delete().eq('id', matchId);
  },

  // ── Refresh scores + presses only (no subscription teardown) ─
  async refreshScores(matchId) {
    const [scoresRes, pressesRes] = await Promise.all([
      supabase.from('hole_scores').select('*').eq('match_id', matchId),
      supabase.from('presses').select('*').eq('match_id', matchId),
    ]);
    const newScores = (scoresRes.data ?? []).map(dbToScore);
    const state = get();

    // Detect new or changed scores from OTHER players and trigger a ping.
    // This is the primary ping mechanism — works reliably over HTTP polling.
    let latestChange: typeof state.lastScoreUpdate | null = null;
    for (const s of newScores) {
      const prev = state.scores.find(
        (p) => p.holeNumber === s.holeNumber && p.playerId === s.playerId
      );
      if (!prev || prev.gross !== s.gross) {
        if (!latestChange || s.holeNumber >= latestChange.holeNumber) {
          latestChange = { playerId: s.playerId, holeNumber: s.holeNumber, timestamp: Date.now() };
        }
      }
    }

    set({
      scores: newScores,
      presses: (pressesRes.data ?? []).map(dbToPress),
      ...(latestChange ? { lastScoreUpdate: latestChange } : {}),
    });
  },

  // ── Real-time subscription ──────────────────────────────────
  subscribeToMatch(explicitMatchId) {
    const state = get();
    const existing = state._channel;
    if (existing) existing.unsubscribe();

    // Use either the passed ID or the current set of active match IDs (for group mode)
    const matchIds = state.activeMatchIds.length > 0 ? state.activeMatchIds : [explicitMatchId];
    if (matchIds.length === 0) return;

    const channel = supabase.channel(`match-group-${genId()}`);

    matchIds.forEach((mId) => {
      channel
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'hole_scores', filter: `match_id=eq.${mId}` },
          (payload) => {
            if (payload.eventType === 'DELETE') return;
            const score = dbToScore(payload.new as Record<string, unknown>);
            set((state) => {
              const newLastScoreUpdate = {
                playerId: score.playerId,
                holeNumber: score.holeNumber,
                timestamp: Date.now(),
                matchId: score.matchId
              };

              const idx = state.scores.findIndex(
                (s) => s.holeNumber === score.holeNumber && s.playerId === score.playerId
              );

              if (idx >= 0) {
                const updated = [...state.scores];
                updated[idx] = score;
                return { scores: updated, lastScoreUpdate: newLastScoreUpdate };
              }
              return { scores: [...state.scores, score], lastScoreUpdate: newLastScoreUpdate };
            });
          }
        )
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'presses', filter: `match_id=eq.${mId}` },
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
          { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${mId}` },
          (payload) => {
            const updatedMatch = dbToMatch(payload.new as Record<string, unknown>);
            // Clear localStorage when match completes (covers non-scorekeeper devices)
            if (updatedMatch.status === 'completed' &&
                localStorage.getItem('activeMatchId') === updatedMatch.id) {
              localStorage.removeItem('activeMatchId');
            }
            set((state) => {
              // Update primary match if it matches
              const updates: Partial<MatchStoreState> = {};
              if (state.matchId === updatedMatch.id) {
                updates.match = updatedMatch;
              }

              // Also update in group state
              if (state.groupState) {
                const newMatches = state.groupState.matches.map(m =>
                  m.matchId === updatedMatch.id ? { ...m, match: updatedMatch } : m
                );
                updates.groupState = { ...state.groupState, matches: newMatches };
              }
              return updates;
            });
          }
        )
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'match_attestations', filter: `match_id=eq.${mId}` },
          (payload) => {
            const row = payload.new as Record<string, unknown>;
            const attestation: MatchAttestation = {
              matchId: row.match_id as string,
              userId: row.user_id as string,
              attestedAt: row.attested_at as string,
            };
            set((state) => ({
              attestations: state.attestations.some(
                (a) => a.matchId === attestation.matchId && a.userId === attestation.userId
              )
                ? state.attestations
                : [...state.attestations, attestation],
            }));
          }
        );
    });

    channel.subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        console.log('[Realtime] Subscribed to match(es)', matchIds);
      } else if (status === 'CLOSED') {
        // CLOSED fires when we intentionally unsubscribe — do NOT retry
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn('[Realtime] Subscription error, retrying in 3s…', status, err);
        setTimeout(() => {
          const currentMatchId = get().matchId;
          if (currentMatchId) get().subscribeToMatch(currentMatchId);
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
      attestations: [],
      error: null,
      _channel: null,
      stagedPlayers: [],
      pendingFormat: '1v1',
      poolPlayers: [],
      matchSlots: [{ id: genId(), player1Id: null, opponentId: null, wager: 10 }],
      groupState: null,
      activeMatchIds: [],
      currentStep: 1,
    });
  },
}));
