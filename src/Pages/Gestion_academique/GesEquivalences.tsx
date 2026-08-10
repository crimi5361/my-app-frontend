/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useMemo } from 'react';
import {
  Button,
  Input,
  Select,
  Space,
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
  DatePicker,
  Statistic,
  Empty,
  Drawer,
  Descriptions,
  Table,
  Timeline,
  Tag,
} from 'antd';
import DataTable from '../../Components/ui/DataTable';
import StatusTag, { type StatusTone } from '../../Components/ui/StatusTag';
import dayjs, { Dayjs } from 'dayjs';
import {
  Eye,
  PlayCircle,
  CheckCircle,
  XCircle,
  Ban,
  AlertCircle,
  AlertTriangle,
  Search,
  Filter,
  RefreshCw,
  FileSpreadsheet,
  CheckSquare,
  XSquare,
  FileText,
  Calendar,
  Mail,
  MessageSquarePlus,
  Download,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import type { ColumnsType } from 'antd/es/table';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = AntInput;
const { RangePicker } = DatePicker;

// ==================== INTERFACES ====================

type StatutDemande = 'en_attente' | 'dossier_incomplet' | 'en_etude' | 'valide' | 'refuse' | 'annule';

interface DemandeEquivalence {
  id: number;
  nom: string;
  prenoms: string;
  telephone: string;
  email: string;
  statut: StatutDemande;
  date_demande: string;
  date_traitement: string | null;
  traite_par: string | null;
  nom_filiere: string;
  nom_niveau: string;
}

interface DemandeDetailComplete extends DemandeEquivalence {
  sexe: string;
  date_naissance: string;
  lieu_naissance: string | null;
  nationalite: string;
  adresse: string | null;
  contact_parent: string | null;
  etablissement_origine: string | null;
  diplome_obtenu: string | null;
  annee_obtention_diplome: string | null;
  motif_refus: string | null;
  motif_complement: string | null;
  motif_annulation: string | null;
  code_suivi: string;
  etudiant_id: number | null;
  sigle_filiere?: string;
  agent_nom?: string | null;
  annee_academique?: string;
}

interface DocumentGroupeManquant {
  groupe: string;
  obligatoire: boolean;
  options: { code: string; libelle: string }[];
}
interface DocumentSimpleManquant {
  code: string;
  libelle: string;
  obligatoire: boolean;
}
type DocumentManquant = DocumentGroupeManquant | DocumentSimpleManquant;

interface DocumentEquivalence {
  id: number;
  type_document_id: number;
  code: string;
  libelle: string;
  obligatoire: boolean;
  fichier_path: string;
  storage_provider: string;
  statut_document: 'a_verifier' | 'conforme' | 'illisible';
  commentaire_verification: string | null;
  date_upload: string;
}

interface HistoriqueEvenement {
  type_evenement: string;
  statut_avant: string | null;
  statut_apres: string | null;
  date_evenement: string;
  detail: string | null;
  agent_nom: string | null;
}

interface DetailResponse {
  success: boolean;
  demande: DemandeDetailComplete;
  documents: DocumentEquivalence[];
  documents_manquants: DocumentManquant[];
  historique: HistoriqueEvenement[];
  message?: string;
}

interface Filters {
  niveau: string;
  filiere: string;
  statut: string;
  search: string;
  dateDebut: string | null;
  dateFin: string | null;
}

interface AnneeAcademique {
  id: number;
  annee: string;
  etat: string | null;
}

interface ApiListResponse {
  success: boolean;
  message?: string;
  demandes?: DemandeEquivalence[];
}

interface ApiActionResponse {
  success: boolean;
  message?: string;
  data?: { etudiant_id?: number; matricule_iipea?: string };
}

// ==================== CONSTANTES ====================

const STATUT_LABELS: Record<StatutDemande, string> = {
  en_attente: 'En attente',
  dossier_incomplet: 'Dossier incomplet',
  en_etude: 'En étude',
  valide: 'Validé',
  refuse: 'Refusé',
  annule: 'Annulé',
};

// Couleurs des graphiques — 6 valeurs distinctes (le dashboard a besoin de plus de nuances que
// les 5 tons de StatusTag, réutilisé tel quel pour les badges du tableau).
const STATUT_CHART_COLORS: Record<StatutDemande, string> = {
  en_attente: '#b7791f',
  dossier_incomplet: '#d97706',
  en_etude: '#101a33',
  valide: '#1e8e5a',
  refuse: '#c0392b',
  annule: '#6b7280',
};

const STATUT_TAG_CONFIG: Record<StatutDemande, { tone: StatusTone; icon: React.ReactNode }> = {
  en_attente: { tone: 'warning', icon: <AlertCircle size={14} /> },
  dossier_incomplet: { tone: 'danger', icon: <AlertTriangle size={14} /> },
  en_etude: { tone: 'info', icon: <PlayCircle size={14} /> },
  valide: { tone: 'success', icon: <CheckCircle size={14} /> },
  refuse: { tone: 'danger', icon: <XCircle size={14} /> },
  annule: { tone: 'neutral', icon: <Ban size={14} /> },
};

const EVENEMENT_LABELS: Record<string, string> = {
  creation: 'Demande créée',
  document_ajoute: 'Pièce ajoutée par le candidat',
  document_modifie: 'Pièce remplacée par le candidat',
  document_verifie: 'Pièce vérifiée par l\'agent',
  prise_en_charge: 'Dossier pris en charge',
  demande_complement: 'Complément demandé au candidat',
  complement_recu: 'Complément reçu — retour à l\'étude',
  validation: 'Demande validée',
  refus: 'Demande refusée',
  annulation: 'Demande annulée',
  dossier_candidat_cree: 'Dossier candidat créé',
  fiche_generee: 'Fiche d\'inscription générée',
  mail_envoye: 'E-mail envoyé',
  mail_echec: 'Échec d\'envoi d\'e-mail',
};

const EVENEMENT_COLOR: Record<string, string> = {
  validation: 'green',
  refus: 'red',
  annulation: 'gray',
  demande_complement: 'orange',
  mail_echec: 'red',
  prise_en_charge: 'blue',
};

// ==================== COMPOSANT PRINCIPAL ====================

const GesEquivalences: React.FC = () => {
  const API_URL = import.meta.env.VITE_API_URL_SERVER || '';

  const [demandes, setDemandes] = useState<DemandeEquivalence[]>([]);
  const [filteredDemandes, setFilteredDemandes] = useState<DemandeEquivalence[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [messageApi, contextHolder] = message.useMessage();

  const [filters, setFilters] = useState<Filters>({
    niveau: '', filiere: '', statut: '', search: '', dateDebut: null, dateFin: null,
  });

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);
  const pageSizeOptions = [10, 20, 50, 100, 200, 500];

  const [filieres, setFilieres] = useState<string[]>([]);
  const [niveaux, setNiveaux] = useState<string[]>([]);

  const [departementId] = useState<number | null>(() => {
    try {
      const userStr = localStorage.getItem('user');
      return userStr ? JSON.parse(userStr)?.departement_id ?? null : null;
    } catch { return null; }
  });
  const [annees, setAnnees] = useState<AnneeAcademique[]>([]);
  const [selectedAnneeId, setSelectedAnneeId] = useState<number | null>(null);

  const statuts: { value: StatutDemande; label: string }[] = (Object.keys(STATUT_LABELS) as StatutDemande[])
    .map((value) => ({ value, label: STATUT_LABELS[value] }));

  // Panneau de détail
  const [detailOpen, setDetailOpen] = useState<boolean>(false);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [detail, setDetail] = useState<DetailResponse | null>(null);

  // Modals d'action (motif requis)
  const [actionTargetId, setActionTargetId] = useState<number | null>(null);
  const [showComplementModal, setShowComplementModal] = useState<boolean>(false);
  const [motifComplement, setMotifComplement] = useState<string>('');
  const [showValidateModal, setShowValidateModal] = useState<boolean>(false);
  const [showRejectModal, setShowRejectModal] = useState<boolean>(false);
  const [motifRefus, setMotifRefus] = useState<string>('');
  const [showAnnulerModal, setShowAnnulerModal] = useState<boolean>(false);
  const [motifAnnulation, setMotifAnnulation] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  const getHeaders = () => ({
    'Authorization': `Bearer ${localStorage.getItem('token')}`,
    'Content-Type': 'application/json',
  });

  const showToast = (msg: string, type: 'success' | 'error'): void => {
    if (type === 'success') messageApi.success(msg); else messageApi.error(msg);
  };

  // ==================== CHARGEMENT ====================

  const fetchDemandes = async (): Promise<void> => {
    if (!selectedAnneeId) return;
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/equivalence?annee_academique_id=${selectedAnneeId}`, { headers: getHeaders() });
      if (!response.ok) throw new Error('Erreur lors du chargement');
      const data: ApiListResponse = await response.json();
      const demandesData = data.demandes || [];
      setDemandes(demandesData);
      setFilteredDemandes(demandesData);

      const uniqueFilieres = [...new Set(demandesData.map((d) => d.nom_filiere).filter(Boolean))] as string[];
      setFilieres(uniqueFilieres);
      const uniqueNiveaux = [...new Set(demandesData.map((d) => d.nom_niveau).filter(Boolean))] as string[];
      uniqueNiveaux.sort((a, b) => a.localeCompare(b));
      setNiveaux(uniqueNiveaux);
    } catch (error) {
      console.error('Erreur:', error);
      showToast('Erreur lors du chargement des demandes', 'error');
    } finally {
      setLoading(false);
    }
  };

  const appliedFilters = useMemo(() => {
    let filtered = [...demandes];
    if (filters.niveau) filtered = filtered.filter((d) => d.nom_niveau?.toUpperCase() === filters.niveau.toUpperCase());
    if (filters.filiere) filtered = filtered.filter((d) => d.nom_filiere === filters.filiere);
    if (filters.statut) filtered = filtered.filter((d) => d.statut === filters.statut);
    if (filters.dateDebut) {
      const debut = dayjs(filters.dateDebut).startOf('day');
      filtered = filtered.filter((d) => d.date_demande && !dayjs(d.date_demande).isBefore(debut));
    }
    if (filters.dateFin) {
      const fin = dayjs(filters.dateFin).endOf('day');
      filtered = filtered.filter((d) => d.date_demande && !dayjs(d.date_demande).isAfter(fin));
    }
    if (filters.search) {
      const term = filters.search.toLowerCase();
      filtered = filtered.filter((d) =>
        d.nom?.toLowerCase().includes(term) ||
        d.prenoms?.toLowerCase().includes(term) ||
        d.email?.toLowerCase().includes(term)
      );
    }
    return filtered;
  }, [demandes, filters]);

  useEffect(() => {
    setFilteredDemandes(appliedFilters);
    setCurrentPage(1);
  }, [appliedFilters]);

  const resetFilters = (): void => {
    setFilters({ niveau: '', filiere: '', statut: '', search: '', dateDebut: null, dateFin: null });
  };

  useEffect(() => {
    if (!departementId) return;
    fetch(`${API_URL}/api/annees?site_id=${departementId}`, { headers: getHeaders() })
      .then((res) => res.json())
      .then((data: AnneeAcademique[]) => {
        const liste = data || [];
        setAnnees(liste);
        const anneeCourante = liste.find((a) => a.etat === 'en cour');
        setSelectedAnneeId((anneeCourante || liste[0])?.id ?? null);
      })
      .catch((err) => console.error('Erreur lors du chargement des années académiques:', err));
  }, [departementId]);

  useEffect(() => {
    fetchDemandes();
  }, [selectedAnneeId]);

  // ==================== DASHBOARD DE PILOTAGE ====================

  const dashboardStats = useMemo(() => {
    const total = demandes.length;
    const compteStatut: Record<StatutDemande, number> = {
      en_attente: 0, dossier_incomplet: 0, en_etude: 0, valide: 0, refuse: 0, annule: 0,
    };
    const niveauMap = new Map<string, number>();

    demandes.forEach((d) => {
      compteStatut[d.statut] = (compteStatut[d.statut] || 0) + 1;
      const niveau = d.nom_niveau || 'Non renseigné';
      niveauMap.set(niveau, (niveauMap.get(niveau) || 0) + 1);
    });

    const parNiveau = Array.from(niveauMap, ([niveau, total]) => ({ niveau, total })).sort((a, b) => b.total - a.total);
    const parStatut = (Object.keys(compteStatut) as StatutDemande[])
      .map((statut) => ({ statut, label: STATUT_LABELS[statut], total: compteStatut[statut], color: STATUT_CHART_COLORS[statut] }))
      .filter((s) => s.total > 0);

    return { total, compteStatut, parNiveau, parStatut };
  }, [demandes]);

  // "Cette année académique" — indicateur fixe, indépendant du sélecteur d'année de la page,
  // même mécanisme que le dashboard Mémoires.
  const anneeEnCours = annees.find((a) => a.etat === 'en cour') || null;
  const [anneeEnCoursCount, setAnneeEnCoursCount] = useState<number | null>(null);
  const [loadingAnneeEnCours, setLoadingAnneeEnCours] = useState<boolean>(false);

  useEffect(() => {
    if (!anneeEnCours) { setAnneeEnCoursCount(null); return; }
    if (anneeEnCours.id === selectedAnneeId) { setAnneeEnCoursCount(demandes.length); return; }
    setLoadingAnneeEnCours(true);
    fetch(`${API_URL}/api/equivalence?annee_academique_id=${anneeEnCours.id}`, { headers: getHeaders() })
      .then((res) => res.json())
      .then((data: ApiListResponse) => setAnneeEnCoursCount((data.demandes || []).length))
      .catch(() => setAnneeEnCoursCount(null))
      .finally(() => setLoadingAnneeEnCours(false));
  }, [anneeEnCours?.id, selectedAnneeId, demandes]);

  // ==================== DÉTAIL / HISTORIQUE ====================

  const isAssignedToMe = (traitePar: string | null): boolean => {
    const userId = localStorage.getItem('user_id');
    if (!userId || !traitePar) return false;
    return String(traitePar).trim() === String(userId).trim();
  };

  const openDetail = async (id: number): Promise<void> => {
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/equivalence/${id}`, { headers: getHeaders() });
      const data: DetailResponse = await res.json();
      if (data.success) setDetail(data);
      else showToast(data.message || 'Erreur lors du chargement du dossier', 'error');
    } catch (error) {
      console.error('Erreur:', error);
      showToast('Erreur de connexion au serveur', 'error');
    } finally {
      setDetailLoading(false);
    }
  };

  const refreshAfterAction = (id: number) => {
    fetchDemandes();
    if (detailOpen) openDetail(id);
  };

  // ==================== ACTIONS ====================

  const handlePrendreEnCharge = async (id: number): Promise<void> => {
    try {
      const res = await fetch(`${API_URL}/api/equivalence/${id}/prendre-en-charge`, { method: 'PUT', headers: getHeaders() });
      const data: ApiActionResponse = await res.json();
      if (data.success) { showToast('Dossier pris en charge', 'success'); refreshAfterAction(id); }
      else showToast(data.message || 'Erreur lors de la prise en charge', 'error');
    } catch (error: any) {
      showToast(error.message || 'Erreur de connexion au serveur', 'error');
    }
  };

  const openComplementModal = (id: number): void => {
    setActionTargetId(id);
    setMotifComplement('');
    setShowComplementModal(true);
  };

  const handleComplementConfirm = async (): Promise<void> => {
    if (!motifComplement.trim()) { showToast('Veuillez saisir le motif du complément demandé', 'error'); return; }
    if (!actionTargetId) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/equivalence/${actionTargetId}/demander-complement`, {
        method: 'PUT', headers: getHeaders(), body: JSON.stringify({ motif_complement: motifComplement }),
      });
      const data: ApiActionResponse = await res.json();
      if (data.success) {
        showToast('Demande de complément envoyée au candidat', 'success');
        setShowComplementModal(false);
        refreshAfterAction(actionTargetId);
      } else showToast(data.message || 'Erreur', 'error');
    } catch (error: any) {
      showToast(error.message || 'Erreur de connexion au serveur', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const openValidateModal = (id: number, traitePar: string | null): void => {
    if (!isAssignedToMe(traitePar)) {
      showToast('Seul l\'agent en charge de ce dossier peut le valider.', 'error');
      return;
    }
    setActionTargetId(id);
    setShowValidateModal(true);
  };

  const handleValidateConfirm = async (): Promise<void> => {
    if (!actionTargetId) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/equivalence/${actionTargetId}/valider`, { method: 'PUT', headers: getHeaders() });
      const data: ApiActionResponse = await res.json();
      if (data.success) {
        showToast(`Demande validée — matricule ${data.data?.matricule_iipea || ''}`, 'success');
        setShowValidateModal(false);
        refreshAfterAction(actionTargetId);
      } else showToast(data.message || 'Erreur lors de la validation', 'error');
    } catch (error: any) {
      showToast(error.message || 'Erreur de connexion au serveur', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const openRejectModal = (id: number, traitePar: string | null): void => {
    if (!isAssignedToMe(traitePar)) {
      showToast('Seul l\'agent en charge de ce dossier peut le refuser.', 'error');
      return;
    }
    setActionTargetId(id);
    setMotifRefus('');
    setShowRejectModal(true);
  };

  const handleRejectConfirm = async (): Promise<void> => {
    if (!motifRefus.trim()) { showToast('Veuillez saisir le motif du refus', 'error'); return; }
    if (!actionTargetId) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/equivalence/${actionTargetId}/rejeter`, {
        method: 'PUT', headers: getHeaders(), body: JSON.stringify({ motif_refus: motifRefus }),
      });
      const data: ApiActionResponse = await res.json();
      if (data.success) {
        showToast('Demande refusée', 'success');
        setShowRejectModal(false);
        refreshAfterAction(actionTargetId);
      } else showToast(data.message || 'Erreur lors du refus', 'error');
    } catch (error: any) {
      showToast(error.message || 'Erreur de connexion au serveur', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const openAnnulerModal = (id: number): void => {
    setActionTargetId(id);
    setMotifAnnulation('');
    setShowAnnulerModal(true);
  };

  const handleAnnulerConfirm = async (): Promise<void> => {
    if (!motifAnnulation.trim()) { showToast('Veuillez saisir le motif de l\'annulation', 'error'); return; }
    if (!actionTargetId) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/equivalence/${actionTargetId}/annuler`, {
        method: 'PUT', headers: getHeaders(), body: JSON.stringify({ motif_annulation: motifAnnulation }),
      });
      const data: ApiActionResponse = await res.json();
      if (data.success) {
        showToast('Demande annulée', 'success');
        setShowAnnulerModal(false);
        refreshAfterAction(actionTargetId);
      } else showToast(data.message || 'Erreur lors de l\'annulation', 'error');
    } catch (error: any) {
      showToast(error.message || 'Erreur de connexion au serveur', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRenvoyerEmail = async (id: number): Promise<void> => {
    try {
      const res = await fetch(`${API_URL}/api/equivalence/${id}/renvoyer-email`, { method: 'POST', headers: getHeaders() });
      const data: ApiActionResponse = await res.json();
      if (data.success) { showToast('E-mail renvoyé', 'success'); refreshAfterAction(id); }
      else showToast(data.message || 'Échec de l\'envoi de l\'e-mail', 'error');
    } catch (error: any) {
      showToast(error.message || 'Erreur de connexion au serveur', 'error');
    }
  };

  const handleMarquerDocument = async (documentId: number, statut: 'conforme' | 'illisible'): Promise<void> => {
    if (!detail) return;
    try {
      const res = await fetch(`${API_URL}/api/equivalence/${detail.demande.id}/documents/${documentId}/statut`, {
        method: 'PUT', headers: getHeaders(), body: JSON.stringify({ statut }),
      });
      const data: ApiActionResponse = await res.json();
      if (data.success) { showToast('Statut du document mis à jour', 'success'); openDetail(detail.demande.id); }
      else showToast(data.message || 'Erreur', 'error');
    } catch (error: any) {
      showToast(error.message || 'Erreur de connexion au serveur', 'error');
    }
  };

  // ==================== EXPORT EXCEL ====================

  const prepareExportData = (liste: DemandeEquivalence[]) => liste.map((d) => ({
    'Nom': d.nom, 'Prénoms': d.prenoms, 'Téléphone': d.telephone, 'Email': d.email,
    'Filière demandée': d.nom_filiere, 'Niveau demandé': d.nom_niveau,
    'Date': d.date_demande ? new Date(d.date_demande).toLocaleDateString('fr-FR') : '',
    'Statut': STATUT_LABELS[d.statut],
  }));

  const exportToExcel = (data: any[], filename: string): void => {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Equivalences');
    const colWidths = Object.keys(data[0] || {}).map(() => ({ wch: 22 }));
    worksheet['!cols'] = colWidths;
    XLSX.writeFile(workbook, `${filename}.xlsx`);
    showToast(`Export de ${data.length} demande(s) réussi`, 'success');
  };

  const exportAll = (): void => {
    if (filteredDemandes.length === 0) { showToast('Aucune demande à exporter', 'error'); return; }
    exportToExcel(prepareExportData(filteredDemandes), `equivalences_${new Date().toISOString().split('T')[0]}`);
  };
  const exportValidees = (): void => {
    const data = filteredDemandes.filter((d) => d.statut === 'valide');
    if (data.length === 0) { showToast('Aucune demande validée à exporter', 'error'); return; }
    exportToExcel(prepareExportData(data), `equivalences_validees_${new Date().toISOString().split('T')[0]}`);
  };
  const exportRefusees = (): void => {
    const data = filteredDemandes.filter((d) => d.statut === 'refuse');
    if (data.length === 0) { showToast('Aucune demande refusée à exporter', 'error'); return; }
    exportToExcel(prepareExportData(data), `equivalences_refusees_${new Date().toISOString().split('T')[0]}`);
  };

  const exportMenuItems: MenuProps['items'] = [
    { key: 'all', label: 'Toutes les demandes', icon: <FileSpreadsheet size={16} />, onClick: exportAll },
    { key: 'valide', label: 'Demandes validées', icon: <CheckSquare size={16} />, onClick: exportValidees },
    { key: 'refuse', label: 'Demandes refusées', icon: <XSquare size={16} />, onClick: exportRefusees },
  ];

  // ==================== TABLEAU ====================

  const columns: ColumnsType<DemandeEquivalence> = [
    {
      title: 'Candidat',
      key: 'candidat',
      width: 200,
      fixed: 'left',
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 500 }}>{record.nom} {record.prenoms}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.email}</Text>
        </div>
      ),
    },
    { title: 'Filière demandée', dataIndex: 'nom_filiere', key: 'nom_filiere', width: 200 },
    { title: 'Niveau demandé', dataIndex: 'nom_niveau', key: 'nom_niveau', width: 140 },
    {
      title: 'Date',
      dataIndex: 'date_demande',
      key: 'date_demande',
      width: 110,
      render: (date) => new Date(date).toLocaleDateString('fr-FR'),
    },
    {
      title: 'Statut',
      dataIndex: 'statut',
      key: 'statut',
      width: 160,
      render: (statut: StatutDemande) => (
        <StatusTag tone={STATUT_TAG_CONFIG[statut].tone} icon={STATUT_TAG_CONFIG[statut].icon} label={STATUT_LABELS[statut]} />
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 200,
      fixed: 'right',
      render: (_, record) => {
        const assignedToMe = isAssignedToMe(record.traite_par);
        return (
          <Space size="small">
            <Tooltip title="Voir le dossier">
              <Button type="text" icon={<Eye size={16} />} onClick={() => openDetail(record.id)} style={{ color: 'var(--mod-scolarite)' }} />
            </Tooltip>
            {record.statut === 'en_attente' && (
              <Tooltip title="Prendre en charge">
                <Button type="text" icon={<PlayCircle size={16} />} onClick={() => handlePrendreEnCharge(record.id)} style={{ color: 'var(--success)' }} />
              </Tooltip>
            )}
            {record.statut === 'en_etude' && (
              <>
                <Tooltip title={assignedToMe ? 'Valider' : 'Seul l\'agent en charge peut valider'}>
                  <Button
                    type="text" icon={<CheckCircle size={16} />} onClick={() => openValidateModal(record.id, record.traite_par)}
                    style={{ color: assignedToMe ? 'var(--success)' : 'var(--mist)' }} disabled={!assignedToMe}
                  />
                </Tooltip>
                <Tooltip title={assignedToMe ? 'Refuser' : 'Seul l\'agent en charge peut refuser'}>
                  <Button
                    type="text" icon={<XCircle size={16} />} onClick={() => openRejectModal(record.id, record.traite_par)}
                    style={{ color: assignedToMe ? 'var(--danger)' : 'var(--mist)' }} disabled={!assignedToMe}
                  />
                </Tooltip>
              </>
            )}
          </Space>
        );
      },
    },
  ];

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredDemandes.slice(start, start + pageSize);
  }, [filteredDemandes, currentPage, pageSize]);

  // ==================== RENDU DES PIÈCES (détail) ====================

  const documentColumns: ColumnsType<DocumentEquivalence> = [
    { title: 'Pièce', dataIndex: 'libelle', key: 'libelle' },
    {
      title: 'Statut',
      dataIndex: 'statut_document',
      key: 'statut_document',
      width: 140,
      render: (statut: DocumentEquivalence['statut_document']) => {
        if (statut === 'conforme') return <StatusTag tone="success" icon={<CheckCircle size={14} />} label="Conforme" />;
        if (statut === 'illisible') return <StatusTag tone="danger" icon={<XCircle size={14} />} label="Illisible" />;
        return <StatusTag tone="neutral" icon={<AlertCircle size={14} />} label="À vérifier" />;
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 180,
      render: (_, doc) => (
        <Space size="small">
          <Tooltip title="Voir / télécharger">
            <Button
              type="text" icon={<Download size={16} />}
              onClick={() => window.open(doc.storage_provider === 'drive' ? doc.fichier_path : `${API_URL}${doc.fichier_path}`, '_blank')}
            />
          </Tooltip>
          <Tooltip title="Marquer conforme">
            <Button type="text" icon={<CheckCircle size={16} />} style={{ color: 'var(--success)' }} onClick={() => handleMarquerDocument(doc.id, 'conforme')} />
          </Tooltip>
          <Tooltip title="Marquer illisible">
            <Button type="text" icon={<XCircle size={16} />} style={{ color: 'var(--danger)' }} onClick={() => handleMarquerDocument(doc.id, 'illisible')} />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const renderDocumentManquant = (m: DocumentManquant, idx: number) => {
    if ('groupe' in m) {
      return (
        <Tag key={idx} color={m.obligatoire ? 'red' : 'default'} style={{ marginBottom: 6 }}>
          {m.obligatoire ? 'Obligatoire' : 'Facultatif'} — au moins un parmi : {m.options.map((o) => o.libelle).join(', ')}
        </Tag>
      );
    }
    return (
      <Tag key={idx} color={m.obligatoire ? 'red' : 'default'} style={{ marginBottom: 6 }}>
        {m.obligatoire ? 'Manquant' : 'Non fourni (facultatif)'} — {m.libelle}
      </Tag>
    );
  };

  // ==================== RENDU ====================

  return (
    <div style={{ padding: 24, background: 'var(--paper)', minHeight: '100vh' }}>
      {contextHolder}

      {/* Header */}
      <Card style={{ marginBottom: 16, borderRadius: 8 }}>
        <Row justify="space-between" align="middle" gutter={[16, 16]}>
          <Col xs={24} sm={12}>
            <Title level={2} style={{ margin: 0 }}>Gestion des équivalences</Title>
            <Text type="secondary">Traitez les demandes d'équivalence déposées depuis le portail public</Text>
          </Col>
          <Col xs={24} sm={12} style={{ textAlign: 'right' }}>
            <Space wrap>
              <Dropdown menu={{ items: exportMenuItems }} placement="bottomRight">
                <Button icon={<FileSpreadsheet size={16} />} type="primary">Exporter Excel</Button>
              </Dropdown>
              <Badge count={filteredDemandes.length} showZero color="var(--mod-scolarite)">
                <Button icon={<RefreshCw size={16} />} onClick={fetchDemandes}>Actualiser</Button>
              </Badge>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Dashboard de pilotage */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} md={8}>
          <Card loading={loading} style={{ borderRadius: 8 }}>
            <Statistic title="Total des demandes" value={dashboardStats.total} prefix={<FileText size={18} style={{ color: 'var(--mod-scolarite)' }} />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card loading={loading} style={{ borderRadius: 8 }}>
            <Statistic title="En attente" value={dashboardStats.compteStatut.en_attente} prefix={<AlertCircle size={18} style={{ color: 'var(--warning)' }} />} valueStyle={{ color: 'var(--warning)' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card loading={loading || loadingAnneeEnCours} style={{ borderRadius: 8 }}>
            <Statistic
              title={anneeEnCours ? `Cette année — ${anneeEnCours.annee}` : 'Année académique en cours'}
              value={anneeEnCoursCount ?? 0}
              prefix={<Calendar size={18} style={{ color: 'var(--mod-scolarite)' }} />}
            />
            {!anneeEnCours && <Text type="secondary" style={{ fontSize: 12 }}>Aucune année en cours pour ce site</Text>}
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card loading={loading} style={{ borderRadius: 8 }}>
            <Statistic title="Validées" value={dashboardStats.compteStatut.valide} prefix={<CheckCircle size={18} style={{ color: 'var(--success)' }} />} valueStyle={{ color: 'var(--success)' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card loading={loading} style={{ borderRadius: 8 }}>
            <Statistic title="Refusées" value={dashboardStats.compteStatut.refuse} prefix={<XCircle size={18} style={{ color: 'var(--danger)' }} />} valueStyle={{ color: 'var(--danger)' }} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={14}>
          <Card title="Répartition par niveau" loading={loading} style={{ borderRadius: 8, height: 340 }}>
            {dashboardStats.parNiveau.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={dashboardStats.parNiveau}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="niveau" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={60} />
                  <YAxis allowDecimals={false} />
                  <RechartsTooltip />
                  <Bar dataKey="total" name="Demandes" fill="var(--mod-scolarite)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <Empty description="Aucune donnée" style={{ marginTop: 60 }} />}
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title="Répartition par statut" loading={loading} style={{ borderRadius: 8, height: 340 }}>
            {dashboardStats.parStatut.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={dashboardStats.parStatut} dataKey="total" nameKey="label" innerRadius={55} outerRadius={85} paddingAngle={2}>
                    {dashboardStats.parStatut.map((entry) => <Cell key={entry.statut} fill={entry.color} />)}
                  </Pie>
                  <RechartsTooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : <Empty description="Aucune donnée" style={{ marginTop: 60 }} />}
          </Card>
        </Col>
      </Row>

      {/* Filtres */}
      <Card style={{ marginBottom: 16, borderRadius: 8 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={5}>
            <Input
              placeholder="Rechercher par nom, prénom ou email"
              prefix={<Search size={16} />}
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              allowClear
            />
          </Col>
          <Col xs={12} sm={6} md={3}>
            <Select placeholder="Année académique" value={selectedAnneeId ?? undefined} onChange={(v) => setSelectedAnneeId(v)} style={{ width: '100%' }} loading={annees.length === 0}>
              {annees.map((a) => <Option key={a.id} value={a.id}>{a.annee} ({a.etat})</Option>)}
            </Select>
          </Col>
          <Col xs={12} sm={6} md={3}>
            <Select placeholder="Niveau" value={filters.niveau || undefined} onChange={(v) => setFilters({ ...filters, niveau: v })} allowClear style={{ width: '100%' }}>
              {niveaux.map((n) => <Option key={n} value={n}>{n}</Option>)}
            </Select>
          </Col>
          <Col xs={12} sm={6} md={4}>
            <Select
              placeholder="Filière" value={filters.filiere || undefined} onChange={(v) => setFilters({ ...filters, filiere: v })} allowClear style={{ width: '100%' }}
              showSearch filterOption={(input, option) => (option?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase())}
            >
              {filieres.map((f) => <Option key={f} value={f}>{f}</Option>)}
            </Select>
          </Col>
          <Col xs={12} sm={6} md={3}>
            <Select placeholder="Statut" value={filters.statut || undefined} onChange={(v) => setFilters({ ...filters, statut: v })} allowClear style={{ width: '100%' }}>
              {statuts.map((s) => <Option key={s.value} value={s.value}>{s.label}</Option>)}
            </Select>
          </Col>
          <Col xs={24} sm={12} md={4}>
            <RangePicker
              placeholder={['Date début', 'Date fin']}
              format="DD/MM/YYYY"
              style={{ width: '100%' }}
              value={[filters.dateDebut ? dayjs(filters.dateDebut) : null, filters.dateFin ? dayjs(filters.dateFin) : null] as [Dayjs | null, Dayjs | null]}
              onChange={(dates) => setFilters({
                ...filters,
                dateDebut: dates && dates[0] ? dates[0].format('YYYY-MM-DD') : null,
                dateFin: dates && dates[1] ? dates[1].format('YYYY-MM-DD') : null,
              })}
              allowClear
            />
          </Col>
          <Col xs={12} sm={6} md={2}>
            <Button icon={<Filter size={16} />} onClick={resetFilters} style={{ width: '100%' }}>Réinit.</Button>
          </Col>
        </Row>
      </Card>

      {/* Tableau */}
      <Card style={{ borderRadius: 8 }}>
        <Spin spinning={loading}>
          <DataTable<DemandeEquivalence>
            columns={columns}
            dataSource={paginatedData}
            rowKey="id"
            scroll={{ x: 1100 }}
            pagination={false}
            emptyTitle="Aucune demande trouvée"
          />
          {filteredDemandes.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, flexWrap: 'wrap', gap: 16 }}>
              <Text type="secondary">
                Affichage de {(currentPage - 1) * pageSize + 1} à {Math.min(currentPage * pageSize, filteredDemandes.length)} sur {filteredDemandes.length} demandes
              </Text>
              <Space wrap>
                <Select value={pageSize} onChange={(v) => { setPageSize(v); setCurrentPage(1); }} style={{ width: 110 }}>
                  {pageSizeOptions.map((size) => <Option key={size} value={size}>{size} / page</Option>)}
                </Select>
                <Pagination current={currentPage} total={filteredDemandes.length} pageSize={pageSize} onChange={(p) => setCurrentPage(p)} showSizeChanger={false} showQuickJumper showTotal={(t) => `${t} total`} />
              </Space>
            </div>
          )}
        </Spin>
      </Card>

      {/* Panneau de détail */}
      <Drawer
        title={detail ? `${detail.demande.nom} ${detail.demande.prenoms}` : 'Dossier'}
        open={detailOpen}
        onClose={() => { setDetailOpen(false); setDetail(null); }}
        width={720}
        extra={detail && (
          <StatusTag tone={STATUT_TAG_CONFIG[detail.demande.statut].tone} icon={STATUT_TAG_CONFIG[detail.demande.statut].icon} label={STATUT_LABELS[detail.demande.statut]} />
        )}
      >
        <Spin spinning={detailLoading}>
          {detail && (
            <>
              <Descriptions title="Identité" column={2} size="small" bordered style={{ marginBottom: 24 }}>
                <Descriptions.Item label="Sexe">{detail.demande.sexe}</Descriptions.Item>
                <Descriptions.Item label="Date de naissance">{detail.demande.date_naissance ? new Date(detail.demande.date_naissance).toLocaleDateString('fr-FR') : '-'}</Descriptions.Item>
                <Descriptions.Item label="Nationalité">{detail.demande.nationalite}</Descriptions.Item>
                <Descriptions.Item label="Téléphone">{detail.demande.telephone}</Descriptions.Item>
                <Descriptions.Item label="Email" span={2}>{detail.demande.email}</Descriptions.Item>
                <Descriptions.Item label="Adresse" span={2}>{detail.demande.adresse || '-'}</Descriptions.Item>
              </Descriptions>

              <Descriptions title="Formation demandée" column={2} size="small" bordered style={{ marginBottom: 24 }}>
                <Descriptions.Item label="Filière">{detail.demande.nom_filiere} {detail.demande.sigle_filiere ? `(${detail.demande.sigle_filiere})` : ''}</Descriptions.Item>
                <Descriptions.Item label="Niveau">{detail.demande.nom_niveau}</Descriptions.Item>
                <Descriptions.Item label="Année académique" span={2}>{detail.demande.annee_academique}</Descriptions.Item>
              </Descriptions>

              <Descriptions title="Parcours antérieur" column={1} size="small" bordered style={{ marginBottom: 24 }}>
                <Descriptions.Item label="Établissement d'origine">{detail.demande.etablissement_origine || '-'}</Descriptions.Item>
                <Descriptions.Item label="Diplôme obtenu">{detail.demande.diplome_obtenu || '-'} {detail.demande.annee_obtention_diplome ? `(${detail.demande.annee_obtention_diplome})` : ''}</Descriptions.Item>
              </Descriptions>

              {detail.demande.motif_complement && detail.demande.statut === 'dossier_incomplet' && (
                <Card size="small" style={{ marginBottom: 16, background: '#fbf1de', borderColor: '#eed7ab' }}>
                  <Text strong>Complément demandé : </Text>{detail.demande.motif_complement}
                </Card>
              )}
              {detail.demande.motif_refus && detail.demande.statut === 'refuse' && (
                <Card size="small" style={{ marginBottom: 16, background: '#fbeae8', borderColor: '#f0c3bd' }}>
                  <Text strong>Motif du refus : </Text>{detail.demande.motif_refus}
                </Card>
              )}
              {detail.demande.motif_annulation && detail.demande.statut === 'annule' && (
                <Card size="small" style={{ marginBottom: 16 }}>
                  <Text strong>Motif de l'annulation : </Text>{detail.demande.motif_annulation}
                </Card>
              )}

              <Title level={5}>Pièces justificatives</Title>
              <Table<DocumentEquivalence>
                columns={documentColumns}
                dataSource={detail.documents}
                rowKey="id"
                pagination={false}
                size="small"
                style={{ marginBottom: 12 }}
              />
              {detail.documents_manquants.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  {detail.documents_manquants.map(renderDocumentManquant)}
                </div>
              )}

              <Title level={5}>Historique</Title>
              <Timeline
                style={{ marginBottom: 24, marginTop: 16 }}
                items={detail.historique.map((h, idx) => ({
                  key: idx,
                  color: EVENEMENT_COLOR[h.type_evenement] || 'blue',
                  children: (
                    <div>
                      <Text strong>{EVENEMENT_LABELS[h.type_evenement] || h.type_evenement}</Text>
                      <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>
                        {new Date(h.date_evenement).toLocaleString('fr-FR')}{h.agent_nom ? ` — ${h.agent_nom}` : ''}
                      </div>
                      {h.detail && <div style={{ fontSize: 13, marginTop: 4 }}>{h.detail}</div>}
                    </div>
                  ),
                }))}
              />

              <Space wrap style={{ marginTop: 8 }}>
                {detail.demande.statut === 'en_attente' && (
                  <Button icon={<PlayCircle size={16} />} onClick={() => handlePrendreEnCharge(detail.demande.id)} style={{ color: 'var(--success)' }}>
                    Prendre en charge
                  </Button>
                )}
                {['en_attente', 'en_etude'].includes(detail.demande.statut) && (
                  <Button icon={<MessageSquarePlus size={16} />} onClick={() => openComplementModal(detail.demande.id)}>
                    Demander un complément
                  </Button>
                )}
                {detail.demande.statut === 'en_etude' && (
                  <>
                    <Button
                      type="primary" icon={<CheckCircle size={16} />} style={{ backgroundColor: 'var(--success)' }}
                      onClick={() => openValidateModal(detail.demande.id, detail.demande.traite_par)}
                      disabled={!isAssignedToMe(detail.demande.traite_par)}
                    >
                      Valider
                    </Button>
                    <Button
                      danger icon={<XCircle size={16} />}
                      onClick={() => openRejectModal(detail.demande.id, detail.demande.traite_par)}
                      disabled={!isAssignedToMe(detail.demande.traite_par)}
                    >
                      Refuser
                    </Button>
                  </>
                )}
                {['en_attente', 'dossier_incomplet', 'en_etude'].includes(detail.demande.statut) && (
                  <Button icon={<Ban size={16} />} onClick={() => openAnnulerModal(detail.demande.id)}>
                    Annuler
                  </Button>
                )}
                {['valide', 'refuse', 'dossier_incomplet'].includes(detail.demande.statut) && (
                  <Button icon={<Mail size={16} />} onClick={() => handleRenvoyerEmail(detail.demande.id)}>
                    Renvoyer l'e-mail
                  </Button>
                )}
              </Space>
            </>
          )}
        </Spin>
      </Drawer>

      {/* Modal : demander un complément */}
      <Modal
        title={<Space><MessageSquarePlus size={20} /><span>Demander un complément de dossier</span></Space>}
        open={showComplementModal}
        onCancel={() => setShowComplementModal(false)}
        footer={[
          <Button key="cancel" onClick={() => setShowComplementModal(false)}>Annuler</Button>,
          <Button key="submit" type="primary" onClick={handleComplementConfirm} loading={actionLoading}>Envoyer la demande</Button>,
        ]}
        width={520}
      >
        <Form layout="vertical">
          <Form.Item label="Motif du complément" required>
            <TextArea rows={4} value={motifComplement} onChange={(e) => setMotifComplement(e.target.value)} placeholder="Ex : le bulletin de Licence 1 est illisible, merci de le renvoyer." />
            <Text type="secondary" style={{ fontSize: 12 }}>Ce motif sera transmis au candidat par e-mail, avec son code de suivi.</Text>
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal : validation */}
      <Modal
        title={<Space><CheckCircle size={20} style={{ color: 'var(--success)' }} /><span>Validation de la demande</span></Space>}
        open={showValidateModal}
        onCancel={() => setShowValidateModal(false)}
        footer={[
          <Button key="cancel" onClick={() => setShowValidateModal(false)}>Annuler</Button>,
          <Button key="submit" type="primary" style={{ backgroundColor: 'var(--success)' }} onClick={handleValidateConfirm} loading={actionLoading}>Valider</Button>,
        ]}
        width={480}
      >
        <p>Cette action est irréversible : un dossier d'inscription (code de paiement inclus) sera créé automatiquement et le candidat sera informé par e-mail des étapes suivantes.</p>
      </Modal>

      {/* Modal : refus */}
      <Modal
        title={<Space><XCircle size={20} style={{ color: 'var(--danger)' }} /><span>Refuser la demande</span></Space>}
        open={showRejectModal}
        onCancel={() => setShowRejectModal(false)}
        footer={[
          <Button key="cancel" onClick={() => setShowRejectModal(false)}>Annuler</Button>,
          <Button key="submit" type="primary" danger onClick={handleRejectConfirm} loading={actionLoading}>Confirmer le refus</Button>,
        ]}
        width={520}
      >
        <Form layout="vertical">
          <Form.Item label="Motif du refus" required>
            <TextArea rows={4} value={motifRefus} onChange={(e) => setMotifRefus(e.target.value)} placeholder="Ex : dossier académique insuffisant." />
            <Text type="secondary" style={{ fontSize: 12 }}>Un e-mail de refus sera envoyé automatiquement au candidat.</Text>
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal : annulation */}
      <Modal
        title={<Space><Ban size={20} /><span>Annuler la demande</span></Space>}
        open={showAnnulerModal}
        onCancel={() => setShowAnnulerModal(false)}
        footer={[
          <Button key="cancel" onClick={() => setShowAnnulerModal(false)}>Fermer</Button>,
          <Button key="submit" type="primary" danger onClick={handleAnnulerConfirm} loading={actionLoading}>Confirmer l'annulation</Button>,
        ]}
        width={480}
      >
        <Form layout="vertical">
          <Form.Item label="Motif de l'annulation" required>
            <TextArea rows={3} value={motifAnnulation} onChange={(e) => setMotifAnnulation(e.target.value)} placeholder="Ex : doublon avec un autre dossier." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default GesEquivalences;
