import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, Row, Col, Statistic, Select, Table, Tag, Spin, Typography, Alert, Badge, Space } from 'antd';
import {
  TeamOutlined, ApartmentOutlined, BankOutlined, SafetyCertificateOutlined,
  CheckCircleOutlined, ClockCircleOutlined, HistoryOutlined, SettingOutlined,
  WalletOutlined, ManOutlined, WomanOutlined, GlobalOutlined, UserSwitchOutlined, HourglassOutlined,
} from '@ant-design/icons';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
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

interface DashboardAdministrateurData {
  sante: { base_de_donnees: string; uptime_secondes: number; environnement: string; temps_reponse_ms: number };
  statistiques: { totalEtudiants: number; totalAgentsActifs: number; totalAgentsDesactives: number; nb_classes: number };
  etudiants: {
    total: number; hommes: number; femmes: number; inscriptions_web: number; inscriptions_agent: number;
    admissions_validees: number; reinscriptions_validees: number;
  };
  finance: { total_scolarite: number; total_verse: number; total_restant: number; total_pec: number };
  utilisateurs: {
    parRole: { role: string; actifs: number; desactives: number }[];
    rolesSansCompteActif: string[];
    cloisonnementEcole: { avec_ecole: number; vue_globale: number };
  };
  ecoles: { id: number; nom: string; statut: string }[];
  anneesAcademiques: { id: number; annee: string; etat: string }[];
  journal: { type: string; nom: string; action: string; date: string }[];
  alertes: { niveau: string; message: string }[];
  parametrage: {
    nb_sites: number; nb_ecoles: number; nb_departements: number;
    nb_filieres: number; nb_niveaux: number; nb_classes: number; nb_annees_academiques: number;
  };
  dossiersEnAttente: {
    admissions: { total: number; par_origine: Record<string, number> };
    reinscriptions: { total: number; par_origine: Record<string, number> };
  };
  kit: StatistiquesKit;
}

const QUICKLINKS = [
  { label: 'Gestion des utilisateurs', to: '/Parametres/gestion_utilisateur' },
  { label: 'Écoles', to: '/Gestion_academique/Ecoles' },
  { label: 'Départements', to: '/Gestion_academique/Departements' },
  { label: 'Filières', to: '/Gestion_academique/Filieres' },
  { label: 'Classes', to: '/Gestion_academique/Classes' },
  { label: 'Sites', to: '/Gestion_academique/Sites' },
  { label: 'Années académiques', to: '/Gestion_academique/Annes_accademique' },
];

const formatUptime = (secondes: number) => {
  const h = Math.floor(secondes / 3600);
  const m = Math.floor((secondes % 3600) / 60);
  if (h > 0) return `${h} h ${m} min`;
  return `${m} min`;
};

const formatFcfa = (v: number) => `${v.toLocaleString('fr-FR')} FCFA`;

// Libellés d'affichage pour `source_inscription` — 'web'/'agent' sont les valeurs connues
// aujourd'hui, mais toute autre valeur réellement présente en base s'affiche telle quelle.
const libelleOrigine = (origine: string) => {
  if (origine === 'web') return 'Portail web';
  if (origine === 'agent') return 'Saisie agent';
  return origine;
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

const DashboardAdministrateur = () => {
  const currentUser = getUserInfo();
  const departementId = currentUser?.departement_id;

  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [selectedYearId, setSelectedYearId] = useState<number | null>(null);
  const [data, setData] = useState<DashboardAdministrateurData | null>(null);
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
    apiFetch<{ data: DashboardAdministrateurData }>(`/api/dashboard/administrateur/stats?anneeAcademiqueId=${selectedYearId}`)
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

  if (error || (!loadingStats && !data)) {
    return (
      <div style={{ padding: 24 }}>
        <PageHeader />
        <Alert message="Erreur" description={error || 'Aucune donnée'} type="error" showIcon />
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <PageHeader />

      <Card style={{ marginBottom: 24 }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Text strong style={{ fontSize: 18 }}><SafetyCertificateOutlined /> Dashboard Administrateur</Text>
            <div><Text type="secondary">Pilotage de l'administration de la plateforme.</Text></div>
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

      {/* Santé générale */}
      <Card title="Santé générale du système" style={{ marginBottom: 24 }}>
        <Space size="large" wrap>
          <Badge status="success" text={<Text><CheckCircleOutlined /> Base de données — OK</Text>} />
          <Text><ClockCircleOutlined /> Serveur actif depuis {formatUptime(data.sante.uptime_secondes)}</Text>
          <Tag>{data.sante.environnement === 'production' ? 'Production' : 'Local'}</Tag>
          <Text type="secondary">Temps de réponse de cette requête : {data.sante.temps_reponse_ms} ms</Text>
        </Space>
        <div style={{ marginTop: 8 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Aucune supervision applicative (erreurs, charge, connexions) n'est instrumentée aujourd'hui — ce bloc reste un indicateur de disponibilité de base.
          </Text>
        </div>
      </Card>

      {/* Alertes */}
      {data.alertes.length > 0 && (
        <Space direction="vertical" style={{ width: '100%', marginBottom: 24 }}>
          {data.alertes.map((a, i) => (
            <Alert key={i} type={a.niveau === 'critical' ? 'error' : 'warning'} showIcon message={a.message} />
          ))}
        </Space>
      )}

      {/* Statistiques principales */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Étudiants inscrits — finalisés à la caisse"
              value={data.statistiques.totalEtudiants}
              prefix={<TeamOutlined style={{ color: 'var(--mod-scolarite)' }} />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="Agents actifs" value={data.statistiques.totalAgentsActifs} prefix={<TeamOutlined style={{ color: 'var(--success)' }} />} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="Agents désactivés" value={data.statistiques.totalAgentsDesactives} prefix={<TeamOutlined style={{ color: 'var(--danger)' }} />} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="Classes configurées" value={data.statistiques.nb_classes} prefix={<ApartmentOutlined style={{ color: 'var(--mod-administration)' }} />} /></Card>
        </Col>
      </Row>

      {/* Admissions/réinscriptions validées — répartition de "Étudiants inscrits" ci-dessus par
          origine du dossier (source unique : historique_inscription.type_evenement). */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={12}>
          <Card><Statistic title="Admissions validées" value={data.etudiants.admissions_validees} prefix={<CheckCircleOutlined style={{ color: 'var(--success)' }} />} /></Card>
        </Col>
        <Col span={12}>
          <Card><Statistic title="Réinscriptions validées" value={data.etudiants.reinscriptions_validees} prefix={<CheckCircleOutlined style={{ color: 'var(--success)' }} />} /></Card>
        </Col>
      </Row>

      {/* Statistiques étudiants — valeurs absolues uniquement, aucun pourcentage (demande
          explicite du 2026-08-02). Répartition des étudiants inscrits ci-dessus (même définition,
          standing='Inscrit') — jamais un dossier en attente de paiement. */}
      <Card title="Statistiques étudiants inscrits" style={{ marginBottom: 24 }}>
        <Row gutter={16}>
          <Col span={5}>
            <Statistic title="Total (inscrits)" value={data.etudiants.total} prefix={<TeamOutlined style={{ color: 'var(--mod-scolarite)' }} />} />
          </Col>
          <Col span={5}>
            <Statistic title="Hommes" value={data.etudiants.hommes} prefix={<ManOutlined style={{ color: 'var(--mod-scolarite)' }} />} />
          </Col>
          <Col span={5}>
            <Statistic title="Femmes" value={data.etudiants.femmes} prefix={<WomanOutlined style={{ color: 'var(--mod-comptabilite)' }} />} />
          </Col>
          <Col span={5}>
            <Statistic title="Inscriptions Web" value={data.etudiants.inscriptions_web} prefix={<GlobalOutlined />} />
          </Col>
          <Col span={4}>
            <Statistic title="Inscriptions par agents" value={data.etudiants.inscriptions_agent} prefix={<UserSwitchOutlined />} />
          </Col>
        </Row>
      </Card>

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

      {/* Situation financière globale — 4 indicateurs uniquement, aucun détail de caisse ni
          ventilation par méthode : le Dashboard Comptabilité reste le dashboard métier des
          finances (demande explicite du 2026-08-02). */}
      <Card title={<span><WalletOutlined /> Situation financière</span>} style={{ marginBottom: 24 }}>
        <Row gutter={16}>
          <Col span={6}>
            <Statistic title="Scolarité totale" value={formatFcfa(data.finance.total_scolarite)} />
          </Col>
          <Col span={6}>
            <Statistic title="Montant total versé" value={formatFcfa(data.finance.total_verse)} valueStyle={{ color: 'var(--success)' }} />
          </Col>
          <Col span={6}>
            <Statistic title="Montant restant" value={formatFcfa(data.finance.total_restant)} valueStyle={{ color: 'var(--danger)' }} />
          </Col>
          <Col span={6}>
            <Statistic title="Total prises en charge" value={formatFcfa(data.finance.total_pec)} />
          </Col>
        </Row>
      </Card>

      <KitStatsCard kit={data.kit} />

      {/* Utilisateurs */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={14}>
          <Card title="Utilisateurs par rôle" style={{ height: 340 }}>
            <ResponsiveContainer width="100%" height={270}>
              <BarChart data={data.utilisateurs.parRole}>
                <XAxis dataKey="role" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="actifs" name="Actifs" fill="var(--success)" />
                <Bar dataKey="desactives" name="Désactivés" fill="var(--danger)" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col span={10}>
          <Card title="Cloisonnement par école (Chantier 3)" style={{ height: 340 }}>
            <Row gutter={16} style={{ marginTop: 16 }}>
              <Col span={12}>
                <Statistic title="Agents avec école affectée" value={data.utilisateurs.cloisonnementEcole.avec_ecole} />
              </Col>
              <Col span={12}>
                <Statistic title="Agents en vue globale" value={data.utilisateurs.cloisonnementEcole.vue_globale} />
              </Col>
            </Row>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 16 }}>
              Un agent en « vue globale » (ecole_id = NULL) voit les données de toutes les écoles.
              Gérez ces affectations depuis Gestion des utilisateurs.
            </Text>
          </Card>
        </Col>
      </Row>

      {/* Écoles & Années académiques */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={12}>
          <Card title="Écoles">
            <Table
              dataSource={data.ecoles}
              rowKey="id"
              size="small"
              pagination={false}
              columns={[
                { title: 'École', dataIndex: 'nom' },
                {
                  title: 'Statut', dataIndex: 'statut', align: 'right',
                  render: (v: string) => <Tag color={v === 'actif' ? 'success' : 'default'}>{v}</Tag>,
                },
              ]}
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="Années académiques">
            <Table
              dataSource={data.anneesAcademiques}
              rowKey="id"
              size="small"
              pagination={false}
              columns={[
                { title: 'Année', dataIndex: 'annee' },
                {
                  title: 'État (ce site)', dataIndex: 'etat', align: 'right',
                  render: (v: string) => <Tag color={v === 'en cour' ? 'success' : v === 'terminée' ? 'default' : 'warning'}>{v}</Tag>,
                },
              ]}
            />
          </Card>
        </Col>
      </Row>

      {/* Journal récent */}
      <Card title={<span><HistoryOutlined /> Journaux récents</span>} style={{ marginBottom: 24 }}>
        <Table
          dataSource={data.journal}
          rowKey={(r, i) => `${r.type}-${r.nom}-${i}`}
          size="small"
          pagination={false}
          locale={{ emptyText: 'Aucune modification récente' }}
          columns={[
            { title: 'Élément', dataIndex: 'nom' },
            { title: 'Type', dataIndex: 'type', render: (v: string) => <Tag>{v}</Tag> },
            { title: 'Action', dataIndex: 'action' },
            { title: 'Date', dataIndex: 'date', render: (v: string) => new Date(v).toLocaleString('fr-FR') },
          ]}
        />
        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
          Limité aux éléments dont la date de création/modification est réellement enregistrée (écoles, départements) — filières, niveaux, classes et sites n'ont pas cet horodatage aujourd'hui.
        </Text>
      </Card>

      {/* Paramétrage */}
      <Card title={<span><SettingOutlined /> Paramétrage</span>} style={{ marginBottom: 24 }}>
        <Row gutter={[16, 16]}>
          <Col xs={12} sm={8} md={6} lg={3}><Statistic title="Sites" value={data.parametrage.nb_sites} prefix={<BankOutlined />} /></Col>
          <Col xs={12} sm={8} md={6} lg={3}><Statistic title="Écoles" value={data.parametrage.nb_ecoles} /></Col>
          <Col xs={12} sm={8} md={6} lg={3}><Statistic title="Départements" value={data.parametrage.nb_departements} /></Col>
          <Col xs={12} sm={8} md={6} lg={3}><Statistic title="Filières" value={data.parametrage.nb_filieres} /></Col>
          <Col xs={12} sm={8} md={6} lg={3}><Statistic title="Niveaux" value={data.parametrage.nb_niveaux} /></Col>
          <Col xs={12} sm={8} md={6} lg={3}><Statistic title="Classes" value={data.parametrage.nb_classes} /></Col>
          <Col xs={12} sm={8} md={6} lg={3}><Statistic title="Années académiques" value={data.parametrage.nb_annees_academiques} /></Col>
        </Row>
      </Card>

      {/* Accès rapides */}
      <Card title="Accès rapides">
        <Row gutter={[12, 12]}>
          {QUICKLINKS.map((link) => (
            <Col key={link.to} span={6}>
              <Link to={link.to}>
                <Card size="small" hoverable style={{ textAlign: 'center' }}>
                  {link.label}
                </Card>
              </Link>
            </Col>
          ))}
        </Row>
      </Card>
        </>
      )}
    </div>
  );
};

export default DashboardAdministrateur;
