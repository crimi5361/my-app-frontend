import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Input, DatePicker, Switch, Space, Button, message } from 'antd';
import { PrinterOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import PageHeader from '../../Components/PageHeader/PageHeader';
import DataTable from '../../Components/ui/DataTable';
import StatusTag, { type StatusTone } from '../../Components/ui/StatusTag';
import { apiFetch, ApiError } from '../../lib/api';

interface Paiement {
  id: number;
  montant: number;
  methode: string;
  date_paiement: string;
  etudiant_id: number;
  nom: string;
  prenoms: string;
  matricule_iipea: string;
  numero_recu: string | null;
  caissier_nom: string | null;
}

// 'Espèces'/'Mobile Money'/'Orange Money' : graphies historiques, conservées pour l'affichage
// des anciens paiements. 'especes' : nouvelle graphie canonique (2026-08-18, cf. lib/methodesPaiement.ts).
const TONS_METHODE: Record<string, StatusTone> = {
  'especes': 'success',
  'Espèces': 'success',
  'Mobile Money': 'warning',
  'Orange Money': 'warning',
  'Wave': 'info',
};

const PaiementsJour = () => {
  const navigate = useNavigate();
  const [paiements, setPaiements] = useState<Paiement[]>([]);
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState<Dayjs | null>(dayjs());
  const [etudiantQuery, setEtudiantQuery] = useState('');
  const [numeroRecu, setNumeroRecu] = useState('');
  const [mesPaiementsUniquement, setMesPaiementsUniquement] = useState(true);

  const fetchPaiements = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (date) params.set('date', date.format('YYYY-MM-DD'));
      if (etudiantQuery.trim()) params.set('etudiant', etudiantQuery.trim());
      if (numeroRecu.trim()) params.set('numero_recu', numeroRecu.trim());
      if (mesPaiementsUniquement) params.set('mine', 'true');

      const data = await apiFetch(`/api/caisse/paiements?${params.toString()}`);
      setPaiements(data.data || []);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return;
      message.error('Erreur lors du chargement des paiements');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, mesPaiementsUniquement]);

  useEffect(() => {
    fetchPaiements();
  }, [fetchPaiements]);

  return (
    <div style={{ padding: 24 }}>
      <PageHeader />

      <Card title="Paiements du jour" style={{ marginBottom: 24 }}>
        <Space wrap style={{ marginBottom: 16 }}>
          <DatePicker value={date} onChange={setDate} format="DD/MM/YYYY" allowClear placeholder="Toutes les dates" />
          <Input
            placeholder="Étudiant (nom / matricule)"
            value={etudiantQuery}
            onChange={e => setEtudiantQuery(e.target.value)}
            onPressEnter={fetchPaiements}
            style={{ width: 220 }}
          />
          <Input
            placeholder="Numéro de reçu"
            value={numeroRecu}
            onChange={e => setNumeroRecu(e.target.value)}
            onPressEnter={fetchPaiements}
            style={{ width: 220 }}
          />
          <Button type="primary" onClick={fetchPaiements}>Filtrer</Button>
          <Space>
            <span>Mes paiements uniquement</span>
            <Switch checked={mesPaiementsUniquement} onChange={setMesPaiementsUniquement} />
          </Space>
        </Space>

        <DataTable
          dataSource={paiements}
          rowKey="id"
          loading={loading}
          columns={[
            { title: 'Étudiant', dataIndex: 'nom', render: (_, r) => `${r.nom} ${r.prenoms}` },
            { title: 'Matricule', dataIndex: 'matricule_iipea' },
            { title: 'Montant', dataIndex: 'montant', render: (v) => `${Number(v).toLocaleString('fr-FR')} FCFA` },
            { title: 'Méthode', dataIndex: 'methode', render: (v) => <StatusTag tone={TONS_METHODE[v] || 'neutral'} label={v} /> },
            { title: 'Reçu', dataIndex: 'numero_recu' },
            { title: 'Caissier', dataIndex: 'caissier_nom' },
            { title: 'Date', dataIndex: 'date_paiement', render: (v) => new Date(v).toLocaleDateString('fr-FR') },
            {
              title: 'Action',
              render: (_, r) => (
                <Button size="small" icon={<PrinterOutlined />} onClick={() => navigate(`/Etudiant/Recu_Payement/${r.etudiant_id}`)}>
                  Réimprimer
                </Button>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
};

export default PaiementsJour;
