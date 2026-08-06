import { useCallback, useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Select, Table, Tag, Spin, Empty, Typography, Alert } from 'antd';
import {
  TeamOutlined, GiftOutlined, CheckCircleOutlined, HourglassOutlined,
  WarningOutlined, InboxOutlined,
} from '@ant-design/icons';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
} from 'recharts';
import PageHeader from '../../Components/PageHeader/PageHeader';
import { apiFetch, ApiError } from '../../lib/api';

const { Text } = Typography;
const { Option } = Select;

interface AcademicYear {
  id: number;
  annee: string;
  etat: string;
}

interface DashboardMoyensGenerauxData {
  etudiants: {
    total_inscrits: number;
    par_ecole: { ecole: string; total: number }[];
    par_filiere: { filiere: string; total: number }[];
    par_niveau: { niveau: string; total: number }[];
  };
  distribution: {
    etudiants_servis: number;
    etudiants_restants: number;
    taux_couverture: number;
    repartition_par_accessoire: { accessoire: string; total: number }[];
  };
  stock: {
    etat: { accessoire_id: number; code: string; nom: string; seuil_alerte: number; solde: number; en_alerte: boolean }[];
    alertes: { accessoire_id: number; code: string; nom: string; seuil_alerte: number; solde: number; en_alerte: boolean }[];
  };
  mouvementsRecents: { type: string; quantite: number; date: string; accessoire: string; effectue_par: string }[];
}

const TYPE_LABEL: Record<string, string> = {
  reception: 'Réception',
  distribution: 'Distribution',
  ajustement_inventaire: 'Ajustement inventaire',
  transfert_sortant: 'Transfert sortant',
  transfert_entrant: 'Transfert entrant',
};

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
  } catch {
    return null;
  }
};

const DashboardMoyensGeneraux = () => {
  const currentUser = getUserInfo();
  const departementId = currentUser?.departement_id;

  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [selectedYearId, setSelectedYearId] = useState<number | null>(null);
  const [data, setData] = useState<DashboardMoyensGenerauxData | null>(null);
  const [loadingYears, setLoadingYears] = useState(true);
  const [loadingStats, setLoadingStats] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!departementId) {
      setError('Site non trouvé. Veuillez vous reconnecter.');
      setLoadingYears(false);
      return;
    }
    apiFetch<AcademicYear[]>(`/api/annees?site_id=${departementId}`)
      .then((years) => {
        setAcademicYears(years);
        const currentYear = years.find((y) => y.etat === 'en cour' || y.etat === 'en cours');
        setSelectedYearId(currentYear ? currentYear.id : years[0]?.id ?? null);
      })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) return;
        setError("Impossible de charger les années académiques.");
      })
      .finally(() => setLoadingYears(false));
  }, [departementId]);

  const fetchStats = useCallback(() => {
    if (!selectedYearId) return;
    setLoadingStats(true);
    apiFetch<{ data: DashboardMoyensGenerauxData }>(`/api/dashboard/moyens-generaux/stats?anneeAcademiqueId=${selectedYearId}`)
      .then((res) => setData(res.data))
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) return;
        setError('Impossible de charger le tableau de bord.');
      })
      .finally(() => setLoadingStats(false));
  }, [selectedYearId]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (loadingYears) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <PageHeader />
        <Spin size="large" style={{ marginTop: 80 }} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <PageHeader />
        <Alert message="Erreur" description={error} type="error" showIcon />
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <PageHeader />

      <Card style={{ marginBottom: 24 }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Text strong style={{ fontSize: 18 }}><GiftOutlined /> Dashboard Moyens Généraux</Text>
            <div><Text type="secondary">Stock et distribution des accessoires institutionnels — votre site.</Text></div>
          </Col>
          <Col>
            <Select value={selectedYearId} onChange={setSelectedYearId} style={{ width: 220 }}>
              {academicYears.map((y) => (
                <Option key={y.id} value={y.id}>{y.annee} ({y.etat})</Option>
              ))}
            </Select>
          </Col>
        </Row>
      </Card>

      {loadingStats || !data ? (
        <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
      ) : (
        <>
          {/* Couverture de distribution — cœur du dashboard métier (point 10 du cahier des
              charges). Les 3 derniers indicateurs resteront à 0 tant qu'aucune remise n'a été
              enregistrée (sous-phase 9) — donnée réelle, pas une valeur par défaut affichée en dur. */}
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={6}>
              <Card><Statistic title="Étudiants inscrits" value={data.etudiants.total_inscrits} prefix={<TeamOutlined style={{ color: 'var(--mod-scolarite)' }} />} /></Card>
            </Col>
            <Col span={6}>
              <Card><Statistic title="Ayant reçu leurs accessoires" value={data.distribution.etudiants_servis} prefix={<CheckCircleOutlined style={{ color: 'var(--success)' }} />} /></Card>
            </Col>
            <Col span={6}>
              <Card><Statistic title="Restant à servir" value={data.distribution.etudiants_restants} prefix={<HourglassOutlined style={{ color: 'var(--warning)' }} />} /></Card>
            </Col>
            <Col span={6}>
              <Card><Statistic title="Taux de couverture" value={data.distribution.taux_couverture} suffix="%" /></Card>
            </Col>
          </Row>

          {/* Alertes de stock */}
          {data.stock.alertes.length > 0 && (
            <Alert
              type="warning"
              showIcon
              icon={<WarningOutlined />}
              style={{ marginBottom: 24 }}
              message="Seuil d'alerte atteint"
              description={data.stock.alertes.map((a) => `${a.nom} (${a.solde} restant, seuil ${a.seuil_alerte})`).join(' · ')}
            />
          )}

          {/* Répartition étudiants — données réelles disponibles dès aujourd'hui */}
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={12}>
              <Card title="Étudiants par école" style={{ height: 320 }}>
                {data.etudiants.par_ecole.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={data.etudiants.par_ecole} layout="vertical" margin={{ left: 24 }}>
                      <XAxis type="number" allowDecimals={false} />
                      <YAxis type="category" dataKey="ecole" width={140} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="total" fill="var(--mod-scolarite)" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <Empty description="Aucune donnée" style={{ marginTop: 40 }} />}
              </Card>
            </Col>
            <Col span={12}>
              <Card title="Étudiants par niveau" style={{ height: 320 }}>
                {data.etudiants.par_niveau.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={data.etudiants.par_niveau}>
                      <XAxis dataKey="niveau" tick={{ fontSize: 9 }} interval={0} angle={-30} textAnchor="end" height={60} />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="total" fill="var(--mod-administration)" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <Empty description="Aucune donnée" style={{ marginTop: 40 }} />}
              </Card>
            </Col>
          </Row>

          <Card title="Étudiants par filière (top 10)" style={{ marginBottom: 24, height: 300 }}>
            {data.etudiants.par_filiere.length > 0 ? (
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={data.etudiants.par_filiere} layout="vertical" margin={{ left: 24 }}>
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="filiere" width={160} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="total" fill="var(--gold)" />
                </BarChart>
              </ResponsiveContainer>
            ) : <Empty description="Aucune donnée" style={{ marginTop: 40 }} />}
          </Card>

          {/* État du stock — vide tant qu'aucun accessoire n'a été créé (sous-phase 4) */}
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={12}>
              <Card title={<span><InboxOutlined /> État du stock</span>} style={{ height: 340 }}>
                {data.stock.etat.length > 0 ? (
                  <Table
                    dataSource={data.stock.etat}
                    rowKey="accessoire_id"
                    size="small"
                    pagination={false}
                    columns={[
                      { title: 'Accessoire', dataIndex: 'nom' },
                      { title: 'Solde', dataIndex: 'solde', align: 'right' },
                      { title: 'Seuil', dataIndex: 'seuil_alerte', align: 'right' },
                      {
                        title: 'État', align: 'right',
                        render: (_, r) => <Tag color={r.en_alerte ? 'error' : 'success'}>{r.en_alerte ? 'Alerte' : 'OK'}</Tag>,
                      },
                    ]}
                  />
                ) : <Empty description="Aucun accessoire au catalogue pour l'instant" style={{ marginTop: 60 }} />}
              </Card>
            </Col>
            <Col span={12}>
              <Card title="Répartition des distributions par accessoire" style={{ height: 340 }}>
                {data.distribution.repartition_par_accessoire.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={data.distribution.repartition_par_accessoire} layout="vertical" margin={{ left: 24 }}>
                      <XAxis type="number" allowDecimals={false} />
                      <YAxis type="category" dataKey="accessoire" width={110} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="total" fill="var(--mod-comptabilite)" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <Empty description="Aucune distribution enregistrée pour l'instant" style={{ marginTop: 60 }} />}
              </Card>
            </Col>
          </Row>

          {/* Mouvements récents — vide tant qu'aucun mouvement de stock n'a été enregistré */}
          <Card title="Mouvements récents">
            <Table
              dataSource={data.mouvementsRecents}
              rowKey={(r, i) => `${r.type}-${r.date}-${i}`}
              size="small"
              pagination={false}
              locale={{ emptyText: 'Aucun mouvement de stock enregistré pour l\'instant' }}
              columns={[
                { title: 'Type', dataIndex: 'type', render: (v: string) => <Tag>{TYPE_LABEL[v] ?? v}</Tag> },
                { title: 'Accessoire', dataIndex: 'accessoire' },
                { title: 'Quantité', dataIndex: 'quantite', align: 'right' },
                { title: 'Effectué par', dataIndex: 'effectue_par' },
                { title: 'Date', dataIndex: 'date', render: (v: string) => new Date(v).toLocaleString('fr-FR') },
              ]}
            />
          </Card>
        </>
      )}
    </div>
  );
};

export default DashboardMoyensGeneraux;
