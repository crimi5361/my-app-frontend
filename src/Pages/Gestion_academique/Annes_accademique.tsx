
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState } from "react";
import { Table, Button, Modal, Form, Input, message, Popconfirm, Tag, Alert } from "antd";
import { PlusOutlined, CheckCircleOutlined, CloseCircleOutlined } from "@ant-design/icons";
import PageHeader from "../../Components/PageHeader/PageHeader";
import { apiFetch, ApiError } from "../../lib/api";
import type { AnneeAcademique } from "../../type/AnneeAcademique";

// ── Lecture utilisateur + departement_id (= site_id) ────────────────────────
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

const Annes_accademique = () => {
  const [annees, setAnnees] = useState<AnneeAcademique[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();

  const currentUser = getUserInfo();
  const siteId = currentUser?.departement_id;
  const siteName = currentUser?.departementName;

  // ── Fetch années du site (état d'ouverture par site) ───────────────────
  const fetchAnnees = async () => {
    if (!siteId) return;
    setLoading(true);
    try {
      const data: AnneeAcademique[] = await apiFetch(`/api/annees?site_id=${siteId}`);
      setAnnees(data);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return;
      message.error("Erreur lors du chargement des années académiques");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnees();
  }, []);

  // ── Ajouter (créer l'année globale si besoin, puis l'ouvrir pour ce site) ──
  const handleAdd = async () => {
    try {
      const values = await form.validateFields();

      let anneeId: number;
      try {
        const created = await apiFetch<{ id: number }>("/api/annees/ajouter", {
          method: "POST",
          body: JSON.stringify({ annee: values.annee }),
        });
        anneeId = created.id;
      } catch (e) {
        // L'année existe peut-être déjà globalement (ouverte par un autre site) : on la retrouve.
        const toutes: AnneeAcademique[] = await apiFetch("/api/annees");
        const existante = toutes.find(a => a.annee === values.annee);
        if (!existante) throw e;
        anneeId = existante.id;
      }

      await apiFetch(`/api/annees/${anneeId}/site/${siteId}/ouvrir`, { method: "POST" });

      message.success("Année académique ouverte pour votre site");
      form.resetFields();
      setIsModalOpen(false);
      fetchAnnees();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return;
      message.error(e instanceof Error ? e.message : "Erreur lors de la communication avec le serveur");
    }
  };

  // ── Fermer ───────────────────────────────────────────────────────────
  const handleCloseYear = async (id: number) => {
    try {
      await apiFetch(`/api/annees/${id}/site/${siteId}/fermer`, { method: "POST" });
      message.success("Année fermée");
      fetchAnnees();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return;
      message.error(e instanceof Error ? e.message : "Erreur");
    }
  };

  // ── Réouvrir ─────────────────────────────────────────────────────────
  const handleReopenYear = async (id: number) => {
    try {
      await apiFetch(`/api/annees/${id}/site/${siteId}/reouvrir`, { method: "POST" });
      message.success("Année rouverte");
      fetchAnnees();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return;
      message.error(e instanceof Error ? e.message : "Erreur");
    }
  };

  const columns = [
    {
      title: "Année Académique",
      dataIndex: "annee",
      key: "annee",
    },
    {
      title: "État",
      dataIndex: "etat",
      key: "etat",
      render: (etat: string | null) =>
        etat === "en cour" ? (
          <Tag color="green">En cours</Tag>
        ) : etat ? (
          <Tag color="red">Terminée</Tag>
        ) : (
          <Tag>Non ouverte pour ce site</Tag>
        ),
    },
    {
      title: "Action",
      key: "action",
      render: (_: any, record: AnneeAcademique) => {
        if (!record.etat) {
          return (
            <Popconfirm
              title="Ouvrir cette année pour votre site ?"
              onConfirm={() => handleReopenYear(record.id)}
            >
              <Button type="primary" icon={<CheckCircleOutlined />}>Ouvrir</Button>
            </Popconfirm>
          );
        }
        if (record.etat === "en cour") {
          return (
            <Popconfirm
              title="Voulez-vous vraiment fermer cette année ?"
              onConfirm={() => handleCloseYear(record.id)}
            >
              <Button danger icon={<CloseCircleOutlined />}>Fermer</Button>
            </Popconfirm>
          );
        }
        return (
          <Popconfirm
            title="Voulez-vous réouvrir cette année ?"
            onConfirm={() => handleReopenYear(record.id)}
          >
            <Button type="primary" icon={<CheckCircleOutlined />}>Réouvrir</Button>
          </Popconfirm>
        );
      },
    },
  ];

  // ── Guard : pas de site ────────────────────────────────────────
  if (!siteId) {
    return (
      <div className="p-6">
        <PageHeader />
        <Alert
          message="Site non assigné"
          description="Votre compte n'est associé à aucun site. Veuillez contacter l'administrateur."
          type="warning"
          showIcon
        />
      </div>
    );
  }

  return (
    <div className="p-6">
      <PageHeader />

      <Alert
        message={`Années académiques — ${siteName || "Site " + siteId}`}
        description="Une année académique est désormais commune à tout l'IIPEA ; seul son état d'ouverture (en cours / terminée) est propre à votre site."
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        closable
      />

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setIsModalOpen(true)}
        >
          Nouvelle Année
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={annees}
        rowKey="id"
        loading={loading}
        bordered
      />

      <Modal
        title={`Ouvrir une Année Académique — ${siteName || ""}`}
        open={isModalOpen}
        onCancel={() => { setIsModalOpen(false); form.resetFields(); }}
        onOk={handleAdd}
        okText="Ouvrir"
        cancelText="Annuler"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="annee"
            label="Année Académique"
            rules={[
              { required: true, message: "Veuillez entrer l'année académique" },
              {
                pattern: /^\d{4}-\d{4}$/,
                message: "Format attendu : 2025-2026",
              },
            ]}
          >
            <Input placeholder="Ex: 2025-2026" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Annes_accademique;
