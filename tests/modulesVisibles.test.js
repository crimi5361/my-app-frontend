// Ce que ce fichier protège : ce qui apparaît à l'écran, module par module.
//
// TROIS DÉCISIONS, PRISES LE 26 AOÛT 2026, ET QUI NE SE VOIENT PAS DANS LE CODE
// QUI LES APPLIQUE. « Chargé Pédagogique » et « Ressources Humaines » sont
// retirés de l'écran ; « Console de l'assistante » ne paraît qu'à
// l'administrateur. Rien, dans le hub ou le menu latéral, ne rappelle ces
// intentions : ils se contentent d'appeler un filtre. Sans ce fichier, remettre
// une tuile en circulation ne coûterait qu'une ligne, et personne ne le verrait.
//
// LE CAS DE LA CONSOLE EST À PART. Les autres modules refusés restent affichés,
// cadenassés : c'est voulu, cela dit ce que la plateforme sait faire. Mais une
// tuile « Console de l'assistante » cadenassée devant le fondateur lui apprend
// qu'une console existe et qu'on la lui refuse — c'est déjà trop, puisqu'il ne
// doit rien savoir de la technique qui le sert.
import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const lire = (...p) => fs.readFileSync(path.join(ICI, '..', ...p), 'utf8');

const ACCESS = lire('src', 'lib', 'access.ts');
const HUB = lire('src', 'Pages', 'Hub', 'Hub.tsx');
const SIDEMENU = lire('src', 'Components', 'Sidemenu', 'Sidemenu.tsx');

/**
 * Les deux modules retirés de l'écran, tels que la liste les déclare.
 *
 * On lit la source plutôt que d'importer : `access.ts` tire des icônes de
 * lucide-react, que node ne sait pas charger hors de Vite.
 */
function modulesMasques() {
  const m = ACCESS.match(/export const MODULES_MASQUES: string\[\] = \[([^\]]*)\]/);
  assert.ok(m, 'MODULES_MASQUES est introuvable dans access.ts');
  return m[1].split(',').map((x) => x.trim().replace(/'/g, '')).filter(Boolean);
}

test('les deux modules demandés sont bien déclarés masqués', () => {
  assert.deepStrictEqual(modulesMasques().sort(), ['charge_pedagogique', 'rh']);
});

test('le hub ne dresse plus la liste des tuiles lui-même', () => {
  // C'est le point qui rend le masquage effectif : tant que le hub parcourt
  // HUB_APPS directement, aucune décision de visibilité ne s'applique.
  assert.match(
    HUB,
    /appsVisiblesPour\(user\?\.role\)\.map/,
    'le hub doit parcourir appsVisiblesPour(role), et non HUB_APPS',
  );
  assert.ok(
    !/HUB_APPS\.map/.test(HUB),
    'le hub parcourt encore HUB_APPS directement : les modules masqués reparaîtraient',
  );
});

test('le menu latéral écarte les modules masqués', () => {
  assert.match(
    SIDEMENU,
    /\.filter\(\(item\) => !estMasque\(item\.key\)\)/,
    'le menu latéral doit écarter les modules masqués',
  );
});

test('la console de l\'assistante est déclarée discrète et réservée à l\'admin', () => {
  const bloc = ACCESS.match(/slug:\s*'console-assistant',[\s\S]*?\n  \},/);
  assert.ok(bloc, 'tuile « console-assistant » introuvable');
  assert.match(bloc[0], /discret:\s*true/, 'la console doit être discrète, pas seulement verrouillée');
  assert.match(bloc[0], /roles:\s*\['admin'\]/);
});

// Les deux règles ne se ressemblent pas et ne doivent pas être confondues :
// masqué = invisible pour tout le monde ; discret = invisible à qui n'y a pas
// droit. Les intervertir ferait disparaître la console à l'administrateur, ou
// reparaître les deux modules retirés.
test('« masqué » et « discret » restent deux règles distinctes', () => {
  const selecteur = ACCESS.match(/export function appsVisiblesPour[\s\S]*?\n\}/);
  assert.ok(selecteur, 'appsVisiblesPour est introuvable');
  assert.match(selecteur[0], /if \(estMasque\(app\.slug\)\) return false;/);
  assert.match(selecteur[0], /if \(app\.discret\) return app\.roles\.includes/);
});

// Le pendant : les autres modules refusés continuent d'apparaître cadenassés.
// Basculer tout le hub en « on ne montre que l'autorisé » serait un changement
// de parti pris qui n'a jamais été demandé.
test('les modules simplement refusés restent affichés, cadenassés', () => {
  assert.match(HUB, /hub-tile-lock/, 'le cadenas doit rester : les autres modules restent visibles');
  const selecteur = ACCESS.match(/export function appsVisiblesPour[\s\S]*?\n\}/)[0];
  assert.match(selecteur, /return true;/, 'tout ce qui n\'est ni masqué ni discret doit rester visible');
});
