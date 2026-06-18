import type {
  Tournament,
  TournamentParticipant,
  TournamentMatch,
  TournamentDetail,
  GroupStanding,
  TournamentFormat,
  SeedingMethod,
  RegistrationMode,
} from "../types";

export interface CreateTournamentInput {
  name: string;
  format: TournamentFormat;
  bestOf: number;
  seedingMethod: SeedingMethod;
  registrationMode: RegistrationMode;
  maxParticipants?: number;
  seasonId?: string;
  createdBy: string;
}

export interface AddParticipantInput {
  userId?: string;
  guestName?: string;
  flag?: string;
  color?: string;
  avatarUrl?: string;
}

export interface ReportResultInput {
  scoreA: number;
  scoreB: number;
  sets?: Array<[number, number]>;
}

export interface SaveSeedingInput {
  participantId: string;
  seed: number;
  groupId?: string;
  pot?: number;
}

export interface TournamentRepo {
  listTournaments(filter?: { status?: Tournament["status"] }): Promise<Tournament[]>;
  getTournament(id: string): Promise<TournamentDetail | null>;
  createTournament(input: CreateTournamentInput): Promise<Tournament>;
  updateTournament(id: string, patch: Partial<Pick<Tournament, "name" | "status" | "bestOf" | "branding">>): Promise<Tournament>;

  addParticipants(tournamentId: string, items: AddParticipantInput[]): Promise<TournamentParticipant[]>;
  removeParticipant(participantId: string): Promise<void>;
  saveSeeding(tournamentId: string, order: SaveSeedingInput[]): Promise<void>;

  generateBracket(tournamentId: string, method: SeedingMethod): Promise<TournamentMatch[]>;
  reportResult(matchId: string, input: ReportResultInput): Promise<TournamentMatch>;
  revertResult(matchId: string): Promise<void>;
  walkover(matchId: string, winnerParticipantId: string): Promise<TournamentMatch>;

  getStandings(tournamentId: string): Promise<GroupStanding[]>;
  closeGroupStage(tournamentId: string): Promise<void>;

  finishTournament(tournamentId: string, championParticipantId: string): Promise<Tournament>;
  openRegistration(tournamentId: string): Promise<void>;
  closeRegistration(tournamentId: string): Promise<void>;
}
