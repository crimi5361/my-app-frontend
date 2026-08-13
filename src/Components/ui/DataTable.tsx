import { CSSProperties, ReactNode, useCallback, useMemo } from "react";
import { Input, Table } from "antd";
import type { TableProps } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import EmptyState from "./EmptyState";

interface DataTableProps<T extends object> {
  columns: TableProps<T>["columns"];
  dataSource: T[];
  rowKey: TableProps<T>["rowKey"];
  loading?: boolean;
  /** Barre de recherche harmonisée — omise si `onSearchChange` n'est pas fourni. */
  searchValue?: string;
  searchPlaceholder?: string;
  onSearchChange?: (value: string) => void;
  /** Slot pour des filtres (Select, DatePicker...) affichés à côté de la recherche. */
  filters?: ReactNode;
  /** Slot pour l'action principale de la page (ex. bouton "Ajouter"). */
  toolbarExtra?: ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  pagination?: TableProps<T>["pagination"];
  scroll?: TableProps<T>["scroll"];
  /** Ligne de synthèse (ex. TOTAL GÉNÉRAL) — transmise telle quelle à antd Table. */
  summary?: TableProps<T>["summary"];
  /** Classe de ligne conditionnelle (ex. surbrillance selon un statut métier). */
  rowClassName?: TableProps<T>["rowClassName"];
  /** Composants personnalisés (ex. cellule éditable) — cas avancés uniquement. */
  components?: TableProps<T>["components"];
  style?: CSSProperties;
  /** Callback bas niveau antd (pagination/tri/filtres serveur) — cas avancés uniquement. */
  onChange?: TableProps<T>["onChange"];
  /** En-tête collant — grands tableaux avec défilement vertical. */
  sticky?: TableProps<T>["sticky"];
  /** Sélection de lignes — écrans avec action groupée (ex. allocation des salles en lot). */
  rowSelection?: TableProps<T>["rowSelection"];
}

const DEFAULT_PAGE_SIZE_OPTIONS = ["10", "20", "50", "100"];

// Standard unique de tableau — cf. "Partie 4 · Le standard Table" du plan de
// refonte : hauteur de ligne, pagination, recherche, filtres et état vide
// identiques sur ~80% des écrans. Purement présentationnel : ce composant ne
// transforme ni ne valide aucune donnée, il ne fait qu'afficher ce que la
// page lui passe.
function DataTable<T extends object>({
  columns,
  dataSource,
  rowKey,
  loading,
  searchValue,
  searchPlaceholder = "Rechercher…",
  onSearchChange,
  filters,
  toolbarExtra,
  emptyTitle,
  emptyDescription,
  pagination,
  scroll,
  summary,
  rowClassName,
  components,
  style,
  onChange,
  sticky,
  rowSelection,
}: DataTableProps<T>) {
  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onSearchChange?.(e.target.value),
    [onSearchChange]
  );

  const resolvedPagination = useMemo<TableProps<T>["pagination"]>(() => {
    if (pagination === false) return false;
    return {
      showSizeChanger: true,
      pageSizeOptions: DEFAULT_PAGE_SIZE_OPTIONS,
      showTotal: (total) => `${total} résultat${total > 1 ? "s" : ""}`,
      ...pagination,
    };
  }, [pagination]);

  const showToolbar = onSearchChange || filters || toolbarExtra;

  return (
    <div className="ui-datatable">
      {showToolbar && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 16,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            {onSearchChange && (
              <Input
                allowClear
                prefix={<SearchOutlined style={{ color: "var(--text-soft)" }} />}
                placeholder={searchPlaceholder}
                value={searchValue}
                onChange={handleSearchChange}
                style={{ width: 260 }}
              />
            )}
            {filters}
          </div>
          {toolbarExtra && <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{toolbarExtra}</div>}
        </div>
      )}
      <div style={{ overflowX: "auto" }}>
        <Table<T>
          columns={columns}
          dataSource={dataSource}
          rowKey={rowKey}
          loading={loading}
          size="middle"
          pagination={resolvedPagination}
          scroll={scroll ?? { x: "max-content" }}
          summary={summary}
          rowClassName={rowClassName}
          components={components}
          style={style}
          onChange={onChange}
          sticky={sticky}
          rowSelection={rowSelection}
          locale={{
            emptyText: <EmptyState title={emptyTitle} description={emptyDescription} />,
          }}
        />
      </div>
    </div>
  );
}

export default DataTable;
