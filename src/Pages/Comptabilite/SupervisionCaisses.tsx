import { useCallback, useEffect, useState } from 'react';
import { Card, Select, Row, Col, Statistic, Spin, Empty, Typography, Space, Tabs, DatePicker } from 'antd';
import { BankOutlined, TeamOutlined, UserOutlined } from '@ant-design/icons';
import type { Dayjs } from 'dayjs';
import PageHeader from '../../Components/PageHeader/PageHeader';
import DataTable from '../../Components/ui/DataTable';
import { apiFetch, ApiError } from '../../lib/api';

const { Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

interface Caisse { id: number; code: string; libelle: string; statut: string; }
interface AnneeAcademique { id: number; annee: string; }
interface Caissier { id: number; nom: string; email: string; }

interface Supervision {
  caisse: Caisse;
  total_encaisse: number;
  nb_operations: number;
  par_annee_academique: { annee_id: number; annee: string; nb: number; total: number }[];
  par_type: { type_frais: string; nb: number; total: number }[];
  par_caissier: { caissier_id: number; caissier_nom: string; nb: number; total: number; premiere_operation: string; derniere_operation: string }[];
  evolution_mensuelle: { mois: string; total: number }[];
}

interface SupervisionCaissier {
  caissier: { id: number; nom: string };
  total_encaisse: number;
  nb_operations: number;
  par_methode: { methode: string; nb: number; total: number }[];
  evolution_quotidienne: { jour: string; nb: number; total: number }[];
  operations: {
    id: number; date_paiement: string; etudiant_nom: string | null; etudiant_prenoms: string | null;
    type_paiement: string; montant: number; methode: string; numero_recu: string | null;
    annee_academique: string | null; caisse_libelle: string; session_caisse_id: number | null;
    session_date_ouverture: string | null; session_statut: string | null;
  }[];
}

const formatFcfa = (v: number) => `${Number(v).toLocaleString('fr-FR')} FCFA`;

// Chantier Comptabilité — Priorité 1, point 2 : supervision des caisses (onglet historique, inchangé).
const SupervisionParCaisse = () => {
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
      .catch((e) => { if (!(e instanceof ApiError && e.status === 401)) console.error(e); })
      .finally(() => setLoadingCaisses(false));
  }, []);

  const fetchSupervision = useCallback(() => {
    if (!selectedCaisseId) return;
    setLoadingData(true);
    apiFetch<{ data: Supervision }>(`/api/caisse/supervision/caisses/${selectedCaisseId}`)
      .then((res) => setData(res.data))
      .catch((e) => { if (!(e instanceof ApiError && e.status === 401)) console.error(e); })
      .finally(() => setLoadingData(false));
  }, [selectedCaisseId]);

  useEffect(() => { fetchSupervision(); }, [fetchSupervision]);

  return (
    <>
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
            {caisses.map((c) => <Option key={c.id} value={c.id}>{c.libelle} ({c.statut})</Option>)}
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
    </>
  );
};

// Chantier Moyens Généraux, Phase 2D — ajustements (2026-08-19) : "le besoin métier est en réalité
// supervision des CAISSIERS" — entrée par caissier, filtrable par année académique et période.
// Basée exclusivement sur les paiements réellement enregistrés (jamais sur l'état d'une session
// caisse) : un caissier dont la caisse est aujourd'hui fermée reste pleinement consultable ici.
const SupervisionParCaissier = () => {
  const [caissiers, setCaissiers] = useState<Caissier[]>([]);
  const [annees, setAnnees] = useState<AnneeAcademique[]>([]);
  const [selectedCaissierId, setSelectedCaissierId] = useState<number | null>(null);
  const [selectedAnnee, setSelectedAnnee] = useState<number | 'toutes'>('toutes');
  const [dates, setDates] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [data, setData] = useState<SupervisionCaissier | null>(null);
  const [loadingCaissiers, setLoadingCaissiers] = useState(true);
  const [loadingData, setLoadingData] = useState(false);

  useEffect(() => {
    apiFetch<{ data: Caissier[] }>('/api/caisse/supervision/caissiers')
      .then((res) => {
        setCaissiers(res.data);
        if (res.data.length > 0) setSelectedCaissierId(res.data[0].id);
      })
      .catch((e) => { if (!(e instanceof ApiError && e.status === 401)) console.error(e); })
      .finally(() => setLoadingCaissiers(false));
    apiFetch<AnneeAcademique[]>('/api/annees').then(setAnnees).catch(() => {});
  }, []);

  const fetchSupervision = useCallback(() => {
    if (!selectedCaissierId) return;
    setLoadingData(true);
    const params = new URLSearchParams();
    if (selectedAnnee !== 'toutes') params.set('anneeAcademiqueId', String(selectedAnnee));
    if (dates?.[0]) params.set('dateDebut', dates[0].format('YYYY-MM-DD'));
    if (dates?.[1]) params.set('dateFin', dates[1].format('YYYY-MM-DD'));
    apiFetch<{ data: SupervisionCaissier }>(`/api/caisse/supervision/caissiers/${selectedCaissierId}?${params.toString()}`)
      .then((res) => setData(res.data))
      .catch((e) => { if (!(e instanceof ApiError && e.status === 401)) console.error(e); })
      .finally(() => setLoadingData(false));
  }, [selectedCaissierId, selectedAnnee, dates]);

  useEffect(() => { fetchSupervision(); }, [fetchSupervision]);

  return (
    <>
      <Card style={{ marginBottom: 24 }}>
        <Space align="center" wrap>
          <UserOutlined style={{ fontSize: 20, color: 'var(--mod-comptabilite)' }} />
          <Text strong style={{ fontSize: 18 }}>Supervision des caissiers</Text>
          <Select
            loading={loadingCaissiers}
            value={selectedCaissierId}
            onChange={setSelectedCaissierId}
            style={{ width: 240, marginLeft: 16 }}
            placeholder="Sélectionnez un caissier"
          >
            {caissiers.map((c) => <Option key={c.id} value={c.id}>{c.nom}</Option>)}
          </Select>
          <Select value={selectedAnnee} onChange={setSelectedAnnee} style={{ width: 160 }}>
            <Option value="toutes">Toutes les années</Option>
            {annees.map((a) => <Option key={a.id} value={a.id}>{a.annee}</Option>)}
          </Select>
          <RangePicker value={dates} onChange={(v) => setDates(v as [Dayjs | null, Dayjs | null] | null)} />
        </Space>
      </Card>

      {caissiers.length === 0 && !loadingCaissiers ? (
        <Empty description="Aucun caissier configuré pour ce site" />
      ) : !selectedCaissierId ? (
        <Empty description="Sélectionnez un caissier" />
      ) : loadingData || !data ? (
        <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
      ) : (
        <>
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={8}>
              <Card>
                <Statistic
                  title={`Recettes totales — ${data.caissier.nom}`}
                  value={data.total_encaisse}
                  formatter={(v) => formatFcfa(Number(v))}
                  valueStyle={{ color: 'var(--mod-comptabilite)' }}
                />
                <Text type="secondary">{data.nb_operations} paiement(s)</Text>
              </Card>
            </Col>
            <Col span={16}>
              <Card title="Répartition par méthode de paiement">
                {data.par_methode.length === 0 ? (
                  <Empty description="Aucune opération" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                ) : (
                  <Row gutter={16}>
                    {data.par_methode.map((m) => (
                      <Col span={8} key={m.methode}>
                        <Statistic title={m.methode} value={m.total} formatter={(v) => formatFcfa(Number(v))} suffix={<Text type="secondary" style={{ fontSize: 12 }}> ({m.nb})</Text>} />
                      </Col>
                    ))}
                  </Row>
                )}
              </Card>
            </Col>
          </Row>

          <Card title="Évolution quotidienne" style={{ marginBottom: 24 }}>
            {data.evolution_quotidienne.length === 0 ? (
              <Empty description="Aucune donnée" />
            ) : (
              <DataTable
                dataSource={data.evolution_quotidienne}
                rowKey="jour"
                pagination={false}
                columns={[
                  { title: 'Date', dataIndex: 'jour', render: (v: string) => new Date(v).toLocaleDateString('fr-FR') },
                  { title: 'Nombre de paiements', dataIndex: 'nb', align: 'right' },
                  { title: 'Recettes', dataIndex: 'total', align: 'right', render: (v: number) => formatFcfa(v) },
                ]}
              />
            )}
          </Card>

          <Card title="Détail des opérations">
            <DataTable
              dataSource={data.operations}
              rowKey="id"
              pagination={{ pageSize: 20, showSizeChanger: true }}
              emptyDescription="Aucune opération sur la période sélectionnée"
              columns={[
                { title: 'Date/heure', dataIndex: 'date_paiement', render: (v: string) => new Date(v).toLocaleString('fr-FR') },
                { title: 'Étudiant', key: 'etudiant', render: (_, r) => r.etudiant_nom ? `${r.etudiant_nom} ${r.etudiant_prenoms ?? ''}` : '—' },
                { title: 'Type', dataIndex: 'type_paiement', render: (v: string) => <span style={{ textTransform: 'capitalize' }}>{v}</span> },
                { title: 'Montant', dataIndex: 'montant', align: 'right', render: (v: number) => formatFcfa(v) },
                { title: 'Méthode', dataIndex: 'methode' },
                { title: 'Reçu', dataIndex: 'numero_recu', render: (v: string | null) => v || '—' },
                { title: 'Année académique', dataIndex: 'annee_academique', render: (v: string | null) => v || '—' },
                { title: 'Caisse', dataIndex: 'caisse_libelle' },
                {
                  title: 'Session', key: 'session',
                  render: (_, r) => r.session_date_ouverture
                    ? `${new Date(r.session_date_ouverture).toLocaleDateString('fr-FR')} (${r.session_statut ?? '?'})`
                    : '—',
                },
              ]}
            />
          </Card>
        </>
      )}
    </>
  );
};

const SupervisionCaisses = () => (
  <div style={{ padding: 24 }}>
    <PageHeader />
    <Tabs
      defaultActiveKey="caisse"
      items={[
        { key: 'caisse', label: <><BankOutlined /> Par caisse</>, children: <SupervisionParCaisse /> },
        { key: 'caissier', label: <><UserOutlined /> Par caissier</>, children: <SupervisionParCaissier /> },
      ]}
    />
  </div>
);

export default SupervisionCaisses;
