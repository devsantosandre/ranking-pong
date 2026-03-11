"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Clock3,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  adminGetAnalytics,
  type AdminAnalyticsDay,
  type AdminAnalyticsResponse,
} from "@/app/actions/admin";

const BUSINESS_TIMEZONE = "America/Sao_Paulo";
const numberFormatter = new Intl.NumberFormat("pt-BR");
const hourFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

function getCurrentMonthKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
  }).format(new Date());
}

function formatNumber(value: number) {
  return numberFormatter.format(value);
}

function formatHours(value: number) {
  return hourFormatter.format(value);
}

function formatPercentage(value: number | null) {
  if (value === null) return "Sem base";
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`;
}

function formatDelta(delta: number, comparisonLabel: string, enabled = true) {
  if (!enabled) {
    return "Início do histórico do app";
  }

  if (delta === 0) {
    return `Mesmo nível de ${comparisonLabel}`;
  }

  const prefix = delta > 0 ? "+" : "";
  return `${prefix}${formatNumber(delta)} vs ${comparisonLabel}`;
}

function capitalizeLabel(label: string) {
  if (!label) return label;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function MetricCard({
  title,
  value,
  description,
  tone,
  actionHref,
  actionLabel,
}: {
  title: string;
  value: string;
  description: string;
  tone: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <article className={`flex h-full flex-col rounded-2xl border p-4 shadow-sm ${tone}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {title}
      </p>
      <p className="mt-3 text-2xl font-semibold text-foreground">{value}</p>
      <p className="mt-2 text-xs text-muted-foreground">{description}</p>
      {actionHref && actionLabel ? (
        <Link
          href={actionHref}
          className="mt-3 inline-flex items-center text-xs font-semibold text-primary underline-offset-4 hover:underline"
        >
          {actionLabel}
        </Link>
      ) : null}
    </article>
  );
}

function SectionCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function MetricBarRow({
  detailKey,
  label,
  secondaryLabel,
  registrations,
  validated,
  pending,
  edited,
  canceled,
  uniquePlayers,
  maxRegistrations,
  expanded,
  onToggle,
}: {
  detailKey: string;
  label: string;
  secondaryLabel: string;
  registrations: number;
  validated: number;
  pending: number;
  edited: number;
  canceled: number;
  uniquePlayers: number;
  maxRegistrations: number;
  expanded: boolean;
  onToggle: (key: string) => void;
}) {
  const safeMax = Math.max(maxRegistrations, 1);
  const registrationsWidth = Math.min(100, (registrations / safeMax) * 100);
  const validatedWidth = Math.min(100, (validated / safeMax) * 100);
  const unresolved = registrations - validated;

  return (
    <div className="rounded-xl border border-border/70 bg-muted/25">
      <button
        type="button"
        onClick={() => onToggle(detailKey)}
        className="w-full p-3 text-left"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{label}</p>
            <p className="text-[11px] text-muted-foreground">{secondaryLabel}</p>
          </div>
          <div className="flex shrink-0 items-start gap-2">
            <div className="text-right">
              <p className="text-sm font-semibold text-sky-700">
                {formatNumber(registrations)}
              </p>
              <p className="text-[11px] text-emerald-700">
                {formatNumber(validated)} validadas
              </p>
            </div>
            {expanded ? (
              <ChevronUp className="mt-0.5 h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="mt-0.5 h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </div>

        <div className="relative mt-3 h-2.5 overflow-hidden rounded-full bg-slate-200">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-sky-300"
            style={{ width: `${registrationsWidth}%` }}
          />
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-emerald-500"
            style={{ width: `${validatedWidth}%` }}
          />
        </div>

        <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{formatNumber(uniquePlayers)} jogador(es) ativos</span>
          <span>Toque para detalhar</span>
        </div>
      </button>

      {expanded ? (
        <div className="border-t border-border/70 px-3 pb-3 pt-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-background px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Registros
              </p>
              <p className="mt-1 text-sm font-semibold text-sky-700">
                {formatNumber(registrations)}
              </p>
            </div>
            <div className="rounded-lg bg-background px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Validadas
              </p>
              <p className="mt-1 text-sm font-semibold text-emerald-700">
                {formatNumber(validated)}
              </p>
            </div>
            <div className="rounded-lg bg-background px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Pendentes
              </p>
              <p className="mt-1 text-sm font-semibold text-amber-700">
                {formatNumber(pending)}
              </p>
            </div>
            <div className="rounded-lg bg-background px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Contestadas
              </p>
              <p className="mt-1 text-sm font-semibold text-blue-700">
                {formatNumber(edited)}
              </p>
            </div>
            <div className="rounded-lg bg-background px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Canceladas
              </p>
              <p className="mt-1 text-sm font-semibold text-rose-700">
                {formatNumber(canceled)}
              </p>
            </div>
            <div className="rounded-lg bg-background px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Não validadas
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {formatNumber(unresolved)}
              </p>
            </div>
          </div>

          <p className="mt-3 text-[11px] text-muted-foreground">
            Azul mostra todos os registros. Verde mostra apenas as partidas validadas.
            O restante aparece separado acima.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function TopPlayerRow({
  position,
  name,
  registrations,
  validated,
  wins,
  uniqueOpponents,
}: {
  position: number;
  name: string;
  registrations: number;
  validated: number;
  wins: number;
  uniqueOpponents: number;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-muted/20 p-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
        {position}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{name}</p>
        <p className="text-[11px] text-muted-foreground">
          {formatNumber(registrations)} registros, {formatNumber(validated)} validadas
        </p>
      </div>
      <div className="shrink-0 text-right text-[11px] text-muted-foreground">
        <p>{formatNumber(wins)} vitórias</p>
        <p>{formatNumber(uniqueOpponents)} adversários</p>
      </div>
    </div>
  );
}

function TopPlayersGroup({
  title,
  description,
  players,
  emptyMessage,
}: {
  title: string;
  description: string;
  players: AdminAnalyticsResponse["topPlayersMonth"];
  emptyMessage: string;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
      <div className="mb-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {title}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>

      <div className="space-y-3">
        {players.length === 0 ? (
          <EmptyList message={emptyMessage} />
        ) : (
          players.map((player, index) => (
            <TopPlayerRow
              key={`${title}-${player.userId}`}
              position={index + 1}
              name={player.userName}
              registrations={player.registrations}
              validated={player.validated}
              wins={player.wins}
              uniqueOpponents={player.uniqueOpponents}
            />
          ))
        )}
      </div>
    </div>
  );
}

function RivalryRow({
  name,
  registrations,
  validated,
}: {
  name: string;
  registrations: number;
  validated: number;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-snug break-words text-foreground">
            {name}
          </p>
          <p className="text-[11px] text-muted-foreground">Par mais recorrente no mês</p>
        </div>
        <div className="shrink-0 text-right text-[11px] text-muted-foreground">
          <p>{formatNumber(registrations)} registros</p>
          <p>{formatNumber(validated)} validadas</p>
        </div>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-4">
      <div className="h-24 animate-pulse rounded-2xl bg-muted/70" />
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-2xl bg-muted/60" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-2xl bg-muted/60" />
    </div>
  );
}

function EmptyList({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-muted/15 p-4 text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function InfoModal({
  open,
  title,
  description,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  description: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <button
        type="button"
        aria-label="Fechar modal"
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <div className="relative mx-4 w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="pr-8">
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

export default function AdminMetricasPage() {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthKey);
  const [analytics, setAnalytics] = useState<AdminAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [expandedMetricKey, setExpandedMetricKey] = useState<string | null>(null);
  const [adminActionsModalOpen, setAdminActionsModalOpen] = useState(false);
  const requestIdRef = useRef(0);
  const hasLoadedRef = useRef(false);

  const loadAnalytics = useCallback(async (month: string, preserveData: boolean) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    if (preserveData) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const response = await adminGetAnalytics(month);

      if (requestId !== requestIdRef.current) {
        return;
      }

      setAnalytics(response);
      setSelectedMonth(response.selectedMonth);
      setExpandedMetricKey(null);
      setAdminActionsModalOpen(false);
      setError("");
      hasLoadedRef.current = true;
    } catch (err) {
      if (requestId !== requestIdRef.current) {
        return;
      }

      setError(err instanceof Error ? err.message : "Erro ao carregar métricas");
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadAnalytics(selectedMonth, hasLoadedRef.current);
  }, [loadAnalytics, selectedMonth]);

  const maxTrendRegistrations = useMemo(() => {
    const values = analytics?.trend.map((item) => item.registrations) ?? [];
    return Math.max(...values, 1);
  }, [analytics]);

  const maxDayRegistrations = useMemo(() => {
    const values = analytics?.dayStats.map((item) => item.registrations) ?? [];
    return Math.max(...values, 1);
  }, [analytics]);

  const statusSummary = useMemo(() => {
    const getCount = (key: "pendente" | "edited" | "cancelado") =>
      analytics?.statusBreakdown.find((status) => status.key === key)?.count ?? 0;

    return {
      pending: getCount("pendente"),
      edited: getCount("edited"),
      canceled: getCount("cancelado"),
    };
  }, [analytics]);

  const handleMonthChange = (nextMonth: string) => {
    if (!nextMonth) return;
    setSelectedMonth(nextMonth);
  };

  const handleRefresh = () => {
    void loadAnalytics(selectedMonth, hasLoadedRef.current);
  };

  const handleToggleMetricRow = (key: string) => {
    setExpandedMetricKey((current) => (current === key ? null : key));
  };

  const renderTrendRow = (
    item: AdminAnalyticsResponse["trend"][number],
    index: number
  ) => {
    const registrationsWidth = Math.min(
      100,
      (item.registrations / maxTrendRegistrations) * 100
    );
    const validatedWidth = Math.min(
      100,
      (item.validated / maxTrendRegistrations) * 100
    );

    return (
      <div key={item.month} className="rounded-xl border border-border/70 bg-muted/20 p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">
              {index === analytics!.trend.length - 1
                ? `${capitalizeLabel(item.label)} (mês atual)`
                : capitalizeLabel(item.label)}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {formatNumber(item.activePlayers)} jogadores ativos, {formatNumber(item.newUsers)}{" "}
              cadastro(s)
            </p>
          </div>
          <div className="shrink-0 text-right text-[11px] text-muted-foreground">
            <p>{formatNumber(item.registrations)} registros</p>
            <p>{formatNumber(item.validated)} validadas</p>
          </div>
        </div>

        <div className="relative mt-3 h-2.5 overflow-hidden rounded-full bg-slate-200">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-sky-300"
            style={{ width: `${registrationsWidth}%` }}
          />
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-emerald-500"
            style={{ width: `${validatedWidth}%` }}
          />
        </div>
      </div>
    );
  };

  const renderDayRow = (item: AdminAnalyticsDay) => (
    <MetricBarRow
      detailKey={`day-${item.date}`}
      key={item.date}
      label={item.label}
      secondaryLabel={item.weekday}
      registrations={item.registrations}
      validated={item.validated}
      pending={item.pending}
      edited={item.edited}
      canceled={item.canceled}
      uniquePlayers={item.uniquePlayers}
      maxRegistrations={maxDayRegistrations}
      expanded={expandedMetricKey === `day-${item.date}`}
      onToggle={handleToggleMetricRow}
    />
  );

  const renderDayRowsWithWeekDividers = (items: AdminAnalyticsDay[]) =>
    items.map((item, index) => {
      const shouldRenderDivider = index > 0 && item.weekday === "Seg";

      return (
        <div key={item.date} className="space-y-3">
          {shouldRenderDivider ? <div className="border-t border-dashed border-border/70" /> : null}
          {renderDayRow(item)}
        </div>
      );
    });

  return (
    <AppShell
      title="Métricas"
      subtitle="Uso registrado do app, jogos e status das partidas"
      showBack
    >
      <div className="space-y-4">
        <section className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <ShieldCheck className="h-5 w-5 text-primary" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">
                Leitura do app com base nos dados já registrados
              </p>
              <p className="text-xs text-muted-foreground">
                Este painel reúne registros de partidas, confirmações, cadastros,
                pendências e ações administrativas. Ele mostra como o app está sendo
                usado na escola com base no que já foi registrado no sistema.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex flex-col items-stretch gap-3">
            <div className="flex-1">
              <label
                htmlFor="analytics-month"
                className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground"
              >
                Mês analisado
              </label>
              <Input
                id="analytics-month"
                type="month"
                value={selectedMonth}
                onChange={(event) => handleMonthChange(event.target.value)}
                min={analytics?.firstAvailableMonth}
                max={getCurrentMonthKey()}
                className="block [&::-webkit-calendar-picker-indicator]:ml-auto"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={handleRefresh}
              disabled={loading || refreshing}
              className="w-full"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>
          {analytics ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Leitura focada em <span className="font-medium text-foreground">
                {capitalizeLabel(analytics.selectedMonthLabel)}
              </span>
              {analytics.isFirstAvailableMonth ? (
                <>
                  . Início do histórico do app em{" "}
                  <span className="font-medium text-foreground">
                    {capitalizeLabel(analytics.firstAvailableMonthLabel)}
                  </span>
                  .
                </>
              ) : (
                <>
                  . Comparativos usam <span className="font-medium text-foreground">
                    {capitalizeLabel(analytics.previousMonthLabel)}
                  </span>
                  .
                </>
              )}
            </p>
          ) : null}
        </section>

        {error ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 sm:flex-row sm:items-center">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <div className="min-w-0 flex-1">{error}</div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleRefresh}
              className="w-full border-red-200 bg-white sm:w-auto"
            >
              Tentar de novo
            </Button>
          </div>
        ) : null}

        {loading && !analytics ? (
          <LoadingState />
        ) : analytics ? (
          <Tabs defaultValue="resumo" className="space-y-4">
            <TabsList className="grid h-auto w-full grid-cols-3 rounded-2xl bg-muted p-1">
              <TabsTrigger value="resumo" className="px-2 py-2 text-[11px] sm:px-3 sm:text-xs">
                Resumo do mês
              </TabsTrigger>
              <TabsTrigger value="dias" className="px-2 py-2 text-[11px] sm:px-3 sm:text-xs">
                Mês
              </TabsTrigger>
              <TabsTrigger value="jogadores" className="px-2 py-2 text-[11px] sm:px-3 sm:text-xs">
                Jogadores
              </TabsTrigger>
            </TabsList>

            <TabsContent value="resumo" className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <MetricCard
                  title="Registros"
                  value={formatNumber(analytics.summary.registrations)}
                  description={formatDelta(
                    analytics.summary.registrationsDelta,
                    analytics.previousMonthLabel,
                    !analytics.isFirstAvailableMonth
                  )}
                  tone="border-sky-200 bg-sky-50"
                />
                <MetricCard
                  title="Validadas"
                  value={formatNumber(analytics.summary.validated)}
                  description={`${formatPercentage(analytics.summary.validationRate)} do total do mês`}
                  tone="border-emerald-200 bg-emerald-50"
                />
                <MetricCard
                  title="Jogadores ativos"
                  value={formatNumber(analytics.summary.activePlayers)}
                  description={`${formatPercentage(analytics.summary.participationRate)} da base ativa (${formatNumber(
                    analytics.summary.activeAccounts
                  )})`}
                  tone="border-violet-200 bg-violet-50"
                />
                <MetricCard
                  title="Média por dia"
                  value={String(analytics.summary.averagePerDay)}
                  description={
                    analytics.isCurrentMonth
                      ? analytics.summary.registrations > 0
                        ? `${formatHours(analytics.summary.hoursSinceLastRegistration)} h desde o último registro`
                        : `${formatHours(analytics.summary.hoursSinceLastRegistration)} h já passadas sem registros no mês`
                      : `${formatHours(analytics.summary.longestGapWithoutRegistrations)} h no maior intervalo sem registros`
                  }
                  tone="border-amber-200 bg-amber-50"
                />
                <MetricCard
                  title="Novos cadastros"
                  value={formatNumber(analytics.summary.newUsers)}
                  description={formatDelta(
                    analytics.summary.newUsersDelta,
                    analytics.previousMonthLabel,
                    !analytics.isFirstAvailableMonth
                  )}
                  tone="border-blue-200 bg-blue-50"
                />
                <MetricCard
                  title="Pendências abertas"
                  value={formatNumber(analytics.summary.openPending)}
                  description="Jogos aguardando acompanhamento do admin"
                  tone="border-rose-200 bg-rose-50"
                  actionHref="/admin/pendencias"
                  actionLabel="Abrir pendências"
                />
              </div>

              <SectionCard
                icon={Activity}
                title="Leituras rápidas"
                description="Sinais que ajudam a entender o ritmo de uso e gargalos do mês."
              >
                <div className="space-y-3">
                  {analytics.insights.map((insight) => (
                    <div
                      key={insight}
                      className="rounded-xl border border-border/70 bg-muted/20 p-3 text-sm text-foreground"
                    >
                      {insight}
                    </div>
                  ))}
                </div>
              </SectionCard>

              <SectionCard
                icon={Clock3}
                title="Status das partidas"
                description="Distribuição de status e pontos que costumam pedir acompanhamento do admin."
              >
                <div className="space-y-3">
                  {analytics.statusBreakdown.map((status) => (
                    <div key={status.key} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="font-medium text-foreground">{status.label}</span>
                        <span className="text-muted-foreground">
                          {formatNumber(status.count)} ({formatPercentage(status.percentage)})
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${status.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      Pendentes no mês
                    </p>
                    <p className="mt-2 text-lg font-semibold text-foreground">
                      {formatNumber(statusSummary.pending)}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Jogos ainda aguardando confirmação
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      Contestadas no mês
                    </p>
                    <p className="mt-2 text-lg font-semibold text-foreground">
                      {formatNumber(statusSummary.edited)}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Jogos que voltaram para revisão
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      Canceladas no mês
                    </p>
                    <p className="mt-2 text-lg font-semibold text-foreground">
                      {formatNumber(statusSummary.canceled)}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Registros que foram invalidados
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      Ações admin no mês
                    </p>
                    <p className="mt-2 text-lg font-semibold text-foreground">
                      {formatNumber(analytics.summary.adminActions)}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Intervenções registradas no período
                    </p>
                    <button
                      type="button"
                      onClick={() => setAdminActionsModalOpen(true)}
                      className="mt-3 text-xs font-semibold text-primary underline-offset-4 hover:underline"
                    >
                      Ver detalhamento
                    </button>
                  </div>
                </div>
              </SectionCard>

              <SectionCard
                icon={TrendingUp}
                title="Tendência de 6 meses"
                description="Barra azul mostra registros. Barra verde mostra jogos validados."
              >
                <div className="space-y-3">
                  {analytics.trend.map(renderTrendRow)}
                </div>
              </SectionCard>
            </TabsContent>

            <TabsContent value="dias" className="space-y-4">
              <SectionCard
                icon={CalendarDays}
                title="Todos os dias do mês"
                description="Leitura dia a dia do mês, com divisores entre as semanas."
              >
                <div className="space-y-3">
                  {renderDayRowsWithWeekDividers(analytics.dayStats)}
                </div>
              </SectionCard>
            </TabsContent>

            <TabsContent value="jogadores" className="space-y-4">
              <SectionCard
                icon={Users}
                title="Jogadores mais ativos"
                description="Comparativo entre o mês inteiro e o recorte mais recente dentro do período."
              >
                <div className="space-y-3">
                  <TopPlayersGroup
                    title="Do mês"
                    description="Ranking do recorte mensal com registros não cancelados."
                    players={analytics.topPlayersMonth}
                    emptyMessage="Ainda não há jogadores com atividade suficiente neste mês."
                  />
                  <TopPlayersGroup
                    title="Dos últimos 7 dias"
                    description={`Recorte mais recente do período: ${analytics.last7DaysRangeLabel}.`}
                    players={analytics.topPlayersLast7Days}
                    emptyMessage="Ainda não há jogadores com atividade suficiente nos últimos 7 dias."
                  />
                </div>
              </SectionCard>

              <SectionCard
                icon={Activity}
                title="Rivalidades mais recorrentes"
                description="Pares que mais se enfrentaram no recorte selecionado."
              >
                <div className="space-y-3">
                  {analytics.topRivalries.length === 0 ? (
                    <EmptyList message="Ainda não há rivalidades suficientes para comparar neste mês." />
                  ) : (
                    analytics.topRivalries.map((rivalry) => (
                      <RivalryRow
                        key={rivalry.id}
                        name={rivalry.playersLabel}
                        registrations={rivalry.registrations}
                        validated={rivalry.validated}
                      />
                    ))
                  )}
                </div>
              </SectionCard>

              <SectionCard
                icon={ShieldCheck}
                title="Como interpretar"
                description="Leitura recomendada para o admin usar este painel no dia a dia."
              >
                <div className="space-y-3 text-sm text-foreground">
                  <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                    Compare registros com validadas para entender se o app está sendo usado
                    e se as partidas estão sendo concluídas sem atrito.
                  </div>
                  <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                    Use a aba do mês para identificar em quais dias vale
                    reforçar divulgação, torneios internos ou lembretes de confirmação.
                  </div>
                  <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                    Use as abas de resumo, mês e jogadores para acompanhar frequência de uso,
                    concentração dos jogos e quem mais movimenta o ranking na escola.
                  </div>
                </div>
              </SectionCard>
            </TabsContent>
          </Tabs>
        ) : null}

        {analytics ? (
          <InfoModal
            open={adminActionsModalOpen}
            onClose={() => setAdminActionsModalOpen(false)}
            title="Ações admin no mês"
            description={`Total de ${formatNumber(analytics.summary.adminActions)} ação(ões) administrativas em ${capitalizeLabel(
              analytics.selectedMonthLabel
            )}.`}
          >
            {analytics.adminActionBreakdown.length === 0 ? (
              <EmptyList message="Nenhuma ação administrativa registrada neste mês." />
            ) : (
              <div className="space-y-2">
                {analytics.adminActionBreakdown.map((item) => (
                  <div
                    key={item.key}
                    className="rounded-xl border border-border/70 bg-muted/20 px-3 py-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm text-foreground">{item.label}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {item.description}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-foreground">
                        {formatNumber(item.count)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </InfoModal>
        ) : null}
      </div>
    </AppShell>
  );
}
