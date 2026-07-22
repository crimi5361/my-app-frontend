/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { Table, Button, Modal, Form, Input, Select, message, Tag } from "antd";
import { PlusOutlined, EditOutlined } from "@ant-design/icons";
import PageHeader from "../../Components/PageHeader/PageHeader";
import { apiFetch, ApiError } from "../../lib/api";

const { Option } = Select;

interface Ecole {
  id: number;
  nom: string;
}

interface Departement {
  id: number;
  nom: string;
  sigle: string | null;
  ecole_id: number;
  ecole_nom: string;
}

const Departements = () => {
  const [departements, setDepartements] = useState<Departement[]>([]);
  const [ecoles, setEcoles] = useState<Ecole[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Departement | null>(null);
  const [form] = Form.useForm();

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [depsData, ecolesData] = await Promise.all([
        apiFetch("/api/departements"),
        apiFetch("/api/ecoles"),
      ]);
      setDepartements(depsData);
      setEcoles(ecolesData);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return;
      message.error("Erreur lors du chargement des départements");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setIsModalOpen(true);
  };

  const openEdit = (dep: Departement) => {
    setEditing(dep);
    form.setFieldsValue(dep);
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editing) {
        await apiFetch(`/api/departements/${editing.id}`, { method: "PUT", body: JSON.stringify(values) });
        message.success("Département mis à jour");
      } else {
        await apiFetch("/api/departements", { method: "POST", body: JSON.stringify(values) });
        message.success("Département créé");
      }
      setIsModalOpen(false);
      fetchAll();
    } catch (e) {
      if (e instanceof ApiError) { message.error(e.message); return; }
      if ((e as any)?.errorFields) return;
      message.error("Erreur lors de l'enregistrement");
    }
  };

  const columns = [
    { title: "Nom", dataIndex: "nom", key: "nom" },
    { title: "Sigle", dataIndex: "sigle", key: "sigle", render: (s: string) => s ? <Tag color="orange">{s}</Tag> : "-" },
    { title: "École", dataIndex: "ecole_nom", key: "ecole_nom", render: (n: string) => <Tag color="blue">{n}</Tag> },
    {
      title: "Action", key: "action",
      render: (_: any, row: Departement) => (
        <Button icon={<EditOutlined />} size="small" onClick={() => openEdit(row)} />
      ),
    },
  ];

  return (
    <div className="p-6">
      <PageHeader />
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          Nouveau Département
        </Button>
      </div>
      <Table columns={columns} dataSource={departements} rowKey="id" loading={loading} bordered />

      <Modal
        title={editing ? "Modifier le département" : "Nouveau département"}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={handleSubmit}
        okText="Enregistrer"
        cancelText="Annuler"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="ecole_id" label="École" rules={[{ required: true, message: "École requise" }]}>
            <Select placeholder="Sélectionner une école">
              {ecoles.map(e => <Option key={e.id} value={e.id}>{e.nom}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="nom" label="Nom" rules={[{ required: true, message: "Nom requis" }]}>
            <Input placeholder="Ex: Département Law" />
          </Form.Item>
          <Form.Item name="sigle" label="Sigle">
            <Input placeholder="Ex: LAW" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Departements;
