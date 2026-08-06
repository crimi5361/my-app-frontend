import { ReactNode } from "react";

interface PageContainerProps {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}

// Enveloppe de page standard : fixe une fois pour toutes le padding de page
// (jusqu'ici tantôt `padding:24`, tantôt `'24px'`, tantôt `p-6` selon les
// écrans) et une zone titre/actions optionnelle, cohérente d'un module à
// l'autre. Purement visuel — ne remplace ni PageHeader (fil d'Ariane) ni la
// logique métier des pages qui l'utilisent.
const PageContainer = ({ title, description, actions, children }: PageContainerProps) => (
  <div style={{ padding: 24 }}>
    {(title || actions) && (
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 20,
          flexWrap: "wrap",
        }}
      >
        <div>
          {title && (
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "var(--text)" }} className="font-display">
              {title}
            </h2>
          )}
          {description && (
            <p style={{ margin: "4px 0 0", color: "var(--text-soft)", fontSize: 13 }}>{description}</p>
          )}
        </div>
        {actions && <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{actions}</div>}
      </div>
    )}
    {children}
  </div>
);

export default PageContainer;
