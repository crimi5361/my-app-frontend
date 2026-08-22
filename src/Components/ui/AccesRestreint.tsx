import { memo } from "react";
import { Result } from "antd";
import { LockOutlined } from "@ant-design/icons";

interface AccesRestreintProps {
  description?: string;
}

// Permissions individuelles (Chantier Moyens Généraux, Phase 1, 2026-08-19) — affiché à la place
// du contenu d'une page quand le collaborateur connecté n'a pas la permission "voir" de ce module.
// Amélioration UX uniquement : le backend revalide systématiquement (middleware/permission.middleware.js),
// ce masquage frontend n'est jamais la seule protection.
const AccesRestreint = ({ description = "Vous n'avez pas la permission nécessaire pour consulter cette page." }: AccesRestreintProps) => (
  <Result
    icon={<LockOutlined style={{ color: "var(--text-soft)" }} />}
    title="Accès restreint"
    subTitle={description}
  />
);

export default memo(AccesRestreint);
