import { ReactNode, memo } from "react";

interface StatCardProps {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  tone?: "ink" | "gold" | "success" | "warning" | "danger";
  hint?: string;
}

const TONE_BG: Record<NonNullable<StatCardProps["tone"]>, string> = {
  ink: "rgba(16, 26, 51, 0.06)",
  gold: "rgba(198, 154, 75, 0.14)",
  success: "rgba(30, 142, 90, 0.12)",
  warning: "rgba(183, 121, 31, 0.12)",
  danger: "rgba(192, 57, 43, 0.12)",
};

const TONE_FG: Record<NonNullable<StatCardProps["tone"]>, string> = {
  ink: "var(--ink)",
  gold: "var(--gold)",
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
};

// Carte statistique standard pour les dashboards (Phase 2) — même esprit
// visuel que Hub (surface + ombre douce + accent restreint à l'icône).
const StatCard = ({ label, value, icon, tone = "ink", hint }: StatCardProps) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 14,
      padding: "18px 20px",
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 14,
      boxShadow: "var(--shadow)",
    }}
  >
    {icon && (
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 20,
          background: TONE_BG[tone],
          color: TONE_FG[tone],
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
    )}
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 12, color: "var(--text-soft)", fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", lineHeight: 1.3 }} className="font-display">
        {value}
      </div>
      {hint && <div style={{ fontSize: 12, color: "var(--text-soft)" }}>{hint}</div>}
    </div>
  </div>
);

export default memo(StatCard);
