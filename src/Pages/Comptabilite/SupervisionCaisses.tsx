import { useCallback, useEffect, useState } from 'react';
import { Card, Select, Row, Col, Statistic, Spin, Empty, Typography, Space } from 'antd';
import { BankOutlined, TeamOutlined } from '@ant-design/icons';
import PageHeader from '../../Components/PageHeader/PageHeader';
import DataTable from '../../Components/ui/DataTable';
import { apiFetch, ApiError } from '../../lib/api';

const { Text } = Typography;
const { Option } = Select;

interface Caisse {
  id: number;
  code: string;
  libelle: string;
  statut: string;
}

interface Supervision {
  caisse: Caisse;
  total_encaisse: number;
  nb_operations: number;
  par_annee_academique: { annee_id: number; annee: string; nb: number; total: number }[];
  par_type: { type_frais: string; nb: number; total: number }[];
  par_caissier: { caissier_id: number; caissier_nom: string; nb: number; total: number; premiere_operation: string; derniere_operation: string }[];
  evolution_mensuelle: { mois: string; total: number }[];
}

const formatFcfa = (v: number) => `${Number(v).toLocaleString('fr-FR')} FCFA`;

// Chantier Comptabilité — Priorité 1, point 2 : supervision des caisses et des caissiers.
// Sélection d'une caisse -> vue agrégée toutes sessions/caissiers confondus, avec la répartition
// par année académique et par type de paiement demandée explicitement ("expliquer précisément
// d'où vient l'argent encaissé et à quelle année/activité il correspond").
const SupervisionCaisses = () => {
  const [caisses, setCaisses] = useState<Caisse[]>([]);
  const [selectedCaisseId, setSelectedCaisseId] = useState<number | null>(null);
  const [data, setData] = useState<Supervision | null>(null);
  const [loadingCaisses, setLoadingCaisses] = useState(true);
  const [loadingData, setLoadingData] = useState(false);

  useEffect(() => {
    apiFetch<{ data: Caisse[] }>('/api/caisse/supervision/caisses')
      .then((res) => {
        setCaisses(res.data);
        if (res.data.length > 0) setSelectedCaisseId(res.data[0].id);
      })
      .catch((e) => {
        if (!(e instanceof ApiError && e.status === 401)) console.error(e);
      })
      .finally(() => setLoadingCaisses(false));
  }, []);

  const fetchSupervision = useCallback(() => {
    if (!selectedCaisseId) return;
    setLoadingData(true);
    apiFetch<{ data: Supervision }>(`/api/caisse/supervision/caisses/${selectedCaisseId}`)
      .then((res) => setData(res.data))
      .catch((e) => {
        if (!(e instanceof ApiError && e.status === 401)) console.error(e);
      })
      .finally(() => setLoadingData(false));
  }, [selectedCaisseId]);

  useEffect(() => {
    fetchSupervision();
  }, [fetchSupervision]);

  return (
    <div style={{ padding: 24 }}>
      <PageHeader />

      <Card style={{ marginBottom: 24 }}>
        <Space align="center">
          <BankOutlined style={{ fontSize: 20, color: 'var(--mod-comptabilite)' }} />
          <Text strong style={{ fontSize: 18 }}>Supervision des caisses</Text>
          <Select
            loading={loadingCaisses}
            value={selectedCaisseId}
            onChange={setSelectedCaisseId}
            style={{ width: 280, marginLeft: 16 }}
            placeholder="Sélectionnez une caisse"
          >
            {caisses.map((c) => (
              <Option key={c.id} value={c.id}>{c.libelle} ({c.statut})</Option>
            ))}
          </Select>
        </Space>
      </Card>

      {!selectedCaisseId ? (
        <Empty description="Aucune caisse configurée pour ce site" />
      ) : loadingData || !data ? (
        <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
      ) : (
        <>
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={8}>
              <Card>
                <Statistic
                  title={`Total encaissé — ${data.caisse.libelle}`}
                  value={data.total_encaisse}
                  formatter={(v) => formatFcfa(Number(v))}
                  valueStyle={{ color: 'var(--mod-comptabilite)' }}
                />
                <Text type="secondary">{data.nb_operations} opération(s) au total</Text>
              </Card>
            </Col>
            <Col span={8}>
              <Card title="Répartition par année académique">
                {data.par_annee_academique.length === 0 ? (
                  <Empty description="Aucune opération" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                ) : (
                  data.par_annee_academique.map((a) => (
                    <div key={a.annee_id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text>{a.annee}</Text>
                      <Text strong>{formatFcfa(a.total)}</Text>
                    </div>
                  ))
                )}
              </Card>
            </Col>
            <Col span={8}>
              <Card title="Répartition par type de paiement">
                {data.par_type.length === 0 ? (
                  <Empty description="Aucune opération" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                ) : (
                  data.par_type.map((t) => (
                    <div key={t.type_frais} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text style={{ textTransform: 'capitalize' }}>{t.type_frais}</Text>
                      <Text strong>{formatFcfa(t.total)}</Text>
                    </div>
                  ))
                )}
              </Card>
            </Col>
          </Row>

          <Card title={<><TeamOutlined /> Opérations par caissier</>} style={{ marginBottom: 24 }}>
            <DataTable
              dataSource={data.par_caissier}
              rowKey="caissier_id"
              pagination={false}
              emptyDescription="Aucune opération enregistrée sur cette caisse"
              columns={[
                { title: 'Caissier', dataIndex: 'caissier_nom', render: (v) => v || 'Non identifié' },
                { title: "Nombre d'opérations", dataIndex: 'nb', align: 'right' },
                { title: 'Montant encaissé', dataIndex: 'total', align: 'right', render: (v: number) => formatFcfa(v) },
                { title: 'Première opération', dataIndex: 'premiere_operation', render: (v) => v ? new Date(v).toLocaleDateString('fr-FR') : '-' },
                { title: 'Dernière opération', dataIndex: 'derniere_operation', render: (v) => v ? new Date(v).toLocaleDateString('fr-FR') : '-' },
              ]}
            />
          </Card>

          <Card title="Évolution mensuelle des encaissements">
            {data.evolution_mensuelle.length === 0 ? (
              <Empty description="Aucune donnée" />
            ) : (
              <DataTable
                dataSource={data.evolution_mensuelle}
                rowKey="mois"
                pagination={false}
                columns={[
                  { title: 'Mois', dataIndex: 'mois', render: (v) => new Date(v).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) },
                  { title: 'Total encaissé', dataIndex: 'total', align: 'right', render: (v: number) => formatFcfa(v) },
                ]}
              />
            )}
          </Card>
        </>
      )}
    </div>
  );
};

export default SupervisionCaisses;
