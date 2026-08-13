/* eslint-disable @typescript-eslint/no-explicit-any */
// Espace Chargé Pédagogique — « Conception d'un emploi du temps théorique/maquette sur une
// longue durée (sans affectation immédiate de salles physiques) » (§3.1).
//
// L'écran travaille au niveau de la trame (créneau récurrent). Chaque trame enregistrée est
// matérialisée par le serveur en séances datées ; les salles leur sont ensuite affectées
// depuis « Allocation des salles ».
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button, Modal, Form, Select, TimePicker, DatePicker, message, Tag, Alert, Empty, Spin, Popconfirm, Input,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, InfoCircleOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import PageHeader from '../../Components/PageHeader/PageHeader';
import PageContainer from '../../Components/ui/PageContainer';
import Card from '../../Components/ui/Card';
import { apiFetch, ApiError } from '../../lib/api';
import {
  ClasseCP, Trame, EnseignantPlanifiable, JOURS_SEMAINE,
  useAnneesAcademiques, formatHeure, formatDate, nomComplet,
} from '../../lib/enseignants';

interface Matiere { id: number; nom: string; code_ecue: string | null; ue: string | null; semestre: string | null }

const TYPES_SEANCE = ['CM', 'TD', 'TP', 'Examen', 'Autre'].map((v) => ({ value: v, label: v }));
const FREQUENCES = [
  { value: 'hebdomadaire', label: 'Toutes les semaines' },
  { value: 'quinzaine_paire', label: 'Une semaine sur deux (semaines paires)' },
  { value: 'quinzaine_impaire', label: 'Une semaine sur deux (semaines impaires)' },
];

const COULEUR_TYPE: Record<string, string> = {
  CM: 'blue', TD: 'green', TP: 'purple', Examen: 'red', Autre: 'default',
};

const EmploiDuTemps = () => {
  const { annees, anneeId, setAnneeId } = useAnneesAcademiques();

  const [classes, setClasses] = useState<ClasseCP[]>([]);
  const [classeId, setClasseId] = useState<number | null>(null);
  const [trames, setTrames] = useState<Trame[]>([]);
  const [matieres, setMatieres] = useState<Matiere[]>([]);
  const [enseignants, setEnseignants] = useState<EnseignantPlanifiable[]>([]);
  const [chargement, setChargement] = useState(false);

  const [modalOuvert, setModalOuvert] = useState(false);
  const [enEdition, setEnEdition] = useState<Trame | null>(null);
  const [enregistrement, setEnregistrement] = useState(false);
  const [form] = Form.useForm();

  // Chargement des classes du périmètre
  useEffect(() => {
    if (!anneeId) return;
    apiFetch<{ data: ClasseCP[] }>(`/api/charge-pedagogique/classes?annee_id=${anneeId}`)
      .then((res) => {
        setClasses(res.data);
        setClasseId((actuel) => (res.data.some((c) => c.id === actuel) ? actuel : res.data[0]?.id ?? null));
      })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) return;
        message.error('Impossible de charger vos classes.');
      });
  }, [anneeId]);

  useEffect(() => {
    if (!anneeId) return;
    apiFetch<{ data: EnseignantPlanifiable[] }>(`/api/charge-pedagogique/enseignants-planifiables?annee_id=${anneeId}`)
      .then((res) => setEnseignants(res.data))
      .catch(() => { /* liste vide : le formulaire l'explique */ });
  }, [anneeId]);

  useEffect(() => {
    if (!classeId) { setMatieres([]); return; }
    apiFetch<{ data: Matiere[] }>(`/api/charge-pedagogique/classes/${classeId}/matieres`)
      .then((res) => setMatieres(res.data))
      .catch(() => setMatieres([]));
  }, [classeId]);

  const charger = useCallback(() => {
    if (!classeId || !anneeId) { setTrames([]); return; }
    setChargement(true);
    apiFetch<{ data: Trame[] }>(`/api/edt-planification/trames?classe_id=${classeId}&annee_id=${anneeId}`)
      .then((res) => setTrames(res.data))
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) return;
        message.error("Erreur lors du chargement de l'emploi du temps.");
      })
      .finally(() => setChargement(false));
  }, [classeId, anneeId]);

  useEffect(() => { charger(); }, [charger]);

  // Enseignants dont le contrat couvre la classe sélectionnée : proposer les autres
  // reviendrait à laisser l'utilisateur buter sur la règle de contractualisation (§4).
  const enseignantsPourLaClasse = useMemo(
    () => enseignants.filter((e) => classeId != null && e.classes_autorisees.includes(classeId)),
    [enseignants, classeId]
  );

  const tramesParJour = useMemo(() => {
    const parJour = new Map<number, Trame[]>();
    trames.forEach((t) => {
      const liste = parJour.get(t.jour_semaine) ?? [];
      liste.push(t);
      parJour.set(t.jour_semaine, liste);
    });
    parJour.forEach((liste) => liste.sort((a, b) => a.heure_debut.localeCompare(b.heure_debut)));
    return parJour;
  }, [trames]);

  const ouvrirCreation = () => {
    setEnEdition(null);
    form.resetFields();
    form.setFieldsValue({ type_seance: 'CM', frequence: 'hebdomadaire' });
    setModalOuvert(true);
  };

  const ouvrirEdition = (trame: Trame) => {
    setEnEdition(trame);
    form.setFieldsValue({
      ...trame,
      horaires: [dayjs(trame.heure_debut, 'HH:mm:ss'), dayjs(trame.heure_fin, 'HH:mm:ss')],
      periode: [dayjs(trame.date_debut), dayjs(trame.date_fin)],
    });
    setModalOuvert(true);
  };

  const enregistrer = async () => {
    try {
      const v = await form.validateFields();
      const [debut, fin] = v.horaires as [Dayjs, Dayjs];
      const [du, au] = v.periode as [Dayjs, Dayjs];

      const corps = {
        annee_academique_id: anneeId,
        classe_id: classeId,
        matiere_id: v.matiere_id ?? null,
        enseignant_id: v.enseignant_id ?? null,
        intitule: v.intitule ?? null,
        jour_semaine: v.jour_semaine,
        heure_debut: debut.format('HH:mm'),
        heure_fin: fin.format('HH:mm'),
        type_seance: v.type_seance,
        date_debut: du.format('YYYY-MM-DD'),
        date_fin: au.format('YYYY-MM-DD'),
        frequence: v.frequence,
      };

      setEnregistrement(true);
      const reponse = await apiFetch<{ seances_creees: number; seances_ignorees: { date: string; motifs: string[] }[] }>(
        enEdition ? `/api/edt-planification/trames/${enEdition.id}` : '/api/edt-planification/trames',
        { method: enEdition ? 'PUT' : 'POST', body: JSON.stringify(corps) }
      );

      message.success(`Créneau enregistré — ${reponse.seances_creees} séance(s) générée(s).`);
      if (reponse.seances_ignorees?.length) {
        // Un conflit ponctuel ne doit pas passer inaperçu : le CP doit savoir quelles
        // dates n'ont pas été planifiées, et pourquoi.
        Modal.warning({
          title: `${reponse.seances_ignorees.length} date(s) non planifiée(s)`,
          width: 560,
          content: (
            <ul style={{ paddingLeft: 18, marginTop: 12 }}>
              {reponse.seances_ignorees.map((s) => (
                <li key={s.date} style={{ marginBottom: 6 }}>
                  <strong>{formatDate(s.date)}</strong> — {s.motifs.join(' ')}
                </li>
              ))}
            </ul>
          ),
        });
      }
      setModalOuvert(false);
      charger();
    } catch (e) {
      if (e instanceof ApiError) { message.error(e.message); return; }
      if ((e as any)?.errorFields) return;
      message.error("Erreur lors de l'enregistrement du créneau.");
    } finally {
      setEnregistrement(false);
    }
  };

  const annuler = async (trame: Trame) => {
    try {
      const res = await apiFetch<{ seances_supprimees: number }>(
        `/api/edt-planification/trames/${trame.id}/annuler`, { method: 'PATCH' }
      );
      message.success(`Créneau retiré — ${res.seances_supprimees} séance(s) à venir supprimée(s).`);
      charger();
    } catch (e) {
      if (e instanceof ApiError) { message.error(e.message); return; }
      message.error('Erreur lors du retrait du créneau.');
    }
  };

  const classeCourante = classes.find((c) => c.id === classeId);

  return (
    <div>
      <PageHeader />
      <PageContainer
        title="Conception de l'emploi du temps"
        description="Maquette théorique sur toute la période : les salles sont affectées ensuite, au fur et à mesure."
        actions={
          <>
            <Select
              value={anneeId}
              onChange={setAnneeId}
              style={{ width: 200 }}
              options={annees.map((a) => ({ value: a.id, label: `${a.annee} (${a.etat})` }))}
            />
            <Select
              value={classeId}
              onChange={setClasseId}
              style={{ width: 280 }}
              placeholder="Sélectionnez une classe"
              showSearch
              optionFilterProp="label"
              options={classes.map((c) => ({
                value: c.id,
                label: `${c.nom}${c.filiere ? ` — ${c.sigle || c.filiere}` : ''}`,
              }))}
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={ouvrirCreation} disabled={!classeId}>
              Nouveau créneau
            </Button>
          </>
        }
      >
        {classes.length === 0 && !chargement && (
          <Alert
            type="info"
            showIcon
            message="Aucune classe dans votre périmètre"
            description="Le service RH doit vous rattacher à une ou plusieurs filières avant que vous puissiez planifier des cours."
            style={{ marginBottom: 20 }}
          />
        )}

        {classeCourante && (
          <Alert
            type="info"
            showIcon
            icon={<InfoCircleOutlined />}
            style={{ marginBottom: 20 }}
            message={`${classeCourante.nom} — ${classeCourante.filiere ?? ''} ${classeCourante.niveau ?? ''}`}
            description={
              enseignantsPourLaClasse.length === 0
                ? "Aucun enseignant n'est contractualisé pour cette classe : vous pouvez concevoir la trame, mais l'affectation d'un enseignant attendra la contractualisation par les RH."
                : `${enseignantsPourLaClasse.length} enseignant(s) contractualisé(s) pour cette classe.`
            }
          />
        )}

        {chargement ? (
          <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
        ) : trames.length === 0 ? (
          <Card><Empty description="Aucun créneau défini pour cette classe." /></Card>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {JOURS_SEMAINE.filter((j) => tramesParJour.has(j.value)).map((jour) => (
              <Card key={jour.value} title={jour.label}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {(tramesParJour.get(jour.value) ?? []).map((t) => (
                    <div
                      key={t.id}
                      style={{
                        border: '1px solid var(--border)',
                        borderLeft: '3px solid var(--mod-charge-pedagogique)',
                        borderRadius: 10,
                        padding: '10px 12px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600 }}>
                            {formatHeure(t.heure_debut)} – {formatHeure(t.heure_fin)}
                            <Tag color={COULEUR_TYPE[t.type_seance]} style={{ marginLeft: 8 }}>{t.type_seance}</Tag>
                          </div>
                          <div style={{ fontSize: 13 }}>{t.matiere || t.intitule || 'Cours'}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>
                            {t.enseignant_nom ? nomComplet(t.enseignant_nom, t.enseignant_prenoms) : 'Enseignant non affecté'}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-soft)', marginTop: 4 }}>
                            {formatDate(t.date_debut)} → {formatDate(t.date_fin)}
                            {t.frequence !== 'hebdomadaire' && ' · quinzaine'}
                          </div>
                          <div style={{ fontSize: 12, marginTop: 4 }}>
                            <Tag color={t.nb_sans_salle > 0 ? 'warning' : 'green'}>
                              {t.nb_seances} séance(s){t.nb_sans_salle > 0 ? ` · ${t.nb_sans_salle} sans salle` : ''}
                            </Tag>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                          <Button size="small" icon={<EditOutlined />} onClick={() => ouvrirEdition(t)} />
                          <Popconfirm
                            title="Retirer ce créneau ?"
                            description="Les séances à venir seront supprimées ; celles déjà passées sont conservées."
                            onConfirm={() => annuler(t)}
                            okText="Retirer"
                            cancelText="Annuler"
                          >
                            <Button size="small" danger icon={<DeleteOutlined />} />
                          </Popconfirm>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        )}
      </PageContainer>

      <Modal
        title={enEdition ? 'Modifier le créneau' : 'Nouveau créneau récurrent'}
        open={modalOuvert}
        onCancel={() => setModalOuvert(false)}
        onOk={enregistrer}
        okText="Enregistrer"
        cancelText="Annuler"
        confirmLoading={enregistrement}
        width={640}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="matiere_id" label="Matière" extra="Issue de la maquette pédagogique de la classe.">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder={matieres.length ? 'Sélectionnez une matière' : 'Aucune maquette pour cette classe'}
              options={matieres.map((m) => ({
                value: m.id,
                label: `${m.nom}${m.semestre ? ` (${m.semestre})` : ''}`,
              }))}
            />
          </Form.Item>
          <Form.Item name="intitule" label="Intitulé libre" extra="Utile pour un créneau sans matière de maquette (soutenances, projet…).">
            <Input placeholder="Ex : Atelier projet tutoré" />
          </Form.Item>
          <Form.Item
            name="enseignant_id"
            label="Enseignant"
            extra="Seuls les enseignants contractualisés par les RH pour cette classe sont proposés."
          >
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder={enseignantsPourLaClasse.length ? 'Sélectionnez un enseignant' : 'Aucun enseignant contractualisé pour cette classe'}
              options={enseignantsPourLaClasse.map((e) => ({
                value: e.id,
                label: `${nomComplet(e.nom, e.prenoms)}${e.specialite ? ` — ${e.specialite}` : ''}`,
              }))}
            />
          </Form.Item>
          <div style={{ display: 'flex', gap: 12 }}>
            <Form.Item name="jour_semaine" label="Jour" rules={[{ required: true, message: 'Jour requis' }]} style={{ flex: 1 }}>
              <Select options={JOURS_SEMAINE.map((j) => ({ value: j.value, label: j.label }))} />
            </Form.Item>
            <Form.Item name="horaires" label="Horaires" rules={[{ required: true, message: 'Horaires requis' }]} style={{ flex: 1 }}>
              <TimePicker.RangePicker format="HH:mm" minuteStep={5} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="type_seance" label="Type" style={{ flex: 1 }}>
              <Select options={TYPES_SEANCE} />
            </Form.Item>
          </div>
          <Form.Item name="periode" label="Période couverte" rules={[{ required: true, message: 'Période requise' }]}>
            <DatePicker.RangePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="frequence" label="Récurrence">
            <Select options={FREQUENCES} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default EmploiDuTemps;
