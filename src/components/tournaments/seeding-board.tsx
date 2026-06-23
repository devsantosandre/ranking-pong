"use client";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import type { TournamentParticipant } from "@/lib/tournaments/types";
import { getSeedColor } from "@/lib/tournaments/seed-colors";

interface SeedingBoardProps {
  participants: TournamentParticipant[];
  onChange: (reordered: TournamentParticipant[]) => void;
  disabled?: boolean;
}

export function SeedingBoard({ participants, onChange, disabled }: SeedingBoardProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = participants.findIndex((p) => p.id === active.id);
    const newIndex = participants.findIndex((p) => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onChange(arrayMove(participants, oldIndex, newIndex));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={participants.map((p) => p.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2">
          {participants.map((participant, index) => (
            <SeedRow
              key={participant.id}
              participant={participant}
              seed={index + 1}
              disabled={disabled}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SeedRow({ participant: p, seed, disabled }: { participant: TournamentParticipant; seed: number; disabled?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: p.id,
    disabled,
  });

  const { bg, color, border } = getSeedColor(seed);

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        background: isDragging
          ? "color-mix(in srgb, var(--arena-primary) 10%, var(--arena-bg-2))"
          : "color-mix(in srgb, var(--arena-foreground) 4%, var(--arena-bg-2))",
        border: isDragging
          ? "1.5px solid color-mix(in srgb, var(--arena-primary) 35%, transparent)"
          : "1.5px solid color-mix(in srgb, var(--arena-foreground) 8%, transparent)",
        boxShadow: isDragging
          ? "0 8px 24px color-mix(in srgb, var(--arena-primary) 20%, transparent)"
          : "none",
        zIndex: isDragging ? 50 : undefined,
      }}
      className="flex items-center gap-3 rounded-xl p-3 transition-shadow"
    >
      {/* Drag handle */}
      <button
        type="button"
        className="shrink-0 transition"
        style={{
          color: disabled ? "transparent" : isDragging ? "var(--arena-primary)" : "color-mix(in srgb, var(--arena-foreground) 25%, transparent)",
          cursor: disabled ? "not-allowed" : isDragging ? "grabbing" : "grab",
        }}
        {...attributes}
        {...listeners}
        aria-label={`Mover ${p.guestName ?? "participante"}`}
        tabIndex={0}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Seed avatar */}
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums"
        style={{ background: bg, color, border: `1px solid ${border}` }}
      >
        {seed}
      </div>

      {/* Flag */}
      {p.flag && (
        <span className={`fi fi-${p.flag.toLowerCase()} shrink-0 text-sm`} aria-hidden />
      )}

      {/* Nome */}
      <span
        className="flex-1 truncate text-sm font-semibold"
        style={{ color: "var(--arena-foreground)" }}
      >
        {p.guestName ?? `Participante ${seed}`}
      </span>

      {/* Seed original */}
      {p.seed && p.seed !== seed && (
        <span
          className="shrink-0 text-[10px] tabular-nums"
          style={{ color: "var(--arena-muted)" }}
        >
          era #{p.seed}
        </span>
      )}
    </div>
  );
}
