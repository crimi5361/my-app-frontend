/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import { Button, Modal, Form, InputNumber, Select, Radio, Checkbox, message, Popconfirm, Tag, Space } from "antd";
import { PlusOutlined, EditOutlined, StopOutlined, CheckCircleOutlined } from "@ant-design/icons";
import PageHeader from "../../Components/PageHeader/PageHeader";
import PageContainer from "../../Components/ui/PageContainer";
import DataTable from "../../Components/ui/DataTable";
import StatusTag from "../../Components/ui/StatusTag";
import AccesRestreint from "../../Components/ui/AccesRestreint";
import { apiFetch, ApiError } from "../../lib/api";
import { hasPermission } from "../../lib/permissions";

const { Option } = Select;

interface AnneeAcademique {
  id: number;
  annee: string;
}

interface AccessoireOption {
  id: number;
  nom: string;
  distribuable_etudiant: boolean;
  actif: boolean;
}

interface RegleDistribution {
  id: number;
  accessoire_id: number;
  accessoire_nom: string;
  categorie_id: number | null;
  categorie_nom: string | null;
  annee_academique_id: number;
  annee_academique: string;
  niveau_libelle: string | null;
  tous_niveaux: boolean;
  quantite_standard: number;
  actif: boolean;
  cree_par_nom: string | null;
  modifie_par_nom: string | null;
  created_at: string;
  updated_at: string;
}

type FiltreStatut = "tous" | "actif" | "inactif";
type Destination = "tous" | "select";

const ReglesDistribution = () => {
  // Mêmes permissions que le catalogue d'accessoires (Chantier Moyens Généraux, Phase 2B,
  // 2026-08-19) — la configuration des règles fait partie de la gestion du catalogue.
  const peutVoir = hasPermission("accessoire.voir");
  const peutGerer = hasPermission("accessoire.gerer");

  const [regles, setRegles] = useState<RegleDistribution[]>([]);
  const [annees, setAnnees] = useState<AnneeAcademique[]>([]);
  const [accessoires, setAccessoires] = useState<AccessoireOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filtreAnnee, setFiltreAnnee] = useState<number | "toutes">("toutes");
  const [filtreAccessoire, setFiltreAccessoire] = useState<number | "tous">("tous");
  const [filtreStatut, setFiltreStatut] = useState<FiltreStatut>("tous");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const anneeFormulaire = Form.useWatch("annee_academique_id", form);
  const destinationFormulaire: Destination = Form.useWatch("destination", form) ?? "select";
  const [niveauxDisponibles, setNiveauxDisponibles] = useState<string[]>([]);
  const [loadingNiveaux, setLoadingNiveaux] = useState(false);

  const [editingQuantite, setEditingQuantite] = useState<RegleDistribution | null>(null);
  const [savingQuantite, setSavingQuantite] = useState(false);
  const [quantiteForm] = Form.useForm();

  const fetchRegles = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filtreAnnee !== "toutes") params.set("annee_academique_id", String(filtreAnnee));
      if (filtreAccessoire !== "tous") params.set("accessoire_id", String(filtreAccessoire));
      if (filtreStatut !== "tous") params.set("actif", filtreStatut === "actif" ? "true" : "false");
      const res = await apiFetch<{ data: RegleDistribution[] }>(`/api/moyens-generaux/regles-distribution?${params.toString()}`);
      setRegles(res.data);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return;
      message.error("Erreur lors du chargement des règles de distribution");
    } finally {
      setLoading(false);
    }
  };

  const fetchAnnees = async () => {
    try {
      const res = await apiFetch<AnneeAcademique[]>("/api/annees");
      setAnnees(res);
    } catch {
      // Non bloquant : les libellés d'année restent alors vides dans les filtres/formulaire.
    }
  };

  const fetchAccessoires = async () => {
    try {
      const res = await apiFetch<{ data: AccessoireOption[] }>("/api/moyens-generaux/accessoires");
      setAccessoires(res.data);
    } catch {
      // Non bloquant.
    }
  };

  useEffect(() => {
    if (!peutVoir) return;
    fetchAnnees();
    fetchAccessoires();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!peutVoir) return;
    fetchRegles();
  }, [filtreAnnee, filtreAccessoire, filtreStatut]); // eslint-disable-line react-hooks/exhaustive-deps

  // Seuls les accessoires distribuables aux étudiants peuvent recevoir une règle (le backend le
  // revalide de toute façon — ce filtre n'est qu'une amélioration d'ergonomie, cf. Accessoires.tsx).
  const accessoiresDistribuables = useMemo(
    () => accessoires.filter((a) => a.distribuable_etudiant && a.actif),
    [accessoires]
  );

  useEffect(() => {
    if (!isModalOpen || !anneeFormulaire) { setNiveauxDisponibles([]); return; }
    setLoadingNiveaux(true);
    apiFetch<{ data: string[] }>(`/api/moyens-generaux/regles-distribution/niveaux-disponibles?annee_academique_id=${anneeFormulaire}`)
      .then((res) => setNiveauxDisponibles(res.data))
      .catch(() => setNiveauxDisponibles([]))
      .finally(() => setLoadingNiveaux(false));
  }, [isModalOpen, anneeFormulaire]);

  const filteredRegles = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return regles;
    return regles.filter((r) =>
      r.accessoire_nom.toLowerCase().includes(q)
      || (r.niveau_libelle ?? "").toLowerCase().includes(q)
      || (r.categorie_nom ?? "").toLowerCase().includes(q)
    );
  }, [regles, search]);

  const openCreate = () => {
    form.resetFields();
    form.setFieldsValue({ destination: "select", quantite_standard: 1 });
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const body = {
        accessoire_id: values.accessoire_id,
        annee_academique_id: values.annee_academique_id,
        tous_niveaux: values.destination === "tous",
        niveaux: values.destination === "tous" ? undefined : values.niveaux,
        quantite_standard: values.quantite_standard,
      };
      await apiFetch("/api/moyens-generaux/regles-distribution", { method: "POST", body: JSON.stringify(body) });
      message.success("Règle(s) de distribution créée(s)");
      setIsModalOpen(false);
      fetchRegles();
    } catch (e) {
      if (e instanceof ApiError) { message.error(e.message); return; }
      if ((e as any)?.errorFields) return;
      message.error("Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  const toggleActif = async (regle: RegleDistribution) => {
    try {
      await apiFetch(`/api/moyens-generaux/regles-distribution/${regle.id}/activation`, {
        method: "PATCH",
        body: JSON.stringify({ actif: !regle.actif }),
      });
      message.success(regle.actif ? "Règle désactivée" : "Règle réactivée");
      fetchRegles();
    } catch (e) {
      if (e instanceof ApiError) { message.error(e.message); return; }
      message.error("Erreur lors du changement de statut");
    }
  };

  const openEditQuantite = (regle: RegleDistribution) => {
    setEditingQuantite(regle);
    quantiteForm.setFieldsValue({ quantite_standard: regle.quantite_standard });
  };

  const handleSubmitQuantite = async () => {
    if (!editingQuantite) return;
    try {
      const values = await quantiteForm.validateFields();
      setSavingQuantite(true);
      await apiFetch(`/api/moyens-generaux/regles-distribution/${editingQuantite.id}`, {
        method: "PUT",
        body: JSON.stringify({ quantite_standard: values.quantite_standard }),
      });
      message.success("Quantité standard mise à jour");
      setEditingQuantite(null);
      fetchRegles();
    } catch (e) {
      if (e instanceof ApiError) { message.error(e.message); return; }
      if ((e as any)?.errorFields) return;
      message.error("Erreur lors de l'enregistrement");
    } finally {
      setSavingQuantite(false);
    }
  };

  const columns = [
    {
      title: "Année", dataIndex: "annee_academique", key: "annee_academique",
      sorter: (a: RegleDistribution, b: RegleDistribution) => b.annee_academique.localeCompare(a.annee_academique),
    },
    {
      title: "Accessoire", dataIndex: "accessoire_nom", key: "accessoire_nom",
      sorter: (a: RegleDistribution, b: RegleDistribution) => a.accessoire_nom.localeCompare(b.accessoire_nom),
    },
    {
      title: "Catégorie", dataIndex: "categorie_nom", key: "categorie_nom",
      render: (v: string | null) => v || <span style={{ color: "var(--text-soft)" }}>—</span>,
    },
    {
      title: "Destination", key: "destination",
      render: (_: any, row: RegleDistribution) => (
        row.tous_niveaux
          ? <Tag color="purple">Tous les niveaux</Tag>
          : <Tag color="blue">{row.niveau_libelle}</Tag>
      ),
    },
    {
      title: "Quantité", dataIndex: "quantite_standard", key: "quantite_standard", align: "right" as const,
      sorter: (a: RegleDistribution, b: RegleDistribution) => a.quantite_standard - b.quantite_standard,
    },
    {
      title: "Statut", dataIndex: "actif", key: "actif",
      render: (actif: boolean) => <StatusTag tone={actif ? "success" : "danger"} label={actif ? "Actif" : "Inactif"} />,
      sorter: (a: RegleDistribution, b: RegleDistribution) => Number(a.actif) - Number(b.actif),
    },
    ...(peutGerer ? [{
      title: "Action", key: "action",
      render: (_: any, row: RegleDistribution) => (
        <div style={{ display: "flex", gap: 8 }}>
          <Button icon={<EditOutlined />} size="small" onClick={() => openEditQuantite(row)} title="Modifier la quantité standard" />
          <Popconfirm
            title={row.actif ? "Désactiver cette règle ?" : "Réactiver cette règle ?"}
            description={row.actif ? "L'accessoire ne sera plus proposé pour ce niveau/cette année tant qu'elle reste désactivée." : undefined}
            onConfirm={() => toggleActif(row)}
            okText="Confirmer"
            cancelText="Annuler"
          >
            <Button icon={row.actif ? <StopOutlined /> : <CheckCircleOutlined />} size="small" danger={row.actif} />
          </Popconfirm>
        </div>
      ),
    }] : []),
  ];

  if (!peutVoir) {
    return (
      <div>
        <PageHeader />
        <AccesRestreint description="Vous n'avez pas la permission de consulter les règles de distribution." />
      </div>
    );
  }

  return (
    <div>
      <PageHeader />
      <PageContainer
        title="Règles de distribution"
        description="Affectation des accessoires distribuables aux niveaux, par année académique — configuration explicite, aucune reconduction automatique."
      >
        <DataTable<RegleDistribution>
          columns={columns}
          dataSource={filteredRegles}
          rowKey="id"
          loading={loading}
          searchValue={search}
          searchPlaceholder="Rechercher par accessoire, niveau ou catégorie"
          onSearchChange={setSearch}
          filters={
            <>
              <Select value={filtreAnnee} onChange={setFiltreAnnee} style={{ width: 160 }}>
                <Option value="toutes">Toutes années</Option>
                {annees.map((a) => <Option key={a.id} value={a.id}>{a.annee}</Option>)}
              </Select>
              <Select value={filtreAccessoire} onChange={setFiltreAccessoire} style={{ width: 200 }} showSearch optionFilterProp="children">
                <Option value="tous">Tous les accessoires</Option>
                {accessoiresDistribuables.map((a) => <Option key={a.id} value={a.id}>{a.nom}</Option>)}
              </Select>
              <Select value={filtreStatut} onChange={setFiltreStatut} style={{ width: 150 }}>
                <Option value="tous">Tous les statuts</Option>
                <Option value="actif">Actives</Option>
                <Option value="inactif">Inactives</Option>
              </Select>
            </>
          }
          toolbarExtra={
            peutGerer ? (
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                Nouvelle règle
              </Button>
            ) : undefined
          }
          emptyTitle="Aucune règle de distribution configurée"
          emptyDescription="Définissez quels accessoires sont destinés à quels niveaux, pour chaque année académique."
        />
      </PageContainer>

      <Modal
        title="Nouvelle règle de distribution"
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={handleSubmit}
        okText="Enregistrer"
        cancelText="Annuler"
        confirmLoading={saving}
        width={520}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="annee_academique_id" label="Année académique" rules={[{ required: true, message: "Année requise" }]}>
            <Select placeholder="Sélectionner une année" onChange={() => form.setFieldsValue({ niveaux: [] })}>
              {annees.map((a) => <Option key={a.id} value={a.id}>{a.annee}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item
            name="accessoire_id"
            label="Accessoire"
            rules={[{ required: true, message: "Accessoire requis" }]}
            tooltip="Seuls les accessoires marqués « distribuable aux étudiants » sont proposés ici."
          >
            <Select placeholder="Sélectionner un accessoire" showSearch optionFilterProp="children">
              {accessoiresDistribuables.map((a) => <Option key={a.id} value={a.id}>{a.nom}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="destination" label="Destination" initialValue="select">
            <Radio.Group>
              <Space direction="vertical">
                <Radio value="tous">Tous les niveaux</Radio>
                <Radio value="select">Niveaux sélectionnés</Radio>
              </Space>
            </Radio.Group>
          </Form.Item>
          {destinationFormulaire === "select" && (
            <Form.Item
              name="niveaux"
              label="Niveaux"
              rules={[{ required: true, message: "Sélectionnez au moins un niveau", type: "array", min: 1 }]}
            >
              {!anneeFormulaire ? (
                <span style={{ color: "var(--text-soft)" }}>Sélectionnez d'abord une année académique.</span>
              ) : loadingNiveaux ? (
                <span style={{ color: "var(--text-soft)" }}>Chargement des niveaux…</span>
              ) : niveauxDisponibles.length === 0 ? (
                <span style={{ color: "var(--text-soft)" }}>Aucun niveau trouvé pour cette année académique.</span>
              ) : (
                <Checkbox.Group style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {niveauxDisponibles.map((libelle) => <Checkbox key={libelle} value={libelle}>{libelle}</Checkbox>)}
                </Checkbox.Group>
              )}
            </Form.Item>
          )}
          <Form.Item
            name="quantite_standard"
            label="Quantité standard"
            initialValue={1}
            tooltip="Quantité normalement prévue par étudiant pour cet accessoire, à ce niveau."
            rules={[{ required: true, message: "Quantité requise" }]}
          >
            <InputNumber min={1} style={{ width: "100%" }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Modifier la quantité standard"
        open={editingQuantite !== null}
        onCancel={() => setEditingQuantite(null)}
        onOk={handleSubmitQuantite}
        okText="Enregistrer"
        cancelText="Annuler"
        confirmLoading={savingQuantite}
      >
        {editingQuantite && (
          <>
            <p style={{ marginBottom: 16 }}>
              <strong>{editingQuantite.accessoire_nom}</strong> — {editingQuantite.annee_academique} —{" "}
              {editingQuantite.tous_niveaux ? "Tous les niveaux" : editingQuantite.niveau_libelle}
            </p>
            <Form form={quantiteForm} layout="vertical">
              <Form.Item name="quantite_standard" label="Quantité standard" rules={[{ required: true, message: "Quantité requise" }]}>
                <InputNumber min={1} style={{ width: "100%" }} />
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>
    </div>
  );
};

export default ReglesDistribution;
