/* eslint-disable @typescript-eslint/no-explicit-any */
// Espace Chargé Pédagogique — « Possède un catalogue de besoins en enseignants pour les
// modules de ses filières » (§3.1, Recrutement phase 1).
//
// Ce catalogue est le point de départ du recrutement : les RH s'appuient dessus pour
// publier des offres (une offre peut référencer un besoin).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Modal, Form, Input, Select, InputNumber, message, Popconfirm, Tag } from 'antd';
import { PlusOutlined, EditOutlined, CheckCircleOutlined, StopOutlined } from '@ant-design/icons';
import PageHeader from '../../Components/PageHeader/PageHeader';
import PageContainer from '../../Components/ui/PageContainer';
import DataTable from '../../Components/ui/DataTable';
import StatusTag from '../../Components/ui/StatusTag';
import { apiFetch, ApiError } from '../../lib/api';
import { Besoin, useAnneesAcademiques, formatDate } from '../../lib/enseignants';

interface Niveau {
  id: number;
  libelle: string;
}

interface LignePerimetre {
  filiere_id: number;
  filiere: string;
  sigle: string | null;
  niveau_id: number | null;
  niveau: string | null;
}

const PRIORITES = [
  { value: 'haute', label: 'Haute' },
  { value: 'normale', label: 'Normale' },
  { value: 'basse', label: 'Basse' },
];

const TON_PRIORITE: Record<string, string> = { haute: 'red', normale: 'blue', basse: 'default' };

const STATUTS: Record<string, { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' }> = {
  ouvert: { label: 'Ouvert', tone: 'warning' },
  pourvu: { label: 'Pourvu', tone: 'success' },
  annule: { label: 'Annulé', tone: 'neutral' },
};

const BesoinsEnseignants = () => {
  const { annees, anneeId, setAnneeId } = useAnneesAcademiques();

  const [besoins, setBesoins] = useState<Besoin[]>([]);
  const [perimetre, setPerimetre] = useState<LignePerimetre[]>([]);
  const [niveaux, setNiveaux] = useState<Niveau[]>([]);
  const [chargement, setChargement] = useState(false);
  const [recherche, setRecherche] = useState('');
  const [filtreStatut, setFiltreStatut] = useState<string>('tous');
  const [modalOuvert, setModalOuvert] = useState(false);
  const [enEdition, setEnEdition] = useState<Besoin | null>(null);
  const [enregistrement, setEnregistrement] = useState(false);
  const [form] = Form.useForm();

  const filiereChoisie = Form.useWatch('filiere_id', form);

  const charger = useCallback(() => {
    if (!anneeId) return;
    setChargement(true);
    apiFetch<{ data: Besoin[] }>(`/api/charge-pedagogique/besoins?annee_id=${anneeId}`)
      .then((res) => setBesoins(res.data))
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) return;
        message.error('Erreur lors du chargement des besoins.');
      })
      .finally(() => setChargement(false));
  }, [anneeId]);

  useEffect(() => { charger(); }, [charger]);

  useEffect(() => {
    apiFetch<{ data: { lignes: LignePerimetre[] } }>('/api/charge-pedagogique/perimetre')
      .then((res) => setPerimetre(res.data.lignes))
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) return;
        message.error('Impossible de charger votre périmètre.');
      });
  }, []);

  // Une filière peut apparaître plusieurs fois dans le périmètre (un rattachement par
  // niveau) : le sélecteur, lui, ne doit la proposer qu'une fois.
  const filieres = useMemo(() => {
    const parId = new Map<number, LignePerimetre>();
    perimetre.forEach((l) => { if (!parId.has(l.filiere_id)) parId.set(l.filiere_id, l); });
    return [...parId.values()];
  }, [perimetre]);

  // Niveaux proposables pour la filière choisie. Si le CP est rattaché à la filière
  // entière (niveau_id NULL), tous ses niveaux sont ouverts ; s'il n'a que certains
  // niveaux, seuls ceux-là — même règle que la garde serveur, pour ne pas proposer un
  // choix qui sera refusé à l'enregistrement.
  useEffect(() => {
    if (!filiereChoisie) { setNiveaux([]); return; }
    apiFetch<Niveau[]>(`/api/niveaux/${filiereChoisie}`)
      .then((liste) => {
        const parLibelle = new Map<string, Niveau>();
        (Array.isArray(liste) ? liste : []).forEach((n) => {
          if (!parLibelle.has(n.libelle)) parLibelle.set(n.libelle, n);
        });
        const tous = [...parLibelle.values()];

        const rattachements = perimetre.filter((l) => l.filiere_id === filiereChoisie);
        const filiereEntiere = rattachements.some((l) => l.niveau_id == null);
        if (filiereEntiere || rattachements.length === 0) { setNiveaux(tous); return; }

        const autorises = new Set(rattachements.map((l) => l.niveau_id));
        setNiveaux(tous.filter((n) => autorises.has(n.id)));
      })
      .catch(() => setNiveaux([]));
  }, [filiereChoisie, perimetre]);

  const besoinsFiltres = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return besoins.filter((b) => {
      const okStatut = filtreStatut === 'tous' || b.statut === filtreStatut;
      const okRecherche = !q
        || b.intitule.toLowerCase().includes(q)
        || (b.filiere ?? '').toLowerCase().includes(q)
        || (b.specialite_attendue ?? '').toLowerCase().includes(q)
        || (b.matiere ?? '').toLowerCase().includes(q);
      return okStatut && okRecherche;
    });
  }, [besoins, recherche, filtreStatut]);

  const ouvrirCreation = () => {
    setEnEdition(null);
    form.resetFields();
    form.setFieldsValue({ priorite: 'normale', nombre_postes: 1, volume_horaire_prevu: 0 });
    setModalOuvert(true);
  };

  const ouvrirEdition = (besoin: Besoin) => {
    setEnEdition(besoin);
    form.setFieldsValue(besoin);
    setModalOuvert(true);
  };

  const enregistrer = async () => {
    try {
      const valeurs = await form.validateFields();
      setEnregistrement(true);
      if (enEdition) {
        await apiFetch(`/api/charge-pedagogique/besoins/${enEdition.id}`, {
          method: 'PUT', body: JSON.stringify(valeurs),
        });
        message.success('Besoin mis à jour');
      } else {
        await apiFetch('/api/charge-pedagogique/besoins', {
          method: 'POST',
          body: JSON.stringify({ ...valeurs, annee_academique_id: anneeId }),
        });
        message.success('Besoin enregistré');
      }
      setModalOuvert(false);
      charger();
    } catch (e) {
      if (e instanceof ApiError) { message.error(e.message); return; }
      if ((e as any)?.errorFields) return;
      message.error("Erreur lors de l'enregistrement.");
    } finally {
      setEnregistrement(false);
    }
  };

  const changerStatut = async (besoin: Besoin, statut: string) => {
    try {
      await apiFetch(`/api/charge-pedagogique/besoins/${besoin.id}/statut`, {
        method: 'PATCH', body: JSON.stringify({ statut }),
      });
      message.success('Statut mis à jour');
      charger();
    } catch (e) {
      if (e instanceof ApiError) { message.error(e.message); return; }
      message.error('Erreur lors du changement de statut.');
    }
  };

  const colonnes = [
    {
      title: 'Besoin', dataIndex: 'intitule',
      render: (v: string, r: Besoin) => (
        <div>
          <div style={{ fontWeight: 600 }}>{v}</div>
          {r.specialite_attendue && (
            <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>Spécialité : {r.specialite_attendue}</div>
          )}
        </div>
      ),
    },
    {
      title: 'Périmètre',
      render: (_: any, r: Besoin) => (
        <div>
          <div>{r.filiere || '—'}</div>
          <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>{r.niveau || 'Tous niveaux'}</div>
        </div>
      ),
    },
    { title: 'Matière', dataIndex: 'matiere', render: (v: string | null) => v || '—' },
    { title: 'Postes', dataIndex: 'nombre_postes', align: 'right' as const },
    {
      title: 'Volume', dataIndex: 'volume_horaire_prevu', align: 'right' as const,
      render: (v: number) => (v ? `${v} h` : '—'),
    },
    {
      title: 'Priorité', dataIndex: 'priorite',
      render: (v: string) => <Tag color={TON_PRIORITE[v]}>{PRIORITES.find((p) => p.value === v)?.label ?? v}</Tag>,
    },
    {
      title: 'Offres', dataIndex: 'nb_offres', align: 'right' as const,
      render: (v: number) => (v > 0 ? <Tag color="blue">{v}</Tag> : <span style={{ color: 'var(--text-soft)' }}>—</span>),
    },
    {
      title: 'Statut', dataIndex: 'statut',
      render: (v: string) => <StatusTag tone={STATUTS[v]?.tone ?? 'neutral'} label={STATUTS[v]?.label ?? v} />,
    },
    { title: 'Créé le', dataIndex: 'created_at', render: (v: string) => formatDate(v) },
    {
      title: 'Action',
      render: (_: any, r: Besoin) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button size="small" icon={<EditOutlined />} onClick={() => ouvrirEdition(r)} />
          {r.statut === 'ouvert' && (
            <>
              <Popconfirm title="Marquer ce besoin comme pourvu ?" onConfirm={() => changerStatut(r, 'pourvu')} okText="Confirmer" cancelText="Annuler">
                <Button size="small" icon={<CheckCircleOutlined />} />
              </Popconfirm>
              <Popconfirm title="Annuler ce besoin ?" onConfirm={() => changerStatut(r, 'annule')} okText="Confirmer" cancelText="Annuler">
                <Button size="small" danger icon={<StopOutlined />} />
              </Popconfirm>
            </>
          )}
          {r.statut !== 'ouvert' && (
            <Popconfirm title="Rouvrir ce besoin ?" onConfirm={() => changerStatut(r, 'ouvert')} okText="Confirmer" cancelText="Annuler">
              <Button size="small">Rouvrir</Button>
            </Popconfirm>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader />
      <PageContainer
        title="Besoins en enseignants"
        description="Catalogue des besoins de vos filières — base du recrutement transmis aux RH."
        actions={
          <Select
            value={anneeId}
            onChange={setAnneeId}
            style={{ width: 220 }}
            options={annees.map((a) => ({ value: a.id, label: `${a.annee} (${a.etat})` }))}
          />
        }
      >
        <DataTable<Besoin>
          columns={colonnes}
          dataSource={besoinsFiltres}
          rowKey="id"
          loading={chargement}
          searchValue={recherche}
          onSearchChange={setRecherche}
          searchPlaceholder="Rechercher un besoin, une filière, une spécialité"
          filters={
            <Select
              value={filtreStatut}
              onChange={setFiltreStatut}
              style={{ width: 160 }}
              options={[
                { value: 'tous', label: 'Tous les statuts' },
                { value: 'ouvert', label: 'Ouverts' },
                { value: 'pourvu', label: 'Pourvus' },
                { value: 'annule', label: 'Annulés' },
              ]}
            />
          }
          toolbarExtra={
            <Button type="primary" icon={<PlusOutlined />} onClick={ouvrirCreation} disabled={!anneeId}>
              Nouveau besoin
            </Button>
          }
          emptyTitle="Aucun besoin recensé"
          emptyDescription="Déclarez les postes d'enseignants nécessaires pour vos filières : les RH s'en serviront pour publier des offres."
        />
      </PageContainer>

      <Modal
        title={enEdition ? 'Modifier le besoin' : 'Nouveau besoin en enseignant'}
        open={modalOuvert}
        onCancel={() => setModalOuvert(false)}
        onOk={enregistrer}
        okText="Enregistrer"
        cancelText="Annuler"
        confirmLoading={enregistrement}
        width={640}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="intitule" label="Intitulé du besoin" rules={[{ required: true, message: 'Intitulé requis' }]}>
            <Input placeholder="Ex : Enseignant de Mathématiques appliquées — BTS 1" />
          </Form.Item>
          <Form.Item name="filiere_id" label="Filière" rules={[{ required: true, message: 'Filière requise' }]}>
            <Select
              placeholder="Sélectionnez une filière de votre périmètre"
              options={filieres.map((f) => ({ value: f.filiere_id, label: f.sigle ? `${f.filiere} (${f.sigle})` : f.filiere }))}
            />
          </Form.Item>
          <Form.Item
            name="niveau_id"
            label="Niveau"
            extra="Laissez vide si le besoin concerne toute la filière."
          >
            <Select
              allowClear
              placeholder="Tous niveaux"
              options={niveaux.map((n) => ({ value: n.id, label: n.libelle }))}
            />
          </Form.Item>
          <Form.Item name="specialite_attendue" label="Spécialité attendue">
            <Input placeholder="Ex : Statistiques, Droit des affaires…" />
          </Form.Item>
          <div style={{ display: 'flex', gap: 12 }}>
            <Form.Item name="nombre_postes" label="Nombre de postes" style={{ flex: 1 }}>
              <InputNumber min={1} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="volume_horaire_prevu" label="Volume horaire prévu (h)" style={{ flex: 1 }}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="priorite" label="Priorité" style={{ flex: 1 }}>
              <Select options={PRIORITES} />
            </Form.Item>
          </div>
          <Form.Item name="commentaire" label="Commentaire">
            <Input.TextArea rows={3} placeholder="Contexte, contraintes d'intervention…" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default BesoinsEnseignants;
