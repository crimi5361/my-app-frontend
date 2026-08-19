import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Card,
    Statistic,
    Row,
    Col,
    Select,
    Button,
    Space,
    Input,
    Typography,
    Spin,
    Alert,
    Empty,
    Avatar,
    Badge,
    Tabs,
} from 'antd';
import DataTable from '../../Components/ui/DataTable';
import StatusTag from '../../Components/ui/StatusTag';
import {
    SearchOutlined,
    ReloadOutlined,
    UserOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined,
    TrophyOutlined,
    TeamOutlined,
    BookOutlined,
    BarChartOutlined,
    PieChartOutlined,
    CrownOutlined,
    GoldOutlined,
    FileTextOutlined,
    WarningOutlined,
    StarOutlined,
    EyeOutlined,
    FileExcelOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import * as XLSX from 'xlsx';
import {
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Tooltip,
    Legend,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
} from 'recharts';

const { Title, Text } = Typography;
const { Option } = Select;
const { TabPane } = Tabs;

const API_URL = import.meta.env.VITE_API_URL_SERVER || '';

// ============ INTERFACES ============

interface Filiere {
    id: number;
    nom: string;
    sigle: string;
    type_filiere_id: number;
}

interface Niveau {
    id: number;
    libelle: string;
    filiere_id: number;
    prix_formation: string;
}

interface AnneeAcademique {
    id: number;
    annee: string;
    etat: string;
    departement_id: number;
}

interface TopEtudiant {
    rang: number;
    nom: string;
    prenoms: string;
    matricule: string;
    moyenne: number;
    filiere: string;
    niveau: string;
    photo_url?: string | null;
}

interface Stats {
    admis: number;
    ajournes: number;
    total_ecue_a_reprendre: number;
    etudiants_a_reprendre: number;
    moyenne_generale: number;
    taux_reussite: number;
}

interface EtudiantResultat {
    id: number;
    nom: string;
    prenoms: string;
    matricule: string;
    moyenne: number;
    filiere: string;
    niveau: string;
    photo_url?: string | null;
    decision: string;
    type_filiere?: string | null;
    credits_valides?: number;
    credits_total?: number;
    // Statut financier ('SOLDE' | 'NON_SOLDE') pour l'année académique sélectionnée.
    statut_etudiant?: string | null;
}

interface StatsResponse {
    success: boolean;
    total_etudiants: number;
    semestre: string | null;
    stats: Stats;
    top3: TopEtudiant[];
    etudiants: EtudiantResultat[];
    filieres: Filiere[];
    niveaux: Niveau[];
    annees: AnneeAcademique[];
    date_generation: string;
    error?: string;
}

interface RecapItem {
    filiere: string;
    filiere_sigle: string;
    niveau: string;
    total: number;
    admis: number;
    ajournes: number;
    etudiants_a_reprendre: number;
    taux_reussite: number;
    moyenne_generale: number;
}

interface RecapResponse {
    success: boolean;
    semestre: string | null;
    recap: RecapItem[];
    date_generation: string;
    error?: string;
}

// Type pour les lignes d'export Excel
interface RecapExportRow {
    '#': number;
    'Filière': string;
    'Sigle': string;
    'Niveau': string;
    'Total': number;
    'Admis': number;
    'Ajournés': number;
    'À reprendre': number;
    'Taux de réussite (%)': number;
    'Moyenne générale /20': number | string;
}

const COULEUR_ADMIS = '#52c41a';
const COULEUR_DEROGE = '#faad14';
const COULEUR_AJOURNES = '#ff4d4f';
const MAX_GROUPES_GRAPHIQUE = 15;

// ============ COMPOSANT PRINCIPAL ============

const StatsResultat: React.FC = () => {
    const [loading, setLoading] = useState<boolean>(false);
    const [recapLoading, setRecapLoading] = useState<boolean>(false);
    const [stats, setStats] = useState<StatsResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [searchText, setSearchText] = useState<string>('');
    const [etudiants, setEtudiants] = useState<EtudiantResultat[]>([]);
    const [filteredEtudiants, setFilteredEtudiants] = useState<EtudiantResultat[]>([]);
    const [departementId, setDepartementId] = useState<number | null>(null);
    const [activeTab, setActiveTab] = useState<string>('all');

    // ✅ Filtres avec semestre
    const [filtres, setFiltres] = useState<{
        filiereId: string;
        niveauId: string;
        semestreId: string;
    }>({
        filiereId: '',
        niveauId: '',
        semestreId: ''
    });

    // Niveaux filtrés par filière
    const [niveauxFiltres, setNiveauxFiltres] = useState<Niveau[]>([]);
    const [annees, setAnnees] = useState<AnneeAcademique[]>([]);
    const [selectedAnneeId, setSelectedAnneeId] = useState<number | null>(null);
    const selectedAnnee = useMemo(
        () => annees.find(a => a.id === selectedAnneeId) || null,
        [annees, selectedAnneeId]
    );

    // Récupérer le département de l'utilisateur
    useEffect(() => {
        try {
            const userStr = localStorage.getItem('user');
            if (userStr) {
                const user = JSON.parse(userStr);
                if (user && user.departement_id) {
                    setDepartementId(user.departement_id);
                }
            }
        } catch (err) {
            console.error('Erreur récupération département:', err);
        }
    }, []);

    // Récupérer la liste des années académiques du site + sélectionner l'année en cours par défaut
    useEffect(() => {
        const fetchAnnees = async () => {
            if (!departementId) return;

            try {
                const token = localStorage.getItem('token');
                const response = await fetch(`${API_URL}/api/annees?site_id=${departementId}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    const liste: AnneeAcademique[] = data || [];
                    setAnnees(liste);
                    const anneeCourante = liste.find((a) => a.etat === 'en cour');
                    setSelectedAnneeId((anneeCourante || liste[0])?.id ?? null);
                }
            } catch (err) {
                console.error('Erreur récupération des années académiques:', err);
            }
        };

        if (departementId) {
            fetchAnnees();
        }
    }, [departementId]);

    // ✅ fetchStats avec semestre
    const fetchStats = useCallback(async () => {
        if (!selectedAnneeId) return;

        setLoading(true);
        setError(null);
        try {
            const token = localStorage.getItem('token');
            const params = new URLSearchParams();
            if (filtres.filiereId) params.append('filiereId', filtres.filiereId);
            if (filtres.niveauId) params.append('niveauId', filtres.niveauId);
            if (filtres.semestreId) params.append('semestreId', filtres.semestreId);
            params.append('anneeAcademiqueId', String(selectedAnneeId));

            const url = `${API_URL}/api/PV/stats/resultats?${params.toString()}`;
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }

            const data: StatsResponse = await response.json();

            if (data.success) {
                setStats(data);
                const liste = data.etudiants || [];
                setEtudiants(liste);
                setFilteredEtudiants(liste);
                setActiveTab('all');

                if (filtres.filiereId) {
                    const niveauxFiltresData = (data.niveaux || []).filter(
                        n => n.filiere_id === parseInt(filtres.filiereId)
                    );
                    setNiveauxFiltres(niveauxFiltresData);
                } else {
                    setNiveauxFiltres(data.niveaux || []);
                }
            } else {
                setError(data.error || 'Erreur lors du chargement des statistiques');
            }
        } catch (err) {
            console.error('Erreur chargement stats:', err);
            setError(err instanceof Error ? err.message : 'Erreur de connexion au serveur');
        } finally {
            setLoading(false);
        }
    }, [filtres, selectedAnneeId]);

    // Charger les stats dès qu'une année académique est sélectionnée (ou changée)
    useEffect(() => {
        if (selectedAnneeId) {
            fetchStats();
        }
    }, [selectedAnneeId, fetchStats]);

    // ✅ Filtrer les étudiants selon l'onglet actif et la recherche
    useEffect(() => {
        let filtered = etudiants;

        if (activeTab === 'admis') {
            filtered = filtered.filter(e => e.decision === 'ADMIS' || e.decision === 'DÉROGÉ');
        } else if (activeTab === 'non_admis') {
            filtered = filtered.filter(e => e.decision !== 'ADMIS' && e.decision !== 'DÉROGÉ');
        }

        if (searchText) {
            const q = searchText.toLowerCase();
            filtered = filtered.filter(e =>
                `${e.nom} ${e.prenoms}`.toLowerCase().includes(q) ||
                (e.matricule || '').toLowerCase().includes(q)
            );
        }

        setFilteredEtudiants(filtered);
    }, [activeTab, searchText, etudiants]);

    // ✅ Correctif (2026-08-19) : changer l'année académique sans réinitialiser filiereId/niveauId
    // laissait passer un niveauId "figé" d'une AUTRE année (les lignes `niveau` sont des entités
    // distinctes par année — même libellé, id différent, cf. niveauxQuery ci-dessus côté backend).
    // Résultat concret : la requête combinait anneeAcademiqueId=<nouvelle année> avec
    // niveau_id=<ancienne année> → aucun étudiant ne peut jamais correspondre aux deux à la fois,
    // ce qui vidait silencieusement la page ("Aucune donnée disponible") au lieu de simplement
    // afficher les niveaux de la nouvelle année. filiereId est stable d'une année à l'autre (une
    // filière n'est pas dupliquée par année) donc n'a pas besoin d'être réinitialisé, mais on le
    // fait quand même par cohérence avec le filtre niveau qui, lui, en dépend.
    const handleAnneeChange = (value: number) => {
        setSelectedAnneeId(value);
        setFiltres(prev => ({ ...prev, filiereId: '', niveauId: '' }));
        setNiveauxFiltres([]);
    };

    // Gérer le changement de filière
    const handleFiliereChange = (value: string) => {
        setFiltres(prev => ({ ...prev, filiereId: value, niveauId: '' }));
        if (stats) {
            const niveauxFiltresData = (stats.niveaux || []).filter(
                n => n.filiere_id === parseInt(value)
            );
            setNiveauxFiltres(niveauxFiltresData);
        }
    };

    // Gérer la recherche
    const handleSearch = (value: string) => {
        setSearchText(value);
    };

    // Fonction sécurisée pour afficher la moyenne
    const formatMoyenne = (value: number | undefined | null): string => {
        if (value === undefined || value === null || isNaN(value)) return '0.00';
        return value.toFixed(2);
    };

    // ✅ Compteurs avec DÉROGÉ inclus dans ADMIS
    const countAdmis = etudiants.filter(e => e.decision === 'ADMIS' || e.decision === 'DÉROGÉ').length;
    const countNonAdmis = etudiants.filter(e => e.decision !== 'ADMIS' && e.decision !== 'DÉROGÉ').length;

    // ============ DONNÉES POUR LES GRAPHIQUES ============

    // ✅ Répartition avec DÉROGÉ
    const countDeroge = etudiants.filter(e => e.decision === 'DÉROGÉ').length;
    const countAdmisStrict = etudiants.filter(e => e.decision === 'ADMIS').length;
    const countAjournes = etudiants.filter(e => e.decision === 'AJOURNÉ' || e.decision === 'NON_ADMIS').length;

    const dataRepartitionDecision = useMemo(() => ([
        { name: 'Admis', value: countAdmisStrict, color: COULEUR_ADMIS },
        { name: 'Dérogé', value: countDeroge, color: COULEUR_DEROGE },
        { name: 'Ajournés', value: countAjournes, color: COULEUR_AJOURNES },
    ]), [countAdmisStrict, countDeroge, countAjournes]);

    const totalDecision = countAdmisStrict + countDeroge + countAjournes;

    const dataParNiveau = useMemo(() => {
        const groupes = new Map<string, { niveau: string; admis: number; deroge: number; ajournes: number; total: number }>();

        etudiants.forEach(e => {
            const cle = e.niveau || 'Sans niveau';
            if (!groupes.has(cle)) {
                groupes.set(cle, { niveau: cle, admis: 0, deroge: 0, ajournes: 0, total: 0 });
            }
            const g = groupes.get(cle)!;
            if (e.decision === 'ADMIS') g.admis += 1;
            else if (e.decision === 'DÉROGÉ') g.deroge += 1;
            else g.ajournes += 1;
            g.total += 1;
        });

        return Array.from(groupes.values())
            .sort((a, b) => b.total - a.total)
            .slice(0, MAX_GROUPES_GRAPHIQUE);
    }, [etudiants]);

    const troncatureLabel = etudiants.length > 0 && dataParNiveau.length < new Set(etudiants.map(e => e.niveau)).size;

    // ============ EXPORT EXCEL ============

    const handleExportExcel = () => {
        if (filteredEtudiants.length === 0) return;

        const donneesExport = filteredEtudiants.map((e, index) => ({
            '#': index + 1,
            'Matricule': e.matricule || '-',
            'Nom': e.nom || '',
            'Prénoms': e.prenoms || '',
            'Filière': e.filiere || '-',
            'Niveau': e.niveau || '-',
            'Moyenne /20': formatMoyenne(e.moyenne),
            'Crédits validés': e.credits_total ? `${e.credits_valides ?? 0}/${e.credits_total}` : '-',
            'Décision': e.decision || '-',
        }));

        const worksheet = XLSX.utils.json_to_sheet(donneesExport);
        worksheet['!cols'] = [
            { wch: 5 }, { wch: 16 }, { wch: 20 }, { wch: 20 },
            { wch: 22 }, { wch: 16 }, { wch: 12 }, { wch: 14 }, { wch: 12 },
        ];

        const workbook = XLSX.utils.book_new();
        const nomOnglet = activeTab === 'admis' ? 'Admis' : activeTab === 'non_admis' ? 'Non Admis' : 'Tous';
        XLSX.utils.book_append_sheet(workbook, worksheet, nomOnglet);

        const dateStr = new Date().toISOString().slice(0, 10);
        const suffixeFiltre = [
            filtres.filiereId ? stats?.filieres.find(f => String(f.id) === filtres.filiereId)?.sigle : null,
            filtres.niveauId ? stats?.niveaux.find(n => String(n.id) === filtres.niveauId)?.libelle : null,
            filtres.semestreId ? `S${filtres.semestreId}` : null,
            searchText ? `recherche-${searchText}` : null,
        ].filter(Boolean).join('_');

        const nomFichier = `Resultats_${nomOnglet}${suffixeFiltre ? '_' + suffixeFiltre : ''}_${dateStr}.xlsx`
            .replace(/\s+/g, '_');

        XLSX.writeFile(workbook, nomFichier);
    };

    // ============ EXPORT RÉCAP FILIÈRE/NIVEAU (BACKEND DÉDIÉ) ============

    const handleTelechargerRecapFiliereNiveau = async () => {
        if (!selectedAnneeId) return;

        setRecapLoading(true);
        try {
            const token = localStorage.getItem('token');
            const params = new URLSearchParams();
            if (filtres.filiereId) params.append('filiereId', filtres.filiereId);
            if (filtres.niveauId) params.append('niveauId', filtres.niveauId);
            if (filtres.semestreId) params.append('semestreId', filtres.semestreId);
            params.append('anneeAcademiqueId', String(selectedAnneeId));

            const url = `${API_URL}/api/PV/stats/recap?${params.toString()}`;
            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
            });

            if (!response.ok) throw new Error(`Erreur HTTP: ${response.status}`);

            const data: RecapResponse = await response.json();
            if (!data.success) {
                throw new Error(data.error || 'Erreur lors du calcul du récapitulatif');
            }

            if (data.recap.length === 0) {
                return;
            }

            // ✅ Correction : Type explicite pour l'export
            const donneesExport: RecapExportRow[] = data.recap.map((r, index) => ({
                '#': index + 1,
                'Filière': r.filiere,
                'Sigle': r.filiere_sigle,
                'Niveau': r.niveau,
                'Total': r.total,
                'Admis': r.admis,
                'Ajournés': r.ajournes,
                'À reprendre': r.etudiants_a_reprendre,
                'Taux de réussite (%)': r.taux_reussite,
                'Moyenne générale /20': r.moyenne_generale,
            }));

            // Ligne totaux
            const totalGlobal = data.recap.reduce((acc, r) => ({
                total: acc.total + r.total,
                admis: acc.admis + r.admis,
                ajournes: acc.ajournes + r.ajournes,
                areprendre: acc.areprendre + r.etudiants_a_reprendre,
            }), { total: 0, admis: 0, ajournes: 0, areprendre: 0 });

            // ✅ Correction : Ligne total avec le bon type
            const totalRow: RecapExportRow = {
                '#': donneesExport.length + 1,
                'Filière': 'TOTAL',
                'Sigle': '',
                'Niveau': '',
                'Total': totalGlobal.total,
                'Admis': totalGlobal.admis,
                'Ajournés': totalGlobal.ajournes,
                'À reprendre': totalGlobal.areprendre,
                'Taux de réussite (%)': totalGlobal.total > 0 ? parseFloat(((totalGlobal.admis / totalGlobal.total) * 100).toFixed(2)) : 0,
                'Moyenne générale /20': '',
            };
            donneesExport.push(totalRow);

            const worksheet = XLSX.utils.json_to_sheet(donneesExport);
            worksheet['!cols'] = [
                { wch: 5 }, { wch: 28 }, { wch: 10 }, { wch: 18 },
                { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 14 },
                { wch: 18 }, { wch: 18 },
            ];

            const workbook = XLSX.utils.book_new();
            const nomOnglet = data.semestre ? `Semestre ${data.semestre}` : 'Annuel';
            XLSX.utils.book_append_sheet(workbook, worksheet, nomOnglet.slice(0, 31));

            const dateStr = new Date().toISOString().slice(0, 10);
            const suffixe = data.semestre ? `_S${data.semestre}` : '_Annuel';
            XLSX.writeFile(workbook, `Recap_Filiere_Niveau${suffixe}_${dateStr}.xlsx`);

        } catch (err) {
            console.error('Erreur téléchargement récap:', err);
            setError(err instanceof Error ? err.message : 'Erreur lors du téléchargement du récapitulatif');
        } finally {
            setRecapLoading(false);
        }
    };

    // ✅ Colonnes du tableau avec DÉROGÉ
    const columns: ColumnsType<EtudiantResultat> = [
        {
            title: '#',
            key: 'index',
            width: 50,
            fixed: 'left',
            render: (_, __, index) => index + 1
        },
        {
            title: 'Matricule',
            dataIndex: 'matricule',
            key: 'matricule',
            width: 140,
            render: (text: string) => <Text code>{text || '-'}</Text>
        },
        {
            title: 'Nom & Prénoms',
            key: 'nom',
            width: 220,
            render: (_, record) => (
                <Space>
                    <Avatar
                        src={record.photo_url ? `${API_URL}${record.photo_url}` : undefined}
                        icon={<UserOutlined />}
                        size="small"
                    />
                    <Text strong className="whitespace-nowrap">{record.nom || ''} {record.prenoms || ''}</Text>
                </Space>
            )
        },
        {
            title: 'Filière',
            dataIndex: 'filiere',
            key: 'filiere',
            width: 150,
            render: (text: string) => <StatusTag tone="info" label={text || '-'} />
        },
        {
            title: 'Niveau',
            dataIndex: 'niveau',
            key: 'niveau',
            width: 130,
            render: (text: string) => <StatusTag tone="neutral" label={text || '-'} />
        },
        {
            title: 'Moyenne',
            dataIndex: 'moyenne',
            key: 'moyenne',
            align: 'center',
            width: 110,
            sorter: (a, b) => (a.moyenne || 0) - (b.moyenne || 0),
            render: (value: number) => {
                const moy = value || 0;
                return (
                    <Text strong style={{ color: moy >= 14 ? 'var(--success)' : moy >= 10 ? 'var(--warning)' : 'var(--danger)' }}>
                        {formatMoyenne(moy)}/20
                    </Text>
                );
            }
        },
        {
            title: 'Crédits validés',
            key: 'credits_valides',
            align: 'center',
            width: 130,
            // Filières professionnelles : la notion de crédits ne s'applique pas → un tiret.
            // Filières universitaires : X/Y crédits validés (0 possible si aucune note).
            render: (_, record) => {
                const aDesCredits = !!record.credits_total && record.credits_total > 0;
                if (!aDesCredits) {
                    return <Text type="secondary">—</Text>;
                }
                const valide = (record.credits_valides ?? 0) >= record.credits_total!;
                return (
                    <Text strong style={{ color: valide ? 'var(--success)' : undefined }}>
                        {record.credits_valides ?? 0}/{record.credits_total}
                    </Text>
                );
            }
        },
        {
            title: 'Décision',
            dataIndex: 'decision',
            key: 'decision',
            align: 'center',
            width: 140,
            filters: [
                { text: 'Admis', value: 'ADMIS' },
                { text: 'Dérogé', value: 'DÉROGÉ' },
                { text: 'Ajourné', value: 'AJOURNÉ' },
            ],
            onFilter: (value, record) => record.decision === value,
            render: (decision: string) => {
                const isAdmis = decision === 'ADMIS';
                const isDeroge = decision === 'DÉROGÉ';
                const tone = isAdmis ? 'success' : isDeroge ? 'warning' : 'danger';
                const icon = isAdmis ? <CheckCircleOutlined /> : isDeroge ? <WarningOutlined /> : <CloseCircleOutlined />;
                return <StatusTag tone={tone} icon={icon} label={decision || '-'} />;
            }
        },
        {
            title: 'Statut scolarité',
            dataIndex: 'statut_etudiant',
            key: 'statut_etudiant',
            align: 'center',
            width: 150,
            filters: [
                { text: 'Soldé', value: 'SOLDE' },
                { text: 'Non soldé', value: 'NON_SOLDE' },
            ],
            onFilter: (value, record) => record.statut_etudiant === value,
            render: (statut: string | null | undefined) => {
                const isSolde = statut === 'SOLDE';
                const isNonSolde = statut === 'NON_SOLDE';
                const tone = isSolde ? 'success' : isNonSolde ? 'danger' : 'neutral';
                const label = isSolde || isNonSolde ? statut! : 'N/A';
                return <StatusTag tone={tone} label={label} />;
            }
        }
    ];

    const tableScrollWidth = columns.reduce((sum, col) => sum + (typeof col.width === 'number' ? col.width : 120), 0);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen px-4 text-center">
                <Spin size="large" />
                <div className="ml-4 text-gray-600">Chargement des statistiques...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 sm:p-8 max-w-6xl mx-auto">
                <Alert
                    message="Erreur"
                    description={error}
                    type="error"
                    showIcon
                    action={
                        <Button size="small" type="primary" onClick={fetchStats}>
                            Réessayer
                        </Button>
                    }
                />
            </div>
        );
    }

    if (!stats || stats.total_etudiants === 0) {
        return (
            <div className="p-4 sm:p-8 max-w-6xl mx-auto">
                <Card className="mb-6 shadow-sm" bodyStyle={{ padding: '16px' }}>
                    <div className="flex items-center gap-2 max-w-xs">
                        <FileTextOutlined className="text-gray-500 shrink-0" />
                        <Select
                            placeholder="Année académique"
                            value={selectedAnneeId ?? undefined}
                            onChange={handleAnneeChange}
                            className="w-full"
                            loading={annees.length === 0}
                        >
                            {annees.map(a => (
                                <Option key={a.id} value={a.id}>{a.annee} ({a.etat})</Option>
                            ))}
                        </Select>
                    </div>
                </Card>
                <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="Aucune donnée disponible pour les filtres sélectionnés"
                />
                <div className="text-center mt-4">
                    <Button type="primary" onClick={() => {
                        setFiltres({ filiereId: '', niveauId: '', semestreId: '' });
                        setSearchText('');
                        setActiveTab('all');
                        fetchStats();
                    }}>
                        Réinitialiser les filtres
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="p-3 sm:p-4 md:p-6 bg-gray-50 min-h-screen w-full overflow-x-hidden">
            <div className="w-full max-w-full px-0 sm:px-2 md:px-4">
                {/* En-tête */}
                <div className="mb-6">
                    <Title level={3} className="!mb-2 flex flex-wrap items-center gap-2 sm:!text-2xl">
                        <FileTextOutlined className="text-blue-500" />
                        <span>Statistiques des Résultats</span>
                        <Badge
                            count={selectedAnnee?.annee || 'N/A'}
                            style={{ backgroundColor: 'var(--mod-scolarite)' }}
                        />
                        {stats.semestre && (
                            <StatusTag tone="warning" label={`Semestre ${stats.semestre}`} />
                        )}
                    </Title>
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                        <Badge count={stats.total_etudiants} showZero color="blue">
                            <StatusTag tone="info" icon={<TeamOutlined />} label="Total étudiants" />
                        </Badge>
                        <Text type="secondary" className="text-xs sm:text-sm">
                            Mis à jour le {new Date(stats.date_generation).toLocaleString('fr-FR')}
                        </Text>
                        <Button
                            icon={<FileExcelOutlined />}
                            loading={recapLoading}
                            onClick={handleTelechargerRecapFiliereNiveau}
                            style={{ color: '#217346', borderColor: '#217346' }}
                            size="small"
                        >
                            Récap par filière / niveau
                        </Button>
                    </div>
                </div>

                {/* Filtres */}
                <Card className="mb-6 shadow-sm" bodyStyle={{ padding: '16px' }}>
                    <Row gutter={[12, 12]}>
                        <Col xs={24} sm={12} md={6}>
                            <div className="flex items-center gap-2 min-w-0">
                                <FileTextOutlined className="text-gray-500 shrink-0" />
                                <Select
                                    placeholder="Année académique"
                                    value={selectedAnneeId ?? undefined}
                                    onChange={handleAnneeChange}
                                    className="w-full min-w-0"
                                    loading={annees.length === 0}
                                >
                                    {annees.map(a => (
                                        <Option key={a.id} value={a.id}>{a.annee} ({a.etat})</Option>
                                    ))}
                                </Select>
                            </div>
                        </Col>
                        <Col xs={24} sm={12} md={6}>
                            <div className="flex items-center gap-2 min-w-0">
                                <BookOutlined className="text-gray-500 shrink-0" />
                                <Select
                                    placeholder="Filière"
                                    allowClear
                                    showSearch
                                    optionFilterProp="children"
                                    value={filtres.filiereId || undefined}
                                    onChange={handleFiliereChange}
                                    className="w-full min-w-0"
                                >
                                    <Option value="">Toutes les filières</Option>
                                    {stats.filieres?.map(f => (
                                        <Option key={f.id} value={String(f.id)}>
                                            {f.nom} ({f.sigle})
                                        </Option>
                                    ))}
                                </Select>
                            </div>
                        </Col>
                        <Col xs={24} sm={12} md={6}>
                            <div className="flex items-center gap-2 min-w-0">
                                <StarOutlined className="text-gray-500 shrink-0" />
                                <Select
                                    placeholder="Niveau"
                                    allowClear
                                    showSearch
                                    optionFilterProp="children"
                                    value={filtres.niveauId || undefined}
                                    onChange={(value) => setFiltres(prev => ({ ...prev, niveauId: value }))}
                                    className="w-full min-w-0"
                                >
                                    <Option value="">Tous les niveaux</Option>
                                    {niveauxFiltres.map(n => (
                                        <Option key={n.id} value={String(n.id)}>
                                            {n.libelle}
                                        </Option>
                                    ))}
                                </Select>
                            </div>
                        </Col>
                        <Col xs={24} sm={12} md={6}>
                            <div className="flex items-center gap-2 min-w-0">
                                <FileTextOutlined className="text-gray-500 shrink-0" />
                                <Select
                                    placeholder="Période"
                                    value={filtres.semestreId || undefined}
                                    onChange={(value) => setFiltres(prev => ({ ...prev, semestreId: value }))}
                                    className="w-full min-w-0"
                                >
                                    <Option value="">Annuel</Option>
                                    <Option value="1">Semestre 1</Option>
                                    <Option value="2">Semestre 2</Option>
                                </Select>
                            </div>
                        </Col>
                        <Col xs={24} md={6}>
                            <div className="flex flex-wrap sm:flex-nowrap gap-2 w-full">
                                <Button
                                    type="primary"
                                    icon={<SearchOutlined />}
                                    onClick={fetchStats}
                                    className="flex-1 sm:flex-none"
                                >
                                    Rechercher
                                </Button>
                                <Button
                                    icon={<ReloadOutlined />}
                                    onClick={() => {
                                        setFiltres({ filiereId: '', niveauId: '', semestreId: '' });
                                        setSearchText('');
                                        setActiveTab('all');
                                        fetchStats();
                                    }}
                                    className="flex-1 sm:flex-none"
                                >
                                    Réinitialiser
                                </Button>
                            </div>
                        </Col>
                    </Row>
                </Card>

                {/* Cartes Statistiques */}
                <Row gutter={[12, 12]} className="mb-6">
                    <Col xs={12} sm={8} md={8} lg={4}>
                        <Card className="shadow-sm h-full" bodyStyle={{ padding: '16px 12px' }}>
                            <Statistic
                                title="Total"
                                value={stats.total_etudiants}
                                prefix={<TeamOutlined />}
                                valueStyle={{ color: 'var(--mod-scolarite)' }}
                            />
                        </Card>
                    </Col>
                    <Col xs={12} sm={8} md={8} lg={4}>
                        <Card className="shadow-sm h-full" bodyStyle={{ padding: '16px 12px' }}>
                            <Statistic
                                title="Admis"
                                value={stats.stats.admis}
                                prefix={<CheckCircleOutlined />}
                                valueStyle={{ color: 'var(--success)' }}
                            />
                        </Card>
                    </Col>
                    <Col xs={12} sm={8} md={8} lg={4}>
                        <Card className="shadow-sm h-full" bodyStyle={{ padding: '16px 12px' }}>
                            <Statistic
                                title="Dérogés"
                                value={countDeroge}
                                prefix={<WarningOutlined />}
                                valueStyle={{ color: 'var(--warning)' }}
                            />
                        </Card>
                    </Col>
                    <Col xs={12} sm={8} md={8} lg={4}>
                        <Card className="shadow-sm h-full" bodyStyle={{ padding: '16px 12px' }}>
                            <Statistic
                                title="Ajournés"
                                value={stats.stats.ajournes}
                                prefix={<CloseCircleOutlined />}
                                valueStyle={{ color: 'var(--danger)' }}
                            />
                        </Card>
                    </Col>
                    <Col xs={12} sm={8} md={8} lg={4}>
                        <Card className="shadow-sm h-full" bodyStyle={{ padding: '16px 12px' }}>
                            <Statistic
                                title="Taux de réussite"
                                value={stats.stats.taux_reussite}
                                suffix="%"
                                prefix={<BarChartOutlined />}
                                valueStyle={{ color: 'var(--warning)' }}
                            />
                        </Card>
                    </Col>
                    <Col xs={12} sm={8} md={8} lg={4}>
                        <Card className="shadow-sm h-full" bodyStyle={{ padding: '16px 12px' }}>
                            <Statistic
                                title="Moyenne générale"
                                value={stats.stats.moyenne_generale}
                                suffix="/20"
                                prefix={<PieChartOutlined />}
                                valueStyle={{ color: 'var(--mod-comptabilite)' }}
                            />
                        </Card>
                    </Col>
                </Row>

                {/* Graphiques */}
                <Row gutter={[12, 12]} className="mb-6">
                    <Col xs={24} md={8}>
                        <Card
                            className="shadow-sm h-full"
                            bodyStyle={{ padding: '12px' }}
                            title={<span className="flex items-center text-sm sm:text-base"><PieChartOutlined className="mr-2 text-purple-500" /> Répartition des décisions</span>}
                        >
                            {totalDecision > 0 ? (
                                <ResponsiveContainer width="100%" height={260}>
                                    <PieChart>
                                        <Pie
                                            data={dataRepartitionDecision}
                                            dataKey="value"
                                            nameKey="name"
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={55}
                                            outerRadius={90}
                                            paddingAngle={2}
                                            label={({ name, value }) =>
                                                `${name}: ${value} (${((value / totalDecision) * 100).toFixed(0)}%)`
                                            }
                                        >
                                            {dataRepartitionDecision.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip formatter={(value: number) => [`${value} étudiant(s)`, '']} />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <Empty description="Pas de données" />
                            )}
                        </Card>
                    </Col>
                    <Col xs={24} md={16}>
                        <Card
                            className="shadow-sm h-full"
                            bodyStyle={{ padding: '12px' }}
                            title={<span className="flex items-center text-sm sm:text-base"><BarChartOutlined className="mr-2 text-blue-500" /> Répartition par niveau</span>}
                            extra={troncatureLabel && <Text type="secondary" className="text-xs">Top {MAX_GROUPES_GRAPHIQUE} niveaux affichés</Text>}
                        >
                            {dataParNiveau.length > 0 ? (
                                <div className="w-full overflow-x-auto">
                                    <ResponsiveContainer width="100%" height={260} minWidth={Math.max(320, dataParNiveau.length * 60)}>
                                        <BarChart data={dataParNiveau} margin={{ top: 8, right: 16, left: 0, bottom: 40 }}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="niveau" angle={-30} textAnchor="end" interval={0} height={60} tick={{ fontSize: 11 }} />
                                            <YAxis allowDecimals={false} />
                                            <Tooltip />
                                            <Legend />
                                            <Bar dataKey="admis" name="Admis" stackId="a" fill={COULEUR_ADMIS} radius={[0, 0, 0, 0]} />
                                            <Bar dataKey="deroge" name="Dérogé" stackId="a" fill={COULEUR_DEROGE} radius={[0, 0, 0, 0]} />
                                            <Bar dataKey="ajournes" name="Ajournés" stackId="a" fill={COULEUR_AJOURNES} radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : (
                                <Empty description="Pas de données" />
                            )}
                        </Card>
                    </Col>
                </Row>

                {/* Top 3 */}
                <Card
                    className="mb-6 shadow-sm"
                    bodyStyle={{ padding: '16px' }}
                    title={<span className="flex items-center text-sm sm:text-base"><TrophyOutlined className="mr-2 text-yellow-500" /> Top 3 de l'école</span>}
                >
                    <Row gutter={[16, 16]} justify="center">
                        {stats.top3?.map((etudiant, index) => (
                            <Col xs={24} sm={12} md={8} key={index}>
                                <Card className="text-center shadow-sm hover:shadow-md transition-shadow h-full">
                                    <div className="text-4xl mb-2">
                                        {index === 0 ? <GoldOutlined style={{ color: 'var(--warning)' }} /> :
                                         index === 1 ? <TrophyOutlined style={{ color: '#8c8c8c' }} /> :
                                         <CrownOutlined style={{ color: '#cd7f32' }} />}
                                    </div>
                                    <Avatar
                                        size={80}
                                        src={etudiant.photo_url ? `${API_URL}${etudiant.photo_url}` : undefined}
                                        icon={<UserOutlined />}
                                        className="mb-2"
                                    />
                                    <Title level={5} className="mb-0 break-words">{etudiant.nom} {etudiant.prenoms}</Title>
                                    <Text type="secondary" className="break-words">{etudiant.filiere} • {etudiant.niveau}</Text>
                                    <div className="mt-2">
                                        <span className="text-base sm:text-lg font-bold">
                                            <StatusTag tone="info" label={`${formatMoyenne(etudiant.moyenne)}/20`} />
                                        </span>
                                    </div>
                                    <Text type="secondary" className="text-xs">Matricule: {etudiant.matricule}</Text>
                                </Card>
                            </Col>
                        ))}
                    </Row>
                </Card>

                {/* Tableau */}
                <Card
                    className="shadow-sm"
                    bodyStyle={{ padding: '16px 12px' }}
                    title={
                        <div className="flex flex-wrap items-center gap-2">
                            <TeamOutlined className="text-blue-500" />
                            <span className="whitespace-nowrap">Étudiants {filtres.filiereId || filtres.niveauId ? 'du filtre sélectionné' : '(toutes filières)'}</span>
                            <StatusTag tone="info" label={String(etudiants.length)} />
                        </div>
                    }
                    extra={
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                            <Input.Search
                                placeholder="Rechercher par nom, prénom ou matricule"
                                allowClear
                                value={searchText}
                                onChange={(e) => handleSearch(e.target.value)}
                                className="w-full sm:w-[280px]"
                                prefix={<SearchOutlined />}
                            />
                            <Button
                                icon={<FileExcelOutlined />}
                                onClick={handleExportExcel}
                                disabled={filteredEtudiants.length === 0}
                                style={{ color: '#217346', borderColor: '#217346' }}
                                className="w-full sm:w-auto"
                            >
                                Exporter Excel ({filteredEtudiants.length})
                            </Button>
                        </div>
                    }
                >
                    <Tabs activeKey={activeTab} onChange={setActiveTab} className="mb-4">
                        <TabPane
                            tab={
                                <span>
                                    <EyeOutlined />
                                    <span className="hidden xs:inline"> Tous</span> ({etudiants.length})
                                </span>
                            }
                            key="all"
                        />
                        <TabPane
                            tab={
                                <span>
                                    <CheckCircleOutlined className="text-green-500" />
                                    <span className="hidden xs:inline"> Admis</span> ({countAdmis})
                                </span>
                            }
                            key="admis"
                        />
                        <TabPane
                            tab={
                                <span>
                                    <CloseCircleOutlined className="text-red-500" />
                                    <span className="hidden xs:inline"> Non Admis</span> ({countNonAdmis})
                                </span>
                            }
                            key="non_admis"
                        />
                    </Tabs>

                    <DataTable<EtudiantResultat>
                        columns={columns}
                        dataSource={filteredEtudiants}
                        rowKey="id"
                        pagination={{
                            pageSize: 10,
                            showTotal: (total, range) => `${range[0]}-${range[1]} sur ${total} étudiants`
                        }}
                        scroll={{ x: tableScrollWidth }}
                        emptyTitle="Aucun étudiant trouvé"
                    />
                </Card>
            </div>
        </div>
    );
};

export default StatsResultat;