/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button, Drawer, Modal, Form, Select, InputNumber, Input, Table, Avatar,
  message, Row, Col, Spin, Empty, Tag, Typography, Popconfirm, Tooltip,
} from "antd";
import type { Key } from "react";
import {
  PlusOutlined, UserOutlined, TeamOutlined, SwapOutlined,
  EditOutlined, DeleteOutlined, CheckSquareOutlined, BorderOutlined, ForwardOutlined,
} from "@ant-design/icons";
import PageHeader from "../../Components/PageHeader/PageHeader";
import PageContainer from "../../Components/ui/PageContainer";
import DataTable from "../../Components/ui/DataTable";
import StatusTag from "../../Components/ui/StatusTag";
import { apiFetch, ApiError } from "../../lib/api";

const { Option } = Select;
const { Text } = Typography;

const API_URL = import.meta.env.VITE_API_URL_SERVER;

interface AcademicYear {
  id: number;
  annee: string;
  etat: string;
}

interface ClasseListItem {
  id: number;
  nom: string;
  description: string;
  annee_academique: string;
  ecole: string;
  filiere: string;
  niveau: string;
  groupe_primaire_id: number;
  nb_non_repartis: number;
  nb_groupes_pedagogiques: number;
  effectif_total: number;
}

interface EtudiantGroupe {
  id: number;
  matricule_iipea: string | null;
  nom: string;
  prenoms: string;
  telephone: string | null;
  email: string | null;
  photo_url: string | null;
}

interface GroupePedagogique {
  id: number;
  nom: string;
  capacite_max: number | null;
  effectif: number;
  taux_remplissage: number;
  etudiants: EtudiantGroupe[];
}

interface ClasseDetail {
  id: number;
  nom: string;
  description: string;
  annee_academique: string;
  ecole: string;
  filiere: string;
  niveau: string;
  effectif_total: number;
  groupe_primaire: { id: number; effectif: number; etudiants: EtudiantGroupe[] };
  groupes_pedagogiques: GroupePedagogique[];
}

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

const photoSrc = (photoUrl: string | null) => (photoUrl ? `${API_URL}${photoUrl}` : undefined);

const tauxTone = (taux: number): "success" | "warning" | "danger" => {
  if (taux >= 100) return "danger";
  if (taux >= 80) return "warning";
  return "success";
};

// ---- Section d'un groupe dans le Drawer de management (Groupe primaire ou groupe pédagogique) :
// liste nominative sélectionnable + déplacement vers une destination. Gère sa propre sélection
// et se réinitialise après un déplacement réussi — le parent n'a qu'à fournir les données
// actuelles et à rafraîchir la classe après coup.
interface GroupeSectionProps {
  titre: string;
  sousTitre: React.ReactNode;
  etudiants: EtudiantGroupe[];
  destinations: { id: number; nom: string }[];
  onMove: (destinationId: number, etudiantIds: number[]) => Promise<boolean>;
  emptyText: string;
  showSearch?: boolean;
  highlight?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  deleteDisabledReason?: string | null;
}

const GroupeSection = ({
  titre, sousTitre, etudiants, destinations, onMove, emptyText, showSearch, highlight,
  onEdit, onDelete, deleteDisabledReason,
}: GroupeSectionProps) => {
  const [selectedKeys, setSelectedKeys] = useState<Key[]>([]);
  const [destinationId, setDestinationId] = useState<number | null>(null);
  const [moving, setMoving] = useState(false);
  const [movingFirstN, setMovingFirstN] = useState(false);
  const [localSearch, setLocalSearch] = useState("");
  const [premiersN, setPremiersN] = useState<number | null>(null);

  // Répartition de masse (Sous-phase 4.5) : la recherche filtre déjà la liste visible, donc
  // "tout sélectionner" et "les N premiers" opèrent sur `filtered` — sélectionner tous les
  // étudiants d'une recherche revient donc naturellement à sélectionner le résultat filtré.
  const filtered = useMemo(() => {
    const q = localSearch.trim().toLowerCase();
    if (!q) return etudiants;
    return etudiants.filter(
      (e) => e.nom.toLowerCase().includes(q) || e.prenoms.toLowerCase().includes(q) || (e.matricule_iipea ?? "").toLowerCase().includes(q)
    );
  }, [etudiants, localSearch]);

  const executerDeplacement = async (etudiantIds: number[]) => {
    if (!destinationId || etudiantIds.length === 0) return false;
    const ok = await onMove(destinationId, etudiantIds);
    if (ok) {
      setSelectedKeys([]);
      setPremiersN(null);
      setDestinationId(null);
    }
    return ok;
  };

  const handleMoveSelection = async () => {
    setMoving(true);
    await executerDeplacement(selectedKeys as number[]);
    setMoving(false);
  };

  const handleMoveFirstN = async () => {
    if (!premiersN || premiersN <= 0) return;
    setMovingFirstN(true);
    await executerDeplacement(filtered.slice(0, premiersN).map((e) => e.id));
    setMovingFirstN(false);
  };

  return (
    <div
      style={{
        border: `1px solid ${highlight ? "var(--warning, #eed7ab)" : "var(--border)"}`,
        borderRadius: 10,
        padding: 16,
        marginBottom: 16,
        background: highlight ? "#fbf1de22" : "transparent",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
        <div>
          <Text strong style={{ fontSize: 15 }}>{titre}</Text>
          <div style={{ color: "var(--text-soft)", fontSize: 13 }}>{sousTitre}</div>
        </div>
        {(onEdit || onDelete) && (
          <div style={{ display: "flex", gap: 6 }}>
            {onEdit && <Button size="small" icon={<EditOutlined />} onClick={onEdit}>Modifier</Button>}
            {onDelete && (
              <Tooltip title={deleteDisabledReason ?? ""}>
                <Popconfirm
                  title="Supprimer ce groupe ?"
                  description="Cette action est définitive."
                  onConfirm={onDelete}
                  okText="Supprimer"
                  cancelText="Annuler"
                  disabled={!!deleteDisabledReason}
                >
                  <Button size="small" danger icon={<DeleteOutlined />} disabled={!!deleteDisabledReason}>Supprimer</Button>
                </Popconfirm>
              </Tooltip>
            )}
          </div>
        )}
      </div>

      {showSearch && etudiants.length > 0 && (
        <Input
          allowClear
          size="small"
          placeholder="Rechercher un étudiant…"
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          style={{ marginBottom: 10, maxWidth: 280 }}
        />
      )}

      {etudiants.length === 0 ? (
        <Empty description={emptyText} image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ margin: "12px 0" }} />
      ) : (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
            <Button size="small" icon={<CheckSquareOutlined />} onClick={() => setSelectedKeys(filtered.map((e) => e.id))}>
              Tout sélectionner ({filtered.length})
            </Button>
            <Button size="small" icon={<BorderOutlined />} onClick={() => setSelectedKeys([])} disabled={selectedKeys.length === 0}>
              Tout désélectionner
            </Button>
          </div>

          <Table<EtudiantGroupe>
            dataSource={filtered}
            rowKey="id"
            size="small"
            pagination={false}
            scroll={{ y: 260 }}
            rowSelection={{ selectedRowKeys: selectedKeys, onChange: setSelectedKeys }}
            columns={[
              {
                title: "", key: "avatar", width: 40,
                render: (_: any, r: EtudiantGroupe) => <Avatar size="small" src={photoSrc(r.photo_url)} icon={<UserOutlined />} />,
              },
              { title: "Nom", dataIndex: "nom", key: "nom" },
              { title: "Prénoms", dataIndex: "prenoms", key: "prenoms" },
              { title: "Matricule", dataIndex: "matricule_iipea", key: "matricule_iipea", render: (v: string | null) => v || <span style={{ color: "var(--text-soft)" }}>—</span> },
            ]}
          />
          <div style={{ display: "flex", gap: 16, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
            <Select
              placeholder="Déplacer vers…"
              style={{ width: 220 }}
              value={destinationId}
              onChange={setDestinationId}
              disabled={destinations.length === 0}
            >
              {destinations.map((d) => <Option key={d.id} value={d.id}>{d.nom}</Option>)}
            </Select>
            <Button
              type="primary"
              icon={<SwapOutlined />}
              disabled={!destinationId || selectedKeys.length === 0}
              loading={moving}
              onClick={handleMoveSelection}
            >
              Déplacer la sélection {selectedKeys.length > 0 ? `(${selectedKeys.length})` : ""}
            </Button>

            <div style={{ display: "flex", gap: 8, alignItems: "center", borderLeft: "1px solid var(--border)", paddingLeft: 16 }}>
              <Text style={{ fontSize: 13, color: "var(--text-soft)" }}>ou les</Text>
              <InputNumber min={1} max={filtered.length} value={premiersN} onChange={setPremiersN} placeholder="N" style={{ width: 70 }} />
              <Text style={{ fontSize: 13, color: "var(--text-soft)" }}>premiers</Text>
              <Button
                icon={<ForwardOutlined />}
                disabled={!destinationId || !premiersN || premiersN <= 0}
                loading={movingFirstN}
                onClick={handleMoveFirstN}
              >
                Déplacer
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const GestionGroupes = () => {
  const currentUser = getUserInfo();
  const departementId = currentUser?.departement_id;

  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [selectedYearId, setSelectedYearId] = useState<number | null>(null);
  const [loadingYears, setLoadingYears] = useState(true);

  const [classes, setClasses] = useState<ClasseListItem[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [search, setSearch] = useState("");
  const [filtreFiliere, setFiltreFiliere] = useState<string>("toutes");
  const [filtreRepartition, setFiltreRepartition] = useState<string>("toutes");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [classeDetail, setClasseDetail] = useState<ClasseDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm] = Form.useForm();
  const [creating, setCreating] = useState(false);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingGroupe, setEditingGroupe] = useState<GroupePedagogique | null>(null);
  const [editForm] = Form.useForm();
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!departementId) {
      setLoadingYears(false);
      return;
    }
    apiFetch<AcademicYear[]>(`/api/annees?site_id=${departementId}`)
      .then((years) => {
        setAcademicYears(years);
        const currentYear = years.find((y) => y.etat === "en cour" || y.etat === "en cours");
        setSelectedYearId(currentYear ? currentYear.id : years[0]?.id ?? null);
      })
      .catch((e) => { if (e instanceof ApiError && e.status === 401) return; message.error("Impossible de charger les années académiques."); })
      .finally(() => setLoadingYears(false));
  }, [departementId]);

  const fetchClasses = useCallback(() => {
    if (!selectedYearId) return;
    setLoadingClasses(true);
    apiFetch<{ data: ClasseListItem[] }>(`/api/decoupage/classes?anneeAcademiqueId=${selectedYearId}`)
      .then((res) => setClasses(res.data))
      .catch((e) => { if (e instanceof ApiError && e.status === 401) return; message.error("Erreur lors du chargement des classes."); })
      .finally(() => setLoadingClasses(false));
  }, [selectedYearId]);

  useEffect(() => { fetchClasses(); }, [fetchClasses]);

  const fetchDetail = useCallback((classeId: number) => {
    setLoadingDetail(true);
    apiFetch<{ data: ClasseDetail }>(`/api/decoupage/classes/${classeId}`)
      .then((res) => setClasseDetail(res.data))
      .catch((e) => { if (e instanceof ApiError) { message.error(e.message); return; } message.error("Erreur lors du chargement de la classe."); })
      .finally(() => setLoadingDetail(false));
  }, []);

  const openDrawer = (classe: ClasseListItem) => {
    setDrawerOpen(true);
    setClasseDetail(null);
    fetchDetail(classe.id);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setClasseDetail(null);
    fetchClasses();
  };

  const filieresOptions = useMemo(() => Array.from(new Set(classes.map((c) => c.filiere))).sort(), [classes]);

  const filteredClasses = useMemo(() => {
    const q = search.trim().toLowerCase();
    return classes.filter((c) => {
      const matchFiliere = filtreFiliere === "toutes" || c.filiere === filtreFiliere;
      const matchRepartition =
        filtreRepartition === "toutes" ||
        (filtreRepartition === "non_reparti" && c.nb_non_repartis > 0) ||
        (filtreRepartition === "complet" && c.nb_non_repartis === 0);
      const matchSearch = !q || c.nom.toLowerCase().includes(q) || c.filiere.toLowerCase().includes(q) || c.niveau.toLowerCase().includes(q);
      return matchFiliere && matchRepartition && matchSearch;
    });
  }, [classes, search, filtreFiliere, filtreRepartition]);

  const handleMove = async (destinationId: number, etudiantIds: number[]): Promise<boolean> => {
    if (!classeDetail) return false;
    try {
      await apiFetch(`/api/decoupage/classes/${classeDetail.id}/groupes/${destinationId}/etudiants`, {
        method: "POST",
        body: JSON.stringify({ etudiantIds }),
      });
      message.success(`${etudiantIds.length} étudiant${etudiantIds.length > 1 ? "s" : ""} déplacé${etudiantIds.length > 1 ? "s" : ""}`);
      fetchDetail(classeDetail.id);
      fetchClasses();
      return true;
    } catch (e) {
      if (e instanceof ApiError) { message.error(e.message); return false; }
      message.error("Erreur lors du déplacement.");
      return false;
    }
  };

  const openCreateModal = () => {
    createForm.resetFields();
    setIsCreateModalOpen(true);
  };

  const handleCreateGroupe = async () => {
    if (!classeDetail) return;
    try {
      const values = await createForm.validateFields();
      setCreating(true);
      await apiFetch(`/api/decoupage/classes/${classeDetail.id}/groupes`, {
        method: "POST",
        body: JSON.stringify({ nom: values.nom, capacite_max: values.capacite_max }),
      });
      message.success("Groupe créé");
      setIsCreateModalOpen(false);
      fetchDetail(classeDetail.id);
      fetchClasses();
    } catch (e) {
      if (e instanceof ApiError) { message.error(e.message); return; }
      if ((e as any)?.errorFields) return;
      message.error("Erreur lors de la création du groupe.");
    } finally {
      setCreating(false);
    }
  };

  const openEditModal = (groupe: GroupePedagogique) => {
    setEditingGroupe(groupe);
    editForm.setFieldsValue({ nom: groupe.nom, capacite_max: groupe.capacite_max });
    setIsEditModalOpen(true);
  };

  const handleEditGroupe = async () => {
    if (!classeDetail || !editingGroupe) return;
    try {
      const values = await editForm.validateFields();
      setEditing(true);
      await apiFetch(`/api/decoupage/classes/${classeDetail.id}/groupes/${editingGroupe.id}`, {
        method: "PUT",
        body: JSON.stringify({ nom: values.nom, capacite_max: values.capacite_max }),
      });
      message.success("Groupe modifié");
      setIsEditModalOpen(false);
      fetchDetail(classeDetail.id);
      fetchClasses();
    } catch (e) {
      if (e instanceof ApiError) { message.error(e.message); return; }
      if ((e as any)?.errorFields) return;
      message.error("Erreur lors de la modification du groupe.");
    } finally {
      setEditing(false);
    }
  };

  const handleDeleteGroupe = async (groupe: GroupePedagogique) => {
    if (!classeDetail) return;
    try {
      await apiFetch(`/api/decoupage/classes/${classeDetail.id}/groupes/${groupe.id}`, { method: "DELETE" });
      message.success("Groupe supprimé");
      fetchDetail(classeDetail.id);
      fetchClasses();
    } catch (e) {
      if (e instanceof ApiError) { message.error(e.message); return; }
      message.error("Erreur lors de la suppression du groupe.");
    }
  };

  const columns = [
    { title: "École", dataIndex: "ecole", key: "ecole", sorter: (a: ClasseListItem, b: ClasseListItem) => a.ecole.localeCompare(b.ecole) },
    { title: "Filière", dataIndex: "filiere", key: "filiere", sorter: (a: ClasseListItem, b: ClasseListItem) => a.filiere.localeCompare(b.filiere) },
    { title: "Niveau", dataIndex: "niveau", key: "niveau", sorter: (a: ClasseListItem, b: ClasseListItem) => a.niveau.localeCompare(b.niveau) },
    { title: "Classe", dataIndex: "nom", key: "nom", sorter: (a: ClasseListItem, b: ClasseListItem) => a.nom.localeCompare(b.nom) },
    {
      title: "Effectif", dataIndex: "effectif_total", key: "effectif_total", align: "right" as const,
      sorter: (a: ClasseListItem, b: ClasseListItem) => a.effectif_total - b.effectif_total,
    },
    {
      title: "Groupes", dataIndex: "nb_groupes_pedagogiques", key: "nb_groupes_pedagogiques", align: "right" as const,
      sorter: (a: ClasseListItem, b: ClasseListItem) => a.nb_groupes_pedagogiques - b.nb_groupes_pedagogiques,
    },
    {
      title: "Non répartis", dataIndex: "nb_non_repartis", key: "nb_non_repartis", align: "right" as const,
      sorter: (a: ClasseListItem, b: ClasseListItem) => a.nb_non_repartis - b.nb_non_repartis,
      render: (v: number) => v > 0 ? <StatusTag tone="warning" label={String(v)} /> : <span style={{ color: "var(--text-soft)" }}>0</span>,
    },
    {
      title: "Action", key: "action",
      render: (_: any, row: ClasseListItem) => (
        <Button type="primary" size="small" icon={<TeamOutlined />} onClick={() => openDrawer(row)}>
          Gérer
        </Button>
      ),
    },
  ];

  const destinationsPourPrimaire = useMemo(
    () => (classeDetail?.groupes_pedagogiques ?? []).map((g) => ({ id: g.id, nom: g.nom })),
    [classeDetail]
  );

  if (loadingYears) {
    return (
      <div>
        <PageHeader />
        <div style={{ textAlign: "center", padding: 60 }}><Spin size="large" /></div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader />
      <PageContainer
        title="Gestion des groupes"
        description="Répartition des étudiants du Groupe primaire vers les groupes pédagogiques — nouvelle organisation 2026-2027"
      >
        <Row gutter={12} style={{ marginBottom: 16 }} align="middle">
          <Col flex="220px">
            <Select value={selectedYearId} onChange={setSelectedYearId} style={{ width: "100%" }} placeholder="Année académique">
              {academicYears.map((y) => <Option key={y.id} value={y.id}>{y.annee} ({y.etat})</Option>)}
            </Select>
          </Col>
        </Row>

        <DataTable<ClasseListItem>
          columns={columns}
          dataSource={filteredClasses}
          rowKey="id"
          loading={loadingClasses}
          searchValue={search}
          searchPlaceholder="Rechercher par classe, filière ou niveau"
          onSearchChange={setSearch}
          filters={
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Select value={filtreFiliere} onChange={setFiltreFiliere} style={{ width: 220 }}>
                <Option value="toutes">Toutes les filières</Option>
                {filieresOptions.map((f) => <Option key={f} value={f}>{f}</Option>)}
              </Select>
              <Select value={filtreRepartition} onChange={setFiltreRepartition} style={{ width: 200 }}>
                <Option value="toutes">Toutes les classes</Option>
                <Option value="non_reparti">Avec non-répartis</Option>
                <Option value="complet">Entièrement réparties</Option>
              </Select>
            </div>
          }
          emptyTitle="Aucune classe pour cette année"
          emptyDescription="Les classes apparaissent ici dès la première inscription 2026-2027."
        />
      </PageContainer>

      <Drawer
        title={classeDetail ? `${classeDetail.nom} — ${classeDetail.filiere} · ${classeDetail.niveau}` : "Gestion des groupes"}
        open={drawerOpen}
        onClose={closeDrawer}
        width="90%"
        styles={{ body: { background: "var(--surface-soft, #fafafa)" } }}
      >
        {loadingDetail || !classeDetail ? (
          <div style={{ textAlign: "center", padding: 60 }}><Spin size="large" /></div>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
              <div>
                <Text style={{ fontSize: 13, color: "var(--text-soft)" }}>{classeDetail.ecole} · {classeDetail.annee_academique}</Text>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{classeDetail.effectif_total} étudiant{classeDetail.effectif_total > 1 ? "s" : ""}</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Tag color="blue" style={{ fontSize: 13, padding: "4px 12px", borderRadius: 999 }}>
                  {classeDetail.groupes_pedagogiques.length} groupe{classeDetail.groupes_pedagogiques.length > 1 ? "s" : ""}
                </Tag>
                <Tag color={classeDetail.groupe_primaire.effectif > 0 ? "orange" : "green"} style={{ fontSize: 13, padding: "4px 12px", borderRadius: 999 }}>
                  {classeDetail.groupe_primaire.effectif} non réparti{classeDetail.groupe_primaire.effectif > 1 ? "s" : ""}
                </Tag>
              </div>
            </div>

            <GroupeSection
              titre="GROUPE PRIMAIRE"
              sousTitre="Étudiants inscrits, pas encore affectés à un groupe pédagogique"
              etudiants={classeDetail.groupe_primaire.etudiants}
              destinations={destinationsPourPrimaire}
              onMove={handleMove}
              emptyText="Tous les étudiants sont répartis"
              showSearch
              highlight={classeDetail.groupe_primaire.effectif > 0}
            />

            {classeDetail.groupes_pedagogiques.map((g) => (
              <GroupeSection
                key={g.id}
                titre={g.nom.toUpperCase()}
                sousTitre={
                  <>
                    Effectif : {g.effectif} / {g.capacite_max ?? "∞"}{" "}
                    <StatusTag tone={tauxTone(g.taux_remplissage)} label={`${g.taux_remplissage}%`} />
                  </>
                }
                etudiants={g.etudiants}
                destinations={[
                  ...destinationsPourPrimaire.filter((d) => d.id !== g.id),
                ]}
                onMove={handleMove}
                emptyText="Aucun étudiant dans ce groupe"
                onEdit={() => openEditModal(g)}
                onDelete={() => handleDeleteGroupe(g)}
                deleteDisabledReason={g.effectif > 0 ? `Ce groupe contient ${g.effectif} étudiant(s) — déplacez-les avant de le supprimer.` : null}
              />
            ))}

            <div style={{ textAlign: "center", marginTop: 8 }}>
              <Button type="dashed" icon={<PlusOutlined />} onClick={openCreateModal} block style={{ height: 44 }}>
                Créer un groupe
              </Button>
            </div>
          </>
        )}
      </Drawer>

      <Modal
        title="Créer un groupe pédagogique"
        open={isCreateModalOpen}
        onCancel={() => setIsCreateModalOpen(false)}
        onOk={handleCreateGroupe}
        okText="Créer"
        cancelText="Annuler"
        confirmLoading={creating}
      >
        <Form form={createForm} layout="vertical">
          <Form.Item name="nom" label="Nom du groupe" rules={[{ required: true, message: "Le nom est requis" }]}>
            <Input placeholder="Ex: Groupe 1" />
          </Form.Item>
          <Form.Item name="capacite_max" label="Capacité maximale" rules={[{ required: true, message: "La capacité est requise" }]}>
            <InputNumber min={1} style={{ width: "100%" }} placeholder="Ex: 60" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingGroupe ? `Modifier « ${editingGroupe.nom} »` : "Modifier le groupe"}
        open={isEditModalOpen}
        onCancel={() => setIsEditModalOpen(false)}
        onOk={handleEditGroupe}
        okText="Enregistrer"
        cancelText="Annuler"
        confirmLoading={editing}
      >
        <Form form={editForm} layout="vertical">
          <Form.Item name="nom" label="Nom du groupe" rules={[{ required: true, message: "Le nom est requis" }]}>
            <Input placeholder="Ex: Groupe 1" />
          </Form.Item>
          <Form.Item
            name="capacite_max"
            label="Capacité maximale"
            rules={[{ required: true, message: "La capacité est requise" }]}
            extra={editingGroupe ? `Effectif actuel : ${editingGroupe.effectif} — la capacité ne peut pas être réduite en dessous.` : undefined}
          >
            <InputNumber min={editingGroupe?.effectif || 1} style={{ width: "100%" }} placeholder="Ex: 60" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default GestionGroupes;
