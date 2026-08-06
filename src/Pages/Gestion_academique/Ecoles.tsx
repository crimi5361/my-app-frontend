/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import { Button, Modal, Form, Input, Select, message } from "antd";
import { PlusOutlined, EditOutlined } from "@ant-design/icons";
import PageHeader from "../../Components/PageHeader/PageHeader";
import PageContainer from "../../Components/ui/PageContainer";
import DataTable from "../../Components/ui/DataTable";
import StatusTag from "../../Components/ui/StatusTag";
import { apiFetch, ApiError } from "../../lib/api";

const { Option } = Select;

interface Ecole {
  id: number;
  nom: string;
  code: string;
  description: string | null;
  statut: string;
}

const Ecoles = () => {
  const [ecoles, setEcoles] = useState<Ecole[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Ecole | null>(null);
  const [form] = Form.useForm();

  const filteredEcoles = useMemo(
    () => ecoles.filter(e => e.nom.toLowerCase().includes(search.toLowerCase()) || e.code.toLowerCase().includes(search.toLowerCase())),
    [ecoles, search]
  );

  const fetchEcoles = async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/api/ecoles");
      setEcoles(data);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return;
      message.error("Erreur lors du chargement des écoles");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEcoles(); }, []);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setIsModalOpen(true);
  };

  const openEdit = (ecole: Ecole) => {
    setEditing(ecole);
    form.setFieldsValue(ecole);
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editing) {
        await apiFetch(`/api/ecoles/${editing.id}`, { method: "PUT", body: JSON.stringify(values) });
        message.success("École mise à jour");
      } else {
        await apiFetch("/api/ecoles", { method: "POST", body: JSON.stringify(values) });
        message.success("École créée");
      }
      setIsModalOpen(false);
      fetchEcoles();
    } catch (e) {
      if (e instanceof ApiError) { message.error(e.message); return; }
      if ((e as any)?.errorFields) return;
      message.error("Erreur lors de l'enregistrement");
    }
  };

  const columns = [
    { title: "Nom", dataIndex: "nom", key: "nom" },
    { title: "Code", dataIndex: "code", key: "code", render: (c: string) => <StatusTag tone="info" label={c} /> },
    { title: "Description", dataIndex: "description", key: "description" },
    {
      title: "Statut", dataIndex: "statut", key: "statut",
      render: (s: string) => <StatusTag tone={s === "actif" ? "success" : "danger"} label={s} />,
    },
    {
      title: "Action", key: "action",
      render: (_: any, row: Ecole) => (
        <Button icon={<EditOutlined />} size="small" onClick={() => openEdit(row)} />
      ),
    },
  ];

  return (
    <div>
      <PageHeader />
      <PageContainer title="Écoles">
        <DataTable<Ecole>
          columns={columns}
          dataSource={filteredEcoles}
          rowKey="id"
          loading={loading}
          searchValue={search}
          searchPlaceholder="Rechercher une école"
          onSearchChange={setSearch}
          toolbarExtra={
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              Nouvelle École
            </Button>
          }
          emptyTitle="Aucune école"
        />
      </PageContainer>

      <Modal
        title={editing ? "Modifier l'école" : "Nouvelle école"}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={handleSubmit}
        okText="Enregistrer"
        cancelText="Annuler"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="nom" label="Nom" rules={[{ required: true, message: "Nom requis" }]}>
            <Input placeholder="Ex: School of Law" />
          </Form.Item>
          <Form.Item name="code" label="Code" rules={[{ required: true, message: "Code requis" }]}>
            <Input placeholder="Ex: LAW" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="statut" label="Statut" initialValue="actif">
            <Select>
              <Option value="actif">Actif</Option>
              <Option value="inactif">Inactif</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Ecoles;
