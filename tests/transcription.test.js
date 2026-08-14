// Correction de la dictée, côté navigateur (2026-08-14).
//
// Cette implémentation double celle du serveur, pour une raison expliquée dans
// src/lib/transcription.ts : la dictée du chat écrit ne passe jamais par le
// serveur. Le risque d'une implémentation double, c'est la DÉRIVE — les deux
// canaux qui se mettent à corriger différemment.
//
// Le corpus ci-dessous est donc le même que celui de
// my-app-backend/tests/assistantTranscription.test.js, avec les mêmes attentes.
// Si l'un des deux change, l'autre doit tomber.
import test from 'node:test';
import assert from 'node:assert/strict';
import { corrigerTranscription, estQuestion, CONFIG_VIDE } from '../src/lib/transcription.ts';

/** Reflet de config/vocabulaireMetier.js côté serveur, tel que servi par
 *  GET /api/assistant/vocabulaire. */
const CONFIG = {
  sigles: {
    iipea: 'IIPEA', bts: 'BTS', lmd: 'LMD', ects: 'ECTS', edt: 'EDT',
    cfa: 'CFA', rh: 'RH', pdf: 'PDF', crm: 'CRM', erp: 'ERP',
  },
  corrections: [
    { de: 'commentaire puis-je', vers: 'comment puis-je' },
    { de: 'vous athlete', vers: 'vous aider' },
    { de: 'i i p e a', vers: 'IIPEA' },
    { de: 'be te esse', vers: 'BTS' },
    { de: 'franc sefa', vers: 'francs CFA' },
    { de: 'francs sefa', vers: 'francs CFA' },
    { de: 'seh fa', vers: 'CFA' },
  ],
  ouvertures_question: [
    'combien', 'comment', 'pourquoi', 'quand', 'ou', 'qui', 'quoi',
    'quel', 'quelle', 'quels', 'quelles', 'est-ce', 'peux-tu', 'peut-on',
    'y a-t-il', 'as-tu', 'sais-tu',
  ],
};

const corriger = (t) => corrigerTranscription(t, CONFIG);

test('majuscule et point final sur une phrase nue', () => {
  assert.equal(corriger('le chiffre du mois est bon'), 'Le chiffre du mois est bon.');
});

test('une question reçoit un point d\'interrogation', () => {
  assert.equal(corriger('combien d\'inscrits cette annee'), "Combien d'inscrits cette annee ?");
  assert.equal(corriger('est-ce que la caisse est ouverte'), 'Est-ce que la caisse est ouverte ?');
});

test('les sigles sont rétablis en capitales', () => {
  assert.equal(corriger('combien de bts a iipea'), 'Combien de BTS a IIPEA ?');
  assert.equal(corriger('exporte en pdf'), 'Exporte en PDF.');
});

test('les confusions observées en production sont corrigées', () => {
  assert.equal(corriger('commentaire puis-je vous athlete'), 'Comment puis-je vous aider ?');
  assert.equal(corriger('Commentaire puis-je vous athlète'), 'Comment puis-je vous aider ?');
});

test('typographie française', () => {
  assert.equal(corriger('combien d\'inscrits?'), "Combien d'inscrits ?");
  assert.equal(corriger('attention !'), 'Attention !');
  assert.equal(corriger('  le   total  est  bon .'), 'Le total est bon.');
});

test('majuscule après chaque point', () => {
  assert.equal(
    corriger('le mois est bon. les encaissements montent'),
    'Le mois est bon. Les encaissements montent.',
  );
});

// ── Ce qui ne doit surtout pas bouger ──────────────────────────────────────

test('un sigle à l\'intérieur d\'un mot n\'est pas touché', () => {
  assert.equal(corriger('la marchandise est arrivee'), 'La marchandise est arrivee.');
});

test('les noms propres et les chiffres sont laissés tels quels', () => {
  assert.equal(corriger('Kone Ismael a valide 1 250 000 francs'), 'Kone Ismael a valide 1 250 000 francs.');
});

test('un texte vide reste vide', () => {
  for (const vide of ['', '   ', null, undefined]) assert.equal(corriger(vide), '');
});

test('aucun mot n\'est ajouté ni retiré hors corrections déclarées', () => {
  const brut = 'les effectifs de la filiere informatique sont stables cette annee';
  assert.equal(corriger(brut).replace(/[.?]$/, '').toLowerCase(), brut);
});

test('config vide : la mise en forme marche, sans correction de vocabulaire', () => {
  // Cas réel : l'appel à /api/assistant/vocabulaire a échoué. La dictée doit
  // rester utilisable.
  assert.equal(corrigerTranscription('le total est bon', CONFIG_VIDE), 'Le total est bon.');
  assert.equal(corrigerTranscription('combien de bts', CONFIG_VIDE), 'Combien de bts.');
});

test('estQuestion distingue les deux formes', () => {
  assert.equal(estQuestion('combien d\'etudiants', CONFIG.ouvertures_question), true);
  assert.equal(estQuestion('le total est bon', CONFIG.ouvertures_question), false);
  assert.equal(estQuestion('', CONFIG.ouvertures_question), false);
});
