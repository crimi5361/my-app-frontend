import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input, Button, Card, List, Space, Typography, message } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import PageHeader from '../../Components/PageHeader/PageHeader';
import StatusTag from '../../Components/ui/StatusTag';
import { apiFetch, ApiError } from '../../lib/api';

const { Text, Title } = Typography;

interface ResultatEtudiant {
  id: number;
  nom: string;
  prenoms: string;
  matricule_iipea: string;
  standing: string;
  filiere: string;
  niveau: string;
  scolarite_verse: number | null;
  montant_scolarite: number | null;
  scolarite_restante: number | null;
  statut_etudiant: string | null;
  reinscription_code_paiement: string | null;
  reinscription_statut: string | null;
}

const RechercheEtudiantCaisse = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ResultatEtudiant[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (query.trim().length < 2) {
      message.warning('Saisissez au moins 2 caractères');
      return;
    }
    setSearching(true);
    setSearched(true);
    try {
      const data = await apiFetch(`/api/caisse/etudiant/recherche?q=${encodeURIComponent(query.trim())}`);
      setResults(data.data || []);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return;
      message.error('Erreur lors de la recherche');
    } finally {
      setSearching(false);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <PageHeader />

      <Card title="Rechercher un étudiant" style={{ marginBottom: 24 }}>
        <Space.Compact style={{ width: '100%', maxWidth: 500 }}>
          <Input
            placeholder="Nom, prénom ou matricule IIPEA"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onPressEnter={handleSearch}
          />
          <Button type="primary" icon={<SearchOutlined />} loading={searching} onClick={handleSearch}>
            Rechercher
          </Button>
        </Space.Compact>
      </Card>

      {searched && (
        <Card>
          <List
            dataSource={results}
            locale={{ emptyText: 'Aucun étudiant trouvé' }}
            renderItem={item => {
              const codeEnAttente = item.reinscription_statut === 'en_attente_paiement' ? item.reinscription_code_paiement : null;
              return (
                <List.Item
                  actions={codeEnAttente ? [
                    <Button type="primary" key="encaisser" onClick={() => navigate(`/caisse/encaisser?code=${encodeURIComponent(codeEnAttente)}`)}>
                      Encaisser
                    </Button>
                  ] : []}
                >
                  <List.Item.Meta
                    title={`${item.nom} ${item.prenoms} — ${item.matricule_iipea}`}
                    description={`${item.filiere} (${item.niveau})`}
                  />
                  <Space direction="vertical" align="end">
                    <StatusTag tone={item.standing === 'Inscrit' ? 'success' : 'warning'} label={item.standing} />
                    {item.montant_scolarite !== null && (
                      <Text type="secondary">
                        Reste à payer : {Number(item.scolarite_restante ?? item.montant_scolarite).toLocaleString('fr-FR')} FCFA
                      </Text>
                    )}
                    {codeEnAttente && <StatusTag tone="info" label={`Réinscription en attente — ${codeEnAttente}`} />}
                  </Space>
                </List.Item>
              );
            }}
          />
        </Card>
      )}

      {!searched && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-soft)' }}>
          <Title level={5} type="secondary">Recherchez un étudiant pour consulter sa situation</Title>
          <Text type="secondary">Par nom, prénom ou matricule IIPEA</Text>
        </div>
      )}
    </div>
  );
};

export default RechercheEtudiantCaisse;
