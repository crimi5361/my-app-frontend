/**
 * Mise en forme des montants en francs CFA.
 *
 * DEUX DÉFAUTS OBSERVÉS SUR LE DASHBOARD FONDATEUR, ET LEUR CAUSE.
 *
 * 1. « 1668089662,5 FCFA » — les chiffres paraissaient collés. Ce n'était pas
 *    un séparateur manquant : `toLocaleString('fr-FR')` en produit bien trois,
 *    mais ce sont des ESPACES FINES INSÉCABLES (U+202F). Beaucoup de polices de
 *    système les rendent quasi nulles, voire pas du tout — et le montant se lit
 *    alors d'un bloc. On les remplace par l'espace insécable ordinaire (U+00A0),
 *    universellement dessinée, qui garde la propriété qui compte : le nombre ne
 *    se coupe pas en fin de ligne.
 *
 * 2. « 000000k » sur l'axe des ordonnées. Le formateur divisait par mille et
 *    ajoutait « k » : 1 668 089 662 donnait « 1668090k », soit sept chiffres
 *    dans une gouttière de 60 px, tronquée à gauche. Un format fixe ne peut pas
 *    couvrir quatre ordres de grandeur — d'où l'échelle adaptative.
 *
 * Ces deux défauts ne se voyaient pas tant que la courbe plafonnait à 80 000.
 * Ils sont apparus quand elle a commencé à dire la vérité — 1,67 milliard.
 */

/** Espace fine insécable, mal rendue par nombre de polices système. */
const FINE_INSECABLE = / /g;
/** Espace insécable ordinaire : dessinée partout, et ne coupe pas le nombre. */
const INSECABLE = ' ';

/** Applique la convention française avec un séparateur réellement visible. */
function grouper(v: number, decimales: number): string {
  return v
    .toLocaleString('fr-FR', {
      minimumFractionDigits: decimales,
      maximumFractionDigits: decimales,
    })
    .replace(FINE_INSECABLE, INSECABLE);
}

/**
 * Montant complet, tel qu'on l'écrit dans une phrase ou un indicateur.
 *
 * LES DÉCIMALES DISPARAISSENT AU-DELÀ DU MILLION : « 31 660 104,5 FCFA »
 * affiche une précision au demi-franc sur trente millions, ce qui n'a aucun
 * sens de gestion et allonge le nombre là où il est déjà le plus long à lire.
 * En dessous, elles sont conservées : sur 12 500,50 FCFA, le centime compte.
 */
export function formatFcfa(valeur: number | string | null | undefined): string {
  const v = Number(valeur);
  if (!Number.isFinite(v)) return '—';
  const decimales = Math.abs(v) >= 1e6 ? 0 : (Number.isInteger(v) ? 0 : 2);
  return `${grouper(v, decimales)}${INSECABLE}FCFA`;
}

/**
 * Montant abrégé, pour les graduations d'axe et les étiquettes serrées.
 *
 * L'unité suit l'ordre de grandeur, et le nombre de décimales suit l'unité :
 * « 1,67 Md » porte autant d'information que « 1 668 089 662 » sur un axe, en
 * quatre fois moins de place. Au-delà de deux chiffres significatifs devant la
 * virgule, la décimale n'apporte plus rien et disparaît — « 250 M » et non
 * « 250,0 M ».
 */
export function formatMontantCourt(valeur: number | string | null | undefined): string {
  const v = Number(valeur);
  if (!Number.isFinite(v)) return '—';

  const abs = Math.abs(v);
  if (abs >= 1e9) return `${grouper(v / 1e9, abs >= 1e10 ? 0 : 2)}${INSECABLE}Md`;
  if (abs >= 1e6) return `${grouper(v / 1e6, abs >= 1e8 ? 0 : 1)}${INSECABLE}M`;
  if (abs >= 1e3) return `${grouper(Math.round(v / 1e3), 0)}${INSECABLE}k`;
  return grouper(Math.round(v), 0);
}

/** Nombre simple — effectifs, comptages — avec le même séparateur visible. */
export function formatNombre(valeur: number | string | null | undefined): string {
  const v = Number(valeur);
  if (!Number.isFinite(v)) return '—';
  return grouper(v, Number.isInteger(v) ? 0 : 2);
}
