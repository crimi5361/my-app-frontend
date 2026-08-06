import { useMemo, useState } from "react";
import { Button, Select, Space, Tag } from "antd";
import { PlusOutlined, PrinterOutlined, TeamOutlined, DollarOutlined, SolutionOutlined, ReadOutlined } from "@ant-design/icons";

import PageContainer from "../../Components/ui/PageContainer";
import Card from "../../Components/ui/Card";
import StatCard from "../../Components/ui/StatCard";
import StatusTag from "../../Components/ui/StatusTag";
import DataTable from "../../Components/ui/DataTable";
import EmptyState from "../../Components/ui/EmptyState";

// Page interne de validation visuelle des primitifs Phase 0 (jetons, ui/*).
// Volontairement non reliée au Sidemenu — accessible uniquement par URL
// directe, réservée aux admins (cf. AppRoutes.tsx). Ne touche à aucune
// donnée réelle : jeu de données fictif, local à cette page.
const SWATCHES: { name: string; varName: string }[] = [
  { name: "ink", varName: "--ink" },
  { name: "gold", varName: "--gold" },
  { name: "paper", varName: "--paper" },
  { name: "mist", varName: "--mist" },
  { name: "success", varName: "--success" },
  { name: "warning", varName: "--warning" },
  { name: "danger", varName: "--danger" },
];

interface FakeDossier {
  id: number;
  nom: string;
  filiere: string;
  statut: "eligible" | "attente" | "rejete";
}

const FAKE_DATA: FakeDossier[] = [
  { id: 1, nom: "Koffi Aya", filiere: "Licence 3 · Info", statut: "eligible" },
  { id: 2, nom: "Diarra Moussa", filiere: "BTS 2 · Gestion", statut: "attente" },
  { id: 3, nom: "Bamba Fatim", filiere: "Master 1 · RH", statut: "eligible" },
  { id: 4, nom: "Ouattara Yves", filiere: "Licence 1 · Info", statut: "rejete" },
];

const STATUT_LABEL: Record<FakeDossier["statut"], { label: string; tone: "success" | "warning" | "danger" }> = {
  eligible: { label: "Éligible", tone: "success" },
  attente: { label: "En attente", tone: "warning" },
  rejete: { label: "Rejeté", tone: "danger" },
};

const UiKit = () => {
  const [search, setSearch] = useState("");
  const [statutFiltre, setStatutFiltre] = useState<string | undefined>();

  const filtered = useMemo(
    () =>
      FAKE_DATA.filter((d) => {
        const matchSearch = d.nom.toLowerCase().includes(search.toLowerCase());
        const matchStatut = !statutFiltre || d.statut === statutFiltre;
        return matchSearch && matchStatut;
      }),
    [search, statutFiltre]
  );

  return (
    <PageContainer
      title="Kit UI — IIPEA (interne)"
      description="Validation visuelle des jetons et des primitifs de la Phase 0. Page non liée au menu, réservée aux admins."
    >
      <Space direction="vertical" size={24} style={{ width: "100%" }}>
        <Card title="Palette de jetons (tokens.css)">
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {SWATCHES.map((s) => (
              <div key={s.name} style={{ textAlign: "center" }}>
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 12,
                    background: `var(${s.varName})`,
                    border: "1px solid var(--border)",
                    boxShadow: "var(--shadow)",
                  }}
                />
                <div style={{ fontSize: 12, marginTop: 6, color: "var(--text-soft)" }}>{s.name}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Typographie">
          <h1 className="font-display" style={{ margin: 0 }}>Titre H1 — Sora</h1>
          <h3 className="font-display" style={{ margin: "8px 0" }}>Titre H3 — Sora</h3>
          <p style={{ margin: 0, color: "var(--text)" }}>
            Texte courant — Manrope. La contradiction avec Tinos (précédemment appliquée à toute l'appli via
            le conteneur racine) a été retirée en Phase 0.
          </p>
        </Card>

        <Card title="Boutons AntD (ConfigProvider étendu)">
          <Space wrap>
            <Button type="primary">Primaire</Button>
            <Button>Défaut</Button>
            <Button type="dashed">Discret</Button>
            <Button type="primary" danger>Danger</Button>
            <Button type="primary" icon={<PlusOutlined />}>Ajouter</Button>
            <Tag color="success">Tag antd success</Tag>
            <Tag color="warning">Tag antd warning</Tag>
          </Space>
        </Card>

        <Card title="StatusTag">
          <Space wrap>
            <StatusTag label="Éligible" tone="success" />
            <StatusTag label="En attente" tone="warning" />
            <StatusTag label="Rejeté" tone="danger" />
            <StatusTag label="Information" tone="info" />
            <StatusTag label="Neutre" tone="neutral" />
          </Space>
        </Card>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          <StatCard label="Étudiants" value={1247} icon={<TeamOutlined />} tone="ink" />
          <StatCard label="Encaissements du jour" value="1 240 000 F" icon={<DollarOutlined />} tone="success" />
          <StatCard label="Dossiers en attente" value={18} icon={<SolutionOutlined />} tone="warning" />
          <StatCard label="Filières actives" value={12} icon={<ReadOutlined />} tone="gold" />
        </div>

        <Card title="DataTable — standard de tableau unique">
          <DataTable<FakeDossier>
            columns={[
              { title: "Étudiant", dataIndex: "nom" },
              { title: "Filière", dataIndex: "filiere" },
              {
                title: "Statut",
                dataIndex: "statut",
                render: (statut: FakeDossier["statut"]) => {
                  const cfg = STATUT_LABEL[statut];
                  return <StatusTag label={cfg.label} tone={cfg.tone} />;
                },
              },
              {
                title: "Actions",
                render: () => <Button size="small" icon={<PrinterOutlined />}>Fiche</Button>,
              },
            ]}
            dataSource={filtered}
            rowKey="id"
            searchValue={search}
            searchPlaceholder="Nom de l'étudiant"
            onSearchChange={setSearch}
            filters={
              <Select
                allowClear
                placeholder="Statut"
                style={{ width: 160 }}
                value={statutFiltre}
                onChange={setStatutFiltre}
                options={[
                  { value: "eligible", label: "Éligible" },
                  { value: "attente", label: "En attente" },
                  { value: "rejete", label: "Rejeté" },
                ]}
              />
            }
            toolbarExtra={<Button type="primary" icon={<PlusOutlined />}>Nouveau dossier</Button>}
            emptyTitle="Aucun dossier"
            emptyDescription="Aucun résultat pour ces filtres."
          />
        </Card>

        <Card title="EmptyState (isolé)">
          <EmptyState
            title="Aucune donnée disponible"
            description="Cet exemple illustre l'état vide standard, hors tableau."
            action={<Button type="primary">Action principale</Button>}
          />
        </Card>
      </Space>
    </PageContainer>
  );
};

export default UiKit;
