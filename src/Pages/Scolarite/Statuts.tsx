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
  EyeOutlined,
  FileTextOutlined,
  ReloadOutlined
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
  ip_ministere: string;
  matricule_iipea: string;
  filiere: string;
  filiere_sigle: string;
  niveau: string;
  type_parcours: string;
  annee_academique: string;
  etat_annee: string;
  standing: string;
  statut_scolaire: string;
  date_inscription: string;
  groupe_nom: string;
  extrait_naissance: string;
  justificatif_identite: string;
  dernier_diplome: string;
  fiche_orientation: string;
  montant_total_scolarite: number;
  montant_paye: number; 
  montant_restant: number;
  pourcentage_paye: number | string;
  lieu_naissance?: string;
  email?: string;
  annee_bac?: string;
  serie_bac?: string;
  etablissement_origine?: string;
}

interface ExportEtudiantData {
  matricule: string;
  standing: string;
  ip_ministere: string;
  matricule_iipea: string;
  code_unique: string;
  id: string;
  nom: string;
  prenoms: string;
  telephone: string;
  contact_parent: string;
   contact_parent_2: string;
  statut_scolaire: string;
  date_inscription: string;
  filiere: string;
  niveau: string;
  annee_academique: string;
  type_parcours: string;
  groupe_nom: string;
  montant_total_scolarite: number;
  montant_paye: number;
  montant_restant: number;
  statut_etudiant: string;
  pourcentage_paye?: number | string;
}

interface AcademicYear {
  id: number;
  annee: string;
  etat: string;
}

interface ExportResponse {
  success: boolean;
  data: ExportEtudiantData[];
  total: number;
  message?: string;
  anneeAcademique: {
    id: number;
    annee: string;
    etat: string;
  };
}

// Type simplifié pour les données exportées Excel
interface ExportRow {
  'N°': string;
  'ip_ministere': string;
  'matricule_iipea': string;
  'code_unique': string;
  'Nom': string;
  'Prénoms': string;
  'Téléphone': string;
  'Contact Parent': string;
  'contact_parent_2': string;
  'Filière': string;
  'Niveau': string;
  'Groupe': string;
  'Type Parcours': string;
  'Statut Scolaire': string;
  'Date Inscription': string;
  'Scolarité Total': string;
  'Scolarité Versée': string;
  'Reste à Payer': string;
  'Statut': string;
  'Année Académique': string;
  'Pourcentage Payé': string;
}

const Statuts = () => {
  const [data, setData] = useState<EtudiantData[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingYears, setLoadingYears] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });
  const [searchInput, setSearchInput] = useState('');
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [selectedYearId, setSelectedYearId] = useState<number | null>(null);
  const [selectedYearInfo, setSelectedYearInfo] = useState<{annee: string; etat: string} | null>(null);
  
  const navigate = useNavigate();
  const API_URL = import.meta.env.VITE_API_URL_SERVER || "";

useEffect(() => {
  const fetchAcademicYears = async () => {
    setLoadingYears(true);
    try {
      const token = localStorage.getItem('token');
      const departement_id = localStorage.getItem('departement_id');

      if (!token || !departement_id) {
        message.error('Authentification requise');
        navigate('/login');
        return;
      }

      const response = await fetch(
        `${API_URL}/api/annees?departement_id=${departement_id}`,
        { headers: { 'Content-Type': 'application/json' } }
      );

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
        const currentYear = data.find((year: AcademicYear) =>
          year.etat?.toLowerCase() === 'en cours' ||
          year.etat?.toLowerCase() === 'en cour'
        );
        if (currentYear) {
          setSelectedYearId(currentYear.id);
        } else if (data.length > 0) {
          setSelectedYearId(data[0].id);
        }
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
}, [API_URL, navigate]);

  const fetchData = useCallback(async (page: number, pageSize: number, searchTerm = '', yearId: number | null) => {
    if (!yearId) {
      message.warning('Veuillez sélectionner une année académique');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const departement_id = localStorage.getItem('departement_id');
      
      if (!token || !departement_id) {
        message.error('Authentification requise');
        navigate('/login');
        return;
      }

      let url = `${API_URL}/api/etudiants/EtudiantsByDepartement?departement_id=${departement_id}&anneeAcademiqueId=${yearId}&page=${page}&limit=${pageSize}`;
      
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
  }, [navigate, API_URL]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (selectedYearId) {
        fetchData(1, pagination.pageSize, searchInput, selectedYearId);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchInput, selectedYearId, pagination.pageSize, fetchData]);

  useEffect(() => {
    if (selectedYearId) {
      fetchData(1, pagination.pageSize, searchInput, selectedYearId);
    }
  }, [selectedYearId, fetchData]);

  const columns: ColumnsType<EtudiantData> = [
    {
      title: 'IP Ministre',
      dataIndex: 'ip_ministere',
      key: 'ip_ministere',
      width: 150,
      fixed: 'left',
      sorter: (a, b) => (a.ip_ministere || '').localeCompare(b.ip_ministere || ''),
    },
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
      width: 250,
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
      width: 290,
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
      title: 'Groupe',
      dataIndex: 'groupe_nom',
      key: 'groupe_nom',
      width: 340,
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
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      width: 200,
      render: (text) => text || '-',
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
        if (standing?.toLowerCase() === 'actif') color = 'green';
        if (standing?.toLowerCase() === 'suspendu') color = 'orange';
        if (standing?.toLowerCase() === 'abandon') color = 'red';
        
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
        if (statut?.toLowerCase() === 'régulier' || statut?.toLowerCase() === 'regular') color = 'green';
        if (statut?.toLowerCase() === 'irrégulier' || statut?.toLowerCase() === 'irregular') color = 'orange';
        if (statut?.toLowerCase() === 'exclu') color = 'red';
        
        return <Badge color={color} text={statut} />;
      },
    },
    {
      title: 'Date Inscription',
      dataIndex: 'date_inscription',
      key: 'date_inscription',
      width: 150,
      render: (date) => date ? new Date(date).toLocaleDateString('fr-FR') : '-',
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
      title: 'Scolarité Total',
      dataIndex: 'montant_total_scolarite',
      key: 'montant_total_scolarite',
      width: 150,
      render: (text) => <Text>{(text || 0).toLocaleString('fr-FR')} FCFA</Text>,
    },
    {
      title: 'Scolarité Versée',
      dataIndex: 'montant_paye',
      key: 'montant_paye',
      width: 150,
      render: (text) => <Text>{(text || 0).toLocaleString('fr-FR')} FCFA</Text>,
    },
    {
      title: 'Reste à Payer',
      dataIndex: 'montant_restant',
      key: 'montant_restant',
      width: 150,
      render: (text) => <Text type={text > 0 ? "danger" : "success"}>{(text || 0).toLocaleString('fr-FR')} FCFA</Text>,
    },
    {
      title: '% Payé',
      dataIndex: 'pourcentage_paye',
      key: 'pourcentage_paye',
      width: 100,
      render: (pourcentage) => {
        const pourcentageNum = typeof pourcentage === 'string' ? parseFloat(pourcentage) : (pourcentage || 0);
        return (
          <Tag color={pourcentageNum >= 100 ? 'green' : pourcentageNum >= 50 ? 'orange' : 'red'}>
            {pourcentageNum.toFixed(1)}%
          </Tag>
        );
      },
      sorter: (a, b) => {
        const valA = typeof a.pourcentage_paye === 'string' ? parseFloat(a.pourcentage_paye) : (a.pourcentage_paye || 0);
        const valB = typeof b.pourcentage_paye === 'string' ? parseFloat(b.pourcentage_paye) : (b.pourcentage_paye || 0);
        return valA - valB;
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button 
            icon={<EyeOutlined />} 
            onClick={() => navigate(`/Etudiant/Details_Etudiant/${record.id}`)}
            title="Voir détails"
            size="small"
          />
          <Button 
            icon={<FileTextOutlined />} 
            onClick={() => navigate(`/Etudiant/Recu_Payement/${record.id}`)}
            title="Voir reçu"
            size="small"
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

  const handleExport = async () => {
    if (!selectedYearId) {
      message.warning('Veuillez sélectionner une année académique avant d\'exporter');
      return;
    }

    setExportLoading(true);
    const hideLoading = message.loading({ 
      content: 'Préparation de l\'export...', 
      key: 'export',
      duration: 0 
    });
    
    try {
      const token = localStorage.getItem('token');
      const departement_id = localStorage.getItem('departement_id');
      
      if (!token || !departement_id) {
        message.error('Authentification requise');
        navigate('/login');
        return;
      }

      let url = `${API_URL}/api/etudiants/ExportEtudiants?departement_id=${departement_id}&anneeAcademiqueId=${selectedYearId}`;
      
      if (searchInput.trim()) {
        url += `&search=${encodeURIComponent(searchInput.trim())}`;
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
        throw new Error(`Erreur HTTP: ${response.status}`);
      }

      const result: ExportResponse = await response.json();
      
      if (result.success && result.data && result.data.length > 0) {
        // Préparer les données pour l'export - UNIQUEMENT les colonnes souhaitées
        const exportData: ExportRow[] = result.data.map(item => {
          // Formater les dates
          const formatDate = (dateStr: string | undefined): string => {
            if (!dateStr) return '-';
            try {
              return new Date(dateStr).toLocaleDateString('fr-FR');
            } catch {
              return '-';
            }
          };

          // Fonction pour formater le pourcentage
          const formatPourcentage = (value: number | string | undefined): string => {
            if (value === undefined || value === null) return '0%';
            const numValue = typeof value === 'string' ? parseFloat(value) : value;
            return isNaN(numValue) ? '0%' : `${numValue.toFixed(1)}%`;
          };

          return {
            'N°': item.matricule || '',
            'ip_ministere': item.ip_ministere || '',
            'matricule_iipea':item.matricule_iipea || '',
            'code_unique': item.code_unique || '',
            'Nom': item.nom || '',
            'Prénoms': item.prenoms || '',
            'Téléphone': item.telephone || '',
            'Contact Parent': item.contact_parent || '',
            'contact_parent_2': item.contact_parent_2 || '',
            'Filière': item.filiere || '',
            'Niveau': item.niveau || '',
            'Groupe': item.groupe_nom || '',
            'Type Parcours': item.type_parcours || '',
            'Statut Scolaire': item.statut_scolaire || '',
            'Date Inscription': formatDate(item.date_inscription),
            'Scolarité Total': `${(item.montant_total_scolarite || 0).toLocaleString('fr-FR')} FCFA`,
            'Scolarité Versée': `${(item.montant_paye || 0).toLocaleString('fr-FR')} FCFA`,
            'Reste à Payer': `${(item.montant_restant || 0).toLocaleString('fr-FR')} FCFA`,
            'Statut': item.standing || '',
            'Année Académique': result.anneeAcademique?.annee || '',
            'Pourcentage Payé': formatPourcentage(item.pourcentage_paye)
          };
        });

        // Créer le workbook Excel
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(exportData);
        
        // Ajuster la largeur des colonnes
        const maxWidth = 50;
        const wscols: XLSX.ColInfo[] = [];
        
        if (exportData.length > 0) {
          const headers = Object.keys(exportData[0]) as Array<keyof ExportRow>;
          headers.forEach((header) => {
            let maxLen = header.length;
            exportData.forEach(row => {
              const value = row[header]?.toString() || '';
              maxLen = Math.max(maxLen, value.length);
            });
            wscols.push({ wch: Math.min(maxLen + 2, maxWidth) });
          });
        }
        ws['!cols'] = wscols;
        
        XLSX.utils.book_append_sheet(wb, ws, "Étudiants");
        
        const dateStr = new Date().toISOString().slice(0, 10);
        const anneeStr = result.anneeAcademique?.annee?.replace(/\//g, '-') || 'annee-courante';
        const searchSuffix = searchInput.trim() ? `_recherche_${searchInput.trim().replace(/\s+/g, '_')}` : '';
        const fileName = `etudiants_${anneeStr}${searchSuffix}_${dateStr}.xlsx`;
        
        XLSX.writeFile(wb, fileName);
        
        message.success({ 
          content: `${exportData.length} étudiants exportés avec succès`, 
          key: 'export',
          duration: 3 
        });
      } else if (result.data && result.data.length === 0) {
        message.warning({ 
          content: 'Aucune donnée à exporter pour les filtres sélectionnés', 
          key: 'export',
          duration: 3 
        });
      } else {
        throw new Error(result.message || 'Erreur lors de l\'export');
      }
    } catch (error) {
      console.error('Erreur lors de l\'export:', error);
      message.error({ 
        content: error instanceof Error ? error.message : 'Erreur lors de l\'export', 
        key: 'export',
        duration: 5 
      });
    } finally {
      setExportLoading(false);
      hideLoading();
    }
  };

  const handleRefresh = () => {
    if (selectedYearId) {
      fetchData(1, pagination.pageSize, searchInput, selectedYearId);
    }
  };

  const handleSearch = (value: string) => {
    setSearchInput(value);
  };

  return (
    <div style={{ padding: 24 }}>
      <PageHeader />
      
      <Card
        title="Liste des Étudiants"
        bordered={true}
        extra={
          <Space wrap>
            <Select
              value={selectedYearId}
              onChange={setSelectedYearId}
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
              size="middle"
            />
            
            <Button 
              icon={<ReloadOutlined />}
              onClick={handleRefresh}
              disabled={loading || !selectedYearId}
              title="Actualiser"
              size="middle"
            />
            
            <Button 
              type="primary" 
              icon={<DownloadOutlined />}
              onClick={handleExport}
              loading={exportLoading}
              disabled={loading || !selectedYearId || data.length === 0}
              size="middle"
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
            {data.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <Text type="secondary">
                  Total: {pagination.total} étudiants • Année: {selectedYearInfo?.annee} ({selectedYearInfo?.etat})
                </Text>
              </div>
            )}
            
            <Table
              columns={columns}
              dataSource={data}
              rowKey="id"
              loading={{
                spinning: loading,
                indicator: <Spin size="large" />
              }}
              pagination={{
                current: pagination.current,
                pageSize: pagination.pageSize,
                total: pagination.total,
                showSizeChanger: true,
                pageSizeOptions: ['10', '50', '100', '500', '1000'],
                showTotal: (total, range) => 
                  `${range[0]}-${range[1]} sur ${total} étudiants`,
              }}
              onChange={handleTableChange}
              scroll={{ x: 3500, y: 600 }}
              size="middle"
              bordered={true}
              sticky={{ offsetHeader: 0 }}
              locale={{
                emptyText: loading ? 'Chargement...' : 'Aucun étudiant trouvé'
              }}
            />
          </>
        )}
      </Card>
    </div>
  );
};

export default Statuts;