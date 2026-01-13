export type TournamentType = 'TEST' | 'LIMITED_OVERS';

export interface Team {
  id: string;
  name: string;
  logoUrl?: string;
  owner?: string;
  // Stats
  seriesPlayed: number;
  matchesPlayed: number;
  matchesWon: number;
  matchesLost: number;
  matchesDrawn: number;
  matchesTie: number;
  matchesNR: number;
  // Points
  basePoints: number;
  bonusPoints: number;
  penaltyPoints: number;
  totalPoints: number;
  pct: number;
  // Extra (Limited Overs)
  runsScored: number;
  oversFaced: number;
  runsConceded: number;
  oversBowled: number;
  nrr?: number; 
  form?: ('W' | 'L' | 'T' | 'N')[];
}

export interface Stadium {
  id: string;
  name: string;
  assignedMatches?: number;
}

export type MatchResultType = 'T1_WIN' | 'T2_WIN' | 'DRAW' | 'TIE' | 'NO_RESULT' | 'ABANDONED';

export interface Match {
  id: string;
  round: number;
  seriesId: string; 
  team1Id: string;
  team2Id: string;
  venueId: string;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  winnerId?: string;
  resultType?: MatchResultType;
  notes?: string;
  t1Runs?: number;
  t1Wickets?: number;
  t1OversWhole?: number;
  t1Balls?: number;
  t2Runs?: number;
  t2Wickets?: number;
  t2OversWhole?: number;
  t2Balls?: number;
}

export interface SeriesGroup {
  id: string;
  round: number;
  team1Id: string;
  team2Id: string;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  matchIds: string[];
}

export interface PenaltyRecord {
  id: string;
  teamId: string;
  points: number;
  reason: string;
  date: string;
  addedBy?: string;
}

export interface ResultLog {
  id: string;
  timestamp: string;
  action: string;
  reason: string;
  user?: string;
}

export interface TournamentConfig {
  seriesLength?: string;
  oversPerMatch?: string;
  scheduleFormat: string;
  playoffSystem: string;
  pointsForWin: number;
  pointsForDraw: number;
  pointsForLoss: number;
  countSeriesBonus: boolean;
  pointsForSeriesWin: number;
  pointsForSeriesDraw: number;
  officials: string[];
  groupCount?: number;
  downloadsEnabled?: boolean;
  penaltiesEnabled?: boolean;
}

export interface TournamentHeader {
  siteLogoUrl: string;
  tournamentName: string;
  tournamentLogoUrl: string;
  confirmed: boolean;
}

export type TournamentStatus = 'UPCOMING' | 'ONGOING' | 'COMPLETED';

export interface Tournament {
  id: string;
  name: string;
  subtitle?: string;
  description?: string;
  type: TournamentType;
  createdDate: string;
  status?: TournamentStatus;
  isLocked?: boolean;
  isPrototypeSchedule?: boolean;
  teams: Team[];
  stadiums: Stadium[];
  matches: Match[];
  series?: SeriesGroup[];
  penalties: PenaltyRecord[];
  logs?: ResultLog[];
  config: TournamentConfig;
  header: TournamentHeader;
  teamsCount: number;
}

export type AppView = 'MAIN' | 'WORKSPACE';
export type MainTab = 'CREATE' | 'MANAGE';
export type WorkspaceTab = 'CONTROL' | 'SCHEDULE' | 'RESULTS' | 'POINTS' | 'SECURITY';