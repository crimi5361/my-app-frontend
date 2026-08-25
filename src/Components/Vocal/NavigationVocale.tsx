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
 *   • 9 secondes dans tous les cas, garde-fou si le tour ne se referme jamais
 *     (session coupée, audio perdu). Mieux vaut partir un peu tôt que rester
 *     bloqué sur un écran qui a annoncé un départ.
 *
 * CE QUI CHANGE, et c'est le seul écart assumé : la session est arrêtée au
 * départ, comme avant, mais on ne referme plus d'écran vocal — il n'y en a pas
 * forcément. `ModeVocal`, s'il est ouvert, se referme de lui-même en voyant la
 * session revenir à l'état inactif.
 */
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useVocalOptionnel } from '../../lib/ContexteVocal';

const NavigationVocale = () => {
  const session = useVocalOptionnel();
  const naviguer = useNavigate();

  // Une seule fois par destination : sans ce verrou, un nouveau rendu pendant
  // le délai relancerait le minuteur, et le départ se déclencherait deux fois.
  const departFait = useRef(false);

  const navigation = session?.navigation ?? null;
  const statut = session?.statut ?? 'inactif';
  const arreter = session?.arreter;

  useEffect(() => {
    if (!navigation || departFait.current) return undefined;
    const cible = navigation.chemin;

    const partir = () => {
      if (departFait.current) return;
      departFait.current = true;
      arreter?.();
      naviguer(cible);
    };

    const delai = statut === 'parle' ? 9000 : 900;
    const minuteur = window.setTimeout(partir, delai);
    return () => clearTimeout(minuteur);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, statut]);

  // La destination consommée, le verrou se relâche : le fondateur peut demander
  // un autre écran dans la même session de travail.
  useEffect(() => {
    if (!navigation) departFait.current = false;
  }, [navigation]);

  return null;
};

export default NavigationVocale;
