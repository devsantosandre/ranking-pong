"use client";

import { useState, useMemo } from "react";
import { Search, Plus, X, UserCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export interface PickerPlayer {
  id: string;
  name: string;
  rating?: number;
  flag?: string;
}

interface ParticipantPickerProps {
  players: PickerPlayer[];
  selected: PickerPlayer[];
  onAdd: (player: PickerPlayer) => void;
  onRemove: (playerId: string) => void;
  maxParticipants?: number;
  disabled?: boolean;
}

export function ParticipantPicker({
  players,
  selected,
  onAdd,
  onRemove,
  maxParticipants,
  disabled,
}: ParticipantPickerProps) {
  const [query, setQuery] = useState("");

  const selectedIds = useMemo(() => new Set(selected.map((p) => p.id)), [selected]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return players.filter(
      (p) => !selectedIds.has(p.id) && p.name.toLowerCase().includes(q),
    );
  }, [players, selectedIds, query]);

  const atMax = maxParticipants !== undefined && selected.length >= maxParticipants;

  return (
    <div className="flex flex-col gap-3">
      {/* Selecionados */}
      <div className="min-h-[48px] rounded-xl border border-border bg-muted/40 p-2">
        {selected.length === 0 ? (
          <p className="py-1 text-center text-xs text-muted-foreground">
            Nenhum participante adicionado
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {selected.map((p, i) => (
              <span
                key={p.id}
                className="flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
              >
                <span className="tabular-nums text-[10px] font-bold text-primary/50">
                  #{i + 1}
                </span>
                {p.flag && (
                  <span className={`fi fi-${p.flag.toLowerCase()} text-sm`} aria-hidden />
                )}
                {p.name}
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => onRemove(p.id)}
                    className="ml-0.5 rounded hover:text-destructive"
                    aria-label={`Remover ${p.name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Search + lista */}
      {!disabled && !atMax && (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar jogador…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8 text-sm"
            />
          </div>
          <div className="max-h-48 overflow-y-auto rounded-xl border border-border">
            {filtered.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                {query ? "Nenhum resultado" : "Todos os jogadores já foram adicionados"}
              </p>
            ) : (
              filtered.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onAdd(p)}
                  className="flex w-full items-center gap-3 border-b border-border px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-muted/60"
                >
                  {p.flag && (
                    <span className={`fi fi-${p.flag.toLowerCase()} shrink-0 text-base`} aria-hidden />
                  )}
                  <span className="flex-1 text-sm font-medium">{p.name}</span>
                  {p.rating && (
                    <span className="tabular-nums text-[11px] text-muted-foreground">
                      {Math.round(p.rating)}
                    </span>
                  )}
                  <Plus className="h-3.5 w-3.5 text-primary" />
                </button>
              ))
            )}
          </div>
        </>
      )}

      {atMax && (
        <p className="text-center text-xs text-muted-foreground">
          Máximo de {maxParticipants} participantes atingido
        </p>
      )}

      <p className="text-right text-[11px] text-muted-foreground">
        {selected.length}
        {maxParticipants ? `/${maxParticipants}` : ""} participantes
      </p>
    </div>
  );
}
