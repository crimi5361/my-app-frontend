/**
 * La redirection demandée à l'oral, déplacée au niveau du shell.
 *
 * POURQUOI ELLE BOUGE. La temporisation vivait dans `ModeVocal` : elle ne
 * fonctionnait donc que si la page vocale était ouverte. Avec le bouton
 * flottant, le fondateur peut demander « conduis-moi vers les effectifs »
 * depuis n'importe quel écran — la redirection doit suivre.
 *
 * LA TEMPORISATION EST REPRISE TELLE QUELLE, et elle n'est pas arbitraire :
 * le message de navigation arrive avec la réponse d'outil, donc AVANT que
 * l'assistante ait prononcé « je vous y conduis ». Partir aussitôt couperait sa
 * phrase, et le fondateur arriverait sur l'écran sans savoir pourquoi.
 *
 * Deux échéances, la première atteinte l'emporte :
 *   • 900 ms après qu'elle a cessé de parler — le cas normal ;
 *   • un garde-fou, si le tour ne se referme JAMAIS (session coupée, audio
 *     perdu). Mieux vaut partir un peu tôt que rester bloqué sur un écran qui a
 *     annoncé un départ.
 *
 * LE GARDE-FOU EST PASSÉ DE 9 À 25 SECONDES, et c'est une correction, pas un
 * confort. Mesuré le 2026-08-25 : à « emmène-moi sur les effectifs et explique-
 * moi ce que je vais y trouver », l'assistante parle 14,9 secondes. Le garde-fou
 * se déclenchait donc EN PLEINE PHRASE et la coupait net — exactement ce que la
 * temporisation cherchait à éviter.
 *
 * Neuf secondes suffisaient quand elle annonçait seulement le départ. Depuis
 * qu'elle commente aussi l'écran, ses réponses ont doublé de longueur. Un
 * garde-fou doit rattraper une panne, pas devenir le chemin normal : à 25 s il
 * ne se déclenche plus que si le tour est réellement bloqué.
 *
 * ═══ LA SESSION N'EST PLUS ARRÊTÉE AU DÉPART ═══
 *
 * C'était le comportement d'origine, et il avait sa logique : la redirection
 * fermait l'écran vocal, donc autant couper. Avec le bouton flottant, cette
 * logique s'inverse — le fondateur demande à être conduit quelque part POUR
 * continuer à travailler, en parlant. Couper la session à l'arrivée revenait à
 * raccrocher au nez de quelqu'un à qui l'on vient d'ouvrir la porte.
 *
 * Il en découle une règle simple, qui vaut pour tout le module : SEUL LE SECOND
 * APPUI SUR LA MASCOTTE ferme la session. Ni une navigation, ni la fermeture de
 * l'écran vocal, ni un changement de page.
 */
import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useVocalOptionnel } from '../../lib/ContexteVocal';

const NavigationVocale = () => {
  const session = useVocalOptionnel();
  const naviguer = useNavigate();
  const emplacement = useLocation();

  /**
   * Verrou par DESTINATION, et non par booléen.
   *
   * Un simple drapeau se posait au premier départ et ne se relâchait qu'au
   * retour de `navigation` à `null` — ce qui n'arrive jamais, rien ne le remet à
   * zéro côté hook. La deuxième demande de navigation de la session n'aurait
   * donc pas abouti : le fondateur aurait été conduit une fois, puis plus
   * jamais, sans le moindre message.
   *
   * En mémorisant le chemin traité, chaque nouvelle destination repart propre,
   * et un re-rendu pendant le délai ne déclenche pas un second départ vers la
   * même page.
   */
  const dernierChemin = useRef<string | null>(null);

  const navigation = session?.navigation ?? null;
  const statut = session?.statut ?? 'inactif';
  const cible = navigation?.chemin ?? null;

  useEffect(() => {
    if (!cible || dernierChemin.current === cible) return undefined;

    const partir = () => {
      if (dernierChemin.current === cible) return;
      dernierChemin.current = cible;
      // On NAVIGUE, on ne raccroche pas. La session survit : c'est tout l'objet
      // du bouton flottant.
      naviguer(cible);
    };

    const delai = statut === 'parle' ? 25000 : 900;
    const minuteur = window.setTimeout(partir, delai);
    return () => clearTimeout(minuteur);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cible, statut]);

  /**
   * L'ecran courant est annonce au serveur a chaque changement de route ET a
   * l'ouverture de la session — dans cet ordre d'importance. Sans le second cas,
   * une session demarree depuis une page quelconque commencerait sans savoir ou
   * se trouve le fondateur.
   */
  useEffect(() => {
    if (statut === 'inactif' || statut === 'connexion') return;
    session?.annoncerPage(emplacement.pathname);
  }, [emplacement.pathname, statut, session]);

  return null;
};

export default NavigationVocale;
