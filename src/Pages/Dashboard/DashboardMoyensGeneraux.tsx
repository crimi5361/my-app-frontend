import { useCallback, useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Select, Table, Tag, Spin, Empty, Typography, Alert, Space, Drawer, Button, message } from 'antd';
import {
  TeamOutlined, GiftOutlined, CheckCircleOutlined, HourglassOutlined,
  WarningOutlined, InboxOutlined, DatabaseOutlined, DollarOutlined, SwapOutlined, StopOutlined,
} from '@ant-design/icons';
import PageHeader from '../../Components/PageHeader/PageHeader';
import AccesRestreint from '../../Components/ui/AccesRestreint';
import { apiFetch, ApiError } from '../../lib/api';
import { hasPermission } from '../../lib/permissions';
import { useEtudiantFilterOptions } from '../../lib/useEtudiantFilterOptions';

const { Text } = Typography;
const { Option } = Select;

interface AcademicYear {
  id: number;
  annee: string;
  etat: string;
}

interface DashboardMoyensGenerauxData {
  etudiants: {
    total_inscrits: number;
    par_ecole: { ecole: string; total: number }[];
    par_filiere: { filiere: string; total: number }[];
    par_niveau: { niveau: string; total: number }[];
  };
  distribution: {
    etudiants_servis: number;
    etudiants_restants: number;
    taux_couverture: number;
    repartition_par_accessoire: { accessoire: string; total: number }[];
  };
  mouvementsRecents: { type: string; quantite: number; date: string; accessoire: string; effectue_par: string }[];
}

// Refonte tableau de bord Moyens Généraux (2026-08-20) — stock détaillé par article, reconstruit
// depuis le grand-livre (GET /stock/articles/detail), jamais un second calcul côté frontend.
interface StockArticleDetail {
  accessoire_id: number;
  code: string;
  nom: string;
  categorie_id: number | null;
  categorie_nom: string | null;
  stock_initial: number;
  recu: number;
  distribue_gratuit: number;
  distribue_surplus: number;
  distribue_total: number;
  transfere_sortant: number;
  transfere_entrant: number;
  transferts_par_site: { site_id: number; site_nom: string; quantite: number }[];
  restant: number;
  cout_unitaire_reference: number | null;
  valeur_stock: number | null;
  seuil_alerte: number;
  statut: 'normal' | 'stock_faible' | 'rupture';
  epuise: boolean;
}

interface StockKpis {
  nombre_articles: number;
  quantite_totale_stock: number;
  valeur_totale_stock: number;
  articles_bientot_epuises: number;
  articles_epuises: number;
  quantite_distribuee_totale: number;
  quantite_transferee_totale: number;
}

interface CategorieOption { id: number; nom: string; }
interface AccessoireOption { id: number; nom: string; actif: boolean; }

// Chantier "Suivi des accessoires par niveau" (2026-09-08) — tableau croisé niveau × accessoire,
// GET /api/moyens-generaux/distribution/statistiques-par-niveau. Une ligne = un LIBELLÉ de niveau
// (jamais un niveau_id : un même libellé existe sur plusieurs filières, voir le backend) ; une
// cellule vaut `null` quand l'accessoire n'est pas prévu (regle_distribution_accessoire) pour ce
// niveau, ou un nombre (peut être 0) quand il l'est.
interface AccessoireColonne { id: number; nom: string; }
interface NiveauStatLigne {
  niveau: string;
  inscrits: number;
  accessoires: Record<number, number | null>;
}
interface StatistiquesAccessoiresNiveau {
  accessoires: AccessoireColonne[];
  niveaux: NiveauStatLigne[];
}
interface NonRecuperateurLigne {
  matricule_iipea: string;
  nom: string;
  prenoms: string;
  telephone: string | null;
  filiere: string;
  niveau: string;
  groupe: string | null;
}

const TYPE_LABEL: Record<string, string> = {
  reception: 'Réception',
  distribution: 'Distribution',
  ajustement_positif: 'Ajustement (+)',
  ajustement_negatif: 'Ajustement (-)',
  transfert_sortant: 'Transfert sortant',
  transfert_entrant: 'Transfert entrant',
};

const STATUT_STOCK_TAG: Record<StockArticleDetail['statut'], { color: string; label: string }> = {
  normal: { color: 'success', label: 'Disponible' },
  stock_faible: { color: 'warning', label: 'Stock faible' },
  rupture: { color: 'error', label: 'Épuisé' },
};

const formatFCFA = (v: number) => `${v.toLocaleString('fr-FR')} FCFA`;

const getUserInfo = () => {
  try {
    const userStr = localStorage.getItem('user');
    if (!userStr) return null;
    const user = JSON.parse(userStr);
    if (!user.departement_id) {
      const deptId = localStorage.getItem('departement_id');
      if (deptId) user.departement_id = parseInt(deptId, 10);
    }
    return user;
  } catch {
    return null;
  }
};

const DashboardMoyensGeneraux = () => {
  const currentUser = getUserInfo();
  const departementId = currentUser?.departement_id;

  // Correction 2026-08-21 : le détail du stock exige stock.voir, une permission DISTINCTE et NON
  // impliquée par dashboard.voir (architecture de permissions individuelles, Phase 1) — un agent
  // peut légitimement avoir le dashboard sans avoir le stock (cas réel : dadju@iipea.com, qui n'a
  // que dashboard.voir + distribution.*). Gater cette section sur sa propre permission, jamais sur
  // celle de la page globale, pour ne jamais appeler un endpoint auquel l'utilisateur n'a pas droit.
  const peutVoirStock = hasPermission('stock.voir');

  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [selectedYearId, setSelectedYearId] = useState<number | null>(null);
  const [data, setData] = useState<DashboardMoyensGenerauxData | null>(null);
  const [loadingYears, setLoadingYears] = useState(true);
  const [loadingStats, setLoadingStats] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stock détaillé — indépendant de l'année académique sélectionnée : le grand-livre
  // (réceptions/transferts/ajustements) n'a pas de notion d'année académique, seule la
  // distribution en a une (déjà filtrée par année dans le bloc "Étudiants" ci-dessus). Le stock
  // restant/valorisé est toujours "à l'instant présent", jamais borné à une année.
  const [categories, setCategories] = useState<CategorieOption[]>([]);
  const [accessoiresOptions, setAccessoiresOptions] = useState<AccessoireOption[]>([]);
  const [articles, setArticles] = useState<StockArticleDetail[]>([]);
  const [kpis, setKpis] = useState<StockKpis | null>(null);
  const [loadingStock, setLoadingStock] = useState(false);
  // Erreur SCOPÉE à cette seule section (jamais le state `error` global, qui bloque toute la page)
  // — une section optionnelle en échec ne doit jamais empêcher les autres de s'afficher.
  const [stockError, setStockError] = useState<string | null>(null);
  const [filtreCategorie, setFiltreCategorie] = useState<number | 'toutes'>('toutes');
  const [filtreAccessoire, setFiltreAccessoire] = useState<number | 'tous'>('tous');
  const [filtreStatutStock, setFiltreStatutStock] = useState<StockArticleDetail['statut'] | 'tous'>('tous');

  useEffect(() => {
    if (!departementId) {
      setError('Site non trouvé. Veuillez vous reconnecter.');
      setLoadingYears(false);
      return;
    }
    apiFetch<AcademicYear[]>(`/api/annees?site_id=${departementId}`)
      .then((years) => {
        setAcademicYears(years);
        const currentYear = years.find((y) => y.etat === 'en cour' || y.etat === 'en cours');
        setSelectedYearId(currentYear ? currentYear.id : years[0]?.id ?? null);
      })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) return;
        setError("Impossible de charger les années académiques.");
      })
      .finally(() => setLoadingYears(false));
  }, [departementId]);

  const fetchStats = useCallback(() => {
    if (!selectedYearId || !hasPermission('dashboard.voir')) return;
    setLoadingStats(true);
    apiFetch<{ data: DashboardMoyensGenerauxData }>(`/api/dashboard/moyens-generaux/stats?anneeAcademiqueId=${selectedYearId}`)
      .then((res) => setData(res.data))
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) return;
        setError('Impossible de charger le tableau de bord.');
      })
      .finally(() => setLoadingStats(false));
  }, [selectedYearId]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    // categories-accessoire/accessoires n'alimentent que les filtres de cette section — inutile de
    // les appeler si la section elle-même restera masquée.
    if (!peutVoirStock) return;
    apiFetch<{ data: CategorieOption[] }>('/api/moyens-generaux/categories-accessoire').then((r) => setCategories(r.data)).catch(() => {});
    apiFetch<{ data: AccessoireOption[] }>('/api/moyens-generaux/accessoires').then((r) => setAccessoiresOptions(r.data.filter((a) => a.actif))).catch(() => {});
  }, [peutVoirStock]);

  const fetchStockDetail = useCallback(() => {
    if (!peutVoirStock) return;
    setLoadingStock(true);
    setStockError(null);
    const params = new URLSearchParams();
    if (filtreCategorie !== 'toutes') params.set('categorie_id', String(filtreCategorie));
    if (filtreAccessoire !== 'tous') params.set('accessoire_id', String(filtreAccessoire));
    if (filtreStatutStock !== 'tous') params.set('statut', filtreStatutStock);
    apiFetch<{ data: { kpis: StockKpis; articles: StockArticleDetail[] } }>(`/api/moyens-generaux/stock/articles/detail?${params.toString()}`)
      .then((res) => { setKpis(res.data.kpis); setArticles(res.data.articles); })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) return;
        // Section scopée : jamais setError (page globale) — une permission manquante ou un échec
        // ponctuel de cette seule section ne doit jamais faire tomber le reste du dashboard.
        setStockError('Impossible de charger le détail du stock.');
      })
      .finally(() => setLoadingStock(false));
  }, [filtreCategorie, filtreAccessoire, filtreStatutStock, peutVoirStock]);

  useEffect(() => {
    fetchStockDetail();
  }, [fetchStockDetail]);

  // ─── Suivi des accessoires par niveau (2026-09-08) ─────────────────────────────────────────
  // Scopée sur distribution.voir (même permission que /suivi et /historique), indépendante de
  // stock.voir — un agent peut légitimement avoir l'une sans l'autre.
  const peutVoirStatsNiveau = hasPermission('distribution.voir');
  const [statsNiveau, setStatsNiveau] = useState<StatistiquesAccessoiresNiveau | null>(null);
  const [loadingStatsNiveau, setLoadingStatsNiveau] = useState(false);
  const [statsNiveauError, setStatsNiveauError] = useState<string | null>(null);
  const [filtreFiliereStatsId, setFiltreFiliereStatsId] = useState<number | null>(null);
  const [filtreNiveauStatsId, setFiltreNiveauStatsId] = useState<number | null>(null);

  // Filière/niveau réels de l'année sélectionnée — même hook, même patron que
  // Pages/MoyensGeneraux/SuiviDistributions.tsx (cascade filière → niveaux de cette filière).
  const { filieres: filieresStats } = useEtudiantFilterOptions(selectedYearId);
  const niveauxDeLaFiliereStats = filtreFiliereStatsId
    ? filieresStats.find((f) => f.id === filtreFiliereStatsId)?.niveaux ?? []
    : [];

  useEffect(() => {
    setFiltreFiliereStatsId(null);
    setFiltreNiveauStatsId(null);
  }, [selectedYearId]);

  const fetchStatsNiveau = useCallback(() => {
    if (!selectedYearId || !peutVoirStatsNiveau) return;
    setLoadingStatsNiveau(true);
    setStatsNiveauError(null);
    const params = new URLSearchParams({ anneeAcademiqueId: String(selectedYearId) });
    if (filtreFiliereStatsId) params.set('filiereId', String(filtreFiliereStatsId));
    if (filtreNiveauStatsId) params.set('niveauId', String(filtreNiveauStatsId));
    apiFetch<{ data: StatistiquesAccessoiresNiveau }>(`/api/moyens-generaux/distribution/statistiques-par-niveau?${params.toString()}`)
      .then((res) => setStatsNiveau(res.data))
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) return;
        setStatsNiveauError('Impossible de charger le suivi des accessoires par niveau.');
      })
      .finally(() => setLoadingStatsNiveau(false));
  }, [selectedYearId, filtreFiliereStatsId, filtreNiveauStatsId, peutVoirStatsNiveau]);

  useEffect(() => {
    fetchStatsNiveau();
  }, [fetchStatsNiveau]);

  const [nonRecupOpen, setNonRecupOpen] = useState(false);
  const [nonRecupLoading, setNonRecupLoading] = useState(false);
  const [nonRecupTitre, setNonRecupTitre] = useState('');
  const [nonRecupListe, setNonRecupListe] = useState<NonRecuperateurLigne[]>([]);

  const ouvrirNonRecuperateurs = (niveauLibelle: string, accessoireId: number, accessoireNom: string) => {
    if (!selectedYearId) return;
    setNonRecupTitre(`Étudiants n'ayant pas récupéré ${accessoireNom} — ${niveauLibelle}`);
    setNonRecupOpen(true);
    setNonRecupLoading(true);
    setNonRecupListe([]);
    const params = new URLSearchParams({
      anneeAcademiqueId: String(selectedYearId),
      niveau: niveauLibelle,
      accessoireId: String(accessoireId),
    });
    if (filtreFiliereStatsId) params.set('filiereId', String(filtreFiliereStatsId));
    apiFetch<{ data: NonRecuperateurLigne[] }>(`/api/moyens-generaux/distribution/non-recuperateurs?${params.toString()}`)
      .then((res) => setNonRecupListe(res.data))
      .catch(() => message.error("Impossible de charger la liste des étudiants n'ayant pas récupéré cet accessoire."))
      .finally(() => setNonRecupLoading(false));
  };

  if (loadingYears) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <PageHeader />
        <Spin size="large" style={{ marginTop: 80 }} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <PageHeader />
        <Alert message="Erreur" description={error} type="error" showIcon />
      </div>
    );
  }

  // Permission individuelle (Chantier Moyens Généraux, Phase 1) — le backend revalide de toute
  // façon chaque requête ; ce masquage n'est qu'une amélioration d'ergonomie.
  if (!hasPermission('dashboard.voir')) {
    return (
      <div style={{ padding: 24 }}>
        <PageHeader />
        <AccesRestreint description="Vous n'avez pas la permission de consulter le tableau de bord Moyens Généraux." />
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <PageHeader />

      <Card style={{ marginBottom: 24 }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Text strong style={{ fontSize: 18 }}><GiftOutlined /> Dashboard Moyens Généraux</Text>
            <div><Text type="secondary">Stock et distribution des accessoires institutionnels — votre site.</Text></div>
          </Col>
          <Col>
            <Select value={selectedYearId} onChange={setSelectedYearId} style={{ width: 220 }}>
              {academicYears.map((y) => (
                <Option key={y.id} value={y.id}>{y.annee} ({y.etat})</Option>
              ))}
            </Select>
          </Col>
        </Row>
      </Card>

      {loadingStats || !data ? (
        <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
      ) : (
        <>
          {/* Couverture de distribution (bornée à l'année académique sélectionnée) */}
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={6}>
              <Card><Statistic title="Étudiants inscrits" value={data.etudiants.total_inscrits} prefix={<TeamOutlined style={{ color: 'var(--mod-scolarite)' }} />} /></Card>
            </Col>
            <Col span={6}>
              <Card><Statistic title="Ayant reçu leurs accessoires" value={data.distribution.etudiants_servis} prefix={<CheckCircleOutlined style={{ color: 'var(--success)' }} />} /></Card>
            </Col>
            <Col span={6}>
              <Card><Statistic title="Restant à servir" value={data.distribution.etudiants_restants} prefix={<HourglassOutlined style={{ color: 'var(--warning)' }} />} /></Card>
            </Col>
            <Col span={6}>
              <Card><Statistic title="Taux de couverture" value={data.distribution.taux_couverture} suffix="%" /></Card>
            </Col>
          </Row>
        </>
      )}

      {/* ─── Suivi du stock (indépendant de l'année académique) ─────────────────────────────────
          Masquée entièrement si l'utilisateur n'a pas stock.voir (ex. dadju@iipea.com : dashboard +
          distribution uniquement) — jamais un appel réseau voué à un 403, jamais une erreur bloquant
          le reste du dashboard pour une permission simplement absente, volontairement. */}
      {peutVoirStock && (
      <Card
        title={<span><DatabaseOutlined /> Suivi du stock</span>}
        style={{ marginBottom: 24 }}
        extra={<Text type="secondary" style={{ fontSize: 12 }}>Reconstruit depuis le grand-livre des mouvements — toujours à jour</Text>}
      >
        {stockError ? (
          <Alert type="warning" showIcon message={stockError} />
        ) : loadingStock && !kpis ? (
          <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
        ) : kpis && (
          <>
            <Row gutter={16} style={{ marginBottom: 20 }}>
              <Col span={6}><Card size="small"><Statistic title="Articles" value={kpis.nombre_articles} prefix={<InboxOutlined />} /></Card></Col>
              <Col span={6}><Card size="small"><Statistic title="Quantité totale en stock" value={kpis.quantite_totale_stock} /></Card></Col>
              <Col span={6}><Card size="small"><Statistic title="Valeur totale du stock" value={kpis.valeur_totale_stock} formatter={(v) => formatFCFA(Number(v))} prefix={<DollarOutlined style={{ color: 'var(--success)' }} />} /></Card></Col>
              <Col span={6}><Card size="small"><Statistic title="Quantité distribuée" value={kpis.quantite_distribuee_totale} prefix={<GiftOutlined style={{ color: 'var(--mod-scolarite)' }} />} /></Card></Col>
            </Row>
            <Row gutter={16} style={{ marginBottom: 20 }}>
              <Col span={6}><Card size="small"><Statistic title="Bientôt épuisés" value={kpis.articles_bientot_epuises} valueStyle={{ color: kpis.articles_bientot_epuises > 0 ? 'var(--warning)' : undefined }} prefix={<WarningOutlined />} /></Card></Col>
              <Col span={6}><Card size="small"><Statistic title="Épuisés" value={kpis.articles_epuises} valueStyle={{ color: kpis.articles_epuises > 0 ? 'var(--danger)' : undefined }} prefix={<StopOutlined />} /></Card></Col>
              <Col span={12}><Card size="small"><Statistic title="Quantité transférée vers d'autres sites" value={kpis.quantite_transferee_totale} prefix={<SwapOutlined style={{ color: 'var(--mod-administration)' }} />} /></Card></Col>
            </Row>

            {(kpis.articles_bientot_epuises > 0 || kpis.articles_epuises > 0) && (
              <Alert
                type="warning"
                showIcon
                icon={<WarningOutlined />}
                style={{ marginBottom: 16 }}
                message="Des articles nécessitent votre attention"
                description={articles
                  .filter((a) => a.statut !== 'normal')
                  .map((a) => `${a.nom} (${a.restant} restant${a.statut === 'rupture' ? ', épuisé' : `, seuil ${a.seuil_alerte}`})`)
                  .join(' · ')}
              />
            )}

            <Space wrap style={{ marginBottom: 16 }}>
              <Select value={filtreCategorie} onChange={setFiltreCategorie} style={{ width: 200 }} placeholder="Catégorie">
                <Option value="toutes">Toutes les catégories</Option>
                {categories.map((c) => <Option key={c.id} value={c.id}>{c.nom}</Option>)}
              </Select>
              <Select value={filtreAccessoire} onChange={setFiltreAccessoire} style={{ width: 220 }} placeholder="Article" showSearch optionFilterProp="children">
                <Option value="tous">Tous les articles</Option>
                {accessoiresOptions.map((a) => <Option key={a.id} value={a.id}>{a.nom}</Option>)}
              </Select>
              <Select value={filtreStatutStock} onChange={setFiltreStatutStock} style={{ width: 180 }} placeholder="Statut du stock">
                <Option value="tous">Tous les statuts</Option>
                <Option value="normal">Disponible</Option>
                <Option value="stock_faible">Stock faible</Option>
                <Option value="rupture">Épuisé</Option>
              </Select>
            </Space>

            <Table<StockArticleDetail>
              dataSource={articles}
              rowKey="accessoire_id"
              size="small"
              loading={loadingStock}
              pagination={{ pageSize: 10, showTotal: (t) => `${t} article(s)` }}
              scroll={{ x: 'max-content' }}
              locale={{ emptyText: <Empty description="Aucun article ne correspond à ces filtres" /> }}
              expandable={{
                rowExpandable: (r) => r.transferts_par_site.length > 0,
                expandedRowRender: (r) => (
                  <div style={{ padding: '4px 0' }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>Transféré vers :</Text>{' '}
                    {r.transferts_par_site.map((t) => (
                      <Tag key={t.site_id} style={{ marginLeft: 4 }}>{t.site_nom} : {t.quantite}</Tag>
                    ))}
                  </div>
                ),
              }}
              columns={[
                { title: 'Article', dataIndex: 'nom', fixed: 'left', width: 200 },
                { title: 'Catégorie', dataIndex: 'categorie_nom', render: (v: string | null) => v ?? <Text type="secondary">—</Text> },
                { title: 'Stock initial', dataIndex: 'stock_initial', align: 'right' as const },
                { title: 'Reçu', dataIndex: 'recu', align: 'right' as const },
                { title: 'Distribué (gratuit)', dataIndex: 'distribue_gratuit', align: 'right' as const },
                { title: 'Accessoire vendu', dataIndex: 'distribue_surplus', align: 'right' as const },
                { title: 'Transféré', dataIndex: 'transfere_sortant', align: 'right' as const },
                {
                  title: 'Restant', dataIndex: 'restant', align: 'right' as const,
                  render: (v: number) => <strong>{v}</strong>,
                },
                { title: 'Prix achat', dataIndex: 'cout_unitaire_reference', align: 'right' as const, render: (v: number | null) => v !== null ? formatFCFA(v) : <Text type="secondary">—</Text> },
                { title: 'Valeur stock', dataIndex: 'valeur_stock', align: 'right' as const, render: (v: number | null) => v !== null ? formatFCFA(v) : <Text type="secondary">—</Text> },
                {
                  title: 'Statut', dataIndex: 'statut', align: 'center' as const,
                  render: (v: StockArticleDetail['statut']) => <Tag color={STATUT_STOCK_TAG[v].color}>{STATUT_STOCK_TAG[v].label}</Tag>,
                },
              ]}
            />
          </>
        )}
      </Card>
      )}

      {/* ─── Suivi des accessoires par niveau (2026-09-08) ───────────────────────────────────────
          Card autonome, distincte de "Suivi du stock" — tableau croisé niveau × accessoire, colonnes
          dynamiques (accessoires réellement configurés). Cliquer un chiffre ouvre le détail des
          étudiants n'ayant pas encore récupéré cet accessoire à ce niveau. */}
      {peutVoirStatsNiveau && (
      <Card
        title={<span><TeamOutlined /> Suivi des accessoires par niveau</span>}
        style={{ marginBottom: 24 }}
        extra={<Text type="secondary" style={{ fontSize: 12 }}>Étudiants ayant récupéré chaque accessoire — cliquez un chiffre pour voir qui ne l'a pas encore reçu</Text>}
      >
        <Space wrap style={{ marginBottom: 16 }}>
          <Select
            allowClear
            placeholder="Toutes les filières"
            style={{ width: 240 }}
            value={filtreFiliereStatsId ?? undefined}
            onChange={(v) => { setFiltreFiliereStatsId(v ?? null); setFiltreNiveauStatsId(null); }}
            showSearch
            optionFilterProp="children"
          >
            {filieresStats.map((f) => <Option key={f.id} value={f.id}>{f.nom}</Option>)}
          </Select>
          <Select
            allowClear
            placeholder="Tous les niveaux"
            style={{ width: 200 }}
            value={filtreNiveauStatsId ?? undefined}
            onChange={(v) => setFiltreNiveauStatsId(v ?? null)}
            disabled={!filtreFiliereStatsId}
          >
            {niveauxDeLaFiliereStats.map((n) => <Option key={n.id} value={n.id}>{n.libelle}</Option>)}
          </Select>
        </Space>

        {statsNiveauError ? (
          <Alert type="warning" showIcon message={statsNiveauError} />
        ) : (
          <Table<NiveauStatLigne>
            dataSource={statsNiveau?.niveaux ?? []}
            rowKey="niveau"
            size="small"
            loading={loadingStatsNiveau}
            pagination={false}
            scroll={{ x: 'max-content' }}
            locale={{ emptyText: <Empty description="Aucune donnée pour cette sélection" /> }}
            columns={[
              { title: 'Niveau', dataIndex: 'niveau', fixed: 'left' as const, width: 160 },
              { title: 'Inscrits', dataIndex: 'inscrits', align: 'right' as const, width: 100 },
              ...(statsNiveau?.accessoires ?? []).map((acc) => ({
                title: acc.nom,
                key: `acc-${acc.id}`,
                align: 'right' as const,
                render: (_: unknown, record: NiveauStatLigne) => {
                  const valeur = record.accessoires[acc.id];
                  if (valeur === null || valeur === undefined) {
                    return <Text type="secondary">—</Text>;
                  }
                  return (
                    <Button type="link" size="small" onClick={() => ouvrirNonRecuperateurs(record.niveau, acc.id, acc.nom)}>
                      {valeur}
                    </Button>
                  );
                },
              })),
            ]}
          />
        )}
      </Card>
      )}

      {/* Mouvements récents — journal brut, complète le tableau agrégé ci-dessus */}
      {data && (
        <Card title="Mouvements récents">
          <Table
            dataSource={data.mouvementsRecents}
            rowKey={(r, i) => `${r.type}-${r.date}-${i}`}
            size="small"
            pagination={false}
            locale={{ emptyText: 'Aucun mouvement de stock enregistré pour l\'instant' }}
            columns={[
              { title: 'Type', dataIndex: 'type', render: (v: string) => <Tag>{TYPE_LABEL[v] ?? v}</Tag> },
              { title: 'Accessoire', dataIndex: 'accessoire' },
              { title: 'Quantité', dataIndex: 'quantite', align: 'right' },
              { title: 'Effectué par', dataIndex: 'effectue_par' },
              { title: 'Date', dataIndex: 'date', render: (v: string) => new Date(v).toLocaleString('fr-FR') },
            ]}
          />
        </Card>
      )}

      <Drawer title={nonRecupTitre} open={nonRecupOpen} onClose={() => setNonRecupOpen(false)} width={560}>
        {nonRecupLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
        ) : nonRecupListe.length === 0 ? (
          <Empty description="Tous les étudiants concernés ont récupéré cet accessoire" />
        ) : (
          <Table<NonRecuperateurLigne>
            dataSource={nonRecupListe}
            rowKey="matricule_iipea"
            size="small"
            pagination={false}
            columns={[
              { title: 'Matricule', dataIndex: 'matricule_iipea' },
              { title: 'Nom & Prénoms', render: (_: unknown, r: NonRecuperateurLigne) => `${r.nom} ${r.prenoms}` },
              { title: 'Téléphone', dataIndex: 'telephone', render: (v: string | null) => v ?? '—' },
              { title: 'Filière', dataIndex: 'filiere' },
              { title: 'Groupe', dataIndex: 'groupe', render: (v: string | null) => v ?? '—' },
            ]}
          />
        )}
      </Drawer>
    </div>
  );
};

export default DashboardMoyensGeneraux;
