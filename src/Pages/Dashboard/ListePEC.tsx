/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect } from 'react';
import {
  Table, Button, Modal, Form, Input, Tag, Spin,
  message, Descriptions, Row, Col, Statistic, Space, Alert, Select, Dropdown
} from 'antd';
import {
  EyeOutlined, CheckCircleOutlined, CloseCircleOutlined,
  TeamOutlined, DollarOutlined, CalendarOutlined,
  FileExcelOutlined, FilePdfOutlined, DownOutlined, ReloadOutlined
} from '@ant-design/icons';
import PageHeader from '../../Components/PageHeader/PageHeader';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import moment from 'moment';
import { apiFetch, ApiError } from '../../lib/api';
import type { AnneeAcademique as AcademicYear } from '../../type/AnneeAcademique';

const { TextArea } = Input;
const { Option } = Select;

interface PECEnAttente {
  pec_id: number; type_pec: string; pourcentage_reduction: number;
  reference: string; date_demande: string; etudiant_id: number;
  matricule_iipea: string; nom: string; prenoms: string;
  telephone: string; email: string; filiere: string; filiere_sigle: string;
  niveau: string; montant_scolarite: number; scolarite_verse: number;
  scolarite_restante: number; statut_etudiant: string; reduction_calculee: number;
}
// ── getUserInfo ──────────────────────────────────────────────────────────
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

const fmt = (n: any) => {
  if (n === undefined || n === null) return 0;
  const v = typeof n === 'string' ? parseFloat(n) : n;
  return isNaN(v) ? 0 : Math.round(v);
};

// ── Export Excel ─────────────────────────────────────────────────────────
const exportExcel = (data: PECEnAttente[], annee: string, dept: string) => {
  if (!data.length) { message.warning('Aucune donnée'); return; }
  const rows = data.map(p => ({
    'Matricule': p.matricule_iipea,
    'Nom': `${p.nom} ${p.prenoms}`,
    'Filière': `${p.filiere} (${p.filiere_sigle})`,
    'Niveau': p.niveau,
    'Type PEC': p.type_pec,
    'Réduction (%)': fmt(p.pourcentage_reduction),
    'Réduction (FCFA)': fmt(p.reduction_calculee),
    'Scolarité totale': fmt(p.montant_scolarite),
    'Payé': fmt(p.scolarite_verse),
    'Reste': fmt(p.scolarite_restante),
    'Référence': p.reference || '-',
    'Date demande': p.date_demande ? moment(p.date_demande).format('DD/MM/YYYY') : '-',
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [14,22,22,10,14,12,16,16,14,14,16,14].map(w => ({ wch: w }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'PEC en attente');
  XLSX.writeFile(wb, `PEC_Attente_${dept}_${annee}_${moment().format('YYYYMMDD')}.xlsx`);
  message.success('Export Excel réussi');
};

// ── Export PDF ────────────────────────────────────────────────────────────
const exportPDF = (data: PECEnAttente[], annee: string, dept: string) => {
  if (!data.length) { message.warning('Aucune donnée'); return; }
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  doc.setFillColor(15, 82, 74);
  doc.rect(0, 0, 297, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13); doc.setFont('helvetica', 'bold');
  doc.text(`PEC en attente de validation — ${dept}`, 14, 10);
  doc.setFontSize(9); doc.setFont('helvetica', 'normal');
  doc.text(`Année : ${annee}   |   ${data.length} demande(s)   |   Généré le ${moment().format('DD/MM/YYYY')}`, 14, 17);
  autoTable(doc, {
    startY: 28,
    head: [['Étudiant', 'Matricule', 'Filière/Niv.', 'Type', 'Réd.%', 'Réd. FCFA', 'Scol. Totale', 'Payé', 'Reste', 'Date']],
    body: data.map(p => [
      `${p.nom} ${p.prenoms}`,
      p.matricule_iipea,
      `${p.filiere_sigle} / ${p.niveau}`,
      p.type_pec,
      `${fmt(p.pourcentage_reduction)}%`,
      fmt(p.reduction_calculee).toLocaleString('fr-FR'),
      fmt(p.montant_scolarite).toLocaleString('fr-FR'),
      fmt(p.scolarite_verse).toLocaleString('fr-FR'),
      fmt(p.scolarite_restante).toLocaleString('fr-FR'),
      p.date_demande ? moment(p.date_demande).format('DD/MM/YYYY') : '-',
    ]),
    headStyles: { fillColor: [15, 82, 74], textColor: [255,255,255], fontStyle: 'bold', halign: 'center', fontSize: 8 },
    bodyStyles: { fontSize: 8, halign: 'center' },
    columnStyles: { 0: { halign: 'left' }, 1: { halign: 'left' } },
    alternateRowStyles: { fillColor: [240, 253, 250] },
    margin: { left: 10, right: 10 },
  });
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i); doc.setFontSize(8); doc.setTextColor(150);
    doc.text(`Page ${i}/${pages}`, 287, 205);
  }
  doc.save(`PEC_Attente_${dept}_${annee}_${moment().format('YYYYMMDD')}.pdf`);
  message.success('Export PDF réussi');
};

// ─────────────────────────────────────────────────────────────────────────
const ListePEC = () => {
  const [pecList, setPecList] = useState<PECEnAttente[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedPEC, setSelectedPEC] = useState<PECEnAttente | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [form] = Form.useForm();
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [selectedYearId, setSelectedYearId] = useState<number | null>(null);
  const [loadingYears, setLoadingYears] = useState(false);

  const currentUser = getUserInfo();
  const departement_id = currentUser?.departement_id;
  const deptName = currentUser?.departementName || ('Département ' + departement_id);

  // ── Années filtrées par département ────────────────────────────────
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
        message.error('Impossible de charger les années académiques');
      }
      finally { setLoadingYears(false); }
    };
    fetch_();
  }, [departement_id]);

  useEffect(() => { if (selectedYearId) fetchPECEnAttente(); }, [selectedYearId]);

  const fetchPECEnAttente = async () => {
    if (!selectedYearId) return;
    setLoading(true);
    try {
      const data = await apiFetch(`/api/priseEnCharge/pec-en-attente?anneeAcademiqueId=${selectedYearId}`);
      if (data.success) setPecList(data.data);
      else message.error(data.message || 'Erreur chargement');
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return;
      message.error('Erreur réseau');
    }
    finally { setLoading(false); }
  };

  const handleValiderPEC = async (action: 'valider' | 'refuser') => {
    if (!selectedPEC) return;
    setActionLoading(true);
    try {
      let motif_refus = null;
      if (action === 'refuser') {
        try { const v = await form.validateFields(); motif_refus = v.motif_refus || null; } catch { motif_refus = null; }
      }
      const data = await apiFetch('/api/paiements/valider-pec', {
        method: 'POST',
        body: JSON.stringify({ pec_id: selectedPEC.pec_id, action, motif_refus }),
      });
      if (data.success) {
        message.success(data.message);
        setModalVisible(false); setSelectedPEC(null); form.resetFields(); fetchPECEnAttente();
      } else message.error(data.message);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return;
      message.error('Erreur validation');
    }
    finally { setActionLoading(false); }
  };

  const reductionTotale = pecList.reduce((s, p) => s + fmt(p.reduction_calculee), 0);
  const selectedYear = academicYears.find(y => y.id === selectedYearId);
  const anneeLabel = selectedYear?.annee || '';

  const exportItems = [
    { key: 'excel', label: 'Exporter en Excel', icon: <FileExcelOutlined style={{ color: '#22c55e' }} />, onClick: () => exportExcel(pecList, anneeLabel, deptName) },
    { key: 'pdf',   label: 'Exporter en PDF',   icon: <FilePdfOutlined  style={{ color: '#ef4444' }} />, onClick: () => exportPDF(pecList, anneeLabel, deptName) },
  ];

  const thS = { background: '#0f5252', color: '#fff', fontWeight: 700, textAlign: 'center' as const, fontFamily: 'Plus Jakarta Sans' };
  const columns = [
    {
      title: 'Étudiant', key: 'etudiant',
      onHeaderCell: () => ({ style: thS }),
      render: (r: PECEnAttente) => (
        <div style={{ padding: '2px 0' }}>
          <div style={{ fontWeight: 700, color: '#1a2e2e', fontFamily: 'Plus Jakarta Sans' }}>{r.nom} {r.prenoms}</div>
          <div style={{ fontSize: 11, color: '#6b7280', fontFamily: 'Plus Jakarta Sans', marginTop: 2 }}>{r.matricule_iipea}</div>
          <div style={{ marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            <Tag color="teal" style={{ fontSize: 10, margin: 0 }}>{r.filiere_sigle}</Tag>
            <Tag color="green" style={{ fontSize: 10, margin: 0 }}>{r.niveau}</Tag>
          </div>
        </div>
      ), width: 200,
    },
    {
      title: 'Type PEC', dataIndex: 'type_pec', key: 'type_pec', align: 'center' as const,
      onHeaderCell: () => ({ style: thS }),
      render: (t: string) => <Tag color="purple" style={{ fontWeight: 600 }}>{t?.toUpperCase()}</Tag>,
      width: 110,
    },
    {
      title: 'Réduction', key: 'reduction', align: 'center' as const,
      onHeaderCell: () => ({ style: thS }),
      render: (r: PECEnAttente) => (
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#0d9488', fontFamily: 'Fraunces, serif' }}>{fmt(r.pourcentage_reduction)}%</div>
          <div style={{ fontSize: 11, color: '#6b7280' }}>{fmt(r.reduction_calculee).toLocaleString('fr-FR')} FCFA</div>
        </div>
      ), width: 120,
    },
    {
      title: 'Scolarité', key: 'scolarite',
      onHeaderCell: () => ({ style: thS }),
      render: (r: PECEnAttente) => (
        <div style={{ fontSize: 12, lineHeight: 1.8 }}>
          <div>Total : <b>{fmt(r.montant_scolarite).toLocaleString('fr-FR')} FCFA</b></div>
          <div style={{ color: '#22c55e' }}>Payé : <b>{fmt(r.scolarite_verse).toLocaleString('fr-FR')} FCFA</b></div>
          <div style={{ color: fmt(r.scolarite_restante) > 0 ? '#ef4444' : '#22c55e' }}>Reste : <b>{fmt(r.scolarite_restante).toLocaleString('fr-FR')} FCFA</b></div>
        </div>
      ), width: 170,
    },
    {
      title: 'Date demande', dataIndex: 'date_demande', key: 'date_demande', align: 'center' as const,
      onHeaderCell: () => ({ style: thS }),
      render: (d: string) => <span style={{ fontSize: 12 }}>{d ? moment(d).format('DD/MM/YYYY') : '-'}</span>,
      width: 120,
    },
    {
      title: 'Référence', dataIndex: 'reference', key: 'reference',
      onHeaderCell: () => ({ style: thS }),
      render: (r: string) => <span style={{ fontSize: 12, color: '#6b7280' }}>{r || '—'}</span>,
      width: 120,
    },
    {
      title: 'Action', key: 'actions', align: 'center' as const,
      onHeaderCell: () => ({ style: thS }),
      render: (r: PECEnAttente) => (
        <Button
          size="small"
          icon={<EyeOutlined />}
          onClick={() => { setSelectedPEC(r); setModalVisible(true); }}
          style={{ background: '#0f5252', borderColor: '#0f5252', color: '#fff', borderRadius: 8, fontFamily: 'Plus Jakarta Sans' }}
        >
          Examiner
        </Button>
      ), width: 110,
    },
  ];

  if (loadingYears) return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <Spin size="large" />
      <div style={{ marginTop: 12, color: '#6b7280' }}>Chargement…</div>
    </div>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@600;700;800&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap');
        .pec-page { font-family:'Plus Jakarta Sans',sans-serif; background:#f5f7f7; min-height:100vh; }
        .pec-hero { background:linear-gradient(135deg,#0f5252 0%,#0d6e6e 55%,#0e9a7b 100%); border-radius:20px; padding:28px 32px; margin-bottom:24px; position:relative; overflow:hidden; }
        .pec-hero::after { content:''; position:absolute; top:-50px; right:-50px; width:240px; height:240px; border-radius:50%; background:rgba(255,255,255,0.05); pointer-events:none; }
        .pec-hero::before { content:''; position:absolute; bottom:-80px; left:60%; width:300px; height:300px; border-radius:50%; background:rgba(255,255,255,0.03); pointer-events:none; }
        .pec-kpi { border-radius:14px!important; border:none!important; box-shadow:0 2px 12px rgba(15,82,74,0.08)!important; transition:transform .2s,box-shadow .2s; overflow:hidden; }
        .pec-kpi:hover { transform:translateY(-3px); box-shadow:0 8px 28px rgba(15,82,74,0.15)!important; }
        .pec-kpi .ant-statistic-title { font-size:11px!important; font-weight:600!important; text-transform:uppercase; letter-spacing:.06em; color:rgba(255,255,255,0.7)!important; }
        .pec-kpi .ant-statistic-content-value { font-family:'Fraunces',serif!important; font-size:26px!important; color:#fff!important; }
        .pec-table-card { border-radius:16px!important; border:none!important; box-shadow:0 2px 14px rgba(0,0,0,0.06)!important; overflow:hidden; }
        .pec-table-card .ant-table-tbody > tr:hover > td { background:#f0fdfa!important; }
        .pec-table-card .ant-table-tbody > tr > td { font-family:'Plus Jakarta Sans',sans-serif!important; padding:12px 14px!important; }
        .pec-filter { background:#fff; border-radius:14px; padding:18px 24px; margin-bottom:24px; box-shadow:0 2px 10px rgba(0,0,0,0.04); display:flex; align-items:center; gap:20px; flex-wrap:wrap; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        .pec-fade { animation:fadeUp .35s ease both; }
      `}</style>

      <div className="pec-page" style={{ padding: '24px 28px' }}>
        <PageHeader />

        {/* Hero */}
        <div className="pec-hero">
          <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ fontFamily: 'Fraunces, serif', fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
                Prises en Charge — En Attente
              </div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', fontFamily: 'Plus Jakarta Sans' }}>
                {deptName} · Demandes à valider
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <Button icon={<ReloadOutlined />} loading={loading} onClick={fetchPECEnAttente}
                style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: 10 }}>
                Actualiser
              </Button>
              <Dropdown menu={{ items: exportItems }} trigger={['click']} disabled={!pecList.length}>
                <Button icon={<DownOutlined />}
                  style={{ background: 'rgba(255,255,255,0.18)', border: 'none', color: '#fff', borderRadius: 10, fontWeight: 600 }}>
                  Exporter
                </Button>
              </Dropdown>
            </div>
          </div>
        </div>

        {/* Filter bar */}
        <div className="pec-filter">
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
            <div style={{ fontWeight: 700, color: '#0f5252', fontFamily: 'Plus Jakarta Sans', marginTop: 2 }}>{deptName}</div>
          </div>
        </div>

        {!selectedYearId ? (
          <Alert message="Aucune année sélectionnée" type="warning" showIcon />
        ) : (
          <div className="pec-fade">
            {/* KPIs */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
              {[
                { title: 'PEC en attente', value: pecList.length, bg: 'linear-gradient(135deg,#0f5252,#0d7070)', icon: <TeamOutlined /> },
                { title: 'Réduction totale demandée', value: reductionTotale.toLocaleString('fr-FR') + ' FCFA', bg: 'linear-gradient(135deg,#065f46,#059669)', icon: <DollarOutlined /> },
                { title: 'Scolarité totale concernée', value: pecList.reduce((s,p) => s + fmt(p.montant_scolarite), 0).toLocaleString('fr-FR') + ' FCFA', bg: 'linear-gradient(135deg,#1e40af,#3b82f6)', icon: <DollarOutlined /> },
                { title: 'Réduction moyenne', value: pecList.length > 0 ? Math.round(reductionTotale / pecList.length).toLocaleString('fr-FR') + ' FCFA' : '0 FCFA', bg: 'linear-gradient(135deg,#92400e,#f59e0b)', icon: <CalendarOutlined /> },
              ].map((k, i) => (
                <Col xs={24} sm={12} lg={6} key={i}>
                  <div className="pec-kpi" style={{ background: k.bg, borderRadius: 14, padding: '20px 22px', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ fontSize: 20, color: 'rgba(255,255,255,0.6)', marginBottom: 10 }}>{k.icon}</div>
                    <div style={{ fontFamily: 'Fraunces, serif', fontSize: 24, fontWeight: 700, color: '#fff' }}>{k.value}</div>
                    <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: 'rgba(255,255,255,0.65)', marginTop: 4 }}>{k.title}</div>
                    <div style={{ position: 'absolute', bottom: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
                  </div>
                </Col>
              ))}
            </Row>

            {/* Table */}
            <div className="pec-table-card" style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 14px rgba(0,0,0,0.06)' }}>
              <div style={{ padding: '18px 22px', borderBottom: '1px solid #f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <div style={{ fontFamily: 'Fraunces, serif', fontSize: 16, fontWeight: 700, color: '#0f5252' }}>
                  Demandes en attente
                  <Tag color="teal" style={{ marginLeft: 10, fontFamily: 'Plus Jakarta Sans' }}>{pecList.length}</Tag>
                  {selectedYear && <Tag color={selectedYear.etat === 'en cour' ? 'green' : 'blue'} style={{ fontFamily: 'Plus Jakarta Sans' }}>{selectedYear.annee}</Tag>}
                </div>
              </div>
              {pecList.length === 0 ? (
                <div style={{ padding: 48, textAlign: 'center' }}>
                  <Alert message={`Aucune PEC en attente pour ${selectedYear?.annee}`} type="info" showIcon />
                </div>
              ) : (
                <Table columns={columns} dataSource={pecList} rowKey="pec_id"
                  pagination={{ pageSize: 10, showSizeChanger: true }}
                  bordered={false} size="middle" scroll={{ x: 900 }} loading={loading}
                />
              )}
            </div>
          </div>
        )}

        {/* Modal détail */}
        <Modal
          open={modalVisible}
          onCancel={() => { setModalVisible(false); setSelectedPEC(null); form.resetFields(); }}
          footer={null} width={680}
          title={
            <div style={{ fontFamily: 'Fraunces, serif', fontSize: 17, color: '#0f5252' }}>
              Examiner la demande
              {selectedPEC && <div style={{ fontSize: 12, fontFamily: 'Plus Jakarta Sans', fontWeight: 400, color: '#6b7280', marginTop: 2 }}>{selectedPEC.nom} {selectedPEC.prenoms} · {selectedPEC.matricule_iipea}</div>}
            </div>
          }
        >
          {selectedPEC && (
            <div>
              <Descriptions bordered column={1} size="small" style={{ marginBottom: 20 }}>
                <Descriptions.Item label="Type PEC"><Tag color="purple">{selectedPEC.type_pec?.toUpperCase()}</Tag></Descriptions.Item>
                <Descriptions.Item label="Réduction"><span style={{ color: '#0d9488', fontWeight: 800, fontSize: 16 }}>{fmt(selectedPEC.pourcentage_reduction)}%</span></Descriptions.Item>
                <Descriptions.Item label="Montant réduction"><b>{fmt(selectedPEC.reduction_calculee).toLocaleString('fr-FR')} FCFA</b></Descriptions.Item>
                <Descriptions.Item label="Référence">{selectedPEC.reference || '—'}</Descriptions.Item>
                <Descriptions.Item label="Date demande">{selectedPEC.date_demande ? moment(selectedPEC.date_demande).format('DD/MM/YYYY') : '-'}</Descriptions.Item>
              </Descriptions>

              <div style={{ fontFamily: 'Fraunces, serif', fontWeight: 600, color: '#0f5252', marginBottom: 12 }}>Situation financière</div>
              <Row gutter={16} style={{ marginBottom: 20 }}>
                <Col span={8}><Statistic title="Scolarité totale" value={fmt(selectedPEC.montant_scolarite).toLocaleString('fr-FR')} suffix="FCFA" valueStyle={{ color: '#1890ff', fontSize: 16 }} /></Col>
                <Col span={8}><Statistic title="Déjà payé" value={fmt(selectedPEC.scolarite_verse).toLocaleString('fr-FR')} suffix="FCFA" valueStyle={{ color: '#22c55e', fontSize: 16 }} /></Col>
                <Col span={8}><Statistic title="Reste à payer" value={fmt(selectedPEC.scolarite_restante).toLocaleString('fr-FR')} suffix="FCFA" valueStyle={{ color: '#ef4444', fontSize: 16 }} /></Col>
              </Row>

              <Form form={form} layout="vertical">
                <Form.Item name="motif_refus" label="Motif de refus (optionnel)" rules={[{ max: 500, message: '500 caractères max' }]}>
                  <TextArea placeholder="Laisser vide pour motif par défaut" rows={3} maxLength={500} />
                </Form.Item>
              </Form>

              <div style={{ textAlign: 'center', marginTop: 20 }}>
                <Space size="large">
                  <Button size="large" icon={<CheckCircleOutlined />} loading={actionLoading}
                    onClick={() => handleValiderPEC('valider')}
                    style={{ background: '#0d9488', borderColor: '#0d9488', color: '#fff', borderRadius: 10, fontWeight: 600, paddingInline: 28 }}>
                    Valider
                  </Button>
                  <Button size="large" icon={<CloseCircleOutlined />} loading={actionLoading} danger
                    onClick={() => handleValiderPEC('refuser')}
                    style={{ borderRadius: 10, fontWeight: 600, paddingInline: 28 }}>
                    Refuser
                  </Button>
                </Space>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </>
  );
};

export default ListePEC;