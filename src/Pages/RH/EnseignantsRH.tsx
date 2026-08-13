/* eslint-disable @typescript-eslint/no-explicit-any */
// Espace RH — annuaire des enseignants recrutés.
//
// Sert de point de contrôle de l'onboarding : qui est recruté, qui a un contrat actif, qui
// n'en a pas encore (et n'est donc pas planifiable par les Chargés Pédagogiques, §4).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Select, message, Tag, Modal, Popconfirm, Typography, Alert, Descriptions, Drawer, Table } from 'antd';
import {
  KeyOutlined, StopOutlined, CheckCircleOutlined, EyeOutlined, CopyOutlined, WarningOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../Components/PageHeader/PageHeader';
import PageContainer from '../../Components/ui/PageContainer';
import DataTable from '../../Components/ui/DataTable';
import StatusTag from '../../Components/ui/StatusTag';
import { apiFetch, ApiError } from '../../lib/api';
import {
  EnseignantListe, useAnneesAcademiques, formatDate, formatMontant, nomComplet,
} from '../../lib/enseignants';

const { Paragraph } = Typography;

interface DetailEnseignant extends EnseignantListe {
  identifiant: string | null;
  compte_statut: string | null;
  candidature_reference: string | null;
  contrats: {
    id: number;
    annee_academique: string | null;
    type_contrat: string;
    taux_horaire: string;
    volume_horaire_global: number;
    date_debut: string;
    date_fin: string | null;
    statut: string;
    etabli_par_nom: string | null;
    classes: { id: number; nom: string }[];
  }[];
}

const EnseignantsRH = () => {
  const navigate = useNavigate();
  const { annees, anneeId, setAnneeId } = useAnneesAcademiques();

  const [enseignants, setEnseignants] = useState<EnseignantListe[]>([]);
  const [chargement, setChargement] = useState(false);
  const [recherche, setRecherche] = useState('');
  const [filtreStatut, setFiltreStatut] = useState('tous');
  const [detail, setDetail] = useState<DetailEnseignant | null>(null);
  const [chargementDetail, setChargementDetail] = useState(false);
  const [acces, setAcces] = useState<{ nom: string; identifiant: string; mot_de_passe_temporaire: string } | null>(null);

  const charger = useCallback(() => {
    setChargement(true);
    const suffixe = anneeId ? `?annee_id=${anneeId}` : '';
    apiFetch<{ data: EnseignantListe[] }>(`/api/rh/enseignants${suffixe}`)
      .then((res) => setEnseignants(res.data))
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) return;
        message.error('Erreur lors du chargement des enseignants.');
      })
      .finally(() => setChargement(false));
  }, [anneeId]);

  useEffect(() => { charger(); }, [charger]);

  const ouvrirDetail = async (enseignant: EnseignantListe) => {
    setChargementDetail(true);
    try {
      const res = await apiFetch<{ data: DetailEnseignant }>(`/api/rh/enseignants/${enseignant.id}`);
      setDetail(res.data);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return;
      message.error('Impossible de charger la fiche.');
    } finally {
      setChargementDetail(false);
    }
  };

  const basculerStatut = async (enseignant: EnseignantListe) => {
    const statut = enseignant.statut === 'actif' ? 'inactif' : 'actif';
    try {
      await apiFetch(`/api/rh/enseignants/${enseignant.id}/statut`, {
        method: 'PATCH', body: JSON.stringify({ statut }),
      });
      message.success(statut === 'inactif' ? 'Enseignant désactivé (accès suspendus)' : 'Enseignant réactivé');
      charger();
    } catch (e) {
      if (e instanceof ApiError) { message.error(e.message); return; }
      message.error('Erreur lors du changement de statut.');
    }
  };

  const reinitialiser = async (enseignant: EnseignantListe) => {
    try {
      const res = await apiFetch<{ acces: { identifiant: string; mot_de_passe_temporaire: string } }>(
        `/api/rh/enseignants/${enseignant.id}/reinitialiser-acces`, { method: 'POST' }
      );
      setAcces({ nom: nomComplet(enseignant.nom, enseignant.prenoms), ...res.acces });
    } catch (e) {
      if (e instanceof ApiError) { message.error(e.message); return; }
      message.error('Erreur lors de la réinitialisation.');
    }
  };

  const enseignantsFiltres = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return enseignants.filter((e) => {
      const okStatut =
        filtreStatut === 'tous'
        || (filtreStatut === 'sans_contrat' ? !e.contrat_id : e.statut === filtreStatut);
      const okRecherche = !q
        || `${e.nom} ${e.prenoms}`.toLowerCase().includes(q)
        || e.matricule.toLowerCase().includes(q)
        || e.email.toLowerCase().includes(q)
        || (e.specialite ?? '').toLowerCase().includes(q);
      return okStatut && okRecherche;
    });
  }, [enseignants, recherche, filtreStatut]);

  const sansContrat = enseignants.filter((e) => e.statut === 'actif' && !e.contrat_id).length;

  const colonnes = [
    {
      title: 'Enseignant',
      render: (_: any, r: EnseignantListe) => (
        <div>
          <div style={{ fontWeight: 600 }}>{nomComplet(r.nom, r.prenoms)}</div>
          <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>{r.matricule} · {r.email}</div>
        </div>
      ),
    },
    { title: 'Grade', dataIndex: 'grade', render: (v: string | null) => v || '—' },
    { title: 'Spécialité', dataIndex: 'specialite', render: (v: string | null) => v || '—' },
    { title: 'Site', dataIndex: 'site_nom', render: (v: string | null) => v || '—' },
    {
      title: 'Contrat (année sélectionnée)',
      render: (_: any, r: EnseignantListe) =>
        r.contrat_id ? (
          <div style={{ fontSize: 12 }}>
            <Tag color="green">{r.type_contrat}</Tag>
            <div>{formatMontant(r.taux_horaire)}/h · {r.volume_horaire_global} h</div>
            <div style={{ color: 'var(--text-soft)' }}>{r.nb_classes} classe(s) d'intervention</div>
          </div>
        ) : (
          <Tag icon={<WarningOutlined />} color="warning">Non contractualisé</Tag>
        ),
    },
    { title: 'Recruté le', dataIndex: 'date_recrutement', render: (v: string) => formatDate(v) },
    {
      title: 'Statut', dataIndex: 'statut',
      render: (v: string) => <StatusTag tone={v === 'actif' ? 'success' : 'danger'} label={v === 'actif' ? 'Actif' : 'Inactif'} />,
    },
    {
      title: 'Action',
      render: (_: any, r: EnseignantListe) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button size="small" icon={<EyeOutlined />} onClick={() => ouvrirDetail(r)} loading={chargementDetail} />
          <Popconfirm
            title="Régénérer les accès ?"
            description="Un nouveau mot de passe temporaire sera généré ; l'ancien cessera de fonctionner."
            onConfirm={() => reinitialiser(r)}
            okText="Régénérer"
            cancelText="Annuler"
          >
            <Button size="small" icon={<KeyOutlined />} title="Régénérer les accès" />
          </Popconfirm>
          <Popconfirm
            title={r.statut === 'actif' ? 'Désactiver cet enseignant ?' : 'Réactiver cet enseignant ?'}
            description={r.statut === 'actif' ? 'Son compte portail sera suspendu.' : undefined}
            onConfirm={() => basculerStatut(r)}
            okText="Confirmer"
            cancelText="Annuler"
          >
            <Button size="small" danger={r.statut === 'actif'} icon={r.statut === 'actif' ? <StopOutlined /> : <CheckCircleOutlined />} />
          </Popconfirm>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader />
      <PageContainer
        title="Enseignants recrutés"
        description="Profils créés à l'acceptation d'une candidature, et leurs accès au portail."
        actions={
          <Select
            value={anneeId}
            onChange={setAnneeId}
            style={{ width: 220 }}
            options={annees.map((a) => ({ value: a.id, label: `${a.annee} (${a.etat})` }))}
          />
        }
      >
        {sansContrat > 0 && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 20 }}
            message={`${sansContrat} enseignant(s) actif(s) sans contrat pour l'année sélectionnée`}
            description="Tant que leurs conditions ne sont pas définies (classes, taux horaire, volume), les Chargés Pédagogiques ne peuvent pas les planifier."
            action={<Button size="small" type="primary" onClick={() => navigate('/rh/contrats')}>Établir les contrats</Button>}
          />
        )}

        <DataTable<EnseignantListe>
          columns={colonnes}
          dataSource={enseignantsFiltres}
          rowKey="id"
          loading={chargement}
          searchValue={recherche}
          onSearchChange={setRecherche}
          searchPlaceholder="Rechercher un nom, un matricule, une spécialité"
          filters={
            <Select
              value={filtreStatut}
              onChange={setFiltreStatut}
              style={{ width: 200 }}
              options={[
                { value: 'tous', label: 'Tous' },
                { value: 'actif', label: 'Actifs' },
                { value: 'inactif', label: 'Inactifs' },
                { value: 'sans_contrat', label: 'Sans contrat' },
              ]}
            />
          }
          emptyTitle="Aucun enseignant recruté"
          emptyDescription="Les enseignants apparaissent ici dès qu'une candidature est acceptée."
        />
      </PageContainer>

      <Drawer
        title={detail ? `${nomComplet(detail.nom, detail.prenoms)} — ${detail.matricule}` : ''}
        open={detail !== null}
        onClose={() => setDetail(null)}
        width={640}
      >
        {detail && (
          <>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Email">{detail.email}</Descriptions.Item>
              <Descriptions.Item label="Téléphone">{detail.telephone || '—'}</Descriptions.Item>
              <Descriptions.Item label="Grade">{detail.grade || '—'}</Descriptions.Item>
              <Descriptions.Item label="Spécialité">{detail.specialite || '—'}</Descriptions.Item>
              <Descriptions.Item label="Site">{detail.site_nom || '—'}</Descriptions.Item>
              <Descriptions.Item label="École">{detail.ecole_nom || 'Toutes'}</Descriptions.Item>
              <Descriptions.Item label="Recruté le">{formatDate(detail.date_recrutement)}</Descriptions.Item>
              <Descriptions.Item label="Candidature d'origine">{detail.candidature_reference || 'Saisie directe'}</Descriptions.Item>
              <Descriptions.Item label="Identifiant portail">
                {detail.identifiant || 'Aucun compte'}
                {detail.compte_statut && (
                  <Tag color={detail.compte_statut === 'active' ? 'green' : 'red'} style={{ marginLeft: 8 }}>
                    {detail.compte_statut === 'active' ? 'Actif' : 'Suspendu'}
                  </Tag>
                )}
              </Descriptions.Item>
            </Descriptions>

            <h4 style={{ marginTop: 24 }}>Historique contractuel</h4>
            <Table
              dataSource={detail.contrats}
              rowKey="id"
              size="small"
              pagination={false}
              locale={{ emptyText: 'Aucun contrat établi.' }}
              columns={[
                { title: 'Année', dataIndex: 'annee_academique', render: (v: string | null) => v || '—' },
                { title: 'Type', dataIndex: 'type_contrat' },
                { title: 'Taux', dataIndex: 'taux_horaire', render: (v: string) => `${formatMontant(v)}/h` },
                { title: 'Volume', dataIndex: 'volume_horaire_global', render: (v: number) => `${v} h` },
                {
                  title: 'Classes',
                  dataIndex: 'classes',
                  render: (v: { id: number; nom: string }[]) =>
                    v?.length ? v.map((c) => <Tag key={c.id}>{c.nom}</Tag>) : '—',
                },
                {
                  title: 'Statut', dataIndex: 'statut',
                  render: (v: string) => <Tag color={v === 'actif' ? 'green' : v === 'suspendu' ? 'orange' : 'default'}>{v}</Tag>,
                },
              ]}
            />
          </>
        )}
      </Drawer>

      <Modal
        title={<><KeyOutlined /> Nouveaux accès</>}
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
          description="Il n'est conservé que sous forme chiffrée. Transmettez-le maintenant à l'enseignant."
        />
        {acces && (
          <>
            <p><strong>{acces.nom}</strong></p>
            <Paragraph copyable={{ text: acces.identifiant, icon: <CopyOutlined /> }}>
              Identifiant : <strong>{acces.identifiant}</strong>
            </Paragraph>
            <Paragraph copyable={{ text: acces.mot_de_passe_temporaire, icon: <CopyOutlined /> }}>
              Mot de passe temporaire : <strong>{acces.mot_de_passe_temporaire}</strong>
            </Paragraph>
          </>
        )}
      </Modal>
    </div>
  );
};

export default EnseignantsRH;
