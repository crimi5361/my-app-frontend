/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import { Button, Modal, Form, Input, Select, message, Popconfirm } from "antd";
import { PlusOutlined, EditOutlined, StopOutlined, CheckCircleOutlined } from "@ant-design/icons";
import PageHeader from "../../Components/PageHeader/PageHeader";
import PageContainer from "../../Components/ui/PageContainer";
import DataTable from "../../Components/ui/DataTable";
import StatusTag from "../../Components/ui/StatusTag";
import AccesRestreint from "../../Components/ui/AccesRestreint";
import { apiFetch, ApiError } from "../../lib/api";
import { hasPermission } from "../../lib/permissions";

const { Option } = Select;

interface Fournisseur {
  id: number;
  nom: string;
  contact_nom: string | null;
  telephone: string | null;
  email: string | null;
  adresse: string | null;
  ville: string | null;
  observations: string | null;
  statut: "actif" | "inactif";
  created_at: string;
  updated_at: string;
}

type FiltreStatut = "tous" | "actif" | "inactif";

const Fournisseurs = () => {
  // Permissions individuelles (Chantier Moyens Généraux, Phase 1) — le backend revalide de toute
  // façon chaque requête ; ce masquage n'est qu'une amélioration d'ergonomie.
  const peutVoir = hasPermission("fournisseur.voir");
  const peutGerer = hasPermission("fournisseur.gerer");

  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filtreStatut, setFiltreStatut] = useState<FiltreStatut>("tous");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Fournisseur | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const fetchFournisseurs = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ data: Fournisseur[] }>("/api/moyens-generaux/fournisseurs");
      setFournisseurs(res.data);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return;
      message.error("Erreur lors du chargement des fournisseurs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (peutVoir) fetchFournisseurs(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredFournisseurs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return fournisseurs.filter((f) => {
      const matchStatut = filtreStatut === "tous" || f.statut === filtreStatut;
      const matchSearch = !q
        || f.nom.toLowerCase().includes(q)
        || (f.contact_nom ?? "").toLowerCase().includes(q)
        || (f.telephone ?? "").toLowerCase().includes(q)
        || (f.email ?? "").toLowerCase().includes(q)
        || (f.ville ?? "").toLowerCase().includes(q);
      return matchStatut && matchSearch;
    });
  }, [fournisseurs, search, filtreStatut]);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setIsModalOpen(true);
  };

  const openEdit = (fournisseur: Fournisseur) => {
    setEditing(fournisseur);
    form.setFieldsValue(fournisseur);
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      if (editing) {
        await apiFetch(`/api/moyens-generaux/fournisseurs/${editing.id}`, { method: "PUT", body: JSON.stringify(values) });
        message.success("Fournisseur mis à jour");
      } else {
        await apiFetch("/api/moyens-generaux/fournisseurs", { method: "POST", body: JSON.stringify(values) });
        message.success("Fournisseur créé");
      }
      setIsModalOpen(false);
      fetchFournisseurs();
    } catch (e) {
      if (e instanceof ApiError) { message.error(e.message); return; }
      if ((e as any)?.errorFields) return;
      message.error("Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  const toggleStatut = async (fournisseur: Fournisseur) => {
    const nouveauStatut = fournisseur.statut === "actif" ? "inactif" : "actif";
    try {
      await apiFetch(`/api/moyens-generaux/fournisseurs/${fournisseur.id}/statut`, {
        method: "PATCH",
        body: JSON.stringify({ statut: nouveauStatut }),
      });
      message.success(nouveauStatut === "inactif" ? "Fournisseur désactivé" : "Fournisseur réactivé");
      fetchFournisseurs();
    } catch (e) {
      if (e instanceof ApiError) { message.error(e.message); return; }
      message.error("Erreur lors du changement de statut");
    }
  };

  const columns = [
    { title: "Nom", dataIndex: "nom", key: "nom", sorter: (a: Fournisseur, b: Fournisseur) => a.nom.localeCompare(b.nom) },
    { title: "Contact", dataIndex: "contact_nom", key: "contact_nom", render: (v: string | null) => v || <span style={{ color: "var(--text-soft)" }}>—</span> },
    { title: "Téléphone", dataIndex: "telephone", key: "telephone", render: (v: string | null) => v || <span style={{ color: "var(--text-soft)" }}>—</span> },
    { title: "Email", dataIndex: "email", key: "email", render: (v: string | null) => v || <span style={{ color: "var(--text-soft)" }}>—</span> },
    { title: "Ville", dataIndex: "ville", key: "ville", sorter: (a: Fournisseur, b: Fournisseur) => (a.ville ?? "").localeCompare(b.ville ?? "") },
    {
      title: "Statut", dataIndex: "statut", key: "statut",
      render: (s: string) => <StatusTag tone={s === "actif" ? "success" : "danger"} label={s === "actif" ? "Actif" : "Inactif"} />,
      sorter: (a: Fournisseur, b: Fournisseur) => a.statut.localeCompare(b.statut),
    },
    {
      title: "Créé le", dataIndex: "created_at", key: "created_at",
      render: (v: string) => new Date(v).toLocaleDateString("fr-FR"),
      sorter: (a: Fournisseur, b: Fournisseur) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    },
    ...(peutGerer ? [{
      title: "Action", key: "action",
      render: (_: any, row: Fournisseur) => (
        <div style={{ display: "flex", gap: 8 }}>
          <Button icon={<EditOutlined />} size="small" onClick={() => openEdit(row)} />
          <Popconfirm
            title={row.statut === "actif" ? "Désactiver ce fournisseur ?" : "Réactiver ce fournisseur ?"}
            description={row.statut === "actif" ? "Il n'apparaîtra plus dans les nouvelles commandes." : undefined}
            onConfirm={() => toggleStatut(row)}
            okText="Confirmer"
            cancelText="Annuler"
          >
            <Button
              icon={row.statut === "actif" ? <StopOutlined /> : <CheckCircleOutlined />}
              size="small"
              danger={row.statut === "actif"}
            />
          </Popconfirm>
        </div>
      ),
    }] : []),
  ];

  if (!peutVoir) {
    return (
      <div>
        <PageHeader />
        <AccesRestreint description="Vous n'avez pas la permission de consulter les fournisseurs." />
      </div>
    );
  }

  return (
    <div>
      <PageHeader />
      <PageContainer title="Fournisseurs" description="Référentiel des fournisseurs — Moyens Généraux">
        <DataTable<Fournisseur>
          columns={columns}
          dataSource={filteredFournisseurs}
          rowKey="id"
          loading={loading}
          searchValue={search}
          searchPlaceholder="Rechercher par nom, contact, téléphone, email ou ville"
          onSearchChange={setSearch}
          filters={
            <Select value={filtreStatut} onChange={setFiltreStatut} style={{ width: 160 }}>
              <Option value="tous">Tous les statuts</Option>
              <Option value="actif">Actifs</Option>
              <Option value="inactif">Inactifs</Option>
            </Select>
          }
          toolbarExtra={
            peutGerer ? (
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                Nouveau fournisseur
              </Button>
            ) : undefined
          }
          emptyTitle="Aucun fournisseur"
          emptyDescription="Ajoutez votre premier fournisseur pour démarrer le circuit d'approvisionnement."
        />
      </PageContainer>

      <Modal
        title={editing ? "Modifier le fournisseur" : "Nouveau fournisseur"}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={handleSubmit}
        okText="Enregistrer"
        cancelText="Annuler"
        confirmLoading={saving}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="nom" label="Nom du fournisseur" rules={[{ required: true, message: "Nom requis" }]}>
            <Input placeholder="Ex: Établissements Koné & Fils" />
          </Form.Item>
          <Form.Item name="contact_nom" label="Personne à contacter">
            <Input />
          </Form.Item>
          <Form.Item name="telephone" label="Téléphone">
            <Input />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ type: "email", message: "Email invalide" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="adresse" label="Adresse">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="ville" label="Ville">
            <Input />
          </Form.Item>
          <Form.Item name="observations" label="Observations (facultatif)">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Fournisseurs;
