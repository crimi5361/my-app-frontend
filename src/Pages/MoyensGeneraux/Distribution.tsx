/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input, Card, List, Avatar, Row, Col, Descriptions, Tag, Button, InputNumber, Select, Table, message, Empty, Spin, Alert, Space, Typography } from "antd";
import {
  SearchOutlined, UserOutlined, CheckCircleFilled, CloseCircleFilled,
  PlusOutlined, DeleteOutlined, EyeOutlined, RollbackOutlined, PrinterOutlined,
} from "@ant-design/icons";
import PageHeader from "../../Components/PageHeader/PageHeader";
import PageContainer from "../../Components/ui/PageContainer";
import { apiFetch, ApiError } from "../../lib/api";

const { Option } = Select;
const { Text, Title } = Typography;

const API_URL = import.meta.env.VITE_API_URL_SERVER;

interface AcademicYear {
  id: number;
  annee: string;
  etat: string;
}

interface EtudiantResultat {
  id: number;
  nom: string;
  prenoms: string;
  matricule_iipea: string;
  standing: string;
  photo_url: string | null;
}

interface DistributionResultat {
  id: number;
  numero_recu: string;
  date_remise: string;
  etudiant_id: number;
  nom: string;
  prenoms: string;
  matricule_iipea: string;
}

interface LigneRemise {
  accessoire_id: number;
  code: string;
  nom: string;
  quantite: number;
}

interface RemiseDetail {
  id: number;
  numero_recu: string;
  date_remise: string;
  agent_nom: string;
  annee_academique: string;
  lignes: LigneRemise[];
}

interface FicheEtudiant {
  id: number;
  nom: string;
  prenoms: string;
  matricule: string;
  matricule_iipea: string;
  sexe: string;
  photo_url: string | null;
  standing: string;
  statut_scolaire: string | null;
  annee_academique: string;
  filiere: string;
  niveau: string;
  classe: string | null;
  ecole: string;
  deja_remis: boolean;
  remise: RemiseDetail | null;
}

interface AccessoireStock {
  accessoire_id: number;
  code: string;
  nom: string;
  solde: number;
}

const photoSrc = (photoUrl: string | null) => (photoUrl ? `${API_URL}${photoUrl}` : undefined);

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

const Distribution = () => {
  const navigate = useNavigate();
  const currentUser = getUserInfo();
  const departementId = currentUser?.departement_id;

  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [selectedYearId, setSelectedYearId] = useState<number | null>(null);
  const [loadingYears, setLoadingYears] = useState(true);

  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [etudiants, setEtudiants] = useState<EtudiantResultat[]>([]);
  const [remisesTrouvees, setRemisesTrouvees] = useState<DistributionResultat[]>([]);
  const [aRecherche, setARecherche] = useState(false);

  const [fiche, setFiche] = useState<FicheEtudiant | null>(null);
  const [loadingFiche, setLoadingFiche] = useState(false);

  const [remiseConsultee, setRemiseConsultee] = useState<RemiseDetail | null>(null);

  const [accessoiresDisponibles, setAccessoiresDisponibles] = useState<AccessoireStock[]>([]);
  const [lignes, setLignes] = useState<{ accessoire_id: number; code: string; nom: string; quantite: number }[]>([]);
  const [ligneAccessoireId, setLigneAccessoireId] = useState<number | null>(null);
  const [ligneQuantite, setLigneQuantite] = useState<number | null>(null);
  const [validation, setValidation] = useState(false);

  const [derniereRemise, setDerniereRemise] = useState<RemiseDetail | null>(null);

  const searchInputRef = useRef<any>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!departementId) {
      setLoadingYears(false);
      return;
    }
    apiFetch<AcademicYear[]>(`/api/annees?site_id=${departementId}`)
      .then((years) => {
        setAcademicYears(years);
        const currentYear = years.find((y) => y.etat === 'en cour' || y.etat === 'en cours');
        setSelectedYearId(currentYear ? currentYear.id : years[0]?.id ?? null);
      })
      .catch((e) => { if (e instanceof ApiError && e.status === 401) return; message.error("Impossible de charger les années académiques."); })
      .finally(() => setLoadingYears(false));
  }, [departementId]);

  useEffect(() => {
    apiFetch<{ data: AccessoireStock[] }>("/api/moyens-generaux/stock")
      .then((res) => setAccessoiresDisponibles(res.data))
      .catch(() => {});
  }, []);

  const reinitialiser = useCallback(() => {
    setQuery("");
    setEtudiants([]);
    setRemisesTrouvees([]);
    setARecherche(false);
    setFiche(null);
    setRemiseConsultee(null);
    setLignes([]);
    setLigneAccessoireId(null);
    setLigneQuantite(null);
    setDerniereRemise(null);
    // Recharge le stock (soldes potentiellement modifiés par la remise précédente).
    apiFetch<{ data: AccessoireStock[] }>("/api/moyens-generaux/stock").then((res) => setAccessoiresDisponibles(res.data)).catch(() => {});
    setTimeout(() => searchInputRef.current?.focus(), 50);
  }, []);

  // Changer d'année académique invalide toute recherche/fiche en cours — évite d'afficher une
  // fiche chargée sous une autre année par erreur.
  useEffect(() => {
    reinitialiser();
  }, [selectedYearId, reinitialiser]);

  const lancerRecherche = useCallback((q: string) => {
    if (q.trim().length < 2 || !selectedYearId) {
      setEtudiants([]);
      setRemisesTrouvees([]);
      setARecherche(false);
      return;
    }
    setSearching(true);
    apiFetch<{ data: { etudiants: EtudiantResultat[]; distributions: DistributionResultat[] } }>(`/api/moyens-generaux/distribution/recherche?q=${encodeURIComponent(q)}&anneeAcademiqueId=${selectedYearId}`)
      .then((res) => {
        setEtudiants(res.data.etudiants);
        setRemisesTrouvees(res.data.distributions);
        setARecherche(true);
      })
      .catch((e) => { if (e instanceof ApiError && e.status === 401) return; message.error("Erreur lors de la recherche"); })
      .finally(() => setSearching(false));
  }, [selectedYearId]);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setFiche(null);
    setRemiseConsultee(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => lancerRecherche(value), 350);
  };

  const selectionnerEtudiant = (etudiantId: number) => {
    if (!selectedYearId) return;
    setLoadingFiche(true);
    setRemiseConsultee(null);
    apiFetch<{ data: FicheEtudiant }>(`/api/moyens-generaux/distribution/etudiant/${etudiantId}?anneeAcademiqueId=${selectedYearId}`)
      .then((res) => {
        setFiche(res.data);
        setLignes([]);
        setLigneAccessoireId(null);
        setLigneQuantite(null);
      })
      .catch((e) => { if (e instanceof ApiError) { message.error(e.message); return; } message.error("Impossible de charger la fiche étudiant"); })
      .finally(() => setLoadingFiche(false));
  };

  const consulterRemise = (distributionId: number) => {
    apiFetch<{ data: RemiseDetail }>(`/api/moyens-generaux/distribution/${distributionId}`)
      .then((res) => { setRemiseConsultee(res.data); setFiche(null); })
      .catch(() => message.error("Impossible de charger la remise"));
  };

  const ajouterLigne = () => {
    if (!ligneAccessoireId || !ligneQuantite || ligneQuantite <= 0) {
      message.warning("Choisissez un accessoire et une quantité positive.");
      return;
    }
    if (lignes.some((l) => l.accessoire_id === ligneAccessoireId)) {
      message.warning("Cet accessoire est déjà dans la liste — modifiez la ligne existante.");
      return;
    }
    const accessoire = accessoiresDisponibles.find((a) => a.accessoire_id === ligneAccessoireId);
    if (accessoire && ligneQuantite > accessoire.solde) {
      message.warning(`Stock insuffisant : ${accessoire.solde} disponible(s) seulement.`);
      return;
    }
    setLignes((prev) => [...prev, { accessoire_id: ligneAccessoireId, code: accessoire?.code ?? "", nom: accessoire?.nom ?? "", quantite: ligneQuantite }]);
    setLigneAccessoireId(null);
    setLigneQuantite(null);
  };

  const retirerLigne = (accessoireId: number) => {
    setLignes((prev) => prev.filter((l) => l.accessoire_id !== accessoireId));
  };

  const validerRemise = async () => {
    if (!fiche || !selectedYearId) return;
    if (lignes.length === 0) {
      message.warning("Ajoutez au moins un accessoire à remettre.");
      return;
    }
    setValidation(true);
    try {
      const res = await apiFetch<{ data: RemiseDetail }>("/api/moyens-generaux/distribution", {
        method: "POST",
        body: JSON.stringify({
          etudiant_id: fiche.id,
          annee_academique_id: selectedYearId,
          lignes: lignes.map((l) => ({ accessoire_id: l.accessoire_id, quantite: l.quantite })),
        }),
      });
      message.success(`Remise enregistrée — reçu ${res.data.numero_recu}`);
      setDerniereRemise(res.data);
      setFiche({ ...fiche, deja_remis: true, remise: res.data });
      setLignes([]);
    } catch (e) {
      if (e instanceof ApiError) { message.error(e.message); return; }
      message.error("Erreur lors de la validation de la remise");
    } finally {
      setValidation(false);
    }
  };

  const renderIndicateurStatut = (dejaRemis: boolean) => (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", borderRadius: 10,
        background: dejaRemis ? "var(--danger-bg, #fbeae8)" : "var(--success-bg, #e7f6ee)",
        border: `2px solid ${dejaRemis ? "var(--danger)" : "var(--success)"}`,
        marginBottom: 20,
      }}
    >
      {dejaRemis ? <CloseCircleFilled style={{ fontSize: 32, color: "var(--danger)" }} /> : <CheckCircleFilled style={{ fontSize: 32, color: "var(--success)" }} />}
      <Title level={4} style={{ margin: 0, color: dejaRemis ? "var(--danger)" : "var(--success)" }}>
        {dejaRemis ? "ACCESSOIRES DÉJÀ REMIS" : "ACCESSOIRES NON REMIS"}
      </Title>
    </div>
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
      <PageContainer title="Distribution des accessoires" description="Recherche étudiant, remise et suivi anti-fraude — Moyens Généraux">
        <Row gutter={12} style={{ marginBottom: 16 }} align="middle">
          <Col flex="220px">
            <Select value={selectedYearId} onChange={setSelectedYearId} style={{ width: "100%" }} placeholder="Année académique">
              {academicYears.map((y) => (
                <Option key={y.id} value={y.id}>{y.annee} ({y.etat})</Option>
              ))}
            </Select>
          </Col>
          <Col flex="auto">
            <Input
              ref={searchInputRef}
              size="large"
              allowClear
              autoFocus
              prefix={<SearchOutlined />}
              placeholder="Nom, prénom, matricule IIPEA ou numéro de reçu de remise…"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              disabled={!selectedYearId}
            />
          </Col>
        </Row>
        <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 16 }}>
          Seuls les étudiants inscrits pour l'année académique sélectionnée apparaissent dans la recherche.
        </Text>

        {searching && <div style={{ textAlign: "center", padding: 20 }}><Spin /></div>}

        {!fiche && !remiseConsultee && aRecherche && !searching && (
          <Row gutter={16}>
            <Col span={14}>
              <Card title="Étudiants" size="small" style={{ marginBottom: 16 }}>
                {etudiants.length > 0 ? (
                  <List
                    dataSource={etudiants}
                    renderItem={(e) => (
                      <List.Item
                        style={{ cursor: "pointer" }}
                        onClick={() => selectionnerEtudiant(e.id)}
                        actions={[<Button key="ouvrir" type="link">Ouvrir la fiche</Button>]}
                      >
                        <List.Item.Meta
                          avatar={<Avatar src={photoSrc(e.photo_url)} icon={<UserOutlined />} />}
                          title={`${e.nom} ${e.prenoms}`}
                          description={<>Matricule IIPEA : {e.matricule_iipea} · <Tag color={e.standing === "Inscrit" ? "success" : "default"}>{e.standing}</Tag></>}
                        />
                      </List.Item>
                    )}
                  />
                ) : <Empty description="Aucun étudiant trouvé" />}
              </Card>
            </Col>
            <Col span={10}>
              <Card title="Remises déjà effectuées (par numéro de reçu)" size="small">
                {remisesTrouvees.length > 0 ? (
                  <List
                    dataSource={remisesTrouvees}
                    renderItem={(d) => (
                      <List.Item
                        style={{ cursor: "pointer" }}
                        onClick={() => consulterRemise(d.id)}
                        actions={[<Button key="voir" type="link" icon={<EyeOutlined />}>Voir</Button>]}
                      >
                        <List.Item.Meta
                          title={d.numero_recu}
                          description={`${d.nom} ${d.prenoms} — ${new Date(d.date_remise).toLocaleDateString("fr-FR")}`}
                        />
                      </List.Item>
                    )}
                  />
                ) : <Empty description="Aucune remise correspondante" />}
              </Card>
            </Col>
          </Row>
        )}

        {loadingFiche && <div style={{ textAlign: "center", padding: 40 }}><Spin size="large" /></div>}

        {remiseConsultee && (
          <Card
            title={`Remise ${remiseConsultee.numero_recu}`}
            extra={<Button icon={<RollbackOutlined />} onClick={reinitialiser}>Nouvelle recherche</Button>}
          >
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="Date">{new Date(remiseConsultee.date_remise).toLocaleString("fr-FR")}</Descriptions.Item>
              <Descriptions.Item label="Agent">{remiseConsultee.agent_nom}</Descriptions.Item>
              <Descriptions.Item label="Année académique">{remiseConsultee.annee_academique}</Descriptions.Item>
            </Descriptions>
            <div style={{ marginTop: 16, marginBottom: 8, fontWeight: 600 }}>Accessoires remis</div>
            <Table
              dataSource={remiseConsultee.lignes}
              rowKey="accessoire_id"
              size="small"
              pagination={false}
              columns={[{ title: "Accessoire", dataIndex: "nom" }, { title: "Quantité", dataIndex: "quantite", align: "right" as const }]}
            />
            <div style={{ marginTop: 16, textAlign: "right" }}>
              <Button type="primary" icon={<PrinterOutlined />} onClick={() => navigate(`/moyens-generaux/recu/${remiseConsultee.id}`)}>
                Voir / imprimer le reçu
              </Button>
            </div>
          </Card>
        )}

        {fiche && (
          <Card extra={<Button icon={<RollbackOutlined />} onClick={reinitialiser}>Nouvelle recherche</Button>}>
            <Row gutter={24}>
              <Col span={6} style={{ textAlign: "center" }}>
                <Avatar size={140} src={photoSrc(fiche.photo_url)} icon={<UserOutlined />} style={{ marginBottom: 12 }} />
                <Title level={5} style={{ margin: 0 }}>{fiche.nom} {fiche.prenoms}</Title>
                <Text type="secondary">{fiche.sexe}</Text>
              </Col>
              <Col span={18}>
                <Descriptions column={2} size="small" bordered>
                  <Descriptions.Item label="Matricule">{fiche.matricule}</Descriptions.Item>
                  <Descriptions.Item label="Matricule IIPEA">{fiche.matricule_iipea}</Descriptions.Item>
                  <Descriptions.Item label="École">{fiche.ecole}</Descriptions.Item>
                  <Descriptions.Item label="Filière">{fiche.filiere}</Descriptions.Item>
                  <Descriptions.Item label="Niveau">{fiche.niveau}</Descriptions.Item>
                  <Descriptions.Item label="Classe">{fiche.classe ?? <span style={{ color: "var(--text-soft)" }}>Non affecté</span>}</Descriptions.Item>
                  <Descriptions.Item label="Année académique">{fiche.annee_academique}</Descriptions.Item>
                  <Descriptions.Item label="Statut d'inscription">
                    <Tag color={fiche.standing === "Inscrit" ? "success" : "default"}>{fiche.standing}</Tag>
                    {fiche.statut_scolaire && <Tag>{fiche.statut_scolaire}</Tag>}
                  </Descriptions.Item>
                </Descriptions>
              </Col>
            </Row>

            {renderIndicateurStatut(fiche.deja_remis)}

            {fiche.deja_remis && fiche.remise ? (
              <>
                <Alert
                  type="error"
                  showIcon
                  message="Nouvelle remise impossible"
                  description={`Cet étudiant a déjà reçu ses accessoires pour l'année ${fiche.annee_academique} (reçu ${fiche.remise.numero_recu}, le ${new Date(fiche.remise.date_remise).toLocaleDateString("fr-FR")}).`}
                  style={{ marginBottom: 16 }}
                />
                <Table
                  dataSource={fiche.remise.lignes}
                  rowKey="accessoire_id"
                  size="small"
                  pagination={false}
                  columns={[{ title: "Accessoire déjà remis", dataIndex: "nom" }, { title: "Quantité", dataIndex: "quantite", align: "right" as const }]}
                />
                <div style={{ marginTop: 16, textAlign: "right" }}>
                  <Button type="primary" icon={<PrinterOutlined />} onClick={() => navigate(`/moyens-generaux/recu/${fiche.remise!.id}`)}>
                    Voir / imprimer le reçu
                  </Button>
                </div>
              </>
            ) : (
              <>
                {derniereRemise ? (
                  <>
                    <Alert
                      type="success"
                      showIcon
                      message={`Remise validée — reçu ${derniereRemise.numero_recu}`}
                    />
                    <div style={{ marginTop: 16, textAlign: "right" }}>
                      <Button type="primary" icon={<PrinterOutlined />} onClick={() => navigate(`/moyens-generaux/recu/${derniereRemise.id}`)}>
                        Voir / imprimer le reçu
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                      <Select
                        placeholder="Accessoire"
                        style={{ flex: 1 }}
                        value={ligneAccessoireId}
                        onChange={setLigneAccessoireId}
                        showSearch
                        optionFilterProp="children"
                      >
                        {accessoiresDisponibles.map((a) => (
                          <Option key={a.accessoire_id} value={a.accessoire_id} disabled={a.solde <= 0}>
                            {a.nom} ({a.code}) — {a.solde} disponible{a.solde > 1 ? "s" : ""}
                          </Option>
                        ))}
                      </Select>
                      <InputNumber min={1} placeholder="Quantité" value={ligneQuantite ?? undefined} onChange={setLigneQuantite} style={{ width: 120 }} />
                      <Button icon={<PlusOutlined />} onClick={ajouterLigne}>Ajouter</Button>
                    </div>
                    <Table
                      dataSource={lignes}
                      rowKey="accessoire_id"
                      size="small"
                      pagination={false}
                      locale={{ emptyText: "Aucun accessoire sélectionné" }}
                      columns={[
                        { title: "Accessoire", dataIndex: "nom" },
                        { title: "Quantité", dataIndex: "quantite", align: "right" as const },
                        { title: "", key: "retirer", width: 50, render: (_: any, r) => <Button icon={<DeleteOutlined />} size="small" danger onClick={() => retirerLigne(r.accessoire_id)} /> },
                      ]}
                    />
                    <Space style={{ marginTop: 16 }}>
                      <Button type="primary" size="large" loading={validation} disabled={lignes.length === 0} onClick={validerRemise}>
                        Valider la remise
                      </Button>
                    </Space>
                  </>
                )}
              </>
            )}
          </Card>
        )}
      </PageContainer>
    </div>
  );
};

export default Distribution;
