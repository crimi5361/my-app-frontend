/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react';
import {
  Input, Button, List, Avatar, Card, Descriptions, Space, Spin, Typography, Table, Tag,
} from 'antd';
import { SearchOutlined, SwapOutlined, ScheduleOutlined, RiseOutlined } from '@ant-design/icons';
import PageHeader from '../../Components/PageHeader/PageHeader';
import StatusTag from '../../Components/ui/StatusTag';
import { apiFetch } from '../../lib/api';
import ChangementPositionDrawer from '../../Components/ChangementPositionDrawer/ChangementPositionDrawer';
import ChangementParcoursDrawer from '../../Components/ChangementParcoursDrawer/ChangementParcoursDrawer';

const { Text } = Typography;
const API_URL = import.meta.env.VITE_API_URL_SERVER || '';

interface EtudiantResultat {
  id: number;
  nom: string;
  prenoms: string;
  matricule_iipea: string;
  photo_url: string | null;
  filiere: string;
  niveau: string;
}

interface Situation {
  id: number;
  nom: string;
  prenoms: string;
  matricule_iipea: string;
  standing: string;
  statut_scolaire: string;
  niveau_id: number;
  niveau_libelle: string;
  id_filiere: number;
  filiere_nom: string;
  filiere_sigle: string;
  type_filiere_libelle: string | null;
  curcus_id: number | null;
  type_parcours: string | null;
  groupe_nom: string | null;
  classe_nom: string | null;
  montant_scolarite: string | null;
  scolarite_verse: string | null;
  scolarite_restante: string | null;
  statut_paiement: string | null;
  annee_academique_id: number;
  annee: string;
}

interface OperationHistorique {
  id: number;
  type_operation: string;
  anciennes_valeurs: Record<string, any>;
  nouvelles_valeurs: Record<string, any>;
  motif: string;
  created_at: string;
  utilisateur_nom: string | null;
}

const LIBELLE_OPERATION: Record<string, string> = {
  changement_filiere: 'Changement de filière',
  changement_parcours: 'Changement de parcours',
  changement_cycle: 'Changement de cycle',
};

const Dossiers = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<EtudiantResultat[]>([]);
  const [searching, setSearching] = useState(false);
  const [loadingSituation, setLoadingSituation] = useState(false);
  const [situation, setSituation] = useState<Situation | null>(null);
  const [historique, setHistorique] = useState<OperationHistorique[]>([]);

  const [drawerFiliere, setDrawerFiliere] = useState(false);
  const [drawerCycle, setDrawerCycle] = useState(false);
  const [drawerParcours, setDrawerParcours] = useState(false);

  const handleSearch = async () => {
    if (!query.trim() || query.trim().length < 2) return;
    setSearching(true);
    try {
      const data = await apiFetch(`/api/reinscription/recherche?q=${encodeURIComponent(query.trim())}`);
      setResults(data.data || data);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const chargerEtudiant = async (id: number) => {
    setLoadingSituation(true);
    setResults([]);
    try {
      const [sitRes, histRes] = await Promise.all([
        apiFetch(`/api/operations-admin/etudiant/${id}`),
        apiFetch(`/api/operations-admin/etudiant/${id}/historique`),
      ]);
      setSituation(sitRes.data);
      setHistorique(histRes.data);
    } finally {
      setLoadingSituation(false);
    }
  };

  const rafraichir = () => {
    if (situation) chargerEtudiant(situation.id);
  };

  const columnsHistorique = [
    {
      title: 'Date',
      dataIndex: 'created_at',
      render: (v: string) => new Date(v).toLocaleString('fr-FR'),
      width: 160,
    },
    {
      title: 'Type',
      dataIndex: 'type_operation',
      render: (v: string) => <StatusTag tone="info" label={LIBELLE_OPERATION[v] || v} />,
      width: 180,
    },
    { title: 'Utilisateur', dataIndex: 'utilisateur_nom', width: 160 },
    {
      title: 'Avant',
      dataIndex: 'anciennes_valeurs',
      render: (v: OperationHistorique['anciennes_valeurs']) => (
        <Text style={{ fontSize: 12 }}>{v.filiere_nom} — {v.niveau_libelle}{v.type_parcours ? ` (${v.type_parcours})` : ''} — {v.statut_scolaire}</Text>
      ),
    },
    {
      title: 'Après',
      dataIndex: 'nouvelles_valeurs',
      render: (v: OperationHistorique['nouvelles_valeurs']) => (
        <Text style={{ fontSize: 12 }}>{v.filiere_nom} — {v.niveau_libelle}{v.type_parcours ? ` (${v.type_parcours})` : ''} — {v.statut_scolaire}</Text>
      ),
    },
    { title: 'Motif', dataIndex: 'motif' },
  ];

  return (
    <div style={{ padding: 24 }}>
      <PageHeader />

      <Card title="Dossier étudiant — Opérations exceptionnelles" style={{ marginBottom: 24 }}>
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

        {results.length > 0 && (
          <List
            style={{ marginTop: 16 }}
            bordered
            dataSource={results}
            renderItem={item => (
              <List.Item
                style={{ cursor: 'pointer' }}
                onClick={() => chargerEtudiant(item.id)}
                actions={[<Button size="small" type="link">Sélectionner</Button>]}
              >
                <List.Item.Meta
                  avatar={<Avatar src={item.photo_url ? `${API_URL}${item.photo_url}` : undefined}>{item.nom[0]}</Avatar>}
                  title={`${item.nom} ${item.prenoms}`}
                  description={`${item.matricule_iipea} — ${item.filiere} (${item.niveau})`}
                />
              </List.Item>
            )}
          />
        )}
      </Card>

      {loadingSituation && (
        <div style={{ textAlign: 'center', padding: 40 }}><Spin size="large" tip="Chargement..." /></div>
      )}

      {situation && !loadingSituation && (
        <>
          <Card
            title={`${situation.nom} ${situation.prenoms} — ${situation.matricule_iipea}`}
            style={{ marginBottom: 24 }}
            extra={
              <Space>
                <Button icon={<SwapOutlined />} onClick={() => setDrawerFiliere(true)}>Changer de filière</Button>
                <Button icon={<ScheduleOutlined />} onClick={() => setDrawerParcours(true)}>Changer de parcours</Button>
                <Button icon={<RiseOutlined />} danger onClick={() => setDrawerCycle(true)}>Changer de cycle</Button>
              </Space>
            }
          >
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="Année académique">{situation.annee}</Descriptions.Item>
              <Descriptions.Item label="Statut"><StatusTag tone={situation.standing === 'Inscrit' ? 'success' : 'warning'} label={situation.standing} /></Descriptions.Item>
              <Descriptions.Item label="Filière">{situation.filiere_nom} ({situation.filiere_sigle})</Descriptions.Item>
              <Descriptions.Item label="Type">{situation.type_filiere_libelle || '—'}</Descriptions.Item>
              <Descriptions.Item label="Niveau">{situation.niveau_libelle}</Descriptions.Item>
              <Descriptions.Item label="Parcours">{situation.type_parcours || '—'}</Descriptions.Item>
              <Descriptions.Item label="Classe">{situation.classe_nom || '—'}</Descriptions.Item>
              <Descriptions.Item label="Groupe">{situation.groupe_nom || '—'}</Descriptions.Item>
              <Descriptions.Item label="Statut scolaire">
                {situation.statut_scolaire === 'Affecté' ? <Tag color="gold">Affecté</Tag> : <Tag color="blue">Non affecté</Tag>}
              </Descriptions.Item>
              <Descriptions.Item label="Statut paiement">
                <StatusTag tone={situation.statut_paiement === 'SOLDE' ? 'success' : 'warning'} label={situation.statut_paiement || '—'} />
              </Descriptions.Item>
              <Descriptions.Item label="Scolarité">
                {situation.montant_scolarite ? `${Number(situation.montant_scolarite).toLocaleString('fr-FR')} FCFA` : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Restant à payer">
                {situation.scolarite_restante ? `${Number(situation.scolarite_restante).toLocaleString('fr-FR')} FCFA` : '0 FCFA'}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <Card title="Historique des opérations exceptionnelles">
            <Table
              rowKey="id"
              columns={columnsHistorique}
              dataSource={historique}
              pagination={false}
              size="small"
              locale={{ emptyText: 'Aucune opération exceptionnelle enregistrée pour cet étudiant.' }}
            />
          </Card>
        </>
      )}

      <ChangementPositionDrawer open={drawerFiliere} onClose={() => setDrawerFiliere(false)} mode="filiere" situation={situation} onChanged={rafraichir} />
      <ChangementPositionDrawer open={drawerCycle} onClose={() => setDrawerCycle(false)} mode="cycle" situation={situation} onChanged={rafraichir} />
      <ChangementParcoursDrawer open={drawerParcours} onClose={() => setDrawerParcours(false)} situation={situation} onChanged={rafraichir} />
    </div>
  );
};

export default Dossiers;
