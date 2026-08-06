import { useEffect, useState } from 'react';
import {
  Input, Button, Card, List, Space, Typography, message,
  Descriptions, Form, Select, InputNumber, Alert, Avatar, Result
} from 'antd';
import { SearchOutlined, PrinterOutlined, CheckCircleOutlined } from '@ant-design/icons';
import PageHeader from '../../Components/PageHeader/PageHeader';
import DataTable from '../../Components/ui/DataTable';
import StatusTag from '../../Components/ui/StatusTag';
import { apiFetch, ApiError } from '../../lib/api';

const { Text, Title } = Typography;
const { Option } = Select;

const API_URL = import.meta.env.VITE_API_URL_SERVER || '';
const METHODES_PAIEMENT = ['Espèces', 'Mobile Money', 'Orange Money', 'Wave'];

interface ResultatEtudiant {
  id: number;
  nom: string;
  prenoms: string;
  matricule_iipea: string;
  standing: string;
  filiere: string;
  niveau: string;
}

interface EtudiantSelectionne {
  id: number;
  nom: string;
  prenoms: string;
  matricule_iipea: string;
  photo_url: string | null;
  standing: string;
}

interface AnneeEtudiant {
  annee_academique_id: number;
  annee: string;
  niveau: string | null;
  filiere: string | null;
  montant_scolarite: number | null;
  scolarite_verse: number | null;
  scolarite_restante: number | null;
  statut_paiement: string | null;
  is_current: boolean;
}

interface PaiementAnnee {
  id: number;
  montant: number;
  date_paiement: string;
  methode: string;
  numero_recu: string | null;
  caissier_nom: string | null;
}

const SituationEtudiant = () => {
  // Session (garde souple : ne bloque pas la page, seulement le formulaire de paiement)
  const [sessionOuverte, setSessionOuverte] = useState<boolean | null>(null);

  // Recherche
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ResultatEtudiant[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  // Étudiant sélectionné + années
  const [etudiant, setEtudiant] = useState<EtudiantSelectionne | null>(null);
  const [annees, setAnnees] = useState<AnneeEtudiant[]>([]);
  const [loadingAnnees, setLoadingAnnees] = useState(false);

  // Année sélectionnée + détail
  const [selectedAnnee, setSelectedAnnee] = useState<AnneeEtudiant | null>(null);
  const [paiements, setPaiements] = useState<PaiementAnnee[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [form] = Form.useForm();
  const [validating, setValidating] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const data = await apiFetch('/api/caisse/session/active');
        setSessionOuverte(!!data.data);
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return;
        setSessionOuverte(false);
      }
    };
    checkSession();
  }, []);

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

  const chargerAnnees = async (etudiantId: number) => {
    setLoadingAnnees(true);
    try {
      const data = await apiFetch(`/api/caisse/etudiant/${etudiantId}/annees`);
      setEtudiant(data.data.etudiant);
      setAnnees(data.data.annees || []);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return;
      message.error(e instanceof ApiError ? e.message : 'Erreur lors du chargement des années');
    } finally {
      setLoadingAnnees(false);
    }
  };

  const selectionnerEtudiant = (item: ResultatEtudiant) => {
    setSelectedAnnee(null);
    setPaiements([]);
    chargerAnnees(item.id);
  };

  const chargerDetailAnnee = async (annee: AnneeEtudiant) => {
    if (!etudiant) return;
    setSelectedAnnee(annee);
    setLoadingDetail(true);
    try {
      const data = await apiFetch(`/api/caisse/etudiant/${etudiant.id}/annees/${annee.annee_academique_id}/paiements`);
      setSelectedAnnee(data.data.annee);
      setPaiements(data.data.paiements || []);
      form.resetFields();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return;
      message.error(e instanceof ApiError ? e.message : "Erreur lors du chargement du détail de l'année");
    } finally {
      setLoadingDetail(false);
    }
  };

  const nouvelleRecherche = () => {
    setQuery('');
    setResults([]);
    setSearched(false);
    setEtudiant(null);
    setAnnees([]);
    setSelectedAnnee(null);
    setPaiements([]);
  };

  const handlePaiement = async (values: { montant: number; methode: string }) => {
    if (!etudiant || !selectedAnnee) return;
    setValidating(true);
    try {
      const result = await apiFetch(
        `/api/caisse/etudiant/${etudiant.id}/annees/${selectedAnnee.annee_academique_id}/paiements`,
        { method: 'POST', body: JSON.stringify(values) }
      );
      message.success(result.message || 'Paiement enregistré');

      const win = window.open(
        `/Etudiant/Recu_Payement/${etudiant.id}?anneeAcademiqueId=${selectedAnnee.annee_academique_id}`,
        '_blank'
      );
      if (!win) {
        message.warning("Le navigateur a bloqué l'ouverture automatique du reçu. Autorisez les popups pour ce site.");
      }

      await chargerAnnees(etudiant.id);
      await chargerDetailAnnee(selectedAnnee);
    } catch (e) {
      if (e instanceof ApiError) {
        message.error(e.message);
        return;
      }
      message.error('Erreur lors de l\'enregistrement du paiement');
    } finally {
      setValidating(false);
    }
  };

  const anneesColumns = [
    { title: 'Année', dataIndex: 'annee', key: 'annee' },
    {
      title: 'Statut', key: 'is_current', render: (_: unknown, r: AnneeEtudiant) => (
        <StatusTag tone={r.is_current ? 'info' : 'neutral'} label={r.is_current ? 'Année en cours' : 'Année antérieure'} />
      )
    },
    { title: 'Niveau', dataIndex: 'niveau', key: 'niveau', render: (v: string | null) => v || '—' },
    { title: 'Filière', dataIndex: 'filiere', key: 'filiere', render: (v: string | null) => v || '—' },
    {
      title: 'Montant', dataIndex: 'montant_scolarite', key: 'montant_scolarite',
      render: (v: number | null) => v !== null ? `${Number(v).toLocaleString('fr-FR')} FCFA` : '—'
    },
    {
      title: 'Versé', dataIndex: 'scolarite_verse', key: 'scolarite_verse',
      render: (v: number | null) => v !== null ? `${Number(v).toLocaleString('fr-FR')} FCFA` : '—'
    },
    {
      title: 'Restant', dataIndex: 'scolarite_restante', key: 'scolarite_restante',
      render: (v: number | null) => v !== null ? `${Number(v).toLocaleString('fr-FR')} FCFA` : '—'
    },
    {
      title: 'Statut paiement', dataIndex: 'statut_paiement', key: 'statut_paiement',
      render: (v: string | null) => <StatusTag tone={v === 'SOLDE' ? 'success' : 'warning'} label={v || 'NON_SOLDE'} />
    },
    {
      title: 'Action', key: 'action', render: (_: unknown, r: AnneeEtudiant) => (
        <Button size="small" onClick={() => chargerDetailAnnee(r)}>Voir / Encaisser</Button>
      )
    },
  ];

  const paiementsColumns = [
    { title: 'Date', dataIndex: 'date_paiement', key: 'date_paiement' },
    { title: 'Montant', dataIndex: 'montant', key: 'montant', render: (v: number) => `${Number(v).toLocaleString('fr-FR')} FCFA` },
    { title: 'Méthode', dataIndex: 'methode', key: 'methode' },
    { title: 'N° Reçu', dataIndex: 'numero_recu', key: 'numero_recu', render: (v: string | null) => v || '—' },
    { title: 'Caissier', dataIndex: 'caissier_nom', key: 'caissier_nom', render: (v: string | null) => v || '—' },
    {
      title: 'Action', key: 'action', render: (_: unknown, _r: PaiementAnnee) => (
        <Button
          size="small"
          icon={<PrinterOutlined />}
          onClick={() => window.open(`/Etudiant/Recu_Payement/${etudiant?.id}?anneeAcademiqueId=${selectedAnnee?.annee_academique_id}`, '_blank')}
        >
          Réimprimer
        </Button>
      )
    },
  ];

  const soldeRestant = selectedAnnee ? Number(selectedAnnee.scolarite_restante ?? 0) : 0;

  return (
    <div style={{ padding: 24 }}>
      <PageHeader />

      {!etudiant && (
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
      )}

      {!etudiant && searched && (
        <Card>
          <List
            dataSource={results}
            locale={{ emptyText: 'Aucun étudiant trouvé' }}
            renderItem={item => (
              <List.Item actions={[<Button key="choisir" type="primary" onClick={() => selectionnerEtudiant(item)}>Sélectionner</Button>]}>
                <List.Item.Meta
                  title={`${item.nom} ${item.prenoms} — ${item.matricule_iipea}`}
                  description={`${item.filiere} (${item.niveau})`}
                />
                <StatusTag tone={item.standing === 'Inscrit' ? 'success' : 'warning'} label={item.standing} />
              </List.Item>
            )}
          />
        </Card>
      )}

      {!etudiant && !searched && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-soft)' }}>
          <Title level={5} type="secondary">Recherchez un étudiant pour consulter sa situation</Title>
          <Text type="secondary">Par nom, prénom ou matricule IIPEA — toutes ses années académiques, en cours ou antérieures</Text>
        </div>
      )}

      {etudiant && (
        <>
          <Card style={{ marginBottom: 24 }}>
            <Space align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
              <Space>
                <Avatar size={56} src={etudiant.photo_url ? `${API_URL}${etudiant.photo_url}` : undefined}>
                  {etudiant.nom[0]}
                </Avatar>
                <div>
                  <Title level={5} style={{ margin: 0 }}>{etudiant.nom} {etudiant.prenoms}</Title>
                  <Text type="secondary">{etudiant.matricule_iipea} — {etudiant.standing}</Text>
                </div>
              </Space>
              <Button onClick={nouvelleRecherche}>Nouvelle recherche</Button>
            </Space>
          </Card>

          <Card title="Années académiques" loading={loadingAnnees} style={{ marginBottom: 24 }}>
            <DataTable
              rowKey="annee_academique_id"
              dataSource={annees}
              columns={anneesColumns}
              pagination={false}
            />
          </Card>

          {selectedAnnee && (
            <Card title={`Détail — ${selectedAnnee.annee}`} loading={loadingDetail}>
              <Descriptions column={3} bordered size="small" style={{ marginBottom: 24 }}>
                <Descriptions.Item label="Niveau">{selectedAnnee.niveau || '—'}</Descriptions.Item>
                <Descriptions.Item label="Filière">{selectedAnnee.filiere || '—'}</Descriptions.Item>
                <Descriptions.Item label="Statut">
                  <StatusTag tone={selectedAnnee.statut_paiement === 'SOLDE' ? 'success' : 'warning'} label={selectedAnnee.statut_paiement || 'NON_SOLDE'} />
                </Descriptions.Item>
                <Descriptions.Item label="Montant scolarité">
                  {Number(selectedAnnee.montant_scolarite ?? 0).toLocaleString('fr-FR')} FCFA
                </Descriptions.Item>
                <Descriptions.Item label="Versé">
                  {Number(selectedAnnee.scolarite_verse ?? 0).toLocaleString('fr-FR')} FCFA
                </Descriptions.Item>
                <Descriptions.Item label="Restant">
                  <Text strong>{soldeRestant.toLocaleString('fr-FR')} FCFA</Text>
                </Descriptions.Item>
              </Descriptions>

              <Title level={5}>Historique des versements</Title>
              <DataTable
                rowKey="id"
                dataSource={paiements}
                columns={paiementsColumns}
                pagination={false}
                style={{ marginBottom: 24 }}
                emptyTitle="Aucun paiement enregistré pour cette année"
              />

              {soldeRestant <= 0 ? (
                <Result
                  status="success"
                  icon={<CheckCircleOutlined />}
                  title="Année soldée"
                  subTitle="Aucun solde restant pour cette année académique."
                />
              ) : sessionOuverte === false ? (
                <Alert
                  type="warning"
                  showIcon
                  message="Votre caisse n'est pas ouverte"
                  description="Ouvrez votre caisse (Tableau de bord) avant d'enregistrer un nouveau paiement."
                />
              ) : (
                <>
                  <Title level={5}>Nouveau paiement</Title>
                  <Form form={form} layout="inline" onFinish={handlePaiement}>
                    <Form.Item name="montant" label="Montant (FCFA)" rules={[{ required: true, message: 'Montant requis' }]}>
                      <InputNumber min={1} max={soldeRestant} style={{ width: 180 }} />
                    </Form.Item>
                    <Form.Item name="methode" label="Méthode" rules={[{ required: true, message: 'Méthode requise' }]}>
                      <Select placeholder="Sélectionnez" style={{ width: 180 }}>
                        {METHODES_PAIEMENT.map(m => <Option key={m} value={m}>{m}</Option>)}
                      </Select>
                    </Form.Item>
                    <Form.Item>
                      <Button type="primary" htmlType="submit" loading={validating}>
                        Encaisser
                      </Button>
                    </Form.Item>
                  </Form>
                </>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
};

export default SituationEtudiant;
