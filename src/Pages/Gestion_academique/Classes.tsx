/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Card, 
  Table, 
  Typography, 
  Row, 
  Col, 
  Statistic,
  Select,
  Button,
  Tag,
  Spin,
  message,
  Badge,
  Input,
  Alert
} from 'antd';
import { 
  TeamOutlined, 
  EyeOutlined,
  CalendarOutlined,
  ApartmentOutlined,
  SearchOutlined,
  DownloadOutlined,
  FileExcelOutlined
} from '@ant-design/icons';
import PageHeader from '../../Components/PageHeader/PageHeader';
import * as XLSX from 'xlsx';

const { Title, Text } = Typography;
const { Option } = Select;
const { Search } = Input;

interface Classe {
  id: number;
  nom: string;
  description: string;
  annee_academique: string;
  annee_etat: string;
  effectif_total: number;
  nombre_groupes: number;
  filiere: string;
  niveau: string;
}

interface AnneeAcademique {
  id: number;
  annee: string;
  etat: string;
}

interface UserInfo {
  id: number;
  nom: string;
  email: string;
  role: string;
  code: string;
  userType: string;
  departementName: string;
  departement_id: number;
}

const getUserInfo = (): UserInfo | null => {
  try {
    const userStr = localStorage.getItem('user');
    if (!userStr) return null;
    const user = JSON.parse(userStr);
    if (!user.departement_id) {
      const deptId = localStorage.getItem('departement_id');
      if (deptId) user.departement_id = parseInt(deptId, 10);
    }
    return user;
  } catch (e) {
    console.error('Erreur parsing user:', e);
    return null;
  }
};

const Classes = () => {
  const [classes, setClasses] = useState<Classe[]>([]);
  const [filteredClasses, setFilteredClasses] = useState<Classe[]>([]);
  const [annees, setAnnees] = useState<AnneeAcademique[]>([]);
  const [selectedAnnee, setSelectedAnnee] = useState<number | null>(null);
  const [selectedAnneeInfo, setSelectedAnneeInfo] = useState<{annee: string; etat: string} | null>(null);
  const [currentUser, setCurrentUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingYears, setLoadingYears] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [initialYearSet, setInitialYearSet] = useState(false);
  const navigate = useNavigate();
  const API_URL = import.meta.env.VITE_API_URL_SERVER || "";

  // Chargement utilisateur
  useEffect(() => {
    const user = getUserInfo();
    if (!user) {
      message.error('Impossible de récupérer vos informations. Veuillez vous reconnecter.');
      setLoading(false);
      return;
    }
    if (!user.departement_id) {
      message.error("Aucun département associé à votre compte.");
      setLoading(false);
      return;
    }
    setCurrentUser(user);
  }, []);

  // Récupérer les années académiques par département
  useEffect(() => {
    const fetchAnneesAcademiques = async () => {
      if (!currentUser?.departement_id) return;
      
      setLoadingYears(true);
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          message.error('Authentification requise');
          setLoading(false);
          return;
        }

        const response = await fetch(`${API_URL}/api/annees?site_id=${currentUser.departement_id}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.status === 401) {
          message.error('Session expirée, veuillez vous reconnecter');
          localStorage.removeItem('token');
          navigate('/login');
          return;
        }

        if (!response.ok) {
          throw new Error(`Erreur ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        if (Array.isArray(data)) {
          setAnnees(data);
          // Sélectionner l'année "en cours" par défaut
          const currentYear = data.find((year: AnneeAcademique) => 
            year.etat?.toLowerCase() === 'en cours' || 
            year.etat?.toLowerCase() === 'en cour' ||
            year.etat?.toLowerCase() === 'active'
          );
          if (currentYear) {
            setSelectedAnnee(currentYear.id);
            setSelectedAnneeInfo({ annee: currentYear.annee, etat: currentYear.etat });
          } else if (data.length > 0) {
            setSelectedAnnee(data[0].id);
            setSelectedAnneeInfo({ annee: data[0].annee, etat: data[0].etat });
          }
          setInitialYearSet(true);
        } else {
          throw new Error('Format de réponse inattendu');
        }
      } catch (error) {
        console.error('Erreur récupération années académiques:', error);
        message.error('Erreur lors du chargement des années académiques');
      } finally {
        setLoadingYears(false);
      }
    };

    fetchAnneesAcademiques();
  }, [API_URL, currentUser, navigate]);

  // Charger les classes quand l'année change
  useEffect(() => {
    if (initialYearSet && selectedAnnee && currentUser?.departement_id) {
      fetchClasses(selectedAnnee);
    }
  }, [selectedAnnee, initialYearSet, currentUser]);

  useEffect(() => {
    filterClasses();
  }, [searchText, classes]);

  const fetchClasses = async (anneeId: number) => {
    if (!currentUser?.departement_id) return;
    
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        message.error('Authentification requise');
        return;
      }
      
      const response = await fetch(
        `${API_URL}/api/classes/classes/liste?annee_id=${anneeId}&departement_id=${currentUser.departement_id}`, 
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.status === 401) {
        message.error('Session expirée, veuillez vous reconnecter');
        localStorage.removeItem('token');
        navigate('/login');
        return;
      }

      const data = await response.json();
      
      if (data.success) {
        setClasses(data.data);
        setFilteredClasses(data.data);
      } else {
        message.error(data.message || 'Erreur lors du chargement des classes');
        setClasses([]);
        setFilteredClasses([]);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des classes:', error);
      message.error('Erreur lors du chargement des classes');
      setClasses([]);
      setFilteredClasses([]);
    } finally {
      setLoading(false);
    }
  };

  const filterClasses = () => {
    if (!searchText) {
      setFilteredClasses(classes);
      return;
    }

    const filtered = classes.filter(classe => 
      classe.nom?.toLowerCase().includes(searchText.toLowerCase()) ||
      classe.description?.toLowerCase().includes(searchText.toLowerCase()) ||
      (classe.filiere && classe.filiere.toLowerCase().includes(searchText.toLowerCase())) ||
      (classe.niveau && classe.niveau.toLowerCase().includes(searchText.toLowerCase()))
    );
    
    setFilteredClasses(filtered);
  };

  const handleSearch = (value: string) => {
    setSearchText(value);
  };

  const handleVoirClasse = (classeId: number) => {
    navigate(`/Gestion_academique/DetailClasse/${classeId}`);
  };

  // Fonction pour exporter en Excel
  const exportToExcel = () => {
    if (filteredClasses.length === 0) {
      message.warning('Aucune donnée à exporter');
      return;
    }

    try {
      // Préparer les données pour l'export
      const exportData = filteredClasses.map(classe => ({
        'Classe (Nom de la classe)': classe.nom,
        'Description': classe.description,
        'Filière': classe.filiere || '-',
        'Niveau': classe.niveau || '-',
        'Année Académique': classe.annee_academique,
        'Statut Année': classe.annee_etat,
        'Effectif Total': classe.effectif_total,
        'Nombre de Groupes': classe.nombre_groupes
      }));

      // Créer la feuille de calcul
      const ws = XLSX.utils.json_to_sheet(exportData);
      
      // Définir les largeurs de colonnes
      ws['!cols'] = [
        { wch: 40 },  // Classe
        { wch: 50 },  // Description
        { wch: 30 },  // Filière
        { wch: 15 },  // Niveau
        { wch: 25 },  // Année Académique
        { wch: 15 },  // Statut Année
        { wch: 15 },  // Effectif Total
        { wch: 18 }   // Nombre de Groupes
      ];
      
      // Créer le classeur
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Liste des Classes');
      
      // Générer le nom du fichier
      const date = new Date().toISOString().split('T')[0];
      const deptName = currentUser?.departementName?.replace(/\s/g, '_') || 'departement';
      const annee = selectedAnneeInfo?.annee?.replace(/\//g, '-') || 'annee';
      const fileName = `classes_${deptName}_${annee}_${date}.xlsx`;
      
      // Générer le fichier Excel
      XLSX.writeFile(wb, fileName);
      
      message.success('Export Excel réalisé avec succès !');
    } catch (error) {
      console.error('Erreur lors de l\'export:', error);
      message.error('Erreur lors de l\'export Excel');
    }
  };

  const columns = [
    {
      title: 'Classe',
      dataIndex: 'nom',
      key: 'nom',
      render: (text: string, record: Classe) => (
        <div>
          <Text strong style={{ fontSize: '16px' }}>{text}</Text>
          <br />
          <Text type="secondary">{record.description}</Text>
          <br />
          <div>
            {record.filiere && <Tag color="blue">{record.filiere}</Tag>}
            {record.niveau && <Tag color="green">{record.niveau}</Tag>}
          </div>
        </div>
      ),
    },
    {
      title: 'Année Académique',
      key: 'annee',
      render: (record: Classe) => (
        <Tag icon={<CalendarOutlined />} color={record.annee_etat === 'active' || record.annee_etat === 'en cours' || record.annee_etat === 'en cour' ? 'green' : 'blue'}>
          {record.annee_academique} 
          {(record.annee_etat === 'active' || record.annee_etat === 'en cours' || record.annee_etat === 'en cour') && ' (En cours)'}
        </Tag>
      ),
      align: 'center' as const,
    },
    {
      title: 'Effectif Total',
      dataIndex: 'effectif_total',
      key: 'effectif_total',
      render: (effectif: number) => (
        <Statistic
          value={effectif}
          prefix={<TeamOutlined />}
          valueStyle={{ color: '#1890ff', fontSize: '16px' }}
        />
      ),
      align: 'center' as const,
    },
    {
      title: 'Nombre de Groupes',
      dataIndex: 'nombre_groupes',
      key: 'nombre_groupes',
      render: (nombre: number) => (
        <Badge 
          count={nombre} 
          showZero 
          style={{ backgroundColor: nombre > 0 ? '#52c41a' : '#ccc' }}
        />
      ),
      align: 'center' as const,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (record: Classe) => (
        <Button 
          type="primary" 
          icon={<EyeOutlined />}
          onClick={() => handleVoirClasse(record.id)}
        >
          Voir détails
        </Button>
      ),
      align: 'center' as const,
    },
  ];

  // // Statistiques
  // const totalEffectif = filteredClasses.reduce((sum, classe) => sum + (classe.effectif_total || 0), 0);
  // const totalGroupes = filteredClasses.reduce((sum, classe) => sum + (classe.nombre_groupes || 0), 0);

  // Guards
  if (!currentUser) {
    return (
      <div>
        <PageHeader />
        <div style={{ padding: '24px' }}>
          <Alert
            message="Accès non autorisé"
            description="Impossible de récupérer vos informations utilisateur. Veuillez vous reconnecter."
            type="error" 
            showIcon
          />
        </div>
      </div>
    );
  }

  if (!currentUser.departement_id) {
    return (
      <div>
        <PageHeader />
        <div style={{ padding: '24px' }}>
          <Alert
            message="Département non assigné"
            description="Votre compte n'est associé à aucun département. Veuillez contacter l'administrateur."
            type="warning" 
            showIcon
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader />
      
      <div style={{ padding: '24px' }}>
        <Alert
          message={`Classes — ${currentUser.departementName || 'Département ' + currentUser.departement_id}`}
          description={`Vous visualisez uniquement les classes du département ${currentUser.departementName || ''}.`}
          type="info" 
          showIcon 
          style={{ marginBottom: 16 }} 
          closable
        />

        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <Title level={2} style={{ margin: 0 }}>
              <ApartmentOutlined /> LISTE DES CLASSES
            </Title>
            
            {/* Bouton d'export Excel */}
            <Button 
              type="primary" 
              icon={<FileExcelOutlined />}
              onClick={exportToExcel}
              size="large"
              style={{ 
                backgroundColor: '#52c41a', 
                borderColor: '#52c41a',
                fontWeight: 'bold'
              }}
              disabled={filteredClasses.length === 0}
            >
              <DownloadOutlined /> Exporter Excel
            </Button>
          </div>

          {/* Filtres */}
          <Row gutter={16} style={{ marginBottom: '24px' }}>
            <Col xs={24} md={8}>
              <div style={{ marginBottom: '8px' }}>
                <Text strong>Année Académique:</Text>
              </div>
              <Select
                value={selectedAnnee}
                onChange={(value: number) => {
                  const selectedYear = annees.find(y => y.id === value);
                  if (selectedYear) {
                    setSelectedAnneeInfo({ annee: selectedYear.annee, etat: selectedYear.etat });
                  }
                  setSelectedAnnee(value);
                }}
                style={{ width: '100%' }}
                loading={loadingYears}
                placeholder="Sélectionner une année"
              >
                {annees.map(annee => (
                  <Option key={annee.id} value={annee.id}>
                    {annee.annee} ({annee.etat})
                  </Option>
                ))}
              </Select>
              {selectedAnneeInfo && (
                <div style={{ marginTop: 8 }}>
                  <Tag color={selectedAnneeInfo.etat === 'en cours' || selectedAnneeInfo.etat === 'en cour' || selectedAnneeInfo.etat === 'active' ? 'green' : 'blue'}>
                    Année sélectionnée: {selectedAnneeInfo.annee}
                  </Tag>
                </div>
              )}
            </Col>
            
            <Col xs={24} md={8}>
              <div style={{ marginBottom: '8px' }}>
                <Text strong>Rechercher une classe:</Text>
              </div>
              <Search
                placeholder="Rechercher par nom, description, filière..."
                allowClear
                enterButton={<SearchOutlined />}
                size="middle"
                onSearch={handleSearch}
                onChange={(e) => handleSearch(e.target.value)}
              />
            </Col>

            {/* <Col xs={24} md={8}>
              <div style={{ marginBottom: '8px' }}>
                <Text strong>Statistiques:</Text>
              </div>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                <Text strong>Classes: {filteredClasses.length}</Text>
                <Text strong>Effectif total: {totalEffectif}</Text>
                <Text strong>Groupes: {totalGroupes}</Text>
              </div>
            </Col> */}
          </Row>

          {!selectedAnnee ? (
            <Alert
              message="Aucune année sélectionnée"
              description="Veuillez sélectionner une année académique pour afficher les classes."
              type="warning"
              showIcon
            />
          ) : loading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <Spin size="large" />
              <div style={{ marginTop: '16px' }}>Chargement des classes...</div>
            </div>
          ) : filteredClasses.length === 0 ? (
            <Alert
              message="Aucune donnée disponible"
              description={`Aucune classe trouvée pour l'année ${selectedAnneeInfo?.annee || 'sélectionnée'} dans votre département.`}
              type="info"
              showIcon
            />
          ) : (
            <Table
              columns={columns}
              dataSource={filteredClasses}
              rowKey="id"
              pagination={{ 
                showSizeChanger: true,
                pageSizeOptions: [10, 20, 50, 100, 200, 500],
                showTotal: (total: number) => `Total ${total} classes`,
                defaultPageSize: 10
              }}
              bordered
              size="middle"
            />
          )}
        </Card>
      </div>
    </div>
  );
};

export default Classes;