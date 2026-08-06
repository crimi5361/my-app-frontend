import { ReactNode, memo } from "react";
import { Empty } from "antd";

interface EmptyStateProps {
  title?: string;
  description?: string;
  action?: ReactNode;
}

// Gestion uniforme des états vides (tableaux, listes) — point 1 du complément
// au plan de refonte. À utiliser via `locale.emptyText` sur ui/DataTable ou
// directement dans toute page listant des données.
const EmptyState = ({ title = "Aucune donnée", description, action }: EmptyStateProps) => (
  <div style={{ padding: "40px 16px", textAlign: "center" }}>
    <Empty
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description={
        <div>
          <div style={{ color: "var(--text)", fontWeight: 600 }}>{title}</div>
          {description && (
            <div style={{ color: "var(--text-soft)", fontSize: 13, marginTop: 4 }}>{description}</div>
          )}
        </div>
      }
    >
      {action}
    </Empty>
  </div>
);

export default memo(EmptyState);
