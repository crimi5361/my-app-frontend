/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Row, 
  Col, 
  Statistic, 
  DatePicker, 
  Table, 
  Spin,
  Alert,
  Typography,
  Empty
} from 'antd';
import { 
  UserOutlined, 
  ClockCircleOutlined, 
  CheckCircleOutlined, 
  TeamOutlined,
  BarChartOutlined,
  FileDoneOutlined,
  ExceptionOutlined,
  DollarOutlined,
  TransactionOutlined
} from '@ant-design/icons';
import type { Dayjs } from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import PageHeader from '../../Components/PageHeader/PageHeader';
import StatusTag from '../../Components/ui/StatusTag';

const { Text } = Typography;
const { RangePicker } = DatePicker;

// Interfaces pour le typage
interface StatsData {
  totalEtudiants?: number;
  inscriptionsAujourdhui?: number;
  enAttente?: number;
  confirmesAujourdhui?: number;
  inscriptionsParUtilisateur?: InscriptionUtilisateur[];
  inscriptionsJournalieres?: InscriptionJournaliere[];
  statsParStatut?: StatutStat[];
  paiementsParUtilisateur?: PaiementUtilisateur[];
  nombreTotalPaiements?: number;
  periode?: {
    anneeAcademique?: string;
    startDate?: string;
    endDate?: string;
  };
}

interface InscriptionUtilisateur {
  utilisateur_id: number;
  utilisateur_nom: string;
  utilisateur_email: string;
  total_inscrits: number;
  en_attente: number;
  confirmes: number;
}

interface PaiementUtilisateur {
  utilisateur_id: number;
  utilisateur_nom: string;
  utilisateur_email: string;
  nombre_paiements: number;
}

interface InscriptionJournaliere {
  date: string;
  nombre_inscriptions: number;
  confirmes: number;
}

interface StatutStat {
  statut_scolaire: string;
  nombre: number;
}

const DashScolarite: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [stats, setStats] = useState<StatsData>({});
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null]>([null, null]);
  const [error, setError] = useState<string | null>(null);
  const API_URL = import.meta.env.VITE_API_URL_SERVER || "";

  const fetchStats = async (startDate: Dayjs | null = null, endDate: Dayjs | null = null) => {
    try {
      setLoading(true);
      setError(null);
      
      const token = localStorage.getItem('token');
      let url = `${API_URL}/api/StatsInscriptions/stats-inscriptions`;
      
      const params = new URLSearchParams();
      if (startDate && endDate) {
        params.append('startDate', startDate.format('YYYY-MM-DD'));
        params.append('endDate', endDate.format('YYYY-MM-DD'));
      }
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Erreur ${response.status}: ${response.statusText}`);
      }
      
      const data: StatsData = await response.json();
      setStats(data);
    } catch (error: any) {
      console.error('Erreur lors du chargement des statistiques:', error);
      setError(error.message || 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleDateChange = (dates: [Dayjs | null, Dayjs | null] | null) => {
    if (dates) {
      setDateRange(dates);
      if (dates[0] && dates[1]) {
        fetchStats(dates[0], dates[1]);
      } else {
        fetchStats();
      }
    } else {
      setDateRange([null, null]);
      fetchStats();
    }
  };

  const columnsInscriptions: ColumnsType<InscriptionUtilisateur> = [
    {
      title: 'Utilisateur',
      dataIndex: 'utilisateur_nom',
      key: 'utilisateur_nom',
      render: (text: string, record: InscriptionUtilisateur) => (
        <div>
          <div style={{ fontWeight: 'bold' }}>{text}</div>
          <Text type="secondary">{record.utilisateur_email}</Text>
        </div>
      ),
    },
    {
      title: 'Total Inscrits',
      dataIndex: 'total_inscrits',
      key: 'total_inscrits',
      align: 'center',
      render: (text: number) => <StatusTag tone="info" label={String(text)} />,
    },
    {
      title: 'En Attente',
      dataIndex: 'en_attente',
      key: 'en_attente',
      align: 'center',
      render: (text: number) => <StatusTag tone="warning" icon={<ClockCircleOutlined />} label={String(text)} />,
    },
    {
      title: 'Confirmés',
      dataIndex: 'confirmes',
      key: 'confirmes',
      align: 'center',
      render: (text: number) => <StatusTag tone="success" icon={<CheckCircleOutlined />} label={String(text)} />,
    },
  ];

  const columnsPaiements: ColumnsType<PaiementUtilisateur> = [
    {
      title: 'Utilisateur',
      dataIndex: 'utilisateur_nom',
      key: 'utilisateur_nom',
      render: (text: string, record: PaiementUtilisateur) => (
        <div>
          <div style={{ fontWeight: 'bold' }}>{text}</div>
          <Text type="secondary">{record.utilisateur_email}</Text>
        </div>
      ),
    },
    {
      title: 'Nombre de Paiements',
      dataIndex: 'nombre_paiements',
      key: 'nombre_paiements',
      align: 'center',
      render: (text: number) => <StatusTag tone="info" icon={<TransactionOutlined />} label={String(text)} />,
    },
  ];

  const columnsStats: ColumnsType<StatutStat> = [
    {
      title: 'Statut',
      dataIndex: 'statut_scolaire',
      key: 'statut_scolaire',
      render: (text: string) => (
        <StatusTag
          tone={
            text === 'Affecté' ? 'success' :
            text === 'Non affecté' ? 'danger' :
            text === 'en attente' ? 'warning' : 'neutral'
          }
          label={text}
        />
      ),
    },
    {
      title: 'Nombre',
      dataIndex: 'nombre',
      key: 'nombre',
      align: 'center',
      render: (text: number) => <Text strong>{text}</Text>,
    },
  ];

  if (loading) {
    return (
      <div>
        <PageHeader />
        <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <PageHeader />
        <Alert
          message="Erreur de chargement"
          description={error}
          type="error"
          showIcon
          style={{ margin: '20px' }}
        />
      </div>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      <PageHeader />
      
      {/* Filtre de période */}
      <Card 
        title={
          <div>
            <BarChartOutlined /> Filtre par Période
          </div>
        }
        style={{ marginBottom: 20 }}
        extra={
          <RangePicker 
            onChange={handleDateChange}
            value={dateRange}
            style={{ width: 300 }}
            format="DD/MM/YYYY"
          />
        }
      >
        <Text type="secondary">
          {dateRange[0] && dateRange[1] 
            ? `Période sélectionnée: ${dateRange[0].format('DD/MM/YYYY')} au ${dateRange[1].format('DD/MM/YYYY')}`
            : 'Toutes les périodes'
          }
        </Text>
      </Card>

      {/* Cartes de statistiques */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Total Étudiants Inscrits"
              value={stats.totalEtudiants || 0}
              prefix={<UserOutlined style={{ color: 'var(--mod-scolarite)' }} />}
              valueStyle={{ color: 'var(--mod-scolarite)' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Inscriptions Aujourd'hui"
              value={stats.inscriptionsAujourdhui || 0}
              prefix={<TeamOutlined style={{ color: 'var(--success)' }} />}
              valueStyle={{ color: 'var(--success)' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="En Attente de Validation"
              value={stats.enAttente || 0}
              prefix={<ClockCircleOutlined style={{ color: 'var(--warning)' }} />}
              valueStyle={{ color: 'var(--warning)' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Total Paiements"
              value={stats.nombreTotalPaiements || 0}
              prefix={<DollarOutlined style={{ color: 'var(--mod-comptabilite)' }} />}
              valueStyle={{ color: 'var(--mod-comptabilite)' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Paiements par utilisateur */}
      <Card 
        title={
          <div>
            <TransactionOutlined /> Paiements par Utilisateur(Comptables)
          </div>
        }
        style={{ marginBottom: 20 }}
      >
        {stats.paiementsParUtilisateur && stats.paiementsParUtilisateur.length > 0 ? (
          <Table
            columns={columnsPaiements}
            dataSource={stats.paiementsParUtilisateur}
            rowKey="utilisateur_id"
            pagination={{ pageSize: 10 }}
            scroll={{ x: 600 }}
          />
        ) : (
          <Empty description="Aucune donnée de paiement" />
        )}
      </Card>

      {/* Inscriptions par utilisateur */}
      <Card 
        title={
          <div>
            <TeamOutlined /> Inscriptions par Utilisateur (Agents de saisie)
          </div>
        }
        style={{ marginBottom: 20 }}
      >
        {stats.inscriptionsParUtilisateur && stats.inscriptionsParUtilisateur.length > 0 ? (
          <Table
            columns={columnsInscriptions}
            dataSource={stats.inscriptionsParUtilisateur}
            rowKey="utilisateur_id"
            pagination={{ pageSize: 10 }}
            scroll={{ x: 600 }}
          />
        ) : (
          <Empty description="Aucune donnée d'inscription" />
        )}
      </Card>

      {/* Statistiques par statut */}
      <Card 
        title={
          <div>
            <FileDoneOutlined /> Répartition par Statut
          </div>
        }
        style={{ marginBottom: 20 }}
      >
        {stats.statsParStatut && stats.statsParStatut.length > 0 ? (
          <Table
            columns={columnsStats}
            dataSource={stats.statsParStatut}
            rowKey="statut_scolaire"
            pagination={false}
            size="small"
          />
        ) : (
          <Empty description="Aucune statistique par statut" />
        )}
      </Card>

      {/* Inscriptions journalières */}
      <Card 
        title={
          <div>
            <ExceptionOutlined /> Évolution Journalière
          </div>
        }
      >
        {stats.inscriptionsJournalieres && stats.inscriptionsJournalieres.length > 0 ? (
          <Table
            dataSource={stats.inscriptionsJournalieres.map(item => ({
              ...item,
              key: item.date,
              date: new Date(item.date).toLocaleDateString('fr-FR')
            }))}
            pagination={{ pageSize: 5 }}
            size="small"
          >
            <Table.Column title="Date" dataIndex="date" key="date" />
            <Table.Column
              title="Nombre d'Inscriptions"
              dataIndex="nombre_inscriptions"
              key="nombre_inscriptions"
              align="center"
              render={(text: number) => <StatusTag tone="info" label={String(text)} />}
            />
            <Table.Column
              title="Confirmés"
              dataIndex="confirmes"
              key="confirmes"
              align="center"
              render={(text: number) => <StatusTag tone="success" label={String(text)} />}
            />
          </Table>
        ) : (
          <Empty description="Aucune donnée journalière" />
        )}
      </Card>

      {/* Informations sur la période */}
      {stats.periode && (
        <Alert
          message="Informations sur la période"
          description={
            <div>
              <div>Année académique: {stats.periode.anneeAcademique}</div>
              {stats.periode.startDate && (
                <div>Période: {stats.periode.startDate} au {stats.periode.endDate}</div>
              )}
            </div>
          }
          type="info"
          showIcon
          style={{ marginTop: 20 }}
        />
      )}
    </div>
  );
};

export default DashScolarite;