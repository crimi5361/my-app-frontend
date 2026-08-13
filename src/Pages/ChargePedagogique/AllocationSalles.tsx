/* eslint-disable @typescript-eslint/no-explicit-any */
// Espace Chargé Pédagogique — « Allocation des salles » (§3.1) et « Gestion des conflits
// de salles » (§4).
//
// Le CP travaille semaine par semaine. Pour chaque séance, le sélecteur de salle affiche
// TOUTES les salles actives et grise celles déjà occupées sur le créneau, en indiquant par
// quoi — masquer une salle occupée laisserait croire qu'elle n'existe pas.
//
// La disponibilité est recalculée à l'ouverture de chaque sélecteur plutôt que chargée en
// bloc : elle dépend du créneau exact de la séance et peut changer entre deux clics si un
// autre Chargé Pédagogique réserve au même moment.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Select, DatePicker, message, Tag, Alert, Modal, Space } from 'antd';
import { CalendarOutlined, ThunderboltOutlined, ClearOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import PageHeader from '../../Components/PageHeader/PageHeader';
import PageContainer from '../../Components/ui/PageContainer';
import DataTable from '../../Components/ui/DataTable';
import { apiFetch, ApiError } from '../../lib/api';
import {
  ClasseCP, Seance, SalleDisponibilite, Salle,
  useAnneesAcademiques, formatHeure, formatDate, nomComplet, LIBELLE_JOUR,
} from '../../lib/enseignants';

dayjs.extend(isoWeek);

const AllocationSalles = () => {
  const { annees, anneeId, setAnneeId } = useAnneesAcademiques();

  const [semaine, setSemaine] = useState<Dayjs>(dayjs().startOf('isoWeek'));
  const [classes, setClasses] = useState<ClasseCP[]>([]);
  const [classeId, setClasseId] = useState<number | null>(null);
  const [seances, setSeances] = useState<Seance[]>([]);
  const [salles, setSalles] = useState<Salle[]>([]);
  const [chargement, setChargement] = useState(false);
  const [recherche, setRecherche] = useState('');
  const [afficherSansSalle, setAfficherSansSalle] = useState(false);

  // Disponibilités mémorisées par séance, rechargées à chaque ouverture de sélecteur.
  const [disponibilites, setDisponibilites] = useState<Record<number, SalleDisponibilite[]>>({});
  const [chargementDispo, setChargementDispo] = useState<number | null>(null);

  const [selection, setSelection] = useState<number[]>([]);
  const [modalLot, setModalLot] = useState(false);
  const [salleLot, setSalleLot] = useState<number | null>(null);
  const [envoiLot, setEnvoiLot] = useState(false);

  const debut = semaine.format('YYYY-MM-DD');
  const fin = semaine.add(6, 'day').format('YYYY-MM-DD');

  useEffect(() => {
    if (!anneeId) return;
    apiFetch<{ data: ClasseCP[] }>(`/api/charge-pedagogique/classes?annee_id=${anneeId}`)
      .then((res) => setClasses(res.data))
      .catch(() => { /* la liste vide désactive simplement le filtre */ });
  }, [anneeId]);

  useEffect(() => {
    apiFetch<{ data: Salle[] }>('/api/salles?statut=actif')
      .then((res) => setSalles(res.data))
      .catch(() => { /* le sélecteur du lot restera vide */ });
  }, []);

  const charger = useCallback(() => {
    if (!anneeId) return;
    setChargement(true);
    const params = new URLSearchParams({ date_debut: debut, date_fin: fin, annee_id: String(anneeId) });
    if (classeId) params.set('classe_id', String(classeId));
    if (afficherSansSalle) params.set('sans_salle', 'true');

    apiFetch<{ data: Seance[] }>(`/api/edt-planification/seances?${params.toString()}`)
      .then((res) => { setSeances(res.data); setSelection([]); setDisponibilites({}); })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) return;
        message.error('Erreur lors du chargement des séances.');
      })
      .finally(() => setChargement(false));
  }, [anneeId, debut, fin, classeId, afficherSansSalle]);

  useEffect(() => { charger(); }, [charger]);

  const chargerDisponibilite = async (seanceId: number) => {
    setChargementDispo(seanceId);
    try {
      const res = await apiFetch<{ data: SalleDisponibilite[] }>(
        `/api/edt-planification/seances/${seanceId}/salles-disponibles`
      );
      setDisponibilites((d) => ({ ...d, [seanceId]: res.data }));
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return;
      message.error('Impossible de vérifier la disponibilité des salles.');
    } finally {
      setChargementDispo(null);
    }
  };

  const affecter = async (seance: Seance, salleId: number | null) => {
    try {
      await apiFetch(`/api/edt-planification/seances/${seance.id}/salle`, {
        method: 'PATCH', body: JSON.stringify({ salle_id: salleId }),
      });
      message.success(salleId ? 'Salle affectée' : 'Salle libérée');
      charger();
    } catch (e) {
      if (e instanceof ApiError) { message.error(e.message); return; }
      message.error("Erreur lors de l'affectation de la salle.");
    }
  };

  const affecterEnLot = async () => {
    if (!salleLot || selection.length === 0) return;
    try {
      setEnvoiLot(true);
      const res = await apiFetch<{ affectees: number; echecs: { id: number; motif: string }[] }>(
        '/api/edt-planification/allocation-groupee',
        { method: 'POST', body: JSON.stringify({ seance_ids: selection, salle_id: salleLot }) }
      );
      if (res.echecs.length === 0) {
        message.success(`${res.affectees} séance(s) affectée(s).`);
      } else {
        Modal.warning({
          title: `${res.affectees} affectée(s), ${res.echecs.length} en échec`,
          content: (
            <ul style={{ paddingLeft: 18, marginTop: 12 }}>
              {res.echecs.map((e) => {
                const s = seances.find((x) => x.id === e.id);
                return (
                  <li key={e.id} style={{ marginBottom: 6 }}>
                    {s ? `${formatDate(s.date_seance)} ${formatHeure(s.heure_debut)} — ${s.classe}` : `Séance ${e.id}`} : {e.motif}
                  </li>
                );
              })}
            </ul>
          ),
        });
      }
      setModalLot(false);
      setSalleLot(null);
      charger();
    } catch (e) {
      if (e instanceof ApiError) { message.error(e.message); return; }
      message.error("Erreur lors de l'affectation groupée.");
    } finally {
      setEnvoiLot(false);
    }
  };

  const seancesFiltrees = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    if (!q) return seances;
    return seances.filter((s) =>
      s.classe.toLowerCase().includes(q)
      || (s.matiere ?? '').toLowerCase().includes(q)
      || (s.salle_code ?? '').toLowerCase().includes(q)
      || (s.enseignant_nom ?? '').toLowerCase().includes(q));
  }, [seances, recherche]);

  const nbSansSalle = seances.filter((s) => !s.salle_id && s.statut !== 'annulee').length;

  const optionsSalle = (seance: Seance) => {
    const dispo = disponibilites[seance.id];
    if (!dispo) {
      // Avant vérification, on n'affiche que la salle actuelle : proposer une liste non
      // vérifiée inviterait à choisir une salle peut-être déjà prise.
      return seance.salle_id
        ? [{ value: seance.salle_id, label: `${seance.salle_code} — ${seance.salle_nom}` }]
        : [];
    }
    return dispo.map((s) => ({
      value: s.id,
      disabled: s.occupee,
      label: s.occupee
        ? `${s.code} — occupée par ${s.occupee_par_classe ?? 'un autre cours'}${s.occupee_par_matiere ? ` (${s.occupee_par_matiere})` : ''}`
        : `${s.code} — ${s.nom} · ${s.capacite} places`,
    }));
  };

  const colonnes = [
    {
      title: 'Jour',
      render: (_: any, r: Seance) => (
        <div>
          <div style={{ fontWeight: 600 }}>{LIBELLE_JOUR(dayjs(r.date_seance).isoWeekday())}</div>
          <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>{formatDate(r.date_seance)}</div>
        </div>
      ),
    },
    {
      title: 'Horaire',
      render: (_: any, r: Seance) => `${formatHeure(r.heure_debut)} – ${formatHeure(r.heure_fin)}`,
    },
    {
      title: 'Classe',
      render: (_: any, r: Seance) => (
        <div>
          <div>{r.classe}</div>
          <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>{r.filiere ?? ''} {r.niveau ?? ''}</div>
        </div>
      ),
    },
    {
      title: 'Cours',
      render: (_: any, r: Seance) => (
        <div>
          <div>{r.matiere || r.intitule || '—'}</div>
          <Tag>{r.type_seance}</Tag>
        </div>
      ),
    },
    {
      title: 'Enseignant',
      render: (_: any, r: Seance) => nomComplet(r.enseignant_nom, r.enseignant_prenoms),
    },
    {
      title: 'Salle',
      width: 340,
      render: (_: any, r: Seance) => (
        <Space.Compact style={{ width: '100%' }}>
          <Select
            style={{ width: '100%' }}
            placeholder="Affecter une salle"
            value={r.salle_id ?? undefined}
            loading={chargementDispo === r.id}
            showSearch
            optionFilterProp="label"
            options={optionsSalle(r)}
            onDropdownVisibleChange={(ouvert) => { if (ouvert) chargerDisponibilite(r.id); }}
            onChange={(valeur) => affecter(r, valeur)}
            notFoundContent={chargementDispo === r.id ? 'Vérification…' : 'Aucune salle'}
            status={!r.salle_id ? 'warning' : undefined}
          />
          {r.salle_id && (
            <Button icon={<ClearOutlined />} title="Libérer la salle" onClick={() => affecter(r, null)} />
          )}
        </Space.Compact>
      ),
    },
  ];

  return (
    <div>
      <PageHeader />
      <PageContainer
        title="Allocation des salles"
        description="Semaine par semaine : affectez une salle physique à chaque cours programmé."
        actions={
          <>
            <Select
              value={anneeId}
              onChange={setAnneeId}
              style={{ width: 180 }}
              options={annees.map((a) => ({ value: a.id, label: a.annee }))}
            />
            <Button onClick={() => setSemaine((s) => s.subtract(1, 'week'))}>← Semaine précédente</Button>
            <DatePicker
              picker="week"
              value={semaine}
              onChange={(d) => d && setSemaine(d.startOf('isoWeek'))}
              format={() => `${semaine.format('DD/MM')} → ${semaine.add(6, 'day').format('DD/MM/YYYY')}`}
              allowClear={false}
              suffixIcon={<CalendarOutlined />}
              style={{ width: 200 }}
            />
            <Button onClick={() => setSemaine((s) => s.add(1, 'week'))}>Semaine suivante →</Button>
          </>
        }
      >
        {nbSansSalle > 0 && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 20 }}
            message={`${nbSansSalle} séance(s) de cette semaine sans salle`}
            description="Les salles déjà occupées sur un créneau apparaissent grisées dans le sélecteur, avec le cours qui les occupe."
          />
        )}

        <DataTable<Seance>
          columns={colonnes}
          dataSource={seancesFiltrees}
          rowKey="id"
          loading={chargement}
          searchValue={recherche}
          onSearchChange={setRecherche}
          searchPlaceholder="Rechercher une classe, une matière, un enseignant"
          pagination={{ defaultPageSize: 20 }}
          filters={
            <>
              <Select
                allowClear
                value={classeId ?? undefined}
                onChange={(v) => setClasseId(v ?? null)}
                style={{ width: 240 }}
                placeholder="Toutes mes classes"
                showSearch
                optionFilterProp="label"
                options={classes.map((c) => ({ value: c.id, label: c.nom }))}
              />
              <Select
                value={afficherSansSalle ? 'sans' : 'toutes'}
                onChange={(v) => setAfficherSansSalle(v === 'sans')}
                style={{ width: 200 }}
                options={[
                  { value: 'toutes', label: 'Toutes les séances' },
                  { value: 'sans', label: 'Sans salle uniquement' },
                ]}
              />
            </>
          }
          toolbarExtra={
            <Button
              type="primary"
              icon={<ThunderboltOutlined />}
              disabled={selection.length === 0}
              onClick={() => setModalLot(true)}
            >
              Affecter en lot ({selection.length})
            </Button>
          }
          emptyTitle="Aucune séance cette semaine"
          emptyDescription="Concevez d'abord la trame de l'emploi du temps ; les séances datées en découlent."
          rowSelection={{
            selectedRowKeys: selection,
            onChange: (cles) => setSelection(cles as number[]),
            getCheckboxProps: (r) => ({ disabled: r.statut === 'annulee' }),
          }}
        />
      </PageContainer>

      <Modal
        title="Affectation groupée"
        open={modalLot}
        onCancel={() => setModalLot(false)}
        onOk={affecterEnLot}
        okText="Affecter"
        cancelText="Annuler"
        confirmLoading={envoiLot}
        okButtonProps={{ disabled: !salleLot }}
      >
        <p style={{ color: 'var(--text-soft)' }}>
          {selection.length} séance(s) sélectionnée(s). Les séances dont le créneau entre en conflit
          avec une réservation existante seront listées après coup, sans bloquer les autres.
        </p>
        <Select
          style={{ width: '100%' }}
          placeholder="Sélectionnez une salle"
          value={salleLot ?? undefined}
          onChange={setSalleLot}
          showSearch
          optionFilterProp="label"
          options={salles.map((s) => ({ value: s.id, label: `${s.code} — ${s.nom} · ${s.capacite} places` }))}
        />
      </Modal>
    </div>
  );
};

export default AllocationSalles;
