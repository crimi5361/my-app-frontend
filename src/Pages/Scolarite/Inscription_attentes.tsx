/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect, useCallback } from 'react';
import { 
  Table, 
  Input, 
  Button, 
  Space, 
  Card, 
  Tag, 
  Typography,
  message,
  Spin,
  Badge,
  Select,
  Alert
} from 'antd';
import { 
  SearchOutlined, 
  DownloadOutlined,
  EyeOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../Components/PageHeader/PageHeader';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import * as XLSX from 'xlsx';

const { Text } = Typography;
const { Option } = Select;

interface EtudiantData {
  id: string;
  matricule: string;
  nom: string;
  prenoms: string;
  date_naissance: string;
  telephone: string;
  contact_parent: string;
  contact_parent_2: string;
  code_unique: string;
  nationalite: string;
  sexe: string;
  matricule_iipea: string;
  filiere: string;
  filiere_sigle: string;
  niveau: string;
  annee_academique: string;
  etat_annee: string;
  standing: string;
  statut_scolaire: string;
  date_inscription: string;
  photo_url: string;
  extrait_naissance: string;
  justificatif_identite: string;
  dernier_diplome: string;
  fiche_orientation: string;
}

interface AcademicYear {
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

const Inscription_attentes = () => {
  const [data, setData] = useState<EtudiantData[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingYears, setLoadingYears] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });
  const [searchInput, setSearchInput] = useState('');
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [selectedYearId, setSelectedYearId] = useState<number | null>(null);
  const [selectedYearInfo, setSelectedYearInfo] = useState<{annee: string; etat: string} | null>(null);
  const [currentUser, setCurrentUser] = useState<UserInfo | null>(null);
  const [initialYearSet, setInitialYearSet] = useState(false);
  
  const navigate = useNavigate();
  const API_URL = import.meta.env.VITE_API_URL_SERVER || "";

  // Chargement utilisateur
  useEffect(() => {
    const user = getUserInfo();
    if (!user) {
      message.error('Impossible de récupérer vos informations. Veuillez vous reconnecter.');
      navigate('/login');
      return;
    }
    if (!user.departement_id) {
      message.error("Aucun département associé à votre compte.");
      return;
    }
    setCurrentUser(user);
  }, [navigate]);

  // Récupérer les années académiques par département
  useEffect(() => {
    const fetchAcademicYears = async () => {
      if (!currentUser?.departement_id) return;
      
      setLoadingYears(true);
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          message.error('Authentification requise');
          navigate('/login');
          return;
        }

        const response = await fetch(`${API_URL}/api/annees?departement_id=${currentUser.departement_id}`, {
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
          setAcademicYears(data);
          // Sélectionner l'année "en cours" par défaut
          const currentYear = data.find((year: AcademicYear) => 
            year.etat?.toLowerCase() === 'en cours' || 
            year.etat?.toLowerCase() === 'en cour'
          );
          if (currentYear) {
            setSelectedYearId(currentYear.id);
            setSelectedYearInfo({ annee: currentYear.annee, etat: currentYear.etat });
          } else if (data.length > 0) {
            setSelectedYearId(data[0].id);
            setSelectedYearInfo({ annee: data[0].annee, etat: data[0].etat });
          }
          setInitialYearSet(true);
        } else {
          throw new Error('Format de réponse inattendu');
        }
      } catch (err) {
        console.error('Erreur récupération années académiques:', err);
        message.error('Impossible de charger les années académiques');
      } finally {
        setLoadingYears(false);
      }
    };

    fetchAcademicYears();
  }, [API_URL, currentUser, navigate]);

  const fetchData = useCallback(async (page: number, pageSize: number, searchTerm = '', yearId: number | null) => {
    if (!yearId) return;
    if (!currentUser?.departement_id) {
      message.warning('Aucun département associé à votre compte');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        message.error('Authentification requise');
        navigate('/login');
        return;
      }

      // Construction de l'URL avec recherche et année académique
      let url = `${API_URL}/api/etudiants/EtudiantsByDepartementEnattente?departement_id=${currentUser.departement_id}&anneeAcademiqueId=${yearId}&page=${page}&limit=${pageSize}`;
      
      // Ajout du paramètre de recherche si fourni
      if (searchTerm.trim()) {
        url += `&search=${encodeURIComponent(searchTerm.trim())}`;
      }

      const response = await fetch(url, {
        method: 'GET',
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
        const errorData = await response.json();
        throw new Error(errorData.message || `Erreur HTTP: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        setData(result.data);
        setPagination(prev => ({
          ...prev,
          current: page,
          pageSize: pageSize,
          total: result.total || result.data.length,
        }));
        
        // Mettre à jour les informations de l'année
        if (result.anneeAcademique) {
          setSelectedYearInfo({
            annee: result.anneeAcademique.annee,
            etat: result.anneeAcademique.etat
          });
        }
      } else {
        message.error(result.message || 'Erreur lors du chargement des données');
      }
    } catch (error) {
      console.error('Erreur de récupération des données:', error);
      message.error('Erreur de connexion au serveur');
    } finally {
      setLoading(false);
    }
  }, [currentUser, navigate, API_URL]);

  // Effet pour la recherche avec debounce
  useEffect(() => {
    if (initialYearSet && selectedYearId) {
      const timeoutId = setTimeout(() => {
        fetchData(1, pagination.pageSize, searchInput, selectedYearId);
      }, 500);

      return () => clearTimeout(timeoutId);
    }
  }, [searchInput, selectedYearId, initialYearSet]);

  // Chargement quand l'année change
  useEffect(() => {
    if (initialYearSet && selectedYearId) {
      fetchData(1, pagination.pageSize, searchInput, selectedYearId);
    }
  }, [selectedYearId, initialYearSet]);

  const columns: ColumnsType<EtudiantData> = [
    {
      title: 'Matricule MERS',
      dataIndex: 'matricule',
      key: 'matricule',
      width: 150,
      fixed: 'left',
      sorter: (a, b) => (a.matricule || '').localeCompare(b.matricule || ''),
    },
    {
      title: 'Code Unique',
      dataIndex: 'code_unique',
      key: 'code_unique',
      width: 150,
      fixed: 'left',
    },
    {
      title: 'Nom',
      dataIndex: 'nom',
      key: 'nom',
      width: 150,
      fixed: 'left',
      sorter: (a, b) => (a.nom || '').localeCompare(b.nom || ''),
    },
    {
      title: 'Prénoms',
      dataIndex: 'prenoms',
      key: 'prenoms',
      width: 150,
      fixed: 'left',
      sorter: (a, b) => (a.prenoms || '').localeCompare(b.prenoms || ''),
    },
    {
      title: 'Matricule IIPEA',
      dataIndex: 'matricule_iipea',
      key: 'matricule_iipea',
      width: 150,
      render: (text) => text ? <Tag color="purple">{text}</Tag> : '-',
    },
    {
      title: 'Sexe',
      dataIndex: 'sexe',
      key: 'sexe',
      width: 100,
      render: (sexe) => {
        const normalizedSexe = String(sexe || '').trim().toUpperCase();
        const isMale = normalizedSexe === 'M' || normalizedSexe === 'MASCULIN';
        
        return (
          <Tag color={isMale ? 'blue' : 'pink'}>
            {isMale ? 'Masculin' : 'Féminin'}
          </Tag>
        );
      },
    },
    {
      title: 'Filière',
      dataIndex: 'filiere',
      key: 'filiere',
      width: 250,
      render: (_, record) => (
        <Text>
          {record.filiere} ({record.filiere_sigle})
        </Text>
      ),
    },
    {
      title: 'Niveau',
      dataIndex: 'niveau',
      key: 'niveau',
      width: 120,
      render: (text) => <Tag color="geekblue">{text}</Tag>,
    },
    {
      title: 'Téléphone',
      dataIndex: 'telephone',
      key: 'telephone',
      width: 150,
    },
    {
      title: 'Contact Parent 1',
      dataIndex: 'contact_parent',
      key: 'contact_parent',
      width: 150,
    },
    {
      title: 'Contact Parent 2',
      dataIndex: 'contact_parent_2',
      key: 'contact_parent_2',
      width: 150,
      render: (text) => text || '-',
    },
    {
      title: 'Nationalité',
      dataIndex: 'nationalite',
      key: 'nationalite',
      width: 120,
      render: (text) => <Tag>{text}</Tag>,
    },
    {
      title: 'Statut',
      dataIndex: 'standing',
      key: 'standing',
      width: 120,
      render: (standing) => {
        let color = 'default';
        if (standing === 'en attente') color = 'orange';
        if (standing === 'actif') color = 'green';
        if (standing === 'suspendu') color = 'orange';
        if (standing === 'abandon') color = 'red';
        
        return <Badge color={color} text={standing} />;
      },
    },
    {
      title: 'Statut Scolaire',
      dataIndex: 'statut_scolaire',
      key: 'statut_scolaire',
      width: 150,
      render: (statut) => {
        let color = 'default';
        if (statut === 'regular') color = 'green';
        if (statut === 'irregular') color = 'orange';
        if (statut === 'exclu') color = 'red';
        
        return <Badge color={color} text={statut} />;
      },
    },
    {
      title: 'Date Inscription',
      dataIndex: 'date_inscription',
      key: 'date_inscription',
      width: 150,
      render: (date) => date ? new Date(date).toLocaleDateString() : '-',
      sorter: (a, b) => {
        const dateA = a.date_inscription ? new Date(a.date_inscription).getTime() : 0;
        const dateB = b.date_inscription ? new Date(b.date_inscription).getTime() : 0;
        return dateA - dateB;
      },
    },
    {
      title: 'Extrait Naissance',
      dataIndex: 'extrait_naissance',
      key: 'extrait_naissance',
      width: 150,
      render: (text) => (
        <Tag color={text === 'oui' ? 'green' : 'red'}>
          {text === 'oui' ? 'Déposé' : 'Manquant'}
        </Tag>
      ),
    },
    {
      title: 'Justificatif Identité',
      dataIndex: 'justificatif_identite',
      key: 'justificatif_identite',
      width: 150,
      render: (text) => (
        <Tag color={text === 'oui' ? 'green' : 'red'}>
          {text === 'oui' ? 'Déposé' : 'Manquant'}
        </Tag>
      ),
    },
    {
      title: 'Dernier Diplôme',
      dataIndex: 'dernier_diplome',
      key: 'dernier_diplome',
      width: 150,
      render: (text) => (
        <Tag color={text === 'oui' ? 'green' : 'red'}>
          {text === 'oui' ? 'Déposé' : 'Manquant'}
        </Tag>
      ),
    },
    {
      title: 'Fiche Orientation',
      dataIndex: 'fiche_orientation',
      key: 'fiche_orientation',
      width: 150,
      render: (text) => (
        <Tag color={text === 'oui' ? 'green' : 'red'}>
          {text === 'oui' ? 'Déposé' : 'Manquant'}
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 70,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button 
            icon={<EyeOutlined />} 
            onClick={() => navigate(`/Etudiant/Details_Etudiant/${record.id}`)}
            title="Voir détails"
          />
        </Space>
      ),
    },
  ];

  const handleTableChange = (newPagination: TablePaginationConfig) => {
    const newPage = newPagination.current || 1;
    const newPageSize = newPagination.pageSize || 10;
    
    fetchData(newPage, newPageSize, searchInput, selectedYearId);
  };

  const handleExport = () => {
    if (!selectedYearId) {
      message.warning('Veuillez sélectionner une année académique avant d\'exporter');
      return;
    }

    if (data.length === 0) {
      message.warning('Aucune donnée à exporter');
      return;
    }

    message.loading({ content: 'Préparation de l\'export...', key: 'export' });
    
    try {
      const exportData = data.map(item => {
        const normalizedSexe = String(item.sexe || '').trim().toUpperCase();
        const sexeExport = normalizedSexe === 'M' || normalizedSexe === 'MASCULIN' ? 'Masculin' : 'Féminin';
        
        return {
          'Matricule MERS': item.matricule || '',
          'Code Unique': item.code_unique || '',
          'Nom': item.nom || '',
          'Prénoms': item.prenoms || '',
          'Matricule IIPEA': item.matricule_iipea || '-',
          'Sexe': sexeExport,
          'Filière': `${item.filiere} (${item.filiere_sigle})`,
          'Niveau': item.niveau || '',
          'Téléphone': item.telephone || '',
          'Contact Parent 1': item.contact_parent || '',
          'Contact Parent 2': item.contact_parent_2 || '-',
          'Nationalité': item.nationalite || '',
          'Statut': item.standing || '',
          'Statut Scolaire': item.statut_scolaire || '',
          'Date Inscription': item.date_inscription ? new Date(item.date_inscription).toLocaleDateString() : '-',
          'Extrait Naissance': item.extrait_naissance === 'oui' ? 'Déposé' : 'Manquant',
          'Justificatif Identité': item.justificatif_identite === 'oui' ? 'Déposé' : 'Manquant',
          'Dernier Diplôme': item.dernier_diplome === 'oui' ? 'Déposé' : 'Manquant',
          'Fiche Orientation': item.fiche_orientation === 'oui' ? 'Déposé' : 'Manquant',
          'Année Académique': selectedYearInfo?.annee || ''
        };
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);
      
      // Ajuster la largeur des colonnes
      const colWidths = [
        { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 20 },
        { wch: 15 }, { wch: 10 }, { wch: 30 }, { wch: 10 },
        { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 10 },
        { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
        { wch: 15 }, { wch: 15 }, { wch: 20 }
      ];
      ws['!cols'] = colWidths;
      
      XLSX.utils.book_append_sheet(wb, ws, "Etudiants");
      const fileName = `etudiants_en_attente_${selectedYearInfo?.annee || ''}_${new Date().toISOString().slice(0,10)}.xlsx`;
      XLSX.writeFile(wb, fileName);
      
      message.success({ content: 'Export réalisé avec succès', key: 'export' });
    } catch (error) {
      console.error('Erreur lors de l\'export:', error);
      message.error({ content: 'Erreur lors de l\'export', key: 'export' });
    }
  };

  const handleSearch = (value: string) => {
    setSearchInput(value);
  };

  // Guards
  if (!currentUser) {
    return (
      <div style={{ padding: 24 }}>
        <PageHeader />
        <Alert
          message="Accès non autorisé"
          description="Impossible de récupérer vos informations utilisateur. Veuillez vous reconnecter."
          type="error" 
          showIcon
        />
      </div>
    );
  }

  if (!currentUser.departement_id) {
    return (
      <div style={{ padding: 24 }}>
        <PageHeader />
        <Alert
          message="Département non assigné"
          description="Votre compte n'est associé à aucun département. Veuillez contacter l'administrateur."
          type="warning" 
          showIcon
        />
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <PageHeader />
      
      <Alert
        message={`Inscriptions en attente — ${currentUser.departementName || 'Département ' + currentUser.departement_id}`}
        description={`Vous visualisez uniquement les inscriptions en attente du département ${currentUser.departementName || ''}.`}
        type="info" 
        showIcon 
        style={{ marginBottom: 16 }} 
        closable
      />

      <Card
        title="Liste des Étudiants en Attente d'Inscription"
        bordered={true}
        extra={
          <Space wrap>
            <Select
              value={selectedYearId}
              onChange={(value) => {
                const selectedYear = academicYears.find(y => y.id === value);
                if (selectedYear) {
                  setSelectedYearInfo({ annee: selectedYear.annee, etat: selectedYear.etat });
                }
                setSelectedYearId(value);
              }}
              style={{ width: 250 }}
              placeholder="Sélectionner une année"
              loading={loadingYears}
              size="middle"
            >
              {academicYears.map((year) => (
                <Option key={year.id} value={year.id}>
                  {year.annee} ({year.etat})
                </Option>
              ))}
            </Select>
            
            <Input
              placeholder="Rechercher par nom, prénom, matricule..."
              prefix={<SearchOutlined />}
              value={searchInput}
              onChange={(e) => handleSearch(e.target.value)}
              style={{ width: 300 }}
              allowClear
            />
            <Button 
              type="primary" 
              icon={<DownloadOutlined />}
              onClick={handleExport}
              disabled={loading || !selectedYearId || data.length === 0}
            >
              Exporter Excel
            </Button>
          </Space>
        }
      >
        {!selectedYearId ? (
          <Alert
            message="Aucune année sélectionnée"
            description="Veuillez sélectionner une année académique pour afficher la liste des étudiants en attente."
            type="warning"
            showIcon
          />
        ) : (
          <>
            {selectedYearInfo && (
              <div style={{ marginBottom: 16 }}>
                <Tag color={selectedYearInfo.etat === 'en cours' || selectedYearInfo.etat === 'en cour' ? 'green' : 'blue'}>
                  Année: {selectedYearInfo.annee} ({selectedYearInfo.etat})
                </Tag>
                <Tag color="orange">Étudiants en attente: {pagination.total}</Tag>
              </div>
            )}
            
            <Spin spinning={loading}>
              <Table
                columns={columns}
                dataSource={data}
                rowKey="id"
                pagination={{
                  current: pagination.current,
                  pageSize: pagination.pageSize,
                  total: pagination.total,
                  showSizeChanger: true,
                  pageSizeOptions: ['10', '50', '100', '500', '1000', '5000', '10000'],
                  showTotal: (total, range) => 
                    `${range[0]}-${range[1]} sur ${total} étudiants en attente (${selectedYearInfo?.annee})`,
                }}
                onChange={handleTableChange}
                scroll={{ x: 2200 }}
                size="middle"
                bordered={true}
              />
            </Spin>
          </>
        )}
      </Card>
    </div>
  );
};

export default Inscription_attentes;