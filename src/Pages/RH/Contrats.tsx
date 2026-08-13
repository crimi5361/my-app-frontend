/* eslint-disable @typescript-eslint/no-explicit-any */
// Espace RH — « Définition des paramètres contractuels de l'enseignant : définition des
// classes d'intervention, saisie du taux horaire et du volume horaire global alloué » (§3.2).
//
// C'est cet écran qui débloque la planification : sans contrat actif couvrant la classe,
// le Chargé Pédagogique ne peut pas affecter l'enseignant à un cours (règle §4).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Modal, Form, Select, InputNumber, DatePicker, Input, message, Popconfirm, Tag, Alert } from 'antd';
import { PlusOutlined, EditOutlined, StopOutlined, CheckCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import PageHeader from '../../Components/PageHeader/PageHeader';
import PageContainer from '../../Components/ui/PageContainer';
import DataTable from '../../Components/ui/DataTable';
import StatusTag from '../../Components/ui/StatusTag';
import { apiFetch, ApiError } from '../../lib/api';
import {
  Contrat, EnseignantListe, ClasseCP, useAnneesAcademiques,
  formatDate, formatMontant, nomComplet,
} from '../../lib/enseignants';

const TYPES_CONTRAT = [
  { value: 'vacataire', label: 'Vacataire' },
  { value: 'permanent', label: 'Permanent' },
  { value: 'mission', label: 'Mission ponctuelle' },
];

const STATUTS: Record<string, { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' }> = {
  actif: { label: 'Actif', tone: 'success' },
  suspendu: { label: 'Suspendu', tone: 'warning' },
  termine: { label: 'Terminé', tone: 'neutral' },
};

const Contrats = () => {
  const { annees, anneeId, setAnneeId } = useAnneesAcademiques();

  const [contrats, setContrats] = useState<Contrat[]>([]);
  const [enseignants, setEnseignants] = useState<EnseignantListe[]>([]);
  const [classes, setClasses] = useState<ClasseCP[]>([]);
  const [chargement, setChargement] = useState(false);
  const [recherche, setRecherche] = useState('');
  const [filtreStatut, setFiltreStatut] = useState('tous');
  const [modalOuvert, setModalOuvert] = useState(false);
  const [enEdition, setEnEdition] = useState<Contrat | null>(null);
  const [enregistrement, setEnregistrement] = useState(false);
  const [form] = Form.useForm();

  const tauxHoraire = Form.useWatch('taux_horaire', form);
  const volumeHoraire = Form.useWatch('volume_horaire_global', form);

  const charger = useCallback(() => {
    if (!anneeId) return;
    setChargement(true);
    apiFetch<{ data: Contrat[] }>(`/api/rh/contrats?annee_id=${anneeId}`)
      .then((res) => setContrats(res.data))
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) return;
        message.error('Erreur lors du chargement des contrats.');
      })
      .finally(() => setChargement(false));
  }, [anneeId]);

  useEffect(() => { charger(); }, [charger]);

  useEffect(() => {
    if (!anneeId) return;
    apiFetch<{ data: EnseignantListe[] }>(`/api/rh/enseignants?statut=actif&annee_id=${anneeId}`)
      .then((res) => setEnseignants(res.data))
      .catch(() => setEnseignants([]));
    // Les RH définissent les classes d'intervention : ils doivent voir toutes les classes
    // de l'année, pas seulement celles d'un périmètre (le filtre serveur est neutre pour ce rôle).
    apiFetch<{ data: ClasseCP[] }>(`/api/charge-pedagogique/classes?annee_id=${anneeId}`)
      .then((res) => setClasses(res.data))
      .catch(() => setClasses([]));
  }, [anneeId]);

  const contratsFiltres = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return contrats.filter((c) => {
      const okStatut = filtreStatut === 'tous' || c.statut === filtreStatut;
      const okRecherche = !q
        || `${c.nom} ${c.prenoms}`.toLowerCase().includes(q)
        || c.matricule.toLowerCase().includes(q)
        || (c.specialite ?? '').toLowerCase().includes(q);
      return okStatut && okRecherche;
    });
  }, [contrats, recherche, filtreStatut]);

  // Un enseignant ayant déjà un contrat actif sur l'année ne doit pas être re-proposé :
  // la base l'interdit (index unique), autant l'écarter du sélecteur.
  const enseignantsDisponibles = useMemo(() => {
    const dejaSousContrat = new Set(contrats.filter((c) => c.statut === 'actif').map((c) => c.enseignant_id));
    return enseignants.filter((e) => !dejaSousContrat.has(e.id));
  }, [enseignants, contrats]);

  const ouvrirCreation = () => {
    setEnEdition(null);
    form.resetFields();
    form.setFieldsValue({ type_contrat: 'vacataire', date_debut: dayjs() });
    setModalOuvert(true);
  };

  const ouvrirEdition = (contrat: Contrat) => {
    setEnEdition(contrat);
    form.setFieldsValue({
      ...contrat,
      taux_horaire: Number(contrat.taux_horaire),
      date_debut: dayjs(contrat.date_debut),
      date_fin: contrat.date_fin ? dayjs(contrat.date_fin) : null,
      classes: contrat.classes.map((c) => c.id),
    });
    setModalOuvert(true);
  };

  const enregistrer = async () => {
    try {
      const v = await form.validateFields();
      const corps = {
        ...v,
        annee_academique_id: anneeId,
        date_debut: v.date_debut ? v.date_debut.format('YYYY-MM-DD') : null,
        date_fin: v.date_fin ? v.date_fin.format('YYYY-MM-DD') : null,
      };
      setEnregistrement(true);
      if (enEdition) {
        await apiFetch(`/api/rh/contrats/${enEdition.id}`, { method: 'PUT', body: JSON.stringify(corps) });
        message.success('Contrat mis à jour');
      } else {
        await apiFetch('/api/rh/contrats', { method: 'POST', body: JSON.stringify(corps) });
        message.success("Contrat établi — l'enseignant est désormais planifiable sur ses classes.");
      }
      setModalOuvert(false);
      charger();
    } catch (e) {
      if (e instanceof ApiError) { message.error(e.message); return; }
      if ((e as any)?.errorFields) return;
      message.error("Erreur lors de l'enregistrement du contrat.");
    } finally {
      setEnregistrement(false);
    }
  };

  const changerStatut = async (contrat: Contrat, statut: string) => {
    try {
      await apiFetch(`/api/rh/contrats/${contrat.id}/statut`, { method: 'PATCH', body: JSON.stringify({ statut }) });
      message.success('Statut du contrat mis à jour');
      charger();
    } catch (e) {
      if (e instanceof ApiError) { message.error(e.message); return; }
      message.error('Erreur lors du changement de statut.');
    }
  };

  const colonnes = [
    {
      title: 'Enseignant',
      render: (_: any, r: Contrat) => (
        <div>
          <div style={{ fontWeight: 600 }}>{nomComplet(r.nom, r.prenoms)}</div>
          <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>
            {r.matricule}{r.specialite ? ` · ${r.specialite}` : ''}
          </div>
        </div>
      ),
    },
    {
      title: 'Type', dataIndex: 'type_contrat',
      render: (v: string) => <Tag>{TYPES_CONTRAT.find((t) => t.value === v)?.label ?? v}</Tag>,
    },
    {
      title: 'Taux horaire', dataIndex: 'taux_horaire', align: 'right' as const,
      render: (v: string) => `${formatMontant(v)}/h`,
      sorter: (a: Contrat, b: Contrat) => Number(a.taux_horaire) - Number(b.taux_horaire),
    },
    {
      title: 'Volume alloué', dataIndex: 'volume_horaire_global', align: 'right' as const,
      render: (v: number) => `${v} h`,
      sorter: (a: Contrat, b: Contrat) => a.volume_horaire_global - b.volume_horaire_global,
    },
    {
      title: 'Coût prévisionnel', dataIndex: 'cout_previsionnel', align: 'right' as const,
      render: (v: string) => formatMontant(v),
      sorter: (a: Contrat, b: Contrat) => Number(a.cout_previsionnel) - Number(b.cout_previsionnel),
    },
    {
      title: "Classes d'intervention", dataIndex: 'classes',
      render: (v: { id: number; nom: string }[]) =>
        v?.length
          ? v.map((c) => <Tag key={c.id}>{c.nom}</Tag>)
          : <Tag color="warning">Aucune — non planifiable</Tag>,
    },
    {
      title: 'Période',
      render: (_: any, r: Contrat) => (
        <div style={{ fontSize: 12 }}>
          <div>Du {formatDate(r.date_debut)}</div>
          <div style={{ color: 'var(--text-soft)' }}>{r.date_fin ? `au ${formatDate(r.date_fin)}` : 'sans terme'}</div>
        </div>
      ),
    },
    {
      title: 'Statut', dataIndex: 'statut',
      render: (v: string) => <StatusTag tone={STATUTS[v]?.tone ?? 'neutral'} label={STATUTS[v]?.label ?? v} />,
    },
    {
      title: 'Action',
      render: (_: any, r: Contrat) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button size="small" icon={<EditOutlined />} onClick={() => ouvrirEdition(r)} />
          {r.statut === 'actif' ? (
            <Popconfirm
              title="Suspendre ce contrat ?"
              description="L'enseignant ne pourra plus être planifié sur de nouveaux cours."
              onConfirm={() => changerStatut(r, 'suspendu')}
              okText="Suspendre"
              cancelText="Annuler"
            >
              <Button size="small" danger icon={<StopOutlined />} />
            </Popconfirm>
          ) : (
            <Popconfirm title="Réactiver ce contrat ?" onConfirm={() => changerStatut(r, 'actif')} okText="Réactiver" cancelText="Annuler">
              <Button size="small" icon={<CheckCircleOutlined />} />
            </Popconfirm>
          )}
        </div>
      ),
    },
  ];

  const coutEstime = tauxHoraire && volumeHoraire ? Number(tauxHoraire) * Number(volumeHoraire) : null;

  return (
    <div>
      <PageHeader />
      <PageContainer
        title="Contrats enseignants"
        description="Taux horaire, volume alloué et classes d'intervention — préalable à toute planification."
        actions={
          <>
            <Select
              value={anneeId}
              onChange={setAnneeId}
              style={{ width: 220 }}
              options={annees.map((a) => ({ value: a.id, label: `${a.annee} (${a.etat})` }))}
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={ouvrirCreation} disabled={!anneeId}>
              Nouveau contrat
            </Button>
          </>
        }
      >
        <DataTable<Contrat>
          columns={colonnes}
          dataSource={contratsFiltres}
          rowKey="id"
          loading={chargement}
          searchValue={recherche}
          onSearchChange={setRecherche}
          searchPlaceholder="Rechercher un enseignant, un matricule"
          filters={
            <Select
              value={filtreStatut}
              onChange={setFiltreStatut}
              style={{ width: 180 }}
              options={[
                { value: 'tous', label: 'Tous les statuts' },
                { value: 'actif', label: 'Actifs' },
                { value: 'suspendu', label: 'Suspendus' },
                { value: 'termine', label: 'Terminés' },
              ]}
            />
          }
          emptyTitle="Aucun contrat pour cette année"
          emptyDescription="Établissez un contrat pour chaque enseignant recruté : c'est ce qui autorise sa planification."
        />
      </PageContainer>

      <Modal
        title={enEdition ? `Contrat — ${nomComplet(enEdition.nom, enEdition.prenoms)}` : 'Nouveau contrat'}
        open={modalOuvert}
        onCancel={() => setModalOuvert(false)}
        onOk={enregistrer}
        okText="Enregistrer"
        cancelText="Annuler"
        confirmLoading={enregistrement}
        width={640}
      >
        <Form form={form} layout="vertical">
          {!enEdition && (
            <Form.Item name="enseignant_id" label="Enseignant" rules={[{ required: true, message: 'Enseignant requis' }]}>
              <Select
                showSearch
                optionFilterProp="label"
                placeholder={
                  enseignantsDisponibles.length
                    ? 'Sélectionnez un enseignant'
                    : 'Tous les enseignants actifs ont déjà un contrat pour cette année'
                }
                options={enseignantsDisponibles.map((e) => ({
                  value: e.id,
                  label: `${nomComplet(e.nom, e.prenoms)} — ${e.matricule}${e.specialite ? ` (${e.specialite})` : ''}`,
                }))}
              />
            </Form.Item>
          )}

          <div style={{ display: 'flex', gap: 12 }}>
            <Form.Item name="type_contrat" label="Type de contrat" style={{ flex: 1 }}>
              <Select options={TYPES_CONTRAT} />
            </Form.Item>
            <Form.Item
              name="taux_horaire"
              label="Taux horaire (FCFA)"
              rules={[{ required: true, message: 'Taux requis' }]}
              style={{ flex: 1 }}
            >
              <InputNumber min={0} step={500} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              name="volume_horaire_global"
              label="Volume alloué (h)"
              rules={[{ required: true, message: 'Volume requis' }]}
              style={{ flex: 1 }}
            >
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </div>

          {coutEstime != null && (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              message={`Engagement prévisionnel : ${formatMontant(coutEstime)}`}
            />
          )}

          <Form.Item
            name="classes"
            label="Classes d'intervention"
            rules={[{ required: true, message: 'Au moins une classe est requise' }]}
            extra="Le Chargé Pédagogique ne pourra planifier cet enseignant que sur ces classes."
          >
            <Select
              mode="multiple"
              showSearch
              optionFilterProp="label"
              placeholder="Sélectionnez les classes"
              options={classes.map((c) => ({
                value: c.id,
                label: `${c.nom}${c.filiere ? ` — ${c.sigle || c.filiere}` : ''}${c.niveau ? ` (${c.niveau})` : ''}`,
              }))}
            />
          </Form.Item>

          <div style={{ display: 'flex', gap: 12 }}>
            <Form.Item name="date_debut" label="Date de début" style={{ flex: 1 }}>
              <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="date_fin" label="Date de fin" extra="Vide = sans terme." style={{ flex: 1 }}>
              <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
            </Form.Item>
          </div>

          <Form.Item name="observations" label="Observations">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Contrats;
