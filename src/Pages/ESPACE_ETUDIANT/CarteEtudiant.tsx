import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  IdCard,
  Printer,
  RotateCw,
  AlertCircle,
  Info,
  ShieldCheck,
  Barcode,
  Mail,
  Copy,
  Check,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CarteRecto, CarteVerso, CARTE_LARGEUR_MM, CARTE_HAUTEUR_MM } from '../../Components/CarteEtudiante/CarteEtudiante';
import {
  chargerConfiguration,
  chargerMaCarte,
  ecrireDocumentImpression,
  injecterStylesCartes,
  type CarteEtudianteData,
  type ConfigurationCartes,
} from '../../lib/cartesEtudiantes';

const MM_EN_PX = 96 / 25.4;
const CARTE_LARGEUR_PX = CARTE_LARGEUR_MM * MM_EN_PX;
const CARTE_HAUTEUR_PX = CARTE_HAUTEUR_MM * MM_EN_PX;

const CarteEtudiant = () => {
  const navigate = useNavigate();
  const [carte, setCarte] = useState<CarteEtudianteData | null>(null);
  const [configuration, setConfiguration] = useState<ConfigurationCartes | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [face, setFace] = useState<'recto' | 'verso'>('recto');
  const [echelle, setEchelle] = useState(1.8);
  const [modalAnomalieOuverte, setModalAnomalieOuverte] = useState(false);
  const [messageCopie, setMessageCopie] = useState(false);

  const conteneurRef = useRef<HTMLDivElement>(null);
  const zoneImpressionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    injecterStylesCartes();
    let actif = true;
    (async () => {
      try {
        const [config, maCarte] = await Promise.all([chargerConfiguration(), chargerMaCarte()]);
        if (!actif) return;
        setConfiguration(config);
        setCarte(maCarte);
      } catch (e) {
        if (actif) setErreur(e instanceof Error ? e.message : 'Erreur de chargement.');
      } finally {
        if (actif) setChargement(false);
      }
    })();
    return () => {
      actif = false;
    };
  }, []);

  useEffect(() => {
    const conteneur = conteneurRef.current;
    if (!conteneur) return;

    const ajuster = () => {
      const style = window.getComputedStyle(conteneur);
      const paddingX = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
      const dispo = conteneur.clientWidth - paddingX;
      if (dispo <= 0) return;

      // Échelle dynamique responsive :
      // - Mobile étroit (320px - 480px) : la carte s'adapte à la largeur disponible (échelle ~ 0.85 à 1.3)
      // - Tablette (480px - 768px) : échelle intermédiaire (~ 1.4 à 1.7)
      // - Bureau (>= 768px) : plafonnée à 1.95 (largeur ~630px, hauteur ~398px)
      // Cela évite tout débordement, assure une netteté maximale et élimine les espaces vides asymétriques.
      const echelleCalculee = Math.min(1.95, Math.max(0.75, (dispo - 16) / CARTE_LARGEUR_PX));
      setEchelle(echelleCalculee);
    };

    ajuster();

    const ro = new ResizeObserver(() => ajuster());
    ro.observe(conteneur);

    return () => ro.disconnect();
  }, [carte]);

  const imprimer = useCallback(() => {
    const fenetre = window.open('', '_blank');
    if (!fenetre) {
      setErreur(
        "L'ouverture a été bloquée par le navigateur. Autorisez les fenêtres surgissantes, puis relancez."
      );
      return;
    }
    const contenu = zoneImpressionRef.current?.innerHTML ?? '';
    ecrireDocumentImpression(
      fenetre,
      `Carte etudiante ${carte?.numero_etudiant ?? ''}`.trim(),
      contenu,
      window.location.origin
    );
  }, [carte]);

  // Construction du corps du mail pré-rempli pour le signalement d'anomalie
  const sujetMail = `[Signalement Carte Étudiante] - ${carte?.nom ?? ''} ${carte?.prenoms ?? ''} (${carte?.numero_etudiant ?? ''})`;
  const corpsMail = `Bonjour le service de la scolarité,

Je constate une anomalie sur ma carte étudiante officielle IIPEA :

- Titulaire : ${carte?.nom ?? ''} ${carte?.prenoms ?? ''}
- N° Étudiant : ${carte?.numero_etudiant ?? 'Non renseigné'}
- Matricule IP : ${carte?.matricule_ip ?? 'Non renseigné'}
- École : ${carte?.ecole.nom ?? ''} (${carte?.ecole.code ?? ''})
- Filière : ${carte?.filiere ?? ''}
- Niveau : ${carte?.niveau ?? ''}

Description de l'anomalie constatée :
[Veuillez préciser ici l'erreur constatée : faute sur l'état civil, filière incorrecte, photo manquante ou erronée, etc.]

Merci de bien vouloir régulariser mon dossier.
Cordialement.`;

  const lienMailto = `mailto:secretariat@iipea.com?subject=${encodeURIComponent(sujetMail)}&body=${encodeURIComponent(corpsMail)}`;

  const copierMessage = () => {
    navigator.clipboard.writeText(corpsMail);
    setMessageCopie(true);
    setTimeout(() => setMessageCopie(false), 2500);
  };

  if (chargement) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
        <div className="flex items-center gap-3 text-slate-500 font-medium">
          <RotateCw className="animate-spin text-blue-600" size={20} />
          Chargement de votre carte officielle…
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <button
          onClick={() => navigate('/acceuil/espace_etudiant')}
          className="mb-5 inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
        >
          <ArrowLeft size={16} />
          Retour
        </button>

        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-blue-700 shadow-sm">
              <IdCard size={22} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800 sm:text-xl">Ma carte étudiante officielle</h1>
              <p className="text-sm text-slate-500">
                {carte?.annee_academique ? `Année académique ${carte.annee_academique}` : 'Institut International Polytechnique des Élites d’Abidjan'}
              </p>
            </div>
          </div>

          {carte && (
            <span
              className="rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide text-white shadow-sm"
              style={{ background: carte.ecole.principal }}
            >
              {carte.ecole.code} — {carte.ecole.nom}
            </span>
          )}
        </div>

        {erreur && (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
            <AlertCircle className="mt-0.5 flex-shrink-0 text-amber-600" size={20} />
            <p className="text-sm text-amber-800">{erreur}</p>
          </div>
        )}

        {carte && configuration && (
          <>
            {/* Barre de contrôle et actions */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex rounded-xl bg-white p-1 shadow-sm border border-slate-200">
                <button
                  onClick={() => setFace('recto')}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                    face === 'recto' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Recto (Face)
                </button>
                <button
                  onClick={() => setFace('verso')}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                    face === 'verso' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Verso (Dos)
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setFace(face === 'recto' ? 'verso' : 'recto')}
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm border border-slate-200 transition-colors hover:bg-slate-50"
                  title="Basculer entre le recto et le verso"
                >
                  <RotateCw size={15} />
                  Retourner
                </button>

                <button
                  onClick={imprimer}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
                >
                  <Printer size={16} />
                  Imprimer la carte
                </button>
              </div>
            </div>

            {/* Aperçu interactif fidèle (format ID-1 exact) */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              ref={conteneurRef}
              className="mb-5 overflow-hidden rounded-2xl bg-gradient-to-b from-slate-100/90 to-slate-200/70 p-4 shadow-inner border border-slate-200/90 sm:p-7"
            >
              {/* Conteneur physique centré de dimensions exactes proportionnelles à l'échelle */}
              <div
                className="relative mx-auto flex items-center justify-center transition-all duration-150"
                style={{
                  width: `${Math.round(CARTE_LARGEUR_PX * echelle)}px`,
                  height: `${Math.round(CARTE_HAUTEUR_PX * echelle)}px`,
                  borderRadius: `${Math.round(3.18 * MM_EN_PX * echelle)}px`,
                  boxShadow: '0 20px 35px -10px rgba(0, 0, 0, 0.22), 0 8px 16px -6px rgba(0, 0, 0, 0.12)',
                }}
              >
                <div
                  className="ci-apercu"
                  style={{
                    width: `${CARTE_LARGEUR_PX}px`,
                    height: `${CARTE_HAUTEUR_PX}px`,
                    transform: `scale(${echelle})`,
                    transformOrigin: 'top left',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                  }}
                >
                  {face === 'recto' ? (
                    <CarteRecto carte={carte} configuration={configuration} />
                  ) : (
                    <CarteVerso carte={carte} configuration={configuration} />
                  )}
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between text-xs text-slate-500 px-1">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full bg-blue-600"></span>
                  Face affichée : <b className="text-slate-700 uppercase">{face}</b>
                </span>
                <span>Format physique standard ID-1 (85,60 × 53,98 mm)</span>
              </div>
            </motion.div>

            {/* Alerte si des informations sont manquantes */}
            {carte.champs_manquants.length > 0 && (
              <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
                <AlertCircle className="mt-0.5 flex-shrink-0 text-amber-600" size={20} />
                <div className="text-sm text-amber-800">
                  <p className="font-semibold">Attention : Votre carte comporte des champs incomplets</p>
                  <p className="mt-1">
                    {carte.champs_manquants.includes('photo_url')
                      ? "Votre photo d'identité n'a pas encore été enregistrée. "
                      : ''}
                    Veuillez contacter le secrétariat pour compléter votre dossier avant l'impression définitive.
                  </p>
                </div>
              </div>
            )}

            {/* Tableau récapitulatif des données */}
            <div className="mb-5 rounded-2xl bg-white p-5 shadow-sm border border-slate-200 sm:p-6">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Info size={17} className="text-slate-400" />
                  <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
                    Informations figurant sur votre carte
                  </h2>
                </div>

                <button
                  onClick={() => setModalAnomalieOuverte(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100"
                >
                  <AlertCircle size={14} />
                  Signaler une anomalie
                </button>
              </div>

              <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
                {[
                  ['Nom', carte.nom],
                  ['Prénoms', carte.prenoms],
                  ['N° étudiant (Code-barres)', carte.numero_etudiant],
                  ['Matricule IP (Ministère)', carte.matricule_ip],
                  ['Date de naissance', carte.date_naissance],
                  ['École', `${carte.ecole.nom} (${carte.ecole.code})`],
                  ['Filière', carte.filiere],
                  ['Niveau', carte.niveau],
                  ['Année académique', carte.annee_academique],
                  ['Valable jusqu’au', carte.valable_jusquau],
                ].map(([libelle, valeur]) => (
                  <div key={libelle} className="flex justify-between gap-4 border-b border-slate-100 pb-2">
                    <dt className="text-sm text-slate-500">{libelle}</dt>
                    <dd
                      className={`text-right text-sm font-semibold ${
                        valeur ? 'text-slate-800' : 'italic text-red-500'
                      }`}
                    >
                      {valeur || 'non renseigné'}
                    </dd>
                  </div>
                ))}
              </dl>

              <div className="mt-4 flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
                <p>
                  Vérifiez attentivement l'exactitude de ces informations avant impression.
                </p>
                <button
                  onClick={() => setModalAnomalieOuverte(true)}
                  className="font-medium text-red-600 hover:underline"
                >
                  Une erreur ? Signalez-la ici
                </button>
              </div>
            </div>

            {/* Explications techniques et de sécurité */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <ShieldCheck className="mt-0.5 flex-shrink-0 text-blue-600" size={20} />
                <div className="text-xs text-slate-600 leading-relaxed">
                  <p className="font-semibold text-slate-700 text-sm">QR Code Recto (Vérification)</p>
                  <p className="mt-1">
                    Le QR code du recto permet aux autorités et partenaires de vérifier instantanément l'authenticité de votre inscription.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <Barcode className="mt-0.5 flex-shrink-0 text-slate-700" size={20} />
                <div className="text-xs text-slate-600 leading-relaxed">
                  <p className="font-semibold text-slate-700 text-sm">Code-barres Verso (Code 128)</p>
                  <p className="mt-1">
                    Le code-barres 1D standard au verso encode votre identifiant pour le contrôle d'accès sur le campus, la bibliothèque et les examens.
                  </p>
                </div>
              </div>
            </div>

            {/* Modal de signalement d'anomalie */}
            <AnimatePresence>
              {modalAnomalieOuverte && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-slate-200"
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-red-600 font-bold text-base">
                        <AlertCircle size={20} />
                        Signaler une anomalie sur ma carte
                      </div>
                      <button
                        onClick={() => setModalAnomalieOuverte(false)}
                        className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                      >
                        ✕
                      </button>
                    </div>

                    <p className="mb-4 text-sm text-slate-600 leading-relaxed">
                      Si vous constatez une erreur dans votre nom, vos prénoms, votre photo, votre filière ou votre niveau, un message pré-rempli est prêt pour le service de la scolarité :
                    </p>

                    <div className="mb-4 rounded-xl bg-slate-50 p-3.5 border border-slate-200 text-xs text-slate-700 font-mono whitespace-pre-wrap max-h-48 overflow-y-auto">
                      {corpsMail}
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-2.5">
                      <button
                        onClick={copierMessage}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        {messageCopie ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                        {messageCopie ? 'Copié !' : 'Copier le message'}
                      </button>

                      <a
                        href={lienMailto}
                        onClick={() => setModalAnomalieOuverte(false)}
                        className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 shadow-sm"
                      >
                        <Mail size={14} />
                        Ouvrir ma messagerie (secretariat@iipea.com)
                      </a>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>

      {/* Rendu hors-écran pour impression */}
      {carte && configuration && (
        <div ref={zoneImpressionRef} style={{ position: 'fixed', left: -99999, top: 0 }} aria-hidden>
          <div className="ci-page" data-face="recto">
            <CarteRecto carte={carte} configuration={configuration} />
          </div>
          <div className="ci-page" data-face="verso">
            <CarteVerso carte={carte} configuration={configuration} />
          </div>
        </div>
      )}
    </div>
  );
};

export default CarteEtudiant;
