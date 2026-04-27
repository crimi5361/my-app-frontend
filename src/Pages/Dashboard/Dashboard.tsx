/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect } from 'react';
import { 
  Card, 
  Row, 
  Col, 
  Statistic, 
  Select, 
  Typography, 
  Progress, 
  Alert, 
  Spin,
  Tag,
  Divider,
  message
} from 'antd';
import { 
  DollarOutlined, 
  CheckCircleOutlined, 
  ExclamationCircleOutlined, 
  TeamOutlined,
  ApartmentOutlined,
  GiftOutlined,
  CalendarOutlined,
  UserSwitchOutlined,
  ClockCircleOutlined,
  BarChartOutlined
} from '@ant-design/icons';
import PageHeader from '../../Components/PageHeader/PageHeader';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;
const { Option } = Select;

interface DashboardStats {
  totalScolarite: number;
  totalVerse: number;
  totalRestant: number;
  totalEtudiants: number;
  totalClasses: number;
  totalKits: number;
  totalReduction: number;
  nbKits?: number;
  nbPrisesEnCharge?: number;
  repartitionFiliere: { filiere: string; total: number }[];
  repartitionCurcus: { curcus: string; total: number }[];
  repartitionStatut: { statut_scolaire: string; total: number }[];
  repartitionStanding: { standing: string; total: number }[];
  totalAffectes: number;
  totalNonAffectes: number;
  totalEnAttente: number;
}

interface AcademicYear {
  id: number;
  annee: string;
  etat: string;
}

// ── Lecture utilisateur + departement_id ──────────────────────────────────
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

const Dashboard = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [selectedYearId, setSelectedYearId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const API_URL = import.meta.env.VITE_API_URL_SERVER || "";
  const navigate = useNavigate();

  const currentUser = getUserInfo();
  const departement_id = currentUser?.departement_id;

  // ── Fetch années du département ──────────────────────────────────────
  useEffect(() => {
    if (!departement_id) {
      setError("Département non trouvé. Veuillez vous reconnecter.");
      setLoading(false);
      return;
    }

    const fetchAcademicYears = async () => {
      try {
        // ← on passe le departement_id pour n'avoir que les années de ce département
        const response = await fetch(
          `${API_URL}/api/annees?departement_id=${departement_id}`,
          { headers: { 'Content-Type': 'application/json' } }
        );

        if (!response.ok) throw new Error(`Erreur ${response.status}: ${response.statusText}`);

        const data = await response.json();

        if (Array.isArray(data)) {
          setAcademicYears(data);
          // Sélectionner automatiquement l'année "en cour" du département
          const currentYear = data.find(
            (year: AcademicYear) => year.etat === 'en cour' || year.etat === 'en cours'
          );
          if (currentYear) {
            setSelectedYearId(currentYear.id);
          } else if (data.length > 0) {
            setSelectedYearId(data[0].id);
          } else {
            setLoading(false); // aucune année pour ce département
          }
        } else {
          throw new Error('Format de réponse inattendu');
        }
      } catch (err) {
        console.error('Erreur récupération années académiques:', err);
        setError(err instanceof Error ? err.message : 'Une erreur est survenue');
        setLoading(false);
      }
    };

    fetchAcademicYears();
  }, [API_URL, departement_id]);

  // ── Fetch stats dashboard ────────────────────────────────────────────
  useEffect(() => {
    if (!selectedYearId) return;

    const fetchDashboardStats = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');

        const response = await fetch(
          `${API_URL}/api/StatDashboard/stats?anneeAcademiqueId=${selectedYearId}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (response.status === 401) {
          message.error('Session expirée, veuillez vous reconnecter');
          localStorage.removeItem('token');
          navigate('/login');
          return;
        }

        if (!response.ok) throw new Error(`Erreur ${response.status}: ${response.statusText}`);

        const data = await response.json();
        setStats(data);

      } catch (err) {
        console.error('Erreur récupération statistiques:', err);
        setError(err instanceof Error ? err.message : 'Une erreur est survenue');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardStats();
  }, [selectedYearId, API_URL]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XAF' }).format(amount);

  // ── Guards ─────────────────────────────────────────────────────────
  if (!departement_id) {
    return (
      <div style={{ padding: '24px' }}>
        <PageHeader />
        <Alert
          message="Département non assigné"
          description="Votre compte n'est associé à aucun département. Veuillez contacter l'administrateur."
          type="warning" showIcon
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: '24px' }}>
        <PageHeader />
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh', flexDirection: 'column' }}>
          <Spin size="large" />
          <Text style={{ marginTop: 16, color: '#666' }}>Chargement des données...</Text>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '24px' }}>
        <PageHeader />
        <Alert
          message="Erreur"
          description={error}
          type="error"
          showIcon
          action={
            <button
              onClick={() => window.location.reload()}
              style={{ backgroundColor: '#ff4d4f', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}
            >
              Réessayer
            </button>
          }
        />
      </div>
    );
  }

  if (academicYears.length === 0) {
    return (
      <div style={{ padding: '24px' }}>
        <PageHeader />
        <Alert
          message="Aucune année académique"
          description={`Aucune année académique n'est configurée pour votre département (${currentUser?.departementName || ''}). Veuillez en créer une dans Gestion académique → Années.`}
          type="warning" showIcon
        />
      </div>
    );
  }

  const selectedYear = academicYears.find(year => year.id === selectedYearId);

  return (
    <div style={{ padding: '24px' }}>
      <PageHeader />

      {/* En-tête */}
      <Card style={{ marginBottom: 24 }}>
        <Row align="middle" justify="space-between">
          <Col>
            <Title level={2} style={{ margin: 0 }}>
              <CalendarOutlined /> Tableau de Bord
            </Title>
            {selectedYear && (
              <Text type="secondary">
                {currentUser?.departementName} — {selectedYear.annee}
                <Tag
                  color={selectedYear.etat === 'en cour' || selectedYear.etat === 'en cours' ? 'green' : 'blue'}
                  style={{ marginLeft: 8 }}
                >
                  {selectedYear.etat}
                </Tag>
              </Text>
            )}
          </Col>
          <Col>
            <Select
              value={selectedYearId}
              onChange={setSelectedYearId}
              style={{ width: 250 }}
              placeholder="Sélectionner une année"
            >
              {academicYears.map((year) => (
                <Option key={year.id} value={year.id}>
                  {year.annee} ({year.etat})
                </Option>
              ))}
            </Select>
          </Col>
        </Row>
      </Card>

      {!selectedYearId ? (
        <Alert
          message="Aucune année sélectionnée"
          description="Veuillez sélectionner une année académique pour afficher les statistiques."
          type="warning" showIcon
        />
      ) : (
        <>
          {/* Cartes principales */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="Scolarité Ouverte"
                  value={stats?.totalScolarite || 0}
                  precision={0}
                  valueStyle={{ color: '#1890ff' }}
                  prefix={<DollarOutlined />}
                  formatter={value => formatCurrency(Number(value))}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="Scolarité Versée"
                  value={stats?.totalVerse || 0}
                  precision={0}
                  valueStyle={{ color: '#52c41a' }}
                  prefix={<CheckCircleOutlined />}
                  formatter={value => formatCurrency(Number(value))}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="Scolarité Restante"
                  value={stats?.totalRestant || 0}
                  precision={0}
                  valueStyle={{ color: '#faad14' }}
                  prefix={<ExclamationCircleOutlined />}
                  formatter={value => formatCurrency(Number(value))}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="Étudiants Inscrits"
                  value={stats?.totalEtudiants || 0}
                  valueStyle={{ color: '#722ed1' }}
                  prefix={<TeamOutlined />}
                />
              </Card>
            </Col>
          </Row>

          {/* Cartes secondaires */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="Nombre de Classes"
                  value={stats?.totalClasses || 0}
                  valueStyle={{ color: '#13c2c2' }}
                  prefix={<ApartmentOutlined />}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="Montant Perçus sur Kits"
                  value={stats?.totalKits || 0}
                  precision={0}
                  valueStyle={{ color: '#eb2f96' }}
                  prefix={<GiftOutlined />}
                  formatter={value => formatCurrency(Number(value))}
                />
                {stats?.nbKits !== undefined && (
                  <Text type="secondary">{stats.nbKits} kit(s) au total</Text>
                )}
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="Réductions"
                  value={stats?.totalReduction || 0}
                  precision={0}
                  valueStyle={{ color: '#fa8c16' }}
                  prefix={<DollarOutlined />}
                  formatter={value => formatCurrency(Number(value))}
                />
                {stats?.nbPrisesEnCharge !== undefined && (
                  <Text type="secondary">{stats.nbPrisesEnCharge} prise(s) en charge</Text>
                )}
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="Taux de Paiement"
                  value={stats?.totalScolarite ? ((stats.totalVerse / stats.totalScolarite) * 100) : 0}
                  precision={2}
                  valueStyle={{ color: '#52c41a' }}
                  suffix="%"
                />
                <Progress
                  percent={stats?.totalScolarite ? Math.round((stats.totalVerse / stats.totalScolarite) * 100) : 0}
                  size="small"
                  status="active"
                />
              </Card>
            </Col>
          </Row>

          {/* Affectation & attente */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="Étudiants Affectés"
                  value={stats?.totalAffectes || 0}
                  valueStyle={{ color: '#389e0d' }}
                  prefix={<UserSwitchOutlined />}
                />
                {!!stats?.totalEtudiants && (
                  <Progress
                    percent={Math.round((stats.totalAffectes / stats.totalEtudiants) * 100)}
                    size="small" status="success"
                  />
                )}
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="Étudiants Non Affectés"
                  value={stats?.totalNonAffectes || 0}
                  valueStyle={{ color: '#cf1322' }}
                  prefix={<UserSwitchOutlined />}
                />
                {!!stats?.totalEtudiants && (
                  <Progress
                    percent={Math.round((stats.totalNonAffectes / stats.totalEtudiants) * 100)}
                    size="small" status="exception"
                  />
                )}
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="En Attente"
                  value={stats?.totalEnAttente || 0}
                  valueStyle={{ color: '#d4b106' }}
                  prefix={<ClockCircleOutlined />}
                />
                {!!stats?.totalEtudiants && (
                  <Progress
                    percent={Math.round((stats.totalEnAttente / stats.totalEtudiants) * 100)}
                    size="small" status="active"
                  />
                )}
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="Statuts Scolaires"
                  value={stats?.repartitionStatut?.length || 0}
                  valueStyle={{ color: '#096dd9' }}
                  prefix={<BarChartOutlined />}
                  suffix="types"
                />
                <Text type="secondary">Répartition complète</Text>
              </Card>
            </Col>
          </Row>

          {/* Répartitions */}
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <Card title="Répartition par Cursus" bordered={false} style={{ height: '100%' }}>
                {stats?.repartitionCurcus?.length ? (
                  stats.repartitionCurcus.map((cursus, index) => (
                    <div key={index} style={{ marginBottom: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text strong>{cursus.curcus}</Text>
                        <Text>{cursus.total} étudiant(s)</Text>
                      </div>
                      <Progress
                        percent={stats.totalEtudiants ? Math.round((cursus.total / stats.totalEtudiants) * 100) : 0}
                        size="small"
                        strokeColor={{ '0%': '#ff7a45', '100%': '#ffec3d' }}
                      />
                    </div>
                  ))
                ) : (
                  <Text type="secondary">Aucune donnée disponible</Text>
                )}
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title="Répartition par Statut Scolaire" bordered={false}>
                {stats?.repartitionStatut?.length ? (
                  stats.repartitionStatut.map((statut, index) => (
                    <div key={index} style={{ marginBottom: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text strong>
                          {statut.statut_scolaire === 'Affecté' ? 'Affectés' :
                           statut.statut_scolaire === 'Non affecté' ? 'Non affectés' :
                           statut.statut_scolaire === 'en_attente' ? 'En attente' :
                           statut.statut_scolaire}
                        </Text>
                        <Text>{statut.total} étudiant(s)</Text>
                      </div>
                      <Progress
                        percent={stats.totalEtudiants ? Math.round((statut.total / stats.totalEtudiants) * 100) : 0}
                        size="small"
                        strokeColor={{ '0%': '#722ed1', '100%': '#eb2f96' }}
                      />
                    </div>
                  ))
                ) : (
                  <Text type="secondary">Aucune donnée disponible</Text>
                )}
              </Card>
            </Col>
          </Row>

          {/* Résumé */}
          <Card style={{ marginTop: 24 }}>
            <Title level={4}>Résumé</Title>
            <Divider />
            <Row gutter={[16, 16]}>
              <Col xs={24} md={8}>
                <Text strong>Total scolarité : </Text>
                <Text>{formatCurrency(stats?.totalScolarite || 0)}</Text>
              </Col>
              <Col xs={24} md={8}>
                <Text strong>Montant perçu : </Text>
                <Text type="success">{formatCurrency(stats?.totalVerse || 0)}</Text>
              </Col>
              <Col xs={24} md={8}>
                <Text strong>Solde restant : </Text>
                <Text type="warning">{formatCurrency(stats?.totalRestant || 0)}</Text>
              </Col>
            </Row>
            <Divider />
            <Row gutter={[16, 16]}>
              <Col xs={24} md={6}>
                <Text strong>Étudiants affectés : </Text>
                <Text>{stats?.totalAffectes || 0}</Text>
              </Col>
              <Col xs={24} md={6}>
                <Text strong>Non affectés : </Text>
                <Text type="danger">{stats?.totalNonAffectes || 0}</Text>
              </Col>
              <Col xs={24} md={6}>
                <Text strong>En attente : </Text>
                <Text type="warning">{stats?.totalEnAttente || 0}</Text>
              </Col>
              <Col xs={24} md={6}>
                <Text strong>Total étudiants : </Text>
                <Text>{stats?.totalEtudiants || 0}</Text>
              </Col>
            </Row>
          </Card>
        </>
      )}
    </div>
  );
};

export default Dashboard;