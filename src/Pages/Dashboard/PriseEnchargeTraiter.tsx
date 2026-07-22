/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react';
import {
  Table, Tag, Spin, message, Descriptions,
  Row, Col, Statistic, Modal, Button, Divider, Progress, Alert, Select, Dropdown
} from 'antd';
import {
  DollarOutlined, CheckCircleOutlined, FileTextOutlined,
  CalendarOutlined, UserOutlined, BookOutlined, PercentageOutlined,
  CloseCircleOutlined, ExclamationCircleOutlined, ReloadOutlined,
  FileExcelOutlined, FilePdfOutlined, DownOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import PageHeader from '../../Components/PageHeader/PageHeader';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import moment from 'moment';
import { apiFetch, ApiError } from '../../lib/api';

const { Option } = Select;

interface PECData {
  pec_id: number; type_pec: string; pourcentage_reduction: number;
  montant_reduction: number; reference: string; date_demande: string;
  date_validation: string; statut: string; motif_refus?: string;
  etudiant_id: number; matricule_iipea: string; nom: string; prenoms: string;
  telephone: string; email: string; filiere: string; filiere_sigle: string;
  niveau: string; montant_scolarite: number; scolarite_verse: number;
  scolarite_restante: number; statut_etudiant: string;
  reduction_calculee: number; total_verse_virtuel: number; restant_virtuel: number;
}
interface StatsData {
  total_pec_traitees: number; total_validees: number; total_refusees: number;
  total_reduction: number; moyenne_reduction: number; type_pec: string; count_type: number;
}
interface AcademicYear { id: number; annee: string; etat: string; }

// ── getUserInfo ────────────────────────────────────────────────────────────
const getUserInfo = () => {
  try {
    const u = localStorage.getItem('user');
    if (!u) return null;
    const user = JSON.parse(u);
    if (!user.departement_id) {
      const d = localStorage.getItem('departement_id');
      if (d) user.departement_id = parseInt(d, 10);
    }
    return user;
  } catch { return null; }
};

const fmt = (n: number | string | undefined | null): number => {
  if (n === undefined || n === null) return 0;
  const v = typeof n === 'string' ? parseFloat(n) : n;
  return isNaN(v) ? 0 : Math.round(v);
};

const typePecColor = (t: string) =>
  ({ Entreprise: 'blue', Gouvernement: 'green', Partenaire: 'orange', Autre: 'purple' }[t] ?? 'default');

// ── Export Excel ─────────────────────────────────────────────────────────
const exportExcel = (data: PECData[], annee: string, dept: string) => {
  if (!data.length) { message.warning('Aucune donnée'); return; }
  const rows = data.map(p => ({
    'Matricule': p.matricule_iipea,
    'Nom & Prénom': `${p.nom} ${p.prenoms}`,
    'Filière': `${p.filiere} (${p.filiere_sigle})`,
    'Niveau': p.niveau,
    'Type PEC': p.type_pec,
    'Statut': p.statut === 'valide' ? 'Validée' : 'Refusée',
    'Réd. (%)': fmt(p.pourcentage_reduction),
    'Réd. (FCFA)': fmt(p.montant_reduction),
    'Scol. totale': fmt(p.montant_scolarite),
    'Payé': fmt(p.scolarite_verse),
    'Reste': fmt(p.scolarite_restante),
    'Date demande': p.date_demande ? moment(p.date_demande).format('DD/MM/YYYY') : '-',
    'Date validation': p.date_validation ? moment(p.date_validation).format('DD/MM/YYYY') : '-',
    'Motif refus': p.motif_refus || '',
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [14,24,22,10,14,10,10,14,14,12,12,14,14,20].map(w => ({ wch: w }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'PEC Traitées');
  XLSX.writeFile(wb, `PEC_Traitees_${dept}_${annee}_${moment().format('YYYYMMDD')}.xlsx`);
  message.success('Export Excel réussi');
};

// ── Export PDF ────────────────────────────────────────────────────────────
const exportPDF = (data: PECData[], annee: string, dept: string, stats: { totalValidees: number; totalRefusees: number; totalReduction: number }) => {
  if (!data.length) { message.warning('Aucune donnée'); return; }
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  // Header
  doc.setFillColor(30, 58, 138);
  doc.rect(0, 0, 297, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13); doc.setFont('helvetica', 'bold');
  doc.text(`PEC Traitées — ${dept}`, 14, 10);
  doc.setFontSize(9); doc.setFont('helvetica', 'normal');
  doc.text(`Année : ${annee}   |   Validées : ${stats.totalValidees}   |   Refusées : ${stats.totalRefusees}   |   Réduction totale : ${stats.totalReduction.toLocaleString('fr-FR')} FCFA   |   ${moment().format('DD/MM/YYYY')}`, 14, 17);

  autoTable(doc, {
    startY: 28,
    head: [['Étudiant', 'Matricule', 'Filière/Niv.', 'Type', 'Statut', 'Réd.%', 'Réd. FCFA', 'Payé', 'Reste', 'Date valid.']],
    body: data.map(p => [
      `${p.nom} ${p.prenoms}`,
      p.matricule_iipea,
      `${p.filiere_sigle} / ${p.niveau}`,
      p.type_pec,
      p.statut === 'valide' ? 'Validée' : 'Refusée',
      `${fmt(p.pourcentage_reduction)}%`,
      fmt(p.montant_reduction).toLocaleString('fr-FR'),
      fmt(p.scolarite_verse).toLocaleString('fr-FR'),
      fmt(p.scolarite_restante).toLocaleString('fr-FR'),
      p.date_validation ? moment(p.date_validation).format('DD/MM/YYYY') : '-',
    ]),
    headStyles: { fillColor: [30, 58, 138], textColor: [255,255,255], fontStyle: 'bold', halign: 'center', fontSize: 8 },
    bodyStyles: { fontSize: 8, halign: 'center' },
    columnStyles: { 0: { halign: 'left' }, 1: { halign: 'left' } },
    alternateRowStyles: { fillColor: [239, 246, 255] },
    didDrawCell: (hookData: any) => {
      if (hookData.section === 'body' && hookData.column.index === 4) {
        const val = hookData.cell.raw as string;
        hookData.cell.styles.textColor = val === 'Validée' ? [5, 150, 105] : [220, 38, 38];
        hookData.cell.styles.fontStyle = 'bold';
      }
    },
    margin: { left: 10, right: 10 },
  });

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i); doc.setFontSize(8); doc.setTextColor(150);
    doc.text(`Page ${i}/${pages}`, 287, 205);
  }
  doc.save(`PEC_Traitees_${dept}_${annee}_${moment().format('YYYYMMDD')}.pdf`);
  message.success('Export PDF réussi');
};

// ─────────────────────────────────────────────────────────────────────────
const PriseEnchargeTraiter = () => {
  const [pecData, setPecData] = useState<PECData[]>([]);
  const [statsData, setStatsData] = useState<StatsData[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingYears, setLoadingYears] = useState(false);
  const [selectedPec, setSelectedPec] = useState<PECData | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [selectedYearId, setSelectedYearId] = useState<number | null>(null);
  const API_URL = import.meta.env.VITE_API_URL_SERVER || '';

  const currentUser = getUserInfo();
  const departement_id = currentUser?.departement_id;
  const deptName = currentUser?.departementName || ('Département ' + departement_id);

  // ── Années du département ──────────────────────────────────────────
  useEffect(() => {
    if (!departement_id) return;
    const fetch_ = async () => {
      setLoadingYears(true);
      try {
        const data = await apiFetch(`/api/annees?site_id=${departement_id}`);
        if (Array.isArray(data)) {
          setAcademicYears(data);
          const encours = data.find((y: AcademicYear) => y.etat === 'en cour' || y.etat === 'en cours');
          setSelectedYearId(encours ? encours.id : data[0]?.id ?? null);
        }
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return;
        message.error('Impossible de charger les années');
      }
      finally { setLoadingYears(false); }
    };
    fetch_();
  }, [departement_id]);

  useEffect(() => { if (selectedYearId) { fetchPecData(); fetchStatsData(); } }, [selectedYearId]);

  const fetchPecData = async () => {
    if (!selectedYearId) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/priseEnCharge/traitees?anneeAcademiqueId=${selectedYearId}`,
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
      const data = await res.json();
      if (data.success) setPecData(data.data);
      else throw new Error(data.message);
    } catch { message.error('Erreur chargement'); }
    finally { setLoading(false); }
  };

  const fetchStatsData = async () => {
    if (!selectedYearId) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/priseEnCharge/traitees/stats?anneeAcademiqueId=${selectedYearId}`,
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
      const data = await res.json();
      if (data.success) setStatsData(data.data);
    } catch { /* silent */ }
  };

  const getTotalStats = () => ({
    totalPecTraitees: statsData.reduce((s, i) => s + parseInt(i.total_pec_traitees?.toString() || '0'), 0),
    totalValidees:    statsData.reduce((s, i) => s + parseInt(i.total_validees?.toString() || '0'), 0),
    totalRefusees:    statsData.reduce((s, i) => s + parseInt(i.total_refusees?.toString() || '0'), 0),
    totalReduction:   statsData.reduce((s, i) => s + parseFloat(i.total_reduction?.toString() || '0'), 0),
  });

  const { totalPecTraitees, totalValidees, totalRefusees, totalReduction } = getTotalStats();
  const selectedYear = academicYears.find(y => y.id === selectedYearId);
  const anneeLabel = selectedYear?.annee || '';

  const exportItems = [
    { key: 'excel', label: 'Exporter en Excel', icon: <FileExcelOutlined style={{ color: '#22c55e' }} />, onClick: () => exportExcel(pecData, anneeLabel, deptName) },
    { key: 'pdf',   label: 'Exporter en PDF',   icon: <FilePdfOutlined  style={{ color: '#ef4444' }} />, onClick: () => exportPDF(pecData, anneeLabel, deptName, { totalValidees, totalRefusees, totalReduction }) },
  ];

  // ── Colonnes tableau ───────────────────────────────────────────────
  const thS = { background: '#1e3a8a', color: '#fff', fontWeight: 700, textAlign: 'center' as const, fontFamily: 'Plus Jakarta Sans' };

  const columns: ColumnsType<PECData> = [
    {
      title: 'Étudiant', key: 'etudiant', onHeaderCell: () => ({ style: thS }),
      render: (r: PECData) => (
        <div style={{ cursor: 'pointer', padding: '2px 0' }} onClick={() => { setSelectedPec(r); setModalVisible(true); }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <UserOutlined style={{ color: '#3b82f6', fontSize: 15 }} />
            </div>
            <div>
              <div style={{ fontWeight: 700, color: '#1a2e4a', fontFamily: 'Plus Jakarta Sans' }}>{r.nom} {r.prenoms}</div>
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>{r.matricule_iipea}</div>
              <div style={{ marginTop: 4, display: 'flex', gap: 4 }}>
                <Tag color="blue" style={{ fontSize: 10, margin: 0 }}>{r.filiere_sigle}</Tag>
                <Tag color="green" style={{ fontSize: 10, margin: 0 }}>{r.niveau}</Tag>
              </div>
            </div>
          </div>
        </div>
      ), width: 220,
    },
    {
      title: 'Type PEC', dataIndex: 'type_pec', key: 'type_pec', align: 'center' as const,
      onHeaderCell: () => ({ style: thS }),
      render: (t: string) => <Tag color={typePecColor(t)} style={{ fontWeight: 600, padding: '2px 10px' }}>{t}</Tag>,
      width: 120,
    },
    {
      title: 'Réduction', key: 'reduction', align: 'center' as const,
      onHeaderCell: () => ({ style: thS }),
      render: (r: PECData) => (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            <PercentageOutlined style={{ color: '#22c55e' }} />
            <span style={{ fontSize: 17, fontWeight: 800, color: '#1e3a8a', fontFamily: 'Fraunces, serif' }}>{fmt(r.pourcentage_reduction)}%</span>
          </div>
          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{fmt(r.montant_reduction).toLocaleString('fr-FR')} FCFA</div>
        </div>
      ), width: 130,
    },
    {
      title: 'Scolarité', key: 'scolarite', onHeaderCell: () => ({ style: thS }),
      render: (r: PECData) => {
        const pct = r.montant_scolarite > 0 ? (r.scolarite_verse / r.montant_scolarite) * 100 : 0;
        return (
          <div style={{ fontSize: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ color: '#6b7280' }}>Total</span>
              <b>{fmt(r.montant_scolarite).toLocaleString('fr-FR')}</b>
            </div>
            <Progress percent={Math.round(pct)} size="small" showInfo={false} status={pct >= 100 ? 'success' : 'active'} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
              <span style={{ color: '#22c55e', fontWeight: 600 }}>+{fmt(r.scolarite_verse).toLocaleString('fr-FR')}</span>
              <span style={{ color: fmt(r.scolarite_restante) > 0 ? '#ef4444' : '#22c55e', fontWeight: 600 }}>{fmt(r.scolarite_restante).toLocaleString('fr-FR')}</span>
            </div>
          </div>
        );
      }, width: 170,
    },
    {
      title: 'Statut', dataIndex: 'statut', key: 'statut', align: 'center' as const,
      onHeaderCell: () => ({ style: thS }),
      render: (s: string) => (
        <Tag
          color={s === 'valide' ? 'success' : 'error'}
          icon={s === 'valide' ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
          style={{ fontWeight: 600, padding: '3px 12px' }}
        >
          {s === 'valide' ? 'Validée' : 'Refusée'}
        </Tag>
      ), width: 110,
    },
    {
      title: 'Date validation', dataIndex: 'date_validation', key: 'date_validation', align: 'center' as const,
      onHeaderCell: () => ({ style: thS }),
      render: (d: string) => (
        <div style={{ background: '#f8fafc', borderRadius: 8, padding: '6px 10px', display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
          <CalendarOutlined style={{ color: '#94a3b8' }} />
          {d ? moment(d).format('DD/MM/YYYY') : '—'}
        </div>
      ), width: 140,
    },
  ];

  if (loadingYears) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f7fa' }}>
      <div style={{ textAlign: 'center' }}><Spin size="large" /><div style={{ marginTop: 12, color: '#6b7280' }}>Chargement…</div></div>
    </div>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@600;700;800&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap');
        .pect-page { font-family:'Plus Jakarta Sans',sans-serif; background:#f5f7fa; min-height:100vh; }
        .pect-hero { background:linear-gradient(135deg,#1e3a8a 0%,#1d4ed8 55%,#2563eb 100%); border-radius:20px; padding:28px 32px; margin-bottom:24px; position:relative; overflow:hidden; }
        .pect-hero::after { content:''; position:absolute; top:-50px; right:-50px; width:240px; height:240px; border-radius:50%; background:rgba(255,255,255,0.04); pointer-events:none; }
        .pect-hero::before { content:''; position:absolute; bottom:-70px; left:55%; width:320px; height:320px; border-radius:50%; background:rgba(255,255,255,0.03); pointer-events:none; }
        .pect-kpi { border-radius:14px; overflow:hidden; position:relative; transition:transform .2s,box-shadow .2s; cursor:default; }
        .pect-kpi:hover { transform:translateY(-3px); }
        .pect-table { border-radius:16px!important; border:none!important; box-shadow:0 2px 14px rgba(0,0,0,0.06)!important; overflow:hidden; background:#fff; }
        .pect-table .ant-table-tbody > tr:hover > td { background:#eff6ff!important; }
        .pect-table .ant-table-tbody > tr > td { font-family:'Plus Jakarta Sans',sans-serif!important; padding:12px 14px!important; }
        .type-badge { border-radius:14px; padding:18px 20px; text-align:center; transition:transform .2s; }
        .type-badge:hover { transform:scale(1.02); }
        .pect-filter { background:#fff; border-radius:14px; padding:16px 22px; margin-bottom:24px; box-shadow:0 2px 10px rgba(0,0,0,0.04); display:flex; align-items:center; gap:20px; flex-wrap:wrap; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        .pect-fade { animation:fadeUp .35s ease both; }
      `}</style>

      <div className="pect-page" style={{ padding: '24px 28px' }}>
        <PageHeader />

        {/* Hero */}
        <div className="pect-hero">
          <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ fontFamily: 'Fraunces, serif', fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
                Prises en Charge Traitées
              </div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>{deptName} · Validées & refusées</div>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Button icon={<ReloadOutlined />} loading={loading}
                onClick={() => { fetchPecData(); fetchStatsData(); }}
                style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: 10 }}>
                Actualiser
              </Button>
              <Dropdown menu={{ items: exportItems }} trigger={['click']} disabled={!pecData.length}>
                <Button icon={<DownOutlined />}
                  style={{ background: 'rgba(255,255,255,0.18)', border: 'none', color: '#fff', borderRadius: 10, fontWeight: 600 }}>
                  Exporter
                </Button>
              </Dropdown>
            </div>
          </div>
        </div>

        {/* Filter */}
        <div className="pect-filter">
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.07em', color: '#9ca3af', marginBottom: 4 }}>Année académique</div>
            <Select value={selectedYearId} onChange={setSelectedYearId} style={{ width: 240 }} loading={loadingYears}>
              {academicYears.map(y => (
                <Option key={y.id} value={y.id}>
                  {y.annee} {(y.etat === 'en cour' || y.etat === 'en cours') ? '• En cours' : ''}
                </Option>
              ))}
            </Select>
          </div>
          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.07em', color: '#9ca3af' }}>Département</div>
            <div style={{ fontWeight: 700, color: '#1e3a8a', marginTop: 2 }}>{deptName}</div>
          </div>
        </div>

        {!selectedYearId ? (
          <Alert message="Aucune année sélectionnée" type="warning" showIcon />
        ) : (
          <div className="pect-fade">
            {/* KPIs */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
              {[
                { title: 'Total traitées', value: totalPecTraitees, bg: 'linear-gradient(135deg,#1e3a8a,#2563eb)', icon: <FileTextOutlined /> },
                { title: 'Validées', value: totalValidees, bg: 'linear-gradient(135deg,#065f46,#10b981)', icon: <CheckCircleOutlined /> },
                { title: 'Refusées', value: totalRefusees, bg: 'linear-gradient(135deg,#7f1d1d,#ef4444)', icon: <CloseCircleOutlined /> },
                { title: 'Réduction accordée', value: totalReduction.toLocaleString('fr-FR') + ' FCFA', bg: 'linear-gradient(135deg,#78350f,#f59e0b)', icon: <DollarOutlined /> },
              ].map((k, i) => (
                <Col xs={24} sm={12} lg={6} key={i}>
                  <div className="pect-kpi" style={{ background: k.bg, padding: '20px 22px', boxShadow: '0 4px 18px rgba(0,0,0,0.15)' }}>
                    <div style={{ fontSize: 20, color: 'rgba(255,255,255,0.6)', marginBottom: 10 }}>{k.icon}</div>
                    <div style={{ fontFamily: 'Fraunces, serif', fontSize: 24, fontWeight: 700, color: '#fff' }}>{k.value}</div>
                    <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: 'rgba(255,255,255,0.65)', marginTop: 4 }}>{k.title}</div>
                    {i < 3 && totalPecTraitees > 0 && (
                      <div style={{ marginTop: 10, background: 'rgba(255,255,255,0.15)', borderRadius: 4, height: 4 }}>
                        <div style={{ height: '100%', borderRadius: 4, background: 'rgba(255,255,255,0.7)', width: `${Math.round((typeof k.value === 'number' ? k.value : 0) / totalPecTraitees * 100)}%` }} />
                      </div>
                    )}
                  </div>
                </Col>
              ))}
            </Row>

            {/* Répartition par type */}
            {statsData.length > 0 && (
              <div style={{ background: '#fff', borderRadius: 16, padding: '20px 24px', marginBottom: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
                <div style={{ fontFamily: 'Fraunces, serif', fontSize: 15, fontWeight: 700, color: '#1e3a8a', marginBottom: 16 }}>Répartition par type de PEC</div>
                <Row gutter={[16, 16]}>
                  {statsData.map((s, i) => (
                    <Col xs={24} sm={8} key={i}>
                      <div className="type-badge" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                        <Tag color={typePecColor(s.type_pec)} style={{ fontSize: 13, fontWeight: 600, padding: '3px 14px', marginBottom: 8 }}>{s.type_pec}</Tag>
                        <div style={{ fontFamily: 'Fraunces, serif', fontSize: 28, fontWeight: 800, color: '#1e3a8a' }}>{s.count_type}</div>
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                          {totalPecTraitees > 0 ? ((s.count_type / totalPecTraitees) * 100).toFixed(1) : 0}% des PEC
                        </div>
                        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>
                          Réd. totale : {Number(s.total_reduction).toLocaleString('fr-FR')} FCFA
                        </div>
                        <div style={{ fontSize: 11, color: '#cbd5e1', marginTop: 2 }}>
                          Moy. : {Math.round(Number(s.moyenne_reduction)).toLocaleString('fr-FR')} FCFA
                        </div>
                      </div>
                    </Col>
                  ))}
                </Row>
              </div>
            )}

            {/* Table */}
            <div className="pect-table" style={{ borderRadius: 16 }}>
              <div style={{ padding: '18px 22px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <div style={{ fontFamily: 'Fraunces, serif', fontSize: 16, fontWeight: 700, color: '#1e3a8a' }}>
                  Liste des PEC traitées
                  <Tag color="blue" style={{ marginLeft: 10 }}>{pecData.length}</Tag>
                  {selectedYear && <Tag color={selectedYear.etat === 'en cour' ? 'green' : 'default'}>{selectedYear.annee}</Tag>}
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>
                  ✅ {totalValidees} validées · ❌ {totalRefusees} refusées
                </div>
              </div>
              {loading ? (
                <div style={{ padding: 48, textAlign: 'center' }}><Spin size="large" /></div>
              ) : pecData.length === 0 ? (
                <div style={{ padding: 48 }}><Alert message={`Aucune PEC traitée pour ${selectedYear?.annee}`} type="info" showIcon /></div>
              ) : (
                <Table
                  columns={columns} dataSource={pecData} rowKey="pec_id"
                  pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (t, r) => `${r[0]}-${r[1]} sur ${t}` }}
                  scroll={{ x: 900 }} size="middle"
                  onRow={(r: PECData) => ({ onClick: () => { setSelectedPec(r); setModalVisible(true); }, style: { cursor: 'pointer' } })}
                />
              )}
            </div>
          </div>
        )}

        {/* Modal détail */}
        <Modal open={modalVisible} onCancel={() => setModalVisible(false)}
          footer={[<Button key="close" type="primary" style={{ background: '#1e3a8a', borderColor: '#1e3a8a', borderRadius: 10 }} onClick={() => setModalVisible(false)}>Fermer</Button>]}
          width={720}
          title={
            <div style={{ fontFamily: 'Fraunces, serif', fontSize: 17, color: '#1e3a8a' }}>
              Détails de la prise en charge
              {selectedPec && (
                <div style={{ fontSize: 12, fontWeight: 400, color: '#64748b', marginTop: 2, fontFamily: 'Plus Jakarta Sans' }}>
                  {selectedPec.nom} {selectedPec.prenoms} · {selectedPec.matricule_iipea}
                  {selectedYear && <Tag color="blue" style={{ marginLeft: 8 }}>{selectedYear.annee}</Tag>}
                </div>
              )}
            </div>
          }
        >
          {selectedPec && (
            <div>
              <Descriptions bordered column={1} size="small">
                <Descriptions.Item label="Étudiant">
                  <b style={{ fontSize: 15 }}>{selectedPec.nom} {selectedPec.prenoms}</b>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                    <UserOutlined style={{ marginRight: 4 }} />{selectedPec.matricule_iipea}
                    &nbsp;·&nbsp;📞 {selectedPec.telephone}
                    &nbsp;·&nbsp;✉️ {selectedPec.email}
                  </div>
                </Descriptions.Item>
                <Descriptions.Item label="Formation">
                  <BookOutlined style={{ marginRight: 4 }} />{selectedPec.filiere} ({selectedPec.filiere_sigle}) · {selectedPec.niveau}
                  <Tag color={selectedPec.statut_etudiant === 'actif' ? 'green' : 'red'} style={{ marginLeft: 8 }}>{selectedPec.statut_etudiant}</Tag>
                </Descriptions.Item>
              </Descriptions>

              <Divider />

              <Descriptions bordered column={2} size="small">
                <Descriptions.Item label="Statut" span={2}>
                  <Tag color={selectedPec.statut === 'valide' ? 'success' : 'error'} icon={selectedPec.statut === 'valide' ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
                    style={{ fontWeight: 700, padding: '3px 14px', fontSize: 13 }}>
                    {selectedPec.statut === 'valide' ? 'Validée' : 'Refusée'}
                  </Tag>
                </Descriptions.Item>
                {selectedPec.statut === 'refuse' && selectedPec.motif_refus && (
                  <Descriptions.Item label="Motif" span={2}>
                    <Alert message={selectedPec.motif_refus} type="error" showIcon icon={<ExclamationCircleOutlined />} />
                  </Descriptions.Item>
                )}
                <Descriptions.Item label="Type"><Tag color={typePecColor(selectedPec.type_pec)}>{selectedPec.type_pec}</Tag></Descriptions.Item>
                <Descriptions.Item label="Référence">{selectedPec.reference || '—'}</Descriptions.Item>
                <Descriptions.Item label="Réduction">
                  <span style={{ color: '#22c55e', fontWeight: 800, fontSize: 16 }}>{fmt(selectedPec.pourcentage_reduction)}%</span>
                  &nbsp;→ {fmt(selectedPec.montant_reduction).toLocaleString('fr-FR')} FCFA
                </Descriptions.Item>
                <Descriptions.Item label="Dates">
                  Demande : {selectedPec.date_demande ? moment(selectedPec.date_demande).format('DD/MM/YYYY') : '—'}
                  &nbsp;·&nbsp;Validation : {selectedPec.date_validation ? moment(selectedPec.date_validation).format('DD/MM/YYYY') : '—'}
                </Descriptions.Item>
              </Descriptions>

              {selectedPec.statut === 'valide' && (
                <>
                  <Divider />
                  <div style={{ background: '#f8fafc', borderRadius: 12, padding: '16px 20px' }}>
                    <div style={{ fontFamily: 'Fraunces, serif', fontWeight: 700, color: '#1e3a8a', marginBottom: 12, fontSize: 14 }}>
                      <DollarOutlined style={{ marginRight: 6 }} />Situation financière
                    </div>
                    <Row gutter={16} style={{ marginBottom: 12 }}>
                      <Col span={8}><Statistic title="Scolarité totale" value={fmt(selectedPec.montant_scolarite).toLocaleString('fr-FR')} suffix="FCFA" valueStyle={{ color: '#1890ff', fontSize: 15 }} /></Col>
                      <Col span={8}><Statistic title="Déjà payé" value={fmt(selectedPec.scolarite_verse).toLocaleString('fr-FR')} suffix="FCFA" valueStyle={{ color: '#22c55e', fontSize: 15 }} /></Col>
                      <Col span={8}><Statistic title="Reste à payer" value={fmt(selectedPec.scolarite_restante).toLocaleString('fr-FR')} suffix="FCFA" valueStyle={{ color: selectedPec.scolarite_restante > 0 ? '#ef4444' : '#22c55e', fontSize: 15 }} /></Col>
                    </Row>
                    <Progress percent={selectedPec.montant_scolarite > 0 ? Math.round((selectedPec.scolarite_verse / selectedPec.montant_scolarite) * 100) : 0}
                      status={selectedPec.scolarite_verse >= selectedPec.montant_scolarite ? 'success' : 'active'} />
                  </div>

                  <Divider />

                  <Descriptions title="Après application de la PEC" bordered column={1} size="small">
                    <Descriptions.Item label="Total versé virtuel">
                      <span style={{ color: '#22c55e', fontWeight: 800, fontSize: 15 }}>
                        {fmt(selectedPec.scolarite_verse + selectedPec.montant_reduction).toLocaleString('fr-FR')} FCFA
                      </span>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                        Paiements {fmt(selectedPec.scolarite_verse).toLocaleString('fr-FR')} + PEC {fmt(selectedPec.montant_reduction).toLocaleString('fr-FR')}
                      </div>
                    </Descriptions.Item>
                    <Descriptions.Item label="Reste virtuel">
                      <span style={{ fontWeight: 800, fontSize: 15, color: selectedPec.restant_virtuel > 0 ? '#ef4444' : '#22c55e' }}>
                        {fmt(selectedPec.restant_virtuel).toLocaleString('fr-FR')} FCFA
                      </span>
                    </Descriptions.Item>
                  </Descriptions>
                </>
              )}
            </div>
          )}
        </Modal>
      </div>
    </>
  );
};

export default PriseEnchargeTraiter;