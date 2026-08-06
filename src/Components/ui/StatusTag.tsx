import { ReactNode, memo } from "react";
import { Tag } from "antd";

export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral";

interface StatusTagProps {
  label: string;
  tone: StatusTone;
  icon?: ReactNode;
}

// Badge de statut unique pour tous les tableaux — cf. "Partie 4 · Le standard
// Table" du plan de refonte : une seule palette badges/statuts pour ~80% des
// écrans, dérivée des jetons de tokens.css (jamais de couleurs antd brutes).
const TONE_STYLES: Record<StatusTone, { color: string; background: string; border: string }> = {
  success: { color: "#1e8e5a", background: "#e7f6ee", border: "#bfe4d1" },
  warning: { color: "#b7791f", background: "#fbf1de", border: "#eed7ab" },
  danger: { color: "#c0392b", background: "#fbeae8", border: "#f0c3bd" },
  info: { color: "#101a33", background: "#eef0f8", border: "#d7dcee" },
  neutral: { color: "#5b6478", background: "#f4f5f9", border: "#e4e7f1" },
};

const StatusTag = ({ label, tone, icon }: StatusTagProps) => {
  const style = TONE_STYLES[tone];
  return (
    <Tag
      icon={icon}
      style={{
        color: style.color,
        background: style.background,
        borderColor: style.border,
        borderRadius: 999,
        padding: "1px 10px",
        fontWeight: 600,
        margin: 0,
      }}
    >
      {label}
    </Tag>
  );
};

export default memo(StatusTag);
