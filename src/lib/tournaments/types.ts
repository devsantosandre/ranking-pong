export type TournamentFormat =
  | "single_elimination"
  | "double_elimination"
  | "round_robin"
  | "groups_knockout"
  | "swiss"
  | "scorecard"
  | "americano"
  | "king_of_table"
  | "league";

export type TournamentStatus = "draft" | "registration" | "active" | "finished";
export type SeedingMethod = "standard" | "pots" | "sequential" | "manual" | "elo";
export type RegistrationMode = "invite" | "open";
export type MatchStatus = "pending" | "scheduled" | "in_progress" | "finished";
export type BracketSide = "winners" | "losers" | "group" | "placement";
export type SignupStatus = "invited" | "signed_up" | "confirmed";
/** Modo de pagamento da inscrição de evento. `gateway` (Mercado Pago) só na Fase 3. */
export type PaymentMode = "gateway" | "manual" | "free";
/** Status de pagamento de uma inscrição (`event_signups`). */
export type SignupPaymentStatus = "pending" | "confirmed" | "rejected" | "expired";

export interface Tournament {
  id: string;
  name: string;
  format: TournamentFormat;
  bestOf: number;
  /** Eliminatórias: true = disputa de 3º lugar (padrão ITTF); false = dois terceiros. */
  thirdPlaceMatch: boolean;
  status: TournamentStatus;
  seedingMethod: SeedingMethod;
  registrationMode: RegistrationMode;
  verificationCode: string | null;
  maxParticipants: number | null;
  seasonId: string | null;
  championUserId: string | null;
  championName: string | null;
  branding: { logoUrl?: string; primary?: string } | null;
  createdBy: string;
  createdAt: string;
  finishedAt: string | null;
  // Divisões (Opção B): quando o torneio pertence a um evento, é uma divisão dele.
  // eventId null = torneio avulso (comportamento legado, intacto).
  eventId: string | null;
  divisionLabel: string | null;
  divisionOrder: number;
  /** Divisão (C1): horário de início (texto livre, ex.: "10h20"). */
  startTime: string | null;
  /** Divisão (C1): descrição de nível (ex.: "iniciante", "avançado"). */
  levelDescription: string | null;
}

/**
 * Evento (o "dia"/competição guarda-chuva) que agrupa várias divisões.
 * Cada divisão É um Tournament independente apontando para este evento.
 */
export interface TournamentEvent {
  id: string;
  name: string;
  eventDate: string | null;
  venue: string | null;
  branding: { logoUrl?: string; primary?: string } | null;
  seasonId: string | null;
  createdBy: string;
  createdAt: string;
  /** Informações públicas do evento (C1) — blob flexível, white-label friendly. */
  info: EventInfo | null;
}

/**
 * Bloco de informações públicas do evento (C1). Todos os campos são opcionais.
 * `description`/`prizeInfo`/`rulesText` são markdown (renderizados com HTML escapado).
 */
export interface EventInfo {
  description?: string;
  registrationDeadline?: string;
  contactPhone?: string;
  prizeInfo?: string;
  rulesText?: string;
  payment?: {
    mode: PaymentMode;
    /** Preço por nº de divisões, em reais: { "1": 70, "2": 90 }. */
    prices?: Record<string, number>;
    /** Fase 3 (gateway): provedor e referência de credencial por tenant. */
    provider?: string;
    accountRef?: string;
  };
}

/**
 * Inscrição de EVENTO (C2). Uma pessoa por evento; ao confirmar, gera 1
 * `tournament_participant` por divisão escolhida. Contato/pagamento moram aqui.
 */
export interface EventSignup {
  id: string;
  eventId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  club: string | null;
  cbtmAffiliated: boolean;
  /** Rating CBTM → vira `pot` (força) dos participantes gerados. */
  cbtmRating: number | null;
  /** IDs dos torneios-divisão escolhidos (máx 2). */
  divisions: string[];
  amountCents: number | null;
  paymentMode: PaymentMode;
  paymentProvider: string | null;
  paymentId: string | null;
  paymentStatus: SignupPaymentStatus;
  agreedRules: boolean;
  notes: string | null;
  createdAt: string;
}

/** Resumo leve de uma divisão, para o hub admin / seletores / TV. */
export interface DivisionSummary {
  id: string; // tournamentId da divisão
  name: string;
  divisionLabel: string | null;
  divisionOrder: number;
  format: TournamentFormat;
  status: TournamentStatus;
  participantCount: number;
  championName: string | null;
  hasLiveMatch: boolean;
  startTime: string | null;
  levelDescription: string | null;
}

export interface TournamentEventDetail extends TournamentEvent {
  divisions: DivisionSummary[];
}

/** Item leve para listagens: torneio (agrupador) + resumo de suas categorias. */
export interface EventListItem extends TournamentEvent {
  categoriesCount: number;
  firstCategoryId: string | null;
  hasLiveMatch: boolean;
  /** Status predominante das divisões (ver deriveEventStatus). */
  status: TournamentStatus;
}

export interface TournamentParticipant {
  id: string;
  tournamentId: string;
  userId: string | null;
  guestName: string | null;
  seed: number | null;
  groupId: string | null;
  pot: number | null;
  flag: string | null;
  avatarUrl: string | null;
  color: string | null;
  signupStatus: SignupStatus;
  partnerParticipantId: string | null;
}

export interface TournamentMatch {
  id: string;
  tournamentId: string;
  round: number;
  bracket: BracketSide;
  slot: number;
  groupId: string | null;
  participantAId: string | null;
  participantBId: string | null;
  scoreA: number | null;
  scoreB: number | null;
  sets: Array<[number, number]> | null;
  winnerParticipantId: string | null;
  nextMatchId: string | null;
  nextMatchSlot: 0 | 1 | null;
  status: MatchStatus;
  deadlineAt: string | null;
  scheduledAt: string | null;
  tableNo: number | null;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface PositionedMatch extends TournamentMatch {
  x: number;
  y: number;
  height: number;
}

export interface Connector {
  fromId: string;
  toId: string;
  path: string;
  active: boolean;
}

export interface GroupStanding {
  participantId: string;
  groupId: string;
  wins: number;
  losses: number;
  setsWon: number;
  setsLost: number;
  /** Pontos de game (somatório dos pontos de cada set) — derivados de `match.sets`. */
  gamePointsWon: number;
  gamePointsLost: number;
  points: number;
  position: number;
  /** Critério que definiu a posição quando houve empate (desempate ITTF). */
  tiebreak?: "match-points" | "sets-ratio" | "game-points-ratio" | null;
}

export interface TournamentDetail extends Tournament {
  participants: TournamentParticipant[];
  matches: TournamentMatch[];
}

// Mappers snake_case (Supabase) ↔ camelCase (domínio)

export function tournamentFromRow(row: Record<string, unknown>): Tournament {
  return {
    id: row.id as string,
    name: row.name as string,
    format: row.format as TournamentFormat,
    bestOf: row.best_of as number,
    thirdPlaceMatch: (row.third_place_match as boolean | null) ?? true,
    status: row.status as TournamentStatus,
    seedingMethod: row.seeding_method as SeedingMethod,
    registrationMode: row.registration_mode as RegistrationMode,
    verificationCode: (row.verification_code as string | null) ?? null,
    maxParticipants: (row.max_participants as number | null) ?? null,
    seasonId: (row.season_id as string | null) ?? null,
    championUserId: (row.champion_user_id as string | null) ?? null,
    championName: (row.champion_name as string | null) ?? null,
    branding: (row.branding as Tournament["branding"]) ?? null,
    createdBy: row.created_by as string,
    createdAt: row.created_at as string,
    finishedAt: (row.finished_at as string | null) ?? null,
    eventId: (row.event_id as string | null) ?? null,
    divisionLabel: (row.division_label as string | null) ?? null,
    divisionOrder: (row.division_order as number | null) ?? 0,
    startTime: (row.start_time as string | null) ?? null,
    levelDescription: (row.level_description as string | null) ?? null,
  };
}

export function tournamentEventFromRow(row: Record<string, unknown>): TournamentEvent {
  return {
    id: row.id as string,
    name: row.name as string,
    eventDate: (row.event_date as string | null) ?? null,
    venue: (row.venue as string | null) ?? null,
    branding: (row.branding as TournamentEvent["branding"]) ?? null,
    seasonId: (row.season_id as string | null) ?? null,
    createdBy: row.created_by as string,
    createdAt: row.created_at as string,
    info: (row.info as EventInfo | null) ?? null,
  };
}

export function eventSignupFromRow(row: Record<string, unknown>): EventSignup {
  return {
    id: row.id as string,
    eventId: row.event_id as string,
    fullName: row.full_name as string,
    email: (row.email as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    club: (row.club as string | null) ?? null,
    cbtmAffiliated: (row.cbtm_affiliated as boolean | null) ?? false,
    cbtmRating: (row.cbtm_rating as number | null) ?? null,
    divisions: (row.divisions as string[] | null) ?? [],
    amountCents: (row.amount_cents as number | null) ?? null,
    paymentMode: (row.payment_mode as PaymentMode | null) ?? "manual",
    paymentProvider: (row.payment_provider as string | null) ?? null,
    paymentId: (row.payment_id as string | null) ?? null,
    paymentStatus: (row.payment_status as SignupPaymentStatus | null) ?? "pending",
    agreedRules: (row.agreed_rules as boolean | null) ?? false,
    notes: (row.notes as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

export function participantFromRow(row: Record<string, unknown>): TournamentParticipant {
  return {
    id: row.id as string,
    tournamentId: row.tournament_id as string,
    userId: (row.user_id as string | null) ?? null,
    guestName: (row.guest_name as string | null) ?? null,
    seed: (row.seed as number | null) ?? null,
    groupId: (row.group_id as string | null) ?? null,
    pot: (row.pot as number | null) ?? null,
    flag: (row.flag as string | null) ?? null,
    avatarUrl: (row.avatar_url as string | null) ?? null,
    color: (row.color as string | null) ?? null,
    signupStatus: row.signup_status as SignupStatus,
    partnerParticipantId: (row.partner_participant_id as string | null) ?? null,
  };
}

export function standingFromRow(row: Record<string, unknown>): GroupStanding {
  return {
    participantId: row.participant_id as string,
    groupId: row.group_id as string,
    wins: row.wins as number,
    losses: row.losses as number,
    setsWon: row.sets_won as number,
    setsLost: row.sets_lost as number,
    // Pontos de game não vêm da view SQL atual (só do cálculo TS). Default 0 até a
    // classificação passar a ser computada no TS (Bloco B — decisão "tudo em TS").
    gamePointsWon: (row.game_points_won as number | undefined) ?? 0,
    gamePointsLost: (row.game_points_lost as number | undefined) ?? 0,
    points: row.points as number,
    position: row.position as number,
  };
}

export function matchFromRow(row: Record<string, unknown>): TournamentMatch {
  return {
    id: row.id as string,
    tournamentId: row.tournament_id as string,
    round: row.round as number,
    bracket: row.bracket as BracketSide,
    slot: row.slot as number,
    groupId: (row.group_id as string | null) ?? null,
    participantAId: (row.participant_a_id as string | null) ?? null,
    participantBId: (row.participant_b_id as string | null) ?? null,
    scoreA: (row.score_a as number | null) ?? null,
    scoreB: (row.score_b as number | null) ?? null,
    sets: (row.sets as Array<[number, number]> | null) ?? null,
    winnerParticipantId: (row.winner_participant_id as string | null) ?? null,
    nextMatchId: (row.next_match_id as string | null) ?? null,
    nextMatchSlot: (row.next_match_slot as 0 | 1 | null) ?? null,
    status: row.status as MatchStatus,
    deadlineAt: (row.deadline_at as string | null) ?? null,
    scheduledAt: (row.scheduled_at as string | null) ?? null,
    tableNo: (row.table_no as number | null) ?? null,
    startedAt: (row.started_at as string | null) ?? null,
    finishedAt: (row.finished_at as string | null) ?? null,
  };
}
