/**
 * Le liseré de néon qui borde l'écran quand l'assistante écoute.
 *
 * C'EST LE SIGNAL D'ÉTAT PRINCIPAL. Le fondateur navigue dans son tableau de
 * bord pendant qu'il parle : il ne regarde ni la mascotte, ni un indicateur.
 * Le cadre est ce qui reste dans son champ de vision quoi qu'il consulte, et
 * ce qui lui rappelle que le micro est ouvert.
 *
 * D'où trois exigences qui ne se négocient pas :
 *
 *   • `pointer-events: none`. Le cadre couvre tout le viewport. Sans cela il
 *     intercepterait chaque clic et rendrait le tableau de bord inerte.
 *   • AU-DESSUS DES MODALES. Un micro ouvert reste un micro ouvert, même quand
 *     une fiche est affichée : masquer le signal serait un contresens.
 *   • Aucune géométrie animée. Voir le CSS : seul un angle change, et il ne
 *     provoque ni recalcul de mise en page ni repeinture du contenu.
 *
 * Il n'est PAS monté puis démonté au gré de l'état : il reste dans l'arbre et
 * ne fait varier que son opacité. Le démonter couperait le fondu de sortie —
 * l'élément disparaîtrait avant d'avoir fini de s'éteindre.
 */
import { useVocalOptionnel } from '../../lib/ContexteVocal';
import './CadreNeon.css';

const CadreNeon = () => {
  const session = useVocalOptionnel();

  // Rôle sans accès à l'assistante : aucun cadre, jamais.
  if (!session) return null;

  // « Actif » au sens du fondateur : la session est ouverte, donc le micro peut
  // capter. L'état d'erreur n'en fait pas partie — un cadre allumé sur une
  // session morte donnerait une fausse assurance.
  const actif = session.statut !== 'inactif' && session.statut !== 'erreur';

  return <div className={`cn-cadre${actif ? ' est-visible' : ''}`} aria-hidden="true" />;
};

export default CadreNeon;
