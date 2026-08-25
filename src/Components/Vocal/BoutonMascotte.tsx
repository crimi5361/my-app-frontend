/**
 * Le bouton flottant de l'assistante vocale.
 *
 * LA MASCOTTE EST LE BOUTON. Pas une icône dans une pastille, pas un emoji : les
 * deux fichiers sont détourés sur fond transparent, et c'est le robot lui-même
 * qu'on voit posé sur la page. Aucun fond, aucun cercle, aucune bordure —
 * seulement une ombre douce pour le décoller.
 *
 * DEUX ÉTATS, DEUX FICHIERS, ET UNE SEULE BALISE `<img>`.
 *   inactif -> assistant-robot-256.png   (PNG statique, RVB+alpha)
 *   actif   -> assistant-robot-anim.webp (WebP animé, 103 images, boucle infinie)
 *
 * Pas de `<video>` : le WebP animé se lit nativement dans un `<img>` et se boucle
 * seul — le compteur ANIM du fichier vaut 0, ce qui signifie « à l'infini ».
 * Aucun JavaScript de lecture n'est nécessaire, et il n'y en a donc aucun.
 *
 * LE PRÉCHARGEMENT N'EST PAS DU CONFORT. Le WebP pèse 567 Ko. Chargé au premier
 * appui, il laisserait un trou blanc à l'endroit exact où le fondateur vient de
 * cliquer, pendant que la mascotte se télécharge — au moment le plus visible.
 * On le met donc en cache au montage du composant, bien avant qu'on en ait
 * besoin.
 *
 * LE CLIC EST LE GESTE QUI AUTORISE L'AUDIO. Les navigateurs n'ouvrent un
 * contexte audio que dans la foulée d'une interaction. `demarrer()` appelle
 * `lecteur.preparer()` immédiatement pour cette raison : la chaîne clic ->
 * demarrer -> preparer ne doit jamais être rompue, sous peine de retomber sur
 * une assistante muette (voir useAssistantVocal).
 */
import { useEffect, useRef, useState } from 'react';
import { useVocalOptionnel } from '../../lib/ContexteVocal';
import './BoutonMascotte.css';

const IMAGE_INACTIVE = '/assets/assistant/assistant-robot-256.png';
const IMAGE_ACTIVE = '/assets/assistant/assistant-robot-anim.webp';

const BoutonMascotte = () => {
  const session = useVocalOptionnel();
  const [precharge, setPrecharge] = useState(false);
  const dejaDemande = useRef(false);

  // Mise en cache du WebP animé, une seule fois. `new Image()` suffit : le
  // navigateur garde le fichier, et le `src` du bouton le retrouvera sans
  // aller-retour réseau.
  useEffect(() => {
    if (dejaDemande.current) return;
    dejaDemande.current = true;
    const img = new Image();
    img.onload = () => setPrecharge(true);
    img.onerror = () => setPrecharge(true);   // on n'empêche pas l'usage pour autant
    img.src = IMAGE_ACTIVE;
  }, []);

  // Rôle sans accès à l'assistante : rien ne s'affiche, et le contexte est vide.
  if (!session) return null;

  const actif = session.statut !== 'inactif';

  const basculer = () => {
    if (actif) session.arreter();
    else session.demarrer();
  };

  // Espace et Entrée : `<button>` le fait déjà pour Entrée, mais pas pour Espace
  // sur tous les navigateurs quand l'élément porte un `role` explicite.
  const surTouche = (e: React.KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      basculer();
    }
  };

  return (
    <button
      type="button"
      role="button"
      className={`bm-bouton${actif ? ' est-actif' : ''}`}
      onClick={basculer}
      onKeyDown={surTouche}
      aria-pressed={actif}
      aria-label={actif ? "Désactiver l'assistant vocal" : "Activer l'assistant vocal"}
      title={actif ? "Désactiver l'assistant vocal" : "Activer l'assistant vocal"}
    >
      {/* Les deux images sont superposées et se croisent en fondu : basculer un
          seul `src` produirait un clignotement au changement de fichier. */}
      <img
        className="bm-image bm-repos"
        src={IMAGE_INACTIVE}
        alt=""
        aria-hidden="true"
        draggable={false}
      />
      {precharge && (
        <img
          className="bm-image bm-anime"
          src={IMAGE_ACTIVE}
          alt=""
          aria-hidden="true"
          draggable={false}
        />
      )}
    </button>
  );
};

export default BoutonMascotte;
