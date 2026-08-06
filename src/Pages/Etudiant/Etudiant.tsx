/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Input,
  Button,
  Space,
  Card,
  Typography,
  message,
  Tooltip,
  Select,
  Alert
} from 'antd';
import DataTable from '../../Components/ui/DataTable';
import StatusTag from '../../Components/ui/StatusTag';
import { 
  SearchOutlined, 
  DownloadOutlined,
  EyeOutlined,
  FileDoneOutlined,
  FileTextOutlined,
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
  lieu_naissance: string;
  nationalite: string;
  sexe: string;
  matricule_iipea: string;
  filiere: string;
  filiere_sigle: string;
  niveau: string;
  type_parcours: string;
  annee_academique: string;
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

const Etudiant = () => {
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
    const fetchAcademicYears = async () => {
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

  // Fonction pour formater les dates
  const formatDate = (dateString: string): string => {
    if (!dateString) return '-';
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return dateString;
      }
      return date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch (error) {
      console.error('Erreur de formatage de date:', error);
      return dateString;
    }
  };

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
      let url = `${API_URL}/api/etudiants/EtudiantsByDepartement?departement_id=${currentUser.departement_id}&anneeAcademiqueId=${yearId}&page=${page}&limit=${pageSize}`;
      
      // Ajout du paramètre de recherche si fourni
      if (searchTerm.trim()) {
        url += `&search=${encodeURIComponent(searchTerm.trim())}`;
      }

      const response = await fetch(url, {
        method: 'POST',
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
        const errorText = await response.text();
        console.error('Erreur détaillée:', errorText);
        throw new Error(`Erreur HTTP: ${response.status}`);
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
        setData([]);
        setPagination(prev => ({ ...prev, total: 0 }));
      }
    } catch (error) {
      console.error('Erreur de récupération des données:', error);
      message.error('Erreur de connexion au serveur');
      setData([]);
      setPagination(prev => ({ ...prev, total: 0 }));
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

  // Filtrage côté client uniquement si on charge toutes les données (pageSize >= 50)
  const shouldFilterLocally = pagination.pageSize >= 50;

  const filteredData = useMemo(() => {
    if (!shouldFilterLocally || !searchInput) return data;
    
    const searchTerms = searchInput.toLowerCase().split(' ').filter(term => term.length > 0);
    
    return data.filter(item => {
      const nomPrenom = `${item.nom} ${item.prenoms}`.toLowerCase();
      const prenomNom = `${item.prenoms} ${item.nom}`.toLowerCase();
      
      return searchTerms.every(term => 
        nomPrenom.includes(term) ||
        prenomNom.includes(term) ||
        item.matricule?.toLowerCase().includes(term) ||
        item.code_unique?.toLowerCase().includes(term) ||
        item.matricule_iipea?.toLowerCase().includes(term) ||
        item.filiere?.toLowerCase().includes(term) ||
        item.filiere_sigle?.toLowerCase().includes(term) ||
        item.telephone?.includes(term) ||
        item.nationalite?.toLowerCase().includes(term)
      );
    });
  }, [data, searchInput, shouldFilterLocally]);

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
      render: (text) => text ? <StatusTag tone="info" label={text} /> : '-',
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
          <StatusTag tone={isMale ? 'info' : 'neutral'} label={isMale ? 'Masculin' : 'Féminin'} />
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
      render: (text) => <StatusTag tone="info" label={text} />,
    },
    {
      title: 'Parcours',
      dataIndex: 'type_parcours',
      key: 'type_parcours',
      width: 150,
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
      render: (text) => <StatusTag tone="neutral" label={text} />,
    },
    {
      title: 'Date de Naissance',
      dataIndex: 'date_naissance',
      key: 'date_naissance',
      width: 180,
      render: (date) => formatDate(date),
      sorter: (a, b) => {
        const dateA = a.date_naissance ? new Date(a.date_naissance).getTime() : 0;
        const dateB = b.date_naissance ? new Date(b.date_naissance).getTime() : 0;
        return dateA - dateB;
      },
    },
    {
      title: 'Lieu de Naissance',
      dataIndex: 'lieu_naissance',
      key: 'lieu_naissance',
      width: 180,
    },
    {
      title: 'Statut',
      dataIndex: 'standing',
      key: 'standing',
      width: 120,
      render: (standing) => {
        let tone: 'success' | 'warning' | 'danger' | 'neutral' = 'neutral';
        if (standing === 'actif') tone = 'success';
        if (standing === 'suspendu') tone = 'warning';
        if (standing === 'abandon') tone = 'danger';
        return <StatusTag tone={tone} label={standing} />;
      },
    },
    {
      title: 'Statut Scolaire',
      dataIndex: 'statut_scolaire',
      key: 'statut_scolaire',
      width: 150,
      render: (statut) => {
        let tone: 'success' | 'warning' | 'danger' | 'neutral' = 'neutral';
        if (statut === 'regular') tone = 'success';
        if (statut === 'irregular') tone = 'warning';
        if (statut === 'exclu') tone = 'danger';
        return <StatusTag tone={tone} label={statut} />;
      },
    },
    {
      title: 'Date Inscription',
      dataIndex: 'date_inscription',
      key: 'date_inscription',
      width: 150,
      render: (date) => formatDate(date),
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
        <StatusTag tone={text === 'oui' ? 'success' : 'danger'} label={text === 'oui' ? 'Déposé' : 'Manquant'} />
      ),
    },
    {
      title: 'Justificatif Identité',
      dataIndex: 'justificatif_identite',
      key: 'justificatif_identite',
      width: 150,
      render: (text) => (
        <StatusTag tone={text === 'oui' ? 'success' : 'danger'} label={text === 'oui' ? 'Déposé' : 'Manquant'} />
      ),
    },
    {
      title: 'Dernier Diplôme',
      dataIndex: 'dernier_diplome',
      key: 'dernier_diplome',
      width: 150,
      render: (text) => (
        <StatusTag tone={text === 'oui' ? 'success' : 'danger'} label={text === 'oui' ? 'Déposé' : 'Manquant'} />
      ),
    },
    {
      title: 'Fiche Orientation',
      dataIndex: 'fiche_orientation',
      key: 'fiche_orientation',
      width: 150,
      render: (text) => (
        <StatusTag tone={text === 'oui' ? 'success' : 'danger'} label={text === 'oui' ? 'Déposé' : 'Manquant'} />
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 130,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="Voir détails">
            <Button 
              icon={<EyeOutlined />} 
              onClick={() => navigate(`/Etudiant/Details_Etudiant/${record.id}`)}
            />
          </Tooltip>
          <Tooltip title="Certificat de scolarité">
            <Button
              type="primary"
              shape="circle"
              icon={<FileTextOutlined />}
              style={{ backgroundColor: "var(--mod-scolarite)", borderColor: "var(--mod-scolarite)" }}
              onClick={() => navigate(`/Etudiant/Certificat_Scolarite/${record.id}`)}
            />
          </Tooltip>
          <Tooltip title="Certificat de fréquentation">
            <Button
              type="primary"
              shape="circle"
              icon={<FileDoneOutlined />}
              style={{ backgroundColor: "var(--success)", borderColor: "var(--success)" }}
              onClick={() => navigate(`/Etudiant/Certificat_Frequentation/${record.id}`)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const handleTableChange = (newPagination: TablePaginationConfig) => {
    const newPage = newPagination.current || 1;
    const newPageSize = newPagination.pageSize || 10;
    
    if (newPageSize < 50 || newPageSize !== pagination.pageSize) {
      fetchData(newPage, newPageSize, searchInput, selectedYearId);
    } else {
      setPagination(prev => ({
        ...prev,
        current: newPage,
        pageSize: newPageSize
      }));
    }
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
      const dataToExport = shouldFilterLocally && searchInput ? filteredData : data;
      
      const exportData = dataToExport.map(item => {
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
          'Parcours': item.type_parcours || '',
          'Téléphone': item.telephone || '',
          'Contact Parent 1': item.contact_parent || '',
          'Contact Parent 2': item.contact_parent_2 || '-',
          'Nationalité': item.nationalite || '',
          'Date de Naissance': formatDate(item.date_naissance),
          'Lieu de Naissance': item.lieu_naissance || '',
          'Statut': item.standing || '',
          'Statut Scolaire': item.statut_scolaire || '',
          'Date Inscription': formatDate(item.date_inscription),
          'Extrait Naissance': item.extrait_naissance === 'oui' ? 'Déposé' : 'Manquant',
          'Justificatif Identité': item.justificatif_identite === 'oui' ? 'Déposé' : 'Manquant',
          'Dernier Diplôme': item.dernier_diplome === 'oui' ? 'Déposé' : 'Manquant',
          'Fiche Orientation': item.fiche_orientation === 'oui' ? 'Déposé' : 'Manquant',
          'Année Académique': selectedYearInfo?.annee || ''
        };
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);
      
      const colWidths = [
        { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 20 }, { wch: 15 },
        { wch: 10 }, { wch: 30 }, { wch: 10 }, { wch: 15 }, { wch: 15 },
        { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 20 },
        { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
        { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 20 }
      ];
      ws['!cols'] = colWidths;
      
      XLSX.utils.book_append_sheet(wb, ws, "Etudiants");
      const deptName = currentUser?.departementName?.replace(/\s/g, '_') || 'departement';
      const annee = selectedYearInfo?.annee?.replace(/\//g, '-') || 'annee';
      const fileName = `etudiants_${deptName}_${annee}_${new Date().toISOString().slice(0,10)}.xlsx`;
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

  const handleYearChange = (yearId: number) => {
    const selectedYear = academicYears.find(y => y.id === yearId);
    if (selectedYear) {
      setSelectedYearInfo({ annee: selectedYear.annee, etat: selectedYear.etat });
    }
    setSelectedYearId(yearId);
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
        message={`Étudiants — ${currentUser.departementName || 'Département ' + currentUser.departement_id}`}
        description={`Vous visualisez uniquement les étudiants du département ${currentUser.departementName || ''}.`}
        type="info" 
        showIcon 
        style={{ marginBottom: 16 }} 
        closable
      />

      <Card
        title={`Liste des Étudiants${selectedYearInfo ? ` (${selectedYearInfo.annee})` : ''}`}
        extra={
          <Space wrap>
            <Select
              value={selectedYearId}
              onChange={handleYearChange}
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
            description="Veuillez sélectionner une année académique pour afficher la liste des étudiants."
            type="warning"
            showIcon
          />
        ) : (
          <>
            {selectedYearInfo && (
              <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
                <StatusTag
                  tone={selectedYearInfo.etat === 'en cours' || selectedYearInfo.etat === 'en cour' ? 'success' : 'info'}
                  label={`Année sélectionnée: ${selectedYearInfo.annee} (${selectedYearInfo.etat})`}
                />
                <StatusTag tone="info" label={`Total étudiants: ${pagination.total}`} />
              </div>
            )}

            <DataTable<EtudiantData>
              columns={columns}
              dataSource={shouldFilterLocally ? filteredData : data}
              rowKey="id"
              loading={loading}
              pagination={{
                current: pagination.current,
                pageSize: pagination.pageSize,
                total: shouldFilterLocally ? filteredData.length : pagination.total,
                pageSizeOptions: ['10', '50', '100', '500', '1000', '5000', '10000'],
                showTotal: (total, range) =>
                  `${range[0]}-${range[1]} sur ${total} étudiants`,
              }}
              onChange={handleTableChange}
              scroll={{ x: 2300 }}
            />
          </>
        )}
      </Card>
    </div>
  );
};

export default Etudiant;