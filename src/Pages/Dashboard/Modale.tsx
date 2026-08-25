/**
 * Coquille modale partagée — voile flouté, portail, fermeture.
 *
 * D'OÙ ELLE VIENT. Ce comportement existait dans `FichePersonne`, écrit pour
 * elle. Les graphiques, eux, s'affichaient à même le fil : dans l'écran vocal,
 * une colonne de 720 px au maximum, sous la conversation. Un classement de
 * trente-trois agents y devenait illisible.
 *
 * Plutôt que de dupliquer le voile, on le sort ici. `FichePersonne` le consomme
 * désormais sans rien changer à ce qu'elle affiche.
 *
 * CE QUE LA COQUILLE GARANTIT, et pourquoi chaque point compte :
 *
 *   • PORTAIL vers `document.body`. L'écran vocal occupe tout le viewport avec
 *     un fond opaque à z-index 1200 ; une modale rendue DANS cet écran passerait
 *     derrière. Montée sur le body, elle en est sœur et peut passer devant.
 *   • ÉCHAP EN PHASE DE CAPTURE. L'écran vocal écoute lui aussi Échap pour se
 *     fermer. Sans la capture, une seule touche fermait les deux — la modale ET
 *     la conversation.
 *   • CLIC EXTÉRIEUR sur le voile lui-même, jamais sur un enfant : un clic qui
 *     part sur le graphique et se termine hors de lui ne doit pas fermer.
 *   • `onMouseDown` et non `onClick` : une sélection de texte qui déborde du
 *     panneau refermait la modale au relâchement.
 */
import { ReactNode, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import './Modale.css';

const Modale = ({
  children, onFermer, libelle, classe = '', nu = false,
}: {
  children: ReactNode;
  onFermer: () => void;
  libelle: string;
  classe?: string;
  /**
   * Panneau NU : la coquille fournit le voile, le portail et la fermeture, mais
   * aucun style de panneau. `FichePersonne` a le sien, écrit pour elle — largeur,
   * fond, bordure, ombre. Superposer `.md-panneau` par-dessus reviendrait à faire
   * dépendre son apparence de l'ordre des feuilles de style dans le paquet, ce
   * qui casserait un jour sans que rien ne le signale.
   */
  nu?: boolean;
}) => {
  const panneau = useRef<HTMLDivElement>(null);
  // La fermeture est lue depuis une référence : l'écouteur clavier n'est posé
  // qu'une fois, et ne doit pas se re-poser à chaque rendu du parent.
  const fermeture = useRef(onFermer);
  fermeture.current = onFermer;

  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); fermeture.current(); }
    };
    window.addEventListener('keydown', surTouche, true);
    panneau.current?.focus();
    return () => window.removeEventListener('keydown', surTouche, true);
  }, []);

  return createPortal(
    <div
      className="md-voile"
      onMouseDown={(e) => { if (e.target === e.currentTarget) fermeture.current(); }}
    >
      <div
        className={[nu ? '' : 'md-panneau', classe].filter(Boolean).join(' ')}
        role="dialog"
        aria-modal="true"
        aria-label={libelle}
        tabIndex={-1}
        ref={panneau}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
};

export default Modale;
