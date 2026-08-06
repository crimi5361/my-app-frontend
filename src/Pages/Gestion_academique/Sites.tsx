/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import { Button, Modal, Form, Input, message } from "antd";
import { PlusOutlined, EditOutlined } from "@ant-design/icons";
import PageHeader from "../../Components/PageHeader/PageHeader";
import PageContainer from "../../Components/ui/PageContainer";
import DataTable from "../../Components/ui/DataTable";
import { apiFetch, ApiError } from "../../lib/api";

interface Site {
  id: number;
  nom: string;
  adresse: string | null;
}

const Sites = () => {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Site | null>(null);
  const [form] = Form.useForm();

  const filteredSites = useMemo(
    () => sites.filter(s => s.nom.toLowerCase().includes(search.toLowerCase())),
    [sites, search]
  );

  const fetchSites = async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/api/sites");
      setSites(data);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return;
      message.error("Erreur lors du chargement des sites");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSites(); }, []);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setIsModalOpen(true);
  };

  const openEdit = (site: Site) => {
    setEditing(site);
    form.setFieldsValue(site);
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editing) {
        await apiFetch(`/api/sites/${editing.id}`, { method: "PUT", body: JSON.stringify(values) });
        message.success("Site mis à jour");
      } else {
        await apiFetch("/api/sites", { method: "POST", body: JSON.stringify(values) });
        message.success("Site créé");
      }
      setIsModalOpen(false);
      fetchSites();
    } catch (e) {
      if (e instanceof ApiError) { message.error(e.message); return; }
      if ((e as any)?.errorFields) return;
      message.error("Erreur lors de l'enregistrement");
    }
  };

  const columns = [
    { title: "Nom", dataIndex: "nom", key: "nom" },
    { title: "Adresse", dataIndex: "adresse", key: "adresse", render: (a: string) => a || "-" },
    {
      title: "Action", key: "action",
      render: (_: any, row: Site) => (
        <Button icon={<EditOutlined />} size="small" onClick={() => openEdit(row)} />
      ),
    },
  ];

  return (
    <div>
      <PageHeader />
      <PageContainer title="Sites">
        <DataTable<Site>
          columns={columns}
          dataSource={filteredSites}
          rowKey="id"
          loading={loading}
          searchValue={search}
          searchPlaceholder="Rechercher un site"
          onSearchChange={setSearch}
          toolbarExtra={
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              Nouveau Site
            </Button>
          }
          emptyTitle="Aucun site"
        />
      </PageContainer>

      <Modal
        title={editing ? "Modifier le site" : "Nouveau site"}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={handleSubmit}
        okText="Enregistrer"
        cancelText="Annuler"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="nom" label="Nom" rules={[{ required: true, message: "Nom requis" }]}>
            <Input placeholder="Ex: IIPEA COCODY" />
          </Form.Item>
          <Form.Item name="adresse" label="Adresse">
            <Input placeholder="Ex: Abidjan, Cocody" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Sites;
