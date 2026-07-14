export interface ParsedPlayerRow {
  gamertag: string;
  grade: string;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  fouls: number;
  turnovers: number;
  fgm: number;
  fga: number;
  tpm: number;
  tpa: number;
  ftm: number;
  fta: number;
}

export interface ParsedTeam {
  name: string;
  score: number;
  players: ParsedPlayerRow[];
}

export interface ParsedBoxScore {
  teamA: ParsedTeam;
  teamB: ParsedTeam;
  quartersPlayed: number; // 1-4; less than 4 means the game ended early
}

export interface Command {
  data: {
    name: string;
    toJSON(): unknown;
  };
  execute(interaction: import("discord.js").ChatInputCommandInteraction): Promise<void>;
  autocomplete?(interaction: import("discord.js").AutocompleteInteraction): Promise<void>;
}

export const STAT_CHOICES = [
  { name: "Points", value: "points" },
  { name: "Rebounds", value: "rebounds" },
  { name: "Assists", value: "assists" },
  { name: "Steals", value: "steals" },
  { name: "Blocks", value: "blocks" },
  { name: "Turnovers", value: "turnovers" },
  { name: "Win %", value: "winPct" },
  { name: "FG %", value: "fgPct" },
  { name: "3PT %", value: "tpPct" },
] as const;

export type StatChoice = (typeof STAT_CHOICES)[number]["value"];
