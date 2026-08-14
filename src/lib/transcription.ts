// Post-traitement de la dictée du chat écrit (2026-08-14).
//
// POURQUOI UNE SECONDE IMPLÉMENTATION. L'algorithme existe déjà côté serveur
// (services/assistantTranscription.js), où il corrige le mode vocal. Il est
// réécrit ici parce que la dictée du chat écrit passe par l'API Web Speech du
// NAVIGATEUR : le texte n'atteint jamais le serveur avant que le fondateur ne
// le relise et l'envoie. Corriger à l'aller-retour ajouterait une requête par
// bout de phrase dictée.
//
// Ce qui est dupliqué, c'est l'algorithme — une trentaine de lignes, stables.
// Ce qui ne l'est PAS, ce sont les données : les sigles et les corrections
// viennent de GET /api/assistant/vocabulaire, donc du même fichier de
// configuration que le mode vocal. Une correction ajoutée là-bas s'applique
// ici sans rien redéployer.
//
// L'API Web Speech n'accepte aucun biais de vocabulaire — c'est une limite du
// navigateur, pas un oubli. Le post-traitement est le seul levier disponible
// sur ce canal.

export interface ConfigTranscription {
  sigles: Record<string, string>;
  corrections: { de: string; vers: string }[];
  ouvertures_question: string[];
}

/** Configuration de repli, si l'appel au serveur échoue : la dictée doit
 *  continuer de fonctionner, simplement sans correction. */
export const CONFIG_VIDE: ConfigTranscription = {
  sigles: {},
  corrections: [],
  ouvertures_question: [],
};

const normaliser = (s: string): string => String(s || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase();

const echapper = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const ACCENTS: Record<string, string> = {
  a: 'àâä', e: 'éèêë', i: 'îï', o: 'ôö', u: 'ùûü', y: 'ÿ', c: 'ç',
};

function appliquerCorrections(texte: string, corrections: ConfigTranscription['corrections']): string {
  let sortie = texte;
  for (const { de, vers } of corrections) {
    const motif = new RegExp(
      `\\b${echapper(de).replace(/[aeiouyc]/g, (c) => `[${c}${ACCENTS[c] || ''}]`)}\\b`,
      'gi',
    );
    sortie = sortie.replace(motif, vers);
  }
  return sortie;
}

function appliquerSigles(texte: string, sigles: Record<string, string>): string {
  return texte.replace(/[\p{L}\p{M}]+/gu, (mot) => sigles[normaliser(mot)] || mot);
}

function capitaliser(texte: string): string {
  return texte.replace(/(^|[.!?]\s+)(\p{Ll})/gu, (_, avant: string, lettre: string) => avant + lettre.toUpperCase());
}

export function estQuestion(texte: string, ouvertures: string[]): boolean {
  const n = normaliser(texte).trim();
  if (!n) return false;
  if (n.includes('est-ce que') || n.includes('est-ce qu')) return true;
  return ouvertures.some((o) => n.startsWith(`${o} `) || n === o);
}

/**
 * Remet d'aplomb un texte dicté COMPLET.
 *
 * À n'appeler que sur un résultat définitif de la reconnaissance : appliqué à un
 * résultat provisoire, la capitalisation sauterait à chaque mot ajouté.
 */
export function corrigerTranscription(brut: string, config: ConfigTranscription): string {
  let texte = String(brut || '')
    .replace(/\s+/g, ' ')
    // Typographie française : pas d'espace avant la virgule et le point, un
    // espace avant les signes doubles.
    .replace(/\s+([,.])/g, '$1')
    .replace(/\s*([?!;:])/g, ' $1')
    .trim();
  if (!texte) return '';

  texte = appliquerCorrections(texte, config.corrections);
  texte = appliquerSigles(texte, config.sigles);
  texte = capitaliser(texte);

  if (!/[.!?…]$/.test(texte)) texte += estQuestion(texte, config.ouvertures_question) ? ' ?' : '.';
  return texte;
}
