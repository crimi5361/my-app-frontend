/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Popconfirm, Select, message, Tabs, Tag } from "antd";
import { DeleteOutlined, DownloadOutlined, ReloadOutlined } from "@ant-design/icons";
import * as XLSX from "xlsx";
import PageHeader from "../../Components/PageHeader/PageHeader";
import PageContainer from "../../Components/ui/PageContainer";
import DataTable from "../../Components/ui/DataTable";
import StatusTag from "../../Components/ui/StatusTag";
import { apiFetch, ApiError } from "../../lib/api";

interface AdmissionEnAttente {
  id: number;
  nom: string;
  prenoms: string;
  telephone: string | null;
  code_paiement: string | null;
  source_inscription: string;
  date_inscription: string;
  filiere: string | null;
  niveau: string | null;
  annee_academique: string | null;
  anciennete_jours: number;
}

interface ReinscriptionEnAttente {
  id: number;
  etudiant_id: number;
  statut: string;
  created_at: string;
  code_paiement: string | null;
  nom: string;
  prenoms: string;
  telephone: string | null;
  matricule_iipea: string;
  niveau_retenu: string | null;
  annee_academique: string | null;
  anciennete_jours: number;
}

// Téléphone potentiellement NULL ou chaîne vide en base (etudiant.telephone, nullable) — jamais
// "undefined"/"null" affiché, un tiret cohérent avec le reste du tableau (cf. colonne Filière).
const afficherTelephone = (v: string | null) => v || <span style={{ color: "var(--text-soft)" }}>—</span>;

// Chantier 11 (2026-08-04) — sous-phase finale, point 3 : outil réservé aux administrateurs pour
// nettoyer les dossiers d'admission/réinscription jamais finalisés. Aucune suppression automatique
// — l'administrateur décide au cas par cas, dossier par dossier.
const DossiersEnAttente = () => {
  const [admissions, setAdmissions] = useState<AdmissionEnAttente[]>([]);
  const [reinscriptions, setReinscriptions] = useState<ReinscriptionEnAttente[]>([]);
  const [loading, setLoading] = useState(false);

  // Recherche/filtre 100% client : l'endpoint renvoie déjà la liste complète en un seul appel
  // (aucune pagination/recherche côté serveur sur cet écran, cf. exporterExcel plus bas) — pas de
  // debounce nécessaire, il n'y a aucun aller-retour réseau à économiser.
  const [admissionSearch, setAdmissionSearch] = useState("");
  const [admissionOrigine, setAdmissionOrigine] = useState<string | null>(null);
  const [admissionPage, setAdmissionPage] = useState(1);
  const [admissionPageSize, setAdmissionPageSize] = useState(10);

  const [reinscriptionSearch, setReinscriptionSearch] = useState("");
  const [reinscriptionStatut, setReinscriptionStatut] = useState<string | null>(null);
  const [reinscriptionPage, setReinscriptionPage] = useState(1);
  const [reinscriptionPageSize, setReinscriptionPageSize] = useState(10);

  // Retour à la page 1 à chaque changement de recherche/filtre — sans ça, une recherche qui
  // réduit fortement le nombre de résultats pourrait laisser l'utilisateur sur une page vide.
  useEffect(() => { setAdmissionPage(1); }, [admissionSearch, admissionOrigine]);
  useEffect(() => { setReinscriptionPage(1); }, [reinscriptionSearch, reinscriptionStatut]);

  const admissionsFiltrees = useMemo(() => {
    const q = admissionSearch.trim().toLowerCase();
    return admissions.filter((a) => {
      if (admissionOrigine && a.source_inscription !== admissionOrigine) return false;
      if (!q) return true;
      return [a.nom, a.prenoms, a.telephone, a.code_paiement, a.filiere, a.niveau, a.annee_academique]
        .some((v) => v && String(v).toLowerCase().includes(q));
    });
  }, [admissions, admissionSearch, admissionOrigine]);

  const reinscriptionsFiltrees = useMemo(() => {
    const q = reinscriptionSearch.trim().toLowerCase();
    return reinscriptions.filter((r) => {
      if (reinscriptionStatut && r.statut !== reinscriptionStatut) return false;
      if (!q) return true;
      return [r.nom, r.prenoms, r.telephone, r.matricule_iipea, r.niveau_retenu, r.annee_academique]
        .some((v) => v && String(v).toLowerCase().includes(q));
    });
  }, [reinscriptions, reinscriptionSearch, reinscriptionStatut]);

  const reinitialiserFiltresAdmissions = () => { setAdmissionSearch(""); setAdmissionOrigine(null); };
  const reinitialiserFiltresReinscriptions = () => { setReinscriptionSearch(""); setReinscriptionStatut(null); };

  const fetchDossiers = useCallback(() => {
    setLoading(true);
    apiFetch<{ data: { admissions: AdmissionEnAttente[]; reinscriptions: ReinscriptionEnAttente[] } }>("/api/admin/dossiers-en-attente")
      .then((res) => {
        setAdmissions(res.data.admissions);
        setReinscriptions(res.data.reinscriptions);
      })
      .catch((e) => { if (e instanceof ApiError && e.status === 401) return; message.error("Erreur lors du chargement des dossiers en attente"); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchDossiers(); }, [fetchDossiers]);

  const supprimerAdmission = async (id: number) => {
    try {
      await apiFetch(`/api/admin/dossiers-en-attente/admission/${id}`, { method: "DELETE" });
      message.success("Dossier d'admission supprimé");
      fetchDossiers();
    } catch (e) {
      if (e instanceof ApiError) { message.error(e.message); return; }
      message.error("Erreur lors de la suppression");
    }
  };

  const supprimerReinscription = async (id: number) => {
    try {
      await apiFetch(`/api/admin/dossiers-en-attente/reinscription/${id}`, { method: "DELETE" });
      message.success("Dossier de réinscription supprimé");
      fetchDossiers();
    } catch (e) {
      if (e instanceof ApiError) { message.error(e.message); return; }
      message.error("Erreur lors de la suppression");
    }
  };

  const ancienneteTone = (jours: number): "success" | "warning" | "danger" => {
    if (jours >= 30) return "danger";
    if (jours >= 7) return "warning";
    return "success";
  };

  // ✅ Export client uniquement — l'endpoint /api/admin/dossiers-en-attente renvoie déjà la liste
  // complète en un seul appel (aucune pagination/filtre côté serveur sur cet écran) : l'export
  // réutilise directement les données déjà chargées dans `admissions`/`reinscriptions`, jamais un
  // second appel API ni une requête SQL dupliquée. Mêmes valeurs que le tableau affiché, ligne par
  // ligne — aucune divergence possible.
  const exporterExcel = (lignes: Record<string, unknown>[], feuille: string, prefixeFichier: string) => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(lignes);
    XLSX.utils.book_append_sheet(wb, ws, feuille);
    XLSX.writeFile(wb, `${prefixeFichier}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Exporte la liste actuellement affichée (recherche/filtre appliqués) — cohérent avec ce que
  // l'administrateur voit à l'écran au moment du clic, jamais une liste plus large en silence.
  const exporterAdmissions = () => {
    if (admissionsFiltrees.length === 0) {
      message.warning("Aucun dossier d'admission à exporter.");
      return;
    }
    exporterExcel(
      admissionsFiltrees.map((a) => ({
        "Nom": a.nom,
        "Prénoms": a.prenoms,
        "Téléphone": a.telephone || "",
        "Filière": a.filiere || "",
        "Niveau": a.niveau || "",
        "Année": a.annee_academique || "",
        "Code paiement": a.code_paiement || "",
        "Origine": a.source_inscription === "web" ? "Portail Web" : "Agent",
        "Ancienneté (jours)": a.anciennete_jours,
      })),
      "Admissions",
      "admissions_en_attente"
    );
  };

  const exporterReinscriptions = () => {
    if (reinscriptionsFiltrees.length === 0) {
      message.warning("Aucun dossier de réinscription à exporter.");
      return;
    }
    exporterExcel(
      reinscriptionsFiltrees.map((r) => ({
        "Nom": r.nom,
        "Prénoms": r.prenoms,
        "Téléphone": r.telephone || "",
        "Matricule IIPEA": r.matricule_iipea,
        "Niveau retenu": r.niveau_retenu || "",
        "Année": r.annee_academique || "",
        "Statut": r.statut === "non_eligible" ? "Non éligible" : "En attente de paiement",
        "Ancienneté (jours)": r.anciennete_jours,
      })),
      "Réinscriptions",
      "reinscriptions_en_attente"
    );
  };

  const admissionColumns = [
    { title: "Nom", key: "nom", render: (_: any, r: AdmissionEnAttente) => `${r.nom} ${r.prenoms}` },
    { title: "Téléphone", dataIndex: "telephone", key: "telephone", render: afficherTelephone },
    { title: "Filière", dataIndex: "filiere", key: "filiere", render: (v: string | null) => v || <span style={{ color: "var(--text-soft)" }}>—</span> },
    { title: "Niveau", dataIndex: "niveau", key: "niveau" },
    { title: "Année", dataIndex: "annee_academique", key: "annee_academique" },
    { title: "Code paiement", dataIndex: "code_paiement", key: "code_paiement" },
    { title: "Origine", dataIndex: "source_inscription", key: "source_inscription", render: (v: string) => <Tag>{v === "web" ? "Portail Web" : "Agent"}</Tag> },
    {
      title: "Ancienneté", dataIndex: "anciennete_jours", key: "anciennete_jours",
      sorter: (a: AdmissionEnAttente, b: AdmissionEnAttente) => a.anciennete_jours - b.anciennete_jours,
      render: (j: number) => <StatusTag tone={ancienneteTone(j)} label={`${j} jour${j > 1 ? "s" : ""}`} />,
    },
    {
      title: "Action", key: "action",
      render: (_: any, r: AdmissionEnAttente) => (
        <Popconfirm
          title="Supprimer ce dossier d'admission ?"
          description="Cette action est définitive : étudiant, pièces déclarées et scolarité provisoire seront supprimés."
          onConfirm={() => supprimerAdmission(r.id)}
          okText="Supprimer"
          cancelText="Annuler"
        >
          <Button danger size="small" icon={<DeleteOutlined />}>Supprimer</Button>
        </Popconfirm>
      ),
    },
  ];

  const reinscriptionColumns = [
    { title: "Nom", key: "nom", render: (_: any, r: ReinscriptionEnAttente) => `${r.nom} ${r.prenoms}` },
    { title: "Téléphone", dataIndex: "telephone", key: "telephone", render: afficherTelephone },
    { title: "Matricule IIPEA", dataIndex: "matricule_iipea", key: "matricule_iipea" },
    { title: "Niveau retenu", dataIndex: "niveau_retenu", key: "niveau_retenu" },
    { title: "Année", dataIndex: "annee_academique", key: "annee_academique" },
    {
      title: "Statut", dataIndex: "statut", key: "statut",
      render: (s: string) => <StatusTag tone={s === "non_eligible" ? "danger" : "warning"} label={s === "non_eligible" ? "Non éligible" : "En attente de paiement"} />,
    },
    {
      title: "Ancienneté", dataIndex: "anciennete_jours", key: "anciennete_jours",
      sorter: (a: ReinscriptionEnAttente, b: ReinscriptionEnAttente) => a.anciennete_jours - b.anciennete_jours,
      render: (j: number) => <StatusTag tone={ancienneteTone(j)} label={`${j} jour${j > 1 ? "s" : ""}`} />,
    },
    {
      title: "Action", key: "action",
      render: (_: any, r: ReinscriptionEnAttente) => (
        <Popconfirm
          title="Supprimer ce dossier de réinscription ?"
          description="Cette action est définitive."
          onConfirm={() => supprimerReinscription(r.id)}
          okText="Supprimer"
          cancelText="Annuler"
        >
          <Button danger size="small" icon={<DeleteOutlined />}>Supprimer</Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      <PageHeader />
      <PageContainer
        title="Dossiers en attente"
        description="Nettoyage des admissions et réinscriptions jamais finalisées — réservé aux administrateurs"
      >
        <Tabs
          defaultActiveKey="admissions"
          items={[
            {
              key: "admissions",
              label: `Admissions (${admissions.length})`,
              children: (
                <DataTable<AdmissionEnAttente>
                  columns={admissionColumns}
                  dataSource={admissionsFiltrees}
                  rowKey="id"
                  loading={loading}
                  searchValue={admissionSearch}
                  searchPlaceholder="Nom, téléphone, code paiement…"
                  onSearchChange={setAdmissionSearch}
                  filters={
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <Select
                        allowClear
                        placeholder="Origine"
                        style={{ width: 160 }}
                        value={admissionOrigine ?? undefined}
                        onChange={(v) => setAdmissionOrigine(v ?? null)}
                        options={[
                          { value: "web", label: "Portail Web" },
                          { value: "agent", label: "Agent" },
                        ]}
                      />
                      {(admissionSearch || admissionOrigine) && (
                        <Button icon={<ReloadOutlined />} onClick={reinitialiserFiltresAdmissions}>
                          Réinitialiser
                        </Button>
                      )}
                    </div>
                  }
                  emptyTitle={admissions.length === 0 ? "Aucune admission en attente" : "Aucun résultat"}
                  emptyDescription={
                    admissions.length === 0
                      ? "Tous les dossiers d'admission ont été finalisés ou n'ont jamais été laissés en suspens."
                      : "Aucun dossier d'admission ne correspond à votre recherche ou aux filtres sélectionnés."
                  }
                  pagination={{
                    current: admissionPage,
                    pageSize: admissionPageSize,
                    onChange: (page, pageSize) => { setAdmissionPage(page); setAdmissionPageSize(pageSize); },
                  }}
                  toolbarExtra={
                    <Button icon={<DownloadOutlined />} onClick={exporterAdmissions} disabled={admissionsFiltrees.length === 0}>
                      Exporter Excel
                    </Button>
                  }
                />
              ),
            },
            {
              key: "reinscriptions",
              label: `Réinscriptions (${reinscriptions.length})`,
              children: (
                <DataTable<ReinscriptionEnAttente>
                  columns={reinscriptionColumns}
                  dataSource={reinscriptionsFiltrees}
                  rowKey="id"
                  loading={loading}
                  searchValue={reinscriptionSearch}
                  searchPlaceholder="Nom, téléphone, matricule…"
                  onSearchChange={setReinscriptionSearch}
                  filters={
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <Select
                        allowClear
                        placeholder="Statut"
                        style={{ width: 190 }}
                        value={reinscriptionStatut ?? undefined}
                        onChange={(v) => setReinscriptionStatut(v ?? null)}
                        options={[
                          { value: "en_attente_paiement", label: "En attente de paiement" },
                          { value: "non_eligible", label: "Non éligible" },
                        ]}
                      />
                      {(reinscriptionSearch || reinscriptionStatut) && (
                        <Button icon={<ReloadOutlined />} onClick={reinitialiserFiltresReinscriptions}>
                          Réinitialiser
                        </Button>
                      )}
                    </div>
                  }
                  emptyTitle={reinscriptions.length === 0 ? "Aucune réinscription en attente" : "Aucun résultat"}
                  emptyDescription={
                    reinscriptions.length === 0
                      ? "Tous les dossiers de réinscription ont été finalisés ou n'ont jamais été laissés en suspens."
                      : "Aucun dossier de réinscription ne correspond à votre recherche ou aux filtres sélectionnés."
                  }
                  pagination={{
                    current: reinscriptionPage,
                    pageSize: reinscriptionPageSize,
                    onChange: (page, pageSize) => { setReinscriptionPage(page); setReinscriptionPageSize(pageSize); },
                  }}
                  toolbarExtra={
                    <Button icon={<DownloadOutlined />} onClick={exporterReinscriptions} disabled={reinscriptionsFiltrees.length === 0}>
                      Exporter Excel
                    </Button>
                  }
                />
              ),
            },
          ]}
        />
      </PageContainer>
    </div>
  );
};

export default DossiersEnAttente;
