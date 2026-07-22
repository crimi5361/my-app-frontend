/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Input, Button, List, Avatar, Card, Descriptions, Tag, Alert, Row, Col,
  Divider, Form, message, Spin, Empty, Typography, Space, Radio, Select, Result, Table
} from 'antd';
import { SearchOutlined, CheckCircleOutlined, WarningOutlined, CloseCircleOutlined, PrinterOutlined } from '@ant-design/icons';
import PageHeader from '../../Components/PageHeader/PageHeader';
import { apiFetch, ApiError } from '../../lib/api';
import { calculerApercuEcheancier } from '../../lib/echeancier';

const { Option } = Select;
import AcademicCascadeSelect, { type AcademicSelection } from '../../Components/AcademicCascadeSelect/AcademicCascadeSelect';
import WebcamCapture from '../../Components/WebcamCapture/WebcamCapture';

const { Text, Title } = Typography;

const API_URL = import.meta.env.VITE_API_URL_SERVER || '';

interface EtudiantResultat {
  id: number;
  nom: string;
  prenoms: string;
  matricule_iipea: string;
  photo_url: string | null;
  filiere: string;
  niveau: string;
}

interface TarifInfo {
  montant: number | null;
  statut_applique: string;
  toujours_non_affecte: boolean;
}

interface DossierEtudiant {
  id: number;
  nom: string;
  prenoms: string;
  matricule_iipea: string;
  photo_url: string | null;
  telephone: string;
  email: string;
  lieu_residence: string;
  contact_parent: string;
  contact_parent_2: string;
  adresse_parent_1: string;
  adresse_parent_2: string;
  numero_acte_naissance: string;
  numero_piece_identite: string;
  mention_bac: string;
  session_bac: string;
  statut_scolaire: string;
  niveau_id: number;
  id_filiere: number;
  site_id: number;
}

interface Dossier {
  etudiant: DossierEtudiant;
  hierarchie: { ecole: string; departement: string; filiere: string; niveau: string; site: string };
  situation_financiere: { is_solde: boolean; scolarite_restante: number; montant_total: number; montant_verse: number } | null;
  situation_academique: {
    moyenne_generale: number; credits_valides: number; credits_total: number; decision: string;
    ecue_a_reprendre: { ue_libelle: string; matiere_nom: string; moyenne: number }[];
  } | null;
  situation_academique_erreur: string | null;
  niveau_propose: { id: number; libelle: string; filiere_id: number; tarif: TarifInfo | null } | null;
  niveau_retenu_propose: number;
  tarif_niveau_actuel: TarifInfo | null;
  annee_cible: { id: number; annee: string } | null;
  reinscription_existante: any;
}

interface DemandeResultat {
  reinscription_id: number;
  eligible: boolean;
  statut: string;
  code_paiement: string | null;
  montant_annuel: number | null;
  motif_non_eligibilite: string | null;
}

const IDENTITE_FIELDS = [
  'telephone', 'email', 'lieu_residence', 'contact_parent', 'contact_parent_2',
  'adresse_parent_1', 'adresse_parent_2', 'numero_acte_naissance', 'numero_piece_identite',
  'mention_bac', 'session_bac'
];

type ProgressionMode = 'redoublement' | 'progression' | 'cycle';

const decisionColor = (decision?: string) => {
  if (decision === 'ADMIS') return 'green';
  if (decision === 'DÉROGÉ') return 'orange';
  if (decision === 'AJOURNÉ') return 'red';
  return 'default';
};

const Reinscription = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<EtudiantResultat[]>([]);
  const [searching, setSearching] = useState(false);
  const [dossier, setDossier] = useState<Dossier | null>(null);
  const [loadingDossier, setLoadingDossier] = useState(false);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const [progressionMode, setProgressionMode] = useState<ProgressionMode>('redoublement');
  const [cascadeSelection, setCascadeSelection] = useState<AcademicSelection>({});
  const [montant, setMontant] = useState<number | null>(null);
  const [statutApplique, setStatutApplique] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [nombreVersementsApercu, setNombreVersementsApercu] = useState<number>(1);
  const [demandeResult, setDemandeResult] = useState<DemandeResultat | null>(null);

  const handleSearch = async () => {
    if (query.trim().length < 2) {
      message.warning('Saisissez au moins 2 caractères');
      return;
    }
    setSearching(true);
    setDossier(null);
    try {
      const data = await apiFetch(`/api/reinscription/recherche?q=${encodeURIComponent(query.trim())}`);
      setResults(data.data || []);
      if ((data.data || []).length === 0) message.info('Aucun étudiant trouvé');
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return;
      message.error("Erreur lors de la recherche");
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    if (!dossier) return;
    form.setFieldsValue({
      telephone: dossier.etudiant.telephone,
      email: dossier.etudiant.email,
      lieu_residence: dossier.etudiant.lieu_residence,
      contact_parent: dossier.etudiant.contact_parent,
      contact_parent_2: dossier.etudiant.contact_parent_2,
      adresse_parent_1: dossier.etudiant.adresse_parent_1,
      adresse_parent_2: dossier.etudiant.adresse_parent_2,
      numero_acte_naissance: dossier.etudiant.numero_acte_naissance,
      numero_piece_identite: dossier.etudiant.numero_piece_identite,
      mention_bac: dossier.etudiant.mention_bac,
      session_bac: dossier.etudiant.session_bac,
    });
    setProgressionMode(
      dossier.niveau_propose && dossier.niveau_retenu_propose === dossier.niveau_propose.id
        ? 'progression'
        : 'redoublement'
    );
    setCascadeSelection({});
    setPhotoFile(null);
    setNombreVersementsApercu(1);
  }, [dossier]);

  // Montant/statut affichés selon le mode de progression retenu
  useEffect(() => {
    if (!dossier) return;

    if (progressionMode === 'redoublement') {
      setMontant(dossier.tarif_niveau_actuel?.montant ?? null);
      setStatutApplique(dossier.tarif_niveau_actuel?.statut_applique ?? null);
      return;
    }
    if (progressionMode === 'progression') {
      setMontant(dossier.niveau_propose?.tarif?.montant ?? null);
      setStatutApplique(dossier.niveau_propose?.tarif?.statut_applique ?? null);
      return;
    }

    // Changement de cycle : tarif recalculé dynamiquement pour le niveau choisi via le cascade
    if (!cascadeSelection.niveau_id) {
      setMontant(null);
      setStatutApplique(null);
      return;
    }
    const changement = !!cascadeSelection.filiere_id && cascadeSelection.filiere_id !== dossier.etudiant.id_filiere;
    const statutCible = changement ? 'Non affecté' : dossier.etudiant.statut_scolaire;
    apiFetch<{ success: boolean; data: TarifInfo }>(
      `/api/tarifs/niveau/${cascadeSelection.niveau_id}?statut=${encodeURIComponent(statutCible)}`
    )
      .then(res => {
        setMontant(res.data.montant ?? null);
        setStatutApplique(res.data.statut_applique);
      })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) return;
        setMontant(null);
        setStatutApplique(null);
      });
  }, [dossier, progressionMode, cascadeSelection.niveau_id, cascadeSelection.filiere_id]);

  const loadDossier = async (etudiantId: number) => {
    setResults([]);
    setLoadingDossier(true);
    setDossier(null);
    try {
      const dossierData = await apiFetch(`/api/reinscription/etudiant/${etudiantId}`);
      setDossier(dossierData.data);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return;
      message.error("Erreur lors du chargement du dossier");
    } finally {
      setLoadingDossier(false);
    }
  };

  const niveauRetenuId = (() => {
    if (!dossier) return undefined;
    if (progressionMode === 'redoublement') return dossier.etudiant.niveau_id;
    if (progressionMode === 'progression') return dossier.niveau_propose?.id;
    return cascadeSelection.niveau_id;
  })();

  const changementDeCycle = !!dossier && progressionMode === 'cycle'
    && !!cascadeSelection.filiere_id && cascadeSelection.filiere_id !== dossier.etudiant.id_filiere;

  const handleFinaliser = async (values: any) => {
    if (!dossier) return;
    if (!dossier.annee_cible) {
      message.error("Aucune année académique en cours pour ce site — contactez l'administrateur.");
      return;
    }
    if (!niveauRetenuId) {
      message.error('Veuillez sélectionner le niveau retenu');
      return;
    }
    if (progressionMode === 'cycle' && !cascadeSelection.filiere_id) {
      message.error('Veuillez sélectionner la nouvelle filière');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('niveau_retenu_id', String(niveauRetenuId));
      if (changementDeCycle && cascadeSelection.filiere_id) {
        formData.append('id_filiere', String(cascadeSelection.filiere_id));
      }
      IDENTITE_FIELDS.forEach(field => {
        if (values[field] !== undefined && values[field] !== null) {
          formData.append(field, values[field]);
        }
      });
      if (values.nombre_versements_prevu) {
        formData.append('nombre_versements_prevu', String(values.nombre_versements_prevu));
        formData.append('modalite_paiement', `${values.nombre_versements_prevu} versement(s)`);
      }
      if (photoFile) {
        formData.append('photo', photoFile);
      }

      const result = await apiFetch(`/api/reinscription/etudiant/${dossier.etudiant.id}/finaliser`, {
        method: 'POST',
        body: formData,
      });
      message.success(result.message || 'Demande de réinscription enregistrée');
      setDemandeResult(result.data);
      // Ouverture automatique de la fiche : l'agent ne doit pas avoir à cliquer un bouton
      // supplémentaire pour l'imprimer (le bouton manuel reste en secours si le popup est bloqué).
      if (result.data?.reinscription_id) {
        ouvrirFiche(result.data.reinscription_id);
      }
    } catch (e) {
      if (e instanceof ApiError) {
        message.error(e.message);
        return;
      }
      message.error('Erreur lors de la soumission de la demande');
    } finally {
      setSubmitting(false);
    }
  };

  const ouvrirFiche = (reinscriptionId: number) => {
    const token = localStorage.getItem('token') || '';
    const url = `${API_URL}/api/reinscription/fiche/${reinscriptionId}?token=${encodeURIComponent(token)}`;
    const win = window.open(url, '_blank');
    if (!win) {
      message.error('Le navigateur a bloqué la fenêtre popup. Autorisez les popups pour ce site.');
    }
  };

  const nouvelleReinscription = () => {
    setDemandeResult(null);
    setDossier(null);
    setResults([]);
    setQuery('');
  };

  const financier = dossier?.situation_financiere;
  const academique = dossier?.situation_academique;
  const bloquePourImpaye = financier ? !financier.is_solde : false;

  return (
    <div style={{ padding: 24 }}>
      <PageHeader />

      <Card title="Recherche d'étudiant" style={{ marginBottom: 24 }}>
        <Space.Compact style={{ width: '100%', maxWidth: 500 }}>
          <Input
            placeholder="Nom, prénom ou matricule IIPEA"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onPressEnter={handleSearch}
          />
          <Button type="primary" icon={<SearchOutlined />} loading={searching} onClick={handleSearch}>
            Rechercher
          </Button>
        </Space.Compact>

        {results.length > 0 && (
          <List
            style={{ marginTop: 16 }}
            bordered
            dataSource={results}
            renderItem={item => (
              <List.Item
                style={{ cursor: 'pointer' }}
                onClick={() => loadDossier(item.id)}
                actions={[<Button size="small" type="link">Sélectionner</Button>]}
              >
                <List.Item.Meta
                  avatar={<Avatar src={item.photo_url ? `${API_URL}${item.photo_url}` : undefined}>{item.nom[0]}</Avatar>}
                  title={`${item.nom} ${item.prenoms}`}
                  description={`${item.matricule_iipea} — ${item.filiere} (${item.niveau})`}
                />
              </List.Item>
            )}
          />
        )}
      </Card>

      {loadingDossier && (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin size="large" tip="Chargement du dossier..." />
        </div>
      )}

      {demandeResult && (
        <Card style={{ marginBottom: 24 }}>
          <Result
            status={demandeResult.eligible ? 'success' : 'warning'}
            title={demandeResult.eligible ? 'Demande enregistrée — en attente de paiement' : 'Demande enregistrée — dossier non éligible'}
            subTitle={
              demandeResult.eligible
                ? "L'étudiant doit se présenter à la caisse avec le code de paiement ci-dessous pour finaliser officiellement sa réinscription."
                : demandeResult.motif_non_eligibilite || "Le dossier n'est pas éligible au paiement pour le moment."
            }
          >
            <Descriptions column={1} bordered size="small" style={{ maxWidth: 500, margin: '0 auto 24px auto' }}>
              <Descriptions.Item label="N° de dossier">{demandeResult.reinscription_id}</Descriptions.Item>
              <Descriptions.Item label="Statut">
                <Tag color={demandeResult.eligible ? 'blue' : 'red'}>{demandeResult.statut}</Tag>
              </Descriptions.Item>
              {demandeResult.montant_annuel !== null && (
                <Descriptions.Item label="Montant à payer">{demandeResult.montant_annuel.toLocaleString('fr-FR')} FCFA</Descriptions.Item>
              )}
              {demandeResult.code_paiement && (
                <Descriptions.Item label="Code de paiement">
                  <Text strong style={{ fontSize: 16 }}>{demandeResult.code_paiement}</Text>
                </Descriptions.Item>
              )}
            </Descriptions>
            <Space>
              <Button type="primary" icon={<PrinterOutlined />} onClick={() => ouvrirFiche(demandeResult.reinscription_id)}>
                Imprimer la fiche récapitulative
              </Button>
              <Button onClick={nouvelleReinscription}>Nouvelle réinscription</Button>
            </Space>
          </Result>
        </Card>
      )}

      {!demandeResult && dossier && (
        <>
          <Card title="Dossier étudiant" style={{ marginBottom: 24 }}>
            <Row gutter={24}>
              <Col span={4} style={{ textAlign: 'center' }}>
                <Avatar
                  size={100}
                  src={photoFile ? URL.createObjectURL(photoFile) : (dossier.etudiant.photo_url ? `${API_URL}${dossier.etudiant.photo_url}` : undefined)}
                >
                  {dossier.etudiant.nom[0]}
                </Avatar>
                <div style={{ marginTop: 8 }}>
                  <WebcamCapture
                    buttonLabel={dossier.etudiant.photo_url || photoFile ? 'Remplacer la photo' : 'Prendre une photo'}
                    onCapture={setPhotoFile}
                  />
                </div>
              </Col>
              <Col span={20}>
                <Descriptions column={3} size="small">
                  <Descriptions.Item label="Nom">{dossier.etudiant.nom}</Descriptions.Item>
                  <Descriptions.Item label="Prénoms">{dossier.etudiant.prenoms}</Descriptions.Item>
                  <Descriptions.Item label="Matricule IIPEA">{dossier.etudiant.matricule_iipea}</Descriptions.Item>
                  <Descriptions.Item label="École">{dossier.hierarchie.ecole || 'Non défini'}</Descriptions.Item>
                  <Descriptions.Item label="Département">{dossier.hierarchie.departement || 'Non défini'}</Descriptions.Item>
                  <Descriptions.Item label="Filière">{dossier.hierarchie.filiere}</Descriptions.Item>
                  <Descriptions.Item label="Site">{dossier.hierarchie.site}</Descriptions.Item>
                  <Descriptions.Item label="Niveau actuel">{dossier.hierarchie.niveau}</Descriptions.Item>
                  <Descriptions.Item label="Niveau proposé">
                    {dossier.niveau_propose?.libelle || 'Dernier niveau (pas de progression configurée)'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Statut d'orientation">{dossier.etudiant.statut_scolaire}</Descriptions.Item>
                  <Descriptions.Item label="Année académique cible">
                    {dossier.annee_cible?.annee || 'Aucune année en cours pour ce site'}
                  </Descriptions.Item>
                </Descriptions>
              </Col>
            </Row>
          </Card>

          <Row gutter={24} style={{ marginBottom: 24 }}>
            <Col span={12}>
              <Card title="Situation financière">
                {financier ? (
                  <>
                    {financier.is_solde ? (
                      <Alert type="success" showIcon icon={<CheckCircleOutlined />} message="Scolarité soldée" />
                    ) : (
                      <Alert
                        type="error" showIcon icon={<CloseCircleOutlined />}
                        message="Scolarité non soldée"
                        description={`Reste à payer : ${financier.scolarite_restante.toLocaleString('fr-FR')} FCFA. La réinscription ne pourra pas être finalisée tant que ce montant n'est pas réglé.`}
                        action={
                          <Button size="small" danger onClick={() => navigate(`/Etudiant/Effectuer_Payement/${dossier.etudiant.id}`)}>
                            Effectuer un paiement
                          </Button>
                        }
                      />
                    )}
                    <Descriptions column={1} size="small" style={{ marginTop: 12 }}>
                      <Descriptions.Item label="Montant total">{financier.montant_total.toLocaleString('fr-FR')} FCFA</Descriptions.Item>
                      <Descriptions.Item label="Montant versé">{financier.montant_verse.toLocaleString('fr-FR')} FCFA</Descriptions.Item>
                      <Descriptions.Item label="Reste à payer">{financier.scolarite_restante.toLocaleString('fr-FR')} FCFA</Descriptions.Item>
                    </Descriptions>
                  </>
                ) : (
                  <Empty description="Aucune information financière trouvée" />
                )}
              </Card>
            </Col>
            <Col span={12}>
              <Card title="Situation académique">
                {academique ? (
                  <>
                    <Tag color={decisionColor(academique.decision)} style={{ fontSize: 14, padding: '4px 12px' }}>
                      {academique.decision}
                    </Tag>
                    {academique.decision === 'DÉROGÉ' && (
                      <Alert
                        style={{ marginTop: 8 }}
                        type="warning" showIcon icon={<WarningOutlined />}
                        message="Admis sous dérogation"
                        description="Vous êtes admis en niveau supérieur sous dérogation. Vous devrez reprendre les UE non validées."
                      />
                    )}
                    <Descriptions column={1} size="small" style={{ marginTop: 12 }}>
                      <Descriptions.Item label="Moyenne annuelle">{academique.moyenne_generale?.toFixed(2)}/20</Descriptions.Item>
                      <Descriptions.Item label="Crédits validés">{academique.credits_valides} / {academique.credits_total}</Descriptions.Item>
                    </Descriptions>
                    {academique.ecue_a_reprendre?.length > 0 && (
                      <>
                        <Divider orientation="left" style={{ fontSize: 13 }}>Matières à reprendre</Divider>
                        {academique.ecue_a_reprendre.map((m, i) => (
                          <Tag key={i} color="volcano" style={{ marginBottom: 4 }}>
                            {m.matiere_nom} ({m.moyenne}/20)
                          </Tag>
                        ))}
                      </>
                    )}
                  </>
                ) : (
                  <Empty description={dossier.situation_academique_erreur || "Aucune note trouvée pour cette année"} />
                )}
              </Card>
            </Col>
          </Row>

          <Card title="Finalisation de la réinscription">
            <Form form={form} layout="vertical" onFinish={handleFinaliser}>
              <Divider orientation="left">Niveau retenu</Divider>
              <Radio.Group
                value={progressionMode}
                onChange={e => setProgressionMode(e.target.value)}
                style={{ marginBottom: 16 }}
              >
                <Radio.Button value="redoublement">
                  Redoublement — {dossier.hierarchie.niveau}
                </Radio.Button>
                {dossier.niveau_propose && (
                  <Radio.Button value="progression">
                    Progression — {dossier.niveau_propose.libelle}
                  </Radio.Button>
                )}
                <Radio.Button value="cycle">
                  Changer de filière / cycle
                </Radio.Button>
              </Radio.Group>

              {progressionMode === 'cycle' && (
                <>
                  <AcademicCascadeSelect
                    value={cascadeSelection}
                    onChange={setCascadeSelection}
                    showFiliereNiveau
                  />
                  {changementDeCycle && (
                    <Alert
                      style={{ marginBottom: 16 }}
                      type="info"
                      showIcon
                      message="Changement de cycle détecté"
                      description="Le statut d'orientation de l'étudiant sera automatiquement basculé sur « Non affecté » et le tarif « Non affecté » du nouveau niveau sera appliqué."
                    />
                  )}
                </>
              )}

              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item label="Année académique cible">
                    <Input value={dossier.annee_cible?.annee || 'Aucune année en cours'} disabled />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label="Statut d'orientation appliqué">
                    <Input value={statutApplique || (changementDeCycle ? 'Non affecté' : dossier.etudiant.statut_scolaire)} disabled />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label="Montant annuel (FCFA)">
                    <Input value={montant !== null ? `${montant.toLocaleString('fr-FR')} FCFA` : 'Non déterminé'} disabled style={{ fontWeight: 'bold', color: '#1890ff' }} />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item
                    name="nombre_versements_prevu"
                    label="Nombre de versements prévus"
                    initialValue={1}
                    tooltip="Information indicative — le paiement effectif se fait en caisse, en un ou plusieurs versements."
                  >
                    <Select onChange={setNombreVersementsApercu}>
                      <Option value={1}>1 versement</Option>
                      <Option value={2}>2 versements</Option>
                      <Option value={3}>3 versements</Option>
                      <Option value={4}>4 versements</Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              {nombreVersementsApercu > 1 && montant !== null && (
                <Table
                  size="small"
                  style={{ marginBottom: 16, maxWidth: 500 }}
                  pagination={false}
                  dataSource={calculerApercuEcheancier(montant, nombreVersementsApercu)}
                  rowKey="numero"
                  columns={[
                    { title: 'Versement', dataIndex: 'numero', render: (n) => `Versement ${n}` },
                    { title: 'Montant', dataIndex: 'montant', render: (m) => `${m.toLocaleString('fr-FR')} FCFA` },
                    { title: 'Date indicative', dataIndex: 'date' },
                  ]}
                />
              )}

              <Divider orientation="left">Compléments d'identité</Divider>
              <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
                Champs pré-remplis à partir du dossier existant ; à compléter si absents (anciennes fiches).
              </Text>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="numero_acte_naissance" label="N° acte de naissance"><Input /></Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="numero_piece_identite" label="N° pièce d'identité"><Input /></Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="mention_bac" label="Mention BAC">
                    <Select placeholder="Sélectionnez la mention" allowClear>
                      <Option value="Passable">Passable</Option>
                      <Option value="Assez Bien">Assez Bien</Option>
                      <Option value="Bien">Bien</Option>
                      <Option value="Très Bien">Très Bien</Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="session_bac" label="Session BAC">
                    <Select placeholder="Sélectionnez la session" allowClear>
                      <Option value="Juin">Juin</Option>
                      <Option value="Septembre">Septembre</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="telephone" label="Téléphone"><Input /></Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="email" label="Email"><Input /></Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="lieu_residence" label="Adresse"><Input /></Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="contact_parent" label="Contact parent 1"><Input /></Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="adresse_parent_1" label="Adresse parent 1"><Input /></Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="contact_parent_2" label="Contact parent 2"><Input /></Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="adresse_parent_2" label="Adresse parent 2"><Input /></Form.Item>
                </Col>
              </Row>

              {bloquePourImpaye && (
                <Alert
                  style={{ marginBottom: 16 }}
                  type="warning" showIcon
                  message="Impayé sur la scolarité de l'année en cours : le dossier sera enregistré comme non éligible au paiement tant que ce montant n'est pas réglé."
                />
              )}
              {!dossier.annee_cible && (
                <Alert
                  style={{ marginBottom: 16 }}
                  type="error" showIcon
                  message="Soumission bloquée : aucune année académique en cours pour ce site. Contactez un administrateur."
                />
              )}

              <Form.Item style={{ textAlign: 'center', marginTop: 16 }}>
                <Button
                  type="primary"
                  htmlType="submit"
                  size="large"
                  loading={submitting}
                  disabled={!dossier.annee_cible}
                >
                  Soumettre la demande de réinscription
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </>
      )}

      {!dossier && !loadingDossier && results.length === 0 && (
        <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>
          <Title level={5} type="secondary">Recherchez un étudiant pour commencer une réinscription</Title>
          <Text type="secondary">Par nom, prénom ou matricule IIPEA</Text>
        </div>
      )}
    </div>
  );
};

export default Reinscription;
