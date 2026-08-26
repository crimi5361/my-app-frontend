// Ce que ce fichier protège : la console d'administration ne doit jamais
// s'ouvrir au fondateur, et les trois endroits qui la décrivent doivent rester
// d'accord entre eux.
//
// POURQUOI TROIS ENDROITS. Un écran vit dans trois listes indépendantes — la
// route, la tuile du hub, et le contrôle de rôle du serveur. Rien dans le code
// ne les relie : on peut parfaitement ouvrir la route à un rôle et l'oublier
// dans le hub, ou l'inverse. Le désaccord ne se voit alors qu'à l'usage, et du
// mauvais côté — quelqu'un atteint un écran qu'il ne devrait pas voir.
//
// POURQUOI CELUI-CI PLUS QUE LES AUTRES. Ces écrans parlent de modèles, de
// crédits et de facturation : précisément ce que l'assistante s'applique à taire
// devant le fondateur, jusque sous la question directe. Une seule ligne trop
// permissive annulerait cet effort d'un coup d'œil.
import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Le projet est en modules ES : `__dirname` n'existe pas, on le reconstruit.
const ICI = path.dirname(fileURLToPath(import.meta.url));
const lire = (...p) => fs.readFileSync(path.join(ICI, '..', ...p), 'utf8');

const ROUTES = lire('src', 'Components', 'AppRoutes', 'AppRoutes.tsx');
const ACCESS = lire('src', 'lib', 'access.ts');

/** Les chemins de la console tels que les routes les déclarent. */
function routesConsole() {
  const trouvees = [];
  const motif = /<Route\s+path="(\/console-assistant[^"]*)"\s+element=\{([\s\S]*?)\}\s*\/>/g;
  let m = motif.exec(ROUTES);
  while (m) {
    trouvees.push({ chemin: m[1], corps: m[2] });
    m = motif.exec(ROUTES);
  }
  return trouvees;
}

test('les deux écrans de la console sont bien déclarés', () => {
  const chemins = routesConsole().map((r) => r.chemin).sort();
  assert.deepStrictEqual(chemins, ['/console-assistant', '/console-assistant/donnees']);
});

test('aucune route de la console n\'est ouverte au fondateur', () => {
  for (const r of routesConsole()) {
    assert.match(
      r.corps,
      /requiredPermission=\{\["admin"\]\}/,
      `${r.chemin} : attendu requiredPermission={["admin"]} seul`,
    );
    assert.ok(
      !/fondateur/.test(r.corps),
      `${r.chemin} : le fondateur ne doit jamais entrer dans la console`,
    );
  }
});

test('la tuile du hub est réservée à l\'administrateur', () => {
  const bloc = ACCESS.match(/slug:\s*'console-assistant',[\s\S]*?\},/);
  assert.ok(bloc, 'aucune tuile « console-assistant » dans HUB_APPS');
  assert.match(bloc[0], /roles:\s*\['admin'\]/, 'la tuile doit être réservée au rôle admin');
  assert.ok(!/fondateur/.test(bloc[0]), 'le fondateur ne doit pas voir cette tuile');
});

test('la tuile du hub mène à une route qui existe', () => {
  const bloc = ACCESS.match(/slug:\s*'console-assistant',[\s\S]*?\},/)[0];
  const destination = bloc.match(/landingRoute:\s*'([^']+)'/);
  assert.ok(destination, 'la tuile ne déclare aucune destination');
  assert.ok(
    routesConsole().some((r) => r.chemin === destination[1]),
    `la tuile mène à ${destination[1]}, qui n'est déclarée nulle part dans les routes`,
  );
});

// Le pendant : l'assistante elle-même reste ouverte au fondateur. Verrouiller la
// console en fermant son assistante par la même occasion serait une régression
// que personne ne verrait avant lui.
test('l\'assistante reste ouverte au fondateur', () => {
  const assistant = ROUTES.match(/<Route\s+path="\/dashboard\/fondateur\/assistant"[\s\S]*?\/>/);
  assert.ok(assistant, 'route de l\'assistante introuvable');
  assert.match(assistant[0], /requiredPermission=\{\[[^\]]*"fondateur"[^\]]*\]\}/);
});
