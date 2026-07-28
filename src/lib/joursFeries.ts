// Jours fériés de Côte d'Ivoire — miroir TypeScript de services/joursFeries.service.js
// (backend). Utilisé uniquement pour l'aperçu d'échéancier affiché avant soumission ; le calcul
// définitif fait foi côté serveur.

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function toIso(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Algorithme de Meeus/Jones/Butcher (calendrier grégorien) — calcul exact de Pâques.
function calculerPaques(annee: number): Date {
  const a = annee % 19;
  const b = Math.floor(annee / 100);
  const c = annee % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mois = Math.floor((h + l - 7 * m + 114) / 31); // 1-indexé (3 = mars, 4 = avril)
  const jour = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(annee, mois - 1, jour);
}

function ajouterJours(date: Date, jours: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + jours);
  return d;
}

function joursFeriesFixes(annee: number): string[] {
  return [
    `${annee}-01-01`,
    `${annee}-05-01`,
    `${annee}-08-07`,
    `${annee}-08-15`,
    `${annee}-11-01`,
    `${annee}-11-15`,
    `${annee}-12-25`,
  ];
}

function joursFeriesMobilesChretiens(annee: number): string[] {
  const paques = calculerPaques(annee);
  return [
    toIso(ajouterJours(paques, 1)),
    toIso(ajouterJours(paques, 39)),
    toIso(ajouterJours(paques, 50)),
  ];
}

// Fêtes musulmanes : dates fixées par arrêté selon l'observation lunaire, non calculables par
// formule. À compléter dès confirmation officielle — ne jamais deviner une date ici.
const JOURS_FERIES_MUSULMANS_CONFIRMES = new Set<string>([
  // '2026-02-18',
]);

function estJourFerie(date: Date): boolean {
  const iso = toIso(date);
  const annee = date.getFullYear();
  if (joursFeriesFixes(annee).includes(iso)) return true;
  if (joursFeriesMobilesChretiens(annee).includes(iso)) return true;
  if (JOURS_FERIES_MUSULMANS_CONFIRMES.has(iso)) return true;
  return false;
}

export function estJourOuvrable(date: Date): boolean {
  const jourSemaine = date.getDay(); // 0 = dimanche, 6 = samedi
  if (jourSemaine === 0 || jourSemaine === 6) return false;
  return !estJourFerie(date);
}

export function prochainJourOuvrable(date: Date): Date {
  let d = new Date(date);
  while (!estJourOuvrable(d)) {
    d = ajouterJours(d, 1);
  }
  return d;
}
