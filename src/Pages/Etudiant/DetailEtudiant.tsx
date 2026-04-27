import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Card, 
  Descriptions, 
  Tag, 
  Typography, 
  Image,
  Button,
  Divider,
  Badge,
  Spin,
  message,
  Row,
  Col,
  Statistic,
  Space,
  Table,
  Progress,
  Modal
} from 'antd';
import { 
  ArrowLeftOutlined,
  IdcardOutlined,
  PhoneOutlined,
  HomeOutlined,
  UserOutlined,
  CalendarOutlined,
  FileDoneOutlined,
  DollarOutlined,
  BookOutlined,
  PlusOutlined,
  LockOutlined,
  ExclamationCircleOutlined,
  GiftOutlined,
  InsuranceOutlined,
  EyeOutlined,
  EditOutlined
} from '@ant-design/icons';
import PageHeader from '../../Components/PageHeader/PageHeader';

const { Title, Text } = Typography;

interface Kit {
  id: string | null;
  montant: number;
  deposer: boolean;
  date_enregistrement: string | null;
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
  email: string;
  lieu_residence: string;
  contact_parent: string;
  contact_parent_2: string;
  nom_parent_1: string;
  nom_parent_2: string;
  code_unique: string;
  annee_bac: string;
  serie_bac: string;
  nationalite: string;
  sexe: string;
  matricule_iipea: string;
  filiere: string;
  filiere_sigle: string;
  niveau: string;
  annee_academique: string;
  standing: string;
  statut_scolaire: string;
  date_inscription: string;
  photo_url: string;
  etablissement_origine: string;
  inscrit_par: string;
  extrait_naissance: string;
  justificatif_identite: string;
  dernier_diplome: string;
  fiche_orientation: string;
  montant_scolarite?: number;
  scolarite_verse?: number;
  scolarite_restante?: number;
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
}

const DetailEtudiant = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [etudiant, setEtudiant] = useState<EtudiantDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [modalKitVisible, setModalKitVisible] = useState(false);
  const [modalPECVisible, setModalPECVisible] = useState(false);
  const API_URL = import.meta.env.VITE_API_URL_SERVER || "";

  useEffect(() => {
    const fetchUserData = () => {
      const userData = localStorage.getItem('user');
      if (userData) {
        const user = JSON.parse(userData);
        setUserRole(user.role);
      }
    };

    fetchUserData();
  }, []);

  useEffect(() => {
    const fetchEtudiant = async () => {
      try {
        setLoading(true);
        setError(null);
        
        if (!id) {
          throw new Error("ID de l'étudiant non fourni");
        }

        const token = localStorage.getItem('token');
        
        if (!token) {
          message.error('Session expirée, veuillez vous reconnecter');
          navigate('/login');
          return;
        }

        const response = await fetch(`${API_URL}/api/etudiants/etudiant/${id}`, {
          method: 'GET',
          headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
          }
        });

        if (response.status === 401) {
          localStorage.removeItem('token');
          navigate('/login');
          return;
        }

        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.message || 'Erreur lors de la récupération des données');
        }

        if (!data.success) {
          throw new Error(data.message || 'Étudiant non trouvé');
        }

        setEtudiant(data.data);
      } catch (error) {
         const err = error as Error; 
        console.error('Erreur:', error);
        setError(err.message || 'Erreur de chargement');
        message.error(err.message || 'Erreur de chargement');
      } finally {
        setLoading(false);
      }
    };

    fetchEtudiant();
  }, [id, navigate, API_URL]);

  const handleNewPayment = () => {
    navigate(`/Etudiant/Effectuer_Payement/${id}`);
  };

  const handleManageKit = () => {
    navigate(`/Etudiant/GestionKit/${id}`);
  };

  const handleManagePEC = () => {
    navigate(`/Etudiant/GestionPEC/${id}`);
  };

  const getStatutColor = (statut: string | null) => {
    switch (statut?.toLowerCase()) {
      case 'validé':
      case 'accepté':
      case 'payé':
        return 'green';
      case 'en attente':
      case 'en cours':
        return 'orange';
      case 'refusé':
      case 'rejeté':
        return 'red';
      default:
        return 'default';
    }
  };

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined) return '-';
    return `${amount.toLocaleString()} FCFA`;
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString();
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '50px' }}>
        <Spin size="large" tip="Chargement des données..." />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '24px' }}>
        <PageHeader />
        <Card>
          <Typography.Text type="danger">{error}</Typography.Text>
          <Button 
            type="primary" 
            onClick={() => navigate('/Etudiant')}
            style={{ marginTop: '16px' }}
          >
            Retour à la liste
          </Button>
        </Card>
      </div>
    );
  }

  if (!etudiant) {
    return (
      <div style={{ padding: '24px' }}>
        <PageHeader />
        <Card>
          <Typography.Text type="danger">Aucune donnée disponible pour cet étudiant</Typography.Text>
          <Button 
            type="primary" 
            onClick={() => navigate('/Etudiant')}
            style={{ marginTop: '16px' }}
          >
            Retour à la liste
          </Button>
        </Card>
      </div>
    );
  }

  const montantScolarite = parseFloat(etudiant.montant_scolarite?.toString() || '0');
  const scolariteVerse = parseFloat(etudiant.scolarite_verse?.toString() || '0');
  const scolariteRestante = parseFloat(etudiant.scolarite_restante?.toString() || '0');
  const soldeEntierementPaye = etudiant.scolarite_restante !== null && 
  (scolariteRestante <= 0 || montantScolarite <= scolariteVerse);

  const pourcentagePaiement = montantScolarite > 0 ? (scolariteVerse / montantScolarite) * 100 : 0;

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <PageHeader />
      
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
        <Button 
          type="text" 
          icon={<ArrowLeftOutlined />} 
          onClick={() => navigate(-1)}
        >
          Retour
        </Button>
        
        <Space>
          {(userRole === 'admin' || userRole === 'comptabilite') && !soldeEntierementPaye && (
            <Button 
              type="primary" 
              icon={<PlusOutlined />}
              onClick={handleNewPayment}
            >
              Nouveau Paiement
            </Button>
          )}
          
          {/* {(userRole === 'admin' || userRole === 'comptabilite') && (
            <Button 
              icon={<GiftOutlined />}
              onClick={handleManageKit}
            >
              Gérer Kit
            </Button>
          )}
          
          {(userRole === 'admin' || userRole === 'comptabilite') && (
            <Button 
              icon={<InsuranceOutlined />}
              onClick={handleManagePEC}
            >
              Gérer PEC
            </Button>
          )} */}
        </Space>
      </div>

      <Card
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Title level={3} style={{ margin: 0 }}>
              Fiche Étudiant
            </Title>
            {etudiant.code_unique && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <Text strong style={{ 
                  fontSize: 25, 
                  color: '#1890ff',
                  backgroundColor: '#e6f7ff',
                  padding: '4px 8px',
                  borderRadius: 4
                }}>
                  {etudiant.code_unique}
                </Text>
              </div>
            )}
          </div>
        }
        headStyle={{ borderBottom: 'none' }}
        bodyStyle={{ paddingTop: 0 }}
      >
        {/* Section en-tête avec photo et infos principales */}
        <Row gutter={24} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={8} md={6}>
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center',
              border: '1px solid #f0f0f0',
              borderRadius: 8,
              padding: 16
            }}>
              <Image
                width={160}
                src={etudiant.photo_url ? `${API_URL}${etudiant.photo_url}` : 'https://via.placeholder.com/200'}
                alt={`Photo de ${etudiant.nom} ${etudiant.prenoms}`}
                style={{ 
                  borderRadius: '8px',
                  marginBottom: 16,
                  border: '1px solid #f0f0f0'
                }}
                fallback="https://via.placeholder.com/200"
              />
              <Tag color="purple" style={{ fontSize: 16, padding: '8px 12px' }}>
                {etudiant.matricule_iipea}
              </Tag>
            </div>
          </Col>
          
          <Col xs={24} sm={16} md={18}>
            <Title level={2} style={{ marginBottom: 8 }}>
              {etudiant.nom} {etudiant.prenoms}
            </Title>
            
            <Space size={[16, 16]} wrap style={{ marginBottom: 16 }}>
              <Tag icon={<IdcardOutlined />} color="blue">Matricule Mers : {etudiant.matricule}</Tag>
              <Tag icon={<UserOutlined />} color={etudiant.sexe === 'Masculin' ? 'blue' : 'pink'}>
                Genre : {etudiant.sexe}
              </Tag>
              <Tag icon={<CalendarOutlined />}>
                Date de Naissance : {new Date(etudiant.date_naissance).toLocaleDateString()}
              </Tag>
              <Tag>Nationalité : {etudiant.nationalite}</Tag>
            </Space>
            
            <div style={{ marginBottom: 16 }}>
              <Text strong style={{ display: 'block', marginBottom: 4 }}>Filière</Text>
              <Text>{etudiant.filiere} ({etudiant.filiere_sigle}) - {etudiant.niveau}</Text>
            </div>
            
            <Row gutter={16}>
              <Col xs={24} sm={12} md={8}>
                <Statistic 
                  title="Statut" 
                  value={etudiant.standing} 
                  prefix={
                    <Badge 
                      status={
                        etudiant.standing === 'actif' ? 'success' : 
                        etudiant.standing === 'suspendu' ? 'warning' : 'default'
                      } 
                    />
                  }
                />
              </Col>
              <Col xs={24} sm={12} md={8}>
                <Statistic 
                  title="Statut Scolaire" 
                  value={etudiant.statut_scolaire}
                  prefix={
                    <Badge 
                      status={
                        etudiant.statut_scolaire === 'regular' ? 'success' : 
                        etudiant.statut_scolaire === 'irregular' ? 'warning' : 'default'
                      } 
                    />
                  }
                />
              </Col>
              <Col xs={24} sm={12} md={8}>
                <Statistic 
                  title="Date Inscription" 
                  value={new Date(etudiant.date_inscription).toLocaleDateString()}
                  prefix={<CalendarOutlined />}
                />
              </Col>
            </Row>
          </Col>
        </Row>

        {/* Section Kit et Prise en Charge */}
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12}>
            <Card 
              title={
                <Space>
                  <GiftOutlined />
                  Kit Étudiant
                  {etudiant.kit && (
                    <Button 
                      type="text" 
                      icon={<EyeOutlined />} 
                      size="small"
                      onClick={() => setModalKitVisible(true)}
                    />
                  )}
                </Space>
              }
              size="small"
              extra={
                etudiant.kit && (
                  <Tag color={etudiant.kit.deposer ? 'green' : 'red'}>
                    {etudiant.kit.deposer ? 'Déposé' : 'Non déposé'}
                  </Tag>
                )
              }
            >
              {etudiant.kit ? (
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="Montant">
                    <Text strong>{formatCurrency(etudiant.kit.montant)}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="Statut">
                    <Tag color={etudiant.kit.deposer ? 'green' : 'red'}>
                      {etudiant.kit.deposer ? 'Déposé' : 'Non déposé'}
                    </Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="Date enregistrement">
                    {formatDate(etudiant.kit.date_enregistrement)}
                  </Descriptions.Item>
                </Descriptions>
              ) : (
                <Text type="secondary">Aucun kit enregistré</Text>
              )}
            </Card>
          </Col>

          <Col xs={24} sm={12}>
            <Card 
              title={
                <Space>
                  <InsuranceOutlined />
                  Prise en Charge
                  {etudiant.prise_en_charge && (
                    <Button 
                      type="text" 
                      icon={<EyeOutlined />} 
                      size="small"
                      onClick={() => setModalPECVisible(true)}
                    />
                  )}
                </Space>
              }
              size="small"
              extra={
                etudiant.prise_en_charge && (
                  <Tag color={getStatutColor(etudiant.prise_en_charge.statut)}>
                    {etudiant.prise_en_charge.statut || 'Non défini'}
                  </Tag>
                )
              }
            >
              {etudiant.prise_en_charge ? (
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="Type">
                    {etudiant.prise_en_charge.type || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Réduction">
                    {etudiant.prise_en_charge.pourcentage_reduction ? 
                      `${etudiant.prise_en_charge.pourcentage_reduction}%` : 
                      formatCurrency(etudiant.prise_en_charge.montant_reduction)
                    }
                  </Descriptions.Item>
                  <Descriptions.Item label="Statut">
                    <Tag color={getStatutColor(etudiant.prise_en_charge.statut)}>
                      {etudiant.prise_en_charge.statut || 'Non défini'}
                    </Tag>
                  </Descriptions.Item>
                </Descriptions>
              ) : (
                <Text type="secondary">Aucune prise en charge</Text>
              )}
            </Card>
          </Col>
        </Row>

        {/* Section Informations Personnelles */}
        <Divider orientation="left" style={{ marginTop: 0 }}>
          <FileDoneOutlined /> Informations Personnelles
        </Divider>
        
        <Row gutter={24}>
          <Col xs={24} sm={12}>
            <Card size="small" style={{ marginBottom: 24 }}>
              <Descriptions column={1}>
                <Descriptions.Item label={<Text strong><PhoneOutlined /> Téléphone</Text>}>
                  {etudiant.telephone}
                </Descriptions.Item>
                <Descriptions.Item label={<Text strong><HomeOutlined /> Lieu de Résidence</Text>}>
                  {etudiant.lieu_residence}
                </Descriptions.Item>
                <Descriptions.Item label={<Text strong>Contact Parent 1</Text>}>
                  {etudiant.contact_parent}
                </Descriptions.Item>
                <Descriptions.Item label={<Text strong>Contact Parent 2</Text>}>
                  {etudiant.contact_parent_2 || '-'}
                </Descriptions.Item>
                <Descriptions.Item label={<Text strong>Nom Parent 1</Text>}>
                  {etudiant.nom_parent_1}
                </Descriptions.Item>
                <Descriptions.Item label={<Text strong>Nom Parent 2</Text>}>
                  {etudiant.nom_parent_2 || '-'}
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>
          
          <Col xs={24} sm={12}>
            <Card size="small" style={{ marginBottom: 24 }}>
              <Descriptions column={1}>
                <Descriptions.Item label={<Text strong>Lieu de Naissance</Text>}>
                  {etudiant.lieu_naissance}
                </Descriptions.Item>
                <Descriptions.Item label={<Text strong>Pays de Naissance</Text>}>
                  {etudiant.pays_naissance}
                </Descriptions.Item>
                <Descriptions.Item label={<Text strong>Établissement d'Origine</Text>}>
                  {etudiant.etablissement_origine}
                </Descriptions.Item>
                <Descriptions.Item label={<Text strong>Année Bac</Text>}>
                  {etudiant.annee_bac} - Série {etudiant.serie_bac}
                </Descriptions.Item>
                <Descriptions.Item label={<Text strong>Numéro de Table</Text>}>
                  {etudiant.numero_table || '-'}
                </Descriptions.Item>
                <Descriptions.Item label={<Text strong>Inscrit par</Text>}>
                  {etudiant.inscrit_par}
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>
        </Row>

        {/* Section Académique */}
        <Divider orientation="left">
          <BookOutlined /> Informations Académiques
        </Divider>

        <Table
          dataSource={[etudiant]} 
          columns={[
            {
              title: 'Année Académique',
              dataIndex: 'annee_academique',
              key: 'annee_academique',
            },
            {
              title: 'Filière',
              render: (_, record) => `${record.filiere} (${record.filiere_sigle})`,
              key: 'filiere',
            },
            {
              title: 'Niveau',
              dataIndex: 'niveau',
              key: 'niveau',
            },
            {
              title: 'Classe',
              render: (_, record) => record.groupe?.classe?.nom || 'Non affecté à une classe',
              key: 'classe',
            },
            {
              title: 'Montant Scolarité',
              render: (_, record) => {
                const montant = parseFloat(record.montant_scolarite?.toString() || '0');
                return montant > 0 ? `${montant.toLocaleString()} FCFA` : '-';
              },
              key: 'montant_scolarite',
            },
            {
              title: 'Montant Versé',
              render: (_, record) => {
                const verse = parseFloat(record.scolarite_verse?.toString() || '0');
                return verse > 0 ? `${verse.toLocaleString()} FCFA` : '-';
              },
              key: 'scolarite_verse',
            },
            {
              title: 'Reste à Payer',
              render: (_, record) => {
                const restant = parseFloat(record.scolarite_restante?.toString() || '0');
                return restant > 0 ? `${restant.toLocaleString()} FCFA` : 'Solde réglé';
              },
              key: 'scolarite_restante',
            },
            {
              title: 'Date Inscription',
              render: (_, record) => new Date(record.date_inscription).toLocaleDateString(),
              key: 'date_inscription',
            },
          ]} 
          pagination={false}
          bordered
          size="middle"
          style={{ marginBottom: 24 }}
        />

        {/* Section Scolarité */}
        {(montantScolarite > 0) && (
          <>
            <Divider orientation="left">
              <DollarOutlined /> Informations Financières
            </Divider>
            
            <Row gutter={16} style={{ marginBottom: 24 }}>
              <Col xs={24} sm={8}>
                <Card size="small">
                  <Statistic
                    title="Montant Scolarité"
                    value={montantScolarite}
                    precision={2}
                    prefix="FCFA"
                    valueStyle={{ color: '#1890ff' }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={8}>
                <Card size="small">
                  <Statistic
                    title="Montant Payé"
                    value={scolariteVerse}
                    precision={2}
                    prefix="FCFA"
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={8}>
                <Card size="small">
                  <Statistic
                    title="Reste à Payer"
                    value={scolariteRestante}
                    precision={2}
                    prefix="FCFA"
                    valueStyle={{ color: scolariteRestante > 0 ? '#f5222d' : '#52c41a' }}
                  />
                </Card>
              </Col>
            </Row>

            <Progress
              percent={Math.min(pourcentagePaiement, 100)}
              status={pourcentagePaiement === 100 ? 'success' : 'active'}
              style={{ marginBottom: 24 }}
              format={percent => `${percent}% payé`}
            />
          </>
        )}

        {/* Section Accès Étudiant */}
        <Divider orientation="left">
          <LockOutlined /> Accès Étudiant
        </Divider>

        <Card size="small" style={{ marginBottom: 24 }}>
          <Text style={{ display: 'block', marginBottom: 16 }}>
            Bienvenue à IIPEA, veuillez trouver ci-dessous vos accès étudiant (E-MAIL & Mot de passe), 
            vous donnant accès à l'application MyIIPEA disponible sur PlayStore et AppleStore et sur {' '}
            <a href="https://www.myiipea.com" target="_blank" rel="noopener noreferrer">
              www.myiipea.com
            </a>. Ces accès vous donnent aussi droit aux services professionnels de Google (Gmail, Dashboard, 
            Google Drive illimité et plus).
          </Text>

          <Row gutter={24}>
            <Col xs={24} sm={12}>
              <Card size="small">
                <Descriptions column={1}>
                  <Descriptions.Item label={<Text strong>E-mail</Text>}>
                    <Text copyable>{etudiant.email}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label={<Text strong>Mot de passe</Text>}>
                    <Text copyable>@elites@</Text>
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            </Col>
          </Row>

          <Text type="warning" style={{ display: 'block', marginTop: 16 }}>
            <ExclamationCircleOutlined /> Important : Changez votre mot de passe après votre première connexion.
          </Text>
        </Card>

        {/* Section Documents */}
        <Divider orientation="left">
          <FileDoneOutlined /> Documents
        </Divider>
        
        <Row gutter={16}>
          <Col xs={24} sm={12} md={6}>
            <Card 
              title="Extrait de Naissance" 
              size="small"
              headStyle={{ 
                backgroundColor: etudiant.extrait_naissance === 'oui' ? '#f6ffed' : '#fff2f0',
                borderBottom: 'none'
              }}
            >
              <Tag 
                color={etudiant.extrait_naissance === 'oui' ? 'green' : 'red'}
                style={{ margin: 0 }}
              >
                {etudiant.extrait_naissance === 'oui' ? 'Déposé' : 'Manquant'}
              </Tag>
            </Card>
          </Col>
          
          <Col xs={24} sm={12} md={6}>
            <Card 
              title="Justificatif d'Identité" 
              size="small"
              headStyle={{ 
                backgroundColor: etudiant.justificatif_identite === 'oui' ? '#f6ffed' : '#fff2f0',
                borderBottom: 'none'
              }}
            >
              <Tag 
                color={etudiant.justificatif_identite === 'oui' ? 'green' : 'red'}
                style={{ margin: 0 }}
              >
                {etudiant.justificatif_identite === 'oui' ? 'Déposé' : 'Manquant'}
              </Tag>
            </Card>
          </Col>
          
          <Col xs={24} sm={12} md={6}>
            <Card 
              title="Dernier Diplôme" 
              size="small"
              headStyle={{ 
                backgroundColor: etudiant.dernier_diplome === 'oui' ? '#f6ffed' : '#fff2f0',
                borderBottom: 'none'
              }}
            >
              <Tag 
                color={etudiant.dernier_diplome === 'oui' ? 'green' : 'red'}
                style={{ margin: 0 }}
              >
                {etudiant.dernier_diplome === 'oui' ? 'Déposé' : 'Manquant'}
              </Tag>
            </Card>
          </Col>
          
          <Col xs={24} sm={12} md={6}>
            <Card 
              title="Fiche d'Orientation" 
              size="small"
              headStyle={{ 
                backgroundColor: etudiant.fiche_orientation === 'oui' ? '#f6ffed' : '#fff2f0',
                borderBottom: 'none'
              }}
            >
              <Tag 
                color={etudiant.fiche_orientation === 'oui' ? 'green' : 'red'}
                style={{ margin: 0 }}
              >
                {etudiant.fiche_orientation === 'oui' ? 'Déposé' : 'Manquant'}
              </Tag>
            </Card>
          </Col>
        </Row>
      </Card>

      {/* Modal pour les détails du Kit */}
      <Modal
        title="Détails du Kit Étudiant"
        open={modalKitVisible}
        onCancel={() => setModalKitVisible(false)}
        footer={[
          <Button key="close" onClick={() => setModalKitVisible(false)}>
            Fermer
          </Button>,
          <Button 
            key="edit" 
            type="primary" 
            icon={<EditOutlined />}
            onClick={handleManageKit}
          >
            Modifier
          </Button>
        ]}
      >
        {etudiant.kit && (
          <Descriptions column={1} bordered>
            <Descriptions.Item label="ID">{etudiant.kit.id}</Descriptions.Item>
            <Descriptions.Item label="Montant">{formatCurrency(etudiant.kit.montant)}</Descriptions.Item>
            <Descriptions.Item label="Statut">
              <Tag color={etudiant.kit.deposer ? 'green' : 'red'}>
                {etudiant.kit.deposer ? 'Déposé' : 'Non déposé'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Date d'enregistrement">
              {formatDate(etudiant.kit.date_enregistrement)}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      {/* Modal pour les détails de la Prise en Charge */}
      <Modal
        title="Détails de la Prise en Charge"
        open={modalPECVisible}
        onCancel={() => setModalPECVisible(false)}
        footer={[
          <Button key="close" onClick={() => setModalPECVisible(false)}>
            Fermer
          </Button>,
          <Button 
            key="edit" 
            type="primary" 
            icon={<EditOutlined />}
            onClick={handleManagePEC}
          >
            Modifier
          </Button>
        ]}
        width={600}
      >
        {etudiant.prise_en_charge && (
          <Descriptions column={1} bordered>
            <Descriptions.Item label="Référence">{etudiant.prise_en_charge.reference || '-'}</Descriptions.Item>
            <Descriptions.Item label="Type">{etudiant.prise_en_charge.type || '-'}</Descriptions.Item>
            <Descriptions.Item label="Pourcentage réduction">
              {etudiant.prise_en_charge.pourcentage_reduction ? `${etudiant.prise_en_charge.pourcentage_reduction}%` : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Montant réduction">
              {formatCurrency(etudiant.prise_en_charge.montant_reduction)}
            </Descriptions.Item>
            <Descriptions.Item label="Statut">
              <Tag color={getStatutColor(etudiant.prise_en_charge.statut)}>
                {etudiant.prise_en_charge.statut || 'Non défini'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Date demande">
              {formatDate(etudiant.prise_en_charge.date_demande)}
            </Descriptions.Item>
            <Descriptions.Item label="Date validation">
              {formatDate(etudiant.prise_en_charge.date_validation)}
            </Descriptions.Item>
            <Descriptions.Item label="Validé par">
              {etudiant.prise_en_charge.valide_par || '-'}
            </Descriptions.Item>
            {etudiant.prise_en_charge.motif_refus && (
              <Descriptions.Item label="Motif de refus">
                {etudiant.prise_en_charge.motif_refus}
              </Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default DetailEtudiant;