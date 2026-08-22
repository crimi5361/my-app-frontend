/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from 'react';
import { Card, Button, Table, Select, Modal, Descriptions, message, Alert, Result, Spin, Typography, Input } from 'antd';
import { CheckCircleOutlined, LockOutlined, DollarCircleOutlined, SearchOutlined } from '@ant-design/icons';
import PageHeader from '../../Components/PageHeader/PageHeader';
import { apiFetch, ApiError } from '../../lib/api';
import { METHODES_PAIEMENT } from '../../lib/methodesPaiement';

const { Title, Text } = Typography;
const { Option } = Select;

interface DemandeSurplus {
  id: number;
  reference: string;
  quantite: number;
  prix_unitaire_vente: string;
  montant_total: string;
  date_demande: string;
  accessoire_nom: string;
  etudiant_id: number;
  etudiant_nom: string;
  etudiant_prenoms: string;
  matricule_iipea: string;
  annee_academique: string;
  demande_par_nom: string;
}

const formatFcfa = (v: number | string) => `${Number(v).toLocaleString('fr-FR')} FCFA`;

// Chantier Moyens Généraux, Phase 2D (2026-08-19) — écran dédié à l'encaissement des demandes de
// surplus d'accessoires (Moyens Généraux). Réutilise entièrement l'infrastructure Caisse existante
// (session_caisse ouverte requise, même liste de moyens de paiement, même mécanisme recu+paiement
// que le reste du module) — ce n'est PAS un second système de caisse, seulement un point d'entrée
// dédié car aucun écran existant (Encaisser.tsx, SituationEtudiant.tsx) n'est structuré pour un
// encaissement hors code_paiement/scolarité.
const SurplusEncaissement = () => {
  const [checkingSession, setCheckingSession] = useState(true);
  const [sessionOuverte, setSessionOuverte] = useState(false);
  const [demandes, setDemandes] = useState<DemandeSurplus[]>([]);
  const [loading, setLoading] = useState(false);
  const [recherche, setRecherche] = useState('');

  const [selection, setSelection] = useState<DemandeSurplus | null>(null);
  const [methode, setMethode] = useState<string | undefined>(undefined);
  const [encaissement, setEncaissement] = useState(false);
  const [resultat, setResultat] = useState<{ reference: string; numero_recu: string } | null>(null);

  useEffect(() => {
    apiFetch('/api/caisse/session/active')
      .then((data: any) => setSessionOuverte(!!data.data))
      .catch((e) => { if (e instanceof ApiError && e.status === 401) return; })
      .finally(() => setCheckingSession(false));
  }, []);

  const fetchDemandes = () => {
    setLoading(true);
    apiFetch<{ data: DemandeSurplus[] }>('/api/caisse/surplus/en-attente')
      .then((res) => setDemandes(res.data))
      .catch((e) => { if (e instanceof ApiError && e.status === 401) return; message.error('Erreur lors du chargement des demandes en attente'); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { if (sessionOuverte) fetchDemandes(); }, [sessionOuverte]);

  // Recherche instantanée côté interface (ajustement UI, 2026-08-20) — filtre les demandes déjà
  // chargées, jamais un nouvel appel réseau. Insensible à la casse, partielle, sur nom/prénoms/
  // matricule/référence/accessoire.
  const demandesFiltrees = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    if (!q) return demandes;
    return demandes.filter((d) =>
      d.etudiant_nom.toLowerCase().includes(q)
      || d.etudiant_prenoms.toLowerCase().includes(q)
      || d.matricule_iipea.toLowerCase().includes(q)
      || d.reference.toLowerCase().includes(q)
      || d.accessoire_nom.toLowerCase().includes(q)
    );
  }, [demandes, recherche]);

  const ouvrirEncaissement = (demande: DemandeSurplus) => {
    setSelection(demande);
    setMethode(undefined);
    setResultat(null);
  };

  const confirmerEncaissement = async () => {
    if (!selection || !methode) {
      message.warning('Sélectionnez une méthode de paiement.');
      return;
    }
    setEncaissement(true);
    try {
      const res = await apiFetch<{ data: { numero_recu: string } }>(`/api/caisse/surplus/${selection.id}/encaisser`, {
        method: 'POST',
        body: JSON.stringify({ methode }),
      });
      message.success('Paiement encaissé');
      setResultat({ reference: selection.reference, numero_recu: res.data.numero_recu });
      fetchDemandes();
    } catch (e) {
      if (e instanceof ApiError) { message.error(e.message); return; }
      message.error("Erreur lors de l'encaissement");
    } finally {
      setEncaissement(false);
    }
  };

  const fermerModal = () => {
    setSelection(null);
    setResultat(null);
    setMethode(undefined);
  };

  const columns = [
    { title: 'Référence', dataIndex: 'reference', key: 'reference' },
    {
      title: 'Étudiant', key: 'etudiant',
      render: (_: any, r: DemandeSurplus) => `${r.etudiant_nom} ${r.etudiant_prenoms} (${r.matricule_iipea})`,
    },
    { title: 'Accessoire', dataIndex: 'accessoire_nom', key: 'accessoire_nom' },
    { title: 'Quantité', dataIndex: 'quantite', key: 'quantite', align: 'right' as const },
    {
      title: 'Montant', dataIndex: 'montant_total', key: 'montant_total', align: 'right' as const,
      render: (v: string) => <Text strong>{formatFcfa(v)}</Text>,
    },
    { title: 'Année', dataIndex: 'annee_academique', key: 'annee_academique' },
    { title: 'Demandée par', dataIndex: 'demande_par_nom', key: 'demande_par_nom' },
    {
      title: 'Créée le', dataIndex: 'date_demande', key: 'date_demande',
      render: (v: string) => new Date(v).toLocaleDateString('fr-FR'),
    },
    {
      title: 'Action', key: 'action',
      render: (_: any, r: DemandeSurplus) => (
        <Button type="primary" icon={<DollarCircleOutlined />} onClick={() => ouvrirEncaissement(r)}>
          Encaisser
        </Button>
      ),
    },
  ];

  if (checkingSession) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!sessionOuverte) {
    return (
      <div style={{ padding: 24 }}>
        <PageHeader />
        <Card style={{ marginTop: 24 }}>
          <Result
            icon={<LockOutlined />}
            title="Votre caisse n'est pas ouverte"
            subTitle="Vous devez ouvrir votre caisse avant de pouvoir encaisser un surplus d'accessoire."
          />
        </Card>
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <PageHeader />
      <Card title="Demandes de surplus en attente de paiement">
        <Input
          allowClear
          size="large"
          prefix={<SearchOutlined style={{ color: 'var(--text-soft, #8c8c8c)' }} />}
          placeholder="Rechercher par nom, prénoms, matricule, référence (SURPLUS-...) ou accessoire"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          style={{ marginBottom: 16, maxWidth: 480 }}
        />
        <Table
          rowKey="id"
          columns={columns}
          dataSource={demandesFiltrees}
          loading={loading}
          pagination={false}
          locale={{ emptyText: recherche.trim() ? 'Aucune demande trouvée' : 'Aucune demande en attente de paiement' }}
        />
      </Card>

      <Modal
        title={resultat ? 'Paiement confirmé' : `Encaisser ${selection?.reference ?? ''}`}
        open={selection !== null}
        onCancel={fermerModal}
        footer={resultat ? [<Button key="fermer" type="primary" onClick={fermerModal}>Fermer</Button>] : undefined}
        onOk={confirmerEncaissement}
        okText="Confirmer l'encaissement"
        cancelText="Annuler"
        confirmLoading={encaissement}
      >
        {resultat ? (
          <Result
            status="success"
            icon={<CheckCircleOutlined />}
            title="Paiement encaissé"
            subTitle={`Reçu N° ${resultat.numero_recu} — la distribution est désormais autorisée côté Moyens Généraux.`}
          />
        ) : selection && (
          <>
            <Descriptions column={1} size="small" bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Étudiant">{selection.etudiant_nom} {selection.etudiant_prenoms}</Descriptions.Item>
              <Descriptions.Item label="Matricule IIPEA">{selection.matricule_iipea}</Descriptions.Item>
              <Descriptions.Item label="Accessoire">{selection.accessoire_nom}</Descriptions.Item>
              <Descriptions.Item label="Quantité">{selection.quantite}</Descriptions.Item>
              <Descriptions.Item label="Montant à encaisser"><Title level={5} style={{ margin: 0 }}>{formatFcfa(selection.montant_total)}</Title></Descriptions.Item>
            </Descriptions>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>Méthode de paiement</Text>
            <Select placeholder="Sélectionnez la méthode" value={methode} onChange={setMethode} style={{ width: '100%', marginBottom: 16 }}>
              {METHODES_PAIEMENT.map((m) => <Option key={m.value} value={m.value}>{m.label}</Option>)}
            </Select>
            <Alert type="info" showIcon message="Le montant encaissé correspond exactement au montant figé à la création de la demande — il ne peut pas être modifié ici." />
          </>
        )}
      </Modal>
    </div>
  );
};

export default SurplusEncaissement;
