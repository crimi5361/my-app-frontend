/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react';
import {
  Card,
  Button,
  DatePicker,
  Space,
  message,
  Row,
  Col,
  Statistic,
  Typography,
  Select,
  Alert,
  Tooltip,
  Dropdown,
} from 'antd';
import {
  EyeOutlined,
  FilterOutlined,
  CalendarOutlined,
  FileExcelOutlined,
  DownOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../Components/PageHeader/PageHeader';
import DataTable from '../../Components/ui/DataTable';
import StatusTag from '../../Components/ui/StatusTag';
import { apiFetch, ApiError } from '../../lib/api';
import moment from 'moment';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import type { Dayjs } from 'dayjs';
import * as XLSX from 'xlsx';

const { RangePicker } = DatePicker;
const { Option } = Select;
const { Text } = Typography;

interface Paiement {
  numero_recu: string;
  nom_etudiant: string;
  prenoms_etudiant: string;
  montant: string;
  date_paiement: string;
  methode: string;
  nom_departement: string;
  nom_utilisateur_effectue_par: string;
  annee_academique: string;
  etat_annee: string;
}

interface AcademicYear {
  id: number;
  annee: string;
  etat: string;
}

interface Filters {
  departement_id: number;
  page: number;
  limit: number;
  dateRange: [Dayjs | null, Dayjs | null] | null;
  anneeAcademiqueId: number | null;
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

// ─── Export Excel ──────────────────────────────────────────────────────────
const exportToExcel = (data: Paiement[], filename: string, sheetLabel: string) => {
  if (!data.length) {
    message.warning('Aucune donnée à exporter');
    return;
  }

  const rows = data.map((p) => ({
    'N° Reçu': p.numero_recu,
    'Étudiant': `${p.nom_etudiant} ${p.prenoms_etudiant}`,
    'Montant (FCFA)': parseFloat(p.montant),
    'Date Paiement': moment(p.date_paiement).format('DD/MM/YYYY HH:mm'),
    'Méthode': p.methode.toUpperCase(),
    'Département': p.nom_departement,
    'Effectué par': p.nom_utilisateur_effectue_par,
    'Année Académique': p.annee_academique,
    'État Année': p.etat_annee,
  }));

  const totalMontant = data.reduce((s, p) => s + parseFloat(p.montant || '0'), 0);
  rows.push({
    'N° Reçu': '',
    'Étudiant': 'TOTAL',
    'Montant (FCFA)': totalMontant,
    'Date Paiement': '',
    'Méthode': '',
    'Département': '',
    'Effectué par': '',
    'Année Académique': '',
    'État Année': '',
  } as any);

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 36 }, { wch: 30 }, { wch: 18 }, { wch: 20 },
    { wch: 12 }, { wch: 22 }, { wch: 22 }, { wch: 16 }, { wch: 14 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetLabel);
  XLSX.writeFile(wb, `${filename}.xlsx`);
  message.success(`Fichier "${filename}.xlsx" exporté avec succès`);
};

// ──────────────────────────────────────────────────────────────────────────
const Paiements = () => {
  const [loading, setLoading] = useState(false);
  const [loadingYears, setLoadingYears] = useState(false);
  const [paiements, setPaiements] = useState<Paiement[]>([]);
  const [total, setTotal] = useState(0);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [selectedYearInfo, setSelectedYearInfo] = useState<{ annee: string; etat: string } | null>(null);
  const [currentUser, setCurrentUser] = useState<UserInfo | null>(null);
  const [initialYearSet, setInitialYearSet] = useState(false);

  const [filters, setFilters] = useState<Filters>({
    departement_id: 0,
    page: 1,
    limit: 20,
    dateRange: null,
    anneeAcademiqueId: null,
  });

  const API_URL = import.meta.env.VITE_API_URL_SERVER || '';
  const navigate = useNavigate();

  // ── Chargement utilisateur ─────────────────────────────────────────────
  useEffect(() => {
    const user = getUserInfo();
    if (!user) {
      message.error('Impossible de récupérer vos informations. Veuillez vous reconnecter.');
      return;
    }
    if (!user.departement_id) {
      message.error("Aucun département associé à votre compte.");
      return;
    }
    setCurrentUser(user);
    setFilters((prev) => ({ ...prev, departement_id: user.departement_id }));
  }, []);

  // ── Années académiques ─────────────────────────────────────────────────
  useEffect(() => {
    const fetchAcademicYears = async () => {
      setLoadingYears(true);
      try {
        const departement_id = localStorage.getItem('departement_id');

        if (!departement_id) {
          message.error('Authentification requise');
          navigate('/login');
          return;
        }

        const data = await apiFetch(`/api/annees?site_id=${departement_id}`);

        if (Array.isArray(data)) {
          setAcademicYears(data);
          
          // Trouver l'année "en cours"
          const currentYear = data.find((year: AcademicYear) =>
            year.etat?.toLowerCase() === 'en cours' ||
            year.etat?.toLowerCase() === 'en cour'
          );
          
          if (currentYear) {
            // Définir l'année sélectionnée dans les filtres
            setFilters(prev => ({ ...prev, anneeAcademiqueId: currentYear.id, page: 1 }));
            setSelectedYearInfo({ annee: currentYear.annee, etat: currentYear.etat });
          } else if (data.length > 0) {
            // Si pas d'année en cours, prendre la première
            setFilters(prev => ({ ...prev, anneeAcademiqueId: data[0].id, page: 1 }));
            setSelectedYearInfo({ annee: data[0].annee, etat: data[0].etat });
          }
          setInitialYearSet(true);
        } else {
          throw new Error('Format de réponse inattendu');
        }
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return;
        console.error('Erreur récupération années académiques:', err);
        message.error('Impossible de charger les années académiques');
      } finally {
        setLoadingYears(false);
      }
    };
  
    fetchAcademicYears();
  }, [API_URL, navigate]);

  // ── Colonnes tableau ───────────────────────────────────────────────────
  const columns: ColumnsType<Paiement> = [
    {
      title: 'N° Reçu',
      dataIndex: 'numero_recu',
      key: 'numero_recu',
      width: 300,
      render: (text: string) => <span className="font-mono text-xs">{text}</span>,
    },
    {
      title: 'Étudiant',
      dataIndex: 'nom_etudiant',
      key: 'etudiant',
      render: (text: string, record: Paiement) => (
        <div className="font-semibold">{text} {record.prenoms_etudiant}</div>
      ),
    },
    {
      title: 'Montant',
      dataIndex: 'montant',
      key: 'montant',
      align: 'right',
      render: (montant: string) => (
        <span className="font-bold text-green-600">
          {parseFloat(montant).toLocaleString('fr-FR')} FCFA
        </span>
      ),
    },
    {
      title: 'Date Paiement',
      dataIndex: 'date_paiement',
      key: 'date_paiement',
      render: (date: string) => moment(date).format('DD/MM/YYYY HH:mm'),
    },
    {
      title: 'Méthode',
      dataIndex: 'methode',
      key: 'methode',
      render: (methode: string) => (
        <StatusTag tone={methode === 'especes' ? 'success' : 'info'} label={methode.toUpperCase()} />
      ),
    },
    {
      title: 'Département',
      dataIndex: 'nom_departement',
      key: 'departement',
    },
    {
      title: 'Effectué par',
      dataIndex: 'nom_utilisateur_effectue_par',
      key: 'effectue_par',
    },
    {
      title: 'Année Acad.',
      dataIndex: 'annee_academique',
      key: 'annee_academique',
      width: 150,
      render: (annee: string, record: Paiement) => (
        <StatusTag tone={record.etat_annee === 'en cours' || record.etat_annee === 'en cour' ? 'success' : 'info'} label={annee} />
      ),
    },
  ];

  // ── Fetch paiements ────────────────────────────────────────────────────
  const fetchPaiements = async (page = filters.page) => {
    if (!filters.anneeAcademiqueId || !currentUser?.departement_id) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) { message.error('Token non trouvé.'); return; }

      const params = new URLSearchParams();
      params.append('departement_id', currentUser.departement_id.toString());
      params.append('anneeAcademiqueId', filters.anneeAcademiqueId.toString());
      params.append('page', page.toString());
      params.append('limit', filters.limit.toString());

      // Filtre période : envoyé dès qu'une plage est sélectionnée
      if (filters.dateRange?.[0] && filters.dateRange[1]) {
        params.append('date_debut', filters.dateRange[0].format('YYYY-MM-DD'));
        params.append('date_fin',   filters.dateRange[1].format('YYYY-MM-DD'));
      }

      const apiUrl = `${API_URL}${API_URL.endsWith('/') ? '' : '/'}api/paiements/Allpayement?${params}`;
      const response = await fetch(apiUrl, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error(`Erreur HTTP ${response.status}`);

      const data = await response.json();
      if (data.success) {
        setPaiements(data.data || []);
        setTotal(data.total || 0);
        if (data.anneeAcademique) {
          setSelectedYearInfo({ annee: data.anneeAcademique.annee, etat: data.anneeAcademique.etat });
        }
      } else {
        message.error(data.message || 'Erreur lors du chargement');
      }
    } catch (error: any) {
      console.error('Erreur fetchPaiements:', error);
      message.error('Erreur de connexion au serveur');
      setPaiements([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  // Fetch quand page/limit/année/user changent
  useEffect(() => {
    if (filters.anneeAcademiqueId && currentUser?.departement_id && initialYearSet) {
      fetchPaiements(filters.page);
    }
  }, [filters.page, filters.limit, filters.anneeAcademiqueId, currentUser, initialYearSet]);

  // Fetch automatique quand la période change (retour page 1)
  useEffect(() => {
    if (filters.anneeAcademiqueId && currentUser?.departement_id && initialYearSet) {
      setFilters(prev => ({ ...prev, page: 1 }));
      fetchPaiements(1);
    }
  }, [filters.dateRange]);

  // ── Handlers ───────────────────────────────────────────────────────────
  const handleTableChange = (pagination: TablePaginationConfig) => {
    setFilters((prev) => ({ ...prev, page: pagination.current || 1, limit: pagination.pageSize || 20 }));
  };

  const handleYearChange = (value: number) => {
    const selectedYear = academicYears.find(y => y.id === value);
    if (selectedYear) {
      setSelectedYearInfo({ annee: selectedYear.annee, etat: selectedYear.etat });
    }
    setFilters((prev) => ({ ...prev, anneeAcademiqueId: value, page: 1, dateRange: null }));
  };

  // Sélection d'une période → fetch automatique via useEffect ci-dessus
  const handleDateRangeChange = (dates: any) => {
    const newRange = dates ? [dates[0], dates[1]] as [Dayjs, Dayjs] : null;
    setFilters((prev) => ({ ...prev, dateRange: newRange, page: 1 }));
  };

  const handleReset = () => {
    setFilters((prev) => ({ ...prev, dateRange: null, page: 1 }));
  };

  // ── Export : basé sur la période/filtres actifs ────────────────────────
  const buildFilename = () => {
    const dept = currentUser?.departementName ?? 'dept';
    const year = selectedYearInfo?.annee ?? 'annee';
    const date = moment().format('YYYYMMDD');
    if (filters.dateRange?.[0] && filters.dateRange[1]) {
      const from = filters.dateRange[0].format('DD-MM-YYYY');
      const to   = filters.dateRange[1].format('DD-MM-YYYY');
      return `Paiements_${dept}_${year}_du${from}_au${to}_${date}`;
    }
    return `Paiements_${dept}_${year}_complet_${date}`;
  };

  const exportCurrentPage = () => {
    exportToExcel(paiements, buildFilename() + `_p${filters.page}`, 'Paiements');
  };

  const exportAll = async () => {
    if (!currentUser?.departement_id || !filters.anneeAcademiqueId) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      params.append('departement_id', currentUser.departement_id.toString());
      params.append('anneeAcademiqueId', filters.anneeAcademiqueId.toString());
      params.append('page', '1');
      params.append('limit', '100000');
      // même période que l'affichage
      if (filters.dateRange?.[0] && filters.dateRange[1]) {
        params.append('date_debut', filters.dateRange[0].format('YYYY-MM-DD'));
        params.append('date_fin',   filters.dateRange[1].format('YYYY-MM-DD'));
      }
      const res = await fetch(
        `${API_URL}${API_URL.endsWith('/') ? '' : '/'}api/paiements/Allpayement?${params}`,
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
      );
      const data = await res.json();
      if (data.success) {
        exportToExcel(data.data, buildFilename(), 'Paiements');
      } else {
        message.error('Impossible de récupérer toutes les données');
      }
    } catch {
      message.error("Erreur lors de l'export");
    } finally {
      setLoading(false);
    }
  };

  const exportItems = [
    {
      key: 'page',
      label: `Page courante (${paiements.length} lignes)`,
      icon: <FileExcelOutlined style={{ color: 'var(--success)' }} />,
      onClick: exportCurrentPage,
    },
    {
      key: 'all',
      label: filters.dateRange?.[0]
        ? 'Toute la période sélectionnée'
        : `Toute l'année (${selectedYearInfo?.annee ?? ''})`,
      icon: <FileExcelOutlined style={{ color: 'var(--success)' }} />,
      onClick: exportAll,
    },
  ];

  // ── Stats ──────────────────────────────────────────────────────────────
  const totalMontant    = paiements.reduce((s, p) => s + parseFloat(p.montant || '0'), 0);
  const nombrePaiements = paiements.length;
  const moyennePaiement = nombrePaiements > 0 ? totalMontant / nombrePaiements : 0;

  const periodeLabel = filters.dateRange?.[0] && filters.dateRange[1]
    ? `du ${filters.dateRange[0].format('DD/MM/YYYY')} au ${filters.dateRange[1].format('DD/MM/YYYY')}`
    : null;

  // ── Guards ─────────────────────────────────────────────────────────────
  if (!currentUser) {
    return (
      <div className="p-6">
        <PageHeader />
        <Alert
          message="Accès non autorisé"
          description="Impossible de récupérer vos informations utilisateur. Veuillez vous reconnecter."
          type="error" showIcon
        />
      </div>
    );
  }

  if (!currentUser.departement_id) {
    return (
      <div className="p-6">
        <PageHeader />
        <Alert
          message="Département non assigné"
          description="Votre compte n'est associé à aucun département. Veuillez contacter l'administrateur."
          type="warning" showIcon
        />
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="p-6">
      <PageHeader />

      <Alert
        message={`Paiements — ${currentUser.departementName || 'Département ' + currentUser.departement_id}`}
        description={`Vous visualisez uniquement les paiements du département ${currentUser.departementName || ''}.`}
        type="info" showIcon style={{ marginBottom: 16 }} closable
      />

      {/* ── Filtres ────────────────────────────────────────────────── */}
      <Card
        className="mb-6"
        title={
          <Space>
            <FilterOutlined />
            Filtres
            {periodeLabel && (
              <StatusTag tone="info" icon={<CalendarOutlined />} label={periodeLabel} />
            )}
          </Space>
        }
      >
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} md={8}>
            <Text type="secondary" style={{ display: 'block', marginBottom: 4, fontSize: 12 }}>
              Année académique
            </Text>
            <Select
              value={filters.anneeAcademiqueId}
              onChange={handleYearChange}
              style={{ width: '100%' }}
              placeholder="Sélectionner une année"
              loading={loadingYears}
            >
              {academicYears.map((year) => (
                <Option key={year.id} value={year.id}>
                  {year.annee} ({year.etat})
                </Option>
              ))}
            </Select>
          </Col>

          <Col xs={24} md={12}>
            <Text type="secondary" style={{ display: 'block', marginBottom: 4, fontSize: 12 }}>
              Période — les paiements de cette plage s'affichent automatiquement
            </Text>
            <RangePicker
              style={{ width: '100%' }}
              value={filters.dateRange}
              onChange={handleDateRangeChange}
              format="DD/MM/YYYY"
              placeholder={['Date début', 'Date fin']}
            />
          </Col>

          <Col xs={24} md={4} style={{ paddingTop: 20 }}>
            {filters.dateRange && (
              <Button icon={<ReloadOutlined />} onClick={handleReset} style={{ width: '100%' }}>
                Réinitialiser
              </Button>
            )}
          </Col>
        </Row>

        {periodeLabel && (
          <div style={{ marginTop: 12, padding: '8px 12px', background: '#e6f7ff', borderRadius: 6 }}>
            <Text strong>Période active : </Text>
            <Text>{periodeLabel}</Text>
            <Text type="secondary"> — {total} paiement(s)</Text>
          </div>
        )}

        {selectedYearInfo && (
          <div style={{ marginTop: 10 }}>
            <StatusTag
              tone={selectedYearInfo.etat === 'en cours' || selectedYearInfo.etat === 'en cour' ? 'success' : 'info'}
              icon={<CalendarOutlined />}
              label={`${selectedYearInfo.annee} (${selectedYearInfo.etat})`}
            />
          </div>
        )}
      </Card>

      {!filters.anneeAcademiqueId ? (
        <Alert
          message="Aucune année sélectionnée"
          description="Veuillez sélectionner une année académique pour afficher les paiements."
          type="warning" showIcon
        />
      ) : (
        <>
          {/* ── Stats ────────────────────────────────────────────────── */}
          <Row gutter={16} className="mb-6">
            <Col xs={24} md={8}>
              <Card>
                <Statistic
                  title="Nombre de paiements"
                  value={nombrePaiements}
                  valueStyle={{ color: 'var(--mod-scolarite)' }}
                  prefix={<EyeOutlined />}
                />
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card>
                <Statistic
                  title="Montant total"
                  value={totalMontant}
                  precision={0}
                  valueStyle={{ color: 'var(--success)' }}
                  suffix="FCFA"
                  formatter={(v) => Number(v).toLocaleString('fr-FR')}
                />
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card>
                <Statistic
                  title="Moyenne par paiement"
                  value={moyennePaiement}
                  precision={0}
                  valueStyle={{ color: 'var(--warning)' }}
                  suffix="FCFA"
                  formatter={(v) => Math.round(v as number).toLocaleString('fr-FR')}
                />
              </Card>
            </Col>
          </Row>

          {/* ── Tableau ──────────────────────────────────────────────── */}
          <Card
            title={
              <Space>
                Liste des paiements
                <StatusTag
                  tone={periodeLabel ? 'info' : 'neutral'}
                  label={`${total} résultat(s)${periodeLabel ? ' (période)' : ''}`}
                />
                {selectedYearInfo && (
                  <StatusTag
                    tone={selectedYearInfo.etat === 'en cours' || selectedYearInfo.etat === 'en cour' ? 'success' : 'info'}
                    label={selectedYearInfo.annee}
                  />
                )}
              </Space>
            }
            extra={
              <Dropdown
                menu={{ items: exportItems }}
                trigger={['click']}
                disabled={!paiements.length}
              >
                <Tooltip title="Exporter en Excel selon la période affichée">
                  <Button
                    icon={<FileExcelOutlined style={{ color: 'var(--success)' }} />}
                    disabled={!paiements.length}
                  >
                    Exporter Excel <DownOutlined />
                  </Button>
                </Tooltip>
              </Dropdown>
            }
          >
            <DataTable
              columns={columns}
              dataSource={paiements}
              rowKey="numero_recu"
              loading={loading}
              pagination={{
                current: filters.page,
                pageSize: filters.limit,
                total: total,
                pageSizeOptions: ['10', '20', '50', '100', '500'],
                showTotal: (t, range) =>
                  `${range[0]}-${range[1]} sur ${t} paiements${periodeLabel ? ' • ' + periodeLabel : ''}`,
              }}
              onChange={handleTableChange}
              scroll={{ x: 1200 }}
              emptyTitle={loading
                ? 'Chargement...'
                : periodeLabel
                ? `Aucun paiement pour la période ${periodeLabel} dans ${currentUser.departementName}`
                : `Aucun paiement trouvé pour ${currentUser.departementName}`}
            />
          </Card>
        </>
      )}
    </div>
  );
};

export default Paiements;