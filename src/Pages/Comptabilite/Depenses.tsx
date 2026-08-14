import { useCallback, useEffect, useState } from 'react';
import {
  Card, Button, Select, Input, InputNumber, DatePicker, Space, Modal, Form,
  message, Typography, Row, Col, Statistic, Tag,
} from 'antd';
import { PlusOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import PageHeader from '../../Components/PageHeader/PageHeader';
import DataTable from '../../Components/ui/DataTable';
import StatusTag, { type StatusTone } from '../../Components/ui/StatusTag';
import { apiFetch, ApiError } from '../../lib/api';

const { Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const MODES_PAIEMENT = ['Espèces', 'Mobile Money', 'Orange Money', 'Wave', 'Virement', 'Chèque'];

interface Categorie { id: number; code: string; libelle: string }

interface Depense {
  id: number;
  date_depense: string;
  montant: number;
  motif: string;
  beneficiaire: string | null;
  mode_paiement: string;
  reference_justificatif: string | null;
  statut: 'ENREGISTREE' | 'VALIDEE' | 'ANNULEE';
  categorie_code: string;
  categorie_libelle: string;
  enregistre_par_nom: string | null;
  valide_par_nom: string | null;
  motif_annulation: string | null;
  commentaire: string | null;
}

interface Bilan {
  periode: { date_debut: string; date_fin: string };
  entrees: { par_type: { type_frais: string; nb: number; total: number }[]; prises_en_charge: { total: number; nb: number }; total: number };
  sorties: { par_categorie: { categorie_code: string; categorie_libelle: string; nb: number; total: number }[]; total: number };
  solde: number;
}

const TONS_STATUT: Record<string, StatusTone> = {
  ENREGISTREE: 'warning',
  VALIDEE: 'success',
  ANNULEE: 'danger',
};
const LABELS_STATUT: Record<string, string> = {
  ENREGISTREE: 'Enregistrée',
  VALIDEE: 'Validée',
  ANNULEE: 'Annulée',
};

const formatFcfa = (v: number) => `${Number(v).toLocaleString('fr-FR')} FCFA`;

// Chantier Comptabilité — Priorité 1, point 3 : traçabilité des sorties d'argent.
// Table dépense (migrations/sql/024_depenses_comptabilite.sql) — statut ENREGISTREE -> VALIDEE
// ou ANNULEE, seules les VALIDEE comptent dans le bilan (règle appliquée côté serveur, vérifiée
// par les tests backend).
const Depenses = () => {
  const [categories, setCategories] = useState<Categorie[]>([]);
  const [depenses, setDepenses] = useState<Depense[]>([]);
  const [loading, setLoading] = useState(false);
  const [filtreStatut, setFiltreStatut] = useState<string | undefined>(undefined);
  const [createOpen, setCreateOpen] = useState(false);
  const [annulerCible, setAnnulerCible] = useState<Depense | null>(null);
  const [motifAnnulation, setMotifAnnulation] = useState('');
  const [form] = Form.useForm();

  const [bilanRange, setBilanRange] = useState<[Dayjs, Dayjs]>([dayjs().startOf('month'), dayjs().endOf('month')]);
  const [bilan, setBilan] = useState<Bilan | null>(null);
  const [loadingBilan, setLoadingBilan] = useState(false);

  useEffect(() => {
    apiFetch<{ data: Categorie[] }>('/api/depenses/categories')
      .then((res) => setCategories(res.data))
      .catch((e) => { if (!(e instanceof ApiError && e.status === 401)) console.error(e); });
  }, []);

  const fetchDepenses = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filtreStatut) params.set('statut', filtreStatut);
    apiFetch<{ data: Depense[] }>(`/api/depenses?${params.toString()}`)
      .then((res) => setDepenses(res.data))
      .catch((e) => { if (!(e instanceof ApiError && e.status === 401)) message.error('Erreur lors du chargement des dépenses'); })
      .finally(() => setLoading(false));
  }, [filtreStatut]);

  useEffect(() => { fetchDepenses(); }, [fetchDepenses]);

  const fetchBilan = useCallback(() => {
    setLoadingBilan(true);
    apiFetch<{ data: Bilan }>(`/api/depenses/bilan?date_debut=${bilanRange[0].format('YYYY-MM-DD')}&date_fin=${bilanRange[1].format('YYYY-MM-DD')}`)
      .then((res) => setBilan(res.data))
      .catch((e) => { if (!(e instanceof ApiError && e.status === 401)) message.error('Erreur lors du chargement du bilan'); })
      .finally(() => setLoadingBilan(false));
  }, [bilanRange]);

  useEffect(() => { fetchBilan(); }, [fetchBilan]);

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      await apiFetch('/api/depenses', {
        method: 'POST',
        body: JSON.stringify({ ...values, date_depense: values.date_depense?.format('YYYY-MM-DD') }),
      });
      message.success('Dépense enregistrée.');
      setCreateOpen(false);
      form.resetFields();
      fetchDepenses();
      fetchBilan();
    } catch (e) {
      if (e instanceof ApiError) message.error(e.message);
    }
  };

  const handleValider = async (d: Depense) => {
    try {
      await apiFetch(`/api/depenses/${d.id}/valider`, { method: 'PUT', body: JSON.stringify({}) });
      message.success('Dépense validée.');
      fetchDepenses();
      fetchBilan();
    } catch (e) {
      if (e instanceof ApiError) message.error(e.message);
    }
  };

  const handleAnnuler = async () => {
    if (!annulerCible || !motifAnnulation.trim()) {
      message.warning("Le motif d'annulation est obligatoire.");
      return;
    }
    try {
      await apiFetch(`/api/depenses/${annulerCible.id}/annuler`, {
        method: 'PUT',
        body: JSON.stringify({ motif_annulation: motifAnnulation.trim() }),
      });
      message.success('Dépense annulée.');
      setAnnulerCible(null);
      setMotifAnnulation('');
      fetchDepenses();
      fetchBilan();
    } catch (e) {
      if (e instanceof ApiError) message.error(e.message);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <PageHeader />

      {/* Bilan entrées/sorties de la période */}
      <Card
        title="Bilan de la période"
        style={{ marginBottom: 24 }}
        extra={
          <DatePicker.RangePicker
            value={bilanRange}
            onChange={(v) => v && v[0] && v[1] && setBilanRange([v[0], v[1]])}
            format="DD/MM/YYYY"
          />
        }
      >
        {loadingBilan || !bilan ? <Text type="secondary">Chargement…</Text> : (
          <Row gutter={16}>
            <Col span={8}>
              <Statistic title="Entrées (paiements + PEC validées)" value={bilan.entrees.total} formatter={(v) => formatFcfa(Number(v))} valueStyle={{ color: 'var(--success)' }} />
            </Col>
            <Col span={8}>
              <Statistic title="Sorties (dépenses validées uniquement)" value={bilan.sorties.total} formatter={(v) => formatFcfa(Number(v))} valueStyle={{ color: 'var(--danger)' }} />
            </Col>
            <Col span={8}>
              <Statistic title="Solde de la période" value={bilan.solde} formatter={(v) => formatFcfa(Number(v))} valueStyle={{ color: bilan.solde >= 0 ? 'var(--mod-comptabilite)' : 'var(--danger)' }} />
            </Col>
            {bilan.sorties.par_categorie.length > 0 && (
              <Col span={24} style={{ marginTop: 16 }}>
                <Text strong>Sorties par catégorie :</Text>
                <div style={{ marginTop: 8 }}>
                  {bilan.sorties.par_categorie.map((c) => (
                    <Tag key={c.categorie_code} style={{ marginBottom: 6 }}>{c.categorie_libelle} : {formatFcfa(c.total)}</Tag>
                  ))}
                </div>
              </Col>
            )}
          </Row>
        )}
      </Card>

      <Card
        title="Dépenses enregistrées"
        extra={
          <Space>
            <Select
              placeholder="Tous les statuts"
              allowClear
              style={{ width: 180 }}
              value={filtreStatut}
              onChange={setFiltreStatut}
            >
              <Option value="ENREGISTREE">Enregistrée</Option>
              <Option value="VALIDEE">Validée</Option>
              <Option value="ANNULEE">Annulée</Option>
            </Select>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
              Enregistrer une dépense
            </Button>
          </Space>
        }
      >
        <DataTable
          dataSource={depenses}
          rowKey="id"
          loading={loading}
          columns={[
            { title: 'Date', dataIndex: 'date_depense', render: (v) => new Date(v).toLocaleDateString('fr-FR') },
            { title: 'Catégorie', dataIndex: 'categorie_libelle' },
            { title: 'Motif', dataIndex: 'motif', ellipsis: true },
            { title: 'Bénéficiaire', dataIndex: 'beneficiaire', render: (v) => v || '-' },
            { title: 'Montant', dataIndex: 'montant', align: 'right', render: (v: number) => formatFcfa(v) },
            { title: 'Mode', dataIndex: 'mode_paiement' },
            { title: 'Justificatif', dataIndex: 'reference_justificatif', render: (v) => v || '-' },
            { title: 'Enregistrée par', dataIndex: 'enregistre_par_nom' },
            { title: 'Validée par', dataIndex: 'valide_par_nom', render: (v) => v || '-' },
            {
              title: 'Statut',
              dataIndex: 'statut',
              render: (v: Depense['statut']) => <StatusTag tone={TONS_STATUT[v]} label={LABELS_STATUT[v]} />,
            },
            {
              title: 'Actions',
              render: (_, r: Depense) => (
                <Space>
                  {r.statut === 'ENREGISTREE' && (
                    <Button size="small" icon={<CheckOutlined />} onClick={() => handleValider(r)}>Valider</Button>
                  )}
                  {r.statut !== 'ANNULEE' && (
                    <Button size="small" danger icon={<CloseOutlined />} onClick={() => setAnnulerCible(r)}>Annuler</Button>
                  )}
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title="Enregistrer une dépense"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={handleCreate}
        okText="Enregistrer"
        cancelText="Annuler"
      >
        <Form form={form} layout="vertical" initialValues={{ date_depense: dayjs() }}>
          <Form.Item name="categorie_id" label="Catégorie" rules={[{ required: true, message: 'Requis' }]}>
            <Select placeholder="Sélectionnez une catégorie">
              {categories.map((c) => <Option key={c.id} value={c.id}>{c.libelle}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="date_depense" label="Date">
            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="montant" label="Montant (FCFA)" rules={[{ required: true, message: 'Requis' }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="motif" label="Motif" rules={[{ required: true, message: 'Requis' }]}>
            <TextArea rows={2} />
          </Form.Item>
          <Form.Item name="beneficiaire" label="Bénéficiaire">
            <Input />
          </Form.Item>
          <Form.Item name="mode_paiement" label="Mode de paiement" rules={[{ required: true, message: 'Requis' }]}>
            <Select>
              {MODES_PAIEMENT.map((m) => <Option key={m} value={m}>{m}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="reference_justificatif" label="Référence / justificatif">
            <Input />
          </Form.Item>
          <Form.Item name="commentaire" label="Commentaire">
            <TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Annuler la dépense"
        open={!!annulerCible}
        onCancel={() => { setAnnulerCible(null); setMotifAnnulation(''); }}
        onOk={handleAnnuler}
        okText="Confirmer l'annulation"
        okButtonProps={{ danger: true }}
        cancelText="Retour"
      >
        <Text>Cette dépense ne sera plus jamais comptabilisée dans le bilan. Motif obligatoire :</Text>
        <TextArea
          rows={3}
          value={motifAnnulation}
          onChange={(e) => setMotifAnnulation(e.target.value)}
          style={{ marginTop: 8 }}
          placeholder="Ex : erreur de saisie, doublon..."
        />
      </Modal>
    </div>
  );
};

export default Depenses;
