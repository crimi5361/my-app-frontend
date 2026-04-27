/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Button,
  Spin,
  message,
  Row,
  Col,
  Typography,
  Divider,
  Tag,
  Grid,
  Modal
} from 'antd';
import {
  ArrowLeftOutlined,
  FileDoneOutlined,
  FileTextOutlined,
  TeamOutlined,
  BookOutlined,
  UserOutlined,
  DashboardOutlined,
  InfoCircleOutlined,
  ExclamationCircleOutlined,
  ThunderboltOutlined,
  ExportOutlined
} from '@ant-design/icons';
import PageHeader from '../../Components/PageHeader/PageHeader';

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

interface ApiResponse {
  success: boolean;
  data: GroupeDetail;
}

interface GroupeDetail {
  id: number;
  nom: string;
  capacite_max: number;
  effectif: number;
  taux_remplissage: number;
  classe_nom: string;
}

interface NavigationCard {
  id: number;
  title: string;
  icon: React.ReactNode;
  semestre?: number;
  route: string;
  description: string;
  color: string;
  bgColor: string;
  iconBgColor: string;
  type: 'pv' | 'bulletin';
}

const Resultat: React.FC = () => {
  const [groupe, setGroupe] = useState<GroupeDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [generatingDocument, setGeneratingDocument] = useState<boolean>(false);
  const [selectedSemestre, setSelectedSemestre] = useState<number | null>(null);

  const { id: groupeId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const screens = useBreakpoint();

  const API_URL = import.meta.env.VITE_API_URL_SERVER || "";

  // Charger les données du groupe
  const fetchGroupeData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token') || '';

      const response = await fetch(
        `${API_URL}/api/classes/groupe/${groupeId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }

      const result: ApiResponse = await response.json();
      
      if (result.success && result.data) {
        setGroupe(result.data);
        setError(null);
      } else {
        throw new Error('Données invalides reçues de l\'API');
      }
    } catch (err) {
      setError('Impossible de charger les données du groupe');
      message.error('Erreur lors du chargement des données');
      console.error('Erreur API:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (groupeId) {
      fetchGroupeData();
    } else {
      setError('ID du groupe manquant');
      setLoading(false);
    }
  }, [groupeId]);

  // Cartes de navigation pour les PV et bulletins
  const navigationCards: NavigationCard[] = [
    {
      id: 1,
      title: '📋 PV SEMESTRE 1',
      icon: <FileDoneOutlined />,
      semestre: 1,
      route: '#',
      description: 'Consulter le procès-verbal du premier semestre',
      color: '#1890ff',
      bgColor: 'bg-white',
      iconBgColor: 'bg-blue-50',
      type: 'pv'
    },
    {
      id: 2,
      title: '📋 PV SEMESTRE 2',
      icon: <FileDoneOutlined />,
      semestre: 2,
      route: '#',
      description: 'Consulter le procès-verbal du deuxième semestre',
      color: '#1890ff',
      bgColor: 'bg-white',
      iconBgColor: 'bg-blue-50',
      type: 'pv'
    },
    {
      id: 3,
      title: '📑 BULLETINS S1',
      icon: <FileTextOutlined />,
      semestre: 1,
      route: '#',
      description: 'Générer tous les bulletins individuels du semestre 1',
      color: '#52c41a',
      bgColor: 'bg-white',
      iconBgColor: 'bg-green-50',
      type: 'bulletin'
    },
    {
      id: 4,
      title: '📑 BULLETINS S2',
      icon: <FileTextOutlined />,
      semestre: 2,
      route: '#',
      description: 'Générer tous les bulletins individuels du semestre 2',
      color: '#52c41a',
      bgColor: 'bg-white',
      iconBgColor: 'bg-green-50',
      type: 'bulletin'
    }
  ];

  // Fonction pour générer et ouvrir un document (PV ou bulletins)
  const handleGenerateDocument = async (card: NavigationCard) => {
    try {
      setGeneratingDocument(true);
      setSelectedSemestre(card.semestre || null);
      
      const token = localStorage.getItem('token') || '';
      
      if (!token) {
        throw new Error('Token non trouvé. Veuillez vous reconnecter.');
      }

      // Encoder le token pour l'URL
      const encodedToken = encodeURIComponent(token);
      let documentUrl = '';
      
      if (card.type === 'pv') {
        // Route pour les PV
        documentUrl = `${API_URL}/api/PV/vue/groupe/${groupeId}/semestre/${card.semestre}?token=${encodedToken}`;
      } else {
        // Route pour les bulletins multiples
        documentUrl = `${API_URL}/api/PV/vue/groupe/${groupeId}/bulletins/semestre/${card.semestre}?token=${encodedToken}`;
      }
      
      console.log('Ouverture du document:', documentUrl);
      
      // Ouvrir dans un nouvel onglet
      const newWindow = window.open(documentUrl, '_blank');
      
      if (!newWindow) {
        throw new Error('Le navigateur a bloqué la fenêtre popup. Autorisez les popups pour ce site.');
      }
      
      message.success(`${card.title} ouvert dans un nouvel onglet`);
      
    } catch (err: any) {
      message.error(err.message || 'Erreur lors de la génération du document');
      console.error('Erreur génération:', err);
      
      Modal.error({
        title: 'Erreur de génération',
        content: err.message,
        okText: 'Compris'
      });
    } finally {
      setGeneratingDocument(false);
      setSelectedSemestre(null);
    }
  };

  // Gestionnaire de navigation
  const handleNavigation = (card: NavigationCard) => {
    handleGenerateDocument(card);
  };

  // Retour à la page précédente
  const handleGoBack = () => {
    navigate(-1);
  };

  // Affichage du chargement
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Spin size="large" tip="Chargement des données du groupe..." />
      </div>
    );
  }

  // Affichage des erreurs
  if (error) {
    return (
      <div className="p-6">
        <PageHeader />
        <div className="max-w-full mx-auto px-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-center mb-4">
              <div className="bg-red-100 p-3 rounded-lg mr-4">
                <DashboardOutlined className="text-red-600 text-2xl" />
              </div>
              <div>
                <Title level={4} className="text-red-700 mb-1">Erreur</Title>
                <Text type="danger">{error}</Text>
              </div>
            </div>
            <Button 
              onClick={handleGoBack} 
              icon={<ArrowLeftOutlined />}
              type="primary"
            >
              Retour
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Rendu principal
  return (
    <div className="min-h-screen bg-white">
      <PageHeader />
      
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
        {/* En-tête */}
        <div className="mb-8 pt-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center">
              <Button
                icon={<ArrowLeftOutlined />}
                onClick={handleGoBack}
                className="mr-4"
                size={screens.xs ? "middle" : "large"}
              >
                Retour
              </Button>
              <div>
                <div className="flex items-center">
                  <div className="bg-blue-50 p-2 rounded-lg mr-3">
                    <ThunderboltOutlined className="text-blue-600 text-2xl" />
                  </div>
                  <div>
                    <Title level={2} className="mb-0 text-gray-800">
                      Résultats & Documents
                    </Title>
                    <Text type="secondary" className="text-gray-500 text-sm">
                      Gestion des procès-verbaux et bulletins de notes
                    </Text>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <Divider className="my-2" />
        </div>

        {/* Informations du groupe */}
        <div className="mb-8">
          <div className="flex items-center mb-4">
            <TeamOutlined className="text-blue-600 text-xl mr-3" />
            <Title level={3} className="mb-0 text-gray-800">
              Groupe : {groupe?.nom}
            </Title>
            <Tag color="blue" icon={<BookOutlined />} className="ml-4">
              {groupe?.classe_nom}
            </Tag>
          </div>

          <Card className="border border-gray-100 mb-6 shadow-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-6">
              <div className="border border-gray-100 rounded-lg p-5 hover:border-blue-200 transition-all duration-200 hover:shadow-md">
                <div className="flex items-center mb-3">
                  <div className="bg-blue-50 p-2 rounded-lg mr-3">
                    <TeamOutlined className="text-blue-600 text-xl" />
                  </div>
                  <Text className="text-gray-700 font-semibold text-base">Nom du Groupe</Text>
                </div>
                <div className="pl-12">
                  <Text className="text-gray-800 text-xl font-medium block">
                    {groupe?.nom || 'N/A'}
                  </Text>
                  <Text type="secondary" className="text-sm mt-1 block">
                    Identifiant unique du groupe
                  </Text>
                </div>
              </div>

              <div className="border border-gray-100 rounded-lg p-5 hover:border-green-200 transition-all duration-200 hover:shadow-md">
                <div className="flex items-center mb-3">
                  <div className="bg-green-50 p-2 rounded-lg mr-3">
                    <UserOutlined className="text-green-600 text-xl" />
                  </div>
                  <Text className="text-gray-700 font-semibold text-base">Effectif</Text>
                </div>
                <div className="pl-12">
                  <div className="flex items-baseline">
                    <Text className="text-3xl font-bold text-green-700 mr-2">
                      {groupe?.effectif || 0}
                    </Text>
                    <Text className="text-gray-500 text-lg">
                      / {groupe?.capacite_max || 0}
                    </Text>
                  </div>
                  <Text type="secondary" className="text-sm mt-1 block">
                    Étudiants inscrits / Capacité totale
                  </Text>
                  <div className="mt-2">
                    <Tag color={groupe?.taux_remplissage && groupe.taux_remplissage >= 80 ? 'green' : 'orange'}>
                      Taux de remplissage: {groupe?.taux_remplissage || 0}%
                    </Tag>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Cartes d'accès aux documents */}
        <div className="mb-8">
          <div className="flex items-center mb-2">
            <FileDoneOutlined className="text-gray-700 text-xl mr-3" />
            <Title level={3} className="mb-0 text-gray-800">
              Documents Académiques
            </Title>
          </div>
          <Divider className="my-2" />
          
          <Row gutter={[24, 24]}>
            {navigationCards.map((card) => (
              <Col
                key={card.id}
                xs={24}
                sm={24}
                md={12}
                lg={12}
                xl={12}
              >
                <Card
                  className={`border border-gray-100 rounded-lg hover:border-gray-300 transition-all duration-200 hover:shadow-lg ${card.bgColor}`}
                  bodyStyle={{ padding: '24px' }}
                >
                  <div className="flex flex-col h-full">
                    <div className="flex items-start mb-5">
                      <div 
                        className={`p-3 rounded-lg mr-4 flex-shrink-0 ${card.iconBgColor}`}
                        style={{ 
                          boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                        }}
                      >
                        <div style={{ color: card.color, fontSize: '28px' }}>
                          {card.icon}
                        </div>
                      </div>
                      <div className="flex-1">
                        <Title level={4} className="mb-2 text-gray-800">
                          {card.title}
                          {card.type === 'pv' && (
                            <ExportOutlined 
                              style={{ 
                                marginLeft: '8px', 
                                fontSize: '16px',
                                color: '#888' 
                              }} 
                            />
                          )}
                        </Title>
                        <Text type="secondary" className="block text-sm leading-relaxed">
                          {card.description}
                        </Text>
                        <div className="mt-2">
                          <Tag color={card.type === 'pv' ? 'blue' : 'green'}>
                            {card.type === 'pv' ? 'Procès-Verbal' : 'Bulletins individuels'}
                          </Tag>
                          <Tag color="purple">Semestre {card.semestre}</Tag>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-6">
                      <Button
                        type="primary"
                        onClick={() => handleNavigation(card)}
                        className="w-full font-medium"
                        size="large"
                        loading={generatingDocument && selectedSemestre === card.semestre}
                        disabled={generatingDocument}
                        style={{ 
                          backgroundColor: card.color, 
                          borderColor: card.color,
                          borderRadius: '8px',
                          height: '48px',
                          fontSize: '16px',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                        }}
                        icon={card.type === 'pv' ? <FileDoneOutlined /> : <FileTextOutlined />}
                      >
                        {generatingDocument && selectedSemestre === card.semestre 
                          ? 'Génération en cours...' 
                          : card.type === 'pv' 
                            ? '📄 Générer le PV' 
                            : '📚 Générer les bulletins'}
                      </Button>
                    </div>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        </div>

        {/* Guide d'utilisation */}
        <div className="mb-8">
          <Card className="border border-gray-100 rounded-lg shadow-sm">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div>
                <div className="flex items-center mb-4">
                  <InfoCircleOutlined className="text-blue-600 mr-2 text-lg" />
                  <Title level={5} className="mb-0 text-gray-700">
                    📘 Comment utiliser
                  </Title>
                </div>
                <div className="space-y-4">
                  <div className="flex items-start p-4 bg-blue-50 rounded-lg border border-blue-100 hover:border-blue-200 transition-colors duration-200">
                    <div className="bg-blue-100 p-2 rounded-lg mr-3">
                      <FileDoneOutlined className="text-blue-600 text-lg" />
                    </div>
                    <div>
                      <Text strong className="text-blue-700 block mb-1 text-base">
                        Procès-Verbal (PV)
                      </Text>
                      <Text type="secondary" className="text-sm block">
                        • Cliquez sur "Générer le PV" pour obtenir le procès-verbal complet du semestre<br/>
                        • Le document s'ouvre dans un nouvel onglet<br/>
                        • Utilisez le bouton d'impression (🖨️) pour l'enregistrer en PDF
                      </Text>
                    </div>
                  </div>
                  <div className="flex items-start p-4 bg-green-50 rounded-lg border border-green-100 hover:border-green-200 transition-colors duration-200">
                    <div className="bg-green-100 p-2 rounded-lg mr-3">
                      <FileTextOutlined className="text-green-600 text-lg" />
                    </div>
                    <div>
                      <Text strong className="text-green-700 block mb-1 text-base">
                        Bulletins individuels
                      </Text>
                      <Text type="secondary" className="text-sm block">
                        • Cliquez sur "Générer les bulletins" pour obtenir tous les bulletins du groupe<br/>
                        • Chaque étudiant a sa propre page avec un saut de page automatique<br/>
                        • Idéal pour l'impression en masse
                      </Text>
                    </div>
                  </div>
                </div>
              </div>
              
              <div>
                <div className="flex items-center mb-4">
                  <ExclamationCircleOutlined className="text-orange-600 mr-2 text-lg" />
                  <Title level={5} className="mb-0 text-gray-700">
                    ⚠️ Notes importantes
                  </Title>
                </div>
                <div className="space-y-3">
                  <div className="flex items-start bg-gray-50 p-3 rounded-lg">
                    <div className="w-6 h-6 flex items-center justify-center mr-3">
                      <div className="w-2 h-2 rounded-full bg-blue-600"></div>
                    </div>
                    <Text type="secondary" className="text-sm flex-1">
                      <strong className="text-gray-700">Popups :</strong> Autorisez les popups pour ce site. Les documents s'ouvrent dans de nouveaux onglets.
                    </Text>
                  </div>
                  <div className="flex items-start bg-gray-50 p-3 rounded-lg">
                    <div className="w-6 h-6 flex items-center justify-center mr-3">
                      <div className="w-2 h-2 rounded-full bg-green-600"></div>
                    </div>
                    <Text type="secondary" className="text-sm flex-1">
                      <strong className="text-gray-700">Session :</strong> Votre token est automatiquement inclus. Si vous êtes déconnecté, reconnectez-vous.
                    </Text>
                  </div>
                  <div className="flex items-start bg-gray-50 p-3 rounded-lg">
                    <div className="w-6 h-6 flex items-center justify-center mr-3">
                      <div className="w-2 h-2 rounded-full bg-purple-600"></div>
                    </div>
                    <Text type="secondary" className="text-sm flex-1">
                      <strong className="text-gray-700">Impression :</strong> Les documents sont optimisés pour l'impression. Utilisez "Enregistrer au format PDF".
                    </Text>
                  </div>
                  <div className="flex items-start bg-gray-50 p-3 rounded-lg">
                    <div className="w-6 h-6 flex items-center justify-center mr-3">
                      <div className="w-2 h-2 rounded-full bg-red-600"></div>
                    </div>
                    <Text type="secondary" className="text-sm flex-1">
                      <strong className="text-gray-700">Support :</strong> En cas d'erreur, contactez l'administrateur système.
                    </Text>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Pied de page */}
        <div className="mt-8 pt-6 border-t border-gray-100 text-center">
          <Text type="secondary" className="text-xs">
            Page des résultats • Groupe: {groupe?.nom} • {new Date().toLocaleDateString('fr-FR', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </Text>
        </div>
      </div>
    </div>
  );
};

export default Resultat;