import { useCallback, useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Select, Spin, Empty, Typography, Alert, Progress } from 'antd';
import {
  TeamOutlined, RiseOutlined, DollarCircleOutlined, WalletOutlined, GiftOutlined,
  TrophyOutlined, ToolOutlined, CheckCircleOutlined, HourglassOutlined, InboxOutlined, WarningOutlined,
} from '@ant-design/icons';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
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

interface DashboardFondateurData {
  etudiants: {
    total_inscrits: number; total_en_attente: number; total_general: number;
    par_statut_scolaire: { statut: string; total: number }[];
  };
  inscriptions: { total_annee: number; aujourd_hui: number; cette_semaine: number; ce_mois: number };
  parEcole: { ecole: string; total: number }[];
  parFiliere: { filiere: string; total: number }[];
  parNiveau: { niveau: string; total: number }[];
  parCursus: { cursus: string; total: number }[];
  evolutionInscriptions: { jour: string; total: number }[];
  finance: {
    total_scolarite: number; total_verse: number; total_restant: number; total_pec: number; nombre_pec: number;
    evolution_recettes: { mois: string; total: number }[];
  };
  caisses: { nb_caisses: number; sessions_ouvertes: number; encaisse_jour: number; encaisse_mois: number };
  moyensGeneraux: {
    distribution: { total_inscrits: number; etudiants_servis: number; etudiants_restants: number; taux_couverture: number };
    stock: { nb_references: number; nb_rupture: number; nb_stock_faible: number; valeur_totale_estimee: number };
    alertes: { nom: string; code: string; solde: number; seuil_alerte: number; statut: string }[];
    evolution_distributions: { mois: string; total: number }[];
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

const formatFcfa = (v: number) => `${Number(v).toLocaleString('fr-FR')} FCFA`;

const DashboardFondateur = () => {
  const currentUser = getUserInfo();
  const departementId = currentUser?.departement_id;

  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [selectedYearId, setSelectedYearId] = useState<number | null>(null);
  const [data, setData] = useState<DashboardFondateurData | null>(null);
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
        setError('Impossible de charger les années académiques.');
      })
      .finally(() => setLoadingYears(false));
  }, [departementId]);

  const fetchStats = useCallback(() => {
    if (!selectedYearId) return;
    setLoadingStats(true);
    apiFetch<{ data: DashboardFondateurData }>(`/api/dashboard/fondateur/stats?anneeAcademiqueId=${selectedYearId}`)
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
            <Text strong style={{ fontSize: 18 }}><TrophyOutlined /> Espace Fondateur — Pilotage stratégique</Text>
            <div><Text type="secondary">Vue d'ensemble de votre site, toutes écoles confondues.</Text></div>
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
          {/* Situation financière globale — première section visible, conformément au cahier
              des charges : le Fondateur doit voir la santé financière dès l'ouverture. */}
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
              <div style={{ marginBottom: 20 }}>
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
            <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>
              Évolution des recettes — année académique {academicYears.find((y) => y.id === selectedYearId)?.annee ?? ''} (votre site)
            </Text>
            {data.finance.evolution_recettes.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={data.finance.evolution_recettes}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="mois" tickFormatter={(v) => new Date(v).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })} />
                  <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => formatFcfa(v)} labelFormatter={(v) => new Date(v).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })} />
                  <Line type="monotone" dataKey="total" stroke="var(--mod-comptabilite)" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            ) : <Empty description="Aucun encaissement sur l'année sélectionnée" style={{ marginTop: 40 }} />}
          </Card>

          {/* Vue globale étudiants + inscriptions */}
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={4}>
              <Card><Statistic title="Étudiants inscrits" value={data.etudiants.total_inscrits} prefix={<TeamOutlined style={{ color: 'var(--mod-scolarite)' }} />} /></Card>
            </Col>
            <Col span={4}>
              <Card><Statistic title="En attente" value={data.etudiants.total_en_attente} prefix={<TeamOutlined style={{ color: 'var(--warning)' }} />} /></Card>
            </Col>
            <Col span={4}>
              <Card><Statistic title="Inscriptions — année" value={data.inscriptions.total_annee} prefix={<RiseOutlined />} /></Card>
            </Col>
            <Col span={4}>
              <Card><Statistic title="Aujourd'hui" value={data.inscriptions.aujourd_hui} /></Card>
            </Col>
            <Col span={4}>
              <Card><Statistic title="Cette semaine" value={data.inscriptions.cette_semaine} /></Card>
            </Col>
            <Col span={4}>
              <Card><Statistic title="Ce mois" value={data.inscriptions.ce_mois} /></Card>
            </Col>
          </Row>

          {/* Migré depuis l'ancien Dashboard générique (2026-08-02) */}
          {data.etudiants.par_statut_scolaire.length > 0 && (
            <Card title="Répartition par statut scolaire" style={{ marginBottom: 24 }}>
              <Row gutter={16}>
                {data.etudiants.par_statut_scolaire.map((s) => (
                  <Col span={12} key={s.statut}>
                    <div style={{ marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
                      <Text strong>{s.statut}</Text>
                      <Text type="secondary">{s.total} étudiant(s)</Text>
                    </div>
                    <Progress
                      percent={data.etudiants.total_inscrits > 0 ? Math.round((s.total / data.etudiants.total_inscrits) * 100) : 0}
                      size="small"
                      strokeColor={s.statut === 'Affecté' ? 'var(--success)' : 'var(--warning)'}
                    />
                  </Col>
                ))}
              </Row>
            </Card>
          )}

          {/* Évolution des inscriptions */}
          <Card title="Évolution des inscriptions (30 derniers jours)" style={{ marginBottom: 24, height: 340 }}>
            {data.evolutionInscriptions.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={data.evolutionInscriptions}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="jour" tickFormatter={(v) => new Date(v).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} />
                  <YAxis allowDecimals={false} />
                  <Tooltip labelFormatter={(v) => new Date(v).toLocaleDateString('fr-FR')} />
                  <Line type="monotone" dataKey="total" stroke="var(--gold)" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            ) : <Empty description="Aucune inscription sur la période" style={{ marginTop: 60 }} />}
          </Card>

          {/* Répartitions */}
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={24}>
              <Card title="Répartition par école" style={{ height: 320 }}>
                {data.parEcole.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={data.parEcole} layout="vertical" margin={{ left: 24 }}>
                      <XAxis type="number" allowDecimals={false} />
                      <YAxis type="category" dataKey="ecole" width={140} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="total" fill="var(--mod-scolarite)" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <Empty description="Aucune donnée" style={{ marginTop: 40 }} />}
              </Card>
            </Col>
          </Row>

          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={12}>
              <Card title="Répartition par filière (top 10)" style={{ height: 320 }}>
                {data.parFiliere.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={data.parFiliere} layout="vertical" margin={{ left: 24 }}>
                      <XAxis type="number" allowDecimals={false} />
                      <YAxis type="category" dataKey="filiere" width={140} tick={{ fontSize: 9 }} />
                      <Tooltip />
                      <Bar dataKey="total" fill="var(--gold)" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <Empty description="Aucune donnée" style={{ marginTop: 40 }} />}
              </Card>
            </Col>
            <Col span={12}>
              <Card title="Répartition par niveau" style={{ height: 320 }}>
                {data.parNiveau.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={data.parNiveau}>
                      <XAxis dataKey="niveau" tick={{ fontSize: 8 }} interval={0} angle={-30} textAnchor="end" height={60} />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="total" fill="var(--success)" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <Empty description="Aucune donnée" style={{ marginTop: 40 }} />}
              </Card>
            </Col>
          </Row>

          {/* Migré depuis l'ancien Dashboard générique */}
          <Card title="Répartition par cursus" style={{ marginBottom: 24, height: 300 }}>
            {data.parCursus.length > 0 ? (
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={data.parCursus}>
                  <XAxis dataKey="cursus" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="total" fill="var(--mod-comptabilite)" />
                </BarChart>
              </ResponsiveContainer>
            ) : <Empty description="Aucune donnée" style={{ marginTop: 40 }} />}
          </Card>

          {/* Vue globale caisses */}
          <Card title="Vue globale des caisses" style={{ marginBottom: 24 }}>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
              Vue de synthèse uniquement — le détail par caisse et par mode de paiement reste sur le Dashboard Comptabilité.
            </Text>
            <Row gutter={16}>
              <Col span={6}>
                <Statistic title="Caisses configurées" value={data.caisses.nb_caisses} prefix={<WalletOutlined />} />
              </Col>
              <Col span={6}>
                <Statistic title="Sessions actuellement ouvertes" value={data.caisses.sessions_ouvertes} />
              </Col>
              <Col span={6}>
                <Statistic title="Encaissé aujourd'hui" value={data.caisses.encaisse_jour} formatter={(v) => formatFcfa(Number(v))} />
              </Col>
              <Col span={6}>
                <Statistic title="Encaissé ce mois" value={data.caisses.encaisse_mois} formatter={(v) => formatFcfa(Number(v))} />
              </Col>
            </Row>
          </Card>

          {/* Moyens Généraux (sous-phase 12) — indicateurs de pilotage uniquement, aucune action
              de gestion (pas d'ajustement, pas de distribution ici : ça reste le rôle du
              Dashboard Moyens Généraux dédié). */}
          <Card title={<span><ToolOutlined /> Moyens Généraux</span>} style={{ marginBottom: 24 }}>
            <Row gutter={16} style={{ marginBottom: 20 }}>
              <Col span={6}>
                <Statistic title="Étudiants inscrits" value={data.moyensGeneraux.distribution.total_inscrits} prefix={<TeamOutlined style={{ color: 'var(--mod-scolarite)' }} />} />
              </Col>
              <Col span={6}>
                <Statistic title="Ayant reçu leurs accessoires" value={data.moyensGeneraux.distribution.etudiants_servis} prefix={<CheckCircleOutlined style={{ color: 'var(--success)' }} />} />
              </Col>
              <Col span={6}>
                <Statistic title="Restant à servir" value={data.moyensGeneraux.distribution.etudiants_restants} prefix={<HourglassOutlined style={{ color: 'var(--warning)' }} />} />
              </Col>
              <Col span={6}>
                <Statistic title="Taux de couverture" value={data.moyensGeneraux.distribution.taux_couverture} suffix="%" />
              </Col>
            </Row>

            <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 8 }}><InboxOutlined /> État global du stock</Text>
            <Row gutter={16} style={{ marginBottom: 20 }}>
              <Col span={6}>
                <Statistic title="Références au catalogue" value={data.moyensGeneraux.stock.nb_references} />
              </Col>
              <Col span={6}>
                <Statistic title="En rupture" value={data.moyensGeneraux.stock.nb_rupture} valueStyle={{ color: data.moyensGeneraux.stock.nb_rupture > 0 ? 'var(--danger)' : undefined }} />
              </Col>
              <Col span={6}>
                <Statistic title="En stock faible" value={data.moyensGeneraux.stock.nb_stock_faible} valueStyle={{ color: data.moyensGeneraux.stock.nb_stock_faible > 0 ? 'var(--warning)' : undefined }} />
              </Col>
              <Col span={6}>
                <Statistic title="Valeur estimée du stock" value={formatFcfa(data.moyensGeneraux.stock.valeur_totale_estimee)} />
              </Col>
            </Row>

            {data.moyensGeneraux.alertes.length > 0 && (
              <Alert
                type="warning"
                showIcon
                icon={<WarningOutlined />}
                style={{ marginBottom: 20 }}
                message="Accessoires en alerte de stock"
                description={data.moyensGeneraux.alertes.map((a) => `${a.nom} (${a.solde} restant${a.solde > 1 ? 's' : ''})`).join(' · ')}
              />
            )}

            <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>
              Évolution des distributions — année académique {academicYears.find((y) => y.id === selectedYearId)?.annee ?? ''} (votre site)
            </Text>
            {data.moyensGeneraux.evolution_distributions.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.moyensGeneraux.evolution_distributions}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="mois" tickFormatter={(v) => new Date(v).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })} />
                  <YAxis allowDecimals={false} />
                  <Tooltip labelFormatter={(v) => new Date(v).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })} formatter={(v: number) => [`${v} étudiant(s)`, 'Servis']} />
                  <Bar dataKey="total" fill="var(--mod-administration)" />
                </BarChart>
              </ResponsiveContainer>
            ) : <Empty description="Aucune distribution sur l'année sélectionnée" style={{ marginTop: 40 }} />}
          </Card>
        </>
      )}
    </div>
  );
};

export default DashboardFondateur;
