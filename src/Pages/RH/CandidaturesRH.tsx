/* eslint-disable @typescript-eslint/no-explicit-any */
// Espace RH — « Traitement des candidatures » et « Onboarding » (§3.2).
//
// L'acceptation est le geste le plus lourd du module : elle crée d'un bloc le profil
// enseignant, sa ligne au référentiel professeur et son compte d'accès au portail. Le mot
// de passe temporaire n'est affiché qu'une fois (il n'est stocké que haché) — d'où la
// modale de remise dédiée, qu'on ne peut pas fermer par mégarde.
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button, Select, message, Tag, Modal, Input, Tabs, Form, InputNumber, DatePicker, Alert, Typography,
} from 'antd';
import {
  CheckCircleOutlined, CloseCircleOutlined, EyeOutlined, PlusOutlined, KeyOutlined, CopyOutlined,
} from '@ant-design/icons';
import PageHeader from '../../Components/PageHeader/PageHeader';
import PageContainer from '../../Components/ui/PageContainer';
import DataTable from '../../Components/ui/DataTable';
import StatusTag from '../../Components/ui/StatusTag';
import FicheCandidature from '../../Components/Candidature/FicheCandidature';
import { apiFetch, ApiError } from '../../lib/api';
import {
  CandidatureListe, STATUT_CANDIDATURE, formatDate, nomComplet, getUtilisateurCourant,
} from '../../lib/enseignants';

const { Paragraph } = Typography;

interface Site { id: number; nom: string }
interface Ecole { id: number; nom: string }
interface Filiere { id: number; nom: string; sigle: string | null }

type Onglet = 'a_decider' | 'validees' | 'refusees' | 'toutes';

interface AccesGeneres { identifiant: string; mot_de_passe_temporaire: string }

const CandidaturesRH = () => {
  const utilisateur = getUtilisateurCourant();

  const [candidatures, setCandidatures] = useState<CandidatureListe[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [ecoles, setEcoles] = useState<Ecole[]>([]);
  const [filieres, setFilieres] = useState<Filiere[]>([]);
  const [chargement, setChargement] = useState(false);
  const [recherche, setRecherche] = useState('');
  const [onglet, setOnglet] = useState<Onglet>('a_decider');
  const [ficheOuverte, setFicheOuverte] = useState<number | null>(null);

  const [aValider, setAValider] = useState<CandidatureListe | null>(null);
  const [aRefuser, setARefuser] = useState<CandidatureListe | null>(null);
  const [motifRefus, setMotifRefus] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [acces, setAcces] = useState<{ enseignant: string; acces: AccesGeneres } | null>(null);

  const [modalSaisie, setModalSaisie] = useState(false);
  const [formValidation] = Form.useForm();
  const [formSaisie] = Form.useForm();

  const charger = useCallback(() => {
    setChargement(true);
    apiFetch<{ data: CandidatureListe[] }>('/api/rh/candidatures')
      .then((res) => setCandidatures(res.data))
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) return;
        message.error('Erreur lors du chargement des candidatures.');
      })
      .finally(() => setChargement(false));
  }, []);

  useEffect(() => { charger(); }, [charger]);

  useEffect(() => {
    apiFetch<Site[]>('/api/sites').then((d) => setSites(Array.isArray(d) ? d : [])).catch(() => undefined);
    apiFetch<Ecole[]>('/api/ecoles').then((d) => setEcoles(Array.isArray(d) ? d : [])).catch(() => undefined);
    apiFetch<Filiere[]>('/api/filieres').then((d) => setFilieres(Array.isArray(d) ? d : [])).catch(() => undefined);
  }, []);

  // §3.2 : les RH reçoivent les candidatures « soit en direct suite à une offre, soit
  // transmises par les Chargés Pédagogiques ». Une candidature déposée sur une offre publiée
  // attend donc bien une décision RH, même si aucun CP ne l'a encore relayée — sans quoi elle
  // resterait invisible dans l'onglet de travail.
  const attendUneDecisionRH = (c: CandidatureListe) =>
    c.statut === 'transmise_rh' || (c.statut === 'recue' && !!c.offre_titre);

  const candidaturesFiltrees = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    const parOnglet = candidatures.filter((c) => {
      if (onglet === 'a_decider') return attendUneDecisionRH(c);
      if (onglet === 'validees') return c.statut === 'validee';
      if (onglet === 'refusees') return c.statut === 'refusee';
      return true;
    });
    if (!q) return parOnglet;
    return parOnglet.filter((c) =>
      `${c.nom} ${c.prenoms}`.toLowerCase().includes(q)
      || c.reference.toLowerCase().includes(q)
      || c.email.toLowerCase().includes(q)
      || (c.specialite ?? '').toLowerCase().includes(q));
  }, [candidatures, recherche, onglet]);

  const compte = (statut: string) => candidatures.filter((c) => c.statut === statut).length;

  const ouvrirValidation = (candidature: CandidatureListe) => {
    formValidation.resetFields();
    formValidation.setFieldsValue({ site_id: utilisateur?.departement_id });
    setAValider(candidature);
  };

  const valider = async () => {
    if (!aValider) return;
    try {
      const v = await formValidation.validateFields();
      setEnvoi(true);
      const res = await apiFetch<{ acces: AccesGeneres }>(`/api/rh/candidatures/${aValider.id}/valider`, {
        method: 'PATCH', body: JSON.stringify(v),
      });
      setAcces({ enseignant: nomComplet(aValider.nom, aValider.prenoms), acces: res.acces });
      setAValider(null);
      setFicheOuverte(null);
      charger();
    } catch (e) {
      if (e instanceof ApiError) { message.error(e.message); return; }
      if ((e as any)?.errorFields) return;
      message.error("Erreur lors de l'acceptation de la candidature.");
    } finally {
      setEnvoi(false);
    }
  };

  const refuser = async () => {
    if (!aRefuser) return;
    if (!motifRefus.trim()) { message.warning('Un motif de refus est requis.'); return; }
    try {
      setEnvoi(true);
      await apiFetch(`/api/rh/candidatures/${aRefuser.id}/refuser`, {
        method: 'PATCH', body: JSON.stringify({ motif: motifRefus.trim() }),
      });
      message.success('Candidature refusée');
      setARefuser(null);
      setMotifRefus('');
      setFicheOuverte(null);
      charger();
    } catch (e) {
      if (e instanceof ApiError) { message.error(e.message); return; }
      message.error('Erreur lors du refus.');
    } finally {
      setEnvoi(false);
    }
  };

  const enregistrerSaisie = async () => {
    try {
      const v = await formSaisie.validateFields();
      setEnvoi(true);
      await apiFetch('/api/rh/candidatures', {
        method: 'POST',
        body: JSON.stringify({
          ...v,
          date_naissance: v.date_naissance ? v.date_naissance.format('YYYY-MM-DD') : null,
        }),
      });
      message.success('Candidature enregistrée');
      setModalSaisie(false);
      formSaisie.resetFields();
      charger();
    } catch (e) {
      if (e instanceof ApiError) { message.error(e.message); return; }
      if ((e as any)?.errorFields) return;
      message.error("Erreur lors de l'enregistrement.");
    } finally {
      setEnvoi(false);
    }
  };

  const colonnes = [
    {
      title: 'Candidat',
      render: (_: any, r: CandidatureListe) => (
        <div>
          <div style={{ fontWeight: 600 }}>{nomComplet(r.nom, r.prenoms)}</div>
          <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>{r.reference} · {r.email}</div>
        </div>
      ),
    },
    { title: 'Grade', dataIndex: 'grade', render: (v: string | null) => v || '—' },
    { title: 'Spécialité', dataIndex: 'specialite', render: (v: string | null) => v || '—' },
    {
      title: 'Expérience', dataIndex: 'annees_experience', align: 'right' as const,
      render: (v: number | null) => (v != null ? `${v} an(s)` : '—'),
    },
    {
      title: 'Filières visées', dataIndex: 'filieres_visees',
      render: (v: string[]) => (v?.length ? v.map((f) => <Tag key={f}>{f}</Tag>) : <span style={{ color: 'var(--text-soft)' }}>—</span>),
    },
    {
      title: 'Pré-évaluation CP', dataIndex: 'commentaire_cp',
      render: (v: string | null, r: CandidatureListe) =>
        r.date_prevalidation
          ? <div style={{ fontSize: 12 }}>{v || <span style={{ color: 'var(--text-soft)' }}>Transmise sans commentaire</span>}</div>
          : <span style={{ color: 'var(--text-soft)' }}>Candidature directe</span>,
    },
    {
      title: 'Statut', dataIndex: 'statut',
      render: (v: keyof typeof STATUT_CANDIDATURE) => <StatusTag tone={STATUT_CANDIDATURE[v].tone} label={STATUT_CANDIDATURE[v].label} />,
    },
    { title: 'Reçue le', dataIndex: 'created_at', render: (v: string) => formatDate(v) },
    {
      title: 'Action',
      render: (_: any, r: CandidatureListe) => {
        const decidable = r.statut !== 'validee' && r.statut !== 'refusee';
        return (
          <div style={{ display: 'flex', gap: 8 }}>
            <Button size="small" icon={<EyeOutlined />} onClick={() => setFicheOuverte(r.id)} />
            {decidable && (
              <>
                <Button size="small" type="primary" icon={<CheckCircleOutlined />} onClick={() => ouvrirValidation(r)}>
                  Accepter
                </Button>
                <Button size="small" danger icon={<CloseCircleOutlined />} onClick={() => { setMotifRefus(''); setARefuser(r); }} />
              </>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader />
      <PageContainer
        title="Traitement des candidatures"
        description="Candidatures directes et dossiers transmis par les Chargés Pédagogiques."
      >
        <Tabs
          activeKey={onglet}
          onChange={(k) => setOnglet(k as Onglet)}
          items={[
            { key: 'a_decider', label: `À décider (${candidatures.filter(attendUneDecisionRH).length})` },
            { key: 'validees', label: `Acceptées (${compte('validee')})` },
            { key: 'refusees', label: `Refusées (${compte('refusee')})` },
            { key: 'toutes', label: `Toutes (${candidatures.length})` },
          ]}
        />

        <DataTable<CandidatureListe>
          columns={colonnes}
          dataSource={candidaturesFiltrees}
          rowKey="id"
          loading={chargement}
          searchValue={recherche}
          onSearchChange={setRecherche}
          searchPlaceholder="Rechercher un candidat, une référence, une spécialité"
          toolbarExtra={
            <Button icon={<PlusOutlined />} onClick={() => setModalSaisie(true)}>
              Saisir une candidature reçue hors ligne
            </Button>
          }
          emptyTitle="Aucune candidature"
          emptyDescription={
            onglet === 'a_decider'
              ? 'Les candidatures transmises par les Chargés Pédagogiques ou déposées sur une offre apparaîtront ici.'
              : undefined
          }
        />
      </PageContainer>

      <FicheCandidature
        candidatureId={ficheOuverte}
        baseUrl="/api/rh"
        onClose={() => setFicheOuverte(null)}
        actions={(c) =>
          c.statut !== 'validee' && c.statut !== 'refusee' ? (
            <>
              <Button danger icon={<CloseCircleOutlined />} onClick={() => { setMotifRefus(''); setARefuser(c as CandidatureListe); }}>
                Refuser
              </Button>
              <Button type="primary" icon={<CheckCircleOutlined />} onClick={() => ouvrirValidation(c as CandidatureListe)}>
                Accepter et créer les accès
              </Button>
            </>
          ) : null
        }
      />

      {/* Acceptation : rattachement + création des accès */}
      <Modal
        title={aValider ? `Accepter ${nomComplet(aValider.nom, aValider.prenoms)}` : ''}
        open={aValider !== null}
        onCancel={() => setAValider(null)}
        onOk={valider}
        okText="Accepter et créer les accès"
        cancelText="Annuler"
        confirmLoading={envoi}
        width={560}
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="Ce que cette action déclenche"
          description="Création du profil enseignant, de sa fiche au référentiel professeur et de son compte d'accès au portail enseignant. Les conditions contractuelles (classes, taux horaire, volume) se définissent ensuite depuis l'écran Contrats."
        />
        <Form form={formValidation} layout="vertical">
          <Form.Item name="site_id" label="Site de rattachement" rules={[{ required: true, message: 'Site requis' }]}>
            <Select options={sites.map((s) => ({ value: s.id, label: s.nom }))} placeholder="Sélectionnez un site" />
          </Form.Item>
          <Form.Item name="ecole_id" label="École" extra="Laissez vide pour un enseignant intervenant dans plusieurs écoles.">
            <Select allowClear options={ecoles.map((e) => ({ value: e.id, label: e.nom }))} placeholder="Toutes écoles" />
          </Form.Item>
          <Form.Item name="commentaire" label="Commentaire RH">
            <Input.TextArea rows={3} placeholder="Décision, conditions particulières…" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Remise des accès — affichée une seule fois */}
      <Modal
        title={<><KeyOutlined /> Accès du portail enseignant</>}
        open={acces !== null}
        onCancel={() => setAcces(null)}
        footer={[<Button key="ok" type="primary" onClick={() => setAcces(null)}>J'ai transmis ces accès</Button>]}
        maskClosable={false}
      >
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="Ce mot de passe ne sera plus affiché"
          description="Il n'est conservé que sous forme chiffrée. Transmettez-le à l'enseignant maintenant ; en cas de perte, régénérez-en un depuis l'écran Enseignants."
        />
        {acces && (
          <>
            <p><strong>{acces.enseignant}</strong></p>
            <Paragraph copyable={{ text: acces.acces.identifiant, icon: <CopyOutlined /> }}>
              Identifiant : <strong>{acces.acces.identifiant}</strong>
            </Paragraph>
            <Paragraph copyable={{ text: acces.acces.mot_de_passe_temporaire, icon: <CopyOutlined /> }}>
              Mot de passe temporaire : <strong>{acces.acces.mot_de_passe_temporaire}</strong>
            </Paragraph>
          </>
        )}
      </Modal>

      {/* Refus */}
      <Modal
        title="Refuser la candidature"
        open={aRefuser !== null}
        onCancel={() => setARefuser(null)}
        onOk={refuser}
        okText="Refuser"
        okButtonProps={{ danger: true }}
        cancelText="Annuler"
        confirmLoading={envoi}
      >
        <p style={{ color: 'var(--text-soft)' }}>Le motif est conservé au dossier du candidat.</p>
        <Input.TextArea
          rows={4}
          value={motifRefus}
          onChange={(e) => setMotifRefus(e.target.value)}
          placeholder="Motif du refus (obligatoire)"
        />
      </Modal>

      {/* Saisie interne */}
      <Modal
        title="Candidature reçue hors ligne"
        open={modalSaisie}
        onCancel={() => setModalSaisie(false)}
        onOk={enregistrerSaisie}
        okText="Enregistrer"
        cancelText="Annuler"
        confirmLoading={envoi}
        width={680}
      >
        <p style={{ color: 'var(--text-soft)' }}>
          Pour un dossier remis en main propre ou par courrier. Les candidatures du site institutionnel
          arrivent automatiquement dans cette liste.
        </p>
        <Form form={formSaisie} layout="vertical">
          <div style={{ display: 'flex', gap: 12 }}>
            <Form.Item name="nom" label="Nom" rules={[{ required: true, message: 'Nom requis' }]} style={{ flex: 1 }}>
              <Input />
            </Form.Item>
            <Form.Item name="prenoms" label="Prénoms" rules={[{ required: true, message: 'Prénoms requis' }]} style={{ flex: 1 }}>
              <Input />
            </Form.Item>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <Form.Item
              name="email"
              label="Email"
              rules={[{ required: true, message: 'Email requis' }, { type: 'email', message: 'Email invalide' }]}
              style={{ flex: 2 }}
            >
              <Input />
            </Form.Item>
            <Form.Item name="telephone" label="Téléphone" style={{ flex: 1 }}>
              <Input />
            </Form.Item>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <Form.Item name="date_naissance" label="Date de naissance" style={{ flex: 1 }}>
              <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="genre" label="Genre" style={{ flex: 1 }}>
              <Select
                allowClear
                options={[{ value: 'M', label: 'Masculin' }, { value: 'F', label: 'Féminin' }, { value: 'Autre', label: 'Autre' }]}
              />
            </Form.Item>
            <Form.Item name="nationalite" label="Nationalité" style={{ flex: 1 }}>
              <Input />
            </Form.Item>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <Form.Item name="grade" label="Grade" style={{ flex: 1 }}>
              <Input placeholder="Ex : Docteur, Ingénieur…" />
            </Form.Item>
            <Form.Item name="specialite" label="Spécialité" style={{ flex: 1 }}>
              <Input />
            </Form.Item>
            <Form.Item name="annees_experience" label="Expérience (années)" style={{ flex: 1 }}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </div>
          <Form.Item name="filieres" label="Filières visées">
            <Select
              mode="multiple"
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Sélectionnez une ou plusieurs filières"
              options={filieres.map((f) => ({ value: f.id, label: f.sigle ? `${f.nom} (${f.sigle})` : f.nom }))}
            />
          </Form.Item>
          <Form.Item name="lettre_motivation" label="Note / lettre de motivation">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default CandidaturesRH;
