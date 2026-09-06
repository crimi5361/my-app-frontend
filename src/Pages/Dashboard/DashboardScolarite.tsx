import { useCallback, useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Select, Table, Tag, Spin, Empty, Typography, Alert } from 'antd';
import {
  TeamOutlined, CalendarOutlined, RiseOutlined, GlobalOutlined, HourglassOutlined,
} from '@ant-design/icons';
import {
  ResponsiveContainer, Line, BarChart, Bar, ComposedChart, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
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

interface DashboardScolariteData {
  totalInscrits: number;
  // Chantier Statistiques (2026-08-18) : sourcés sur historique_inscription.created_at (date
  // réelle de validation caisse), jamais etudiant.date_inscription (date de création du dossier).
  inscriptionsAujourdhui: number;
  inscriptionsHier: number;
  inscriptionsCetteSemaine: number;
  inscriptionsSemaineDerniere: number;
  origine: { web_pct: number; agent_pct: number };
  // Quotidien depuis le 1er jour de l'année académique du site (plus 14 jours glissants), avec
  // split admissions/réinscriptions validées.
  evolutionQuotidienne: { jour: string; admissions: number; reinscriptions: number; total: number }[];
  parEcole: { ecole: string; total: number }[];
  parNiveau: { niveau: string; total: number }[];
  parFiliere: { filiere: string; total: number }[];
  // Chantier "Activité des agents" (2026-09-06) — admissions ET réinscriptions, source unique
  // historique_inscription (voir statistiquesInscriptions.service.js::getActiviteAgents). Remplace
  // l'ancien {agent, total_30j, moyenne_jour, tendance} qui ne comptait jamais les réinscriptions.
  activiteAgents: { agent_id: number; agent_nom: string; nouvelles_admissions: number; reinscriptions: number; total: number }[];
  dossiersEnAttente: {
    admissions: { total: number; par_origine: Record<string, number> };
    reinscriptions: { total: number; par_origine: Record<string, number> };
  };
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

// Libellés d'affichage pour `source_inscription` — 'web'/'agent' sont les valeurs connues
// aujourd'hui, mais toute autre valeur réellement présente en base s'affiche telle quelle.
const libelleOrigine = (origine: string) => {
  if (origine === 'web') return 'Portail web';
  if (origine === 'agent') return 'Saisie agent';
  return origine;
};

const DashboardScolarite = () => {
  const currentUser = getUserInfo();
  const departementId = currentUser?.departement_id;

  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [selectedYearId, setSelectedYearId] = useState<number | null>(null);
  const [data, setData] = useState<DashboardScolariteData | null>(null);
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
        setError("Impossible de charger les années académiques.");
      })
      .finally(() => setLoadingYears(false));
  }, [departementId]);

  const fetchStats = useCallback(() => {
    if (!selectedYearId) return;
    setLoadingStats(true);
    apiFetch<{ data: DashboardScolariteData }>(`/api/dashboard/scolarite/stats?anneeAcademiqueId=${selectedYearId}`)
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

  const deltaAujourdhui = data ? data.inscriptionsAujourdhui - data.inscriptionsHier : 0;
  const deltaSemaine = data ? data.inscriptionsCetteSemaine - data.inscriptionsSemaineDerniere : 0;

  return (
    <div style={{ padding: 24 }}>
      <PageHeader />

      <Card style={{ marginBottom: 24 }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Text strong style={{ fontSize: 18 }}><CalendarOutlined /> Dashboard Scolarité</Text>
            <div><Text type="secondary">Suivi des inscriptions et de l'activité des agents — aucune donnée financière ici.</Text></div>
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
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Étudiants inscrits — finalisés à la caisse (année en cours)"
                  value={data.totalInscrits}
                  prefix={<TeamOutlined style={{ color: 'var(--mod-scolarite)' }} />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Inscriptions validées aujourd'hui"
                  value={data.inscriptionsAujourdhui}
                  prefix={<RiseOutlined style={{ color: deltaAujourdhui >= 0 ? 'var(--success)' : 'var(--danger)' }} />}
                />
                <Text type="secondary">vs hier : {data.inscriptionsHier}</Text>
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic title="Inscriptions validées cette semaine" value={data.inscriptionsCetteSemaine} />
                <Text type="secondary">S-1 : {data.inscriptionsSemaineDerniere} ({deltaSemaine >= 0 ? '+' : ''}{deltaSemaine})</Text>
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic title="Origine Web / Interne" value={`${data.origine.web_pct}% / ${data.origine.agent_pct}%`} prefix={<GlobalOutlined style={{ color: 'var(--mod-comptabilite)' }} />} />
              </Card>
            </Col>
          </Row>

          {/* Dossiers en attente de paiement — admissions + réinscriptions, même définition que
              le Dashboard Caisse, avec répartition par origine (source_inscription). */}
          <Card title="Dossiers en attente de paiement" style={{ marginBottom: 24 }}>
            <Row gutter={16}>
              <Col xs={24} sm={12}>
                <Statistic
                  title="Admissions en attente"
                  value={data.dossiersEnAttente.admissions.total}
                  prefix={<HourglassOutlined style={{ color: 'var(--warning)' }} />}
                />
                <div style={{ marginTop: 8 }}>
                  {Object.entries(data.dossiersEnAttente.admissions.par_origine).map(([origine, total]) => (
                    <Text key={origine} type="secondary" style={{ display: 'block', fontSize: 13 }}>
                      {libelleOrigine(origine)} : <Text strong>{total}</Text>
                    </Text>
                  ))}
                </div>
              </Col>
              <Col xs={24} sm={12}>
                <Statistic
                  title="Réinscriptions en attente"
                  value={data.dossiersEnAttente.reinscriptions.total}
                  prefix={<HourglassOutlined style={{ color: 'var(--warning)' }} />}
                />
                <div style={{ marginTop: 8 }}>
                  {Object.entries(data.dossiersEnAttente.reinscriptions.par_origine).map(([origine, total]) => (
                    <Text key={origine} type="secondary" style={{ display: 'block', fontSize: 13 }}>
                      {libelleOrigine(origine)} : <Text strong>{total}</Text>
                    </Text>
                  ))}
                </div>
              </Col>
            </Row>
          </Card>

          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={14}>
              <Card title="Évolution des inscriptions validées — depuis le début de l'année académique" style={{ height: 380 }}>
                {data.evolutionQuotidienne.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={data.evolutionQuotidienne}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="jour" tickFormatter={(v) => new Date(v).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} />
                      <YAxis allowDecimals={false} />
                      <Tooltip
                        labelFormatter={(v) => new Date(v).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                        formatter={(v: number, name: string) => [`${v} dossier(s)`, name]}
                      />
                      <Legend />
                      <Bar dataKey="admissions" name="Admissions validées" stackId="inscriptions" fill="var(--mod-scolarite)" />
                      <Bar dataKey="reinscriptions" name="Réinscriptions validées" stackId="inscriptions" fill="var(--gold)" />
                      <Line type="monotone" dataKey="total" name="Total validé" stroke="var(--ink)" strokeWidth={2} dot={{ r: 2 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : <Empty description="Aucune inscription validée sur la période" style={{ marginTop: 60 }} />}
              </Card>
            </Col>
            <Col span={10}>
              <Card title="Inscriptions par école" style={{ height: 340 }}>
                {data.parEcole.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={data.parEcole} layout="vertical" margin={{ left: 24 }}>
                      <XAxis type="number" allowDecimals={false} />
                      <YAxis type="category" dataKey="ecole" width={110} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="total" fill="var(--mod-scolarite)" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <Empty description="Aucune donnée" style={{ marginTop: 60 }} />}
              </Card>
            </Col>
          </Row>

          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={12}>
              <Card title="Par niveau" style={{ height: 300 }}>
                {data.parNiveau.length > 0 ? (
                  <ResponsiveContainer width="100%" height={230}>
                    <BarChart data={data.parNiveau}>
                      <XAxis dataKey="niveau" tick={{ fontSize: 9 }} interval={0} angle={-30} textAnchor="end" height={50} />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="total" fill="var(--mod-administration)" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <Empty description="Aucune donnée" style={{ marginTop: 40 }} />}
              </Card>
            </Col>
            <Col span={12}>
              <Card title="Par filière (top 5)" style={{ height: 300 }}>
                {data.parFiliere.length > 0 ? (
                  <ResponsiveContainer width="100%" height={230}>
                    <BarChart data={data.parFiliere} layout="vertical" margin={{ left: 24 }}>
                      <XAxis type="number" allowDecimals={false} />
                      <YAxis type="category" dataKey="filiere" width={90} tick={{ fontSize: 9 }} />
                      <Tooltip />
                      <Bar dataKey="total" fill="var(--gold)" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <Empty description="Aucune donnée" style={{ marginTop: 40 }} />}
              </Card>
            </Col>
          </Row>

          <Card title="Activité des agents — étudiants traités (30 derniers jours)">
            <Table
              dataSource={data.activiteAgents}
              rowKey="agent_id"
              pagination={false}
              locale={{ emptyText: 'Aucune activité sur la période' }}
              columns={[
                { title: 'Agent', dataIndex: 'agent_nom' },
                { title: 'Nouvelles admissions', dataIndex: 'nouvelles_admissions', align: 'right' },
                { title: 'Réinscriptions', dataIndex: 'reinscriptions', align: 'right' },
                {
                  title: 'Total', dataIndex: 'total', align: 'right',
                  render: (v: number) => <Tag color="blue">{v}</Tag>,
                },
              ]}
            />
          </Card>
        </>
      )}
    </div>
  );
};

export default DashboardScolarite;
