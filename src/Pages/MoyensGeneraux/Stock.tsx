/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Tabs, Button, Modal, Form, Select, InputNumber, Input, message, Statistic, Row, Col, DatePicker, Card } from "antd";
import type { TablePaginationConfig } from "antd";
import { PlusOutlined, InboxOutlined, WarningOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import PageHeader from "../../Components/PageHeader/PageHeader";
import PageContainer from "../../Components/ui/PageContainer";
import DataTable from "../../Components/ui/DataTable";
import StatusTag from "../../Components/ui/StatusTag";
import { apiFetch, ApiError } from "../../lib/api";

const { Option } = Select;
const { RangePicker } = DatePicker;

interface EtatStockLigne {
  accessoire_id: number;
  code: string;
  nom: string;
  seuil_alerte: number;
  solde: number;
  en_alerte: boolean;
  statut: "normal" | "stock_faible" | "rupture";
  cout_unitaire_reference: number | null;
  valeur_estimee: number | null;
}

interface Mouvement {
  id: number;
  type: string;
  quantite: number;
  reference_type: string | null;
  date_mouvement: string;
  motif: string | null;
  accessoire_id: number;
  code: string;
  accessoire_nom: string;
  agent_id: number;
  agent_nom: string;
}

interface Agent {
  id: number;
  nom: string;
}

const STATUT_TONE: Record<EtatStockLigne["statut"], "success" | "warning" | "danger"> = {
  normal: "success",
  stock_faible: "warning",
  rupture: "danger",
};

const STATUT_LABEL: Record<EtatStockLigne["statut"], string> = {
  normal: "Normal",
  stock_faible: "Stock faible",
  rupture: "Rupture",
};

const TYPE_LABEL: Record<string, string> = {
  reception: "Réception",
  distribution: "Distribution",
  ajustement_positif: "Ajustement (+)",
  ajustement_negatif: "Ajustement (−)",
  transfert_sortant: "Transfert sortant",
  transfert_entrant: "Transfert entrant",
};

const formatFcfa = (v: number) => `${v.toLocaleString("fr-FR")} FCFA`;

const EtatDuStock = () => {
  const [etat, setEtat] = useState<EtatStockLigne[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filtreStatut, setFiltreStatut] = useState<string>("tous");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const fetchEtat = useCallback(() => {
    setLoading(true);
    apiFetch<{ data: EtatStockLigne[] }>("/api/moyens-generaux/stock")
      .then((res) => setEtat(res.data))
      .catch((e) => { if (e instanceof ApiError && e.status === 401) return; message.error("Erreur lors du chargement du stock"); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchEtat(); }, [fetchEtat]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return etat.filter((l) => {
      const matchStatut = filtreStatut === "tous" || l.statut === filtreStatut;
      const matchSearch = !q || l.code.toLowerCase().includes(q) || l.nom.toLowerCase().includes(q);
      return matchStatut && matchSearch;
    });
  }, [etat, search, filtreStatut]);

  const valeurTotale = useMemo(
    () => etat.reduce((somme, l) => somme + (l.valeur_estimee ?? 0), 0),
    [etat]
  );
  const nombreAlertes = useMemo(() => etat.filter((l) => l.en_alerte).length, [etat]);

  const openAjustement = () => {
    form.resetFields();
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      await apiFetch("/api/moyens-generaux/stock/ajustements", {
        method: "POST",
        body: JSON.stringify(values),
      });
      message.success("Ajustement enregistré");
      setIsModalOpen(false);
      fetchEtat();
    } catch (e) {
      if (e instanceof ApiError) { message.error(e.message); return; }
      if ((e as any)?.errorFields) return;
      message.error("Erreur lors de l'enregistrement de l'ajustement");
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { title: "Code", dataIndex: "code", key: "code", sorter: (a: EtatStockLigne, b: EtatStockLigne) => a.code.localeCompare(b.code) },
    { title: "Accessoire", dataIndex: "nom", key: "nom", sorter: (a: EtatStockLigne, b: EtatStockLigne) => a.nom.localeCompare(b.nom) },
    { title: "Solde", dataIndex: "solde", key: "solde", align: "right" as const, sorter: (a: EtatStockLigne, b: EtatStockLigne) => a.solde - b.solde },
    { title: "Seuil d'alerte", dataIndex: "seuil_alerte", key: "seuil_alerte", align: "right" as const },
    {
      title: "Statut", dataIndex: "statut", key: "statut",
      render: (s: EtatStockLigne["statut"]) => <StatusTag tone={STATUT_TONE[s]} label={STATUT_LABEL[s]} />,
      sorter: (a: EtatStockLigne, b: EtatStockLigne) => a.statut.localeCompare(b.statut),
    },
    {
      title: "Coût unitaire", dataIndex: "cout_unitaire_reference", key: "cout_unitaire_reference", align: "right" as const,
      render: (v: number | null) => v !== null ? formatFcfa(v) : <span style={{ color: "var(--text-soft)" }}>—</span>,
    },
    {
      title: "Valeur estimée", dataIndex: "valeur_estimee", key: "valeur_estimee", align: "right" as const,
      render: (v: number | null) => v !== null ? formatFcfa(v) : <span style={{ color: "var(--text-soft)" }}>—</span>,
      sorter: (a: EtatStockLigne, b: EtatStockLigne) => (a.valeur_estimee ?? 0) - (b.valeur_estimee ?? 0),
    },
  ];

  return (
    <>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card><Statistic title="Références en catalogue" value={etat.length} prefix={<InboxOutlined />} /></Card>
        </Col>
        <Col span={8}>
          <Card><Statistic title="En alerte (faible ou rupture)" value={nombreAlertes} prefix={<WarningOutlined style={{ color: nombreAlertes > 0 ? "var(--danger)" : undefined }} />} /></Card>
        </Col>
        <Col span={8}>
          <Card><Statistic title="Valeur totale estimée du stock" value={formatFcfa(valeurTotale)} /></Card>
        </Col>
      </Row>

      <DataTable<EtatStockLigne>
        columns={columns}
        dataSource={filtered}
        rowKey="accessoire_id"
        loading={loading}
        searchValue={search}
        searchPlaceholder="Rechercher par code ou nom"
        onSearchChange={setSearch}
        filters={
          <Select value={filtreStatut} onChange={setFiltreStatut} style={{ width: 200 }}>
            <Option value="tous">Tous les statuts</Option>
            <Option value="normal">Normal</Option>
            <Option value="stock_faible">Stock faible</Option>
            <Option value="rupture">Rupture</Option>
          </Select>
        }
        toolbarExtra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openAjustement}>
            Ajustement d'inventaire
          </Button>
        }
        emptyTitle="Aucun accessoire actif"
      />

      <Modal
        title="Ajustement d'inventaire"
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={handleSubmit}
        okText="Enregistrer"
        cancelText="Annuler"
        confirmLoading={saving}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="accessoire_id" label="Accessoire" rules={[{ required: true, message: "Accessoire requis" }]}>
            <Select placeholder="Sélectionner un accessoire" showSearch optionFilterProp="children">
              {etat.map((l) => <Option key={l.accessoire_id} value={l.accessoire_id}>{l.nom} ({l.code}) — solde actuel : {l.solde}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="sens" label="Sens de l'ajustement" rules={[{ required: true, message: "Sens requis" }]}>
            <Select placeholder="Sélectionner">
              <Option value="positif">Écart positif (régularisation, comptage trouvé en plus)</Option>
              <Option value="negatif">Écart négatif (perte, casse, vol, comptage manquant)</Option>
            </Select>
          </Form.Item>
          <Form.Item name="quantite" label="Quantité" rules={[{ required: true, message: "Quantité requise" }]}>
            <InputNumber min={1} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="motif" label="Motif" rules={[{ required: true, message: "Le motif est obligatoire pour un ajustement" }]}>
            <Input.TextArea rows={2} placeholder="Ex: 3 polos abîmés lors du stockage, inventaire physique du 02/08..." />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

const HistoriqueMouvements = () => {
  const [mouvements, setMouvements] = useState<Mouvement[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [accessoiresOptions, setAccessoiresOptions] = useState<{ id: number; nom: string; code: string }[]>([]);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [filtreAccessoire, setFiltreAccessoire] = useState<number | null>(null);
  const [filtreType, setFiltreType] = useState<string | null>(null);
  const [filtreAgent, setFiltreAgent] = useState<number | null>(null);
  const [filtreDates, setFiltreDates] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);

  useEffect(() => {
    apiFetch<{ data: Agent[] }>("/api/moyens-generaux/stock/agents").then((res) => setAgents(res.data)).catch(() => {});
    apiFetch<{ data: EtatStockLigne[] }>("/api/moyens-generaux/stock").then((res) => setAccessoiresOptions(res.data.map((l) => ({ id: l.accessoire_id, nom: l.nom, code: l.code })))).catch(() => {});
  }, []);

  const fetchMouvements = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(limit));
    if (filtreAccessoire) params.set("accessoire_id", String(filtreAccessoire));
    if (filtreType) params.set("type", filtreType);
    if (filtreAgent) params.set("agent_id", String(filtreAgent));
    if (filtreDates?.[0]) params.set("date_debut", filtreDates[0].format("YYYY-MM-DD"));
    if (filtreDates?.[1]) params.set("date_fin", filtreDates[1].format("YYYY-MM-DD"));

    apiFetch<{ data: Mouvement[]; pagination: { page: number; limit: number; total: number } }>(`/api/moyens-generaux/stock/mouvements?${params.toString()}`)
      .then((res) => { setMouvements(res.data); setTotal(res.pagination.total); })
      .catch((e) => { if (e instanceof ApiError && e.status === 401) return; message.error("Erreur lors du chargement de l'historique"); })
      .finally(() => setLoading(false));
  }, [page, limit, filtreAccessoire, filtreType, filtreAgent, filtreDates]);

  useEffect(() => { fetchMouvements(); }, [fetchMouvements]);

  const handleTableChange = (pagination: TablePaginationConfig) => {
    setPage(pagination.current || 1);
    setLimit(pagination.pageSize || 20);
  };

  const columns = [
    { title: "Date", dataIndex: "date_mouvement", key: "date_mouvement", render: (v: string) => new Date(v).toLocaleString("fr-FR") },
    { title: "Type", dataIndex: "type", key: "type", render: (t: string) => <StatusTag tone={t.includes("negatif") || t === "distribution" || t === "transfert_sortant" ? "danger" : "success"} label={TYPE_LABEL[t] ?? t} /> },
    { title: "Accessoire", dataIndex: "accessoire_nom", key: "accessoire_nom" },
    { title: "Quantité", dataIndex: "quantite", key: "quantite", align: "right" as const },
    { title: "Agent", dataIndex: "agent_nom", key: "agent_nom" },
    { title: "Motif / référence", dataIndex: "motif", key: "motif", render: (v: string | null) => v || <span style={{ color: "var(--text-soft)" }}>—</span> },
  ];

  return (
    <DataTable<Mouvement>
      columns={columns}
      dataSource={mouvements}
      rowKey="id"
      loading={loading}
      onChange={handleTableChange}
      pagination={{ current: page, pageSize: limit, total, showSizeChanger: true }}
      filters={
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Select allowClear placeholder="Accessoire" style={{ width: 180 }} value={filtreAccessoire} onChange={(v) => { setFiltreAccessoire(v); setPage(1); }}>
            {accessoiresOptions.map((a) => <Option key={a.id} value={a.id}>{a.nom} ({a.code})</Option>)}
          </Select>
          <Select allowClear placeholder="Type de mouvement" style={{ width: 180 }} value={filtreType} onChange={(v) => { setFiltreType(v); setPage(1); }}>
            {Object.entries(TYPE_LABEL).map(([k, v]) => <Option key={k} value={k}>{v}</Option>)}
          </Select>
          <Select allowClear placeholder="Agent" style={{ width: 180 }} value={filtreAgent} onChange={(v) => { setFiltreAgent(v); setPage(1); }}>
            {agents.map((a) => <Option key={a.id} value={a.id}>{a.nom}</Option>)}
          </Select>
          <RangePicker
            value={filtreDates}
            onChange={(dates) => { setFiltreDates(dates as [dayjs.Dayjs | null, dayjs.Dayjs | null] | null); setPage(1); }}
          />
        </div>
      }
      emptyTitle="Aucun mouvement enregistré"
    />
  );
};

const Stock = () => (
  <div>
    <PageHeader />
    <PageContainer title="Gestion du stock" description="État du stock et historique des mouvements — Moyens Généraux">
      <Tabs
        defaultActiveKey="etat"
        items={[
          { key: "etat", label: "État du stock", children: <EtatDuStock /> },
          { key: "mouvements", label: "Historique des mouvements", children: <HistoriqueMouvements /> },
        ]}
      />
    </PageContainer>
  </div>
);

export default Stock;
