import { useCallback, useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Select, Table, Spin, Empty, Typography, Alert, Progress } from 'antd';
import { DollarCircleOutlined, ClockCircleOutlined, GiftOutlined } from '@ant-design/icons';
import {
  ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts';
import PageHeader from '../../Components/PageHeader/PageHeader';
import { apiFetch, ApiError } from '../../lib/api';
import KitStatsCard, { StatistiquesKit } from '../../Components/KitStatsCard/KitStatsCard';

const { Text } = Typography;
const { Option } = Select;

interface AcademicYear {
  id: number;
  annee: string;
  etat: string;
}

interface DashboardComptabiliteData {
  recettesJour: number;
  recettesHier: number;
  recettesSemaine: number;
  recettesSemaineDerniere: number;
  recettesMois: number;
  recettesAnnee: number;
  evolutionEncaissements: { jour: string; total: number }[];
  repartitionMethode: { methode: string; total: number }[];
  parCaisse: { caisse: string; aujourd_hui: number; ce_mois: number }[];
  enAttente: { admissions: number; reinscriptions: number };
  finance: {
    total_scolarite: number; total_verse: number; total_restant: number; total_pec: number; nombre_pec: number;
  };
  kit: StatistiquesKit;
}

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

const COULEURS_METHODE = ['var(--mod-scolarite)', 'var(--success)', 'var(--gold)', 'var(--warning)', 'var(--mod-comptabilite)'];

const formatFcfa = (v: number) => `${Number(v).toLocaleString('fr-FR')} FCFA`;

const DashboardComptabilite = () => {
  const currentUser = getUserInfo();
  const departementId = currentUser?.departement_id;

  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [selectedYearId, setSelectedYearId] = useState<number | null>(null);
  const [data, setData] = useState<DashboardComptabiliteData | null>(null);
  const [loadingYears, setLoadingYears] = useState(true);
  const [loadingStats, setLoadingStats] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!departementId) {
      setError('Département non trouvé. Veuillez vous reconnecter.');
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
        setError('Impossible de charger les années académiques.');
      })
      .finally(() => setLoadingYears(false));
  }, [departementId]);

  const fetchStats = useCallback(() => {
    if (!selectedYearId) return;
    setLoadingStats(true);
    apiFetch<{ data: DashboardComptabiliteData }>(`/api/dashboard/comptabilite/stats?anneeAcademiqueId=${selectedYearId}`)
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
            <Text strong style={{ fontSize: 18 }}><DollarCircleOutlined /> Dashboard Comptabilité</Text>
            <div><Text type="secondary">Vue financière consolidée de toutes les caisses du site.</Text></div>
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
          {/* ✅ Chantier Comptabilité, priorité 1, point 1 : mêmes indicateurs que le Dashboard
              Fondateur (Scolarité totale / Versé / Restant / PEC), même style, même source de
              données (dashboardComptabilite.controller.js réutilise la requête de
              dashboardFondateur.controller.js à l'identique). */}
          <Card title="Situation financière globale" style={{ marginBottom: 24 }}>
            <Row gutter={16} style={{ marginBottom: 20 }}>
              <Col span={6}>
                <Statistic title="Scolarité totale" value={data.finance.total_scolarite} formatter={(v) => formatFcfa(Number(v))} prefix={<DollarCircleOutlined style={{ color: 'var(--mod-comptabilite)' }} />} />
              </Col>
              <Col span={6}>
                <Statistic title="Montant versé" value={data.finance.total_verse} formatter={(v) => formatFcfa(Number(v))} valueStyle={{ color: 'var(--success)' }} />
              </Col>
              <Col span={6}>
                <Statistic title="Montant restant" value={data.finance.total_restant} formatter={(v) => formatFcfa(Number(v))} valueStyle={{ color: 'var(--warning)' }} />
              </Col>
              <Col span={6}>
                <Statistic title="Prises en charge" value={data.finance.total_pec} formatter={(v) => formatFcfa(Number(v))} prefix={<GiftOutlined />} />
                <Text type="secondary">{data.finance.nombre_pec} prise(s) en charge validée(s)</Text>
              </Col>
            </Row>
            {data.finance.total_scolarite > 0 && (
              <div>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  Taux de paiement — {Math.round((data.finance.total_verse / data.finance.total_scolarite) * 100)}% de la scolarité totale déjà versée
                </Text>
                <Progress
                  percent={Math.round((data.finance.total_verse / data.finance.total_scolarite) * 100)}
                  size="small"
                  status="active"
                  strokeColor={{ '0%': 'var(--ink)', '100%': 'var(--success)' }}
                />
              </div>
            )}
          </Card>

          <KitStatsCard kit={data.kit} />

          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={6}>
              <Card>
                <Statistic title="Recettes du jour" value={data.recettesJour} formatter={(v) => formatFcfa(Number(v))} valueStyle={{ color: 'var(--success)' }} />
                <Text type="secondary">Hier : {formatFcfa(data.recettesHier)}</Text>
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic title="Recettes — semaine" value={data.recettesSemaine} formatter={(v) => formatFcfa(Number(v))} />
                <Text type="secondary">S-1 : {formatFcfa(data.recettesSemaineDerniere)}</Text>
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic title="Recettes — mois" value={data.recettesMois} formatter={(v) => formatFcfa(Number(v))} />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic title="Recettes — année académique" value={data.recettesAnnee} formatter={(v) => formatFcfa(Number(v))} valueStyle={{ color: 'var(--mod-comptabilite)' }} />
              </Card>
            </Col>
          </Row>

          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={14}>
              <Card title="Évolution des encaissements (14 derniers jours)" style={{ height: 340 }}>
                {data.evolutionEncaissements.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={data.evolutionEncaissements}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="jour" tickFormatter={(v) => new Date(v).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} />
                      <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v: number) => formatFcfa(v)} labelFormatter={(v) => new Date(v).toLocaleDateString('fr-FR')} />
                      <Area type="monotone" dataKey="total" stroke="var(--mod-comptabilite)" fill="var(--mod-comptabilite)" fillOpacity={0.15} strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : <Empty description="Aucun encaissement sur la période" style={{ marginTop: 60 }} />}
              </Card>
            </Col>
            <Col span={10}>
              <Card title="Répartition par mode de paiement (mois en cours)" style={{ height: 340 }}>
                {data.repartitionMethode.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={data.repartitionMethode} dataKey="total" nameKey="methode" cx="50%" cy="50%" outerRadius={80} label={(e) => e.methode}>
                        {data.repartitionMethode.map((entry, i) => (
                          <Cell key={entry.methode} fill={COULEURS_METHODE[i % COULEURS_METHODE.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => formatFcfa(v)} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <Empty description="Aucun paiement ce mois-ci" style={{ marginTop: 60 }} />}
              </Card>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={14}>
              <Card title="Recettes par caisse">
                <Table
                  dataSource={data.parCaisse}
                  rowKey="caisse"
                  pagination={false}
                  locale={{ emptyText: 'Aucune caisse configurée' }}
                  columns={[
                    { title: 'Caisse', dataIndex: 'caisse' },
                    { title: "Aujourd'hui", dataIndex: 'aujourd_hui', align: 'right', render: (v: number) => formatFcfa(v) },
                    { title: 'Ce mois', dataIndex: 'ce_mois', align: 'right', render: (v: number) => formatFcfa(v) },
                  ]}
                />
              </Card>
            </Col>
            <Col span={10}>
              <Card title="Paiements en attente">
                <Row gutter={16}>
                  <Col span={12}>
                    <Statistic
                      title="Admissions en attente"
                      value={data.enAttente.admissions}
                      prefix={<ClockCircleOutlined style={{ color: 'var(--danger)' }} />}
                    />
                  </Col>
                  <Col span={12}>
                    <Statistic
                      title="Réinscriptions en attente"
                      value={data.enAttente.reinscriptions}
                      prefix={<ClockCircleOutlined style={{ color: 'var(--warning)' }} />}
                    />
                  </Col>
                </Row>
              </Card>
            </Col>
          </Row>
        </>
      )}
    </div>
  );
};

export default DashboardComptabilite;
