/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useContext, useEffect, useState } from 'react';
import { Card, Input, Button, Table, Modal, Typography, message, Select, DatePicker, Row, Col, Statistic, Space } from 'antd';
import type { TablePaginationConfig } from 'antd';
import { SearchOutlined, FileExcelOutlined, TeamOutlined, CloseCircleOutlined, TagsOutlined, CheckCircleOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import PageHeader from '../../Components/PageHeader/PageHeader';
import PageContainer from '../../Components/ui/PageContainer';
import DataTable from '../../Components/ui/DataTable';
import StatusTag, { StatusTone } from '../../Components/ui/StatusTag';
import KitTraitement from '../../Components/KitTraitement/KitTraitement';
import { apiFetch, ApiError } from '../../lib/api';
import { UserContext } from '../../context/UserContext';
import { useEtudiantFilterOptions } from '../../lib/useEtudiantFilterOptions';

const { Text, Title } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

interface ResultatEtudiantKit {
  id: number;
  nom: string;
  prenoms: string;
  matricule_iipea: string;
  ecole: string | null;
  filiere: string;
  niveau: string;
  annee_academique: string;
  suspendu: boolean;
  statut: 'NON_TRAITE' | 'KIT_APPORTE' | 'KIT_PAYE' | null;
}

// Chantier "Suivi des kits" — Phase 2 frontend (2026-09-07), suite de la Phase 1 backend
// (controllers/kit.controller.js::listerKits, GET /api/kit/liste). Statuts EXACTS renvoyés par
// l'API — jamais reformulés côté logique, jamais de 4e statut inventé.
const LIBELLE_STATUT_KIT: Record<string, string> = {
  NON_DEPOSE: 'Non déposé',
  KIT_APPORTE: 'Kit apporté',
  KIT_PAYE: 'Kit payé',
};
const TONE_STATUT_KIT: Record<string, StatusTone> = {
  NON_DEPOSE: 'danger',
  KIT_APPORTE: 'info',
  KIT_PAYE: 'success',
};
const STATUTS_KIT_POSSIBLES = ['NON_DEPOSE', 'KIT_APPORTE', 'KIT_PAYE'];

interface AnneeOption { id: number; annee: string; etat: string | null; }

interface LigneKit {
  id: number;
  matricule_iipea: string;
  nom: string;
  prenoms: string;
  filiere: string;
  niveau: string;
  groupe: string | null;
  statut_kit: string;
  deposer: boolean | null;
  date_depot: string | null;
  paiement: boolean;
  montant: number | null;
  date_paiement: string | null;
  numero_recu: string | null;
  mode_paiement: string | null;
  traite_par_nom: string | null;
}

interface KpiKit {
  total: number;
  nonDepose: number;
  apporte: number;
  paye: number;
}

// Chantier Kit étudiant — Phase 2 (2026-08-21) : régularisation du Kit pour les étudiants déjà
// inscrits (typiquement 2026-2027 avant la réactivation du module). Ne réimplémente RIEN de la
// Phase 1 : la recherche est un nouvel endpoint dédié (GET /api/kit/rechercher), mais le
// traitement réutilise tel quel le composant KitTraitement (donc POST /api/kit/traiter, la même
// éligibilité, la même contrainte d'unicité, le même paiement Caisse) — un seul point d'entrée de
// traitement dans toute l'application, que l'étudiant vienne d'être inscrit ou soit déjà là depuis
// longtemps.
//
// Chantier "Suivi des kits" — Phase 2 frontend (2026-09-07) : ajoute AU-DESSUS de cette recherche
// existante (inchangée) une liste filtrable de tous les étudiants inscrits pour une année
// académique, alimentée par GET /api/kit/liste (Phase 1) — jamais /api/kit/rechercher, qui reste
// exclusivement le point d'entrée du workflow de recherche/régularisation ci-dessous.
const GestionKits = () => {
  const { user } = useContext(UserContext);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ResultatEtudiantKit[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selected, setSelected] = useState<ResultatEtudiantKit | null>(null);

  // scolarite : lecture seule (cf. permissions Caisse déjà établies en Phase 1) — le backend
  // bloque de toute façon POST /api/kit/traiter à ce rôle, ce masquage n'est qu'une amélioration
  // UX pour éviter un bouton qui mènerait systématiquement à un 403.
  const peutTraiter = user?.role === 'admin' || user?.role === 'comptabilite' || user?.role === 'caissier';

  const handleSearch = async () => {
    if (query.trim().length < 2) {
      message.warning('Saisissez au moins 2 caractères');
      return;
    }
    setSearching(true);
    setSearched(true);
    try {
      const data = await apiFetch<{ data: ResultatEtudiantKit[] }>(`/api/kit/rechercher?q=${encodeURIComponent(query.trim())}`);
      setResults(data.data || []);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return;
      message.error(e instanceof ApiError ? e.message : 'Erreur lors de la recherche');
    } finally {
      setSearching(false);
    }
  };

  const statutAffichage = (row: ResultatEtudiantKit): { label: string; tone: StatusTone } => {
    if (row.suspendu) return { label: 'Module suspendu', tone: 'warning' };
    if (row.statut === 'KIT_PAYE') return { label: 'Payé', tone: 'success' };
    if (row.statut === 'KIT_APPORTE') return { label: 'Apporté', tone: 'info' };
    return { label: 'Non traité', tone: 'danger' };
  };

  // ═══════════════════════════ Suivi des kits (liste + filtres + KPI) ═══════════════════════════
  const [academicYears, setAcademicYears] = useState<AnneeOption[]>([]);
  const [selectedAnneeId, setSelectedAnneeId] = useState<number | null>(null);

  const [lignesKit, setLignesKit] = useState<LigneKit[]>([]);
  const [totalKit, setTotalKit] = useState(0);
  const [loadingKit, setLoadingKit] = useState(false);
  const [pageKit, setPageKit] = useState(1);
  const [limitKit, setLimitKit] = useState(20);

  const [searchKit, setSearchKit] = useState('');
  const [searchKitDebounced, setSearchKitDebounced] = useState('');
  const [statutKit, setStatutKit] = useState<string | null>(null);
  const [dateType, setDateType] = useState<'depot' | 'paiement'>('depot');
  const [dateRangeKit, setDateRangeKit] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);
  const [filiereIdKit, setFiliereIdKit] = useState<number | null>(null);
  const [niveauIdKit, setNiveauIdKit] = useState<number | null>(null);
  const [groupeIdKit, setGroupeIdKit] = useState<number | null>(null);

  const [kpiKit, setKpiKit] = useState<KpiKit | null>(null);
  const [kpiKitLoading, setKpiKitLoading] = useState(false);
  const [exportingKitExcel, setExportingKitExcel] = useState(false);

  // Traitement depuis la liste de suivi — état séparé de `selected` (workflow de recherche
  // existant, inchangé) pour ne jamais mélanger les deux formes de données.
  const [selectedDepuisSuivi, setSelectedDepuisSuivi] = useState<{ id: number; nom: string; prenoms: string } | null>(null);

  // Filière/niveau réels (position académique de l'étudiant pour l'année sélectionnée) —
  // useEtudiantFilterOptions reste utilisé tel quel (inchangé) pour ces deux-là uniquement.
  const { filieres } = useEtudiantFilterOptions(selectedAnneeId);
  const niveauxDeLaFiliereKit = filiereIdKit ? filieres.find((f) => f.id === filiereIdKit)?.niveaux ?? [] : [];

  // Groupe : endpoint dédié GET /api/effectifs/groupes (Chantier "Filtre Groupe", 2026-09-07) —
  // remplace useEtudiantFilterOptions().groupes pour ce filtre uniquement (même endpoint et mêmes
  // raisons que SuiviDistributions.tsx : rôles Caisse non couverts par /api/decoupage/classes, et
  // groupes primaires inclus). Rechargé à chaque changement d'année ; le groupe déjà sélectionné
  // est systématiquement réinitialisé (invalide dès que l'année change).
  const [groupesAnneeKit, setGroupesAnneeKit] = useState<{ id: number; nom: string }[]>([]);
  const [loadingGroupesKit, setLoadingGroupesKit] = useState(false);

  useEffect(() => {
    setGroupeIdKit(null);
    if (!selectedAnneeId) { setGroupesAnneeKit([]); return; }
    setLoadingGroupesKit(true);
    apiFetch<{ data: { id: number; nom: string }[] }>(`/api/effectifs/groupes?anneeAcademiqueId=${selectedAnneeId}`)
      .then((res) => setGroupesAnneeKit(res.data || []))
      .catch(() => setGroupesAnneeKit([]))
      .finally(() => setLoadingGroupesKit(false));
  }, [selectedAnneeId]);

  const anneeCouranteId = academicYears.find((a) => a.etat === 'en cour' || a.etat === 'en cours')?.id ?? null;

  useEffect(() => {
    apiFetch<{ data: AnneeOption[] }>('/api/effectifs/annees-academiques')
      .then((res) => {
        const years = res.data || [];
        setAcademicYears(years);
        const currentYear = years.find((y) => y.etat === 'en cour' || y.etat === 'en cours');
        setSelectedAnneeId(currentYear ? currentYear.id : years[0]?.id ?? null);
      })
      .catch(() => setAcademicYears([]));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setSearchKitDebounced(searchKit), 400);
    return () => clearTimeout(t);
  }, [searchKit]);

  const buildParamsKit = useCallback((overrides: { page?: number; limit?: number; statut?: string | null | undefined } = {}) => {
    const params = new URLSearchParams();
    if (selectedAnneeId) params.set('anneeAcademiqueId', String(selectedAnneeId));
    params.set('page', String(overrides.page ?? pageKit));
    params.set('limit', String(overrides.limit ?? limitKit));
    if (searchKitDebounced.trim().length >= 2) params.set('search', searchKitDebounced.trim());
    const statutEffectif = overrides.statut !== undefined ? overrides.statut : statutKit;
    if (statutEffectif) params.set('statut', statutEffectif);
    params.set('dateType', dateType);
    if (dateRangeKit?.[0]) params.set('dateDebut', dateRangeKit[0].format('YYYY-MM-DD'));
    if (dateRangeKit?.[1]) params.set('dateFin', dateRangeKit[1].format('YYYY-MM-DD'));
    if (filiereIdKit) params.set('filiereId', String(filiereIdKit));
    if (niveauIdKit) params.set('niveauId', String(niveauIdKit));
    if (groupeIdKit) params.set('groupeId', String(groupeIdKit));
    return params;
  }, [selectedAnneeId, pageKit, limitKit, searchKitDebounced, statutKit, dateType, dateRangeKit, filiereIdKit, niveauIdKit, groupeIdKit]);

  const fetchListeKit = useCallback(() => {
    if (!selectedAnneeId) return;
    setLoadingKit(true);
    apiFetch<{ data: LigneKit[]; pagination: { page: number; limit: number; total: number } }>(
      `/api/kit/liste?${buildParamsKit().toString()}`
    )
      .then((res) => { setLignesKit(res.data); setTotalKit(res.pagination.total); })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) return;
        message.error(e instanceof ApiError ? e.message : 'Erreur lors du chargement du suivi des kits');
      })
      .finally(() => setLoadingKit(false));
  }, [selectedAnneeId, buildParamsKit]);

  useEffect(() => { fetchListeKit(); }, [fetchListeKit]);

  // KPI — reflète le périmètre filtré COMPLET (année/type+plage de date/filière/niveau/groupe/
  // recherche), indépendamment du statut sélectionné et de la pagination affichée. Comme pour le
  // suivi des distributions : `pagination.total` de l'API (jamais data.length), 4 appels légers
  // (limit=1) plutôt qu'un calcul approximatif sur la page courante — aucun agrégat par statut
  // n'existe encore côté backend pour /kit/liste (voir rapport final).
  const fetchKpiKit = useCallback(() => {
    if (!selectedAnneeId) return;
    setKpiKitLoading(true);
    const total_ = apiFetch<{ pagination: { total: number } }>(`/api/kit/liste?${buildParamsKit({ page: 1, limit: 1, statut: null }).toString()}`);
    const parStatut = STATUTS_KIT_POSSIBLES.map((s) =>
      apiFetch<{ pagination: { total: number } }>(`/api/kit/liste?${buildParamsKit({ page: 1, limit: 1, statut: s }).toString()}`)
    );
    Promise.all([total_, ...parStatut])
      .then(([resTotal, resNonDepose, resApporte, resPaye]) => {
        setKpiKit({
          total: resTotal.pagination.total,
          nonDepose: resNonDepose.pagination.total,
          apporte: resApporte.pagination.total,
          paye: resPaye.pagination.total,
        });
      })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) return;
        setKpiKit(null);
      })
      .finally(() => setKpiKitLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAnneeId, searchKitDebounced, dateType, dateRangeKit, filiereIdKit, niveauIdKit, groupeIdKit]);

  useEffect(() => { fetchKpiKit(); }, [fetchKpiKit]);

  const handleTableChangeKit = (pagination: TablePaginationConfig) => {
    setPageKit(pagination.current || 1);
    setLimitKit(pagination.pageSize || 20);
  };

  // Export — respecte EXACTEMENT les filtres actifs, jamais la seule page affichée. Même stratégie
  // que HistoriqueDistributions.tsx::fetchToutPourExport (limite large, un seul appel).
  const fetchToutPourExportKit = async (): Promise<LigneKit[]> => {
    const params = buildParamsKit({ page: 1, limit: 10000 });
    const res = await apiFetch<{ data: LigneKit[] }>(`/api/kit/liste?${params.toString()}`);
    return res.data;
  };

  const handleExportKitExcel = async () => {
    setExportingKitExcel(true);
    try {
      const data = await fetchToutPourExportKit();
      if (data.length === 0) { message.warning('Aucune donnée à exporter'); return; }
      const anneeLabel = academicYears.find((a) => a.id === selectedAnneeId)?.annee ?? '';
      const headerRow = ['N°', 'Matricule IIPEA', 'Nom & Prénoms', 'Filière', 'Niveau', 'Groupe', 'Statut Kit', 'Date dépôt', 'Paiement', 'Montant', 'Date paiement', 'N° reçu', 'Mode paiement', 'Traité par'];
      const dataRows = data.map((l, i) => [
        i + 1, l.matricule_iipea, `${l.nom} ${l.prenoms}`, l.filiere, l.niveau, l.groupe ?? '—',
        LIBELLE_STATUT_KIT[l.statut_kit] ?? l.statut_kit,
        l.date_depot ? new Date(l.date_depot).toLocaleDateString('fr-FR') : '—',
        l.paiement ? 'Oui' : 'Non',
        l.montant !== null ? l.montant : '—',
        l.date_paiement ? new Date(l.date_paiement).toLocaleDateString('fr-FR') : '—',
        l.numero_recu ?? '—',
        l.mode_paiement ?? '—',
        l.traite_par_nom ?? '—',
      ]);
      const ws = XLSX.utils.aoa_to_sheet([['SUIVI DES KITS — CAISSE'], [`Année académique : ${anneeLabel}`], [], headerRow, ...dataRows]);
      ws['!cols'] = [{ wch: 5 }, { wch: 16 }, { wch: 26 }, { wch: 30 }, { wch: 14 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 24 }, { wch: 14 }, { wch: 20 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Suivi kits');
      XLSX.writeFile(wb, `suivi_kits_${anneeLabel || 'annee'}.xlsx`);
      message.success(`${data.length} ligne(s) exportée(s) en Excel`);
    } catch {
      message.error("Erreur lors de l'export Excel");
    } finally {
      setExportingKitExcel(false);
    }
  };

  const columnsKit = [
    { title: 'N°', key: 'numero', width: 60, render: (_: any, __: LigneKit, index: number) => (pageKit - 1) * limitKit + index + 1 },
    { title: 'Matricule IIPEA', dataIndex: 'matricule_iipea', key: 'matricule_iipea' },
    { title: 'Nom & Prénoms', key: 'nom', render: (_: any, r: LigneKit) => `${r.nom} ${r.prenoms}` },
    { title: 'Filière', dataIndex: 'filiere', key: 'filiere' },
    { title: 'Niveau', dataIndex: 'niveau', key: 'niveau' },
    { title: 'Groupe', dataIndex: 'groupe', key: 'groupe', render: (v: string | null) => v ?? <span style={{ color: 'var(--text-soft)' }}>—</span> },
    {
      title: 'Statut Kit', dataIndex: 'statut_kit', key: 'statut_kit',
      render: (v: string) => <StatusTag tone={TONE_STATUT_KIT[v] ?? 'neutral'} label={LIBELLE_STATUT_KIT[v] ?? v} />,
    },
    {
      title: 'Date dépôt', dataIndex: 'date_depot', key: 'date_depot',
      render: (v: string | null) => v ? new Date(v).toLocaleDateString('fr-FR') : <span style={{ color: 'var(--text-soft)' }}>—</span>,
    },
    {
      title: 'Paiement', dataIndex: 'paiement', key: 'paiement', align: 'center' as const,
      render: (v: boolean) => v ? <StatusTag tone="success" label="Oui" /> : <span style={{ color: 'var(--text-soft)' }}>—</span>,
    },
    {
      title: 'Montant', dataIndex: 'montant', key: 'montant', align: 'right' as const,
      render: (v: number | null) => v !== null ? `${v.toLocaleString('fr-FR')} FCFA` : <span style={{ color: 'var(--text-soft)' }}>—</span>,
    },
    {
      title: 'Date paiement', dataIndex: 'date_paiement', key: 'date_paiement',
      render: (v: string | null) => v ? new Date(v).toLocaleDateString('fr-FR') : <span style={{ color: 'var(--text-soft)' }}>—</span>,
    },
    {
      title: 'N° reçu', dataIndex: 'numero_recu', key: 'numero_recu',
      render: (v: string | null) => v ?? <span style={{ color: 'var(--text-soft)' }}>—</span>,
    },
    {
      title: 'Mode paiement', dataIndex: 'mode_paiement', key: 'mode_paiement',
      render: (v: string | null) => v ?? <span style={{ color: 'var(--text-soft)' }}>—</span>,
    },
    {
      title: 'Traité par', dataIndex: 'traite_par_nom', key: 'traite_par_nom',
      render: (v: string | null) => v ?? <span style={{ color: 'var(--text-soft)' }}>—</span>,
    },
    ...(peutTraiter ? [{
      title: 'Action', key: 'action_suivi',
      render: (_: any, r: LigneKit) => {
        // traiterKit agit toujours sur la position COURANTE de l'étudiant (etudiant.annee_academique_id,
        // jamais un paramètre d'année) — l'action n'a donc de sens que sur l'année "en cours" affichée
        // ici, jamais sur une année historique consultée via ce même tableau.
        const surAnneeCourante = anneeCouranteId !== null && selectedAnneeId === anneeCouranteId;
        const traitable = surAnneeCourante && r.statut_kit === 'NON_DEPOSE';
        return (
          <Button type="primary" size="small" disabled={!traitable} onClick={() => setSelectedDepuisSuivi({ id: r.id, nom: r.nom, prenoms: r.prenoms })}>
            Traiter
          </Button>
        );
      },
    }] : []),
  ];

  return (
    <div style={{ padding: 24 }}>
      <PageHeader />

      <PageContainer title="Suivi des kits" description="Étudiants inscrits, dépôt et paiement du Kit — Caisse">
        <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
          <Col xs={24} sm={12} md={6}>
            <Card><Statistic loading={kpiKitLoading} title="Total étudiants" value={kpiKit?.total ?? 0} prefix={<TeamOutlined style={{ color: 'var(--mod-scolarite)' }} />} /></Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card><Statistic loading={kpiKitLoading} title="Non déposés" value={kpiKit?.nonDepose ?? 0} prefix={<CloseCircleOutlined style={{ color: 'var(--danger)' }} />} /></Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card><Statistic loading={kpiKitLoading} title="Kits apportés" value={kpiKit?.apporte ?? 0} prefix={<TagsOutlined style={{ color: 'var(--warning)' }} />} /></Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card><Statistic loading={kpiKitLoading} title="Kits payés" value={kpiKit?.paye ?? 0} prefix={<CheckCircleOutlined style={{ color: 'var(--success)' }} />} /></Card>
          </Col>
        </Row>

        <DataTable<LigneKit>
          columns={columnsKit}
          dataSource={lignesKit}
          rowKey="id"
          loading={loadingKit}
          onChange={handleTableChangeKit}
          pagination={{ current: pageKit, pageSize: limitKit, total: totalKit, showSizeChanger: true }}
          searchValue={searchKit}
          searchPlaceholder="Matricule IIPEA, nom ou prénom"
          onSearchChange={(v) => { setSearchKit(v); setPageKit(1); }}
          filters={
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Select value={selectedAnneeId ?? undefined} onChange={(v) => { setSelectedAnneeId(v); setPageKit(1); }} style={{ width: 150 }} placeholder="Année académique">
                {academicYears.map((a) => <Option key={a.id} value={a.id}>{a.annee}</Option>)}
              </Select>
              <Select allowClear placeholder="Statut Kit" style={{ width: 160 }} value={statutKit ?? undefined} onChange={(v) => { setStatutKit(v ?? null); setPageKit(1); }}>
                {STATUTS_KIT_POSSIBLES.map((s) => <Option key={s} value={s}>{LIBELLE_STATUT_KIT[s]}</Option>)}
              </Select>
              <Select value={dateType} onChange={(v) => { setDateType(v); setPageKit(1); }} style={{ width: 130 }}>
                <Option value="depot">Type : Dépôt</Option>
                <Option value="paiement">Type : Paiement</Option>
              </Select>
              <RangePicker
                value={dateRangeKit as any}
                onChange={(d) => { setDateRangeKit(d as any); setPageKit(1); }}
                allowEmpty={[true, true]}
                placeholder={['Date début', 'Date fin']}
              />
              <Select
                allowClear showSearch optionFilterProp="children" placeholder="Filière" style={{ width: 200 }}
                value={filiereIdKit ?? undefined}
                onChange={(v) => { setFiliereIdKit(v ?? null); setNiveauIdKit(null); setPageKit(1); }}
              >
                {filieres.map((f) => <Option key={f.id} value={f.id}>{f.nom}</Option>)}
              </Select>
              <Select
                allowClear showSearch optionFilterProp="children" placeholder="Niveau" style={{ width: 160 }}
                value={niveauIdKit ?? undefined} disabled={!filiereIdKit}
                onChange={(v) => { setNiveauIdKit(v ?? null); setPageKit(1); }}
              >
                {niveauxDeLaFiliereKit.map((n) => <Option key={n.id} value={n.id}>{n.libelle}</Option>)}
              </Select>
              <Select
                allowClear showSearch optionFilterProp="children" placeholder="Groupe" style={{ width: 180 }}
                value={groupeIdKit ?? undefined} loading={loadingGroupesKit}
                onChange={(v) => { setGroupeIdKit(v ?? null); setPageKit(1); }}
              >
                {groupesAnneeKit.map((g) => <Option key={g.id} value={g.id}>{g.nom}</Option>)}
              </Select>
            </div>
          }
          toolbarExtra={
            <Space>
              <Button icon={<FileExcelOutlined />} loading={exportingKitExcel} onClick={handleExportKitExcel}>Exporter Excel</Button>
            </Space>
          }
          emptyTitle="Aucun étudiant ne correspond aux filtres sélectionnés"
        />
      </PageContainer>

      {/* ═══════════════════════════ Recherche / traitement Kit (existant, inchangé) ═══════════════════════════ */}
      <div style={{ padding: '0 24px 24px' }}>
        <Card title="Rechercher un étudiant déjà inscrit" style={{ marginBottom: 24 }}>
          <Input.Search
            placeholder="Nom, prénom ou matricule IIPEA"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onSearch={handleSearch}
            enterButton={<Button type="primary" icon={<SearchOutlined />} loading={searching}>Rechercher</Button>}
            style={{ maxWidth: 500 }}
          />
        </Card>

        {searched && (
          <Card>
            <Table<ResultatEtudiantKit>
              rowKey="id"
              loading={searching}
              dataSource={results}
              locale={{ emptyText: 'Aucun étudiant trouvé' }}
              pagination={false}
              columns={[
                {
                  title: 'Étudiant',
                  key: 'etudiant',
                  render: (_, row) => (
                    <div>
                      <Text strong>{row.nom} {row.prenoms}</Text>
                      <br />
                      <Text type="secondary">{row.matricule_iipea}</Text>
                    </div>
                  ),
                },
                { title: 'École', dataIndex: 'ecole', key: 'ecole', render: (v) => v || '—' },
                { title: 'Filière', dataIndex: 'filiere', key: 'filiere' },
                { title: 'Niveau', dataIndex: 'niveau', key: 'niveau' },
                { title: 'Année académique', dataIndex: 'annee_academique', key: 'annee_academique' },
                {
                  title: 'Statut Kit',
                  key: 'statut',
                  render: (_, row) => {
                    const { label, tone } = statutAffichage(row);
                    return <StatusTag tone={tone} label={label} />;
                  },
                },
                {
                  title: 'Action',
                  key: 'action',
                  render: (_, row) => {
                    const traitable = !row.suspendu && row.statut === 'NON_TRAITE';
                    if (!peutTraiter) return null;
                    return (
                      <Button
                        type="primary"
                        size="small"
                        disabled={!traitable}
                        onClick={() => setSelected(row)}
                      >
                        Régulariser
                      </Button>
                    );
                  },
                },
              ]}
            />
          </Card>
        )}

        {!searched && (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-soft)' }}>
            <Title level={5} type="secondary">Recherchez un étudiant pour régulariser son Kit</Title>
            <Text type="secondary">Par nom, prénom ou matricule IIPEA — année académique courante</Text>
          </div>
        )}
      </div>

      <Modal
        open={!!selected}
        onCancel={() => { setSelected(null); handleSearch(); }}
        footer={null}
        title={selected ? `Kit — ${selected.nom} ${selected.prenoms}` : ''}
        destroyOnClose
      >
        {selected && (
          <KitTraitement
            etudiantId={selected.id}
            onTraite={() => { setSelected(null); handleSearch(); }}
          />
        )}
      </Modal>

      <Modal
        open={!!selectedDepuisSuivi}
        onCancel={() => { setSelectedDepuisSuivi(null); fetchListeKit(); fetchKpiKit(); }}
        footer={null}
        title={selectedDepuisSuivi ? `Kit — ${selectedDepuisSuivi.nom} ${selectedDepuisSuivi.prenoms}` : ''}
        destroyOnClose
      >
        {selectedDepuisSuivi && (
          <KitTraitement
            etudiantId={selectedDepuisSuivi.id}
            onTraite={() => { setSelectedDepuisSuivi(null); fetchListeKit(); fetchKpiKit(); }}
          />
        )}
      </Modal>
    </div>
  );
};

export default GestionKits;
