import { useState, useEffect, useCallback, useMemo, useRef, Fragment } from 'react';
import {
  App,
  Select,
  Table,
  Input,
  Button,
  Card,
  Avatar,
  Tag,
  Empty,
  Modal,
  Alert,
  Tooltip,
  Spin,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  UserOutlined,
  PrinterOutlined,
  EyeOutlined,
  LeftOutlined,
  RightOutlined,
  FilterOutlined,
  SearchOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import PageHeader from '../../Components/PageHeader/PageHeader';
import { CarteRecto, CarteVerso, CARTE_LARGEUR_MM, CARTE_HAUTEUR_MM } from '../../Components/CarteEtudiante/CarteEtudiante';
import {
  chargerConfiguration,
  chargerAnnees,
  chargerEcoles,
  chargerFilieres,
  chargerNiveaux,
  chargerGroupes,
  chargerEtudiants,
  chargerLot,
  ecrireDocumentImpression,
  injecterStylesCartes,
  type CarteEtudianteData,
  type ConfigurationCartes,
  type OptionAnnee,
  type OptionEcole,
  type OptionFiliere,
  type OptionNiveau,
  type OptionGroupe,
  type Filtres,
} from '../../lib/cartesEtudiantes';

/**
 * Cartes étudiantes — génération et impression en masse (scolarité).
 *
 * Le rendu des cartes n'est pas réimplémenté ici : `CarteRecto` / `CarteVerso`
 * sont les composants partagés avec l'espace étudiant. L'aperçu est donc, par
 * construction, le rendu imprimé — et non une approximation.
 *
 * L'impression produit UN seul onglet, quel que soit le nombre d'étudiants, et
 * exactement deux pages par étudiant : recto puis verso.
 */

const MM_EN_PX = 96 / 25.4;
const ECHELLE_APERCU = 2.4;

/* ⚠️ Enveloppe <App> obligatoire : sous React 19, les méthodes statiques d'antd
   (message.*, Modal.*) n'affichent rien, et `App.useApp()` hors de ce fournisseur
   renvoie des objets inertes — `message.success` n'y est même pas une fonction.
   Même convention que RecusGroupe.tsx et AttestationsMasse.tsx. */
const CartesEtudiantes = () => (
  <App>
    <CartesEtudiantesContent />
  </App>
);

const CartesEtudiantesContent = () => {
  const { message } = App.useApp();

  const [configuration, setConfiguration] = useState<ConfigurationCartes | null>(null);
  const [annees, setAnnees] = useState<OptionAnnee[]>([]);
  const [ecoles, setEcoles] = useState<OptionEcole[]>([]);
  const [filieres, setFilieres] = useState<OptionFiliere[]>([]);
  const [niveaux, setNiveaux] = useState<OptionNiveau[]>([]);
  const [groupes, setGroupes] = useState<OptionGroupe[]>([]);
  // Le libellé sélectionné, séparé des identifiants : un même libellé de niveau
  // recouvre plusieurs `niveau.id`, et la liste déroulante n'en manipule qu'un.
  const [niveauLibelle, setNiveauLibelle] = useState<string | null>(null);
  // Photos référencées en base mais introuvables sur le serveur. Comptées à
  // partir des vignettes de la liste, qui chargent les mêmes URL que les cartes.
  const [photosIntrouvables, setPhotosIntrouvables] = useState<Set<number>>(new Set());

  const [filtres, setFiltres] = useState<Filtres>({
    annee_id: null,
    ecole_id: null,
    filiere_id: null,
    niveau_ids: null,
    groupe_id: null,
  });

  const [etudiants, setEtudiants] = useState<CarteEtudianteData[]>([]);
  const [selection, setSelection] = useState<number[]>([]);
  const [recherche, setRecherche] = useState('');
  const [chargementListe, setChargementListe] = useState(false);
  const [chargementFiltres, setChargementFiltres] = useState(true);

  const [apercuOuvert, setApercuOuvert] = useState(false);
  const [indexApercu, setIndexApercu] = useState(0);

  // Lot préparé pour l'impression : rempli au moment de générer, puis vidé.
  const [lot, setLot] = useState<CarteEtudianteData[]>([]);
  const [generation, setGeneration] = useState(false);
  const zoneImpressionRef = useRef<HTMLDivElement>(null);
  const fenetreEnAttente = useRef<Window | null>(null);

  // ── Chargements ───────────────────────────────────────────────────────────

  useEffect(() => {
    injecterStylesCartes();
    (async () => {
      try {
        const [config, listeAnnees] = await Promise.all([chargerConfiguration(), chargerAnnees()]);
        setConfiguration(config);
        setAnnees(listeAnnees);
        // L'année la plus récente est présélectionnée : c'est celle pour
        // laquelle on imprime des cartes dans la quasi-totalité des cas.
        if (listeAnnees.length > 0) {
          setFiltres((f) => ({ ...f, annee_id: listeAnnees[0].id }));
        }
      } catch (e) {
        message.error(e instanceof Error ? e.message : 'Erreur de chargement.');
      } finally {
        setChargementFiltres(false);
      }
    })();
  }, [message]);

  // Filtres en cascade : chaque changement vide les niveaux inférieurs, sans
  // quoi on pourrait demander une filière qui n'appartient pas à l'école
  // choisie et obtenir une liste vide sans comprendre pourquoi.
  useEffect(() => {
    if (!filtres.annee_id) return;
    (async () => {
      try {
        setEcoles(await chargerEcoles(filtres.annee_id));
      } catch (e) {
        message.error(e instanceof Error ? e.message : 'Erreur de chargement des écoles.');
      }
    })();
  }, [filtres.annee_id, message]);

  useEffect(() => {
    if (!filtres.annee_id) return;
    (async () => {
      try {
        setFilieres(await chargerFilieres(filtres.annee_id, filtres.ecole_id));
      } catch (e) {
        message.error(e instanceof Error ? e.message : 'Erreur de chargement des filières.');
      }
    })();
  }, [filtres.annee_id, filtres.ecole_id, message]);

  useEffect(() => {
    if (!filtres.annee_id) return;
    (async () => {
      try {
        setNiveaux(await chargerNiveaux(filtres.annee_id, filtres.ecole_id, filtres.filiere_id));
      } catch (e) {
        message.error(e instanceof Error ? e.message : 'Erreur de chargement des niveaux.');
      }
    })();
  }, [filtres.annee_id, filtres.ecole_id, filtres.filiere_id, message]);

  // Cinquième échelon : les groupes dépendent de tout ce qui précède.
  useEffect(() => {
    if (!filtres.annee_id) return;
    (async () => {
      try {
        setGroupes(
          await chargerGroupes(filtres.annee_id, filtres.ecole_id, filtres.filiere_id, filtres.niveau_ids)
        );
      } catch (e) {
        message.error(e instanceof Error ? e.message : 'Erreur de chargement des groupes.');
      }
    })();
  }, [filtres.annee_id, filtres.ecole_id, filtres.filiere_id, filtres.niveau_ids, message]);

  const chargerListe = useCallback(async () => {
    if (!filtres.annee_id) return;
    setChargementListe(true);
    try {
      const reponse = await chargerEtudiants(filtres, recherche || undefined);
      setEtudiants(reponse.data);
      setPhotosIntrouvables(new Set());
      // La sélection est restreinte aux étudiants encore présents : changer de
      // filtre ne doit pas conserver en mémoire des étudiants invisibles, qui
      // seraient imprimés sans que l'agent les ait vus.
      setSelection((s) => s.filter((id) => reponse.data.some((e) => e.etudiant_id === id)));
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erreur de chargement des étudiants.');
      setEtudiants([]);
    } finally {
      setChargementListe(false);
    }
  }, [filtres, recherche, message]);

  useEffect(() => {
    const minuterie = setTimeout(chargerListe, recherche ? 350 : 0);
    return () => clearTimeout(minuterie);
  }, [chargerListe, recherche]);

  // ── Changement de filtre ──────────────────────────────────────────────────

  /**
   * Chaque échelon vide ceux qui le suivent. Sans cela, on pourrait demander un
   * groupe qui n'appartient pas à la filière choisie et obtenir une liste vide
   * sans comprendre pourquoi.
   */
  const majFiltre = (cle: keyof Filtres, valeur: number | number[] | null) => {
    setFiltres((f) => {
      const suivant = { ...f, [cle]: valeur } as Filtres;
      if (cle === 'annee_id') {
        suivant.ecole_id = null;
        suivant.filiere_id = null;
        suivant.niveau_ids = null;
        suivant.groupe_id = null;
      }
      if (cle === 'ecole_id') {
        suivant.filiere_id = null;
        suivant.niveau_ids = null;
        suivant.groupe_id = null;
      }
      if (cle === 'filiere_id') {
        suivant.niveau_ids = null;
        suivant.groupe_id = null;
      }
      if (cle === 'niveau_ids') suivant.groupe_id = null;
      return suivant;
    });
    if (cle !== 'niveau_ids' && cle !== 'groupe_id') setNiveauLibelle(null);
    setSelection([]);
  };

  /** Le niveau se choisit par libellé ; on envoie tous les identifiants associés. */
  const choisirNiveau = (libelle: string | null) => {
    setNiveauLibelle(libelle);
    const trouve = niveaux.find((n) => n.libelle === libelle);
    majFiltre('niveau_ids', trouve ? trouve.ids : null);
  };

  // ── Génération ────────────────────────────────────────────────────────────

  const preparerLot = useCallback(
    async (ids?: number[]) => {
      setGeneration(true);
      try {
        // La recherche accompagne le lot : sans elle, « imprimer tous les
        // étudiants filtrés » réclamerait toute la population alors que l'agent
        // n'a sous les yeux que le résultat de sa recherche.
        const reponse = await chargerLot(filtres, ids, recherche || undefined);
        if (reponse.data.length === 0) {
          message.warning('Aucune carte à générer pour cette sélection.');
          return null;
        }
        setLot(reponse.data);
        return reponse;
      } catch (e) {
        message.error(e instanceof Error ? e.message : 'Erreur lors de la préparation du lot.');
        return null;
      } finally {
        setGeneration(false);
      }
    },
    [filtres, recherche, message]
  );

  /**
   * Génère et imprime. La fenêtre est ouverte AVANT tout `await` : passé un
   * appel réseau, le navigateur a perdu l'activation utilisateur et bloque
   * l'ouverture. Un seul onglet est ouvert, jamais un par étudiant.
   */
  const genererEtImprimer = useCallback(
    async (ids?: number[]) => {
      const fenetre = window.open('', '_blank');
      if (!fenetre) {
        message.error(
          "L'ouverture a été bloquée par le navigateur. Autorisez les fenêtres surgissantes, puis relancez."
        );
        return;
      }
      fenetre.document.write(
        '<p style="font-family:system-ui;padding:24px;color:#555">Préparation des cartes…</p>'
      );
      fenetreEnAttente.current = fenetre;

      const reponse = await preparerLot(ids);
      if (!reponse) {
        fenetre.close();
        fenetreEnAttente.current = null;
        return;
      }
      message.success(
        `${reponse.total} carte(s) — ${reponse.pages} pages (recto + verso)` +
          (reponse.sans_photo > 0 ? `, dont ${reponse.sans_photo} sans photo` : '')
      );
    },
    [preparerLot, message]
  );

  // Le lot est rendu hors écran, puis son HTML est recopié dans la fenêtre déjà
  // ouverte. Un effet est nécessaire : le DOM n'existe qu'après le rendu.
  useEffect(() => {
    const fenetre = fenetreEnAttente.current;
    if (!fenetre || lot.length === 0) return;
    fenetreEnAttente.current = null;

    const contenu = zoneImpressionRef.current?.innerHTML ?? '';
    if (!contenu) {
      fenetre.close();
      message.error('La préparation du document a échoué.');
      return;
    }
    // Le document d'attente est remplacé par le document final.
    fenetre.document.open();
    ecrireDocumentImpression(
      fenetre,
      `Cartes etudiantes (${lot.length})`,
      contenu,
      window.location.origin
    );
  }, [lot, message]);

  // ── Tableau ───────────────────────────────────────────────────────────────

  const colonnes: ColumnsType<CarteEtudianteData> = useMemo(
    () => [
      {
        title: 'Photo',
        key: 'photo',
        width: 70,
        align: 'center',
        render: (_, e) =>
          e.photo_url && !photosIntrouvables.has(e.etudiant_id) ? (
            // `onError` sert ici de sonde : la vignette charge exactement l'URL
            // que la carte utilisera. Un échec signifie que le fichier est
            // introuvable sur le serveur, et l'agent doit le savoir AVANT de
            // lancer l'impression d'un lot.
            <Avatar
              src={
                <img
                  src={e.photo_url}
                  alt=""
                  onError={() =>
                    setPhotosIntrouvables((p) => (p.has(e.etudiant_id) ? p : new Set(p).add(e.etudiant_id)))
                  }
                />
              }
              size={38}
            />
          ) : (
            <Tooltip title={e.photo_url ? 'Photo enregistrée mais introuvable sur le serveur' : 'Aucune photo enregistrée'}>
              <Avatar icon={<UserOutlined />} size={38} style={{ background: '#E6E8EB', color: '#9AA0A6' }} />
            </Tooltip>
          ),
      },
      {
        title: 'Nom et prénoms',
        key: 'identite',
        render: (_, e) => (
          <div>
            <div style={{ fontWeight: 600, color: '#1F2328' }}>{e.nom}</div>
            <div style={{ fontSize: 12, color: '#6B7280' }}>{e.prenoms}</div>
          </div>
        ),
      },
      {
        title: 'N° étudiant',
        dataIndex: 'numero_etudiant',
        key: 'numero',
        width: 160,
        render: (v: string | null) => (
          <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v || '—'}</span>
        ),
      },
      {
        title: 'École',
        key: 'ecole',
        width: 95,
        align: 'center',
        render: (_, e) => (
          <Tag
            style={{
              background: e.ecole.principal,
              color: '#fff',
              border: 'none',
              fontWeight: 700,
              borderRadius: 10,
            }}
          >
            {e.ecole.code}
          </Tag>
        ),
      },
      {
        title: 'Filière',
        dataIndex: 'filiere',
        key: 'filiere',
        ellipsis: true,
        render: (v: string | null) => <span style={{ fontSize: 12 }}>{v || '—'}</span>,
      },
      {
        title: 'Niveau',
        dataIndex: 'niveau',
        key: 'niveau',
        width: 120,
        render: (v: string | null) => <span style={{ fontSize: 12 }}>{v || '—'}</span>,
      },
      {
        title: 'Groupe',
        dataIndex: 'groupe',
        key: 'groupe',
        width: 150,
        ellipsis: true,
        render: (_: unknown, e: CarteEtudianteData) => (
          <Tooltip title={e.groupe || ''}>
            <span style={{ fontSize: 12, color: '#6B7280' }}>
              {/* Le nom complet reprend celui de la classe : on affiche la part
                  utile, le nom entier reste accessible au survol. */}
              {e.groupe && e.classe && e.groupe.startsWith(e.classe)
                ? e.groupe.slice(e.classe.length).trim() || e.groupe
                : e.groupe || '—'}
            </span>
          </Tooltip>
        ),
      },
      {
        title: 'Statut de la carte',
        key: 'statut',
        width: 190,
        render: (_, e) =>
          e.complete ? (
            <Tag color="green">Prête</Tag>
          ) : (
            <Tooltip title={`Manque : ${e.champs_manquants.join(', ')}`}>
              <Tag color="orange">
                Incomplète ({e.champs_manquants.length})
              </Tag>
            </Tooltip>
          ),
      },
      {
        title: '',
        key: 'apercu',
        width: 60,
        align: 'center',
        render: (_, e) => (
          <Tooltip title="Aperçu">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => {
                setIndexApercu(etudiants.findIndex((x) => x.etudiant_id === e.etudiant_id));
                setApercuOuvert(true);
              }}
            />
          </Tooltip>
        ),
      },
    ],
    [etudiants, photosIntrouvables]
  );

  const carteApercu = etudiants[indexApercu];
  const nbSelection = selection.length;
  const nbTotal = etudiants.length;
  const lotMax = configuration?.lot_max ?? 300;
  const nbSansPhoto = etudiants.filter((e) => !e.photo_url).length;

  // ── Rendu ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: '#F6F7FA', paddingBottom: 32 }}>
      <PageHeader />

      <div style={{ padding: '0 24px' }}>
        {/* Étape 1 — Filtres */}
        <Card
          size="small"
          style={{ borderRadius: 12, marginBottom: 16 }}
          title={
            <span style={{ fontSize: 13, fontWeight: 600 }}>
              <FilterOutlined /> Sélection de la population
            </span>
          }
        >
          <Spin spinning={chargementFiltres}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              <Select
                style={{ minWidth: 180 }}
                placeholder="Année académique"
                value={filtres.annee_id}
                onChange={(v) => majFiltre('annee_id', v)}
                options={annees.map((a) => ({ value: a.id, label: a.annee }))}
              />
              <Select
                allowClear
                style={{ minWidth: 230 }}
                placeholder="École (toutes)"
                value={filtres.ecole_id}
                onChange={(v) => majFiltre('ecole_id', v ?? null)}
                options={ecoles.map((e) => ({
                  value: e.id,
                  label: `${e.sigle} — ${e.nom} (${e.effectif})`,
                }))}
              />
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                style={{ minWidth: 280 }}
                placeholder="Filière (toutes)"
                value={filtres.filiere_id}
                onChange={(v) => majFiltre('filiere_id', v ?? null)}
                options={filieres.map((f) => ({
                  value: f.id,
                  label: `${f.sigle ? f.sigle + ' — ' : ''}${f.nom} (${f.effectif})`,
                }))}
              />
              <Select
                allowClear
                style={{ minWidth: 190 }}
                placeholder="Niveau (tous)"
                value={niveauLibelle}
                onChange={(v) => choisirNiveau(v ?? null)}
                options={niveaux.map((n) => ({
                  // La valeur est le LIBELLÉ : un même libellé recouvre plusieurs
                  // `niveau.id`, un par filière, et ils sont tous envoyés.
                  value: n.libelle,
                  label: `${n.libelle} (${n.effectif})`,
                }))}
              />
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                style={{ minWidth: 230 }}
                placeholder="Groupe (tous)"
                value={filtres.groupe_id}
                onChange={(v) => majFiltre('groupe_id', v ?? null)}
                options={groupes.map((g) => ({
                  value: g.id,
                  label: `${g.libelle} (${g.effectif})`,
                  title: g.nom_complet,
                }))}
                notFoundContent="Aucun groupe pour ces filtres"
              />
              <Input
                allowClear
                prefix={<SearchOutlined style={{ color: '#aaa' }} />}
                placeholder="Nom, prénoms, n° étudiant ou matricule IP"
                style={{ minWidth: 300, flex: 1 }}
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
              />
              <Button icon={<ReloadOutlined />} onClick={chargerListe}>
                Actualiser
              </Button>
            </div>
          </Spin>
        </Card>

        {/* Étape 3 — Actions */}
        <Card size="small" style={{ borderRadius: 12, marginBottom: 16 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 13, color: '#4B5563' }}>
              <b style={{ color: '#111' }}>{nbTotal}</b> étudiant(s) affiché(s)
              {nbSelection > 0 && (
                <>
                  {' · '}
                  <b style={{ color: '#111' }}>{nbSelection}</b> sélectionné(s)
                </>
              )}
              {' · '}
              <b style={{ color: '#111' }}>{(nbSelection || nbTotal) * 2}</b> pages seront générées
            </div>

            <div style={{ flex: 1 }} />

            <Button
              icon={<EyeOutlined />}
              disabled={nbTotal === 0}
              onClick={() => {
                setIndexApercu(0);
                setApercuOuvert(true);
              }}
            >
              Aperçu
            </Button>
            <Button
              type="primary"
              icon={<PrinterOutlined />}
              loading={generation}
              disabled={nbSelection === 0}
              onClick={() => genererEtImprimer(selection)}
            >
              Imprimer la sélection ({nbSelection})
            </Button>
            <Button
              icon={<PrinterOutlined />}
              loading={generation}
              disabled={nbTotal === 0}
              onClick={() => genererEtImprimer()}
            >
              Imprimer tous les étudiants filtrés
            </Button>
          </div>

          {nbTotal > lotMax && nbSelection === 0 && (
            <Alert
              type="warning"
              showIcon
              style={{ marginTop: 12 }}
              message={`${nbTotal} étudiants pour un maximum de ${lotMax} cartes par lot.`}
              description="Restreignez les filtres (école, filière, niveau) ou sélectionnez des étudiants dans la liste."
            />
          )}

          {(nbSansPhoto > 0 || photosIntrouvables.size > 0) && (
            <Alert
              type={photosIntrouvables.size > 0 ? 'warning' : 'info'}
              showIcon
              style={{ marginTop: 12 }}
              message={
                [
                  nbSansPhoto > 0 ? `${nbSansPhoto} étudiant(s) sans photo enregistrée` : null,
                  photosIntrouvables.size > 0
                    ? `${photosIntrouvables.size} photo(s) enregistrée(s) mais introuvable(s) sur le serveur`
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ') + ` — sur ${nbTotal} étudiant(s) affichés.`
              }
              description={
                <>
                  Ces cartes restent imprimables : l'emplacement photo porte la mention
                  « PHOTO MANQUANTE », jamais un cadre vide ni le portrait d'un autre étudiant.
                  {photosIntrouvables.size > 0 && (
                    <>
                      {' '}
                      Les photos introuvables signalent un fichier absent du dossier
                      <code> uploads/photos </code> du serveur, alors que la base y fait référence.
                    </>
                  )}
                </>
              }
            />
          )}
        </Card>

        {/* Étape 2 — Liste */}
        <Card size="small" style={{ borderRadius: 12 }} styles={{ body: { padding: 0 } }}>
          <Table<CarteEtudianteData>
            rowKey="etudiant_id"
            loading={chargementListe}
            columns={colonnes}
            dataSource={etudiants}
            size="small"
            rowSelection={{
              selectedRowKeys: selection,
              onChange: (cles) => setSelection(cles as number[]),
            }}
            pagination={{ pageSize: 25, showSizeChanger: true, showTotal: (t) => `${t} étudiant(s)` }}
            locale={{
              emptyText: (
                <Empty
                  description={
                    filtres.annee_id
                      ? 'Aucun étudiant pour ces filtres.'
                      : 'Choisissez une année académique.'
                  }
                />
              ),
            }}
          />
        </Card>
      </div>

      {/* Étape 4 — Aperçu fidèle, navigable */}
      <Modal
        open={apercuOuvert}
        onCancel={() => setApercuOuvert(false)}
        footer={null}
        width={CARTE_LARGEUR_MM * MM_EN_PX * ECHELLE_APERCU + 80}
        centered
        title={
          carteApercu
            ? `${carteApercu.nom} ${carteApercu.prenoms ?? ''} — ${indexApercu + 1} / ${nbTotal}`
            : 'Aperçu'
        }
      >
        {carteApercu && configuration && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, alignItems: 'center' }}>
            {(['recto', 'verso'] as const).map((face) => (
              <div
                key={face}
                style={{
                  // Le conteneur porte les cotes AGRANDIES ; la carte, ancrée en
                  // haut à gauche, s'y inscrit exactement. Sans cela, la carte
                  // agrandie déborderait de la fenêtre.
                  width: CARTE_LARGEUR_MM * MM_EN_PX * ECHELLE_APERCU,
                  height: CARTE_HAUTEUR_MM * MM_EN_PX * ECHELLE_APERCU,
                  overflow: 'hidden',
                  borderRadius: 10,
                  boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
                }}
              >
                <div className="ci-apercu" style={{ transform: `scale(${ECHELLE_APERCU})` }}>
                  {face === 'recto' ? (
                    <CarteRecto carte={carteApercu} configuration={configuration} />
                  ) : (
                    <CarteVerso carte={carteApercu} configuration={configuration} />
                  )}
                </div>
              </div>
            ))}

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Button
                icon={<LeftOutlined />}
                disabled={indexApercu === 0}
                onClick={() => setIndexApercu((i) => Math.max(0, i - 1))}
              >
                Précédent
              </Button>
              <Button
                icon={<RightOutlined />}
                disabled={indexApercu >= nbTotal - 1}
                onClick={() => setIndexApercu((i) => Math.min(nbTotal - 1, i + 1))}
              >
                Suivant
              </Button>
            </div>

            {!carteApercu.complete && (
              <Alert
                type="warning"
                showIcon
                style={{ width: '100%' }}
                message="Carte incomplète"
                description={`Champs manquants : ${carteApercu.champs_manquants.join(', ')}.`}
              />
            )}
          </div>
        )}
      </Modal>

      {/* Source du document imprimé : le lot complet, hors écran. Son HTML est
          recopié tel quel dans la fenêtre d'impression — l'imprimé est donc le
          même rendu que l'aperçu, et non une seconde implémentation. */}
      <div ref={zoneImpressionRef} style={{ position: 'fixed', left: -99999, top: 0 }} aria-hidden>
        {configuration &&
          lot.map((carte) => (
            /* Fragment et non `div` : un conteneur supplémentaire autour des
               deux faces formerait un bloc de rendu que le navigateur pagine
               d'un seul tenant, et la règle « une face = une page » tomberait. */
            <Fragment key={carte.etudiant_id}>
              <div className="ci-page" data-face="recto">
                <CarteRecto carte={carte} configuration={configuration} />
              </div>
              <div className="ci-page" data-face="verso">
                <CarteVerso carte={carte} configuration={configuration} />
              </div>
            </Fragment>
          ))}
      </div>
    </div>
  );
};

export default CartesEtudiantes;
