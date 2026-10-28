export interface FPLElement {
  id: number;
  first_name: string;
  second_name: string;
  web_name: string;
  team: number; // team ID (1-20)
  element_type: number; // 1: GKP, 2: DEF, 3: MID, 4: FWD
  now_cost: number; // in tenths, e.g. 55 = £5.5m
  cost_change_event: number;
  cost_change_start: number;
  total_points: number;
  event_points: number;
  points_per_game: string;
  form: string;
  minutes: number;
  selected_by_percent: string;
  transfers_in_event: number;
  transfers_out_event: number;
  transfers_in: number;
  transfers_out: number;
  goals_scored: number;
  assists: number;
  clean_sheets: number;
  goals_conceded: number;
  yellow_cards: number;
  red_cards: number;
  bonus: number;
  bps: number;
  influence: string;
  creativity: string;
  threat: string;
  ict_index: string;
  expected_goals: string;
  expected_assists: string;
  expected_goal_involvements: string;
  expected_goals_conceded: string;
  status: string; // 'a': available, 'd': doubtful, 'i': injured, 's': suspended, 'u': unavailable
  news: string;
  chance_of_playing_next_round: number | null;
  chance_of_playing_this_round: number | null;
  photo?: string;
}

export interface FPLTeam {
  id: number;
  name: string;
  short_name: string;
  code: number;
  strength: number;
  strength_overall_home: number;
  strength_overall_away: number;
  strength_attack_home: number;
  strength_attack_away: number;
  strength_defence_home: number;
  strength_defence_away: number;
}

export interface FPLEvent {
  id: number;
  name: string;
  deadline_time: string;
  average_entry_score: number;
  highest_score: number;
  finished: boolean;
  data_checked: boolean;
  is_previous: boolean;
  is_current: boolean;
  is_next: boolean;
  chip_plays?: { chip_name: string; num_played: number }[];
  most_selected?: number;
  most_transferred_in?: number;
  top_element?: number;
  transfers_made?: number;
  most_captained?: number;
  most_vice_captained?: number;
}

export interface FPLElementType {
  id: number;
  plural_name: string;
  plural_name_short: string;
  singular_name: string;
  singular_name_short: string;
  squad_select: number;
  squad_min_select: number;
  squad_max_select: number;
  squad_min_play: number;
  squad_max_play: number;
}

export interface FPLBootstrap {
  elements: FPLElement[];
  teams: FPLTeam[];
  events: FPLEvent[];
  element_types: FPLElementType[];
  total_players: number;
}

export interface FPLFixture {
  id: number;
  code: number;
  team_h: number;
  team_a: number;
  event: number | null;
  finished: boolean;
  kickoff_time: string | null;
  team_h_difficulty: number;
  team_a_difficulty: number;
  team_h_score: number | null;
  team_a_score: number | null;
}

export interface FPLDreamTeamPlayer {
  element: number;
  points: number;
  position: number;
}

export interface FPLDreamTeam {
  top_player?: {
    id: number;
    points: number;
  };
  team: FPLDreamTeamPlayer[];
}

export interface FPLEntry {
  id: number;
  name: string;
  player_first_name: string;
  player_last_name: string;
  player_region_name: string;
  summary_overall_points: number;
  summary_overall_rank: number;
  summary_event_points: number;
  summary_event_rank: number;
  current_event: number;
  last_deadline_value: number;
  last_deadline_bank: number;
  last_deadline_total_transfers: number;
}

export interface FPLLiveElementStats {
  minutes: number;
  goals_scored: number;
  assists: number;
  clean_sheets: number;
  goals_conceded: number;
  own_goals: number;
  penalties_saved: number;
  penalties_missed: number;
  yellow_cards: number;
  red_cards: number;
  saves: number;
  bonus: number;
  bps: number;
  total_points: number;
  in_dreamteam?: boolean;
}

export interface FPLLiveElement {
  id: number;
  stats: FPLLiveElementStats;
}

export interface FPLLiveResponse {
  elements: FPLLiveElement[];
}

export interface FPLEntryPick {
  element: number;
  position: number;
  multiplier: number;
  is_captain: boolean;
  is_vice_captain: boolean;
  element_type?: number;
}

export interface FPLEntryPicksResponse {
  active_chip: string | null;
  entry_history: {
    event: number;
    points: number;
    total_points: number;
    rank: number;
    event_transfers: number;
    event_transfers_cost: number;
    points_on_bench: number;
    value: number;
    bank: number;
  };
  picks: FPLEntryPick[];
}

export interface UserSquadState {
  teamId?: number;
  teamName?: string;
  managerName?: string;
  overallPoints?: number;
  overallRank?: number;
  picks: {
    elementId: number;
    position: number; // 1-15
    isCaptain?: boolean;
    isViceCaptain?: boolean;
  }[];
  bank: number; // in £m, e.g. 1.5
  source: 'manual' | 'fpl_id';
  lastUpdated: string;
}

export interface TransferAlternative {
  player: FPLElement;
  club: FPLTeam;
  score: number;
  scoreBreakdown: {
    formScore: number;
    fixtureScore: number;
    xgScore: number;
    valueScore: number;
  };
  upcomingFixtures: {
    opponent: string;
    isHome: boolean;
    difficulty: number;
  }[];
  pros: string[];
  risks: string[];
  rationale: string;
}
