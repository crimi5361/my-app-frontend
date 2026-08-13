/* eslint-disable @typescript-eslint/no-explicit-any */
// Espace Chargé Pédagogique — bannette (§3.1) :
//   « Reçoit et pré-évalue les formulaires de candidature […] Transmet les candidatures
//     pertinentes au service RH via le système. »
//
// Le CP ne voit ici que les candidatures dont au moins une filière visée relève de son
// périmètre (filtrage assuré côté serveur, jamais côté navigateur).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, message, Tag, Modal, Input, Tabs } from 'antd';
import { SendOutlined, LikeOutlined, CloseCircleOutlined, EyeOutlined } from '@ant-design/icons';
import PageHeader from '../../Components/PageHeader/PageHeader';
import PageContainer from '../../Components/ui/PageContainer';
import DataTable from '../../Components/ui/DataTable';
import StatusTag from '../../Components/ui/StatusTag';
import FicheCandidature from '../../Components/Candidature/FicheCandidature';
import { apiFetch, ApiError } from '../../lib/api';
import { CandidatureListe, STATUT_CANDIDATURE, formatDate, nomComplet } from '../../lib/enseignants';

type Onglet = 'a_traiter' | 'transmises' | 'toutes';

const BannetteCandidatures = () => {
  const [candidatures, setCandidatures] = useState<CandidatureListe[]>([]);
  const [chargement, setChargement] = useState(false);
  const [recherche, setRecherche] = useState('');
  const [onglet, setOnglet] = useState<Onglet>('a_traiter');
  const [ficheOuverte, setFicheOuverte] = useState<number | null>(null);

  const [actionEnCours, setActionEnCours] = useState<{ candidature: CandidatureListe; action: 'transmettre' | 'rejeter' } | null>(null);
  const [commentaire, setCommentaire] = useState('');
  const [envoi, setEnvoi] = useState(false);

  const charger = useCallback(() => {
    setChargement(true);
    apiFetch<{ data: CandidatureListe[] }>('/api/charge-pedagogique/candidatures')
      .then((res) => setCandidatures(res.data))
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) return;
        message.error('Erreur lors du chargement de la bannette.');
      })
      .finally(() => setChargement(false));
  }, []);

  useEffect(() => { charger(); }, [charger]);

  const candidaturesFiltrees = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    const parOnglet = candidatures.filter((c) => {
      if (onglet === 'a_traiter') return c.statut === 'recue' || c.statut === 'preselectionnee';
      if (onglet === 'transmises') return c.statut === 'transmise_rh';
      return true;
    });
    if (!q) return parOnglet;
    return parOnglet.filter((c) =>
      `${c.nom} ${c.prenoms}`.toLowerCase().includes(q)
      || c.reference.toLowerCase().includes(q)
      || c.email.toLowerCase().includes(q)
      || (c.specialite ?? '').toLowerCase().includes(q)
      || (c.grade ?? '').toLowerCase().includes(q));
  }, [candidatures, recherche, onglet]);

  const nbATraiter = candidatures.filter((c) => c.statut === 'recue' || c.statut === 'preselectionnee').length;
  const nbTransmises = candidatures.filter((c) => c.statut === 'transmise_rh').length;

  const evaluer = async (candidature: CandidatureListe, action: 'preselectionner' | 'transmettre' | 'rejeter', texte?: string) => {
    try {
      setEnvoi(true);
      await apiFetch(`/api/charge-pedagogique/candidatures/${candidature.id}/evaluer`, {
        method: 'PATCH',
        body: JSON.stringify({ action, commentaire: texte || null }),
      });
      message.success(
        action === 'transmettre' ? 'Candidature transmise au service RH'
          : action === 'rejeter' ? 'Candidature écartée'
            : 'Candidature présélectionnée'
      );
      setActionEnCours(null);
      setCommentaire('');
      setFicheOuverte(null);
      charger();
    } catch (e) {
      if (e instanceof ApiError) { message.error(e.message); return; }
      message.error("Erreur lors de l'enregistrement de votre décision.");
    } finally {
      setEnvoi(false);
    }
  };

  const ouvrirAction = (candidature: CandidatureListe, action: 'transmettre' | 'rejeter') => {
    setCommentaire('');
    setActionEnCours({ candidature, action });
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
      sorter: (a: CandidatureListe, b: CandidatureListe) => (a.annees_experience ?? -1) - (b.annees_experience ?? -1),
    },
    {
      title: 'Filières visées', dataIndex: 'filieres_visees',
      render: (v: string[]) => (v?.length ? v.map((f) => <Tag key={f}>{f}</Tag>) : <span style={{ color: 'var(--text-soft)' }}>—</span>),
    },
    { title: 'Offre', dataIndex: 'offre_titre', render: (v: string | null) => v || <span style={{ color: 'var(--text-soft)' }}>Spontanée</span> },
    {
      title: 'Statut', dataIndex: 'statut',
      render: (v: keyof typeof STATUT_CANDIDATURE) => <StatusTag tone={STATUT_CANDIDATURE[v].tone} label={STATUT_CANDIDATURE[v].label} />,
    },
    {
      title: 'Reçue le', dataIndex: 'created_at', render: (v: string) => formatDate(v),
      sorter: (a: CandidatureListe, b: CandidatureListe) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    },
    {
      title: 'Action',
      render: (_: any, r: CandidatureListe) => {
        const modifiable = r.statut === 'recue' || r.statut === 'preselectionnee';
        return (
          <div style={{ display: 'flex', gap: 8 }}>
            <Button size="small" icon={<EyeOutlined />} onClick={() => setFicheOuverte(r.id)} />
            {modifiable && (
              <>
                {r.statut === 'recue' && (
                  <Button size="small" icon={<LikeOutlined />} title="Présélectionner" onClick={() => evaluer(r, 'preselectionner')} />
                )}
                <Button size="small" type="primary" icon={<SendOutlined />} onClick={() => ouvrirAction(r, 'transmettre')}>
                  Transmettre
                </Button>
                <Button size="small" danger icon={<CloseCircleOutlined />} onClick={() => ouvrirAction(r, 'rejeter')} />
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
        title="Bannette des candidatures"
        description="Candidatures reçues pour vos filières — pré-évaluez puis transmettez au service RH."
      >
        <Tabs
          activeKey={onglet}
          onChange={(k) => setOnglet(k as Onglet)}
          items={[
            { key: 'a_traiter', label: `À pré-évaluer (${nbATraiter})` },
            { key: 'transmises', label: `Transmises aux RH (${nbTransmises})` },
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
          emptyTitle={onglet === 'a_traiter' ? 'Aucune candidature en attente' : 'Aucune candidature'}
          emptyDescription={
            onglet === 'a_traiter'
              ? 'Les candidatures déposées sur le site institutionnel pour vos filières apparaîtront ici.'
              : undefined
          }
        />
      </PageContainer>

      <FicheCandidature
        candidatureId={ficheOuverte}
        baseUrl="/api/charge-pedagogique"
        onClose={() => setFicheOuverte(null)}
        actions={(c) =>
          c.statut === 'recue' || c.statut === 'preselectionnee' ? (
            <>
              <Button danger icon={<CloseCircleOutlined />} onClick={() => ouvrirAction(c as CandidatureListe, 'rejeter')}>
                Écarter
              </Button>
              <Button type="primary" icon={<SendOutlined />} onClick={() => ouvrirAction(c as CandidatureListe, 'transmettre')}>
                Transmettre aux RH
              </Button>
            </>
          ) : null
        }
      />

      <Modal
        title={actionEnCours?.action === 'transmettre' ? 'Transmettre au service RH' : 'Écarter la candidature'}
        open={actionEnCours !== null}
        onCancel={() => setActionEnCours(null)}
        onOk={() => actionEnCours && evaluer(actionEnCours.candidature, actionEnCours.action, commentaire)}
        okText={actionEnCours?.action === 'transmettre' ? 'Transmettre' : 'Écarter'}
        okButtonProps={{ danger: actionEnCours?.action === 'rejeter' }}
        cancelText="Annuler"
        confirmLoading={envoi}
      >
        <p style={{ color: 'var(--text-soft)' }}>
          {actionEnCours?.action === 'transmettre'
            ? "Votre appréciation accompagnera le dossier dans la bannette RH."
            : "Le motif est conservé au dossier et le candidat n'ira pas plus loin dans le processus."}
        </p>
        <Input.TextArea
          rows={4}
          value={commentaire}
          onChange={(e) => setCommentaire(e.target.value)}
          placeholder={
            actionEnCours?.action === 'transmettre'
              ? 'Appréciation (facultative) : adéquation au besoin, points forts…'
              : 'Motif du refus (obligatoire)'
          }
        />
      </Modal>
    </div>
  );
};

export default BannetteCandidatures;
