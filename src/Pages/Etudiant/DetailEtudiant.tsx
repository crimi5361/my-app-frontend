/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Descriptions,
  Typography,
  Image,
  Button,
  Divider,
  Spin,
  message,
  Row,
  Col,
  Space,
  Progress,
  Modal,
  Upload,
  Form,
  Input,
  Select,
  DatePicker,
  Table,
} from 'antd';
import DataTable from '../../Components/ui/DataTable';
import StatusTag, { type StatusTone } from '../../Components/ui/StatusTag';
import {
  ArrowLeftOutlined,
  PhoneOutlined,
  HomeOutlined,
  UserOutlined,
  CalendarOutlined,
  FileDoneOutlined,
  DollarOutlined,
  BookOutlined,
  PlusOutlined,
  GiftOutlined,
  InsuranceOutlined,
  EyeOutlined,
  EditOutlined,
  UploadOutlined,
  CameraOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import PageHeader from '../../Components/PageHeader/PageHeader';
import { apiFetch, ApiError } from '../../lib/api';

const { Title, Text } = Typography;
const { Option } = Select;

interface Kit {
  id: string | null;
  montant: number;
  deposer: boolean;
  date_enregistrement: string | null;
}

interface DocumentJustificatif {
  code: string;
  libelle: string;
  obligatoire: boolean;
  fourni: boolean | null;
  fichier_path: string | null;
  storage_provider: string | null;
  date_upload: string | null;
}

interface PriseEnCharge {
  id: string | null;
  reference: string | null;
  type: string | null;
  pourcentage_reduction: number | null;
  montant_reduction: number | null;
  statut: string | null;
  date_demande: string | null;
  date_validation: string | null;
  valide_par: string | null;
  motif_refus: string | null;
}

interface EtudiantDetails {
  numero_table: string;
  id: string;
  matricule: string;
  nom: string;
  prenoms: string;
  date_naissance: string;
  lieu_naissance: string;
  pays_naissance: string;
  telephone: string;
  contact_etudiant: string | null;
  email: string;
  email_personnel: string | null;
  lieu_residence: string;
  contact_parent: string;
  contact_parent_2: string;
  nom_parent_1: string;
  nom_parent_2: string;
  adresse_parent_1: string | null;
  adresse_parent_2: string | null;
  code_unique: string;
  annee_bac: string;
  serie_bac: string;
  nationalite: string;
  sexe: string;
  matricule_iipea: string;
  ip_ministere: string | null;
  filiere: string;
  filiere_sigle: string;
  niveau: string;
  annee_academique: string;
  site: string;
  departement: string | null;
  ecole: string | null;
  cursus: string | null;
  standing: string;
  statut_scolaire: string;
  statut_paiement: string;
  date_inscription: string;
  photo_url: string;
  etablissement_origine: string;
  cree_par: string | null;
  verifie_par: string | null;
  date_verification: string | null;
  compte_actif: boolean;
  montant_scolarite?: number;
  scolarite_verse?: number;
  scolarite_restante?: number;
  nombre_versements_prevu: number | null;
  groupe: {
    id: string | null;
    nom: string | null;
    capacite_max: string | null;
    classe: {
      id: string | null;
      nom: string | null;
      description: string | null;
    };
  };
  kit: Kit | null;
  prise_en_charge: PriseEnCharge | null;
  documents_justificatifs: DocumentJustificatif[];
}

interface AnneePaiement {
  annee_academique_id: number;
  annee: string;
  is_current: boolean;
  niveau?: string;
  filiere?: string;
  filiere_sigle?: string;
  ecole?: string;
  departement?: string;
  cursus?: string;
  classe?: string;
  groupe?: string;
  statut_scolaire?: string;
}

interface LignePaiement {
  id: number;
  montant: number;
  date_paiement: string;
  methode: string;
  numero_recu: string | null;
  recu_id: number | null;
  caissier_nom: string | null;
}

const getStatutTone = (statut: string | null): StatusTone => {
  switch (statut?.toUpperCase()) {
    case 'SOLDE':
    case 'VALIDÉ':
    case 'ACCEPTÉ':
      return 'success';
    case 'EN ATTENTE':
    case 'EN COURS':
      return 'warning';
    case 'NON_SOLDE':
    case 'REFUSÉ':
    case 'REJETÉ':
      return 'danger';
    default:
      return 'neutral';
  }
};

const formatCurrency = (amount: number | null | undefined) => {
  if (amount === null || amount === undefined) return '-';
  return `${amount.toLocaleString('fr-FR')} FCFA`;
};

const formatDate = (date: string | null) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('fr-FR');
};

const DetailEtudiant = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [etudiant, setEtudiant] = useState<EtudiantDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [modalPECVisible, setModalPECVisible] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editForm] = Form.useForm();
  const [pays, setPays] = useState<{ code_iso: string; nom: string; nationalite: string }[]>([]);
  const [villes, setVilles] = useState<{ id: number; nom: string }[]>([]);
  const [anneesFinance, setAnneesFinance] = useState<AnneePaiement[]>([]);
  const [paiementsAnneeCourante, setPaiementsAnneeCourante] = useState<LignePaiement[]>([]);
  const [loadingFinance, setLoadingFinance] = useState(false);
  const API_URL = import.meta.env.VITE_API_URL_SERVER || '';

  const peutEditer = userRole === 'admin' || userRole === 'scolarite';
  const canArchiveDocuments = userRole ? ['admin', 'scolarite', 'archiviste'].includes(userRole) : false;

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) setUserRole(JSON.parse(userData).role);
  }, []);

  const fetchEtudiant = async () => {
    try {
      setLoading(true);
      setError(null);
      if (!id) throw new Error("ID de l'étudiant non fourni");
      const data = await apiFetch(`/api/etudiants/etudiant/${id}`);
      if (!data.success) throw new Error(data.message || 'Étudiant non trouvé');
      setEtudiant(data.data);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
      const e = err as Error;
      setError(e.message || 'Erreur de chargement');
      message.error(e.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEtudiant();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Référentiels pour le formulaire d'édition (mêmes listes que Nouvelle Admission)
  useEffect(() => {
    apiFetch('/api/data/pays').then(d => { if (d.success) setPays(d.data); }).catch(() => {});
    apiFetch('/api/data/villes').then(d => { if (d.success) setVilles(d.data); }).catch(() => {});
  }, []);

  // Historique financier — endpoints déjà existants côté caisse
  useEffect(() => {
    if (!id) return;
    const fetchFinance = async () => {
      try {
        setLoadingFinance(true);
        const hist = await apiFetch(`/api/caisse/etudiant/${id}/annees`);
        if (hist.success) {
          setAnneesFinance(hist.data.annees);
          const courante = hist.data.annees.find((a: AnneePaiement) => a.is_current) || hist.data.annees[0];
          if (courante) {
            const det = await apiFetch(`/api/caisse/etudiant/${id}/annees/${courante.annee_academique_id}/paiements`);
            if (det.success) setPaiementsAnneeCourante(det.data.paiements);
          }
        }
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return;
        // Historique financier non bloquant pour le reste de la fiche
      } finally {
        setLoadingFinance(false);
      }
    };
    fetchFinance();
  }, [id]);

  const handleNewPayment = () => navigate(`/Etudiant/Effectuer_Payement/${id}`);
  const handleManagePEC = () => navigate(`/Etudiant/GestionPEC/${id}`);

  const handleUploadDocument = async (code: string, file: File) => {
    if (!id) return false;
    setUploadingDoc(code);
    try {
      const formData = new FormData();
      formData.append('fichier', file);
      const data = await apiFetch(`/api/etudiants/etudiant/${id}/documents/${code}`, { method: 'POST', body: formData });
      if (!data.success) throw new Error(data.message || 'Erreur lors du dépôt du document');
      message.success('Document archivé avec succès');
      setEtudiant(prev => prev ? {
        ...prev,
        documents_justificatifs: prev.documents_justificatifs.map(doc =>
          doc.code === code
            ? { ...doc, fourni: true, fichier_path: data.data.fichier_path, storage_provider: data.data.storage_provider, date_upload: data.data.date_upload }
            : doc
        )
      } : prev);
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 401)) {
        message.error((err as Error).message || 'Erreur lors du dépôt du document');
      }
    } finally {
      setUploadingDoc(null);
    }
    return false;
  };

  const handleUploadPhoto = async (file: File) => {
    if (!id) return false;
    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append('photo', file);
      const data = await apiFetch(`/api/etudiants/etudiant/${id}/photo`, { method: 'POST', body: formData });
      if (!data.success) throw new Error(data.message || 'Erreur lors du changement de photo');
      message.success('Photo mise à jour');
      setEtudiant(prev => prev ? { ...prev, photo_url: data.data.photo_url } : prev);
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 401)) {
        message.error((err as Error).message || 'Erreur lors du changement de photo');
      }
    } finally {
      setUploadingPhoto(false);
    }
    return false;
  };

  const openEditModal = () => {
    if (!etudiant) return;
    editForm.setFieldsValue({
      ...etudiant,
      date_naissance: etudiant.date_naissance ? dayjs(etudiant.date_naissance) : undefined,
    });
    setEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    if (!id) return;
    try {
      const values = await editForm.validateFields();
      setSavingEdit(true);
      const data = await apiFetch(`/api/etudiants/etudiant/${id}/informations-personnelles`, {
        method: 'PUT',
        body: JSON.stringify({
          ...values,
          date_naissance: values.date_naissance ? values.date_naissance.format('YYYY-MM-DD') : undefined,
        }),
      });
      if (!data.success) throw new Error(data.message || 'Erreur lors de la mise à jour');
      message.success('Informations personnelles mises à jour');
      setEditModalVisible(false);
      fetchEtudiant();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) return;
        message.error(err.message);
      } else if ((err as any)?.errorFields) {
        // erreurs de validation du formulaire — déjà affichées par AntD
      } else {
        message.error('Erreur lors de la mise à jour');
      }
    } finally {
      setSavingEdit(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '50px' }}>
        <Spin size="large" tip="Chargement des données..." />
      </div>
    );
  }

  if (error || !etudiant) {
    return (
      <div style={{ padding: '24px' }}>
        <PageHeader />
        <Card>
          <Typography.Text type="danger">{error || 'Aucune donnée disponible pour cet étudiant'}</Typography.Text>
          <Button type="primary" onClick={() => navigate('/Etudiant')} style={{ marginTop: '16px' }}>
            Retour à la liste
          </Button>
        </Card>
      </div>
    );
  }

  const montantScolarite = parseFloat(etudiant.montant_scolarite?.toString() || '0');
  const scolariteVerse = parseFloat(etudiant.scolarite_verse?.toString() || '0');
  const scolariteRestante = parseFloat(etudiant.scolarite_restante?.toString() || '0');
  const soldeEntierementPaye = scolariteRestante <= 0 || montantScolarite <= scolariteVerse;
  const pourcentagePaiement = montantScolarite > 0 ? (scolariteVerse / montantScolarite) * 100 : 0;

  const colonnesPaiements = [
    { title: 'Date', dataIndex: 'date_paiement', key: 'date', render: formatDate },
    { title: 'Montant', dataIndex: 'montant', key: 'montant', render: (v: number) => formatCurrency(parseFloat(v?.toString() || '0')) },
    { title: 'Méthode', dataIndex: 'methode', key: 'methode' },
    { title: 'Reçu', dataIndex: 'numero_recu', key: 'recu', render: (v: string) => v || '-' },
    { title: 'Caissier', dataIndex: 'caissier_nom', key: 'caissier', render: (v: string) => v || '-' },
    {
      title: '', key: 'action',
      render: () => (
        <Button size="small" icon={<EyeOutlined />} onClick={() => navigate(`/Etudiant/Recu_Payement/${id}`)}>
          Voir le reçu
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <PageHeader />

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
          Retour
        </Button>
        <Space>
          {(userRole === 'admin' || userRole === 'comptabilite') && !soldeEntierementPaye && (
            <Button type="primary" icon={<PlusOutlined />} onClick={handleNewPayment}>
              Nouveau Paiement
            </Button>
          )}
        </Space>
      </div>

      <Card
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Title level={3} style={{ margin: 0 }}>Fiche Étudiant</Title>
            {etudiant.code_unique && (
              <Text strong style={{ fontSize: 25, color: 'var(--mod-scolarite)', backgroundColor: 'var(--paper)', padding: '4px 8px', borderRadius: 4 }}>
                {etudiant.code_unique}
              </Text>
            )}
          </div>
        }
        styles={{ header: { borderBottom: 'none' }, body: { paddingTop: 0 } }}
      >
        {/* ── En-tête : photo + identité + statuts ── */}
        <Row gutter={24} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={8} md={6}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', border: '1px solid #f0f0f0', borderRadius: 8, padding: 16 }}>
              <Image
                width={160}
                src={etudiant.photo_url ? `${API_URL}${etudiant.photo_url}` : 'https://via.placeholder.com/200'}
                alt={`Photo de ${etudiant.nom} ${etudiant.prenoms}`}
                style={{ borderRadius: '8px', marginBottom: 12, border: '1px solid #f0f0f0' }}
                fallback="https://via.placeholder.com/200"
              />
              {peutEditer && (
                <Upload showUploadList={false} accept="image/jpeg,image/jpg,image/png" beforeUpload={handleUploadPhoto}>
                  <Button size="small" icon={<CameraOutlined />} loading={uploadingPhoto}>
                    Changer la photo
                  </Button>
                </Upload>
              )}
              <div style={{ marginTop: 8 }}>
                <StatusTag tone="info" label={etudiant.matricule_iipea} />
              </div>
            </div>
          </Col>

          <Col xs={24} sm={16} md={18}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Title level={2} style={{ marginBottom: 8 }}>{etudiant.nom} {etudiant.prenoms}</Title>
              {peutEditer && (
                <Button icon={<EditOutlined />} onClick={openEditModal}>Modifier</Button>
              )}
            </div>

            <Space size={[16, 16]} wrap style={{ marginBottom: 16 }}>
              <StatusTag tone={getStatutTone(etudiant.standing)} label={`Statut : ${etudiant.standing}`} />
              <StatusTag tone={getStatutTone(etudiant.statut_paiement)} label={`Scolarité : ${etudiant.statut_paiement === 'NON_DEFINI' ? 'Non définie' : etudiant.statut_paiement}`} />
              <StatusTag tone="neutral" icon={<CalendarOutlined />} label={`Inscrit le ${formatDate(etudiant.date_inscription)}`} />
            </Space>

            <Descriptions column={2} size="small">
              <Descriptions.Item label={<Text strong><PhoneOutlined /> Téléphone</Text>}>
                {etudiant.telephone}
                {etudiant.contact_etudiant && etudiant.contact_etudiant !== etudiant.telephone && (
                  <Text type="secondary"> · {etudiant.contact_etudiant}</Text>
                )}
              </Descriptions.Item>
              <Descriptions.Item label={<Text strong>E-mail personnel</Text>}>{etudiant.email_personnel || '-'}</Descriptions.Item>
              <Descriptions.Item label={<Text strong><CalendarOutlined /> Naissance</Text>}>{formatDate(etudiant.date_naissance)} à {etudiant.lieu_naissance}</Descriptions.Item>
              <Descriptions.Item label={<Text strong><UserOutlined /> Genre / Nationalité</Text>}>{etudiant.sexe} · {etudiant.nationalite}</Descriptions.Item>
              <Descriptions.Item label={<Text strong><HomeOutlined /> Ville</Text>}>{etudiant.lieu_residence}</Descriptions.Item>
              <Descriptions.Item label={<Text strong>Matricule MENET</Text>}>{etudiant.matricule}</Descriptions.Item>
              <Descriptions.Item label={<Text strong>Matricule ministère</Text>}>{etudiant.ip_ministere || '-'}</Descriptions.Item>
            </Descriptions>
          </Col>
        </Row>

        {/* ── Parents ── */}
        <Divider orientation="left" style={{ marginTop: 0 }}><UserOutlined /> Parents / Tuteurs</Divider>
        <Row gutter={24} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12}>
            <Card size="small">
              <Descriptions column={1} size="small">
                <Descriptions.Item label="Parent 1">{etudiant.nom_parent_1 || '-'}</Descriptions.Item>
                <Descriptions.Item label="Contact">{etudiant.contact_parent}</Descriptions.Item>
                <Descriptions.Item label="Adresse">{etudiant.adresse_parent_1 || '-'}</Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>
          <Col xs={24} sm={12}>
            <Card size="small">
              <Descriptions column={1} size="small">
                <Descriptions.Item label="Parent 2">{etudiant.nom_parent_2 || '-'}</Descriptions.Item>
                <Descriptions.Item label="Contact">{etudiant.contact_parent_2 || '-'}</Descriptions.Item>
                <Descriptions.Item label="Adresse">{etudiant.adresse_parent_2 || '-'}</Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>
        </Row>

        {/* ── Section Académique (historique complet, même source que l'historique financier) ── */}
        <Divider orientation="left"><BookOutlined /> Informations Académiques</Divider>
        <DataTable
          dataSource={anneesFinance}
          rowKey="annee_academique_id"
          columns={[
            { title: 'Année', dataIndex: 'annee', key: 'annee' },
            { title: 'Statut', render: (_: any, r: AnneePaiement) => <StatusTag tone={r.is_current ? 'success' : 'neutral'} label={r.is_current ? 'Année en cours' : 'Année antérieure'} />, key: 'statut' },
            { title: 'École', render: (_: any, r: AnneePaiement) => r.ecole || '-', key: 'ecole' },
            { title: 'Département', render: (_: any, r: AnneePaiement) => r.departement || '-', key: 'dept' },
            { title: 'Filière', render: (_: any, r: AnneePaiement) => r.filiere ? `${r.filiere} (${r.filiere_sigle})` : '-', key: 'filiere' },
            { title: 'Niveau', dataIndex: 'niveau', key: 'niveau' },
            { title: 'Cursus', render: (_: any, r: AnneePaiement) => r.cursus || '-', key: 'cursus' },
            { title: 'Classe', render: (_: any, r: AnneePaiement) => r.classe || '-', key: 'classe' },
            { title: 'Groupe', render: (_: any, r: AnneePaiement) => r.groupe || '-', key: 'groupe' },
          ]}
          pagination={false}
          style={{ marginBottom: 24 }}
        />

        {/* ── Section Financière ── */}
        <Divider orientation="left"><DollarOutlined /> Informations Financières</Divider>
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={8}>
            <Card size="small">
              <Text type="secondary" style={{ fontSize: 12 }}>Montant Scolarité</Text>
              <Title level={4} style={{ margin: 0, color: 'var(--mod-scolarite)' }}>{formatCurrency(montantScolarite)}</Title>
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card size="small">
              <Text type="secondary" style={{ fontSize: 12 }}>Montant Payé</Text>
              <Title level={4} style={{ margin: 0, color: 'var(--success)' }}>{formatCurrency(scolariteVerse)}</Title>
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card size="small">
              <Text type="secondary" style={{ fontSize: 12 }}>Reste à Payer</Text>
              <Title level={4} style={{ margin: 0, color: scolariteRestante > 0 ? 'var(--danger)' : 'var(--success)' }}>{formatCurrency(scolariteRestante)}</Title>
            </Card>
          </Col>
        </Row>
        {montantScolarite > 0 && (
          <Progress
            percent={Math.min(Math.round(pourcentagePaiement), 100)}
            status={pourcentagePaiement >= 100 ? 'success' : 'active'}
            style={{ marginBottom: etudiant.nombre_versements_prevu ? 4 : 24 }}
          />
        )}
        {etudiant.nombre_versements_prevu != null && (
          <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
            Versements prévus : {etudiant.nombre_versements_prevu}
          </Text>
        )}

        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12}>
            <Card title={<Space><GiftOutlined />Kit Étudiant</Space>} size="small"
              extra={etudiant.kit && <StatusTag tone={etudiant.kit.deposer ? 'success' : 'danger'} label={etudiant.kit.deposer ? 'Déposé' : 'Non déposé'} />}>
              {etudiant.kit ? (
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="Montant"><Text strong>{formatCurrency(etudiant.kit.montant)}</Text></Descriptions.Item>
                  <Descriptions.Item label="Date">{formatDate(etudiant.kit.date_enregistrement)}</Descriptions.Item>
                </Descriptions>
              ) : <Text type="secondary">Aucun kit enregistré</Text>}
            </Card>
          </Col>
          <Col xs={24} sm={12}>
            <Card title={<Space><InsuranceOutlined />Prise en Charge</Space>} size="small"
              extra={etudiant.prise_en_charge && (
                <Space>
                  <StatusTag tone={getStatutTone(etudiant.prise_en_charge.statut)} label={etudiant.prise_en_charge.statut || 'Non défini'} />
                  <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => setModalPECVisible(true)} />
                </Space>
              )}>
              {etudiant.prise_en_charge ? (
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="Type">{etudiant.prise_en_charge.type || '-'}</Descriptions.Item>
                  <Descriptions.Item label="Réduction">
                    {etudiant.prise_en_charge.pourcentage_reduction ? `${etudiant.prise_en_charge.pourcentage_reduction}%` : formatCurrency(etudiant.prise_en_charge.montant_reduction)}
                  </Descriptions.Item>
                </Descriptions>
              ) : <Text type="secondary">Aucune prise en charge</Text>}
            </Card>
          </Col>
        </Row>

        <Title level={5}>Historique des paiements {anneesFinance.length > 0 && `— ${anneesFinance.find(a => a.is_current)?.annee || ''}`}</Title>
        <Table
          size="small"
          loading={loadingFinance}
          columns={colonnesPaiements}
          dataSource={paiementsAnneeCourante}
          rowKey="id"
          pagination={false}
          locale={{ emptyText: 'Aucun paiement enregistré pour cette année' }}
          style={{ marginBottom: 24 }}
        />

        {/* ── Section Accès Étudiant ── */}
        <Divider orientation="left"><UserOutlined /> Accès Étudiant</Divider>
        <Card size="small" style={{ marginBottom: 24 }}>
          <Descriptions column={2} size="small">
            <Descriptions.Item label="E-mail"><Text copyable>{etudiant.email}</Text></Descriptions.Item>
            <Descriptions.Item label="Mot de passe"><Text copyable>@elites@</Text></Descriptions.Item>
          </Descriptions>
        </Card>

        {/* ── Section Pièces justificatives ── */}
        <Divider orientation="left"><FileDoneOutlined /> Pièces justificatives</Divider>
        <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
          Statut « Vérifié » = pièce présentée et vérifiée à l'inscription. Le fichier numérisé est archivé séparément par l'archiviste.
        </Text>
        <Row gutter={[16, 16]}>
          {(etudiant.documents_justificatifs || []).map(doc => (
            <Col xs={24} sm={12} md={6} key={doc.code}>
              <Card title={doc.libelle} size="small" styles={{ header: { backgroundColor: doc.fourni ? 'var(--paper)' : '#fff2f0', borderBottom: 'none' } }}>
                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                  <StatusTag tone={doc.fourni ? 'success' : 'danger'} label={doc.fourni ? "Vérifié à l'inscription" : 'Non fourni'} />
                  {doc.fichier_path ? (
                    <a href={doc.fichier_path.startsWith('http') ? doc.fichier_path : `${API_URL}${doc.fichier_path}`} target="_blank" rel="noopener noreferrer">
                      <EyeOutlined /> Voir le fichier archivé{doc.storage_provider === 'drive' ? ' (Drive)' : ''}
                    </a>
                  ) : <Text type="secondary" style={{ fontSize: 12 }}>Aucun scan archivé</Text>}
                  {canArchiveDocuments && (
                    <Upload showUploadList={false} accept="image/*,.pdf" beforeUpload={(file) => handleUploadDocument(doc.code, file)}>
                      <Button size="small" icon={<UploadOutlined />} loading={uploadingDoc === doc.code}>
                        {doc.fichier_path ? 'Remplacer' : 'Archiver'}
                      </Button>
                    </Upload>
                  )}
                </Space>
              </Card>
            </Col>
          ))}
        </Row>

        {/* ── Section Informations système ── */}
        <Divider orientation="left"><InfoCircleOutlined /> Informations système</Divider>
        <Card size="small">
          <Descriptions column={2} size="small">
            <Descriptions.Item label="Créé par">{etudiant.cree_par || '-'}</Descriptions.Item>
            <Descriptions.Item label="Vérifié par">{etudiant.verifie_par || '-'}</Descriptions.Item>
            <Descriptions.Item label="Date de vérification">{formatDate(etudiant.date_verification)}</Descriptions.Item>
            <Descriptions.Item label="Compte MyIIPEA">
              <StatusTag tone={etudiant.compte_actif ? 'success' : 'danger'} label={etudiant.compte_actif ? 'Actif' : 'Inactif'} />
            </Descriptions.Item>
          </Descriptions>
        </Card>
      </Card>

      {/* ── Modal Prise en charge ── */}
      <Modal
        title="Détails de la Prise en Charge"
        open={modalPECVisible}
        onCancel={() => setModalPECVisible(false)}
        footer={[
          <Button key="close" onClick={() => setModalPECVisible(false)}>Fermer</Button>,
          <Button key="edit" type="primary" icon={<EditOutlined />} onClick={handleManagePEC}>Modifier</Button>,
        ]}
        width={600}
      >
        {etudiant.prise_en_charge && (
          <Descriptions column={1} bordered>
            <Descriptions.Item label="Référence">{etudiant.prise_en_charge.reference || '-'}</Descriptions.Item>
            <Descriptions.Item label="Type">{etudiant.prise_en_charge.type || '-'}</Descriptions.Item>
            <Descriptions.Item label="Pourcentage réduction">{etudiant.prise_en_charge.pourcentage_reduction ? `${etudiant.prise_en_charge.pourcentage_reduction}%` : '-'}</Descriptions.Item>
            <Descriptions.Item label="Montant réduction">{formatCurrency(etudiant.prise_en_charge.montant_reduction)}</Descriptions.Item>
            <Descriptions.Item label="Statut"><StatusTag tone={getStatutTone(etudiant.prise_en_charge.statut)} label={etudiant.prise_en_charge.statut || 'Non défini'} /></Descriptions.Item>
            <Descriptions.Item label="Date demande">{formatDate(etudiant.prise_en_charge.date_demande)}</Descriptions.Item>
            <Descriptions.Item label="Date validation">{formatDate(etudiant.prise_en_charge.date_validation)}</Descriptions.Item>
            {etudiant.prise_en_charge.motif_refus && <Descriptions.Item label="Motif de refus">{etudiant.prise_en_charge.motif_refus}</Descriptions.Item>}
          </Descriptions>
        )}
      </Modal>

      {/* ── Modal Édition informations personnelles ── */}
      <Modal
        title="Modifier les informations personnelles"
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        onOk={handleSaveEdit}
        confirmLoading={savingEdit}
        okText="Enregistrer"
        cancelText="Annuler"
        width={800}
        destroyOnHidden
      >
        <Form form={editForm} layout="vertical">
          <Text strong style={{ display: 'block', marginBottom: 12 }}>État civil</Text>
          <Row gutter={16}>
            <Col span={8}><Form.Item name="nom" label="Nom" rules={[{ required: true, message: 'Requis' }]}><Input /></Form.Item></Col>
            <Col span={8}><Form.Item name="prenoms" label="Prénoms" rules={[{ required: true, message: 'Requis' }]}><Input /></Form.Item></Col>
            <Col span={8}><Form.Item name="sexe" label="Sexe" rules={[{ required: true, message: 'Requis' }]}>
              <Select><Option value="Masculin">Masculin</Option><Option value="Féminin">Féminin</Option></Select>
            </Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}><Form.Item name="date_naissance" label="Date de naissance" rules={[{ required: true, message: 'Requis' }]}>
              <DatePicker style={{ width: '100%' }} disabledDate={c => c && c > dayjs().endOf('day')} />
            </Form.Item></Col>
            <Col span={8}><Form.Item name="lieu_naissance" label="Lieu de naissance"><Input /></Form.Item></Col>
            <Col span={8}><Form.Item name="pays_naissance" label="Pays de naissance">
              <Select showSearch optionFilterProp="children">
                {pays.map(p => <Option key={p.code_iso} value={p.code_iso}>{p.nom}</Option>)}
              </Select>
            </Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}><Form.Item name="nationalite" label="Nationalité" rules={[{ required: true, message: 'Requis' }]}>
              <Select showSearch optionFilterProp="children">
                {pays.map(p => <Option key={`nat-${p.code_iso}`} value={p.code_iso}>{p.nom} ({p.nationalite})</Option>)}
              </Select>
            </Form.Item></Col>
            <Col span={8}><Form.Item name="lieu_residence" label="Lieu de résidence">
              <Select showSearch optionFilterProp="children">
                {villes.map(v => <Option key={v.id} value={v.nom}>{v.nom}</Option>)}
              </Select>
            </Form.Item></Col>
          </Row>

          <Text strong style={{ display: 'block', margin: '16px 0 12px' }}>Contacts</Text>
          <Row gutter={16}>
            <Col span={8}><Form.Item name="telephone" label="Téléphone" rules={[{ pattern: /^[0-9]{10,15}$/, message: 'Numéro invalide' }]}><Input /></Form.Item></Col>
            <Col span={8}><Form.Item name="email_personnel" label="E-mail personnel" rules={[{ type: 'email', message: 'E-mail invalide' }]}><Input /></Form.Item></Col>
            <Col span={8}><Form.Item name="contact_parent" label="Contact parent 1" rules={[{ pattern: /^[0-9]{10,15}$/, message: 'Numéro invalide' }]}><Input /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}><Form.Item name="contact_parent_2" label="Contact parent 2" rules={[{ pattern: /^[0-9]{10,15}$/, message: 'Numéro invalide' }]}><Input /></Form.Item></Col>
          </Row>

          <Text strong style={{ display: 'block', margin: '16px 0 12px' }}>Parents / Tuteurs</Text>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="nom_parent_1" label="Nom parent 1 (Père)"><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="adresse_parent_1" label="Adresse parent 1"><Input /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="nom_parent_2" label="Nom parent 2 (Mère)"><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="adresse_parent_2" label="Adresse parent 2"><Input /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
};

export default DetailEtudiant;
