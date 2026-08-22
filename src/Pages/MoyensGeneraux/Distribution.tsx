/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input, Card, List, Avatar, Row, Col, Descriptions, Tag, Button, Checkbox, Select, Table, message, Empty, Spin, Alert, Space, Typography } from "antd";
import {
  SearchOutlined, UserOutlined, CheckCircleFilled,
  EyeOutlined, RollbackOutlined, PrinterOutlined,
} from "@ant-design/icons";
import PageHeader from "../../Components/PageHeader/PageHeader";
import PageContainer from "../../Components/ui/PageContainer";
import AccesRestreint from "../../Components/ui/AccesRestreint";
import { apiFetch, ApiError } from "../../lib/api";
import { hasPermission } from "../../lib/permissions";

const { Text, Title } = Typography;
const { Option } = Select;

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
  etudiant_id: number;
  annee_academique_id: number;
  agent_nom: string;
  annee_academique: string;
  lignes: LigneRemise[];
}

// Chantier Moyens Généraux, Phase 2C (2026-08-19) : chaque accessoire éligible porte désormais son
// propre état (disponible / déjà distribué / indisponible) — remplace l'ancien "deja_remis"/"remise"
// global (une seule remise possible par étudiant/année, tout ou rien).
interface AccessoireEligible {
  regle_id: number;
  accessoire_id: number;
  accessoire_nom: string;
  code: string;
  categorie_nom: string | null;
  niveau_libelle: string;
  quantite_standard: number;
  stock_disponible: number;
  etat: "disponible" | "deja_distribue" | "indisponible";
  deja_distribue_le: string | null;
  deja_distribue_numero_recu: string | null;
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
  accessoires_eligibles: AccessoireEligible[];
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
  const [etudiantSelectionneId, setEtudiantSelectionneId] = useState<number | null>(null);

  const [remiseConsultee, setRemiseConsultee] = useState<RemiseDetail | null>(null);

  const [selection, setSelection] = useState<Set<number>>(new Set());
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

  const reinitialiser = useCallback(() => {
    setQuery("");
    setEtudiants([]);
    setRemisesTrouvees([]);
    setARecherche(false);
    setFiche(null);
    setEtudiantSelectionneId(null);
    setRemiseConsultee(null);
    setSelection(new Set());
    setDerniereRemise(null);
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

  const chargerFiche = useCallback((etudiantId: number) => {
    if (!selectedYearId) return;
    setLoadingFiche(true);
    setRemiseConsultee(null);
    apiFetch<{ data: FicheEtudiant }>(`/api/moyens-generaux/distribution/etudiant/${etudiantId}?anneeAcademiqueId=${selectedYearId}`)
      .then((res) => {
        setFiche(res.data);
        setEtudiantSelectionneId(etudiantId);
        setSelection(new Set());
      })
      .catch((e) => { if (e instanceof ApiError) { message.error(e.message); return; } message.error("Impossible de charger la fiche étudiant"); })
      .finally(() => setLoadingFiche(false));
  }, [selectedYearId]);

  const consulterRemise = (distributionId: number) => {
    apiFetch<{ data: RemiseDetail }>(`/api/moyens-generaux/distribution/${distributionId}`)
      .then((res) => { setRemiseConsultee(res.data); setFiche(null); })
      .catch(() => message.error("Impossible de charger la remise"));
  };

  const toggleSelection = (accessoireId: number, checked: boolean) => {
    setSelection((prev) => {
      const next = new Set(prev);
      if (checked) next.add(accessoireId); else next.delete(accessoireId);
      return next;
    });
  };

  const validerRemise = async () => {
    if (!fiche || !selectedYearId || selection.size === 0) {
      message.warning("Sélectionnez au moins un accessoire à remettre.");
      return;
    }
    setValidation(true);
    try {
      // Aucune quantité envoyée : la distribution gratuite standard utilise toujours la quantité
      // prévue par la règle applicable — le backend la détermine lui-même, jamais le client
      // (Chantier Moyens Généraux, Phase 2C §9).
      const res = await apiFetch<{ data: RemiseDetail }>("/api/moyens-generaux/distribution", {
        method: "POST",
        body: JSON.stringify({
          etudiant_id: fiche.id,
          annee_academique_id: selectedYearId,
          lignes: [...selection].map((accessoire_id) => ({ accessoire_id })),
        }),
      });
      message.success(`Remise enregistrée — reçu ${res.data.numero_recu}`);
      setDerniereRemise(res.data);
      setSelection(new Set());
      if (etudiantSelectionneId) chargerFiche(etudiantSelectionneId); // rafraîchit les états (déjà distribué / stock)
    } catch (e) {
      if (e instanceof ApiError) { message.error(e.message); return; }
      message.error("Erreur lors de la validation de la remise");
    } finally {
      setValidation(false);
    }
  };

  if (loadingYears) {
    return (
      <div>
        <PageHeader />
        <div style={{ textAlign: "center", padding: 60 }}><Spin size="large" /></div>
      </div>
    );
  }

  // Permission individuelle (Chantier Moyens Généraux, Phase 1) — le backend revalide de toute
  // façon chaque requête ; ce masquage n'est qu'une amélioration d'ergonomie.
  if (!hasPermission("distribution.effectuer")) {
    return (
      <div>
        <PageHeader />
        <AccesRestreint description="Vous n'avez pas la permission d'effectuer une distribution." />
      </div>
    );
  }

  const nbDisponibles = fiche?.accessoires_eligibles.filter((a) => a.etat === "disponible").length ?? 0;
  const nbDejaDistribues = fiche?.accessoires_eligibles.filter((a) => a.etat === "deja_distribue").length ?? 0;
  const nbIndisponibles = fiche?.accessoires_eligibles.filter((a) => a.etat === "indisponible").length ?? 0;

  return (
    <div>
      <PageHeader />
      <PageContainer title="Distribution des accessoires" description="Recherche étudiant, remise pilotée par les règles de niveau — Moyens Généraux">
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
                        onClick={() => chargerFiche(e.id)}
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
              {/* Chantier Moyens Généraux, Phase 2D — diagnostic reçu (2026-08-19) : reçu consolidé,
                  même correction que HistoriqueDistributions.tsx — un seul document, jamais l'ancien
                  reçu par session. */}
              <Button
                type="primary" icon={<PrinterOutlined />}
                onClick={() => navigate(`/moyens-generaux/recu-consolide/${remiseConsultee.etudiant_id}?anneeAcademiqueId=${remiseConsultee.annee_academique_id}`)}
              >
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

            <div
              style={{
                display: "flex", alignItems: "center", gap: 16, padding: "12px 18px", borderRadius: 10,
                background: "var(--bg-soft, #f7f8fa)", border: "1px solid var(--border-soft, #eee)",
                margin: "20px 0",
              }}
            >
              <Text strong>Accessoires à distribuer</Text>
              <Tag color="success">{nbDisponibles} disponible{nbDisponibles > 1 ? "s" : ""}</Tag>
              <Tag color="blue">{nbDejaDistribues} déjà distribué{nbDejaDistribues > 1 ? "s" : ""}</Tag>
              {nbIndisponibles > 0 && <Tag color="warning">{nbIndisponibles} indisponible{nbIndisponibles > 1 ? "s" : ""}</Tag>}
            </div>

            {derniereRemise && (
              <Alert
                type="success"
                showIcon
                message={`Remise validée — reçu ${derniereRemise.numero_recu}`}
                action={
                  <Button
                    size="small" type="primary" icon={<PrinterOutlined />}
                    onClick={() => navigate(`/moyens-generaux/recu-consolide/${fiche?.id}?anneeAcademiqueId=${selectedYearId}`)}
                  >
                    Voir / imprimer le reçu
                  </Button>
                }
                style={{ marginBottom: 16 }}
              />
            )}

            {fiche.accessoires_eligibles.length === 0 ? (
              <Empty description="Aucune règle de distribution active ne couvre le niveau de cet étudiant pour cette année académique." />
            ) : (
              <>
                {fiche.accessoires_eligibles.map((item) => {
                  if (item.etat === "deja_distribue") {
                    return (
                      <div
                        key={item.accessoire_id}
                        style={{
                          display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 8,
                          background: "var(--success-bg, #e7f6ee)", border: "1px solid var(--success, #1e8e5a)", marginBottom: 8,
                        }}
                      >
                        <CheckCircleFilled style={{ color: "var(--success, #1e8e5a)", fontSize: 18, flex: "none" }} />
                        <div>
                          <div style={{ fontWeight: 600 }}>{item.accessoire_nom}</div>
                          <div style={{ fontSize: 12, color: "var(--text-soft)" }}>
                            Déjà distribué le {item.deja_distribue_le ? new Date(item.deja_distribue_le).toLocaleDateString("fr-FR") : ""}
                            {item.deja_distribue_numero_recu ? ` — reçu ${item.deja_distribue_numero_recu}` : ""}
                          </div>
                        </div>
                      </div>
                    );
                  }
                  const indisponible = item.etat === "indisponible";
                  return (
                    <div
                      key={item.accessoire_id}
                      style={{
                        display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 14px", borderRadius: 8,
                        border: "1px solid var(--border-soft, #eee)", opacity: indisponible ? 0.7 : 1, marginBottom: 8,
                      }}
                    >
                      <Checkbox
                        checked={selection.has(item.accessoire_id)}
                        disabled={indisponible}
                        onChange={(e) => toggleSelection(item.accessoire_id, e.target.checked)}
                        style={{ marginTop: 3 }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600 }}>
                          {item.accessoire_nom}
                          {item.categorie_nom && <Tag style={{ marginLeft: 8 }}>{item.categorie_nom}</Tag>}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-soft)" }}>
                          Quantité prévue : {item.quantite_standard} · Stock disponible : {item.stock_disponible}
                        </div>
                        {indisponible && <Tag color="error" style={{ marginTop: 4 }}>Stock insuffisant — indisponible</Tag>}
                      </div>
                    </div>
                  );
                })}

                <Space style={{ marginTop: 16 }}>
                  <Button type="primary" size="large" loading={validation} disabled={selection.size === 0} onClick={validerRemise}>
                    Distribuer les éléments sélectionnés ({selection.size})
                  </Button>
                </Space>
              </>
            )}
          </Card>
        )}
      </PageContainer>
    </div>
  );
};

export default Distribution;
