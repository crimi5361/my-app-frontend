import { useCallback, useEffect, useState } from 'react';
import { Card, Select, Space, Button, message, Avatar } from 'antd';
import { PrinterOutlined } from '@ant-design/icons';
import PageHeader from '../../Components/PageHeader/PageHeader';
import DataTable from '../../Components/ui/DataTable';
import StatusTag from '../../Components/ui/StatusTag';
import { apiFetch, ApiError } from '../../lib/api';

const API_URL = import.meta.env.VITE_API_URL_SERVER || '';

interface Dossier {
  type: 'admission' | 'reinscription';
  etudiant_id: number;
  nom: string;
  prenoms: string;
  matricule_iipea: string;
  photo_url: string | null;
  filiere: string;
  niveau: string;
  code_paiement: string | null;
  date_dossier: string;
  dossier_id: number;
}

interface AnneeAcademique {
  id: number;
  annee: string;
  etat?: string;
}

const InscriptionsEnAttente = () => {
  const [dossiers, setDossiers] = useState<Dossier[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [annees, setAnnees] = useState<AnneeAcademique[]>([]);
  const [anneeId, setAnneeId] = useState<number | null>(null);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });

  useEffect(() => {
    const loadAnnees = async () => {
      try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const siteId = user?.departement_id;
        const liste: AnneeAcademique[] = await apiFetch(`/api/annees?site_id=${siteId}`);
        setAnnees(liste);
        const enCours = liste.find(a => a.etat?.toLowerCase() === 'en cours' || a.etat?.toLowerCase() === 'en cour');
        setAnneeId(enCours ? enCours.id : (liste[0]?.id ?? null));
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return;
      }
    };
    loadAnnees();
  }, []);

  const fetchDossiers = useCallback(async (page = 1, pageSize = 10) => {
    if (!anneeId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        anneeAcademiqueId: String(anneeId),
        page: String(page),
        limit: String(pageSize),
      });
      if (search.trim()) params.set('search', search.trim());
      const data = await apiFetch(`/api/caisse/inscriptions-en-attente?${params.toString()}`);
      setDossiers(data.data || []);
      setPagination({ current: page, pageSize, total: data.pagination?.total || 0 });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return;
      message.error('Erreur lors du chargement des dossiers en attente');
    } finally {
      setLoading(false);
    }
  }, [anneeId, search]);

  useEffect(() => {
    if (anneeId) fetchDossiers(1, pagination.pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anneeId]);

  const ouvrirFiche = (dossier: Dossier) => {
    const token = localStorage.getItem('token') || '';
    const url = dossier.type === 'admission'
      ? `${API_URL}/api/etudiants/${dossier.etudiant_id}/fiche?token=${encodeURIComponent(token)}`
      : `${API_URL}/api/reinscription/fiche/${dossier.dossier_id}?token=${encodeURIComponent(token)}`;
    window.open(url, '_blank');
  };

  return (
    <div style={{ padding: 24 }}>
      <PageHeader />

      <Card title="Inscriptions en attente de paiement" style={{ marginBottom: 24 }}>
        <DataTable<Dossier>
          dataSource={dossiers}
          rowKey={r => `${r.type}-${r.dossier_id}`}
          loading={loading}
          searchValue={search}
          searchPlaceholder="Nom, prénom ou matricule"
          onSearchChange={setSearch}
          filters={
            <Select
              value={anneeId}
              onChange={setAnneeId}
              style={{ width: 180 }}
              options={annees.map(a => ({ value: a.id, label: a.annee }))}
              placeholder="Année académique"
            />
          }
          toolbarExtra={
            <Button type="primary" onClick={() => fetchDossiers(1, pagination.pageSize)}>
              Rechercher
            </Button>
          }
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            onChange: (page, pageSize) => fetchDossiers(page, pageSize),
          }}
          columns={[
            {
              title: 'Étudiant',
              render: (_, r) => (
                <Space>
                  <Avatar src={r.photo_url ? `${API_URL}${r.photo_url}` : undefined}>{r.nom[0]}</Avatar>
                  <span>{r.nom} {r.prenoms}</span>
                </Space>
              ),
            },
            { title: 'Matricule IIPEA', dataIndex: 'matricule_iipea' },
            { title: 'Filière', dataIndex: 'filiere' },
            { title: 'Niveau', dataIndex: 'niveau' },
            {
              title: 'Type',
              dataIndex: 'type',
              render: (t) => <StatusTag tone={t === 'admission' ? 'warning' : 'info'} label={t === 'admission' ? 'Inscription' : 'Réinscription'} />,
            },
            {
              title: 'Code de paiement',
              dataIndex: 'code_paiement',
              render: (c) => c ? <StatusTag tone="info" label={c} /> : <span style={{ color: 'var(--text-soft)' }}>Non généré</span>,
            },
            {
              title: 'Actions',
              render: (_, r) => (
                <Button size="small" icon={<PrinterOutlined />} onClick={() => ouvrirFiche(r)}>Fiche</Button>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
};

export default InscriptionsEnAttente;
