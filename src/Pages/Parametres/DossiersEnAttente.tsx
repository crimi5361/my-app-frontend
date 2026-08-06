/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from "react";
import { Button, Popconfirm, message, Tabs, Tag } from "antd";
import { DeleteOutlined } from "@ant-design/icons";
import PageHeader from "../../Components/PageHeader/PageHeader";
import PageContainer from "../../Components/ui/PageContainer";
import DataTable from "../../Components/ui/DataTable";
import StatusTag from "../../Components/ui/StatusTag";
import { apiFetch, ApiError } from "../../lib/api";

interface AdmissionEnAttente {
  id: number;
  nom: string;
  prenoms: string;
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
  matricule_iipea: string;
  niveau_retenu: string | null;
  annee_academique: string | null;
  anciennete_jours: number;
}

// Chantier 11 (2026-08-04) — sous-phase finale, point 3 : outil réservé aux administrateurs pour
// nettoyer les dossiers d'admission/réinscription jamais finalisés. Aucune suppression automatique
// — l'administrateur décide au cas par cas, dossier par dossier.
const DossiersEnAttente = () => {
  const [admissions, setAdmissions] = useState<AdmissionEnAttente[]>([]);
  const [reinscriptions, setReinscriptions] = useState<ReinscriptionEnAttente[]>([]);
  const [loading, setLoading] = useState(false);

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

  const admissionColumns = [
    { title: "Nom", key: "nom", render: (_: any, r: AdmissionEnAttente) => `${r.nom} ${r.prenoms}` },
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
                  dataSource={admissions}
                  rowKey="id"
                  loading={loading}
                  emptyTitle="Aucune admission en attente"
                  emptyDescription="Tous les dossiers d'admission ont été finalisés ou n'ont jamais été laissés en suspens."
                />
              ),
            },
            {
              key: "reinscriptions",
              label: `Réinscriptions (${reinscriptions.length})`,
              children: (
                <DataTable<ReinscriptionEnAttente>
                  columns={reinscriptionColumns}
                  dataSource={reinscriptions}
                  rowKey="id"
                  loading={loading}
                  emptyTitle="Aucune réinscription en attente"
                  emptyDescription="Tous les dossiers de réinscription ont été finalisés ou n'ont jamais été laissés en suspens."
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
