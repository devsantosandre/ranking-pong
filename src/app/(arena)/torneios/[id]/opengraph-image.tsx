import { ImageResponse } from "next/og";
import { getTournamentRepo } from "@/lib/tournaments/repo";
import { FORMAT_META } from "@/lib/tournaments/format-meta";

export const runtime = "edge";
export const contentType = "image/png";
export const size = { width: 1200, height: 630 };
export const alt = "Torneio Smash Pong";

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  registration: "Inscrições abertas",
  active: "Em andamento",
  finished: "Encerrado",
};

const STATUS_COLOR: Record<string, string> = {
  draft: "#8b8197",
  registration: "#f5a524",
  active: "#22d3ee",
  finished: "#2dd4a7",
};

export default async function TournamentOGImage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const repo = await getTournamentRepo();
  const tournament = await repo.getTournament(id);

  const name = tournament?.name ?? "Torneio";
  const status = tournament?.status ?? "draft";
  const format = tournament ? FORMAT_META[tournament.format].full : "";
  const bestOf = tournament?.bestOf ?? 3;
  const participants = tournament?.participants.filter((p) => p.signupStatus === "confirmed").length ?? 0;
  const champion = tournament?.championName;
  const statusColor = STATUS_COLOR[status] ?? "#8b8197";
  const statusLabel = STATUS_LABEL[status] ?? status;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#0b0612",
          fontFamily: "sans-serif",
          padding: 60,
          gap: 24,
        }}
      >
        {/* Background gradient */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse 80% 60% at 80% 20%, rgba(192,75,255,0.15) 0%, transparent 70%)",
          }}
        />

        {/* Logo */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            opacity: 0.5,
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#c04bff",
            }}
          />
          <span style={{ color: "#b6a8c9", fontSize: 14, fontWeight: 600, letterSpacing: "0.12em" }}>
            SMASH PONG APP
          </span>
        </div>

        {/* Main content */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 20 }}>
          {/* Status pill */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              borderRadius: 20,
              padding: "6px 14px",
              background: `color-mix(in srgb,${statusColor} 15%,transparent)`,
              border: `1px solid ${statusColor}40`,
              width: "fit-content",
            }}
          >
            <div
              style={{ width: 6, height: 6, borderRadius: "50%", background: statusColor }}
            />
            <span style={{ color: statusColor, fontSize: 12, fontWeight: 700, letterSpacing: "0.1em" }}>
              {statusLabel.toUpperCase()}
            </span>
          </div>

          {/* Title */}
          <div style={{ color: "#f3ecff", fontSize: 56, fontWeight: 800, lineHeight: 1.15 }}>
            {name}
          </div>

          {/* Meta */}
          <div style={{ display: "flex", gap: 24, color: "#b6a8c9", fontSize: 18 }}>
            <span style={{ textTransform: "capitalize" }}>{format}</span>
            <span style={{ opacity: 0.4 }}>·</span>
            <span>MD{bestOf}</span>
            <span style={{ opacity: 0.4 }}>·</span>
            <span>{participants} participantes</span>
          </div>

          {/* Champion banner */}
          {champion && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                borderRadius: 16,
                padding: "14px 20px",
                background: "rgba(45,212,167,0.08)",
                border: "1px solid rgba(45,212,167,0.25)",
                marginTop: 8,
              }}
            >
              <span style={{ fontSize: 28 }}>🏆</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ color: "#2dd4a7", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em" }}>
                  CAMPEÃO
                </span>
                <span style={{ color: "#f3ecff", fontSize: 22, fontWeight: 700 }}>{champion}</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "space-between", color: "#b6a8c9", fontSize: 14, opacity: 0.5 }}>
          <span>smashpong.app</span>
          <span>Arena ◆</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
