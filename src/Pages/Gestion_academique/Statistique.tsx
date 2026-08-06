/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Select, Spin, Table, Progress, Button, message, Dropdown } from 'antd';
import { ReloadOutlined, FileExcelOutlined, FilePdfOutlined, DownOutlined, TeamOutlined, CheckCircleOutlined, CloseCircleOutlined, TrophyOutlined } from '@ant-design/icons';
import PageHeader from '../../Components/PageHeader/PageHeader';
import { apiFetch, ApiError } from '../../lib/api';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import moment from 'moment';

const { Option } = Select;

// ── getUserInfo ────────────────────────────────────────────────────────────
const getUserInfo = () => {
  try {
    const userStr = localStorage.getItem('user');
    if (!userStr) return null;
    const user = JSON.parse(userStr);
    if (!user.departement_id) {
      const deptId = localStorage.getItem('departement_id');
      if (deptId) user.departement_id = parseInt(deptId, 10);
    }
    return user;
  } catch { return null; }
};

interface StatisticData {
  niveau: any[];
  cursus: any[];
  filiere: any[];
  cycle: any[];
  detailed: { resume: { total_etudiants: number; par_cycle: Array<{ cycle: string; total: number }> } } | null;
}

// ── Export Excel ───────────────────────────────────────────────────────────
const exportExcel = (statistiques: StatisticData, anneeLabel: string, deptName: string) => {
  const wb = XLSX.utils.book_new();

  const sheetNiveau = XLSX.utils.json_to_sheet(
    statistiques.niveau.map(r => ({
      'Niveau': r.niveau,
      'Affectés': parseInt(r.etudiants_affectes || '0'),
      'Non Affectés': parseInt(r.etudiants_non_affectes || '0'),
      'Inscriptions': parseInt(r.inscriptions || '0'),
      'Ré-inscriptions': parseInt(r.reinscriptions || '0'),
      'Total': parseInt(r.total || '0'),
    }))
  );
  XLSX.utils.book_append_sheet(wb, sheetNiveau, 'Par Niveau');

  const sheetCursus = XLSX.utils.json_to_sheet(
    statistiques.cursus.map(r => ({
      'Cursus': r.cursus,
      'Affectés': parseInt(r.etudiants_affectes || '0'),
      'Non Affectés': parseInt(r.etudiants_non_affectes || '0'),
      'Inscriptions': parseInt(r.inscriptions || '0'),
      'Ré-inscriptions': parseInt(r.reinscriptions || '0'),
      'Total': parseInt(r.total || '0'),
    }))
  );
  XLSX.utils.book_append_sheet(wb, sheetCursus, 'Par Cursus');

  const sheetCycle = XLSX.utils.json_to_sheet(
    statistiques.cycle.map(r => ({
      'Cycle': r.cycle,
      'Affectés': parseInt(r.etudiants_affectes || '0'),
      'Non Affectés': parseInt(r.etudiants_non_affectes || '0'),
      'Inscriptions': parseInt(r.inscriptions || '0'),
      'Ré-inscriptions': parseInt(r.reinscriptions || '0'),
      'Total': parseInt(r.total || '0'),
    }))
  );
  XLSX.utils.book_append_sheet(wb, sheetCycle, 'Par Cycle');

  XLSX.writeFile(wb, `Statistiques_${deptName}_${anneeLabel}_${moment().format('YYYYMMDD')}.xlsx`);
  message.success('Export Excel réussi');
};

// ── Export PDF ─────────────────────────────────────────────────────────────
const exportPDF = (statistiques: StatisticData, anneeLabel: string, deptName: string) => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const date = moment().format('DD/MM/YYYY');
  const totalEtu = statistiques.detailed?.resume.total_etudiants || 0;

  // Header
  doc.setFillColor(15, 32, 68);
  doc.rect(0, 0, 297, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`Statistiques Académiques — ${deptName}`, 14, 10);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Année : ${anneeLabel}   |   Généré le : ${date}   |   Total étudiants : ${totalEtu}`, 14, 17);

  let y = 30;

  const cols = ['', 'Affectés', 'Non Affectés', 'Inscriptions', 'Ré-inscriptions', 'Total'];
  const headColor: [number, number, number] = [15, 32, 68];

  const makeRows = (data: any[], keyField: string) =>
    data.map(r => [
      r[keyField],
      parseInt(r.etudiants_affectes || '0'),
      parseInt(r.etudiants_non_affectes || '0'),
      parseInt(r.inscriptions || '0'),
      parseInt(r.reinscriptions || '0'),
      parseInt(r.total || '0'),
    ]);

  // Par niveau
  doc.setTextColor(15, 32, 68);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Répartition par Niveau', 14, y);
  y += 4;
  autoTable(doc, {
    startY: y, head: [cols], body: makeRows(statistiques.niveau, 'niveau'),
    headStyles: { fillColor: headColor, textColor: [255,255,255], fontStyle: 'bold', halign: 'center' },
    bodyStyles: { halign: 'center' },
    columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } },
    alternateRowStyles: { fillColor: [245, 247, 252] },
    margin: { left: 14, right: 14 },
  });
  y = (doc as any).lastAutoTable.finalY + 10;

  // Par cursus
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Répartition par Cursus', 14, y);
  y += 4;
  autoTable(doc, {
    startY: y, head: [cols], body: makeRows(statistiques.cursus, 'cursus'),
    headStyles: { fillColor: headColor, textColor: [255,255,255], fontStyle: 'bold', halign: 'center' },
    bodyStyles: { halign: 'center' },
    columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } },
    alternateRowStyles: { fillColor: [245, 247, 252] },
    margin: { left: 14, right: 14 },
  });
  y = (doc as any).lastAutoTable.finalY + 10;

  // Par cycle
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Répartition par Cycle', 14, y);
  y += 4;
  autoTable(doc, {
    startY: y, head: [cols], body: makeRows(statistiques.cycle, 'cycle'),
    headStyles: { fillColor: headColor, textColor: [255,255,255], fontStyle: 'bold', halign: 'center' },
    bodyStyles: { halign: 'center' },
    columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } },
    alternateRowStyles: { fillColor: [245, 247, 252] },
    margin: { left: 14, right: 14 },
  });

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Page ${i} / ${pageCount}`, 297 - 25, 205);
  }

  doc.save(`Statistiques_${deptName}_${anneeLabel}_${moment().format('YYYYMMDD')}.pdf`);
  message.success('Export PDF réussi');
};

// ──────────────────────────────────────────────────────────────────────────
const Statistique = () => {
  const [loading, setLoading] = useState(false);
  const [selectedAnnee, setSelectedAnnee] = useState<string>('');
  const [annees, setAnnees] = useState<any[]>([]);
  const [statistiques, setStatistiques] = useState<StatisticData>({
    niveau: [], cursus: [], filiere: [], cycle: [], detailed: null,
  });

  const currentUser = getUserInfo();
  const departement_id = currentUser?.departement_id;
  const departementName = currentUser?.departementName || ('Département ' + departement_id);

  // ── Charger années du département ──────────────────────────────────────
  useEffect(() => {
    if (!departement_id) return;
    const fetchAnnees = async () => {
      try {
        setLoading(true);
        const data = await apiFetch(`/api/annees?site_id=${departement_id}`);
        if (Array.isArray(data)) {
          setAnnees(data);
          const encours = data.find((a: any) => a.etat === 'en cour' || a.etat === 'en cours');
          if (encours) setSelectedAnnee(encours.id);
          else if (data.length > 0) setSelectedAnnee(data[0].id);
        }
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return;
        message.error('Erreur chargement des années');
      }
      finally { setLoading(false); }
    };
    fetchAnnees();
  }, [departement_id]);

  // ── Charger stats quand année change ──────────────────────────────────
  useEffect(() => {
    if (selectedAnnee && departement_id) fetchStatistics();
  }, [selectedAnnee]);

  const fetchStatistics = async () => {
    try {
      setLoading(true);
      const endpoints = [
        `/api/statistiques/niveau?annee_academique_id=${selectedAnnee}&departement_id=${departement_id}`,
        `/api/statistiques/cursus?annee_academique_id=${selectedAnnee}&departement_id=${departement_id}`,
        `/api/statistiques/filiere?annee_academique_id=${selectedAnnee}&departement_id=${departement_id}`,
        `/api/statistiques/cycle?annee_academique_id=${selectedAnnee}&departement_id=${departement_id}`,
        `/api/statistiques/detailed?annee_academique_id=${selectedAnnee}&departement_id=${departement_id}`,
      ];
      const data = await Promise.all(endpoints.map(p => apiFetch(p)));
      setStatistiques({
        niveau: data[0]?.data || [],
        cursus: data[1]?.data || [],
        filiere: data[2]?.data || [],
        cycle: data[3]?.data || [],
        detailed: data[4]?.data || null,
      });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return;
      message.error('Erreur chargement des statistiques');
    }
    finally { setLoading(false); }
  };

  const selectedAnneeLabel = annees.find(a => a.id === selectedAnnee)?.annee || '';

  const totalAffectes = statistiques.niveau.reduce((s: number, r: any) => s + parseInt(r.etudiants_affectes || '0'), 0);
  const totalNonAffectes = statistiques.niveau.reduce((s: number, r: any) => s + parseInt(r.etudiants_non_affectes || '0'), 0);
  const totalEtu = statistiques.detailed?.resume.total_etudiants || 0;
  const tauxAffectation = totalEtu > 0 ? Math.round((totalAffectes / totalEtu) * 100) : 0;

  // ── Colonnes tableau ───────────────────────────────────────────────────
  const thStyle = { background: 'var(--ink)', color: '#fff', fontWeight: 700, textAlign: 'center' as const };
  const tdCenter = { textAlign: 'center' as const };

  const baseDataCols = [
    { title: 'Affectés', dataIndex: 'etudiants_affectes', key: 'aff', onHeaderCell: () => ({ style: thStyle }), onCell: () => ({ style: tdCenter }),
      render: (v: string) => <span style={{ color: 'var(--success)', fontWeight: 600 }}>{parseInt(v||'0').toLocaleString('fr-FR')}</span> },
    { title: 'Non Affectés', dataIndex: 'etudiants_non_affectes', key: 'naff', onHeaderCell: () => ({ style: thStyle }), onCell: () => ({ style: tdCenter }),
      render: (v: string) => <span style={{ color: 'var(--danger)', fontWeight: 600 }}>{parseInt(v||'0').toLocaleString('fr-FR')}</span> },
    { title: 'Inscriptions', dataIndex: 'inscriptions', key: 'insc', onHeaderCell: () => ({ style: thStyle }), onCell: () => ({ style: tdCenter }),
      render: (v: string) => parseInt(v||'0').toLocaleString('fr-FR') },
    { title: 'Ré-inscriptions', dataIndex: 'reinscriptions', key: 'reinsc', onHeaderCell: () => ({ style: thStyle }), onCell: () => ({ style: tdCenter }),
      render: (v: string) => parseInt(v||'0').toLocaleString('fr-FR') },
    { title: 'Total', dataIndex: 'total', key: 'total', onHeaderCell: () => ({ style: { ...thStyle, background: '#1a3366' } }), onCell: () => ({ style: { ...tdCenter, fontWeight: 700 } }),
      render: (v: string) => <strong>{parseInt(v||'0').toLocaleString('fr-FR')}</strong> },
  ];

  const colsNiveau = [
    { title: 'Niveau', dataIndex: 'niveau', key: 'niveau', onHeaderCell: () => ({ style: thStyle }),
      render: (t: string) => <strong>{t}</strong> },
    ...baseDataCols,
  ];
  const colsCursus = [
    { title: 'Cursus', dataIndex: 'cursus', key: 'cursus', onHeaderCell: () => ({ style: thStyle }),
      render: (t: string) => <strong>{t}</strong> },
    ...baseDataCols,
  ];
  const colsCycle = [
    { title: 'Cycle', dataIndex: 'cycle', key: 'cycle', onHeaderCell: () => ({ style: thStyle }),
      render: (t: string) => <strong>{t}</strong> },
    ...baseDataCols,
  ];

  const summaryRow = (data: any[]) => (
    <Table.Summary fixed>
      <Table.Summary.Row style={{ background: '#f0f4ff', fontWeight: 700 }}>
        <Table.Summary.Cell index={0}><strong style={{ color: 'var(--ink)' }}>Total Général</strong></Table.Summary.Cell>
        {['etudiants_affectes','etudiants_non_affectes','inscriptions','reinscriptions','total'].map((k, i) => (
          <Table.Summary.Cell index={i+1} key={k}>
            <strong>{data.reduce((s,r) => s + parseInt(r[k]||'0'), 0).toLocaleString('fr-FR')}</strong>
          </Table.Summary.Cell>
        ))}
      </Table.Summary.Row>
    </Table.Summary>
  );

  // ── Export dropdown items ──────────────────────────────────────────────
  const exportItems = [
    {
      key: 'excel',
      label: 'Exporter en Excel',
      icon: <FileExcelOutlined style={{ color: 'var(--success)' }} />,
      onClick: () => exportExcel(statistiques, selectedAnneeLabel, departementName),
    },
    {
      key: 'pdf',
      label: 'Exporter en PDF',
      icon: <FilePdfOutlined style={{ color: 'var(--danger)' }} />,
      onClick: () => exportPDF(statistiques, selectedAnneeLabel, departementName),
    },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=Libre+Baskerville:wght@400;700&display=swap');

        .stat-page { font-family: 'Sora', sans-serif; background: #f7f8fc; min-height: 100vh; }

        /* ── KPI cards ── */
        .kpi-card {
          border-radius: 16px !important;
          border: none !important;
          box-shadow: 0 2px 12px rgba(15,32,68,0.07) !important;
          transition: transform 0.2s, box-shadow 0.2s;
          overflow: hidden;
          position: relative;
        }
        .kpi-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 28px rgba(15,32,68,0.13) !important;
        }
        .kpi-card .ant-statistic-title {
          font-family: 'Sora', sans-serif;
          font-size: 11.5px !important;
          font-weight: 600 !important;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: rgba(255,255,255,0.75) !important;
        }
        .kpi-card .ant-statistic-content-value {
          font-family: 'Libre Baskerville', serif !important;
          font-size: 28px !important;
          color: #fff !important;
        }
        .kpi-card .ant-statistic-content-suffix {
          color: rgba(255,255,255,0.8) !important;
          font-size: 16px !important;
        }
        .kpi-accent {
          position: absolute; bottom: 0; right: 0;
          width: 80px; height: 80px; border-radius: 50%;
          background: rgba(255,255,255,0.08);
          transform: translate(20px, 20px);
        }

        /* ── Section headers ── */
        .section-title {
          font-family: 'Libre Baskerville', serif;
          font-size: 17px;
          font-weight: 700;
          color: var(--ink);
          margin: 0 0 16px 0;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .section-title::before {
          content: '';
          display: block;
          width: 4px; height: 20px;
          border-radius: 2px;
          background: linear-gradient(180deg, #4f7ef8, #0f2044);
        }

        /* ── Table cards ── */
        .table-card {
          border-radius: 14px !important;
          border: none !important;
          box-shadow: 0 2px 12px rgba(15,32,68,0.06) !important;
          overflow: hidden;
        }
        .table-card .ant-table-thead > tr > th {
          font-family: 'Sora', sans-serif !important;
          font-size: 12px !important;
          letter-spacing: 0.04em;
          padding: 12px 16px !important;
        }
        .table-card .ant-table-tbody > tr > td {
          font-family: 'Sora', sans-serif !important;
          font-size: 13px !important;
          padding: 10px 16px !important;
        }
        .table-card .ant-table-tbody > tr:hover > td {
          background: #f0f4ff !important;
        }

        /* ── Header bar ── */
        .page-hero {
          background: linear-gradient(135deg, #0f2044 0%, #1a3a70 60%, #1e4d8c 100%);
          border-radius: 18px;
          padding: 28px 32px;
          margin-bottom: 28px;
          position: relative;
          overflow: hidden;
        }
        .page-hero::after {
          content: '';
          position: absolute; top: -40px; right: -40px;
          width: 200px; height: 200px; border-radius: 50%;
          background: rgba(255,255,255,0.04);
        }
        .page-hero::before {
          content: '';
          position: absolute; bottom: -60px; right: 100px;
          width: 280px; height: 280px; border-radius: 50%;
          background: rgba(79,126,248,0.08);
        }
        .hero-title {
          font-family: 'Libre Baskerville', serif;
          font-size: 22px; font-weight: 700;
          color: #fff; margin: 0 0 4px;
        }
        .hero-sub {
          font-size: 13px; color: rgba(255,255,255,0.55);
          font-family: 'Sora', sans-serif;
        }

        /* ── Filter bar ── */
        .filter-bar {
          background: #fff;
          border-radius: 14px;
          padding: 20px 24px;
          margin-bottom: 28px;
          box-shadow: 0 2px 10px rgba(15,32,68,0.05);
          display: flex;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
        }
        .filter-label {
          font-size: 11px; font-weight: 600;
          text-transform: uppercase; letter-spacing: 0.07em;
          color: #9ca3af; margin-bottom: 4px;
        }

        /* ── Filière cards ── */
        .filiere-card {
          border-radius: 14px !important;
          border: none !important;
          box-shadow: 0 2px 12px rgba(15,32,68,0.07) !important;
          margin-bottom: 20px;
          overflow: hidden;
        }
        .filiere-header {
          background: linear-gradient(90deg, #f0f4ff, #e8f0ff);
          padding: 16px 20px;
          display: flex; align-items: center; justify-content: space-between;
          border-bottom: 1px solid #e8edf7;
        }
        .filiere-name {
          font-family: 'Libre Baskerville', serif;
          font-size: 15px; font-weight: 700; color: var(--ink);
        }
        .filiere-badge {
          background: var(--ink); color: #fff;
          border-radius: 20px; padding: 4px 14px;
          font-size: 12px; font-weight: 600;
          font-family: 'Sora', sans-serif;
        }

        /* ── Progress bars ── */
        .taux-row { display: flex; align-items: center; gap: 10px; margin-top: 6px; }
        .taux-label { font-size: 11px; color: #6b7280; min-width: 80px; }

        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .stat-section { animation: fadeInUp 0.4s ease both; }
        .stat-section:nth-child(2) { animation-delay: 0.08s; }
        .stat-section:nth-child(3) { animation-delay: 0.16s; }
        .stat-section:nth-child(4) { animation-delay: 0.24s; }
      `}</style>

      <div className="stat-page">
        <div style={{ padding: '24px 28px' }}>
          <PageHeader />

          {/* ── Hero header ─────────────────────────────────────────── */}
          <div className="page-hero">
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                <div>
                  <p className="hero-title">Statistiques Académiques</p>
                  <p className="hero-sub">{departementName} — données en temps réel</p>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <Button
                    icon={<ReloadOutlined />}
                    onClick={fetchStatistics}
                    loading={loading}
                    style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: 10, fontFamily: 'Sora' }}
                  >
                    Actualiser
                  </Button>
                  <Dropdown menu={{ items: exportItems }} trigger={['click']} disabled={!statistiques.niveau.length}>
                    <Button
                      icon={<DownOutlined />}
                      style={{ background: 'rgba(79,126,248,0.85)', border: 'none', color: '#fff', borderRadius: 10, fontFamily: 'Sora', fontWeight: 600 }}
                    >
                      Exporter
                    </Button>
                  </Dropdown>
                </div>
              </div>
            </div>
          </div>

          {/* ── Filter bar ──────────────────────────────────────────── */}
          <div className="filter-bar">
            <div>
              <div className="filter-label">Année académique</div>
              <Select
                value={selectedAnnee}
                onChange={setSelectedAnnee}
                style={{ width: 220, fontFamily: 'Sora' }}
                loading={loading}
                placeholder="Sélectionner une année"
              >
                {annees.map(a => (
                  <Option key={a.id} value={a.id}>
                    {a.annee} {(a.etat === 'en cour' || a.etat === 'en cours') ? '• En cours' : ''}
                  </Option>
                ))}
              </Select>
            </div>
            <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
              <div className="filter-label">Département</div>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', fontFamily: 'Sora' }}>
                {departementName}
              </span>
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '80px 0' }}>
              <Spin size="large" />
              <p style={{ marginTop: 16, color: '#9ca3af', fontFamily: 'Sora', fontSize: 13 }}>Chargement des statistiques…</p>
            </div>
          ) : (
            <>
              {/* ── KPI row ─────────────────────────────────────────── */}
              {statistiques.detailed && (
                <Row gutter={[16, 16]} style={{ marginBottom: 32 }} className="stat-section">
                  {[
                    { title: 'Total Étudiants', value: totalEtu, icon: <TeamOutlined />, bg: 'linear-gradient(135deg, #0f2044, #1e4d8c)', suffix: '' },
                    { title: 'Étudiants Affectés', value: totalAffectes, icon: <CheckCircleOutlined />, bg: 'linear-gradient(135deg, #166534, #22c55e)', suffix: '' },
                    { title: 'Non Affectés', value: totalNonAffectes, icon: <CloseCircleOutlined />, bg: 'linear-gradient(135deg, #991b1b, #ef4444)', suffix: '' },
                    { title: "Taux d'Affectation", value: tauxAffectation, icon: <TrophyOutlined />, bg: 'linear-gradient(135deg, #92400e, #f59e0b)', suffix: '%' },
                  ].map((kpi, i) => (
                    <Col xs={24} sm={12} lg={6} key={i}>
                      <Card className="kpi-card" style={{ background: kpi.bg }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                          <span style={{ fontSize: 20, color: 'rgba(255,255,255,0.7)' }}>{kpi.icon}</span>
                        </div>
                        <Statistic
                          title={kpi.title}
                          value={kpi.value}
                          suffix={kpi.suffix}
                          valueStyle={{ color: '#fff', fontFamily: 'Libre Baskerville, serif', fontSize: 28 }}
                        />
                        {kpi.suffix === '%' && (
                          <Progress
                            percent={kpi.value as number}
                            showInfo={false}
                            strokeColor="rgba(255,255,255,0.7)"
                            trailColor="rgba(255,255,255,0.2)"
                            style={{ marginTop: 8 }}
                            size="small"
                          />
                        )}
                        <div className="kpi-accent" />
                      </Card>
                    </Col>
                  ))}
                </Row>
              )}

              {/* ── Par niveau ──────────────────────────────────────── */}
              <div className="stat-section" style={{ marginBottom: 32 }}>
                <p className="section-title">Répartition par Niveau</p>
                <Card className="table-card">
                  <Table
                    columns={colsNiveau}
                    dataSource={statistiques.niveau}
                    rowKey="niveau"
                    pagination={false}
                    scroll={{ x: 700 }}
                    summary={() => summaryRow(statistiques.niveau)}
                    size="middle"
                  />
                </Card>
              </div>

              {/* ── Par cursus ──────────────────────────────────────── */}
              <div className="stat-section" style={{ marginBottom: 32 }}>
                <p className="section-title">Répartition par Cursus</p>
                <Card className="table-card">
                  <Table
                    columns={colsCursus}
                    dataSource={statistiques.cursus}
                    rowKey="cursus_id"
                    pagination={false}
                    scroll={{ x: 700 }}
                    size="middle"
                  />
                </Card>
              </div>

              {/* ── Par cycle ───────────────────────────────────────── */}
              <div className="stat-section" style={{ marginBottom: 32 }}>
                <p className="section-title">Répartition par Cycle</p>
                <Card className="table-card">
                  <Table
                    columns={colsCycle}
                    dataSource={statistiques.cycle}
                    rowKey="cycle_id"
                    pagination={false}
                    scroll={{ x: 700 }}
                    size="middle"
                  />
                </Card>
              </div>

              {/* ── Par filière ─────────────────────────────────────── */}
              <div className="stat-section">
                <p className="section-title">Détails par Filière</p>
                {statistiques.filiere.length > 0 ? (
                  statistiques.filiere.map((filiere: any) => {
                    const total = parseInt(filiere.total_general || '0');
                    const affPct = total > 0 ? Math.round((parseInt(filiere.total_etudiants_affectes||'0') / total) * 100) : 0;
                    return (
                      <Card key={filiere.filiere_id} className="filiere-card">
                        <div className="filiere-header">
                          <div>
                            <span className="filiere-name">{filiere.filiere}</span>
                            <span style={{ marginLeft: 10, fontSize: 12, color: '#6b7280', fontFamily: 'Sora' }}>
                              {filiere.sigle} · {filiere.type_filiere}
                            </span>
                          </div>
                          <span className="filiere-badge">
                            {total.toLocaleString('fr-FR')} étudiants
                          </span>
                        </div>

                        <div style={{ padding: '20px 20px 12px' }}>
                          <Row gutter={[16, 12]}>
                            <Col xs={24} md={5}>
                              <div style={{ textAlign: 'center', paddingTop: 8 }}>
                                <Progress
                                  type="circle"
                                  percent={affPct}
                                  width={90}
                                  strokeColor={{ '0%': '#4f7ef8', '100%': '#22c55e' }}
                                  format={p => (
                                    <div>
                                      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', fontFamily: 'Libre Baskerville' }}>{p}%</div>
                                      <div style={{ fontSize: 9, color: '#9ca3af', fontFamily: 'Sora' }}>Affectés</div>
                                    </div>
                                  )}
                                />
                              </div>
                            </Col>
                            <Col xs={24} md={19}>
                              <Row gutter={[10, 10]}>
                                {[
                                  { label: 'Affectés', val: filiere.total_etudiants_affectes, color: 'var(--success)', bg: '#f0fdf4' },
                                  { label: 'Non Affectés', val: filiere.total_etudiants_non_affectes, color: 'var(--danger)', bg: '#fef2f2' },
                                  { label: 'Inscriptions', val: filiere.total_inscriptions, color: 'var(--mod-scolarite)', bg: '#eff6ff' },
                                  { label: 'Ré-inscriptions', val: filiere.total_reinscriptions, color: 'var(--warning)', bg: '#fffbeb' },
                                ].map((s, i) => (
                                  <Col xs={12} md={6} key={i}>
                                    <div style={{ background: s.bg, borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
                                      <div style={{ fontSize: 20, fontWeight: 700, color: s.color, fontFamily: 'Libre Baskerville' }}>
                                        {parseInt(s.val || '0').toLocaleString('fr-FR')}
                                      </div>
                                      <div style={{ fontSize: 10, color: '#6b7280', fontFamily: 'Sora', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        {s.label}
                                      </div>
                                    </div>
                                  </Col>
                                ))}
                              </Row>
                            </Col>
                          </Row>

                          <div style={{ marginTop: 16 }}>
                            <Table
                              columns={colsNiveau}
                              dataSource={filiere.niveaux}
                              rowKey="niveau"
                              size="small"
                              pagination={false}
                              scroll={{ x: 700 }}
                            />
                          </div>
                        </div>
                      </Card>
                    );
                  })
                ) : (
                  <Card className="table-card" style={{ textAlign: 'center', padding: '48px 0' }}>
                    <p style={{ color: '#9ca3af', fontFamily: 'Sora', fontSize: 14 }}>
                      Aucune donnée de filière disponible pour cette sélection.
                    </p>
                  </Card>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default Statistique;