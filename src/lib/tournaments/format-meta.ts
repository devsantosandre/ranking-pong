import type { TournamentFormat } from "./types";

export const FORMAT_META: Record<
  TournamentFormat,
  { full: string; short: string; color: string; bg: string; border: string }
> = {
  single_elimination: { full: "Eliminatória simples", short: "Elim. simples", color: "#a421d2", bg: "rgba(164,33,210,0.10)", border: "rgba(164,33,210,0.22)" },
  double_elimination: { full: "Eliminatória dupla",   short: "Elim. dupla",   color: "#0891b2", bg: "rgba(8,145,178,0.10)",  border: "rgba(8,145,178,0.22)"  },
  round_robin:        { full: "Round-robin",           short: "Round-robin",   color: "#059669", bg: "rgba(5,150,105,0.10)",  border: "rgba(5,150,105,0.22)"  },
  groups_knockout:    { full: "Grupos + mata-mata",    short: "Grupos+KO",     color: "#d97706", bg: "rgba(217,119,6,0.10)",  border: "rgba(217,119,6,0.22)"  },
  king_of_table:      { full: "Rei da Mesa",           short: "Rei da Mesa",   color: "#dc2626", bg: "rgba(220,38,38,0.10)",  border: "rgba(220,38,38,0.22)"  },
  swiss:              { full: "Suíço",                 short: "Suíço",         color: "#6366f1", bg: "rgba(99,102,241,0.10)", border: "rgba(99,102,241,0.22)" },
  scorecard:          { full: "Scorecard",             short: "Scorecard",     color: "#ec4899", bg: "rgba(236,72,153,0.10)", border: "rgba(236,72,153,0.22)" },
  americano:          { full: "Americano",             short: "Americano",     color: "#14b8a6", bg: "rgba(20,184,166,0.10)", border: "rgba(20,184,166,0.22)" },
  league:             { full: "Liga",                  short: "Liga",          color: "#d97706", bg: "rgba(217,119,6,0.10)",  border: "rgba(217,119,6,0.22)"  },
};
