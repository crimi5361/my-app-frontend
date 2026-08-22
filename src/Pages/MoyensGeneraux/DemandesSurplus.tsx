/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import { Button, Modal, Form, Input, InputNumber, Select, List, Avatar, message, Popconfirm, Space, Alert, Descriptions } from "antd";
import { PlusOutlined, SearchOutlined, UserOutlined, GiftOutlined, StopOutlined } from "@ant-design/icons";
import PageHeader from "../../Components/PageHeader/PageHeader";
import PageContainer from "../../Components/ui/PageContainer";
import DataTable from "../../Components/ui/DataTable";
import StatusTag from "../../Components/ui/StatusTag";
import AccesRestreint from "../../Components/ui/AccesRestreint";
import { apiFetch, ApiError } from "../../lib/api";
import { hasPermission } from "../../lib/permissions";

const { Option } = Select;

interface AnneeAcademique { id: number; annee: string; }
interface AccessoireOption {
  id: number; nom: string; distribuable_etudiant: boolean; actif: boolean; prix_vente_surplus: number | null;
}
interface EtudiantResultat { id: number; nom: string; prenoms: string; matricule_iipea: string; standing: string; photo_url: string | null; }

interface Demande {
  id: number;
  reference: string;
  quantite: number;
  prix_unitaire_vente: string;
  montant_total: string;
  statut: "EN_ATTENTE_PAIEMENT" | "PAYE" | "DISTRIBUE" | "ANNULE";
  date_demande: string;
  date_paiement: string | null;
  date_distribution: string | null;
  motif_annulation: string | null;
  etudiant_id: number;
  etudiant_nom: string;
  etudiant_prenoms: string;
  matricule_iipea: string;
  accessoire_id: number;
  accessoire_nom: string;
  annee_academique_id: number;
  annee_academique: string;
  demande_par_nom: string;
  paiement_numero_recu: string | null;
  distribution_numero_recu: string | null;
  distribue_par_nom: string | null;
}

const STATUT_TONE: Record<Demande["statut"], "warning" | "info" | "success" | "danger"> = {
  EN_ATTENTE_PAIEMENT: "warning",
  PAYE: "info",
  DISTRIBUE: "success",
  ANNULE: "danger",
};
const STATUT_LABEL: Record<Demande["statut"], string> = {
  EN_ATTENTE_PAIEMENT: "En attente de paiement",
  PAYE: "Payée — distribution disponible",
  DISTRIBUE: "Distribuée",
  ANNULE: "Annulée",
};

const formatFcfa = (v: number | string) => `${Number(v).toLocaleString("fr-FR")} FCFA`;

const DemandesSurplus = () => {
  const peutCreer = hasPermission("distribution.surplus.creer");
  const peutVoir = hasPermission("distribution.voir") || peutCreer;
  const peutDistribuer = hasPermission("distribution.effectuer");

  const [demandes, setDemandes] = useState<Demande[]>([]);
  const [loading, setLoading] = useState(false);
  const [annees, setAnnees] = useState<AnneeAcademique[]>([]);
  const [accessoires, setAccessoires] = useState<AccessoireOption[]>([]);
  const [filtreStatut, setFiltreStatut] = useState<Demande["statut"] | "tous">("tous");
  const [filtreAnnee, setFiltreAnnee] = useState<number | "toutes">("toutes");
  const [search, setSearch] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [resultats, setResultats] = useState<EtudiantResultat[]>([]);
  const [etudiantChoisi, setEtudiantChoisi] = useState<EtudiantResultat | null>(null);

  const anneeSelectionnee = Form.useWatch("annee_academique_id", form);
  const accessoireSelectionne = Form.useWatch("accessoire_id", form);
  const quantiteSaisie = Form.useWatch("quantite", form);

  const fetchDemandes = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filtreStatut !== "tous") params.set("statut", filtreStatut);
      if (filtreAnnee !== "toutes") params.set("annee_academique_id", String(filtreAnnee));
      if (search.trim().length >= 2) params.set("q", search.trim());
      const res = await apiFetch<{ data: Demande[] }>(`/api/moyens-generaux/demandes-surplus?${params.toString()}`);
      setDemandes(res.data);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return;
      message.error("Erreur lors du chargement des demandes de surplus");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!peutVoir) return;
    apiFetch<AnneeAcademique[]>("/api/annees").then(setAnnees).catch(() => {});
    apiFetch<{ data: AccessoireOption[] }>("/api/moyens-generaux/accessoires").then((r) => setAccessoires(r.data)).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!peutVoir) return;
    fetchDemandes();
  }, [filtreStatut, filtreAnnee, search]); // eslint-disable-line react-hooks/exhaustive-deps

  const accessoiresEligibles = useMemo(
    () => accessoires.filter((a) => a.distribuable_etudiant && a.actif && a.prix_vente_surplus !== null),
    [accessoires]
  );

  const accessoireDetail = accessoiresEligibles.find((a) => a.id === accessoireSelectionne);
  const total = accessoireDetail && quantiteSaisie ? Number(accessoireDetail.prix_vente_surplus) * quantiteSaisie : 0;

  const lancerRecherche = async (q: string) => {
    setQuery(q);
    if (q.trim().length < 2 || !anneeSelectionnee) { setResultats([]); return; }
    setSearching(true);
    try {
      const res = await apiFetch<{ data: { etudiants: EtudiantResultat[] } }>(`/api/moyens-generaux/distribution/recherche?q=${encodeURIComponent(q)}&anneeAcademiqueId=${anneeSelectionnee}`);
      setResultats(res.data.etudiants);
    } catch {
      setResultats([]);
    } finally {
      setSearching(false);
    }
  };

  const openCreate = () => {
    form.resetFields();
    setEtudiantChoisi(null);
    setQuery("");
    setResultats([]);
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!etudiantChoisi) {
      message.warning("Sélectionnez un étudiant.");
      return;
    }
    try {
      const values = await form.validateFields();
      setSaving(true);
      const res = await apiFetch<{ data: Demande }>("/api/moyens-generaux/demandes-surplus", {
        method: "POST",
        body: JSON.stringify({
          etudiant_id: etudiantChoisi.id,
          accessoire_id: values.accessoire_id,
          quantite: values.quantite,
          annee_academique_id: values.annee_academique_id,
        }),
      });
      message.success(`Demande créée — référence ${res.data.reference}`);
      setIsModalOpen(false);
      fetchDemandes();
    } catch (e) {
      if (e instanceof ApiError) { message.error(e.message); return; }
      if ((e as any)?.errorFields) return;
      message.error("Erreur lors de la création de la demande");
    } finally {
      setSaving(false);
    }
  };

  const annulerDemande = async (demande: Demande) => {
    const motif = window.prompt("Motif de l'annulation (obligatoire) :");
    if (!motif || !motif.trim()) return;
    try {
      await apiFetch(`/api/moyens-generaux/demandes-surplus/${demande.id}/annuler`, {
        method: "PATCH", body: JSON.stringify({ motif: motif.trim() }),
      });
      message.success("Demande annulée");
      fetchDemandes();
    } catch (e) {
      if (e instanceof ApiError) { message.error(e.message); return; }
      message.error("Erreur lors de l'annulation");
    }
  };

  const distribuerDemande = async (demande: Demande) => {
    try {
      await apiFetch(`/api/moyens-generaux/demandes-surplus/${demande.id}/distribuer`, { method: "POST" });
      message.success("Accessoire distribué — stock décrémenté");
      // Chantier Moyens Généraux, Phase 2D — ajustements (2026-08-19) : le reçu de remise doit être
      // actualisé, pas remplacé (§3/§4) — on ouvre la vue consolidée (offerts + surplus), reflétant
      // l'état complet des remises de cet étudiant, jamais un document distinct du reçu de remise.
      const win = window.open(`/moyens-generaux/recu-consolide/${demande.etudiant_id}?anneeAcademiqueId=${demande.annee_academique_id}`, "_blank");
      if (!win) message.warning("Le navigateur a bloqué l'ouverture automatique du reçu. Autorisez les popups pour ce site.");
      fetchDemandes();
    } catch (e) {
      if (e instanceof ApiError) { message.error(e.message); return; }
      message.error("Erreur lors de la distribution");
    }
  };

  const columns = [
    { title: "Référence", dataIndex: "reference", key: "reference" },
    {
      title: "Étudiant", key: "etudiant",
      render: (_: any, r: Demande) => `${r.etudiant_nom} ${r.etudiant_prenoms}`,
    },
    { title: "Accessoire", dataIndex: "accessoire_nom", key: "accessoire_nom" },
    { title: "Quantité", dataIndex: "quantite", key: "quantite", align: "right" as const },
    {
      title: "Montant", dataIndex: "montant_total", key: "montant_total", align: "right" as const,
      render: (v: string) => formatFcfa(v),
    },
    { title: "Année", dataIndex: "annee_academique", key: "annee_academique" },
    {
      title: "Statut", dataIndex: "statut", key: "statut",
      render: (v: Demande["statut"]) => <StatusTag tone={STATUT_TONE[v]} label={STATUT_LABEL[v]} />,
    },
    {
      title: "Créée le", dataIndex: "date_demande", key: "date_demande",
      render: (v: string) => new Date(v).toLocaleDateString("fr-FR"),
    },
    {
      title: "Paiement", dataIndex: "paiement_numero_recu", key: "paiement_numero_recu",
      render: (v: string | null) => v || <span style={{ color: "var(--text-soft)" }}>—</span>,
    },
    {
      title: "Distribution", dataIndex: "distribution_numero_recu", key: "distribution_numero_recu",
      render: (v: string | null) => v || <span style={{ color: "var(--text-soft)" }}>—</span>,
    },
    {
      title: "Action", key: "action",
      render: (_: any, r: Demande) => (
        <Space>
          {r.statut === "PAYE" && peutDistribuer && (
            <Popconfirm title="Distribuer cet accessoire à l'étudiant ?" onConfirm={() => distribuerDemande(r)} okText="Confirmer" cancelText="Annuler">
              <Button size="small" type="primary" icon={<GiftOutlined />}>Distribuer</Button>
            </Popconfirm>
          )}
          {r.statut === "EN_ATTENTE_PAIEMENT" && (peutCreer || peutDistribuer) && (
            <Button size="small" danger icon={<StopOutlined />} onClick={() => annulerDemande(r)}>Annuler</Button>
          )}
        </Space>
      ),
    },
  ];

  if (!peutVoir) {
    return (
      <div>
        <PageHeader />
        <AccesRestreint description="Vous n'avez pas la permission de consulter les demandes de surplus." />
      </div>
    );
  }

  return (
    <div>
      <PageHeader />
      <PageContainer
        title="Accessoires supplémentaires payants"
        description="Demandes de surplus — un étudiant demande un accessoire hors dotation gratuite ; la distribution n'est autorisée qu'après confirmation du paiement par la Caisse."
      >
        <DataTable<Demande>
          columns={columns}
          dataSource={demandes}
          rowKey="id"
          loading={loading}
          searchValue={search}
          searchPlaceholder="Rechercher par référence, nom ou matricule"
          onSearchChange={setSearch}
          filters={
            <>
              <Select value={filtreStatut} onChange={setFiltreStatut} style={{ width: 220 }}>
                <Option value="tous">Tous les statuts</Option>
                <Option value="EN_ATTENTE_PAIEMENT">En attente de paiement</Option>
                <Option value="PAYE">Payée — distribution disponible</Option>
                <Option value="DISTRIBUE">Distribuée</Option>
                <Option value="ANNULE">Annulée</Option>
              </Select>
              <Select value={filtreAnnee} onChange={setFiltreAnnee} style={{ width: 160 }}>
                <Option value="toutes">Toutes années</Option>
                {annees.map((a) => <Option key={a.id} value={a.id}>{a.annee}</Option>)}
              </Select>
            </>
          }
          toolbarExtra={
            peutCreer ? (
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                Nouvelle demande
              </Button>
            ) : undefined
          }
          emptyTitle="Aucune demande de surplus"
          emptyDescription="Créez une demande pour un accessoire supplémentaire hors dotation gratuite."
        />
      </PageContainer>

      <Modal
        title="Demande d'accessoire supplémentaire"
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={handleSubmit}
        okText="Créer la demande"
        cancelText="Annuler"
        confirmLoading={saving}
        width={560}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="annee_academique_id" label="Année académique" rules={[{ required: true, message: "Année requise" }]}>
            <Select placeholder="Sélectionner une année" onChange={() => { setEtudiantChoisi(null); setResultats([]); setQuery(""); }}>
              {annees.map((a) => <Option key={a.id} value={a.id}>{a.annee}</Option>)}
            </Select>
          </Form.Item>

          {!anneeSelectionnee ? (
            <Alert type="info" showIcon message="Sélectionnez d'abord une année académique" style={{ marginBottom: 16 }} />
          ) : !etudiantChoisi ? (
            <>
              <Input
                allowClear
                prefix={<SearchOutlined />}
                placeholder="Rechercher l'étudiant (nom, prénom, matricule IIPEA)"
                value={query}
                onChange={(e) => lancerRecherche(e.target.value)}
                style={{ marginBottom: 8 }}
              />
              {searching && <div style={{ color: "var(--text-soft)", fontSize: 12 }}>Recherche…</div>}
              {resultats.length > 0 && (
                <List
                  size="small"
                  bordered
                  dataSource={resultats}
                  style={{ marginBottom: 16, maxHeight: 200, overflowY: "auto" }}
                  renderItem={(e) => (
                    <List.Item style={{ cursor: "pointer" }} onClick={() => { setEtudiantChoisi(e); setResultats([]); }}>
                      <List.Item.Meta
                        avatar={<Avatar icon={<UserOutlined />} />}
                        title={`${e.nom} ${e.prenoms}`}
                        description={`Matricule IIPEA : ${e.matricule_iipea}`}
                      />
                    </List.Item>
                  )}
                />
              )}
            </>
          ) : (
            <Descriptions size="small" bordered column={1} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Étudiant">
                {etudiantChoisi.nom} {etudiantChoisi.prenoms}{" "}
                <Button size="small" type="link" onClick={() => setEtudiantChoisi(null)}>Changer</Button>
              </Descriptions.Item>
              <Descriptions.Item label="Matricule IIPEA">{etudiantChoisi.matricule_iipea}</Descriptions.Item>
            </Descriptions>
          )}

          <Form.Item name="accessoire_id" label="Accessoire" rules={[{ required: true, message: "Accessoire requis" }]}>
            <Select placeholder="Sélectionner un accessoire" showSearch optionFilterProp="children">
              {accessoiresEligibles.map((a) => (
                <Option key={a.id} value={a.id}>{a.nom} — {formatFcfa(a.prix_vente_surplus!)}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="quantite" label="Quantité" initialValue={1} rules={[{ required: true, message: "Quantité requise" }]}>
            <InputNumber min={1} style={{ width: "100%" }} />
          </Form.Item>

          {accessoireDetail && (
            <Descriptions size="small" bordered column={2}>
              <Descriptions.Item label="Prix unitaire">{formatFcfa(accessoireDetail.prix_vente_surplus!)}</Descriptions.Item>
              <Descriptions.Item label="Total"><strong>{formatFcfa(total)}</strong></Descriptions.Item>
            </Descriptions>
          )}

          <Alert
            style={{ marginTop: 16 }}
            type="warning"
            showIcon
            message="La distribution sera possible uniquement après confirmation du paiement par la Caisse."
          />
        </Form>
      </Modal>
    </div>
  );
};

export default DemandesSurplus;
