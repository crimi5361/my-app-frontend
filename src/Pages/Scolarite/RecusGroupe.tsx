import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { App, Alert, Button, Card, Progress, Space, Typography } from 'antd';
import { ArrowLeftOutlined, PrinterOutlined, ReloadOutlined } from '@ant-design/icons';
import PageHeader from '../../Components/PageHeader/PageHeader';
import {
  RecuContent,
  STYLES_IMPRESSION_RECU,
  type EtudiantDetails,
  type Paiement,
} from './RecuEtudiant';

const { Title, Text } = Typography;

/**
 * Reçus récapitulatifs de scolarité de TOUT un groupe, en un seul document.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * AUCUN NOUVEAU MODÈLE DE REÇU
 * ─────────────────────────────────────────────────────────────────────────────
 * Cette page ne redessine rien : elle empile le composant `RecuContent` du reçu
 * individuel (/Etudiant/Recu_Payement/:id) et réutilise sa feuille d'impression
 * `STYLES_IMPRESSION_RECU`. Le rendu imprimé d'un étudiant est donc, par
 * construction, celui de son reçu individuel — logo, QR, photo, Kit École,
 * indicateurs et historique compris.
 *
 * Les données viennent du MÊME endpoint que le reçu individuel
 * (`/api/etudiants/recu-data/:id`), appelé une fois par étudiant : les montants
 * et les soldes sont ceux du backend, jamais recalculés ici. Un étudiant = un
 * reçu, avec l'intégralité de ses paiements — et non un reçu par paiement.
 */

/** Étudiant tel que le renvoie /api/classes/groupe/:id. */
interface EtudiantDuGroupe {
  id: number;
  nom: string;
  prenoms: string;
  matricule: string;
  matricule_iipea: string;
}

interface GroupeDetail {
  id: number;
  nom: string;
  classe_nom: string;
  effectif: number;
  etudiants: EtudiantDuGroupe[];
}

interface RecuCharge {
  etudiant: EtudiantDetails;
  paiements: Paiement[];
}

interface EchecChargement {
  etudiant_id: number;
  nom: string;
  motif: string;
}

/**
 * Nombre de reçus chargés de front. Chaque appel à /recu-data déclenche
 * plusieurs requêtes SQL côté serveur : 4 en parallèle accélèrent nettement un
 * groupe de 45 étudiants sans monopoliser le pool de connexions pour les autres
 * utilisateurs de l'application.
 */
const CONCURRENCE = 4;

/** Exécute `fn` sur `elements` par tranches, en préservant l'ordre d'entrée. */
async function parTranches<T, R>(elements: T[], taille: number, fn: (e: T) => Promise<R>): Promise<R[]> {
  const sorties: R[] = [];
  for (let i = 0; i < elements.length; i += taille) {
    sorties.push(...(await Promise.all(elements.slice(i, i + taille).map(fn))));
  }
  return sorties;
}

/* ⚠️ Enveloppe <App> obligatoire : sous React 19, les méthodes statiques d'antd
   (message.*, Modal.*) n'affichent rien tant que le correctif de compatibilité
   n'est pas importé globalement. Même convention que AttestationsMasse.tsx. */
const RecusGroupe = () => (
  <App>
    <RecusGroupeContent />
  </App>
);

const RecusGroupeContent = () => {
  const { id } = useParams<{ id: string }>();
  const [parametres] = useSearchParams();
  const anneeAcademiqueId = parametres.get('anneeAcademiqueId');
  const navigate = useNavigate();
  const { message } = App.useApp();

  const API_URL = import.meta.env.VITE_API_URL_SERVER || '';

  const [groupe, setGroupe] = useState<GroupeDetail | null>(null);
  const [recus, setRecus] = useState<RecuCharge[]>([]);
  const [echecs, setEchecs] = useState<EchecChargement[]>([]);
  const [chargement, setChargement] = useState(true);
  const [progression, setProgression] = useState(0);
  const [erreur, setErreur] = useState<string | null>(null);
  /* L'impression automatique ne doit partir qu'une fois, même si React
     re-rend la page (StrictMode en développement la monte deux fois). */
  const impressionLancee = useRef(false);

  const charger = useCallback(async () => {
    if (!id) return;
    setChargement(true);
    setErreur(null);
    setEchecs([]);
    setRecus([]);
    setProgression(0);

    const token = localStorage.getItem('token');
    const entetes = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    try {
      const reponseGroupe = await fetch(`${API_URL}/api/classes/groupe/${id}`, { headers: entetes });
      if (!reponseGroupe.ok) {
        throw new Error(
          reponseGroupe.status === 401
            ? 'Session expirée, veuillez vous reconnecter.'
            : `Groupe introuvable (erreur ${reponseGroupe.status}).`,
        );
      }
      const corpsGroupe = await reponseGroupe.json();
      const detail: GroupeDetail = corpsGroupe.data ?? corpsGroupe;
      setGroupe(detail);

      const etudiants = Array.isArray(detail?.etudiants) ? detail.etudiants : [];
      if (etudiants.length === 0) {
        setChargement(false);
        return;
      }

      let faits = 0;
      const echecsLocaux: EchecChargement[] = [];

      // Un appel par étudiant, sur l'endpoint du reçu individuel : c'est ce qui
      // garantit des montants identiques à ceux de son reçu unitaire.
      const charges = await parTranches(etudiants, CONCURRENCE, async (etudiant) => {
        const url = anneeAcademiqueId
          ? `${API_URL}/api/etudiants/recu-data/${etudiant.id}?anneeAcademiqueId=${encodeURIComponent(anneeAcademiqueId)}`
          : `${API_URL}/api/etudiants/recu-data/${etudiant.id}`;
        try {
          const reponse = await fetch(url, { headers: entetes });
          if (!reponse.ok) {
            echecsLocaux.push({
              etudiant_id: etudiant.id,
              nom: `${etudiant.nom} ${etudiant.prenoms}`,
              motif: reponse.status === 404 ? 'Aucune donnée de scolarité' : `Erreur ${reponse.status}`,
            });
            return null;
          }
          const corps = await reponse.json();
          return { etudiant: corps.data.etudiant, paiements: corps.data.paiements || [] } as RecuCharge;
        } catch (e) {
          echecsLocaux.push({
            etudiant_id: etudiant.id,
            nom: `${etudiant.nom} ${etudiant.prenoms}`,
            motif: e instanceof Error ? e.message : 'Erreur réseau',
          });
          return null;
        } finally {
          faits += 1;
          setProgression(Math.round((faits / etudiants.length) * 100));
        }
      });

      setRecus(charges.filter((r): r is RecuCharge => r !== null));
      setEchecs(echecsLocaux);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur lors du chargement du groupe.');
    } finally {
      setChargement(false);
    }
  }, [API_URL, anneeAcademiqueId, id]);

  useEffect(() => {
    charger();
  }, [charger]);

  /**
   * Construit le document imprimable : tous les reçus dans UN seul onglet, un
   * par page. On reprend exactement la mécanique du reçu individuel (clonage des
   * feuilles de style de l'application + `STYLES_IMPRESSION_RECU`), à laquelle
   * s'ajoutent les seules règles propres au document multiple.
   */
  const imprimer = useCallback(() => {
    const conteneur = document.getElementById('zone-recus-groupe');
    if (!conteneur || recus.length === 0) {
      message.warning('Aucun reçu à imprimer.');
      return;
    }

    const fenetre = window.open('', '_blank');
    if (!fenetre) {
      message.error("L'ouverture a été bloquée par le navigateur. Autorisez les fenêtres surgissantes puis relancez l'impression.");
      return;
    }

    const feuilles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map((el) => el.outerHTML)
      .join('');

    const titre = `Reçus ${groupe?.nom ?? ''} (${recus.length})`.trim();

    fenetre.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${titre}</title>
          <meta charset="utf-8">
          <!-- La fenêtre est ouverte sur about:blank : sans cette base, les URL
               commençant par « / » (l'avatar par défaut /user-default.png) n'ont
               aucune origine à laquelle se rattacher et ne se chargent pas. -->
          <base href="${window.location.origin}/">
          ${feuilles}
          <style>${STYLES_IMPRESSION_RECU}</style>
          <style>
            /* Règles propres au document multiple — elles ne modifient pas le
               rendu d'un reçu, elles organisent leur succession. */
            @media print {
              /* La mise à l'échelle appartient à CHAQUE reçu et non au conteneur :
                 appliquée au conteneur, elle créerait un bloc de rendu unique que
                 le navigateur refuserait de découper proprement en pages. */
              .print-container { transform: none !important; }
              .recu-page {
                transform: scale(0.92);
                transform-origin: top center;
                page-break-after: always;
                break-after: page;
                page-break-inside: avoid;
              }
              .recu-page:last-child {
                page-break-after: auto;
                break-after: auto;
              }
            }
          </style>
        </head>
        <body onload="window.print(); window.onafterprint = function() { window.close(); }">
          <div class="print-container">
            ${conteneur.innerHTML}
          </div>
        </body>
      </html>
    `);
    fenetre.document.close();
  }, [groupe, message, recus.length]);

  /* Impression lancée d'elle-même dès que tout est prêt : la page n'est ouverte
     que pour cela. Si le navigateur bloque la fenêtre, le bouton reste
     disponible — on ne prétend jamais que le document est sorti. */
  useEffect(() => {
    if (chargement || impressionLancee.current || recus.length === 0) return;
    impressionLancee.current = true;
    imprimer();
  }, [chargement, imprimer, recus.length]);

  const entete = useMemo(() => {
    if (!groupe) return 'Reçus du groupe';
    return `Reçus de scolarité — ${groupe.nom}${groupe.classe_nom ? ` (${groupe.classe_nom})` : ''}`;
  }, [groupe]);

  return (
    <>
      <PageHeader />
      <div style={{ padding: 24 }}>
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Space wrap>
            {/* Navigation EXPLICITE vers le groupe, et non `navigate(-1)` : cette
                page est toujours ouverte dans un onglet neuf par DetailGroupe, où
                `history.length` vaut 1. Un retour arrière n'y a aucune entrée où
                revenir et ne produisait donc rien (mesuré le 2026-11-10).
                `id` est l'identifiant du groupe porté par la route : le retour se
                fait sur le groupe exact d'où la génération a été lancée. */}
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate(`/Gestion_academique/DetailGroupe/${id}`)}
            >
              Retour au groupe
            </Button>
            <Button
              type="primary"
              icon={<PrinterOutlined />}
              onClick={imprimer}
              disabled={chargement || recus.length === 0}
            >
              Imprimer les {recus.length || ''} reçus
            </Button>
            <Button icon={<ReloadOutlined />} onClick={charger} disabled={chargement}>
              Recharger
            </Button>
          </Space>

          <Card>
            <Title level={4} style={{ marginTop: 0 }}>{entete}</Title>

            {chargement && (
              <Space direction="vertical" style={{ width: '100%' }}>
                <Text>Préparation des reçus…</Text>
                <Progress percent={progression} status="active" />
              </Space>
            )}

            {!chargement && erreur && (
              <Alert type="error" showIcon message="Génération impossible" description={erreur} />
            )}

            {!chargement && !erreur && recus.length === 0 && (
              <Alert
                type="warning"
                showIcon
                message="Aucun reçu à produire"
                description="Ce groupe ne contient aucun étudiant dont la scolarité puisse être établie."
              />
            )}

            {!chargement && recus.length > 0 && (
              <Text>
                <strong>{recus.length}</strong> reçu{recus.length > 1 ? 's' : ''} préparé
                {recus.length > 1 ? 's' : ''}, un par étudiant et un par page.
              </Text>
            )}

            {/* Les étudiants écartés sont NOMMÉS : un reçu manquant ne doit jamais
                passer inaperçu au milieu d'un lot. */}
            {echecs.length > 0 && (
              <Alert
                style={{ marginTop: 12 }}
                type="warning"
                showIcon
                message={`${echecs.length} étudiant${echecs.length > 1 ? 's' : ''} sans reçu`}
                description={
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {echecs.map((e) => (
                      <li key={e.etudiant_id}>
                        {e.nom} — {e.motif}
                      </li>
                    ))}
                  </ul>
                }
              />
            )}
          </Card>

          {/* Zone source de l'impression. Affichée à l'écran pour que l'on puisse
              contrôler les reçus avant de les sortir. */}
          <div id="zone-recus-groupe">
            {recus.map((r) => (
              <div className="recu-page" key={r.etudiant.id}>
                <RecuContent etudiant={r.etudiant} paiements={r.paiements} apiUrl={API_URL} />
              </div>
            ))}
          </div>
        </Space>
      </div>
    </>
  );
};

export default RecusGroupe;
