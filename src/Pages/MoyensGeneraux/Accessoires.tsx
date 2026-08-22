/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import { Button, Modal, Form, Input, InputNumber, Select, Radio, message, Popconfirm, Tag, Space, Empty, Tooltip } from "antd";
import { PlusOutlined, EditOutlined, StopOutlined, CheckCircleOutlined, TagsOutlined } from "@ant-design/icons";
import PageHeader from "../../Components/PageHeader/PageHeader";
import PageContainer from "../../Components/ui/PageContainer";
import DataTable from "../../Components/ui/DataTable";
import StatusTag from "../../Components/ui/StatusTag";
import AccesRestreint from "../../Components/ui/AccesRestreint";
import { apiFetch, ApiError } from "../../lib/api";
import { hasPermission } from "../../lib/permissions";

const { Option } = Select;

interface Accessoire {
  id: number;
  code: string;
  nom: string;
  description: string | null;
  actif: boolean;
  seuil_alerte_defaut: number;
  cout_unitaire_reference: number | null;
  prix_vente_surplus: number | null;
  distribuable_etudiant: boolean;
  categorie_id: number | null;
  categorie_nom: string | null;
  article_parent_id: number | null;
  article_parent_nom: string | null;
  cree_par: number | null;
  cree_par_nom: string | null;
  modifie_par: number | null;
  modifie_par_nom: string | null;
  created_at: string;
  updated_at: string;
}

interface CategorieAccessoire {
  id: number;
  nom: string;
  description: string | null;
  actif: boolean;
}

interface StockLigne {
  accessoire_id: number;
  solde: number;
  statut: "rupture" | "stock_faible" | "normal";
}

const formatFcfa = (v: number) => `${v.toLocaleString("fr-FR")} FCFA`;

type FiltreStatut = "tous" | "actif" | "inactif";
type FiltreDistribuable = "tous" | "oui" | "non";

const STATUT_STOCK_TONE: Record<StockLigne["statut"], "success" | "warning" | "danger"> = {
  normal: "success",
  stock_faible: "warning",
  rupture: "danger",
};

const Accessoires = () => {
  // Permissions individuelles (Chantier Moyens Généraux, Phase 1) — le backend revalide de toute
  // façon chaque requête ; ce masquage n'est qu'une amélioration d'ergonomie.
  const peutVoir = hasPermission("accessoire.voir");
  const peutGerer = hasPermission("accessoire.gerer");
  // Le stock n'est fusionné dans ce tableau que si le compte a par ailleurs le droit de le
  // consulter — cette page reste utilisable sans lui, la colonne Stock est simplement omise.
  const peutVoirStock = hasPermission("stock.voir");

  const [accessoires, setAccessoires] = useState<Accessoire[]>([]);
  const [categories, setCategories] = useState<CategorieAccessoire[]>([]);
  const [stockParAccessoire, setStockParAccessoire] = useState<Record<number, StockLigne>>({});
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filtreStatut, setFiltreStatut] = useState<FiltreStatut>("tous");
  const [filtreCategorie, setFiltreCategorie] = useState<number | "toutes">("toutes");
  const [filtreDistribuable, setFiltreDistribuable] = useState<FiltreDistribuable>("tous");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Accessoire | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const [categoriesModalOpen, setCategoriesModalOpen] = useState(false);
  const [editingCategorie, setEditingCategorie] = useState<CategorieAccessoire | null>(null);
  const [savingCategorie, setSavingCategorie] = useState(false);
  const [categorieForm] = Form.useForm();

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

  const fetchCategories = async () => {
    try {
      const res = await apiFetch<{ data: CategorieAccessoire[] }>("/api/moyens-generaux/categories-accessoire");
      setCategories(res.data);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return;
      message.error("Erreur lors du chargement des catégories");
    }
  };

  const fetchStock = async () => {
    try {
      const res = await apiFetch<{ data: StockLigne[] }>("/api/moyens-generaux/stock");
      const parId: Record<number, StockLigne> = {};
      res.data.forEach((ligne) => { parId[ligne.accessoire_id] = ligne; });
      setStockParAccessoire(parId);
    } catch {
      // Non bloquant : la colonne Stock reste simplement vide en cas d'échec (ex. site sans magasin).
    }
  };

  useEffect(() => {
    if (!peutVoir) return;
    fetchAccessoires();
    fetchCategories();
    if (peutVoirStock) fetchStock();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredAccessoires = useMemo(() => {
    const q = search.trim().toLowerCase();
    return accessoires.filter((a) => {
      const matchStatut = filtreStatut === "tous" || (filtreStatut === "actif" ? a.actif : !a.actif);
      const matchCategorie = filtreCategorie === "toutes" || a.categorie_id === filtreCategorie;
      const matchDistribuable = filtreDistribuable === "tous"
        || (filtreDistribuable === "oui" ? a.distribuable_etudiant : !a.distribuable_etudiant);
      const matchSearch = !q
        || a.code.toLowerCase().includes(q)
        || a.nom.toLowerCase().includes(q)
        || (a.description ?? "").toLowerCase().includes(q);
      return matchStatut && matchCategorie && matchDistribuable && matchSearch;
    });
  }, [accessoires, search, filtreStatut, filtreCategorie, filtreDistribuable]);

  // Options d'article parent : uniquement des articles de premier niveau (jamais une variante),
  // jamais l'accessoire en cours d'édition lui-même — mêmes règles que la validation backend
  // (controllers/accessoire.controller.js::validerArticleParent), reprises ici pour ne proposer que
  // des choix valides plutôt que de laisser l'utilisateur découvrir le rejet après coup.
  const optionsArticleParent = useMemo(
    () => accessoires.filter((a) => a.article_parent_id === null && a.id !== editing?.id
      && (a.actif || a.id === editing?.article_parent_id)),
    [accessoires, editing]
  );
  // Un article qui a déjà ses propres variantes ne peut pas à son tour devenir une variante —
  // le champ est désactivé plutôt que de laisser l'utilisateur tomber sur un rejet serveur.
  const editingADesVariantes = useMemo(
    () => editing !== null && accessoires.some((a) => a.article_parent_id === editing.id),
    [accessoires, editing]
  );

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ distribuable_etudiant: true });
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

  // ── Catégories ───────────────────────────────────────────────────────────────────────────
  const openCreateCategorie = () => {
    setEditingCategorie(null);
    categorieForm.resetFields();
  };

  const openEditCategorie = (categorie: CategorieAccessoire) => {
    setEditingCategorie(categorie);
    categorieForm.setFieldsValue(categorie);
  };

  const handleSubmitCategorie = async () => {
    try {
      const values = await categorieForm.validateFields();
      setSavingCategorie(true);
      if (editingCategorie) {
        await apiFetch(`/api/moyens-generaux/categories-accessoire/${editingCategorie.id}`, { method: "PUT", body: JSON.stringify(values) });
        message.success("Catégorie mise à jour");
      } else {
        await apiFetch("/api/moyens-generaux/categories-accessoire", { method: "POST", body: JSON.stringify(values) });
        message.success("Catégorie créée");
      }
      openCreateCategorie();
      fetchCategories();
    } catch (e) {
      if (e instanceof ApiError) { message.error(e.message); return; }
      if ((e as any)?.errorFields) return;
      message.error("Erreur lors de l'enregistrement de la catégorie");
    } finally {
      setSavingCategorie(false);
    }
  };

  const toggleStatutCategorie = async (categorie: CategorieAccessoire) => {
    try {
      await apiFetch(`/api/moyens-generaux/categories-accessoire/${categorie.id}/statut`, {
        method: "PATCH",
        body: JSON.stringify({ actif: !categorie.actif }),
      });
      message.success(categorie.actif ? "Catégorie désactivée" : "Catégorie réactivée");
      if (editingCategorie?.id === categorie.id) openCreateCategorie();
      fetchCategories();
    } catch (e) {
      if (e instanceof ApiError) { message.error(e.message); return; }
      message.error("Erreur lors du changement de statut");
    }
  };

  const columns = [
    {
      title: "Catégorie", dataIndex: "categorie_nom", key: "categorie_nom",
      render: (v: string | null) => v || <span style={{ color: "var(--text-soft)" }}>—</span>,
      sorter: (a: Accessoire, b: Accessoire) => (a.categorie_nom ?? "").localeCompare(b.categorie_nom ?? ""),
    },
    {
      title: "Article", dataIndex: "nom", key: "nom",
      render: (nom: string, row: Accessoire) => (
        <Space size={6}>
          <span>{nom}</span>
          {row.article_parent_id !== null && <Tag color="blue">Variante</Tag>}
        </Space>
      ),
      sorter: (a: Accessoire, b: Accessoire) => a.nom.localeCompare(b.nom),
    },
    {
      title: "Parent", dataIndex: "article_parent_nom", key: "article_parent_nom",
      render: (v: string | null) => v || <span style={{ color: "var(--text-soft)" }}>—</span>,
    },
    { title: "Code", dataIndex: "code", key: "code", sorter: (a: Accessoire, b: Accessoire) => a.code.localeCompare(b.code) },
    { title: "Description", dataIndex: "description", key: "description", render: (d: string | null) => d || <span style={{ color: "var(--text-soft)" }}>—</span> },
    {
      title: "Distribuable", dataIndex: "distribuable_etudiant", key: "distribuable_etudiant",
      render: (v: boolean) => <StatusTag tone={v ? "success" : "neutral"} label={v ? "Oui" : "Non"} />,
      sorter: (a: Accessoire, b: Accessoire) => Number(a.distribuable_etudiant) - Number(b.distribuable_etudiant),
    },
    {
      title: "Seuil d'alerte", dataIndex: "seuil_alerte_defaut", key: "seuil_alerte_defaut", align: "right" as const,
      sorter: (a: Accessoire, b: Accessoire) => a.seuil_alerte_defaut - b.seuil_alerte_defaut,
    },
    {
      title: "Prix d'achat", dataIndex: "cout_unitaire_reference", key: "cout_unitaire_reference", align: "right" as const,
      render: (v: number | null) => v !== null ? formatFcfa(v) : <span style={{ color: "var(--text-soft)" }}>—</span>,
      sorter: (a: Accessoire, b: Accessoire) => (a.cout_unitaire_reference ?? 0) - (b.cout_unitaire_reference ?? 0),
    },
    {
      // Chantier Moyens Généraux, Phase 2D — ajustements (2026-08-19) : distinct du prix d'achat
      // ci-dessus — sert de base au montant d'une demande de surplus (jamais confondu, §6).
      title: "Prix vente surplus", dataIndex: "prix_vente_surplus", key: "prix_vente_surplus", align: "right" as const,
      render: (v: number | null) => v !== null ? formatFcfa(v) : <span style={{ color: "var(--text-soft)" }}>—</span>,
      sorter: (a: Accessoire, b: Accessoire) => (a.prix_vente_surplus ?? 0) - (b.prix_vente_surplus ?? 0),
    },
    ...(peutVoirStock ? [{
      title: "Stock", key: "stock", align: "right" as const,
      render: (_: any, row: Accessoire) => {
        const ligne = stockParAccessoire[row.id];
        if (!ligne) return <span style={{ color: "var(--text-soft)" }}>—</span>;
        return <StatusTag tone={STATUT_STOCK_TONE[ligne.statut]} label={String(ligne.solde)} />;
      },
      sorter: (a: Accessoire, b: Accessoire) => (stockParAccessoire[a.id]?.solde ?? -1) - (stockParAccessoire[b.id]?.solde ?? -1),
    }] : []),
    {
      title: "Statut", dataIndex: "actif", key: "actif",
      render: (actif: boolean) => <StatusTag tone={actif ? "success" : "danger"} label={actif ? "Actif" : "Inactif"} />,
      sorter: (a: Accessoire, b: Accessoire) => Number(a.actif) - Number(b.actif),
    },
    {
      title: "Créé le", dataIndex: "created_at", key: "created_at",
      render: (v: string, row: Accessoire) => (
        <Tooltip title={row.cree_par_nom ? `Par ${row.cree_par_nom}` : undefined}>
          {new Date(v).toLocaleDateString("fr-FR")}
        </Tooltip>
      ),
      sorter: (a: Accessoire, b: Accessoire) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    },
    {
      title: "Modifié le", dataIndex: "updated_at", key: "updated_at",
      render: (v: string, row: Accessoire) => (
        <Tooltip title={row.modifie_par_nom ? `Par ${row.modifie_par_nom}` : undefined}>
          {new Date(v).toLocaleDateString("fr-FR")}
        </Tooltip>
      ),
      sorter: (a: Accessoire, b: Accessoire) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime(),
    },
    ...(peutGerer ? [{
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
    }] : []),
  ];

  if (!peutVoir) {
    return (
      <div>
        <PageHeader />
        <AccesRestreint description="Vous n'avez pas la permission de consulter le catalogue des accessoires." />
      </div>
    );
  }

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
            <>
              <Select value={filtreCategorie} onChange={setFiltreCategorie} style={{ width: 180 }}>
                <Option value="toutes">Toutes catégories</Option>
                {categories.map((c) => <Option key={c.id} value={c.id}>{c.nom}</Option>)}
              </Select>
              <Select value={filtreDistribuable} onChange={setFiltreDistribuable} style={{ width: 170 }}>
                <Option value="tous">Distribuable : tous</Option>
                <Option value="oui">Distribuable : oui</Option>
                <Option value="non">Distribuable : non</Option>
              </Select>
              <Select value={filtreStatut} onChange={setFiltreStatut} style={{ width: 160 }}>
                <Option value="tous">Tous les statuts</Option>
                <Option value="actif">Actifs</Option>
                <Option value="inactif">Inactifs</Option>
              </Select>
            </>
          }
          toolbarExtra={
            peutGerer ? (
              <>
                <Button icon={<TagsOutlined />} onClick={() => { openCreateCategorie(); setCategoriesModalOpen(true); }}>
                  Catégories
                </Button>
                <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                  Nouvel accessoire
                </Button>
              </>
            ) : undefined
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
            <Input placeholder="Ex: POLO_JAUNE" />
          </Form.Item>
          <Form.Item name="nom" label="Nom" rules={[{ required: true, message: "Nom requis" }]}>
            <Input placeholder="Ex: Polo jaune" />
          </Form.Item>
          <Form.Item name="description" label="Description (facultative)">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="categorie_id" label="Catégorie (facultative)">
            <Select allowClear placeholder="Aucune catégorie">
              {categories.map((c) => (
                <Option key={c.id} value={c.id}>{c.actif ? c.nom : `${c.nom} (inactif)`}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="article_parent_id"
            label="Article parent (facultatif)"
            tooltip="À renseigner si cet accessoire est une variante (ex. « Polo jaune » a pour parent « Polo »)."
          >
            <Select
              allowClear
              placeholder={editingADesVariantes ? "Cet article a déjà ses propres variantes" : "Aucun — article autonome"}
              disabled={editingADesVariantes}
            >
              {optionsArticleParent.map((a) => <Option key={a.id} value={a.id}>{a.nom}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item
            name="distribuable_etudiant"
            label="Distribuable aux étudiants"
            initialValue={true}
            tooltip="Non : l'article reste géré en stock (commandes, réceptions) mais n'apparaîtra jamais dans une distribution étudiante."
          >
            <Radio.Group>
              <Radio value={true}>Oui</Radio>
              <Radio value={false}>Non</Radio>
            </Radio.Group>
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
            label="Prix d'achat (facultatif)"
            tooltip="Coût d'achat de référence — utilisé pour estimer la valeur du stock, n'affecte pas les commandes."
          >
            <InputNumber min={0} step={0.01} style={{ width: "100%" }} addonAfter="FCFA" />
          </Form.Item>
          <Form.Item
            name="prix_vente_surplus"
            label="Prix de vente surplus (facultatif)"
            tooltip="Distinct du prix d'achat — c'est ce prix qui sera facturé à l'étudiant pour une demande de surplus de cet accessoire. Obligatoire pour pouvoir créer une demande de surplus sur cet article."
          >
            <InputNumber min={0} step={0.01} style={{ width: "100%" }} addonAfter="FCFA" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Catégories d'accessoires"
        open={categoriesModalOpen}
        onCancel={() => setCategoriesModalOpen(false)}
        footer={null}
        width={640}
      >
        <Form form={categorieForm} layout="inline" onFinish={handleSubmitCategorie} style={{ marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
          <Form.Item name="nom" rules={[{ required: true, message: "Nom requis" }]} style={{ flex: "1 1 160px" }}>
            <Input placeholder="Nom (ex: Habillement)" />
          </Form.Item>
          <Form.Item name="description" style={{ flex: "1 1 200px" }}>
            <Input placeholder="Description (facultative)" />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={savingCategorie}>
                {editingCategorie ? "Mettre à jour" : "Ajouter"}
              </Button>
              {editingCategorie && <Button onClick={openCreateCategorie}>Annuler</Button>}
            </Space>
          </Form.Item>
        </Form>

        {categories.length === 0 ? (
          <Empty description="Aucune catégorie pour l'instant" />
        ) : (
          categories.map((c) => (
            <div
              key={c.id}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "8px 0", borderBottom: "1px solid var(--border-soft, #eee)",
              }}
            >
              <div>
                <strong>{c.nom}</strong>
                {c.description && <div style={{ color: "var(--text-soft)", fontSize: 13 }}>{c.description}</div>}
              </div>
              <Space>
                <StatusTag tone={c.actif ? "success" : "danger"} label={c.actif ? "Active" : "Inactive"} />
                <Button icon={<EditOutlined />} size="small" onClick={() => openEditCategorie(c)} />
                <Popconfirm
                  title={c.actif ? "Désactiver cette catégorie ?" : "Réactiver cette catégorie ?"}
                  onConfirm={() => toggleStatutCategorie(c)}
                  okText="Confirmer"
                  cancelText="Annuler"
                >
                  <Button icon={c.actif ? <StopOutlined /> : <CheckCircleOutlined />} size="small" danger={c.actif} />
                </Popconfirm>
              </Space>
            </div>
          ))
        )}
      </Modal>
    </div>
  );
};

export default Accessoires;
