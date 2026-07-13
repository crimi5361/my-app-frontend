/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useMemo } from 'react';
import {
  Table,
  Button,
  Input,
  Select,
  Space,
  Tag,
  Card,
  Row,
  Col,
  Typography,
  Modal,
  Form,
  Input as AntInput,
  message,
  Spin,
  Pagination,
  Tooltip,
  Badge,
  Dropdown,
  MenuProps,
  Upload,
} from 'antd';
import {
  Eye,
  Download,
  CheckCircle,
  XCircle,
  PlayCircle,
  Search,
  Filter,
  AlertCircle,
  RefreshCw,
  FileSpreadsheet,
  FileText,
  CheckSquare,
  XSquare,
  Upload as UploadIcon,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import type { ColumnsType } from 'antd/es/table';
import type { UploadFile, UploadProps } from 'antd/es/upload/interface';
import { RcFile } from 'antd/es/upload';
import { FilePdfOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = AntInput;

// ==================== INTERFACES ====================

interface Memoire {
  id: number;
  etudiant_id: number;
  theme: string;
  fichier_pdf: string;
  statut: 'en_attente' | 'encours' | 'valide' | 'rejete';
  motif_refus: string | null;
  rapport_analyse: string | null;
  date_depot: string;
  date_traitement: string | null;
  traite_par: string | null;
  agent_nom?: string | null;
  agent_email?: string | null;
  nom?: string;
  prenoms?: string;
  matricule_iipea?: string;
  email?: string;
  nom_filiere?: string;
  nom_niveau?: string;
}

interface Filters {
  niveau: string;
  filiere: string;
  statut: string;
  search: string;
}

interface ApiResponse {
  success: boolean;
  message?: string;
  memoires?: Memoire[];
  memoire?: Memoire;
}

// ==================== COMPOSANT PRINCIPAL ====================

const GesMemoire: React.FC = () => {
  const API_URL = import.meta.env.VITE_API_URL_SERVER || '';

  // États pour les données
  const [memoires, setMemoires] = useState<Memoire[]>([]);
  const [filteredMemoires, setFilteredMemoires] = useState<Memoire[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showRejectModal, setShowRejectModal] = useState<boolean>(false);
  const [showValidateModal, setShowValidateModal] = useState<boolean>(false);
  const [selectedMemoire, setSelectedMemoire] = useState<Memoire | null>(null);
  const [motifRefus, setMotifRefus] = useState<string>('');
  const [messageApi, contextHolder] = message.useMessage();
  const [rapportFile, setRapportFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  
  // États pour les filtres
  const [filters, setFilters] = useState<Filters>({
    niveau: '',
    filiere: '',
    statut: '',
    search: ''
  });
  
  // États pour la pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);
  
  // États pour les listes de filtres
  const [filieres, setFilieres] = useState<string[]>([]);
  const niveaux: string[] = ['LICENCE 3', 'MASTER 2'];
  const statuts: { value: string; label: string }[] = [
    { value: 'en_attente', label: 'En attente' },
    { value: 'encours', label: 'En cours' },
    { value: 'valide', label: 'Validé' },
    { value: 'rejete', label: 'Rejeté' }
  ];

  // Options de taille de page
  const pageSizeOptions = [10, 20, 50, 100, 200, 500];

  // Headers pour les requêtes fetch
  const getHeaders = () => ({
    'Authorization': `Bearer ${localStorage.getItem('token')}`,
    'Content-Type': 'application/json'
  });

  // Afficher les notifications
  const showToast = (msg: string, type: 'success' | 'error'): void => {
    if (type === 'success') {
      messageApi.success(msg);
    } else {
      messageApi.error(msg);
    }
  };

  // Récupérer les mémoires
  const fetchMemoires = async (): Promise<void> => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/memoire`, {
        headers: getHeaders()
      });
      
      if (!response.ok) throw new Error('Erreur lors du chargement');
      
      const data: ApiResponse = await response.json();
      const memoiresData = data.memoires || [];
      setMemoires(memoiresData);
      setFilteredMemoires(memoiresData);
      
      // Extraire les filières uniques
      const uniqueFilieres = [...new Set(memoiresData.map(m => m.nom_filiere).filter(Boolean))] as string[];
      setFilieres(uniqueFilieres);
    } catch (error) {
      console.error('Erreur:', error);
      showToast('Erreur lors du chargement des mémoires', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Appliquer les filtres (optimisé avec useMemo)
  const appliedFilters = useMemo(() => {
    let filtered = [...memoires];
    
    if (filters.niveau) {
      filtered = filtered.filter(m => m.nom_niveau?.toUpperCase() === filters.niveau.toUpperCase());
    }
    
    if (filters.filiere) {
      filtered = filtered.filter(m => m.nom_filiere === filters.filiere);
    }
    
    if (filters.statut) {
      filtered = filtered.filter(m => m.statut === filters.statut);
    }
    
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      filtered = filtered.filter(m => 
        m.nom?.toLowerCase().includes(searchTerm) ||
        m.prenoms?.toLowerCase().includes(searchTerm) ||
        m.matricule_iipea?.toLowerCase().includes(searchTerm)
      );
    }
    
    return filtered;
  }, [memoires, filters]);

  // Mettre à jour les données filtrées
  useEffect(() => {
    setFilteredMemoires(appliedFilters);
    setCurrentPage(1);
  }, [appliedFilters]);

  // Réinitialiser les filtres
  const resetFilters = (): void => {
    setFilters({
      niveau: '',
      filiere: '',
      statut: '',
      search: ''
    });
  };

  // Export Excel (XLSX)
  const exportToExcel = (data: any[], filename: string): void => {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Memoires');
    
    const colWidths = Object.keys(data[0] || {}).map(() => ({ wch: 20 }));
    worksheet['!cols'] = colWidths;
    
    XLSX.writeFile(workbook, `${filename}.xlsx`);
    showToast(`Export de ${data.length} mémoires réussi`, 'success');
  };

  // Préparer les données pour l'export
  const prepareExportData = (memoiresList: Memoire[], type: 'all' | 'validated' | 'rejected' = 'all') => {
    return memoiresList.map(m => {
      const baseData = {
        'Nom': m.nom || '',
        'Prénoms': m.prenoms || '',
        'Matricule': m.matricule_iipea || '',
        'Filière': m.nom_filiere || '',
        'Niveau': m.nom_niveau || '',
        'Thème': m.theme || '',
        'Date dépôt': m.date_depot ? new Date(m.date_depot).toLocaleDateString('fr-FR') : '',
        'Statut': getStatusLabel(m.statut)
      };
      
      if (type === 'validated') {
        return {
          ...baseData,
          'Date validation': m.date_traitement ? new Date(m.date_traitement).toLocaleDateString('fr-FR') : '',
          'Agent validateur': m.agent_nom || 'Non assigné'
        };
      }
      
      if (type === 'rejected') {
        return {
          ...baseData,
          'Date rejet': m.date_traitement ? new Date(m.date_traitement).toLocaleDateString('fr-FR') : '',
          'Agent ayant rejeté': m.agent_nom || 'Non assigné',
          'Motif du rejet': m.motif_refus || '',
          'Rapport d\'analyse': m.rapport_analyse ? 'Oui' : 'Non'
        };
      }
      
      return {
        ...baseData,
        'Agent traitant': m.agent_nom || 'Non assigné',
        'Motif (si rejeté)': m.motif_refus || '',
        'Rapport d\'analyse': m.rapport_analyse ? 'Oui' : 'Non'
      };
    });
  };

  // Export de tous les mémoires
  const exportAllMemoires = (): void => {
    if (filteredMemoires.length === 0) {
      showToast('Aucun mémoire à exporter', 'error');
      return;
    }
    const exportData = prepareExportData(filteredMemoires, 'all');
    exportToExcel(exportData, `memoires_${new Date().toISOString().split('T')[0]}`);
  };

  // Export uniquement des mémoires validés
  const exportValidatedMemoires = (): void => {
    const validatedData = filteredMemoires.filter(m => m.statut === 'valide');
    if (validatedData.length === 0) {
      showToast('Aucun mémoire validé à exporter', 'error');
      return;
    }
    const exportData = prepareExportData(validatedData, 'validated');
    exportToExcel(exportData, `memoires_valides_${new Date().toISOString().split('T')[0]}`);
  };

  // Export uniquement des mémoires rejetés
  const exportRejectedMemoires = (): void => {
    const rejectedData = filteredMemoires.filter(m => m.statut === 'rejete');
    if (rejectedData.length === 0) {
      showToast('Aucun mémoire rejeté à exporter', 'error');
      return;
    }
    const exportData = prepareExportData(rejectedData, 'rejected');
    exportToExcel(exportData, `memoires_rejetes_${new Date().toISOString().split('T')[0]}`);
  };

  // Menu d'export
  const exportMenuItems: MenuProps['items'] = [
    {
      key: 'all',
      label: 'Tous les mémoires',
      icon: <FileSpreadsheet size={16} />,
      onClick: exportAllMemoires
    },
    {
      key: 'validated',
      label: 'Mémoires validés',
      icon: <CheckSquare size={16} />,
      onClick: exportValidatedMemoires
    },
    {
      key: 'rejected',
      label: 'Mémoires rejetés',
      icon: <XSquare size={16} />,
      onClick: exportRejectedMemoires
    }
  ];

  const getStatusLabel = (statut: string): string => {
    const statusMap: Record<string, string> = {
      'en_attente': 'En attente',
      'encours': 'En cours',
      'valide': 'Validé',
      'rejete': 'Rejeté'
    };
    return statusMap[statut] || statut;
  };

  // Vérifier si l'utilisateur est l'agent assigné au mémoire
  const isAssignedToMe = (memoire: Memoire): boolean => {
    const userId = localStorage.getItem('user_id');
    if (!userId || !memoire.traite_par) return false;
    
    const assignedId = String(memoire.traite_par).trim();
    const currentId = String(userId).trim();
    
    return assignedId === currentId;
  };

  // Mettre un mémoire en cours de traitement
  const handleStartTreatment = async (memoire: Memoire): Promise<void> => {
    try {
      const userId = localStorage.getItem('user_id');
      
      const response = await fetch(`${API_URL}/api/memoire/${memoire.id}/encourtraitement`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ traite_par: userId })
      });
      
      const data: ApiResponse = await response.json();
      
      if (data.success) {
        showToast('Mémoire pris en charge avec succès', 'success');
        fetchMemoires();
      } else {
        showToast(data.message || 'Erreur lors de la prise en charge', 'error');
      }
    } catch (error: any) {
      console.error('Erreur:', error);
      showToast(error.message || 'Erreur lors de la prise en charge', 'error');
    }
  };

  // Visualiser le PDF du mémoire
  const handleViewPdf = (memoire: Memoire): void => {
    const pdfUrl = `${API_URL}${memoire.fichier_pdf}`;
    window.open(pdfUrl, '_blank');
  };

  // Visualiser le rapport d'analyse
  const handleViewRapport = (memoire: Memoire): void => {
    if (memoire.rapport_analyse) {
      const rapportUrl = `${API_URL}${memoire.rapport_analyse}`;
      window.open(rapportUrl, '_blank');
    } else {
      showToast('Aucun rapport d\'analyse disponible pour ce mémoire', 'error');
    }
  };

  // Télécharger le PDF du mémoire
  const handleDownloadPdf = async (memoire: Memoire): Promise<void> => {
    try {
      const token = localStorage.getItem('token');
      const pdfUrl = `${API_URL}${memoire.fichier_pdf}`;
      
      const response = await fetch(pdfUrl, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Erreur lors du téléchargement');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      
      const fileName = memoire.fichier_pdf.split('/').pop() || `memoire_${memoire.id}.pdf`;
      link.href = url;
      link.download = fileName;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      showToast('Téléchargement réussi', 'success');
    } catch (error) {
      console.error('Erreur de téléchargement:', error);
      showToast('Erreur lors du téléchargement du fichier', 'error');
    }
  };

  // Ouvrir la modal de validation
  const openValidateModal = (memoire: Memoire): void => {
    if (!isAssignedToMe(memoire)) {
      showToast('Vous n\'êtes pas autorisé à valider ce mémoire. Seul l\'agent qui l\'a pris en charge peut le faire.', 'error');
      return;
    }
    setSelectedMemoire(memoire);
    setRapportFile(null);
    setFileList([]);
    setShowValidateModal(true);
  };

  // Confirmer la validation (avec upload optionnel du rapport d'analyse)
  const handleValidateConfirm = async (): Promise<void> => {
    if (!selectedMemoire) return;

    setUploading(true);
    setShowValidateModal(false);

    try {
      const userId = localStorage.getItem('user_id');
      const formData = new FormData();
      formData.append('traite_par', userId || '');

      if (rapportFile) {
        formData.append('rapport_analyse', rapportFile);
      }

      const response = await fetch(`${API_URL}/api/memoire/${selectedMemoire.id}/valider`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      const data = await response.json();

      if (response.ok && data.success) {
        showToast(rapportFile ? 'Mémoire validé avec rapport d\'analyse' : 'Mémoire validé avec succès', 'success');
        setRapportFile(null);
        setFileList([]);
        fetchMemoires();
      } else {
        showToast(data.message || 'Erreur lors de la validation', 'error');
      }
    } catch (error: any) {
      console.error('Erreur:', error);
      showToast(error.message || 'Erreur lors de la validation', 'error');
    } finally {
      setUploading(false);
      setSelectedMemoire(null);
    }
  };

  // Ouvrir la modal de rejet
  const openRejectModal = (memoire: Memoire): void => {
    if (!isAssignedToMe(memoire)) {
      showToast('Vous n\'êtes pas autorisé à rejeter ce mémoire. Seul l\'agent qui l\'a pris en charge peut le faire.', 'error');
      return;
    }
    setSelectedMemoire(memoire);
    setMotifRefus('');
    setRapportFile(null);
    setFileList([]);
    setShowRejectModal(true);
  };

  // Configuration de l'upload du rapport
  const uploadProps: UploadProps = {
    name: 'rapport_analyse',
    multiple: false,
    fileList: fileList,
    beforeUpload: (file: RcFile) => {
      const isPDF = file.type === 'application/pdf';
      if (!isPDF) {
        messageApi.error('Seuls les fichiers PDF sont autorisés !');
        return false;
      }
      const isLt5M = file.size / 1024 / 1024 < 5;
      if (!isLt5M) {
        messageApi.error('Le fichier doit faire moins de 5MB !');
        return false;
      }
      setRapportFile(file);
      return false; // Empêche l'upload automatique
    },
    onRemove: () => {
      setRapportFile(null);
      setFileList([]);
    },
    onChange: (info) => {
      setFileList(info.fileList);
    }
  };

  // Confirmer le rejet avec upload du rapport
  const handleRejectConfirm = async (): Promise<void> => {
    if (!motifRefus.trim()) {
      showToast('Veuillez saisir un motif de refus', 'error');
      return;
    }
    
    if (!selectedMemoire) return;
    
    setUploading(true);
    setShowRejectModal(false);
    
    try {
      const userId = localStorage.getItem('user_id');
      const formData = new FormData();
      formData.append('motif_refus', motifRefus);
      formData.append('traite_par', userId || '');
      
      if (rapportFile) {
        formData.append('rapport_analyse', rapportFile);
      }

      const response = await fetch(`${API_URL}/api/memoire/${selectedMemoire.id}/rejeter`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });
      
      const data: ApiResponse = await response.json();
      
      if (data.success) {
        showToast(rapportFile ? 'Mémoire rejeté avec rapport d\'analyse' : 'Mémoire rejeté avec succès', 'success');
        setMotifRefus('');
        setRapportFile(null);
        setFileList([]);
        fetchMemoires();
      } else {
        showToast(data.message || 'Erreur lors du rejet', 'error');
      }
    } catch (error: any) {
      console.error('Erreur:', error);
      showToast(error.message || 'Erreur lors du rejet', 'error');
    } finally {
      setUploading(false);
      setSelectedMemoire(null);
    }
  };

  // Obtenir le tag de statut
  const getStatusTag = (statut: Memoire['statut']): React.ReactNode => {
    const statusConfig: Record<Memoire['statut'], { color: string; icon: React.ReactNode; label: string }> = {
      'en_attente': { color: 'gold', icon: <AlertCircle size={14} />, label: 'En attente' },
      'encours': { color: 'blue', icon: <PlayCircle size={14} />, label: 'En cours' },
      'valide': { color: 'green', icon: <CheckCircle size={14} />, label: 'Validé' },
      'rejete': { color: 'red', icon: <XCircle size={14} />, label: 'Rejeté' }
    };
    
    const config = statusConfig[statut];
    
    return (
      <Tag color={config.color} icon={config.icon} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {config.label}
      </Tag>
    );
  };

  // Colonnes du tableau
  const columns: ColumnsType<Memoire> = [
    {
      title: 'Étudiant',
      key: 'etudiant',
      width: 180,
      fixed: 'left',
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 500 }}>{record.nom} {record.prenoms}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.email}</Text>
        </div>
      )
    },
    {
      title: 'Matricule',
      dataIndex: 'matricule_iipea',
      key: 'matricule_iipea',
      width: 140,
      render: (matricule_iipea) => <code style={{ fontSize: 12 }}>{matricule_iipea}</code>
    },
    {
      title: 'Filière',
      key: 'filiere',
      width: 160,
      render: (_, record) => record.nom_filiere
    },
    {
      title: 'Niveau',
      key: 'niveau',
      width: 110,
      render: (_, record) => record.nom_niveau
    },
    {
      title: 'Thème',
      dataIndex: 'theme',
      key: 'theme',
      width: 300,
      ellipsis: true,
      render: (theme) => (
        <Tooltip title={theme}>
          <span>{theme}</span>
        </Tooltip>
      )
    },
    {
      title: 'Date dépôt',
      dataIndex: 'date_depot',
      key: 'date_depot',
      width: 110,
      render: (date) => new Date(date).toLocaleDateString('fr-FR')
    },
    {
      title: 'Statut',
      dataIndex: 'statut',
      key: 'statut',
      width: 130,
      render: (statut) => getStatusTag(statut)
    },
    {
      title: 'Agent',
      key: 'agent',
      width: 160,
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 500 }}>{record.agent_nom || 'Non assigné'}</div>
          {record.statut === 'encours' && record.traite_par && isAssignedToMe(record) && (
            <div style={{ fontSize: 11, color: '#52c41a' }}>● Vous êtes en charge</div>
          )}
          {record.rapport_analyse && (
            <div style={{ fontSize: 11, color: '#1890ff' }}>
              <FilePdfOutlined size={12} /> Rapport disponible
            </div>
          )}
        </div>
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 200,
      fixed: 'right',
      render: (_, record) => {
        const assignedToMe = isAssignedToMe(record);
        
        return (
          <Space size="small">
            <Tooltip title="Voir le PDF">
              <Button
                type="text"
                icon={<Eye size={16} />}
                onClick={() => handleViewPdf(record)}
                style={{ color: '#1890ff' }}
              />
            </Tooltip>
            
            <Tooltip title="Télécharger">
              <Button
                type="text"
                icon={<Download size={16} />}
                onClick={() => handleDownloadPdf(record)}
              />
            </Tooltip>

            {record.rapport_analyse && (
              <Tooltip title="Voir le rapport d'analyse">
                <Button
                  type="text"
                  icon={<FilePdfOutlined size={16} />}
                  onClick={() => handleViewRapport(record)}
                  style={{ color: '#faad14' }}
                />
              </Tooltip>
            )}
            
            {record.statut === 'en_attente' && (
              <Tooltip title="Commencer le traitement">
                <Button
                  type="text"
                  icon={<PlayCircle size={16} />}
                  onClick={() => handleStartTreatment(record)}
                  style={{ color: '#52c41a' }}
                />
              </Tooltip>
            )}
            
            {record.statut === 'encours' && (
              <>
                <Tooltip title={assignedToMe ? 'Valider' : 'Seul l\'agent en charge peut valider'}>
                  <Button
                    type="text"
                    icon={<CheckCircle size={16} />}
                    onClick={() => openValidateModal(record)}
                    style={{ 
                      color: assignedToMe ? '#52c41a' : '#d9d9d9',
                      cursor: assignedToMe ? 'pointer' : 'not-allowed'
                    }}
                    disabled={!assignedToMe}
                  />
                </Tooltip>
                
                <Tooltip title={assignedToMe ? 'Rejeter avec rapport' : 'Seul l\'agent en charge peut rejeter'}>
                  <Button
                    type="text"
                    icon={<XCircle size={16} />}
                    onClick={() => openRejectModal(record)}
                    style={{ 
                      color: assignedToMe ? '#ff4d4f' : '#d9d9d9',
                      cursor: assignedToMe ? 'pointer' : 'not-allowed'
                    }}
                    disabled={!assignedToMe}
                  />
                </Tooltip>
              </>
            )}
          </Space>
        );
      }
    }
  ];

  // Pagination des données
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return filteredMemoires.slice(start, end);
  }, [filteredMemoires, currentPage, pageSize]);

  // Charger les données au montage
  useEffect(() => {
    fetchMemoires();
  }, []);

  return (
    <div style={{ padding: 24, background: '#f0f2f5', minHeight: '100vh' }}>
      {contextHolder}
      
      {/* Header */}
      <Card style={{ marginBottom: 16, borderRadius: 8 }}>
        <Row justify="space-between" align="middle" gutter={[16, 16]}>
          <Col xs={24} sm={12}>
            <Title level={2} style={{ margin: 0 }}>Gestion des mémoires</Title>
            <Text type="secondary">Gérez les mémoires déposés par les étudiants</Text>
          </Col>
          <Col xs={24} sm={12} style={{ textAlign: 'right' }}>
            <Space wrap>
              <Dropdown menu={{ items: exportMenuItems }} placement="bottomRight">
                <Button icon={<FileSpreadsheet size={16} />} type="primary">
                  Exporter Excel
                </Button>
              </Dropdown>
              <Badge count={filteredMemoires.length} showZero color="#1890ff">
                <Button icon={<RefreshCw size={16} />} onClick={fetchMemoires}>
                  Actualiser
                </Button>
              </Badge>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Filtres */}
      <Card style={{ marginBottom: 16, borderRadius: 8 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={6}>
            <Input
              placeholder="Rechercher par nom, prénom ou matricule"
              prefix={<Search size={16} />}
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              allowClear
            />
          </Col>
          
          <Col xs={12} sm={6} md={3}>
            <Select
              placeholder="Niveau"
              value={filters.niveau || undefined}
              onChange={(value) => setFilters({ ...filters, niveau: value })}
              allowClear
              style={{ width: '100%' }}
            >
              {niveaux.map(niveau => (
                <Option key={niveau} value={niveau}>{niveau}</Option>
              ))}
            </Select>
          </Col>
          
          <Col xs={12} sm={6} md={4}>
            <Select
              placeholder="Filière"
              value={filters.filiere || undefined}
              onChange={(value) => setFilters({ ...filters, filiere: value })}
              allowClear
              style={{ width: '100%' }}
              showSearch
              filterOption={(input, option) => 
                (option?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase())
              }
            >
              {filieres.map(filiere => (
                <Option key={filiere} value={filiere}>{filiere}</Option>
              ))}
            </Select>
          </Col>
          
          <Col xs={12} sm={6} md={4}>
            <Select
              placeholder="Statut"
              value={filters.statut || undefined}
              onChange={(value) => setFilters({ ...filters, statut: value })}
              allowClear
              style={{ width: '100%' }}
            >
              {statuts.map(statut => (
                <Option key={statut.value} value={statut.value}>{statut.label}</Option>
              ))}
            </Select>
          </Col>
          
          <Col xs={12} sm={6} md={3}>
            <Button icon={<Filter size={16} />} onClick={resetFilters} style={{ width: '100%' }}>
              Réinitialiser
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Tableau des mémoires */}
      <Card style={{ borderRadius: 8 }}>
        <Spin spinning={loading}>
          <Table
            columns={columns}
            dataSource={paginatedData}
            rowKey="id"
            scroll={{ x: 1500 }}
            pagination={false}
            locale={{
              emptyText: (
                <div style={{ padding: 40, textAlign: 'center' }}>
                  <FileText size={48} style={{ color: '#bfbfbf', marginBottom: 16 }} />
                  <div>Aucun mémoire trouvé</div>
                </div>
              )
            }}
          />
          
          {/* Pagination performante */}
          {filteredMemoires.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, flexWrap: 'wrap', gap: 16 }}>
              <div>
                <Text type="secondary">
                  Affichage de {(currentPage - 1) * pageSize + 1} à {Math.min(currentPage * pageSize, filteredMemoires.length)} sur {filteredMemoires.length} mémoires
                </Text>
              </div>
              <div>
                <Space wrap>
                  <Select
                    value={pageSize}
                    onChange={(value) => {
                      setPageSize(value);
                      setCurrentPage(1);
                    }}
                    style={{ width: 110 }}
                  >
                    {pageSizeOptions.map(size => (
                      <Option key={size} value={size}>{size} / page</Option>
                    ))}
                  </Select>
                  <Pagination
                    current={currentPage}
                    total={filteredMemoires.length}
                    pageSize={pageSize}
                    onChange={(page) => setCurrentPage(page)}
                    showSizeChanger={false}
                    showQuickJumper
                    showTotal={(total) => `${total} total`}
                  />
                </Space>
              </div>
            </div>
          )}
        </Spin>
      </Card>

      {/* Modal de validation */}
      <Modal
        title={
          <Space>
            <CheckCircle size={20} style={{ color: '#52c41a' }} />
            <span>Validation du mémoire</span>
          </Space>
        }
        open={showValidateModal}
        onCancel={() => {
          setShowValidateModal(false);
          setSelectedMemoire(null);
          setRapportFile(null);
          setFileList([]);
        }}
        footer={[
          <Button key="cancel" onClick={() => {
            setShowValidateModal(false);
            setSelectedMemoire(null);
            setRapportFile(null);
            setFileList([]);
          }}>
            Annuler
          </Button>,
          <Button key="submit" type="primary" style={{ backgroundColor: '#52c41a' }} onClick={handleValidateConfirm} loading={uploading}>
            Valider
          </Button>
        ]}
        width={450}
      >
        <p style={{ fontSize: 16, marginBottom: 8 }}>
          Êtes-vous sûr de vouloir valider le mémoire de{' '}
          <strong>{selectedMemoire?.nom} {selectedMemoire?.prenoms}</strong> ?
        </p>
        <p style={{ color: '#666', marginTop: 8, marginBottom: 16 }}>
          Cette action est irréversible. Le mémoire sera marqué comme <strong>Validé</strong> et l'étudiant en sera informé.
        </p>

        <Form layout="vertical">
          <Form.Item label="Rapport d'analyse (optionnel)">
            <Upload {...uploadProps}>
              <Button icon={<UploadIcon size={16} />}>
                {rapportFile ? 'Changer le rapport' : 'Uploader le rapport d\'analyse'}
              </Button>
            </Upload>
            {rapportFile && (
              <div style={{ marginTop: 8 }}>
                <Tag color="blue">
                  <FilePdfOutlined size={14} /> {rapportFile.name}
                </Tag>
                <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
                  ({(rapportFile.size / 1024 / 1024).toFixed(2)} Mo)
                </Text>
              </div>
            )}
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
              Format PDF uniquement, taille max 5 Mo
            </Text>
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal de rejet avec upload du rapport */}
      <Modal
        title={
          <Space>
            <XCircle size={20} style={{ color: '#ff4d4f' }} />
            <span>Rejeter le mémoire</span>
          </Space>
        }
        open={showRejectModal}
        onCancel={() => {
          setShowRejectModal(false);
          setSelectedMemoire(null);
          setMotifRefus('');
          setRapportFile(null);
          setFileList([]);
        }}
        footer={[
          <Button key="cancel" onClick={() => {
            setShowRejectModal(false);
            setSelectedMemoire(null);
            setMotifRefus('');
            setRapportFile(null);
            setFileList([]);
          }}>
            Annuler
          </Button>,
          <Button key="submit" type="primary" danger onClick={handleRejectConfirm} loading={uploading}>
            Confirmer le rejet
          </Button>
        ]}
        width={550}
      >
        <p style={{ marginBottom: 16 }}>
          Êtes-vous sûr de vouloir rejeter le mémoire de{' '}
          <strong>{selectedMemoire?.nom} {selectedMemoire?.prenoms}</strong> ?
        </p>
        
        <Form layout="vertical">
          <Form.Item label="Motif du rejet" required>
            <TextArea
              rows={4}
              value={motifRefus}
              onChange={(e) => setMotifRefus(e.target.value)}
              placeholder="Ex: Taux de plagiat trop élevé, non validation par l'encadreur, corrections demandées..."
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              Ce motif sera visible par l'étudiant
            </Text>
          </Form.Item>

          <Form.Item label="Rapport d'analyse (optionnel)">
            <Upload {...uploadProps}>
              <Button icon={<UploadIcon size={16} />}>
                {rapportFile ? 'Changer le rapport' : 'Uploader le rapport d\'analyse'}
              </Button>
            </Upload>
            {rapportFile && (
              <div style={{ marginTop: 8 }}>
                <Tag color="blue">
                  <FilePdfOutlined size={14} /> {rapportFile.name}
                </Tag>
                <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
                  ({(rapportFile.size / 1024 / 1024).toFixed(2)} Mo)
                </Text>
              </div>
            )}
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
              Format PDF uniquement, taille max 5 Mo
            </Text>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default GesMemoire;