"use client";

import { useState, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import type { TournamentParticipant } from "@/lib/tournaments/types";
import { getSeedColor } from "@/lib/tournaments/seed-colors";

// ── Tipos ──

type Groups = Map<string, TournamentParticipant[]>;

interface GroupDistributionBoardProps {
  groups: Groups;
  onChange: (groups: Groups) => void;
}

// ── Item arrastável ──

function SortablePlayerItem({
  player,
  overlay = false,
}: {
  player: TournamentParticipant;
  overlay?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: player.id,
  });
  const { bg, color, border } = getSeedColor(player.seed ?? 1);
  const name = player.guestName ?? `Jogador ${player.seed ?? "?"}`;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={[
        "flex items-center gap-2 rounded-xl px-2.5 py-2 select-none",
        "transition-colors duration-100",
        isDragging && !overlay ? "opacity-40" : "",
        overlay ? "shadow-2xl ring-2 ring-white/20" : "",
      ].join(" ")}
      {...attributes}
    >
      <button
        type="button"
        className="touch-none cursor-grab active:cursor-grabbing text-(--arena-muted) hover:text-(--arena-foreground) transition-colors"
        {...listeners}
        aria-label="Arrastar"
      >
        <GripVertical className="h-3.5 w-3.5 shrink-0" />
      </button>
      <div
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
        style={{ background: bg, color, border: `1px solid ${border}` }}
      >
        {player.seed ?? "?"}
      </div>
      <span className="truncate text-xs font-semibold text-(--arena-foreground)">{name}</span>
    </div>
  );
}

// ── Coluna de grupo (droppable + sortable) ──

function GroupColumn({
  label,
  players,
  isOver,
}: {
  label: string;
  players: TournamentParticipant[];
  isOver: boolean;
}) {
  const { setNodeRef } = useDroppable({ id: `group-${label}` });

  return (
    <div
      ref={setNodeRef}
      className="flex flex-col overflow-hidden rounded-2xl transition-all duration-150"
      style={{
        background: isOver
          ? "color-mix(in srgb,var(--arena-primary) 8%,var(--glass-bg))"
          : "var(--glass-bg)",
        border: isOver
          ? "1px solid color-mix(in srgb,var(--arena-primary) 40%,transparent)"
          : "1px solid var(--glass-border)",
        backdropFilter: "blur(12px)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between border-b px-3 py-2"
        style={{ borderColor: "var(--glass-border)" }}
      >
        <p className="text-[10px] font-bold uppercase tracking-widest text-(--arena-muted)">
          Grupo {label}
        </p>
        <span
          className="rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums"
          style={{
            background: "color-mix(in srgb,var(--arena-primary) 10%,transparent)",
            color: "var(--arena-primary)",
          }}
        >
          {players.length}
        </span>
      </div>

      {/* Players */}
      <SortableContext
        id={`group-${label}`}
        items={players.map((p) => p.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-col gap-0.5 p-1.5 min-h-[60px]">
          {players.map((p) => (
            <SortablePlayerItem key={p.id} player={p} />
          ))}
          {players.length === 0 && (
            <div className="flex items-center justify-center py-4">
              <p className="text-[11px] text-(--arena-muted)">Arraste aqui</p>
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

// ── Board principal ──

export function GroupDistributionBoard({ groups, onChange }: GroupDistributionBoardProps) {
  const [activePlayer, setActivePlayer] = useState<TournamentParticipant | null>(null);
  const [overGroupId, setOverGroupId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Encontrar em qual grupo está um player
  const findPlayerGroup = useCallback(
    (playerId: string): string | null => {
      for (const [label, players] of groups) {
        if (players.some((p) => p.id === playerId)) return label;
      }
      return null;
    },
    [groups],
  );

  // Encontrar player por ID
  const findPlayer = useCallback(
    (playerId: string): TournamentParticipant | null => {
      for (const players of groups.values()) {
        const p = players.find((p) => p.id === playerId);
        if (p) return p;
      }
      return null;
    },
    [groups],
  );

  function onDragStart({ active }: DragStartEvent) {
    setActivePlayer(findPlayer(String(active.id)));
  }

  function onDragOver({ active, over }: DragOverEvent) {
    if (!over) { setOverGroupId(null); return; }
    const overId = String(over.id);
    // over pode ser um player ID ou "group-X"
    const targetGroup = overId.startsWith("group-")
      ? overId.replace("group-", "")
      : findPlayerGroup(overId);
    setOverGroupId(targetGroup);
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    setActivePlayer(null);
    setOverGroupId(null);
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    const fromGroup = findPlayerGroup(activeId);
    if (!fromGroup) return;

    // Determinar grupo de destino
    const toGroup = overId.startsWith("group-")
      ? overId.replace("group-", "")
      : findPlayerGroup(overId);
    if (!toGroup) return;

    const player = findPlayer(activeId);
    if (!player) return;

    const next = new Map(Array.from(groups.entries()).map(([k, v]) => [k, [...v]]));

    if (fromGroup === toGroup) {
      // Reordenar dentro do mesmo grupo
      const list = next.get(fromGroup)!;
      const oldIdx = list.findIndex((p) => p.id === activeId);
      const newIdx = list.findIndex((p) => p.id === overId);
      if (oldIdx !== -1 && newIdx !== -1 && oldIdx !== newIdx) {
        list.splice(oldIdx, 1);
        list.splice(newIdx, 0, player);
        next.set(fromGroup, list);
      }
    } else {
      // Mover entre grupos
      const fromList = next.get(fromGroup)!.filter((p) => p.id !== activeId);
      const toList = next.get(toGroup)!;
      // Inserir antes do item sobre o qual foi solto (se for player), ou no fim (se for container)
      if (!overId.startsWith("group-")) {
        const insertIdx = toList.findIndex((p) => p.id === overId);
        toList.splice(insertIdx === -1 ? toList.length : insertIdx, 0, player);
      } else {
        toList.push(player);
      }
      next.set(fromGroup, fromList);
      next.set(toGroup, toList);
    }

    onChange(next);
  }

  const sortedGroups = Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  const numGroups = sortedGroups.length;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
    >
      <div
        className="grid gap-2"
        style={{
          gridTemplateColumns: `repeat(auto-fill, minmax(min(180px, 100%), 1fr))`,
          gridAutoRows: "auto",
        }}
      >
        {sortedGroups.map(([label, players]) => (
          <GroupColumn
            key={label}
            label={label}
            players={players}
            isOver={overGroupId === label}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={null}>
        {activePlayer ? (
          <div
            className="rounded-xl px-2.5 py-2 flex items-center gap-2"
            style={{
              background: "var(--glass-bg-strong)",
              border: "1px solid color-mix(in srgb,var(--arena-primary) 40%,transparent)",
              backdropFilter: "blur(16px)",
              boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
              minWidth: 140,
            }}
          >
            <GripVertical className="h-3.5 w-3.5 shrink-0 text-(--arena-muted)" />
            {(() => {
              const { bg, color, border } = getSeedColor(activePlayer.seed ?? 1);
              return (
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                  style={{ background: bg, color, border: `1px solid ${border}` }}>
                  {activePlayer.seed ?? "?"}
                </div>
              );
            })()}
            <span className="text-xs font-semibold text-(--arena-foreground)">
              {activePlayer.guestName ?? `Jogador ${activePlayer.seed}`}
            </span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
