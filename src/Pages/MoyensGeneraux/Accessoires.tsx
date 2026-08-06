/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import { Button, Modal, Form, Input, InputNumber, Select, message, Popconfirm } from "antd";
import { PlusOutlined, EditOutlined, StopOutlined, CheckCircleOutlined } from "@ant-design/icons";
import PageHeader from "../../Components/PageHeader/PageHeader";
import PageContainer from "../../Components/ui/PageContainer";
import DataTable from "../../Components/ui/DataTable";
import StatusTag from "../../Components/ui/StatusTag";
import { apiFetch, ApiError } from "../../lib/api";

const { Option } = Select;

interface Accessoire {
  id: number;
  code: string;
  nom: string;
  description: string | null;
  actif: boolean;
  seuil_alerte_defaut: number;
  cout_unitaire_reference: number | null;
  created_at: string;
  updated_at: string;
}

const formatFcfa = (v: number) => `${v.toLocaleString("fr-FR")} FCFA`;

type FiltreStatut = "tous" | "actif" | "inactif";

const Accessoires = () => {
  const [accessoires, setAccessoires] = useState<Accessoire[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filtreStatut, setFiltreStatut] = useState<FiltreStatut>("tous");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Accessoire | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const fetchAccessoires = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ data: Accessoire[] }>("/api/moyens-generaux/accessoires");
      setAccessoires(res.data);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return;
      message.error("Erreur lors du chargement du catalogue d'accessoires");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAccessoires(); }, []);

  const filteredAccessoires = useMemo(() => {
    const q = search.trim().toLowerCase();
    return accessoires.filter((a) => {
      const matchStatut = filtreStatut === "tous" || (filtreStatut === "actif" ? a.actif : !a.actif);
      const matchSearch = !q
        || a.code.toLowerCase().includes(q)
        || a.nom.toLowerCase().includes(q)
        || (a.description ?? "").toLowerCase().includes(q);
      return matchStatut && matchSearch;
    });
  }, [accessoires, search, filtreStatut]);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setIsModalOpen(true);
  };

  const openEdit = (accessoire: Accessoire) => {
    setEditing(accessoire);
    form.setFieldsValue(accessoire);
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      if (editing) {
        await apiFetch(`/api/moyens-generaux/accessoires/${editing.id}`, { method: "PUT", body: JSON.stringify(values) });
        message.success("Accessoire mis à jour");
      } else {
        await apiFetch("/api/moyens-generaux/accessoires", { method: "POST", body: JSON.stringify(values) });
        message.success("Accessoire créé");
      }
      setIsModalOpen(false);
      fetchAccessoires();
    } catch (e) {
      if (e instanceof ApiError) { message.error(e.message); return; }
      if ((e as any)?.errorFields) return;
      message.error("Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  const toggleStatut = async (accessoire: Accessoire) => {
    try {
      await apiFetch(`/api/moyens-generaux/accessoires/${accessoire.id}/statut`, {
        method: "PATCH",
        body: JSON.stringify({ actif: !accessoire.actif }),
      });
      message.success(accessoire.actif ? "Accessoire désactivé" : "Accessoire réactivé");
      fetchAccessoires();
    } catch (e) {
      if (e instanceof ApiError) { message.error(e.message); return; }
      message.error("Erreur lors du changement de statut");
    }
  };

  const columns = [
    { title: "Code", dataIndex: "code", key: "code", sorter: (a: Accessoire, b: Accessoire) => a.code.localeCompare(b.code) },
    { title: "Nom", dataIndex: "nom", key: "nom", sorter: (a: Accessoire, b: Accessoire) => a.nom.localeCompare(b.nom) },
    { title: "Description", dataIndex: "description", key: "description", render: (d: string | null) => d || <span style={{ color: "var(--text-soft)" }}>—</span> },
    {
      title: "Seuil d'alerte", dataIndex: "seuil_alerte_defaut", key: "seuil_alerte_defaut", align: "right" as const,
      sorter: (a: Accessoire, b: Accessoire) => a.seuil_alerte_defaut - b.seuil_alerte_defaut,
    },
    {
      title: "Coût unitaire", dataIndex: "cout_unitaire_reference", key: "cout_unitaire_reference", align: "right" as const,
      render: (v: number | null) => v !== null ? formatFcfa(v) : <span style={{ color: "var(--text-soft)" }}>—</span>,
      sorter: (a: Accessoire, b: Accessoire) => (a.cout_unitaire_reference ?? 0) - (b.cout_unitaire_reference ?? 0),
    },
    {
      title: "Statut", dataIndex: "actif", key: "actif",
      render: (actif: boolean) => <StatusTag tone={actif ? "success" : "danger"} label={actif ? "Actif" : "Inactif"} />,
      sorter: (a: Accessoire, b: Accessoire) => Number(a.actif) - Number(b.actif),
    },
    {
      title: "Créé le", dataIndex: "created_at", key: "created_at",
      render: (v: string) => new Date(v).toLocaleDateString("fr-FR"),
      sorter: (a: Accessoire, b: Accessoire) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    },
    {
      title: "Modifié le", dataIndex: "updated_at", key: "updated_at",
      render: (v: string) => new Date(v).toLocaleDateString("fr-FR"),
      sorter: (a: Accessoire, b: Accessoire) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime(),
    },
    {
      title: "Action", key: "action",
      render: (_: any, row: Accessoire) => (
        <div style={{ display: "flex", gap: 8 }}>
          <Button icon={<EditOutlined />} size="small" onClick={() => openEdit(row)} />
          <Popconfirm
            title={row.actif ? "Désactiver cet accessoire ?" : "Réactiver cet accessoire ?"}
            description={row.actif ? "Il n'apparaîtra plus dans les remises ou commandes futures." : undefined}
            onConfirm={() => toggleStatut(row)}
            okText="Confirmer"
            cancelText="Annuler"
          >
            <Button
              icon={row.actif ? <StopOutlined /> : <CheckCircleOutlined />}
              size="small"
              danger={row.actif}
            />
          </Popconfirm>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader />
      <PageContainer title="Catalogue des accessoires" description="Référentiel des accessoires institutionnels — Moyens Généraux">
        <DataTable<Accessoire>
          columns={columns}
          dataSource={filteredAccessoires}
          rowKey="id"
          loading={loading}
          searchValue={search}
          searchPlaceholder="Rechercher par code, nom ou description"
          onSearchChange={setSearch}
          filters={
            <Select value={filtreStatut} onChange={setFiltreStatut} style={{ width: 160 }}>
              <Option value="tous">Tous les statuts</Option>
              <Option value="actif">Actifs</Option>
              <Option value="inactif">Inactifs</Option>
            </Select>
          }
          toolbarExtra={
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              Nouvel accessoire
            </Button>
          }
          emptyTitle="Aucun accessoire au catalogue"
          emptyDescription="Ajoutez le premier accessoire (polo, tissu, cravate, macaron...) pour démarrer."
        />
      </PageContainer>

      <Modal
        title={editing ? "Modifier l'accessoire" : "Nouvel accessoire"}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={handleSubmit}
        okText="Enregistrer"
        cancelText="Annuler"
        confirmLoading={saving}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="code" label="Code" rules={[{ required: true, message: "Code requis" }]}>
            <Input placeholder="Ex: POLO" />
          </Form.Item>
          <Form.Item name="nom" label="Nom" rules={[{ required: true, message: "Nom requis" }]}>
            <Input placeholder="Ex: Polo IIPEA" />
          </Form.Item>
          <Form.Item name="description" label="Description (facultative)">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item
            name="seuil_alerte_defaut"
            label="Seuil d'alerte par défaut"
            initialValue={0}
            rules={[{ required: true, message: "Seuil requis" }]}
          >
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item
            name="cout_unitaire_reference"
            label="Coût unitaire de référence (facultatif)"
            tooltip="Utilisé pour estimer la valeur du stock — n'affecte pas les commandes."
          >
            <InputNumber min={0} step={0.01} style={{ width: "100%" }} addonAfter="FCFA" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Accessoires;
