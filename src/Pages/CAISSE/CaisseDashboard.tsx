import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Row, Col, Statistic, Button, Table, Tag, Spin, Modal, Form, InputNumber, message, Empty, Typography } from 'antd';
import {
  WalletOutlined, DollarCircleOutlined, TransactionOutlined, ClockCircleOutlined,
  UserAddOutlined, RedoOutlined, LockOutlined, UnlockOutlined
} from '@ant-design/icons';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import PageHeader from '../../Components/PageHeader/PageHeader';
import { apiFetch, ApiError } from '../../lib/api';

const { Text } = Typography;

const COULEURS_METHODE: Record<string, string> = {
  'Espèces': 'var(--success)',
  'Mobile Money': 'var(--warning)',
  'Orange Money': 'var(--gold)',
  'Wave': 'var(--mod-scolarite)',
};

interface SessionActive {
  id: number;
  montant_ouverture: number;
  date_ouverture: string;
}

interface DashboardStats {
  caisse_id: number | null;
  session_active: SessionActive | null;
  aujourd_hui: {
    total_encaisse: number;
    nb_paiements: number;
    repartition_methode: { methode: string; nb: number; total: number }[];
    inscriptions_validees: number;
    reinscriptions_validees: number;
  };
  en_attente: { admissions: number; reinscriptions: number };
  dernieres_operations: {
    id: number; montant: number; methode: string; date_paiement: string;
    nom: string; prenoms: string; numero_recu: string | null;
  }[];
  evolution_encaissements: { jour: string; total: number }[];
  kits_deposes_aujourdhui: number;
  pec_en_attente: number;
}

const CaisseDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [ouvertureModalVisible, setOuvertureModalVisible] = useState(false);
  const [ouvrantCaisse, setOuvrantCaisse] = useState(false);
  const [form] = Form.useForm();

  const fetchStats = useCallback(async () => {
    try {
      const data = await apiFetch<{ data: DashboardStats }>('/api/caisse/dashboard/stats');
      setStats(data.data);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return;
      message.error('Erreur lors du chargement du tableau de bord');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleOuvrirCaisse = async (values: { montant_ouverture: number }) => {
    setOuvrantCaisse(true);
    try {
      await apiFetch('/api/caisse/session/ouvrir', {
        method: 'POST',
        body: JSON.stringify({ montant_ouverture: values.montant_ouverture }),
      });
      message.success('Caisse ouverte avec succès.');
      setOuvertureModalVisible(false);
      form.resetFields();
      fetchStats();
    } catch (e) {
      if (e instanceof ApiError) {
        message.error(e.message);
        return;
      }
      message.error("Erreur lors de l'ouverture de la caisse");
    } finally {
      setOuvrantCaisse(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!stats) return null;

  const sessionOuverte = !!stats.session_active;

  return (
    <div style={{ padding: 24 }}>
      <PageHeader />

      <Card style={{ marginBottom: 24 }}>
        <Row justify="space-between" align="middle">
          <Col>
            {sessionOuverte ? (
              <Text strong style={{ color: 'var(--success)' }}>
                <UnlockOutlined /> Caisse ouverte depuis le {new Date(stats.session_active!.date_ouverture).toLocaleString('fr-FR')}
                {' — '}Solde d'ouverture : {Number(stats.session_active!.montant_ouverture).toLocaleString('fr-FR')} FCFA
              </Text>
            ) : (
              <Text strong style={{ color: 'var(--danger)' }}>
                <LockOutlined /> Votre caisse n'est pas ouverte aujourd'hui
              </Text>
            )}
          </Col>
          <Col>
            {sessionOuverte ? (
              <Button danger onClick={() => navigate('/caisse/fermer')}>Fermer la caisse</Button>
            ) : (
              <Button type="primary" onClick={() => setOuvertureModalVisible(true)}>Ouvrir la caisse</Button>
            )}
          </Col>
        </Row>
      </Card>

      <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>Mon activité aujourd'hui</Text>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic title="Total encaissé par moi aujourd'hui" value={stats.aujourd_hui.total_encaisse} suffix="FCFA" precision={0}
              formatter={(v) => Number(v).toLocaleString('fr-FR')} prefix={<DollarCircleOutlined style={{ color: 'var(--success)' }} />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="Mes paiements aujourd'hui" value={stats.aujourd_hui.nb_paiements} prefix={<TransactionOutlined style={{ color: 'var(--mod-scolarite)' }} />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="Inscriptions que j'ai validées" value={stats.aujourd_hui.inscriptions_validees} prefix={<UserAddOutlined style={{ color: 'var(--warning)' }} />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="Réinscriptions que j'ai validées" value={stats.aujourd_hui.reinscriptions_validees} prefix={<RedoOutlined style={{ color: 'var(--mod-comptabilite)' }} />} />
          </Card>
        </Col>
      </Row>

      <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>File d'attente du site (partagée entre caissiers)</Text>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic title="Admissions en attente de paiement" value={stats.en_attente.admissions} prefix={<ClockCircleOutlined style={{ color: 'var(--danger)' }} />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="Réinscriptions en attente de paiement" value={stats.en_attente.reinscriptions} prefix={<ClockCircleOutlined style={{ color: 'var(--danger)' }} />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="Kits déposés aujourd'hui" value={stats.kits_deposes_aujourdhui} prefix={<WalletOutlined style={{ color: 'var(--success)' }} />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="Prises en charge en attente" value={stats.pec_en_attente} prefix={<ClockCircleOutlined style={{ color: 'var(--warning)' }} />} />
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={12}>
          <Card title="Mon évolution des encaissements (14 derniers jours)" style={{ height: 340 }}>
            {stats.evolution_encaissements.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={stats.evolution_encaissements}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="jour" tickFormatter={(v) => new Date(v).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} />
                  <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => `${v.toLocaleString('fr-FR')} FCFA`} labelFormatter={(v) => new Date(v).toLocaleDateString('fr-FR')} />
                  <Line type="monotone" dataKey="total" stroke="var(--success)" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            ) : <Empty description="Aucun encaissement sur la période" style={{ marginTop: 60 }} />}
          </Card>
        </Col>
        <Col span={12}>
          <Card title="Ma répartition par méthode (aujourd'hui)" style={{ height: 340 }}>
            {stats.aujourd_hui.repartition_methode.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={stats.aujourd_hui.repartition_methode} dataKey="total" nameKey="methode" cx="50%" cy="50%" outerRadius={90} label={(e) => e.methode}>
                    {stats.aujourd_hui.repartition_methode.map((entry) => (
                      <Cell key={entry.methode} fill={COULEURS_METHODE[entry.methode] || 'var(--text-soft)'} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => `${v.toLocaleString('fr-FR')} FCFA`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : <Empty description="Aucun paiement aujourd'hui" style={{ marginTop: 60 }} />}
          </Card>
        </Col>
      </Row>

      <Card title="Mes dernières opérations">
        <Table
          dataSource={stats.dernieres_operations}
          rowKey="id"
          pagination={false}
          locale={{ emptyText: 'Aucune opération récente' }}
          columns={[
            { title: 'Étudiant', dataIndex: 'nom', render: (_, r) => `${r.nom} ${r.prenoms}` },
            { title: 'Montant', dataIndex: 'montant', render: (v) => `${Number(v).toLocaleString('fr-FR')} FCFA` },
            { title: 'Méthode', dataIndex: 'methode', render: (v) => <Tag color={COULEURS_METHODE[v] || 'default'}>{v}</Tag> },
            { title: 'Reçu', dataIndex: 'numero_recu' },
            { title: 'Date', dataIndex: 'date_paiement', render: (v) => new Date(v).toLocaleDateString('fr-FR') },
          ]}
        />
      </Card>

      <Modal
        title="Ouvrir la caisse"
        open={ouvertureModalVisible}
        onCancel={() => setOuvertureModalVisible(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleOuvrirCaisse}>
          <Form.Item
            name="montant_ouverture"
            label="Solde d'ouverture (FCFA)"
            rules={[{ required: true, message: 'Veuillez saisir le solde d\'ouverture' }]}
            initialValue={0}
          >
            <InputNumber style={{ width: '100%' }} min={0} step={1000} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={ouvrantCaisse} block>
              Ouvrir la caisse
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default CaisseDashboard;
