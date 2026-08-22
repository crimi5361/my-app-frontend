/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import { Button, Modal, Form, InputNumber, Select, Input, message, Popconfirm, Space, Descriptions, Alert } from "antd";
import { PlusOutlined, SendOutlined, InboxOutlined, StopOutlined } from "@ant-design/icons";
import PageHeader from "../../Components/PageHeader/PageHeader";
import PageContainer from "../../Components/ui/PageContainer";
import DataTable from "../../Components/ui/DataTable";
import StatusTag from "../../Components/ui/StatusTag";
import AccesRestreint from "../../Components/ui/AccesRestreint";
import { apiFetch, ApiError } from "../../lib/api";
import { hasPermission } from "../../lib/permissions";

const { Option } = Select;

interface Site { id: number; nom: string; adresse: string | null; }
interface AccessoireOption { id: number; nom: string; actif: boolean; }

interface Transfert {
  id: number;
  reference: string;
  quantite_demandee: number;
  quantite_receptionnee: number | null;
  statut: "BROUILLON" | "ENVOYE" | "RECEPTIONNE" | "ANNULE";
  accessoire_id: number;
  accessoire_nom: string;
  accessoire_code: string;
  site_source_id: number;
  site_source_nom: string;
  site_destination_id: number;
  site_destination_nom: string;
  cree_par_nom: string;
  envoye_par_nom: string | null;
  receptionne_par_nom: string | null;
  annule_par_nom: string | null;
  motif_annulation: string | null;
  observation_reception: string | null;
  date_creation: string;
  date_envoi: string | null;
  date_reception: string | null;
  date_annulation: string | null;
  // Calculé côté backend (transfertStock.controller.js::enrichirAvecPermissionReception) — couvre
  // à la fois la réception normale (site destinataire) et la dérogation transitoire (site source,
  // quand le site destinataire n'a pas encore d'agent actif). Ne jamais recalculer cette règle ici :
  // le backend revalide de toute façon à l'appel réel.
  peut_receptionner_ici: boolean;
}

const STATUT_TONE: Record<Transfert["statut"], "warning" | "info" | "success" | "danger"> = {
  BROUILLON: "warning",
  ENVOYE: "info",
  RECEPTIONNE: "success",
  ANNULE: "danger",
};
const STATUT_LABEL: Record<Transfert["statut"], string> = {
  BROUILLON: "Brouillon",
  ENVOYE: "Envoyé — en transit",
  RECEPTIONNE: "Réceptionné",
  ANNULE: "Annulé",
};

const getUserInfo = () => {
  try {
    const userStr = localStorage.getItem("user");
    if (!userStr) return null;
    const user = JSON.parse(userStr);
    if (!user.departement_id) {
      const deptId = localStorage.getItem("departement_id");
      if (deptId) user.departement_id = parseInt(deptId, 10);
    }
    return user;
  } catch {
    return null;
  }
};

// Chantier Moyens Généraux, Phase 2E (2026-08-19) — transferts d'accessoires entre sites.
// Cycle : BROUILLON (créé par le site source) → ENVOYE (stock source décrémenté) → RECEPTIONNE
// (stock destination incrémenté, état terminal) → ANNULE (uniquement depuis BROUILLON).
const Transferts = () => {
  const moiSiteId: number | undefined = getUserInfo()?.departement_id;
  const peutCreer = hasPermission("transfert.creer");
  const peutReceptionner = hasPermission("transfert.receptionner");
  const peutVoir = hasPermission("stock.voir") || peutCreer || peutReceptionner;

  const [transferts, setTransferts] = useState<Transfert[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [accessoires, setAccessoires] = useState<AccessoireOption[]>([]);
  const [loading, setLoading] = useState(false);

  const [filtreDirection, setFiltreDirection] = useState<"tous" | "envoyes" | "recus">("tous");
  const [filtreStatut, setFiltreStatut] = useState<Transfert["statut"] | "tous">("tous");
  const [search, setSearch] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const [receptionCible, setReceptionCible] = useState<Transfert | null>(null);
  const [receptionForm] = Form.useForm();
  const [receptionSaving, setReceptionSaving] = useState(false);

  const fetchTransferts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("direction", filtreDirection);
      if (filtreStatut !== "tous") params.set("statut", filtreStatut);
      const res = await apiFetch<{ data: Transfert[] }>(`/api/moyens-generaux/transferts?${params.toString()}`);
      setTransferts(res.data);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return;
      message.error("Erreur lors du chargement des transferts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!peutVoir) return;
    apiFetch<Site[]>("/api/sites").then(setSites).catch(() => {});
    apiFetch<{ data: AccessoireOption[] }>("/api/moyens-generaux/accessoires").then((r) => setAccessoires(r.data.filter((a) => a.actif))).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!peutVoir) return;
    fetchTransferts();
  }, [filtreDirection, filtreStatut]); // eslint-disable-line react-hooks/exhaustive-deps

  const sitesDestinationPossibles = useMemo(() => sites.filter((s) => s.id !== moiSiteId), [sites, moiSiteId]);

  const filteredTransferts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return transferts;
    return transferts.filter((t) =>
      t.reference.toLowerCase().includes(q)
      || t.accessoire_nom.toLowerCase().includes(q)
      || t.site_source_nom.toLowerCase().includes(q)
      || t.site_destination_nom.toLowerCase().includes(q)
    );
  }, [transferts, search]);

  const openCreate = () => {
    form.resetFields();
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const res = await apiFetch<{ data: Transfert }>("/api/moyens-generaux/transferts", {
        method: "POST",
        body: JSON.stringify(values),
      });
      message.success(`Transfert créé en brouillon — référence ${res.data.reference}`);
      setIsModalOpen(false);
      fetchTransferts();
    } catch (e) {
      if (e instanceof ApiError) { message.error(e.message); return; }
      if ((e as any)?.errorFields) return;
      message.error("Erreur lors de la création du transfert");
    } finally {
      setSaving(false);
    }
  };

  const envoyerTransfert = async (t: Transfert) => {
    try {
      await apiFetch(`/api/moyens-generaux/transferts/${t.id}/envoyer`, { method: "POST" });
      message.success("Transfert envoyé — stock source décrémenté");
      fetchTransferts();
    } catch (e) {
      if (e instanceof ApiError) { message.error(e.message); return; }
      message.error("Erreur lors de l'envoi du transfert");
    }
  };

  const annulerTransfert = async (t: Transfert) => {
    const motif = window.prompt("Motif de l'annulation (obligatoire) :");
    if (!motif || !motif.trim()) return;
    try {
      await apiFetch(`/api/moyens-generaux/transferts/${t.id}/annuler`, {
        method: "PATCH", body: JSON.stringify({ motif: motif.trim() }),
      });
      message.success("Transfert annulé");
      fetchTransferts();
    } catch (e) {
      if (e instanceof ApiError) { message.error(e.message); return; }
      message.error("Erreur lors de l'annulation");
    }
  };

  const ouvrirReception = (t: Transfert) => {
    setReceptionCible(t);
    receptionForm.setFieldsValue({ quantite_receptionnee: t.quantite_demandee, observation: undefined });
  };

  const confirmerReception = async () => {
    if (!receptionCible) return;
    try {
      const values = await receptionForm.validateFields();
      setReceptionSaving(true);
      await apiFetch(`/api/moyens-generaux/transferts/${receptionCible.id}/receptionner`, {
        method: "POST",
        body: JSON.stringify(values),
      });
      message.success("Transfert réceptionné — stock destination mis à jour");
      setReceptionCible(null);
      fetchTransferts();
    } catch (e) {
      if (e instanceof ApiError) { message.error(e.message); return; }
      if ((e as any)?.errorFields) return;
      message.error("Erreur lors de la réception");
    } finally {
      setReceptionSaving(false);
    }
  };

  const columns = [
    { title: "Référence", dataIndex: "reference", key: "reference" },
    { title: "Accessoire", dataIndex: "accessoire_nom", key: "accessoire_nom" },
    {
      title: "Site source", dataIndex: "site_source_nom", key: "site_source_nom",
      render: (v: string, r: Transfert) => r.site_source_id === moiSiteId ? <strong>{v} (moi)</strong> : v,
    },
    {
      title: "Site destination", dataIndex: "site_destination_nom", key: "site_destination_nom",
      render: (v: string, r: Transfert) => r.site_destination_id === moiSiteId ? <strong>{v} (moi)</strong> : v,
    },
    { title: "Qté demandée", dataIndex: "quantite_demandee", key: "quantite_demandee", align: "right" as const },
    {
      title: "Qté reçue", dataIndex: "quantite_receptionnee", key: "quantite_receptionnee", align: "right" as const,
      render: (v: number | null) => v ?? <span style={{ color: "var(--text-soft)" }}>—</span>,
    },
    {
      title: "Statut", dataIndex: "statut", key: "statut",
      render: (v: Transfert["statut"]) => <StatusTag tone={STATUT_TONE[v]} label={STATUT_LABEL[v]} />,
    },
    {
      title: "Créé le", dataIndex: "date_creation", key: "date_creation",
      render: (v: string) => new Date(v).toLocaleDateString("fr-FR"),
    },
    {
      title: "Action", key: "action",
      render: (_: any, r: Transfert) => (
        <Space>
          {r.statut === "BROUILLON" && r.site_source_id === moiSiteId && peutCreer && (
            <>
              <Popconfirm title="Envoyer ce transfert ? Le stock source sera décrémenté." onConfirm={() => envoyerTransfert(r)} okText="Envoyer" cancelText="Annuler">
                <Button size="small" type="primary" icon={<SendOutlined />}>Envoyer</Button>
              </Popconfirm>
              <Button size="small" danger icon={<StopOutlined />} onClick={() => annulerTransfert(r)}>Annuler</Button>
            </>
          )}
          {r.statut === "ENVOYE" && r.peut_receptionner_ici && peutReceptionner && (
            <Button size="small" type="primary" icon={<InboxOutlined />} onClick={() => ouvrirReception(r)}>
              {r.site_destination_id === moiSiteId ? "Réceptionner" : "Réceptionner (pour le site destinataire)"}
            </Button>
          )}
        </Space>
      ),
    },
  ];

  if (!peutVoir) {
    return (
      <div>
        <PageHeader />
        <AccesRestreint description="Vous n'avez pas la permission de consulter les transferts entre sites." />
      </div>
    );
  }

  return (
    <div>
      <PageHeader />
      <PageContainer
        title="Transferts entre sites"
        description="Chaque site gère son propre stock — un transfert déplace un accessoire d'un site vers un autre, avec réception obligatoire avant que le stock destinataire n'augmente."
      >
        <DataTable<Transfert>
          columns={columns}
          dataSource={filteredTransferts}
          rowKey="id"
          loading={loading}
          searchValue={search}
          searchPlaceholder="Rechercher par référence, accessoire ou site"
          onSearchChange={setSearch}
          filters={
            <>
              <Select value={filtreDirection} onChange={setFiltreDirection} style={{ width: 160 }}>
                <Option value="tous">Tous</Option>
                <Option value="envoyes">Envoyés par moi</Option>
                <Option value="recus">Reçus par moi</Option>
              </Select>
              <Select value={filtreStatut} onChange={setFiltreStatut} style={{ width: 200 }}>
                <Option value="tous">Tous les statuts</Option>
                <Option value="BROUILLON">Brouillon</Option>
                <Option value="ENVOYE">Envoyé — en transit</Option>
                <Option value="RECEPTIONNE">Réceptionné</Option>
                <Option value="ANNULE">Annulé</Option>
              </Select>
            </>
          }
          toolbarExtra={
            peutCreer ? (
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                Nouveau transfert
              </Button>
            ) : undefined
          }
          emptyTitle="Aucun transfert"
          emptyDescription="Créez un transfert pour déplacer un accessoire vers un autre site."
        />
      </PageContainer>

      <Modal
        title="Nouveau transfert"
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={handleSubmit}
        okText="Créer en brouillon"
        cancelText="Annuler"
        confirmLoading={saving}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="accessoire_id" label="Accessoire" rules={[{ required: true, message: "Accessoire requis" }]}>
            <Select placeholder="Sélectionner un accessoire" showSearch optionFilterProp="children">
              {accessoires.map((a) => <Option key={a.id} value={a.id}>{a.nom}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="quantite_demandee" label="Quantité à transférer" rules={[{ required: true, message: "Quantité requise" }]}>
            <InputNumber min={1} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="site_destination_id" label="Site destinataire" rules={[{ required: true, message: "Site destinataire requis" }]}>
            <Select placeholder="Sélectionner le site destinataire">
              {sitesDestinationPossibles.map((s) => <Option key={s.id} value={s.id}>{s.nom}</Option>)}
            </Select>
          </Form.Item>
          <Alert
            type="info"
            showIcon
            message="Le transfert est créé en brouillon — le stock ne sera décrémenté qu'après avoir cliqué « Envoyer »."
          />
        </Form>
      </Modal>

      <Modal
        title={`Réceptionner ${receptionCible?.reference ?? ""}`}
        open={receptionCible !== null}
        onCancel={() => setReceptionCible(null)}
        onOk={confirmerReception}
        okText="Confirmer la réception"
        cancelText="Annuler"
        confirmLoading={receptionSaving}
      >
        {receptionCible && (
          <>
            <Descriptions column={1} size="small" bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Accessoire">{receptionCible.accessoire_nom}</Descriptions.Item>
              <Descriptions.Item label="Site expéditeur">{receptionCible.site_source_nom}</Descriptions.Item>
              <Descriptions.Item label="Site destinataire">{receptionCible.site_destination_nom}</Descriptions.Item>
              <Descriptions.Item label="Quantité demandée">{receptionCible.quantite_demandee}</Descriptions.Item>
            </Descriptions>
            {receptionCible.site_destination_id !== moiSiteId && (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 16 }}
                message={`Vous déclarez cette réception pour le compte de ${receptionCible.site_destination_nom}, faute d'agent actif sur ce site. Le stock sera bien crédité à ${receptionCible.site_destination_nom}, pas au vôtre.`}
              />
            )}
            <Form form={receptionForm} layout="vertical">
              <Form.Item
                name="quantite_receptionnee"
                label="Quantité réellement réceptionnée"
                tooltip="Peut différer de la quantité demandée (ex. casse en transit)."
                rules={[{ required: true, message: "Quantité requise" }]}
              >
                <InputNumber min={1} style={{ width: "100%" }} />
              </Form.Item>
              <Form.Item name="observation" label="Observation (facultative)">
                <Input.TextArea rows={2} placeholder="Ex : 2 unités endommagées à l'arrivée" />
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>
    </div>
  );
};

export default Transferts;
