/* eslint-disable @typescript-eslint/no-explicit-any */
// Espace RH — « Sourcing et Offres : possibilité de publier des offres d'emploi pour des
// postes d'enseignants » (§3.2).
//
// Une offre publiée devient immédiatement visible du site institutionnel via
// GET /api/public/enseignants/offres : c'est le canal par lequel les candidatures arrivent.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Modal, Form, Input, Select, InputNumber, DatePicker, message, Popconfirm, Tag, Tooltip } from 'antd';
import {
  PlusOutlined, EditOutlined, SendOutlined, StopOutlined, CopyOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import PageHeader from '../../Components/PageHeader/PageHeader';
import PageContainer from '../../Components/ui/PageContainer';
import DataTable from '../../Components/ui/DataTable';
import StatusTag from '../../Components/ui/StatusTag';
import { apiFetch, ApiError } from '../../lib/api';
import { Offre, Besoin, STATUT_OFFRE, formatDate, useAnneesAcademiques } from '../../lib/enseignants';

interface Filiere { id: number; nom: string; sigle: string | null }
interface Site { id: number; nom: string }

const TYPES_CONTRAT = [
  { value: 'vacataire', label: 'Vacataire' },
  { value: 'permanent', label: 'Permanent' },
  { value: 'mission', label: 'Mission ponctuelle' },
];

const OffresEmploi = () => {
  const { anneeId } = useAnneesAcademiques();

  const [offres, setOffres] = useState<Offre[]>([]);
  const [besoins, setBesoins] = useState<Besoin[]>([]);
  const [filieres, setFilieres] = useState<Filiere[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [chargement, setChargement] = useState(false);
  const [recherche, setRecherche] = useState('');
  const [filtreStatut, setFiltreStatut] = useState('tous');
  const [modalOuvert, setModalOuvert] = useState(false);
  const [enEdition, setEnEdition] = useState<Offre | null>(null);
  const [enregistrement, setEnregistrement] = useState(false);
  const [form] = Form.useForm();

  const charger = useCallback(() => {
    setChargement(true);
    apiFetch<{ data: Offre[] }>('/api/rh/offres')
      .then((res) => setOffres(res.data))
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) return;
        message.error('Erreur lors du chargement des offres.');
      })
      .finally(() => setChargement(false));
  }, []);

  useEffect(() => { charger(); }, [charger]);

  useEffect(() => {
    apiFetch<Filiere[]>('/api/filieres')
      .then((d) => setFilieres(Array.isArray(d) ? d : (d as any)?.data ?? []))
      .catch(() => { /* le champ filière reste facultatif */ });
    apiFetch<Site[]>('/api/sites')
      .then((d) => setSites(Array.isArray(d) ? d : []))
      .catch(() => { /* idem */ });
  }, []);

  // Les besoins ouverts déclarés par les Chargés Pédagogiques sont la matière première
  // d'une offre : les proposer évite de ressaisir un poste déjà décrit.
  useEffect(() => {
    if (!anneeId) return;
    apiFetch<{ data: Besoin[] }>(`/api/charge-pedagogique/besoins?annee_id=${anneeId}&statut=ouvert`)
      .then((res) => setBesoins(res.data))
      .catch(() => setBesoins([]));
  }, [anneeId]);

  const offresFiltrees = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return offres.filter((o) => {
      const okStatut = filtreStatut === 'tous' || o.statut === filtreStatut;
      const okRecherche = !q
        || o.titre.toLowerCase().includes(q)
        || o.reference.toLowerCase().includes(q)
        || (o.specialite ?? '').toLowerCase().includes(q)
        || (o.filiere ?? '').toLowerCase().includes(q);
      return okStatut && okRecherche;
    });
  }, [offres, recherche, filtreStatut]);

  const ouvrirCreation = () => {
    setEnEdition(null);
    form.resetFields();
    form.setFieldsValue({ type_contrat: 'vacataire' });
    setModalOuvert(true);
  };

  const ouvrirEdition = (offre: Offre) => {
    setEnEdition(offre);
    form.setFieldsValue({
      ...offre,
      date_cloture: offre.date_cloture ? dayjs(offre.date_cloture) : null,
    });
    setModalOuvert(true);
  };

  // Pré-remplir depuis un besoin : l'intitulé, la filière et le volume viennent du CP.
  const appliquerBesoin = (besoinId: number | undefined) => {
    const besoin = besoins.find((b) => b.id === besoinId);
    if (!besoin) return;
    form.setFieldsValue({
      titre: besoin.intitule,
      specialite: besoin.specialite_attendue,
      filiere_id: besoin.filiere_id,
      niveau_id: besoin.niveau_id,
      volume_horaire_indicatif: besoin.volume_horaire_prevu || null,
    });
  };

  const enregistrer = async (publier = false) => {
    try {
      const v = await form.validateFields();
      const corps = {
        ...v,
        date_cloture: v.date_cloture ? v.date_cloture.format('YYYY-MM-DD') : null,
        ...(enEdition ? {} : { statut: publier ? 'publiee' : 'brouillon' }),
      };
      setEnregistrement(true);
      if (enEdition) {
        await apiFetch(`/api/rh/offres/${enEdition.id}`, { method: 'PUT', body: JSON.stringify(corps) });
        message.success('Offre mise à jour');
      } else {
        await apiFetch('/api/rh/offres', { method: 'POST', body: JSON.stringify(corps) });
        message.success(publier ? 'Offre publiée sur le site institutionnel' : 'Offre enregistrée en brouillon');
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

  const changerStatut = async (offre: Offre, statut: string) => {
    try {
      await apiFetch(`/api/rh/offres/${offre.id}/statut`, { method: 'PATCH', body: JSON.stringify({ statut }) });
      message.success(
        statut === 'publiee' ? 'Offre publiée' : statut === 'cloturee' ? 'Offre clôturée' : 'Offre repassée en brouillon'
      );
      charger();
    } catch (e) {
      if (e instanceof ApiError) { message.error(e.message); return; }
      message.error('Erreur lors du changement de statut.');
    }
  };

  const colonnes = [
    {
      title: 'Offre',
      render: (_: any, r: Offre) => (
        <div>
          <div style={{ fontWeight: 600 }}>{r.titre}</div>
          <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>
            {r.reference}
            {r.besoin_intitule && ` · issue du besoin « ${r.besoin_intitule} »`}
          </div>
        </div>
      ),
    },
    { title: 'Spécialité', dataIndex: 'specialite', render: (v: string | null) => v || '—' },
    {
      title: 'Périmètre',
      render: (_: any, r: Offre) => (
        <div>
          <div>{r.filiere || 'Toutes filières'}</div>
          <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>{r.niveau || ''} {r.site_nom || ''}</div>
        </div>
      ),
    },
    {
      title: 'Contrat', dataIndex: 'type_contrat',
      render: (v: string, r: Offre) => (
        <div>
          <Tag>{TYPES_CONTRAT.find((t) => t.value === v)?.label ?? v}</Tag>
          {r.volume_horaire_indicatif ? (
            <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>{r.volume_horaire_indicatif} h</div>
          ) : null}
        </div>
      ),
    },
    {
      title: 'Candidatures', dataIndex: 'nb_candidatures', align: 'right' as const,
      render: (v: number) => (v > 0 ? <Tag color="blue">{v}</Tag> : <span style={{ color: 'var(--text-soft)' }}>0</span>),
      sorter: (a: Offre, b: Offre) => a.nb_candidatures - b.nb_candidatures,
    },
    {
      title: 'Publication',
      render: (_: any, r: Offre) => (
        <div style={{ fontSize: 12 }}>
          <div>{r.date_publication ? formatDate(r.date_publication) : 'Non publiée'}</div>
          {r.date_cloture && <div style={{ color: 'var(--text-soft)' }}>Clôture : {formatDate(r.date_cloture)}</div>}
        </div>
      ),
    },
    {
      title: 'Statut', dataIndex: 'statut',
      render: (v: string) => <StatusTag tone={STATUT_OFFRE[v]?.tone ?? 'neutral'} label={STATUT_OFFRE[v]?.label ?? v} />,
    },
    {
      title: 'Action',
      render: (_: any, r: Offre) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button size="small" icon={<EditOutlined />} onClick={() => ouvrirEdition(r)} />
          {r.statut !== 'publiee' && (
            <Popconfirm
              title="Publier cette offre ?"
              description="Elle deviendra visible sur le site institutionnel et ouverte aux candidatures."
              onConfirm={() => changerStatut(r, 'publiee')}
              okText="Publier"
              cancelText="Annuler"
            >
              <Button size="small" type="primary" icon={<SendOutlined />} />
            </Popconfirm>
          )}
          {r.statut === 'publiee' && (
            <Popconfirm
              title="Clôturer cette offre ?"
              description="Elle disparaîtra du site et n'acceptera plus de candidature."
              onConfirm={() => changerStatut(r, 'cloturee')}
              okText="Clôturer"
              cancelText="Annuler"
            >
              <Button size="small" danger icon={<StopOutlined />} />
            </Popconfirm>
          )}
          <Tooltip title="Copier la référence (à utiliser sur le site institutionnel)">
            <Button
              size="small"
              icon={<CopyOutlined />}
              onClick={() => {
                navigator.clipboard?.writeText(r.reference);
                message.success(`Référence ${r.reference} copiée`);
              }}
            />
          </Tooltip>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader />
      <PageContainer
        title="Offres d'emploi enseignants"
        description="Les offres publiées alimentent la page recrutement du site institutionnel."
      >
        <DataTable<Offre>
          columns={colonnes}
          dataSource={offresFiltrees}
          rowKey="id"
          loading={chargement}
          searchValue={recherche}
          onSearchChange={setRecherche}
          searchPlaceholder="Rechercher un intitulé, une référence, une spécialité"
          filters={
            <Select
              value={filtreStatut}
              onChange={setFiltreStatut}
              style={{ width: 180 }}
              options={[
                { value: 'tous', label: 'Tous les statuts' },
                { value: 'brouillon', label: 'Brouillons' },
                { value: 'publiee', label: 'Publiées' },
                { value: 'cloturee', label: 'Clôturées' },
              ]}
            />
          }
          toolbarExtra={
            <Button type="primary" icon={<PlusOutlined />} onClick={ouvrirCreation}>Nouvelle offre</Button>
          }
          emptyTitle="Aucune offre"
          emptyDescription="Publiez une offre pour recevoir des candidatures depuis le site institutionnel."
        />
      </PageContainer>

      <Modal
        title={enEdition ? "Modifier l'offre" : "Nouvelle offre d'emploi"}
        open={modalOuvert}
        onCancel={() => setModalOuvert(false)}
        width={680}
        footer={
          enEdition
            ? [
                <Button key="annuler" onClick={() => setModalOuvert(false)}>Annuler</Button>,
                <Button key="ok" type="primary" loading={enregistrement} onClick={() => enregistrer()}>Enregistrer</Button>,
              ]
            : [
                <Button key="annuler" onClick={() => setModalOuvert(false)}>Annuler</Button>,
                <Button key="brouillon" loading={enregistrement} onClick={() => enregistrer(false)}>
                  Enregistrer en brouillon
                </Button>,
                <Button key="publier" type="primary" icon={<SendOutlined />} loading={enregistrement} onClick={() => enregistrer(true)}>
                  Publier
                </Button>,
              ]
        }
      >
        <Form form={form} layout="vertical">
          {!enEdition && (
            <Form.Item name="besoin_id" label="Partir d'un besoin déclaré" extra="Facultatif — pré-remplit l'offre depuis le catalogue du Chargé Pédagogique.">
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder={besoins.length ? 'Sélectionnez un besoin ouvert' : 'Aucun besoin ouvert déclaré'}
                onChange={appliquerBesoin}
                options={besoins.map((b) => ({
                  value: b.id,
                  label: `${b.intitule} — ${b.filiere ?? ''} (${b.nombre_postes} poste(s))`,
                }))}
              />
            </Form.Item>
          )}
          <Form.Item name="titre" label="Intitulé du poste" rules={[{ required: true, message: 'Intitulé requis' }]}>
            <Input placeholder="Ex : Enseignant vacataire en Mathématiques appliquées" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={4} placeholder="Missions, volume, période d'intervention…" />
          </Form.Item>
          <div style={{ display: 'flex', gap: 12 }}>
            <Form.Item name="specialite" label="Spécialité" style={{ flex: 1 }}>
              <Input />
            </Form.Item>
            <Form.Item name="type_contrat" label="Type de contrat" style={{ flex: 1 }}>
              <Select options={TYPES_CONTRAT} />
            </Form.Item>
            <Form.Item name="volume_horaire_indicatif" label="Volume indicatif (h)" style={{ flex: 1 }}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <Form.Item name="filiere_id" label="Filière concernée" style={{ flex: 2 }}>
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder="Toutes filières"
                options={filieres.map((f) => ({ value: f.id, label: f.sigle ? `${f.nom} (${f.sigle})` : f.nom }))}
              />
            </Form.Item>
            <Form.Item name="site_id" label="Site" style={{ flex: 1 }}>
              <Select allowClear placeholder="Tous les sites" options={sites.map((s) => ({ value: s.id, label: s.nom }))} />
            </Form.Item>
            <Form.Item name="date_cloture" label="Date de clôture" style={{ flex: 1 }}>
              <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
            </Form.Item>
          </div>
          <Form.Item name="profil_recherche" label="Profil recherché">
            <Input.TextArea rows={3} placeholder="Diplômes attendus, expérience, compétences…" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default OffresEmploi;
