/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import { Button, Modal, Form, Select, InputNumber, Input, message, Popconfirm, Table, Drawer, Descriptions, Empty } from "antd";
import { PlusOutlined, EditOutlined, SendOutlined, CloseCircleOutlined, EyeOutlined, DeleteOutlined, InboxOutlined } from "@ant-design/icons";
import PageHeader from "../../Components/PageHeader/PageHeader";
import PageContainer from "../../Components/ui/PageContainer";
import DataTable from "../../Components/ui/DataTable";
import StatusTag from "../../Components/ui/StatusTag";
import { apiFetch, ApiError } from "../../lib/api";

const { Option } = Select;

interface Fournisseur {
  id: number;
  nom: string;
  statut: "actif" | "inactif";
}

interface Accessoire {
  id: number;
  code: string;
  nom: string;
  actif: boolean;
}

interface LigneCommande {
  id?: number;
  accessoire_id: number;
  code?: string;
  nom?: string;
  quantite_commandee: number;
  quantite_recue?: number;
}

interface Reception {
  id: number;
  date_reception: string;
  reference_bl: string | null;
  observation: string | null;
  recu_par: string;
  lignes: { accessoire: string; code: string; quantite: number }[];
}

interface Commande {
  id: number;
  statut: "brouillon" | "envoyee" | "partiellement_recue" | "receptionnee" | "annulee";
  date_commande: string;
  created_at: string;
  updated_at: string;
  fournisseur_id: number;
  fournisseur_nom: string;
  nombre_lignes: number;
  quantite_totale_commandee: number;
  quantite_totale_recue: number;
  lignes?: LigneCommande[];
}

const STATUT_TONE: Record<Commande["statut"], "success" | "warning" | "danger" | "info" | "neutral"> = {
  brouillon: "neutral",
  envoyee: "info",
  partiellement_recue: "warning",
  receptionnee: "success",
  annulee: "danger",
};

const STATUT_LABEL: Record<Commande["statut"], string> = {
  brouillon: "Brouillon",
  envoyee: "Envoyée",
  partiellement_recue: "Partiellement reçue",
  receptionnee: "Réceptionnée",
  annulee: "Annulée",
};

const Commandes = () => {
  const [commandes, setCommandes] = useState<Commande[]>([]);
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [accessoires, setAccessoires] = useState<Accessoire[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filtreStatut, setFiltreStatut] = useState<string>("tous");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Commande | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const [lignes, setLignes] = useState<LigneCommande[]>([]);
  const [ligneAccessoireId, setLigneAccessoireId] = useState<number | null>(null);
  const [ligneQuantite, setLigneQuantite] = useState<number | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailCommande, setDetailCommande] = useState<Commande | null>(null);
  const [receptions, setReceptions] = useState<Reception[]>([]);
  const [loadingReceptions, setLoadingReceptions] = useState(false);

  const [isReceptionModalOpen, setIsReceptionModalOpen] = useState(false);
  const [receptionForm] = Form.useForm();
  const [receptionSaving, setReceptionSaving] = useState(false);
  const [quantitesRecues, setQuantitesRecues] = useState<Record<number, number | null>>({});

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [cmdRes, fourRes, accRes] = await Promise.all([
        apiFetch<{ data: Commande[] }>("/api/moyens-generaux/commandes"),
        apiFetch<{ data: Fournisseur[] }>("/api/moyens-generaux/fournisseurs"),
        apiFetch<{ data: Accessoire[] }>("/api/moyens-generaux/accessoires"),
      ]);
      setCommandes(cmdRes.data);
      setFournisseurs(fourRes.data);
      setAccessoires(accRes.data);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return;
      message.error("Erreur lors du chargement des commandes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const fournisseursActifs = useMemo(() => fournisseurs.filter((f) => f.statut === "actif"), [fournisseurs]);
  const accessoiresActifs = useMemo(() => accessoires.filter((a) => a.actif), [accessoires]);

  const filteredCommandes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return commandes.filter((c) => {
      const matchStatut = filtreStatut === "tous" || c.statut === filtreStatut;
      const matchSearch = !q || c.fournisseur_nom.toLowerCase().includes(q) || String(c.id).includes(q);
      return matchStatut && matchSearch;
    });
  }, [commandes, search, filtreStatut]);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setLignes([]);
    setLigneAccessoireId(null);
    setLigneQuantite(null);
    setIsModalOpen(true);
  };

  const openEdit = (commande: Commande) => {
    apiFetch<{ data: Commande }>(`/api/moyens-generaux/commandes/${commande.id}`)
      .then((res) => {
        setEditing(res.data);
        form.setFieldsValue({ fournisseur_id: res.data.fournisseur_id });
        setLignes(res.data.lignes ?? []);
        setLigneAccessoireId(null);
        setLigneQuantite(null);
        setIsModalOpen(true);
      })
      .catch(() => message.error("Impossible de charger la commande"));
  };

  const fetchReceptions = (commandeId: number) => {
    setLoadingReceptions(true);
    apiFetch<{ data: Reception[] }>(`/api/moyens-generaux/commandes/${commandeId}/receptions`)
      .then((res) => setReceptions(res.data))
      .catch(() => message.error("Impossible de charger l'historique des réceptions"))
      .finally(() => setLoadingReceptions(false));
  };

  const openDetail = (commande: Commande) => {
    apiFetch<{ data: Commande }>(`/api/moyens-generaux/commandes/${commande.id}`)
      .then((res) => {
        setDetailCommande(res.data);
        setDetailOpen(true);
        fetchReceptions(res.data.id);
      })
      .catch(() => message.error("Impossible de charger la commande"));
  };

  const openReceptionModal = () => {
    if (!detailCommande) return;
    receptionForm.resetFields();
    const defaut: Record<number, number | null> = {};
    (detailCommande.lignes ?? []).forEach((l) => {
      const restant = l.quantite_commandee - (l.quantite_recue ?? 0);
      if (restant > 0) defaut[l.accessoire_id] = restant;
    });
    setQuantitesRecues(defaut);
    setIsReceptionModalOpen(true);
  };

  const handleReceptionSubmit = async () => {
    if (!detailCommande) return;
    try {
      const values = await receptionForm.validateFields();
      const lignesReception = Object.entries(quantitesRecues)
        .filter(([, qte]) => qte && qte > 0)
        .map(([accessoireId, qte]) => ({ accessoire_id: Number(accessoireId), quantite: qte as number }));
      if (lignesReception.length === 0) {
        message.warning("Renseignez au moins une quantité reçue supérieure à 0.");
        return;
      }
      setReceptionSaving(true);
      await apiFetch(`/api/moyens-generaux/commandes/${detailCommande.id}/receptions`, {
        method: "POST",
        body: JSON.stringify({
          reference_bl: values.reference_bl || undefined,
          observation: values.observation || undefined,
          lignes: lignesReception,
        }),
      });
      message.success("Réception enregistrée");
      setIsReceptionModalOpen(false);
      const refreshed = await apiFetch<{ data: Commande }>(`/api/moyens-generaux/commandes/${detailCommande.id}`);
      setDetailCommande(refreshed.data);
      fetchReceptions(detailCommande.id);
      fetchAll();
    } catch (e) {
      if (e instanceof ApiError) { message.error(e.message); return; }
      if ((e as any)?.errorFields) return;
      message.error("Erreur lors de l'enregistrement de la réception");
    } finally {
      setReceptionSaving(false);
    }
  };

  const ajouterLigne = () => {
    if (!ligneAccessoireId || !ligneQuantite || ligneQuantite <= 0) {
      message.warning("Choisissez un accessoire et une quantité positive.");
      return;
    }
    if (lignes.some((l) => l.accessoire_id === ligneAccessoireId)) {
      message.warning("Cet accessoire est déjà présent dans la commande — modifiez la ligne existante plutôt que d'en ajouter une nouvelle.");
      return;
    }
    const accessoire = accessoires.find((a) => a.id === ligneAccessoireId);
    setLignes((prev) => [...prev, { accessoire_id: ligneAccessoireId, quantite_commandee: ligneQuantite, code: accessoire?.code, nom: accessoire?.nom }]);
    setLigneAccessoireId(null);
    setLigneQuantite(null);
  };

  const retirerLigne = (accessoireId: number) => {
    setLignes((prev) => prev.filter((l) => l.accessoire_id !== accessoireId));
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (lignes.length === 0) {
        message.warning("Ajoutez au moins un accessoire à la commande.");
        return;
      }
      setSaving(true);
      const payload = {
        fournisseur_id: values.fournisseur_id,
        lignes: lignes.map((l) => ({ accessoire_id: l.accessoire_id, quantite_commandee: l.quantite_commandee })),
      };
      if (editing) {
        await apiFetch(`/api/moyens-generaux/commandes/${editing.id}`, { method: "PUT", body: JSON.stringify(payload) });
        message.success("Commande mise à jour");
      } else {
        await apiFetch("/api/moyens-generaux/commandes", { method: "POST", body: JSON.stringify(payload) });
        message.success("Commande créée en brouillon");
      }
      setIsModalOpen(false);
      fetchAll();
    } catch (e) {
      if (e instanceof ApiError) { message.error(e.message); return; }
      if ((e as any)?.errorFields) return;
      message.error("Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  const changerStatut = async (commande: Commande, statut: string) => {
    try {
      await apiFetch(`/api/moyens-generaux/commandes/${commande.id}/statut`, { method: "PATCH", body: JSON.stringify({ statut }) });
      message.success("Statut mis à jour");
      fetchAll();
    } catch (e) {
      if (e instanceof ApiError) { message.error(e.message); return; }
      message.error("Erreur lors du changement de statut");
    }
  };

  const columns = [
    { title: "N°", dataIndex: "id", key: "id", width: 70, sorter: (a: Commande, b: Commande) => a.id - b.id },
    { title: "Fournisseur", dataIndex: "fournisseur_nom", key: "fournisseur_nom", sorter: (a: Commande, b: Commande) => a.fournisseur_nom.localeCompare(b.fournisseur_nom) },
    { title: "Lignes", dataIndex: "nombre_lignes", key: "nombre_lignes", align: "right" as const },
    { title: "Qté commandée", dataIndex: "quantite_totale_commandee", key: "quantite_totale_commandee", align: "right" as const },
    { title: "Qté reçue", dataIndex: "quantite_totale_recue", key: "quantite_totale_recue", align: "right" as const },
    {
      title: "Statut", dataIndex: "statut", key: "statut",
      render: (s: Commande["statut"]) => <StatusTag tone={STATUT_TONE[s]} label={STATUT_LABEL[s]} />,
      sorter: (a: Commande, b: Commande) => a.statut.localeCompare(b.statut),
    },
    {
      title: "Date", dataIndex: "date_commande", key: "date_commande",
      render: (v: string) => new Date(v).toLocaleDateString("fr-FR"),
      sorter: (a: Commande, b: Commande) => new Date(a.date_commande).getTime() - new Date(b.date_commande).getTime(),
    },
    {
      title: "Action", key: "action",
      render: (_: any, row: Commande) => (
        <div style={{ display: "flex", gap: 8 }}>
          <Button icon={<EyeOutlined />} size="small" onClick={() => openDetail(row)} />
          {row.statut === "brouillon" && (
            <>
              <Button icon={<EditOutlined />} size="small" onClick={() => openEdit(row)} />
              <Popconfirm title="Envoyer cette commande au fournisseur ?" onConfirm={() => changerStatut(row, "envoyee")} okText="Confirmer" cancelText="Annuler">
                <Button icon={<SendOutlined />} size="small" type="primary" />
              </Popconfirm>
            </>
          )}
          {(row.statut === "brouillon" || row.statut === "envoyee") && (
            <Popconfirm title="Annuler cette commande ?" onConfirm={() => changerStatut(row, "annulee")} okText="Confirmer" cancelText="Annuler">
              <Button icon={<CloseCircleOutlined />} size="small" danger />
            </Popconfirm>
          )}
        </div>
      ),
    },
  ];

  const ligneColumns = [
    { title: "Accessoire", dataIndex: "nom", key: "nom", render: (v: string, r: LigneCommande) => v ?? accessoires.find((a) => a.id === r.accessoire_id)?.nom },
    { title: "Quantité commandée", dataIndex: "quantite_commandee", key: "quantite_commandee", align: "right" as const },
    {
      title: "", key: "retirer", width: 50,
      render: (_: any, r: LigneCommande) => <Button icon={<DeleteOutlined />} size="small" danger onClick={() => retirerLigne(r.accessoire_id)} />,
    },
  ];

  return (
    <div>
      <PageHeader />
      <PageContainer title="Commandes fournisseurs" description="Circuit d'approvisionnement — Moyens Généraux">
        <DataTable<Commande>
          columns={columns}
          dataSource={filteredCommandes}
          rowKey="id"
          loading={loading}
          searchValue={search}
          searchPlaceholder="Rechercher par fournisseur ou numéro"
          onSearchChange={setSearch}
          filters={
            <Select value={filtreStatut} onChange={setFiltreStatut} style={{ width: 200 }}>
              <Option value="tous">Tous les statuts</Option>
              <Option value="brouillon">Brouillon</Option>
              <Option value="envoyee">Envoyée</Option>
              <Option value="partiellement_recue">Partiellement reçue</Option>
              <Option value="receptionnee">Réceptionnée</Option>
              <Option value="annulee">Annulée</Option>
            </Select>
          }
          toolbarExtra={
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              Nouvelle commande
            </Button>
          }
          emptyTitle="Aucune commande"
          emptyDescription="Créez une commande pour démarrer un réapprovisionnement."
        />
      </PageContainer>

      <Modal
        title={editing ? `Modifier la commande #${editing.id}` : "Nouvelle commande"}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={handleSubmit}
        okText="Enregistrer"
        cancelText="Annuler"
        confirmLoading={saving}
        width={640}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="fournisseur_id" label="Fournisseur" rules={[{ required: true, message: "Fournisseur requis" }]}>
            <Select placeholder="Sélectionner un fournisseur" showSearch optionFilterProp="children">
              {fournisseursActifs.map((f) => <Option key={f.id} value={f.id}>{f.nom}</Option>)}
            </Select>
          </Form.Item>
        </Form>

        <div style={{ marginTop: 16, marginBottom: 8, fontWeight: 600 }}>Accessoires commandés</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <Select
            placeholder="Accessoire"
            style={{ flex: 1 }}
            value={ligneAccessoireId}
            onChange={setLigneAccessoireId}
            showSearch
            optionFilterProp="children"
          >
            {accessoiresActifs.map((a) => <Option key={a.id} value={a.id}>{a.nom} ({a.code})</Option>)}
          </Select>
          <InputNumber min={1} placeholder="Quantité" value={ligneQuantite ?? undefined} onChange={(v) => setLigneQuantite(v)} style={{ width: 120 }} />
          <Button onClick={ajouterLigne}>Ajouter</Button>
        </div>
        <Table
          dataSource={lignes}
          columns={ligneColumns}
          rowKey="accessoire_id"
          size="small"
          pagination={false}
          locale={{ emptyText: "Aucun accessoire ajouté" }}
        />
      </Modal>

      <Drawer
        title={detailCommande ? `Commande #${detailCommande.id} — ${detailCommande.fournisseur_nom}` : ""}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        width={520}
        extra={
          detailCommande && ["envoyee", "partiellement_recue"].includes(detailCommande.statut) ? (
            <Button type="primary" icon={<InboxOutlined />} onClick={openReceptionModal}>
              Réceptionner
            </Button>
          ) : undefined
        }
      >
        {detailCommande && (
          <>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Statut"><StatusTag tone={STATUT_TONE[detailCommande.statut]} label={STATUT_LABEL[detailCommande.statut]} /></Descriptions.Item>
              <Descriptions.Item label="Date de commande">{new Date(detailCommande.date_commande).toLocaleDateString("fr-FR")}</Descriptions.Item>
              <Descriptions.Item label="Dernière modification">{new Date(detailCommande.updated_at).toLocaleString("fr-FR")}</Descriptions.Item>
            </Descriptions>
            <div style={{ marginTop: 16, marginBottom: 8, fontWeight: 600 }}>Lignes</div>
            <Table
              dataSource={detailCommande.lignes ?? []}
              rowKey="id"
              size="small"
              pagination={false}
              columns={[
                { title: "Accessoire", dataIndex: "nom" },
                { title: "Commandée", dataIndex: "quantite_commandee", align: "right" as const },
                { title: "Reçue", dataIndex: "quantite_recue", align: "right" as const },
                {
                  title: "Restant", key: "restant", align: "right" as const,
                  render: (_: any, r: LigneCommande) => (r.quantite_commandee - (r.quantite_recue ?? 0)),
                },
              ]}
            />

            <div style={{ marginTop: 24, marginBottom: 8, fontWeight: 600 }}>Historique des réceptions</div>
            {receptions.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {receptions.map((r) => (
                  <div key={r.id} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontWeight: 600 }}>{new Date(r.date_reception).toLocaleDateString("fr-FR")}{r.reference_bl ? ` — BL ${r.reference_bl}` : ""}</span>
                      <span style={{ color: "var(--text-soft)", fontSize: 12 }}>{r.recu_par}</span>
                    </div>
                    {r.observation && <div style={{ fontSize: 12, color: "var(--text-soft)", marginBottom: 6 }}>{r.observation}</div>}
                    <Table
                      dataSource={r.lignes}
                      rowKey="code"
                      size="small"
                      pagination={false}
                      showHeader={false}
                      columns={[
                        { title: "Accessoire", dataIndex: "accessoire" },
                        { title: "Quantité", dataIndex: "quantite", align: "right" as const },
                      ]}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <Empty description={loadingReceptions ? "Chargement…" : "Aucune réception enregistrée pour l'instant"} />
            )}
          </>
        )}
      </Drawer>

      <Modal
        title="Enregistrer une réception"
        open={isReceptionModalOpen}
        onCancel={() => setIsReceptionModalOpen(false)}
        onOk={handleReceptionSubmit}
        okText="Valider la réception"
        cancelText="Annuler"
        confirmLoading={receptionSaving}
        width={560}
      >
        <Form form={receptionForm} layout="vertical">
          <Form.Item name="reference_bl" label="Référence du bon de livraison (facultatif)">
            <Input placeholder="Ex: BL-2026-0451" />
          </Form.Item>
          <Form.Item name="observation" label="Observation (facultatif)">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
        <div style={{ marginBottom: 8, fontWeight: 600 }}>Quantités reçues aujourd'hui</div>
        <Table
          dataSource={(detailCommande?.lignes ?? []).filter((l) => l.quantite_commandee - (l.quantite_recue ?? 0) > 0)}
          rowKey="accessoire_id"
          size="small"
          pagination={false}
          columns={[
            { title: "Accessoire", dataIndex: "nom" },
            {
              title: "Restant à livrer", key: "restant", align: "right" as const,
              render: (_: any, r: LigneCommande) => r.quantite_commandee - (r.quantite_recue ?? 0),
            },
            {
              title: "Quantité reçue", key: "quantite_recue_saisie", align: "right" as const,
              render: (_: any, r: LigneCommande) => {
                const restant = r.quantite_commandee - (r.quantite_recue ?? 0);
                return (
                  <InputNumber
                    min={0}
                    max={restant}
                    value={quantitesRecues[r.accessoire_id] ?? 0}
                    onChange={(v) => setQuantitesRecues((prev) => ({ ...prev, [r.accessoire_id]: v }))}
                    style={{ width: 100 }}
                  />
                );
              },
            },
          ]}
        />
      </Modal>
    </div>
  );
};

export default Commandes;
