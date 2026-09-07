/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from "react";
import { Select, DatePicker, Button, Row, Col, Card, Statistic, message, Space } from "antd";
import type { TablePaginationConfig } from "antd";
import { FileExcelOutlined, TeamOutlined, CheckCircleOutlined, ClockCircleOutlined, ExclamationCircleOutlined, MinusCircleOutlined } from "@ant-design/icons";
import * as XLSX from "xlsx";
import dayjs from "dayjs";
import PageHeader from "../../Components/PageHeader/PageHeader";
import PageContainer from "../../Components/ui/PageContainer";
import DataTable from "../../Components/ui/DataTable";
import StatusTag, { StatusTone } from "../../Components/ui/StatusTag";
import AccesRestreint from "../../Components/ui/AccesRestreint";
import { apiFetch, ApiError } from "../../lib/api";
import { hasPermission } from "../../lib/permissions";
import { useEtudiantFilterOptions } from "../../lib/useEtudiantFilterOptions";

const { Option } = Select;
const { RangePicker } = DatePicker;

// Chantier "Suivi des distributions" — Phase 2 frontend (2026-09-07), suite de la Phase 1 backend
// (services/distributionSuivi.service.js, controllers/distribution.controller.js::getSuivi).
// Page NOUVELLE et INDÉPENDANTE de HistoriqueDistributions.tsx (journal des remises effectuées,
// inchangé) — celle-ci part des étudiants inscrits (vue_position_academique côté backend), pas des
// remises, pour répondre à "qui n'a pas encore récupéré ses accessoires".
//
// Statuts affichés — valeurs EXACTES renvoyées par l'API, jamais reformulées côté logique :
const LIBELLE_STATUT: Record<string, string> = {
  NON_RECUPERE: "Non récupéré",
  PARTIELLEMENT_RECUPERE: "Partiellement récupéré",
  RECUPERE: "Récupéré",
  AUCUN_ACCESSOIRE_PREVU: "Aucun accessoire prévu",
};
const TONE_STATUT: Record<string, StatusTone> = {
  NON_RECUPERE: "danger",
  PARTIELLEMENT_RECUPERE: "warning",
  RECUPERE: "success",
  AUCUN_ACCESSOIRE_PREVU: "neutral",
};
const STATUTS_POSSIBLES = ["NON_RECUPERE", "PARTIELLEMENT_RECUPERE", "RECUPERE", "AUCUN_ACCESSOIRE_PREVU"];

interface AnneeOption { id: number; annee: string; etat: string | null; }

interface LigneSuivi {
  id: number;
  matricule_iipea: string;
  nom: string;
  prenoms: string;
  telephone: string | null;
  filiere: string;
  niveau: string;
  groupe: string | null;
  accessoires_dus: number;
  accessoires_recus: number;
  date_remise: string | null;
  agent_remise: string | null;
  statut_distribution: string;
}

interface Kpi {
  total: number;
  recupere: number;
  partiel: number;
  nonRecupere: number;
  aucunPrevu: number;
}

const SuiviDistributions = () => {
  const [academicYears, setAcademicYears] = useState<AnneeOption[]>([]);
  const [selectedAnneeId, setSelectedAnneeId] = useState<number | null>(null);

  const [lignes, setLignes] = useState<LigneSuivi[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);
  const [statut, setStatut] = useState<string | null>(null);
  const [filiereId, setFiliereId] = useState<number | null>(null);
  const [niveauId, setNiveauId] = useState<number | null>(null);
  const [groupeId, setGroupeId] = useState<number | null>(null);

  const [kpi, setKpi] = useState<Kpi | null>(null);
  const [kpiLoading, setKpiLoading] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);

  // Filière/niveau réels (position académique de l'étudiant pour l'année sélectionnée) — jamais
  // les libellés figés de l'ancien historique. useEtudiantFilterOptions reste utilisé tel quel
  // (inchangé) pour filières/niveaux, qui fonctionnent déjà correctement pour tous les rôles.
  const { filieres } = useEtudiantFilterOptions(selectedAnneeId);
  const niveauxDeLaFiliere = filiereId ? filieres.find((f) => f.id === filiereId)?.niveaux ?? [] : [];

  // Groupe : endpoint dédié GET /api/effectifs/groupes (Chantier "Filtre Groupe", 2026-09-07) —
  // remplace useEtudiantFilterOptions().groupes pour ce filtre uniquement. Contrairement au hook
  // (alimenté par /api/decoupage/classes, réservé à 'admin' et excluant les groupes primaires),
  // cet endpoint est accessible aux 5 rôles des deux écrans et inclut les groupes primaires —
  // indispensable : sur les données réelles actuelles, la quasi-totalité des groupes existants SONT
  // des groupes primaires. Dépend de l'année sélectionnée : rechargé à chaque changement d'année,
  // et le groupe déjà sélectionné est systématiquement réinitialisé (un groupe d'une autre année
  // n'a plus aucun sens dans ce filtre).
  const [groupesAnnee, setGroupesAnnee] = useState<{ id: number; nom: string }[]>([]);
  const [loadingGroupes, setLoadingGroupes] = useState(false);

  useEffect(() => {
    setGroupeId(null);
    if (!selectedAnneeId) { setGroupesAnnee([]); return; }
    setLoadingGroupes(true);
    apiFetch<{ data: { id: number; nom: string }[] }>(`/api/effectifs/groupes?anneeAcademiqueId=${selectedAnneeId}`)
      .then((res) => setGroupesAnnee(res.data || []))
      .catch(() => setGroupesAnnee([]))
      .finally(() => setLoadingGroupes(false));
  }, [selectedAnneeId]);

  useEffect(() => {
    apiFetch<{ data: AnneeOption[] }>("/api/effectifs/annees-academiques")
      .then((res) => {
        const years = res.data || [];
        setAcademicYears(years);
        const currentYear = years.find((y) => y.etat === "en cour" || y.etat === "en cours");
        setSelectedAnneeId(currentYear ? currentYear.id : years[0]?.id ?? null);
      })
      .catch(() => setAcademicYears([]));
  }, []);

  // Recherche debouncée (400ms) — évite une requête à chaque frappe.
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const buildParams = useCallback((overrides: { page?: number; limit?: number; statut?: string | null | undefined } = {}) => {
    const params = new URLSearchParams();
    if (selectedAnneeId) params.set("anneeAcademiqueId", String(selectedAnneeId));
    params.set("page", String(overrides.page ?? page));
    params.set("limit", String(overrides.limit ?? limit));
    if (searchDebounced.trim().length >= 2) params.set("search", searchDebounced.trim());
    if (dateRange?.[0]) params.set("dateDebut", dateRange[0].format("YYYY-MM-DD"));
    if (dateRange?.[1]) params.set("dateFin", dateRange[1].format("YYYY-MM-DD"));
    const statutEffectif = overrides.statut !== undefined ? overrides.statut : statut;
    if (statutEffectif) params.set("statut", statutEffectif);
    if (filiereId) params.set("filiereId", String(filiereId));
    if (niveauId) params.set("niveauId", String(niveauId));
    if (groupeId) params.set("groupeId", String(groupeId));
    return params;
  }, [selectedAnneeId, page, limit, searchDebounced, dateRange, statut, filiereId, niveauId, groupeId]);

  const fetchListe = useCallback(() => {
    if (!selectedAnneeId) return;
    setLoading(true);
    apiFetch<{ data: LigneSuivi[]; pagination: { page: number; limit: number; total: number } }>(
      `/api/moyens-generaux/distribution/suivi?${buildParams().toString()}`
    )
      .then((res) => { setLignes(res.data); setTotal(res.pagination.total); })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) return;
        message.error(e instanceof ApiError ? e.message : "Erreur lors du chargement du suivi des distributions");
      })
      .finally(() => setLoading(false));
  }, [selectedAnneeId, buildParams]);

  useEffect(() => { fetchListe(); }, [fetchListe]);

  // KPI — reflète le périmètre filtré COMPLET (année/dates/filière/niveau/groupe/recherche),
  // indépendamment du statut sélectionné et de la pagination de l'écran. `pagination.total` de
  // l'API (jamais data.length) est la seule source utilisée pour chaque compteur — 5 appels légers
  // (limit=1) plutôt qu'un calcul approximatif sur la seule page courante. Voir rapport final :
  // aucun agrégat par statut n'existe encore côté backend pour économiser ces 5 appels en un seul.
  const fetchKpi = useCallback(() => {
    if (!selectedAnneeId) return;
    setKpiLoading(true);
    const total_ = apiFetch<{ pagination: { total: number } }>(`/api/moyens-generaux/distribution/suivi?${buildParams({ page: 1, limit: 1, statut: null }).toString()}`);
    const parStatut = STATUTS_POSSIBLES.map((s) =>
      apiFetch<{ pagination: { total: number } }>(`/api/moyens-generaux/distribution/suivi?${buildParams({ page: 1, limit: 1, statut: s }).toString()}`)
    );
    Promise.all([total_, ...parStatut])
      .then(([resTotal, resNonRecup, resPartiel, resRecup, resAucun]) => {
        setKpi({
          total: resTotal.pagination.total,
          nonRecupere: resNonRecup.pagination.total,
          partiel: resPartiel.pagination.total,
          recupere: resRecup.pagination.total,
          aucunPrevu: resAucun.pagination.total,
        });
      })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) return;
        setKpi(null);
      })
      .finally(() => setKpiLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAnneeId, searchDebounced, dateRange, filiereId, niveauId, groupeId]);

  useEffect(() => { fetchKpi(); }, [fetchKpi]);

  const handleTableChange = (pagination: TablePaginationConfig) => {
    setPage(pagination.current || 1);
    setLimit(pagination.pageSize || 20);
  };

  // Export — respecte EXACTEMENT les filtres actifs (année/dates/statut/filière/niveau/groupe/
  // recherche), jamais la seule page affichée. Limite large en un seul appel, même stratégie que
  // HistoriqueDistributions.tsx::fetchToutPourExport (l'endpoint /suivi n'impose aucun plafond
  // serveur sur `limit`).
  const fetchToutPourExport = async (): Promise<LigneSuivi[]> => {
    const params = buildParams({ page: 1, limit: 10000 });
    const res = await apiFetch<{ data: LigneSuivi[] }>(`/api/moyens-generaux/distribution/suivi?${params.toString()}`);
    return res.data;
  };

  const handleExportExcel = async () => {
    setExportingExcel(true);
    try {
      const data = await fetchToutPourExport();
      if (data.length === 0) { message.warning("Aucune donnée à exporter"); return; }
      const anneeLabel = academicYears.find((a) => a.id === selectedAnneeId)?.annee ?? "";
      const headerRow = ["N°", "Matricule IIPEA", "Nom & Prénoms", "Téléphone", "Filière", "Niveau", "Groupe", "Accessoires dus", "Accessoires reçus", "Statut", "Date de remise", "Agent"];
      const dataRows = data.map((l, i) => [
        i + 1, l.matricule_iipea, `${l.nom} ${l.prenoms}`, l.telephone ?? "—", l.filiere, l.niveau, l.groupe ?? "—",
        l.accessoires_dus, l.accessoires_recus, LIBELLE_STATUT[l.statut_distribution] ?? l.statut_distribution,
        l.date_remise ? new Date(l.date_remise).toLocaleString("fr-FR") : "—", l.agent_remise ?? "—",
      ]);
      const ws = XLSX.utils.aoa_to_sheet([["SUIVI DES DISTRIBUTIONS — MOYENS GÉNÉRAUX"], [`Année académique : ${anneeLabel}`], [], headerRow, ...dataRows]);
      ws["!cols"] = [{ wch: 5 }, { wch: 16 }, { wch: 26 }, { wch: 16 }, { wch: 30 }, { wch: 14 }, { wch: 20 }, { wch: 12 }, { wch: 14 }, { wch: 22 }, { wch: 18 }, { wch: 20 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Suivi distributions");
      XLSX.writeFile(wb, `suivi_distributions_${anneeLabel || "annee"}.xlsx`);
      message.success(`${data.length} ligne(s) exportée(s) en Excel`);
    } catch {
      message.error("Erreur lors de l'export Excel");
    } finally {
      setExportingExcel(false);
    }
  };

  const columns = [
    { title: "N°", key: "numero", width: 60, render: (_: any, __: LigneSuivi, index: number) => (page - 1) * limit + index + 1 },
    { title: "Matricule IIPEA", dataIndex: "matricule_iipea", key: "matricule_iipea" },
    { title: "Nom & Prénoms", key: "nom", render: (_: any, r: LigneSuivi) => `${r.nom} ${r.prenoms}` },
    { title: "Téléphone", dataIndex: "telephone", key: "telephone", render: (v: string | null) => v || <span style={{ color: "var(--text-soft)" }}>—</span> },
    { title: "Filière", dataIndex: "filiere", key: "filiere" },
    { title: "Niveau", dataIndex: "niveau", key: "niveau" },
    { title: "Groupe", dataIndex: "groupe", key: "groupe", render: (v: string | null) => v ?? <span style={{ color: "var(--text-soft)" }}>—</span> },
    {
      title: "Accessoires", key: "accessoires", align: "center" as const,
      render: (_: any, r: LigneSuivi) => `${r.accessoires_recus} / ${r.accessoires_dus}`,
    },
    {
      title: "Statut", dataIndex: "statut_distribution", key: "statut_distribution",
      render: (v: string) => <StatusTag tone={TONE_STATUT[v] ?? "neutral"} label={LIBELLE_STATUT[v] ?? v} />,
    },
    {
      title: "Date de remise", dataIndex: "date_remise", key: "date_remise",
      render: (v: string | null) => v ? new Date(v).toLocaleString("fr-FR") : <span style={{ color: "var(--text-soft)" }}>—</span>,
    },
    {
      title: "Agent", dataIndex: "agent_remise", key: "agent_remise",
      render: (v: string | null) => v ?? <span style={{ color: "var(--text-soft)" }}>—</span>,
    },
  ];

  if (!hasPermission("distribution.voir")) {
    return (
      <div>
        <PageHeader />
        <AccesRestreint description="Vous n'avez pas la permission de consulter le suivi des distributions." />
      </div>
    );
  }

  return (
    <div>
      <PageHeader />
      <PageContainer title="Suivi des distributions" description="Étudiants inscrits, accessoires reçus ou à récupérer — Moyens Généraux">
        <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
          <Col xs={24} sm={12} md={4}>
            <Card><Statistic loading={kpiLoading} title="Total étudiants" value={kpi?.total ?? 0} prefix={<TeamOutlined style={{ color: "var(--mod-scolarite)" }} />} /></Card>
          </Col>
          <Col xs={24} sm={12} md={5}>
            <Card><Statistic loading={kpiLoading} title="Récupérés" value={kpi?.recupere ?? 0} prefix={<CheckCircleOutlined style={{ color: "var(--success)" }} />} /></Card>
          </Col>
          <Col xs={24} sm={12} md={5}>
            <Card><Statistic loading={kpiLoading} title="Partiellement récupérés" value={kpi?.partiel ?? 0} prefix={<ClockCircleOutlined style={{ color: "var(--warning)" }} />} /></Card>
          </Col>
          <Col xs={24} sm={12} md={5}>
            <Card><Statistic loading={kpiLoading} title="Non récupérés" value={kpi?.nonRecupere ?? 0} prefix={<ExclamationCircleOutlined style={{ color: "var(--danger)" }} />} /></Card>
          </Col>
          <Col xs={24} sm={12} md={5}>
            <Card><Statistic loading={kpiLoading} title="Aucun accessoire prévu" value={kpi?.aucunPrevu ?? 0} prefix={<MinusCircleOutlined style={{ color: "var(--text-soft)" }} />} /></Card>
          </Col>
        </Row>

        <DataTable<LigneSuivi>
          columns={columns}
          dataSource={lignes}
          rowKey="id"
          loading={loading}
          onChange={handleTableChange}
          pagination={{ current: page, pageSize: limit, total, showSizeChanger: true }}
          searchValue={search}
          searchPlaceholder="Matricule IIPEA, nom ou prénom"
          onSearchChange={(v) => { setSearch(v); setPage(1); }}
          filters={
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Select value={selectedAnneeId ?? undefined} onChange={(v) => { setSelectedAnneeId(v); setPage(1); }} style={{ width: 150 }} placeholder="Année académique">
                {academicYears.map((a) => <Option key={a.id} value={a.id}>{a.annee}</Option>)}
              </Select>
              <RangePicker
                value={dateRange as any}
                onChange={(d) => { setDateRange(d as any); setPage(1); }}
                allowEmpty={[true, true]}
                placeholder={["Date début", "Date fin"]}
              />
              <Select allowClear placeholder="Statut" style={{ width: 190 }} value={statut ?? undefined} onChange={(v) => { setStatut(v ?? null); setPage(1); }}>
                {STATUTS_POSSIBLES.map((s) => <Option key={s} value={s}>{LIBELLE_STATUT[s]}</Option>)}
              </Select>
              <Select
                allowClear showSearch optionFilterProp="children" placeholder="Filière" style={{ width: 200 }}
                value={filiereId ?? undefined}
                onChange={(v) => { setFiliereId(v ?? null); setNiveauId(null); setPage(1); }}
              >
                {filieres.map((f) => <Option key={f.id} value={f.id}>{f.nom}</Option>)}
              </Select>
              <Select
                allowClear showSearch optionFilterProp="children" placeholder="Niveau" style={{ width: 160 }}
                value={niveauId ?? undefined} disabled={!filiereId}
                onChange={(v) => { setNiveauId(v ?? null); setPage(1); }}
              >
                {niveauxDeLaFiliere.map((n) => <Option key={n.id} value={n.id}>{n.libelle}</Option>)}
              </Select>
              <Select
                allowClear showSearch optionFilterProp="children" placeholder="Groupe" style={{ width: 180 }}
                value={groupeId ?? undefined} loading={loadingGroupes}
                onChange={(v) => { setGroupeId(v ?? null); setPage(1); }}
              >
                {groupesAnnee.map((g) => <Option key={g.id} value={g.id}>{g.nom}</Option>)}
              </Select>
            </div>
          }
          toolbarExtra={
            <Space>
              <Button icon={<FileExcelOutlined />} loading={exportingExcel} onClick={handleExportExcel}>Exporter Excel</Button>
            </Space>
          }
          emptyTitle="Aucun étudiant ne correspond aux filtres sélectionnés"
        />
      </PageContainer>
    </div>
  );
};

export default SuiviDistributions;
