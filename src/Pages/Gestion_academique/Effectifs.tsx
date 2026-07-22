/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect } from 'react';
import { 
  Card, 
  Table, 
  Typography, 
  Row, 
  Col, 
  Statistic,
  Select,
  Spin,
  message,
  Tag,
  Alert,
  Button,
  Space,
  Dropdown,
} from 'antd';
import { 
  TeamOutlined, 
  UserOutlined,
  BarChartOutlined,
  DownloadOutlined,
  FileExcelOutlined,
  FilePdfOutlined,
} from '@ant-design/icons';
import PageHeader from '../../Components/PageHeader/PageHeader';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const { Title, Text } = Typography;
const { Option } = Select;

/* ─────────────────────────────────── INTERFACES ─────────────────────────────── */
interface EffectifData {
  filiere: string;
  filiere_sigle: string;
  niveau: string;
  cycle: string;
  nombre_inscrits: number;
}

interface AnneeAcademique {
  id: number;
  annee: string;
  etat: string;
}

interface EffectifsResponse {
  message: string;
  success: boolean;
  data: {
    effectifs: EffectifData[];
    total_inscrits: number;
  };
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

/* ─────────────────────────────────── HELPERS ─────────────────────────────────── */
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

const getCycleColor = (cycle: string) => {
  if (!cycle) return 'gray';
  const colors: { [key: string]: string } = {
    'licence':   'blue',
    'master':    'green',
    'doctorat':  'purple',
    'ingénieur': 'orange',
    'bts':       'cyan',
    'default':   'gray',
  };
  return colors[cycle.toLowerCase()] || colors.default;
};

/* ─────────────────────────────────── COMPONENT ──────────────────────────────── */
const Effectifs = () => {
  const [effectifs,        setEffectifs]        = useState<EffectifData[]>([]);
  const [annees,           setAnnees]           = useState<AnneeAcademique[]>([]);
  const [selectedAnnee,    setSelectedAnnee]    = useState<number | null>(null);
  const [selectedAnneeInfo,setSelectedAnneeInfo]= useState<{ annee: string; etat: string } | null>(null);
  const [currentUser,      setCurrentUser]      = useState<UserInfo | null>(null);
  const [loading,          setLoading]          = useState(true);
  const [loadingYears,     setLoadingYears]     = useState(false);
  const [exportingExcel,   setExportingExcel]   = useState(false);
  const [exportingPdf,     setExportingPdf]     = useState(false);
  const [totalInscrits,    setTotalInscrits]    = useState(0);
  const [initialYearSet,   setInitialYearSet]   = useState(false);

  const API_URL = import.meta.env.VITE_API_URL_SERVER || '';

  /* ── Chargement utilisateur ── */
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

  /* ── Années académiques filtrées par département ── */
  useEffect(() => {
    const fetchAnnees = async () => {
      if (!currentUser?.departement_id) return;
      setLoadingYears(true);
      try {
        const token = localStorage.getItem('token');
        if (!token) { message.error('Authentification requise'); setLoading(false); return; }

        const res = await fetch(
          `${API_URL}/api/annees?site_id=${currentUser.departement_id}`,
          { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } }
        );

        if (res.status === 401) {
          message.error('Session expirée, veuillez vous reconnecter');
          localStorage.removeItem('token');
          setLoading(false);
          return;
        }
        if (!res.ok) throw new Error(`Erreur ${res.status}`);

        const data = await res.json();
        if (Array.isArray(data)) {
          setAnnees(data);
          const current = data.find((y: AnneeAcademique) =>
            ['en cours', 'en cour', 'active'].includes(y.etat?.toLowerCase())
          );
          const pick = current || data[0];
          if (pick) {
            setSelectedAnnee(pick.id);
            setSelectedAnneeInfo({ annee: pick.annee, etat: pick.etat });
          }
          setInitialYearSet(true);
        } else throw new Error('Format de réponse inattendu');
      } catch (err) {
        console.error(err);
        message.error('Erreur lors du chargement des années académiques');
      } finally {
        setLoadingYears(false);
      }
    };
    fetchAnnees();
  }, [API_URL, currentUser]);

  /* ── Effectifs ── */
  useEffect(() => {
    if (initialYearSet && selectedAnnee && currentUser?.departement_id) {
      fetchEffectifs(selectedAnnee);
    }
  }, [selectedAnnee, initialYearSet, currentUser]);

  const fetchEffectifs = async (anneeId: number) => {
    if (!currentUser?.departement_id) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) { message.error('Authentification requise'); return; }

      const res = await fetch(
        `${API_URL}/api/effectifs/effectifs?annee_id=${anneeId}&departement_id=${currentUser.departement_id}`,
        { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } }
      );

      if (res.status === 401) {
        message.error('Session expirée'); localStorage.removeItem('token'); return;
      }

      const data: EffectifsResponse = await res.json();
      if (data.success) {
        setEffectifs(data.data.effectifs);
        setTotalInscrits(data.data.total_inscrits);
      } else {
        message.error(data.message || 'Erreur chargement effectifs');
        setEffectifs([]); setTotalInscrits(0);
      }
    } catch (err) {
      console.error(err);
      message.error('Erreur lors du chargement des effectifs');
      setEffectifs([]); setTotalInscrits(0);
    } finally {
      setLoading(false);
    }
  };

  /* ── Statistiques dérivées ── */
  const totalsByFiliere = effectifs.reduce((acc, curr) => {
    acc[curr.filiere] = (acc[curr.filiere] || 0) + curr.nombre_inscrits;
    return acc;
  }, {} as Record<string, number>);

  const nbFilieres = Object.keys(totalsByFiliere).length;
  const nbNiveaux  = new Set(effectifs.map(e => e.niveau)).size;
  const moyFiliere = totalInscrits > 0 && nbFilieres > 0
    ? (totalInscrits / nbFilieres).toFixed(1)
    : '0';

  /* ──────────────────────── EXPORT EXCEL ──────────────────────── */
  const handleExportExcel = () => {
    if (effectifs.length === 0) { message.warning('Aucune donnée à exporter'); return; }
    setExportingExcel(true);

    try {
      const anneeLabel = selectedAnneeInfo?.annee || 'N/A';
      const dept       = currentUser?.departementName || 'Département';

      // Ligne de titre
      const titleRow   = [`RÉCAPITULATIF DES INSCRIPTIONS — ${dept.toUpperCase()} — Année ${anneeLabel}`];
      const headerRow  = ['Filière', 'Sigle', 'Niveau', 'Cycle', "Nombre d'inscrits", 'Pourcentage (%)'];

      const dataRows = effectifs.map(e => [
        e.filiere,
        e.filiere_sigle,
        e.niveau,
        e.cycle?.toUpperCase() || '',
        e.nombre_inscrits,
        totalInscrits > 0
          ? `${((e.nombre_inscrits / totalInscrits) * 100).toFixed(1)}%`
          : '0%',
      ]);

      const totalRow = ['TOTAL GÉNÉRAL', '', '', '', totalInscrits, '100%'];

      const wsData = [titleRow, [], headerRow, ...dataRows, [], totalRow];
      const ws     = XLSX.utils.aoa_to_sheet(wsData);

      // Largeurs colonnes
      ws['!cols'] = [
        { wch: 45 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 18 }, { wch: 16 },
      ];

      // Fusion pour la ligne de titre
      ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Effectifs');

      const dateStr  = new Date().toISOString().slice(0, 10);
      const anneeStr = anneeLabel.replace(/\//g, '-');
      XLSX.writeFile(wb, `effectifs_${anneeStr}_${dateStr}.xlsx`);

      message.success(`${effectifs.length} lignes exportées en Excel`);
    } catch (err) {
      console.error(err);
      message.error("Erreur lors de l'export Excel");
    } finally {
      setExportingExcel(false);
    }
  };

  /* ──────────────────────── EXPORT PDF ──────────────────────── */
  const handleExportPdf = () => {
    if (effectifs.length === 0) { message.warning('Aucune donnée à exporter'); return; }
    setExportingPdf(true);

    try {
      const anneeLabel = selectedAnneeInfo?.annee || 'N/A';
      const dept       = currentUser?.departementName || 'Département';
      const dateStr    = new Date().toLocaleDateString('fr-FR');

      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

      // ── En-tête ──
      doc.setFillColor(26, 92, 82);           // teal-deep
      doc.rect(0, 0, 297, 28, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('RÉCAPITULATIF DES INSCRIPTIONS', 14, 11);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`${dept}  ·  Année académique : ${anneeLabel}`, 14, 20);

      doc.setFontSize(9);
      doc.text(`Généré le ${dateStr}`, 297 - 14, 20, { align: 'right' });

      // ── KPI bar ──
      const kpis = [
        { label: 'Total inscrits', value: String(totalInscrits) },
        { label: 'Filières',       value: String(nbFilieres) },
        { label: 'Niveaux',        value: String(nbNiveaux) },
        { label: 'Moy./filière',   value: moyFiliere },
      ];
      const kpiW   = (297 - 28) / kpis.length;
      const kpiY   = 32;
      const kpiH   = 16;

      kpis.forEach((k, i) => {
        const x = 14 + i * kpiW;
        doc.setFillColor(230, 244, 241);   // teal-pale
        doc.roundedRect(x, kpiY, kpiW - 4, kpiH, 2, 2, 'F');
        doc.setTextColor(26, 92, 82);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.text(k.value, x + (kpiW - 4) / 2, kpiY + 8, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(100, 130, 125);
        doc.text(k.label.toUpperCase(), x + (kpiW - 4) / 2, kpiY + 13, { align: 'center' });
      });

      // ── Tableau ──
      const tableHead = [['Filière', 'Sigle', 'Niveau', 'Cycle', "Nb inscrits", '%']];
      const tableBody = effectifs.map(e => [
        e.filiere,
        e.filiere_sigle,
        e.niveau,
        e.cycle?.toUpperCase() || '',
        String(e.nombre_inscrits),
        totalInscrits > 0
          ? `${((e.nombre_inscrits / totalInscrits) * 100).toFixed(1)}%`
          : '0%',
      ]);

      // Ligne total
      tableBody.push(['TOTAL GÉNÉRAL', '', '', '', String(totalInscrits), '100%']);

      autoTable(doc, {
        startY: kpiY + kpiH + 6,
        head:   tableHead,
        body:   tableBody,
        styles: {
          font:      'helvetica',
          fontSize:  9,
          cellPadding: 3,
        },
        headStyles: {
          fillColor:  [42, 122, 110],   // teal-mid
          textColor:  [255, 255, 255],
          fontStyle:  'bold',
          fontSize:   9,
        },
        alternateRowStyles: {
          fillColor: [250, 247, 242],   // ivory
        },
        didParseCell: (data) => {
          // Ligne total en gras
          if (data.row.index === tableBody.length - 1) {
            data.cell.styles.fontStyle   = 'bold';
            data.cell.styles.fillColor   = [230, 244, 241];
            data.cell.styles.textColor   = [26, 92, 82];
          }
          // Colonnes numériques centrées
          if (data.column.index >= 4) {
            data.cell.styles.halign = 'center';
          }
        },
        columnStyles: {
          0: { cellWidth: 70 },
          1: { cellWidth: 20 },
          2: { cellWidth: 25 },
          3: { cellWidth: 25 },
          4: { cellWidth: 25, halign: 'center' },
          5: { cellWidth: 22, halign: 'center' },
        },
        margin: { left: 14, right: 14 },
      });

      // ── Pied de page ──
      const pageCount = (doc as jsPDF & { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(160, 160, 160);
        doc.text(
          `Page ${i} / ${pageCount}  —  Document généré automatiquement`,
          297 / 2, 205, { align: 'center' }
        );
      }

      const anneeStr = anneeLabel.replace(/\//g, '-');
      doc.save(`effectifs_${anneeStr}_${new Date().toISOString().slice(0, 10)}.pdf`);
      message.success('Export PDF généré avec succès');
    } catch (err) {
      console.error(err);
      message.error("Erreur lors de l'export PDF");
    } finally {
      setExportingPdf(false);
    }
  };

  /* ── Colonnes table ── */
  const columns = [
    {
      title: 'Filière',
      dataIndex: 'filiere',
      key: 'filiere',
      render: (text: string, record: EffectifData) => (
        <div>
          <div style={{ fontWeight: 'bold' }}>{text}</div>
          <Text type="secondary">({record.filiere_sigle})</Text>
        </div>
      ),
      sorter: (a: EffectifData, b: EffectifData) => a.filiere.localeCompare(b.filiere),
    },
    {
      title: 'Niveau',
      dataIndex: 'niveau',
      key: 'niveau',
      sorter: (a: EffectifData, b: EffectifData) => a.niveau.localeCompare(b.niveau),
    },
    {
      title: 'Cycle',
      dataIndex: 'cycle',
      key: 'cycle',
      render: (cycle: string) => (
        <Tag color={getCycleColor(cycle)}>{cycle?.toUpperCase()}</Tag>
      ),
      sorter: (a: EffectifData, b: EffectifData) => (a.cycle || '').localeCompare(b.cycle || ''),
    },
    {
      title: "Nombre d'Inscrits",
      dataIndex: 'nombre_inscrits',
      key: 'nombre_inscrits',
      render: (nombre: number) => (
        <Text strong style={{ color: nombre > 0 ? '#1890ff' : '#999' }}>{nombre}</Text>
      ),
      sorter: (a: EffectifData, b: EffectifData) => a.nombre_inscrits - b.nombre_inscrits,
      align: 'center' as const,
    },
    {
      title: 'Pourcentage',
      key: 'pourcentage',
      render: (_: unknown, record: EffectifData) => (
        <Text type="secondary">
          {totalInscrits > 0 ? ((record.nombre_inscrits / totalInscrits) * 100).toFixed(1) : 0}%
        </Text>
      ),
      align: 'center' as const,
    },
  ];

  /* ── Dropdown items ── */
  const exportMenuItems = [
    {
      key: 'excel',
      label: (
        <span>
          <FileExcelOutlined style={{ color: '#16A34A', marginRight: 8 }} />
          Exporter en Excel
        </span>
      ),
      onClick: handleExportExcel,
    },
    {
      key: 'pdf',
      label: (
        <span>
          <FilePdfOutlined style={{ color: '#DC2626', marginRight: 8 }} />
          Exporter en PDF
        </span>
      ),
      onClick: handleExportPdf,
    },
  ];

  /* ── Guards ── */
  if (!currentUser) {
    return (
      <div>
        <PageHeader />
        <div style={{ padding: '24px' }}>
          <Alert
            message="Accès non autorisé"
            description="Impossible de récupérer vos informations utilisateur. Veuillez vous reconnecter."
            type="error" showIcon
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
            type="warning" showIcon
          />
        </div>
      </div>
    );
  }

  const canExport = effectifs.length > 0 && !loading;

  /* ─────────────────────────── RENDER ─────────────────────────── */
  return (
    <div>
      <PageHeader />

      <div style={{ padding: '24px' }}>
        <Card>
          {/* ── Titre + bouton export ── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
            <Title level={2} style={{ margin: 0 }}>
              <BarChartOutlined /> RÉCAPITULATIF DES INSCRIPTIONS
            </Title>

            <Dropdown
              menu={{ items: exportMenuItems }}
              placement="bottomRight"
              disabled={!canExport}
            >
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                loading={exportingExcel || exportingPdf}
                disabled={!canExport}
                style={{
                  background: canExport ? 'linear-gradient(135deg, #2A7A6E, #1A5C52)' : undefined,
                  border: 'none',
                  borderRadius: 8,
                  fontWeight: 600,
                }}
              >
                <Space>
                  Exporter
                  <span style={{ fontSize: 10, opacity: 0.8 }}>▾</span>
                </Space>
              </Button>
            </Dropdown>
          </div>

          {/* ── Info département ── */}
          <Alert
            message={`Données filtrées pour ${currentUser.departementName || 'votre département'}`}
            description={`Vous visualisez uniquement les effectifs du département ${currentUser.departementName || ''}.`}
            type="info" showIcon
            style={{ marginBottom: 16 }}
            closable
          />

          {/* ── Filtres + KPIs ── */}
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col xs={24} md={8}>
              <div style={{ marginBottom: 8 }}>
                <Text strong>Année Académique :</Text>
              </div>
              <Select
                value={selectedAnnee}
                onChange={(value: number) => {
                  const y = annees.find(a => a.id === value);
                  if (y) setSelectedAnneeInfo({ annee: y.annee, etat: y.etat });
                  setSelectedAnnee(value);
                }}
                style={{ width: '100%' }}
                loading={loadingYears}
                placeholder="Sélectionner une année"
              >
                {annees.map(a => (
                  <Option key={a.id} value={a.id}>{a.annee} ({a.etat})</Option>
                ))}
              </Select>
              {selectedAnneeInfo && (
                <div style={{ marginTop: 8 }}>
                  <Tag color={['en cours','en cour','active'].includes(selectedAnneeInfo.etat?.toLowerCase()) ? 'green' : 'blue'}>
                    {selectedAnneeInfo.annee} ({selectedAnneeInfo.etat})
                  </Tag>
                </div>
              )}
            </Col>

            <Col xs={24} md={16}>
              <Row gutter={16}>
                <Col xs={12} md={6}>
                  <Statistic title="Total Inscrits" value={totalInscrits}
                    prefix={<TeamOutlined />} valueStyle={{ color: '#1890ff' }} />
                </Col>
                <Col xs={12} md={6}>
                  <Statistic title="Filières" value={nbFilieres}
                    prefix={<BarChartOutlined />} valueStyle={{ color: '#52c41a' }} />
                </Col>
                <Col xs={12} md={6}>
                  <Statistic title="Niveaux" value={nbNiveaux}
                    prefix={<UserOutlined />} valueStyle={{ color: '#faad14' }} />
                </Col>
                <Col xs={12} md={6}>
                  <Statistic title="Moyenne/Filière" value={moyFiliere}
                    valueStyle={{ color: '#722ed1' }} />
                </Col>
              </Row>
            </Col>
          </Row>

          {/* ── Contenu principal ── */}
          {!selectedAnnee ? (
            <Alert
              message="Aucune année sélectionnée"
              description="Veuillez sélectionner une année académique pour afficher les effectifs."
              type="warning" showIcon
            />
          ) : loading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <Spin size="large" />
              <div style={{ marginTop: 16 }}>Chargement des effectifs…</div>
            </div>
          ) : effectifs.length === 0 ? (
            <Alert
              message="Aucune donnée disponible"
              description={`Aucun étudiant inscrit pour l'année ${selectedAnneeInfo?.annee || 'sélectionnée'} dans votre département.`}
              type="info" showIcon
            />
          ) : (
            <Table
              columns={columns}
              dataSource={effectifs}
              rowKey={r => `${r.filiere}-${r.niveau}-${r.cycle}`}
              pagination={false}
              bordered
              size="middle"
              scroll={{ x: 800 }}
              summary={() => (
                <Table.Summary fixed>
                  <Table.Summary.Row style={{ fontWeight: 'bold', backgroundColor: '#fafafa' }}>
                    <Table.Summary.Cell index={0} colSpan={3}>
                      <Text strong>TOTAL GÉNÉRAL</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="center">
                      <Text strong style={{ color: '#1890ff' }}>{totalInscrits}</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={2} align="center">
                      <Text strong>100%</Text>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                </Table.Summary>
              )}
            />
          )}
        </Card>
      </div>
    </div>
  );
};

export default Effectifs;