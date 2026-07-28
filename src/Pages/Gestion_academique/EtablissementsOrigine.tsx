/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { Table, Button, Modal, Form, Input, Select, message, Tag, Popconfirm, Space } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import PageHeader from "../../Components/PageHeader/PageHeader";
import { apiFetch, ApiError } from "../../lib/api";

const { Option } = Select;

interface EtablissementOrigine {
  id: number;
  nom_etablissement: string;
  situation_geographique: string | null;
  statut: string;
  dren: string | null;
}

const EtablissementsOrigine = () => {
  const [etablissements, setEtablissements] = useState<EtablissementOrigine[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<EtablissementOrigine | null>(null);
  const [form] = Form.useForm();

  const fetchEtablissements = async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/api/etablissements-origine");
      setEtablissements(data);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return;
      message.error("Erreur lors du chargement des établissements");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEtablissements(); }, []);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setIsModalOpen(true);
  };

  const openEdit = (etablissement: EtablissementOrigine) => {
    setEditing(etablissement);
    form.setFieldsValue(etablissement);
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editing) {
        await apiFetch(`/api/etablissements-origine/${editing.id}`, { method: "PUT", body: JSON.stringify(values) });
        message.success("Établissement mis à jour");
      } else {
        await apiFetch("/api/etablissements-origine", { method: "POST", body: JSON.stringify(values) });
        message.success("Établissement créé");
      }
      setIsModalOpen(false);
      fetchEtablissements();
    } catch (e) {
      if (e instanceof ApiError) { message.error(e.message); return; }
      if ((e as any)?.errorFields) return;
      message.error("Erreur lors de l'enregistrement");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await apiFetch(`/api/etablissements-origine/${id}`, { method: "DELETE" });
      message.success("Établissement supprimé");
      fetchEtablissements();
    } catch (e) {
      if (e instanceof ApiError) { message.error(e.message); return; }
      message.error("Erreur lors de la suppression");
    }
  };

  const columns = [
    { title: "Nom de l'établissement", dataIndex: "nom_etablissement", key: "nom_etablissement" },
    { title: "Situation géographique", dataIndex: "situation_geographique", key: "situation_geographique", render: (v: string | null) => v || "—" },
    {
      title: "Statut", dataIndex: "statut", key: "statut",
      render: (s: string) => <Tag color={s === "PUBLIC" ? "blue" : "orange"}>{s}</Tag>,
    },
    { title: "DREN", dataIndex: "dren", key: "dren", render: (v: string | null) => v || "—" },
    {
      title: "Action", key: "action",
      render: (_: any, row: EtablissementOrigine) => (
        <Space>
          <Button icon={<EditOutlined />} size="small" onClick={() => openEdit(row)} />
          <Popconfirm
            title="Supprimer cet établissement ?"
            onConfirm={() => handleDelete(row.id)}
            okText="Supprimer"
            cancelText="Annuler"
          >
            <Button icon={<DeleteOutlined />} size="small" danger />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="p-6">
      <PageHeader />
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          Nouvel Établissement
        </Button>
      </div>
      <Table
        columns={columns}
        dataSource={etablissements}
        rowKey="id"
        loading={loading}
        bordered
        pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (total) => `${total} établissements` }}
      />

      <Modal
        title={editing ? "Modifier l'établissement" : "Nouvel établissement"}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={handleSubmit}
        okText="Enregistrer"
        cancelText="Annuler"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="nom_etablissement" label="Nom de l'établissement" rules={[{ required: true, message: "Nom requis" }]}>
            <Input placeholder="Ex: COLLEGE MODERNE COCODY" />
          </Form.Item>
          <Form.Item name="situation_geographique" label="Situation géographique">
            <Input placeholder="Ex: COCODY" />
          </Form.Item>
          <Form.Item name="statut" label="Statut" initialValue="PUBLIC">
            <Select>
              <Option value="PUBLIC">Public</Option>
              <Option value="PRIVE">Privé</Option>
            </Select>
          </Form.Item>
          <Form.Item name="dren" label="DREN">
            <Input placeholder="Ex: 12" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default EtablissementsOrigine;
