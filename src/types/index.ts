export type MatchFormat = '1v1' | '2v2' | 'skins';
export type WagerType = 'PER_HOLE' | 'NASSAU';

export interface User {
  id: string;
  fullName: string;
  avatarUrl?: string;
  handicap: number;
}

// ── Multi-match 1v1 group types ───────────────────────────────

export interface PoolPlayer {
  userId: string;
  fullName: string;
  handicap: number;
  isGuest?: boolean;
  avatarUrl?: string;
}

export interface MatchSlot {
  id: string;
  player1Id: string | null; // null = creator (current user)
  opponentId: string | null;
  wager: number;
  strokeOverride?: number;  // net strokes from player1's POV; undefined = use calculated diff
}

export interface GroupMatchEntry {
  matchId: string;
  match: Match;
  players: MatchPlayer[];
  scores: HoleScore[];
  presses: Press[];
}

export interface GroupState {
  groupId: string;
  matches: GroupMatchEntry[];
}

export interface MatchPlayer {
  userId: string;
  team: 'A' | 'B';
  initialHandicap: number;
  guestName?: string;  // set for guest/Grint players (no Supabase account)
  avatarUrl?: string;  // carried from staged player (Grint/guest), not persisted to DB
}

export interface HoleScore {
  matchId: string;
  holeNumber: number;
  playerId: string;
  gross: number;
  net: number;
  trashDots: string[]; // e.g., ['greenie', 'sandie']
}

export interface Press {
  id: string;
  matchId: string;
  startHole: number;
  pressedByTeam: 'A' | 'B';
  status: 'active' | 'completed';
}

export interface Course {
  id: string;
  name: string;
  imageUrl?: string;
  holes: Array<{
    number: number;
    par: number;
    strokeIndex: number;
    yardage: number;
  }>;
}

export interface MatchAttestation {
  matchId: string;
  userId: string;
  attestedAt: string;
}

export interface Match {
  id: string;
  joinCode?: string;
  courseId: string;
  groupId?: string;
  format: MatchFormat;
  wagerAmount: number;
  wagerType: WagerType;
  status: 'setup' | 'in_progress' | 'pending_attestation' | 'completed';
  sideBets: {
    greenies: boolean;
    sandies: boolean;
    snake: boolean;
    autoPress: boolean;
    birdiesDouble?: boolean;
    trashValue: number;
    startingHole?: number;
    par3Contest?: boolean;
    par3Pot?: number;
    par5Contest?: boolean;
    par5Pot?: number;
    bonusSkins?: boolean;
    teamSkins?: boolean;   // Team A vs Team B best-ball per hole
    potMode?: boolean;     // Most skins wins the pot (buy-in = wagerAmount)
  };
  createdBy: string;
}

// ── Debt Ledger Types ─────────────────────────────────────────────

export interface Debt {
  id: string;
  matchId: string;
  debtorId: string;
  creditorId: string;
  originalAmount: number;
  remainingAmount: number;
  status: 'pending' | 'partial' | 'settled';
  createdAt: string;
  updatedAt: string;
  // Joined relations
  debtor?: { id: string; fullName: string; avatarUrl?: string };
  creditor?: { id: string; fullName: string; avatarUrl?: string };
}

export interface Payment {
  id: string;
  debtId: string;
  payerId: string;
  receiverId: string;
  amount: number;
  method: 'venmo' | 'cashapp' | 'etransfer' | 'cash' | 'other';
  paymentAddress?: string;
  status: 'requested_info' | 'pending_confirmation' | 'confirmed' | 'rejected';
  createdAt: string;
  updatedAt: string;

  // Joined relations
  payer?: { id: string; fullName: string; avatarUrl?: string };
  receiver?: { id: string; fullName: string; avatarUrl?: string };
}

// ── Social Feature Types ─────────────────────────────────────────

export type ReactionType = 'heart' | 'fire' | 'clap' | 'flag' | 'skull' | 'laugh';

export interface FeedLike {
  id: string;
  feedItemId: string;
  userId: string;
  reactionType: ReactionType;
  createdAt: string;
}

export interface FeedComment {
  id: string;
  feedItemId: string;
  userId: string;
  body: string;
  createdAt: string;
  author?: { id: string; fullName: string; avatarUrl?: string };
}

export interface FeedItemSocialData {
  reactions: Partial<Record<ReactionType, number>>;
  userReaction: ReactionType | null;
  commentCount: number;
}

export interface ScoreEditLog {
  id: string;
  matchId: string;
  holeNumber: number;
  playerId: string;
  oldGross: number;
  newGross: number;
  oldNet: number;
  newNet: number;
  editedBy: string;
  editedAt: string;
  // Joined relation Data
  player?: { id: string; fullName: string; avatarUrl?: string };
  editor?: { id: string; fullName: string; avatarUrl?: string };
}
