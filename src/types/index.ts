export type MatchFormat = '1v1' | '2v2';
export type WagerType = 'PER_HOLE' | 'NASSAU';

export interface User {
  id: string;
  fullName: string;
  avatarUrl?: string;
  handicap: number;
}

export interface MatchPlayer {
  userId: string;
  team: 'A' | 'B';
  initialHandicap: number;
  guestName?: string; // set for guest players (no Supabase account)
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
  holes: Array<{
    number: number;
    par: number;
    strokeIndex: number;
    yardage: number;
  }>;
}

export interface Match {
  id: string;
  joinCode?: string;
  courseId: string;
  format: MatchFormat;
  wagerAmount: number;
  wagerType: WagerType;
  status: 'setup' | 'in_progress' | 'completed';
  sideBets: {
    greenies: boolean;
    sandies: boolean;
    snake: boolean;
    autoPress: boolean;
    birdiesDouble?: boolean;
    trashValue: number;
  };
  createdBy: string;
}
