import { useContext, useState } from 'react';
import { Card, Input, Button, Table, Modal, Typography, message } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import PageHeader from '../../Components/PageHeader/PageHeader';
import StatusTag, { StatusTone } from '../../Components/ui/StatusTag';
import KitTraitement from '../../Components/KitTraitement/KitTraitement';
import { apiFetch, ApiError } from '../../lib/api';
import { UserContext } from '../../context/UserContext';

const { Text, Title } = Typography;

interface ResultatEtudiantKit {
  id: number;
  nom: string;
  prenoms: string;
  matricule_iipea: string;
  ecole: string | null;
  filiere: string;
  niveau: string;
  annee_academique: string;
  suspendu: boolean;
  statut: 'NON_TRAITE' | 'KIT_APPORTE' | 'KIT_PAYE' | null;
}

// Chantier Kit étudiant — Phase 2 (2026-08-21) : régularisation du Kit pour les étudiants déjà
// inscrits (typiquement 2026-2027 avant la réactivation du module). Ne réimplémente RIEN de la
// Phase 1 : la recherche est un nouvel endpoint dédié (GET /api/kit/rechercher), mais le
// traitement réutilise tel quel le composant KitTraitement (donc POST /api/kit/traiter, la même
// éligibilité, la même contrainte d'unicité, le même paiement Caisse) — un seul point d'entrée de
// traitement dans toute l'application, que l'étudiant vienne d'être inscrit ou soit déjà là depuis
// longtemps.
const GestionKits = () => {
  const { user } = useContext(UserContext);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ResultatEtudiantKit[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selected, setSelected] = useState<ResultatEtudiantKit | null>(null);

  // scolarite : lecture seule (cf. permissions Caisse déjà établies en Phase 1) — le backend
  // bloque de toute façon POST /api/kit/traiter à ce rôle, ce masquage n'est qu'une amélioration
  // UX pour éviter un bouton qui mènerait systématiquement à un 403.
  const peutTraiter = user?.role === 'admin' || user?.role === 'comptabilite' || user?.role === 'caissier';

  const handleSearch = async () => {
    if (query.trim().length < 2) {
      message.warning('Saisissez au moins 2 caractères');
      return;
    }
    setSearching(true);
    setSearched(true);
    try {
      const data = await apiFetch<{ data: ResultatEtudiantKit[] }>(`/api/kit/rechercher?q=${encodeURIComponent(query.trim())}`);
      setResults(data.data || []);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return;
      message.error(e instanceof ApiError ? e.message : 'Erreur lors de la recherche');
    } finally {
      setSearching(false);
    }
  };

  const statutAffichage = (row: ResultatEtudiantKit): { label: string; tone: StatusTone } => {
    if (row.suspendu) return { label: 'Module suspendu', tone: 'warning' };
    if (row.statut === 'KIT_PAYE') return { label: 'Payé', tone: 'success' };
    if (row.statut === 'KIT_APPORTE') return { label: 'Apporté', tone: 'info' };
    return { label: 'Non traité', tone: 'danger' };
  };

  return (
    <div style={{ padding: 24 }}>
      <PageHeader />

      <Card title="Rechercher un étudiant déjà inscrit" style={{ marginBottom: 24 }}>
        <Input.Search
          placeholder="Nom, prénom ou matricule IIPEA"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onSearch={handleSearch}
          enterButton={<Button type="primary" icon={<SearchOutlined />} loading={searching}>Rechercher</Button>}
          style={{ maxWidth: 500 }}
        />
      </Card>

      {searched && (
        <Card>
          <Table<ResultatEtudiantKit>
            rowKey="id"
            loading={searching}
            dataSource={results}
            locale={{ emptyText: 'Aucun étudiant trouvé' }}
            pagination={false}
            columns={[
              {
                title: 'Étudiant',
                key: 'etudiant',
                render: (_, row) => (
                  <div>
                    <Text strong>{row.nom} {row.prenoms}</Text>
                    <br />
                    <Text type="secondary">{row.matricule_iipea}</Text>
                  </div>
                ),
              },
              { title: 'École', dataIndex: 'ecole', key: 'ecole', render: (v) => v || '—' },
              { title: 'Filière', dataIndex: 'filiere', key: 'filiere' },
              { title: 'Niveau', dataIndex: 'niveau', key: 'niveau' },
              { title: 'Année académique', dataIndex: 'annee_academique', key: 'annee_academique' },
              {
                title: 'Statut Kit',
                key: 'statut',
                render: (_, row) => {
                  const { label, tone } = statutAffichage(row);
                  return <StatusTag tone={tone} label={label} />;
                },
              },
              {
                title: 'Action',
                key: 'action',
                render: (_, row) => {
                  const traitable = !row.suspendu && row.statut === 'NON_TRAITE';
                  if (!peutTraiter) return null;
                  return (
                    <Button
                      type="primary"
                      size="small"
                      disabled={!traitable}
                      onClick={() => setSelected(row)}
                    >
                      Régulariser
                    </Button>
                  );
                },
              },
            ]}
          />
        </Card>
      )}

      {!searched && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-soft)' }}>
          <Title level={5} type="secondary">Recherchez un étudiant pour régulariser son Kit</Title>
          <Text type="secondary">Par nom, prénom ou matricule IIPEA — année académique courante</Text>
        </div>
      )}

      <Modal
        open={!!selected}
        onCancel={() => { setSelected(null); handleSearch(); }}
        footer={null}
        title={selected ? `Kit — ${selected.nom} ${selected.prenoms}` : ''}
        destroyOnClose
      >
        {selected && (
          <KitTraitement
            etudiantId={selected.id}
            onTraite={() => { setSelected(null); handleSearch(); }}
          />
        )}
      </Modal>
    </div>
  );
};

export default GestionKits;
