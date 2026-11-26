/**
 * Carte étudiante IIPEA — rendu recto / verso fidèle aux maquettes officielles.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * RENDU UNIQUE
 * ─────────────────────────────────────────────────────────────────────────────
 * Ce fichier est le SEUL endroit où une carte est dessinée. L'espace étudiant
 * (« Ma carte étudiante ») et la génération en masse de la scolarité affichent
 * exactement ces composants : l'aperçu est donc identique au rendu imprimé, par
 * construction et non par ressemblance.
 *
 * Aucune couleur, aucune coordonnée, aucune mention n'est écrite ici : tout vient
 * de `GET /api/cartes-etudiantes/configuration`, qui sert
 * `config/carteEtudiante.config.js` côté serveur.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * UNITÉS & FORMAT ID-1 (ISO/IEC 7810)
 * ─────────────────────────────────────────────────────────────────────────────
 * Toutes les dimensions sont en MILLIMÈTRES (85,60 × 53,98 mm).
 * La règle `@page` garantit exactement une face par page sans déformation.
 */

import { useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Barcode128 } from '../../lib/barcode128';
import type { CarteEtudianteData, ConfigurationCartes } from '../../lib/cartesEtudiantes';

export const CARTE_LARGEUR_MM = 85.6;
export const CARTE_HAUTEUR_MM = 53.98;

/**
 * Mise en majuscules localisée (fr-FR).
 */
const majuscules = (texte: string | null | undefined): string =>
  (texte ?? '').toLocaleUpperCase('fr-FR');

const tailleSelonLongueur = (texte: string, paliers: [number, number][], defaut: number): number => {
  const n = (texte || '').length;
  for (const [longueurMax, taille] of paliers) if (n <= longueurMax) return taille;
  return defaut;
};

/** Découpe un texte pour mettre en valeur les expressions listées en configuration. */
const avecEmphases = (texte: string, emphases: string[]) => {
  if (!emphases?.length) return [{ texte, fort: false }];

  const motif = emphases
    .filter(Boolean)
    .map((e) => e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
  if (!motif) return [{ texte, fort: false }];

  return texte
    .split(new RegExp(`(${motif})`, 'g'))
    .filter((morceau) => morceau !== '')
    .map((morceau) => ({ texte: morceau, fort: emphases.includes(morceau) }));
};

// ─────────────────────────────────────────────────────────────────────────────
// Feuille de style unique
// ─────────────────────────────────────────────────────────────────────────────
export const STYLES_CARTE_ETUDIANTE = `
.ci-carte {
  position: relative;
  width: ${CARTE_LARGEUR_MM}mm;
  height: ${CARTE_HAUTEUR_MM}mm;
  border-radius: 3.18mm;
  overflow: hidden;
  box-sizing: border-box;
  font-family: 'Inter', 'DM Sans', 'Segoe UI', Arial, sans-serif;
  color: #1A1A1A;
  background: #FFFFFF;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.ci-carte * { box-sizing: border-box; margin: 0; padding: 0; }

.ci-apercu { transform-origin: top left; }

/* Blason en filigrane */
.ci-filigrane {
  position: absolute;
  right: 14mm;
  top: 48%;
  transform: translateY(-50%);
  width: 38mm;
  height: 38mm;
  object-fit: contain;
  opacity: 0.055;
  pointer-events: none;
}
.ci-filigrane--verso {
  right: 2mm;
  top: 55%;
  width: 36mm;
  height: 36mm;
  opacity: 0.065;
  filter: brightness(0) invert(1);
}

/* ─── RECTO ─────────────────────────────────────────────────────────────── */
.ci-recto { background: #FFFFFF; }
.ci-recto-teinte {
  position: absolute; inset: 0;
  background: linear-gradient(118deg, #FFFFFF 0%, #FFFFFF 56%, var(--ci-voile) 100%);
}

.ci-entete {
  position: relative;
  display: flex; align-items: center; justify-content: space-between;
  padding: 1.8mm 3.0mm 1.4mm 3.0mm;
}
.ci-marque { display: flex; align-items: center; gap: 1.8mm; flex: 1; min-width: 0; }
.ci-blason { width: 8.5mm; height: 8.5mm; object-fit: contain; flex: none; }
.ci-filet-vertical { width: 0.35mm; height: 7.2mm; background: var(--ci-or); flex: none; }
.ci-sigle-etab { font-size: 4.6mm; font-weight: 800; letter-spacing: 0.1mm; color: #15548F; line-height: 1; }
.ci-nom-etab { font-size: 1.35mm; font-weight: 600; color: #4A4A4A; line-height: 1.22; margin-top: 0.35mm; white-space: nowrap; }

.ci-entete-droite { display: flex; flex-direction: column; align-items: flex-end; gap: 0.7mm; flex: none; }
.ci-titre { font-size: 3.4mm; font-weight: 800; line-height: 0.95; text-align: right; letter-spacing: 0.04mm; color: #111111; }
.ci-badge-ecole {
  display: inline-flex; align-items: center; gap: 1.0mm;
  background: var(--ci-principal); color: #FFFFFF;
  border-radius: 4mm; padding: 0.35mm 0.5mm 0.35mm 1.8mm;
}
.ci-badge-nom { font-size: 1.55mm; font-weight: 700; letter-spacing: 0.02mm; white-space: nowrap; }
.ci-badge-code {
  background: var(--ci-or); color: var(--ci-profond);
  border-radius: 3mm; padding: 0.2mm 1.0mm;
  font-size: 1.45mm; font-weight: 800; letter-spacing: 0.08mm;
}

/* Ligne dorée horizontale continue sous l'en-tête */
.ci-filet-or-complet {
  position: relative;
  margin: 0 3.0mm;
  height: 0.35mm;
  background: var(--ci-or);
}

/* Corps du recto */
.ci-corps {
  position: relative;
  display: flex;
  align-items: flex-start;
  padding: 1.8mm 3.0mm 0 3.0mm;
}
.ci-photo-cadre {
  width: 17.8mm; height: 22.8mm; flex: none;
  border: 0.38mm solid var(--ci-or); border-radius: 1.4mm;
  overflow: hidden; background: #F2F4F6;
  display: flex; align-items: center; justify-content: center;
}
.ci-photo { width: 100%; height: 100%; object-fit: cover; display: block; }
.ci-photo-absente {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 0.6mm; width: 100%; height: 100%;
  background: repeating-linear-gradient(45deg, #EDEFF2 0 1.6mm, #E4E7EB 1.6mm 3.2mm);
}
.ci-photo-initiales { font-size: 5.6mm; font-weight: 800; color: #A8AEB6; line-height: 1; }
.ci-photo-mention { font-size: 1.25mm; font-weight: 600; color: #8A9099; letter-spacing: 0.02mm; text-align: center; }

/* Séparateur vertical doré entre photo et informations */
.ci-separateur-photo {
  width: 0.32mm;
  height: 24.5mm;
  background: var(--ci-or);
  opacity: 0.85;
  margin: 0 1.5mm;
  flex: none;
}

.ci-identite { flex: 1; min-width: 0; padding-top: 0.1mm; padding-right: 1.2mm; }
.ci-nom {
  font-weight: 800; color: var(--ci-principal); line-height: 1.05;
  letter-spacing: 0.03mm; overflow-wrap: anywhere;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.ci-prenoms {
  font-weight: 700; color: #1A1A1A; line-height: 1.08; margin-top: 0.45mm;
  overflow-wrap: anywhere;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}

.ci-champs { margin-top: 1.3mm; display: flex; flex-direction: column; gap: 0.95mm; }
.ci-champ { display: flex; align-items: baseline; }
.ci-champ-libelle {
  width: 14.5mm; flex: none;
  font-size: 1.5mm; font-weight: 700; color: #555E6D;
  letter-spacing: 0.04mm; text-transform: uppercase; line-height: 1.2;
}
.ci-champ-deuxpoints { width: 1.2mm; text-align: center; color: #9CA3AF; font-size: 1.5mm; font-weight: 700; flex: none; }
.ci-champ-valeur { font-size: 2.15mm; font-weight: 700; color: #111827; line-height: 1.2; min-width: 0; flex: 1; overflow-wrap: anywhere; }
.ci-champ-valeur--filiere {
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  line-height: 1.18;
}
.ci-champ-valeur--code {
  color: var(--ci-principal); letter-spacing: 0.03mm;
  font-feature-settings: 'tnum';
  font-weight: 800;
}
.ci-champ-valeur--manquant { color: #C0392B; font-weight: 700; font-style: italic; }

.ci-qr-zone { width: 14.8mm; flex: none; display: flex; flex-direction: column; align-items: center; gap: 0.55mm; padding-top: 0.1mm; }
.ci-qr-cadre {
  width: 14.8mm; height: 14.8mm;
  background: #FFFFFF; border: 0.35mm solid var(--ci-principal);
  border-radius: 1.2mm; padding: 0.6mm;
  display: flex; align-items: center; justify-content: center;
}
.ci-qr-cadre svg { width: 100%; height: 100%; display: block; }
.ci-qr-etiquette {
  font-size: 1.1mm; font-style: italic; color: #737A84;
  text-align: center; line-height: 1.2;
  word-break: normal; overflow-wrap: break-word;
}

/* Bandeau de pied (Recto) */
.ci-pied { position: absolute; left: 0; right: 0; bottom: 0; height: 8.2mm; }
.ci-pied-vague { position: absolute; left: 0; right: 0; bottom: 0; width: 100%; height: 100%; display: block; }
.ci-pied-contenu {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center; gap: 1.6mm;
  padding: 0 2.0mm;
}
.ci-pied-bloc { display: flex; align-items: baseline; gap: 0.8mm; white-space: nowrap; }
.ci-pied-libelle { font-size: 1.5mm; font-weight: 600; color: rgba(255,255,255,0.85); letter-spacing: 0.05mm; }
.ci-pied-valeur { font-size: 1.8mm; font-weight: 800; color: #FFFFFF; letter-spacing: 0.04mm; }
.ci-pied-valeur--or { color: var(--ci-or-clair); }
.ci-pied-separateur { width: 0.28mm; height: 3.0mm; background: var(--ci-or); opacity: 0.85; flex: none; }

/* ─── VERSO ─────────────────────────────────────────────────────────────── */
.ci-verso { background: var(--ci-fonce); color: #FFFFFF; }

/* Découpe asymétrique supérieure et liseré doré coïncident */
.ci-verso-decoupe {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1;
}

.ci-verso-marque {
  position: absolute;
  left: 3.0mm;
  top: 1.8mm;
  display: flex;
  align-items: center;
  gap: 1.5mm;
  z-index: 2;
}
.ci-verso-textes {
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.ci-verso-ecole {
  font-size: 1.65mm;
  font-weight: 600;
  color: #2A2A2A;
  line-height: 1.15;
  margin-top: 0.25mm;
  white-space: nowrap;
}
.ci-verso-ecole--com {
  font-size: 1.45mm;
  letter-spacing: -0.02mm;
}
.ci-pastille {
  width: 5.4mm;
  height: 5.4mm;
  border-radius: 50%;
  background: var(--ci-principal);
  color: #FFFFFF;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.65mm;
  font-weight: 800;
  letter-spacing: 0.04mm;
  margin-left: 1.0mm;
  flex: none;
}
.ci-pastille--com {
  margin-left: 0.6mm;
  transform: translateY(0.2mm);
}

.ci-verso-corps {
  position: absolute;
  left: 3.0mm;
  right: 3.0mm;
  top: 13.5mm;
  bottom: 6.6mm;
  display: flex;
  gap: 2.2mm;
  z-index: 2;
}
.ci-verso-gauche {
  width: 44.0mm;
  flex: none;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}
.ci-verso-titre-ligne {
  display: flex;
  align-items: center;
  gap: 1.2mm;
  margin-bottom: 0.7mm;
}
.ci-verso-barre {
  width: 0.55mm;
  height: 2.8mm;
  background: var(--ci-or);
  flex: none;
  border-radius: 0.2mm;
}
.ci-verso-titre {
  font-size: 1.95mm;
  font-weight: 800;
  letter-spacing: 0.05mm;
  color: #FFFFFF;
  line-height: 1;
}

/* Cartouche Code-barres au verso */
.ci-cartouche-codebarre {
  background: #FFFFFF;
  border-radius: 1.5mm;
  padding: 1.0mm 2.0mm 0.8mm 2.0mm;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.4mm;
  box-shadow: 0 1px 3px rgba(0,0,0,0.22);
}
.ci-codebarre-svg {
  width: 100%;
  height: 7.2mm;
  display: block;
}
.ci-codebarre-texte {
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 1.55mm;
  font-weight: 700;
  letter-spacing: 0.3mm;
  color: #111111;
  text-align: center;
  line-height: 1;
}

/* Mentions légales sous le code-barres */
.ci-verso-textes-bloc {
  margin-top: 0.8mm;
  display: flex;
  flex-direction: column;
  gap: 0.55mm;
}
.ci-verso-texte {
  font-size: 1.28mm;
  line-height: 1.22;
  color: rgba(255,255,255,0.92);
}
.ci-verso-fort {
  font-weight: 700;
  color: var(--ci-or-clair);
}

/* Séparateur vertical doré entre gauche et droite */
.ci-verso-separateur-vertical {
  width: 0.32mm;
  background: var(--ci-or);
  opacity: 0.75;
  flex: none;
  margin: 0.8mm 0;
}

/* Colonne droite : Contacts utiles */
.ci-verso-droite {
  flex: 1;
  min-width: 0;
  padding-left: 0.6mm;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.ci-contacts-titre {
  font-size: 1.45mm;
  font-weight: 800;
  letter-spacing: 0.16mm;
  color: var(--ci-or);
  text-transform: uppercase;
  margin-bottom: 0.8mm;
}
.ci-contact {
  font-size: 1.45mm;
  line-height: 1.34;
  color: rgba(255,255,255,0.95);
  word-break: break-word;
}
.ci-contact-urgence {
  margin-top: 1.1mm;
}
.ci-contact-cle {
  font-size: 1.45mm;
  font-weight: 700;
  color: var(--ci-or-clair);
}

.ci-verso-filet {
  position: absolute;
  left: 3.0mm;
  right: 3.0mm;
  bottom: 5.4mm;
  height: 0.25mm;
  background: var(--ci-or);
  opacity: 0.9;
  z-index: 2;
}
.ci-verso-pied {
  position: absolute;
  left: 3.0mm;
  right: 3.0mm;
  bottom: 1.6mm;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 2mm;
  z-index: 2;
}
.ci-verso-pied-gauche {
  font-size: 1.75mm;
  font-weight: 800;
  color: #FFFFFF;
  letter-spacing: 0.04mm;
}
.ci-verso-pied-droite {
  font-size: 1.55mm;
  color: rgba(255,255,255,0.9);
  text-align: right;
}
.ci-verso-pied-droite b {
  color: var(--ci-or);
  font-weight: 700;
}
`;

type Props = {
  carte: CarteEtudianteData;
  configuration: ConfigurationCartes;
  blason?: string;
};

const BLASON_DEFAUT = '/logo.png';

/** Variables CSS de l'identité visuelle */
const variablesEcole = (
  carte: CarteEtudianteData,
  configuration: ConfigurationCartes
): React.CSSProperties =>
  ({
    '--ci-principal': carte.ecole.principal,
    '--ci-fonce': carte.ecole.fonce,
    '--ci-profond': carte.ecole.profond,
    '--ci-voile': `${carte.ecole.principal}14`,
    '--ci-or': configuration.or.principal,
    '--ci-or-clair': configuration.or.clair,
  }) as React.CSSProperties;

const initiales = (carte: CarteEtudianteData) =>
  majuscules(`${(carte.nom || '?').trim().charAt(0)}${(carte.prenoms || '').trim().charAt(0)}`);

/** Emplacement photo d'identité avec repli élégant */
const PhotoEtudiant = ({ carte }: { carte: CarteEtudianteData }) => {
  const [echec, setEchec] = useState(false);
  const absente = !carte.photo_url || echec;

  return (
    <div className="ci-photo-cadre">
      {absente ? (
        <div className="ci-photo-absente">
          <span className="ci-photo-initiales">{initiales(carte)}</span>
          <span className="ci-photo-mention">PHOTO MANQUANTE</span>
        </div>
      ) : (
        <img
          className="ci-photo"
          src={carte.photo_url as string}
          alt=""
          data-initiales={initiales(carte)}
          onError={() => setEchec(true)}
        />
      )}
    </div>
  );
};

const Valeur = ({ valeur, code = false }: { valeur: string | null; code?: boolean }) =>
  valeur ? (
    <span className={`ci-champ-valeur${code ? ' ci-champ-valeur--code' : ''}`}>{valeur}</span>
  ) : (
    <span className="ci-champ-valeur ci-champ-valeur--manquant">non renseigné</span>
  );

// ─────────────────────────────────────────────────────────────────────────────
// RECTO
// ─────────────────────────────────────────────────────────────────────────────
export const CarteRecto = ({ carte, configuration, blason = BLASON_DEFAUT }: Props) => {
  const tailleNom = tailleSelonLongueur(carte.nom || '', [[10, 4.4], [16, 3.8], [24, 3.2]], 2.8);
  const taillePrenoms = tailleSelonLongueur(
    carte.prenoms || '',
    [[14, 2.8], [24, 2.4], [34, 2.1]],
    1.9
  );
  const tailleFiliere = tailleSelonLongueur(carte.filiere || '', [[16, 2.15], [26, 1.9], [38, 1.7]], 1.5);

  return (
    <div className="ci-carte ci-recto" style={variablesEcole(carte, configuration)}>
      <div className="ci-recto-teinte" />
      <img className="ci-filigrane" src={blason} alt="" aria-hidden />

      {/* 1. En-tête */}
      <div className="ci-entete">
        <div className="ci-marque">
          <img className="ci-blason" src={blason} alt="" aria-hidden />
          <div className="ci-filet-vertical" />
          <div>
            <div className="ci-sigle-etab">{configuration.etablissement.sigle}</div>
            <div className="ci-nom-etab">
              Institut International
              <br />
              Polytechnique des Élites d'Abidjan
            </div>
          </div>
        </div>

        <div className="ci-entete-droite">
          <div className="ci-titre">
            CARTE
            <br />
            ÉTUDIANTE
          </div>
          <div className="ci-badge-ecole">
            <span className="ci-badge-nom">{carte.ecole.nom}</span>
            <span className="ci-badge-code">{carte.ecole.code}</span>
          </div>
        </div>
      </div>

      {/* Ligne dorée horizontale continue sous l'en-tête */}
      <div className="ci-filet-or-complet" />

      {/* 2. Zone principale */}
      <div className="ci-corps">
        <PhotoEtudiant key={carte.photo_url ?? `sans-photo-${carte.etudiant_id}`} carte={carte} />

        {/* Séparateur vertical doré entre photo et informations */}
        <div className="ci-separateur-photo" />

        <div className="ci-identite">
          <div className="ci-nom" style={{ fontSize: `${tailleNom}mm` }}>
            {majuscules(carte.nom) || '—'}
          </div>
          <div className="ci-prenoms" style={{ fontSize: `${taillePrenoms}mm` }}>
            {majuscules(carte.prenoms)}
          </div>

          <div className="ci-champs">
            <div className="ci-champ">
              <span className="ci-champ-libelle">N° étudiant</span>
              <span className="ci-champ-deuxpoints">:</span>
              <Valeur valeur={majuscules(carte.numero_etudiant) || null} code />
            </div>
            <div className="ci-champ">
              <span className="ci-champ-libelle">Né(e) le</span>
              <span className="ci-champ-deuxpoints">:</span>
              <Valeur valeur={carte.date_naissance} />
            </div>
            <div className="ci-champ">
              <span className="ci-champ-libelle">Filière</span>
              <span className="ci-champ-deuxpoints">:</span>
              {carte.filiere ? (
                <span
                  className="ci-champ-valeur ci-champ-valeur--filiere"
                  style={{ fontSize: `${tailleFiliere}mm` }}
                  title={carte.filiere}
                >
                  {carte.filiere}
                </span>
              ) : (
                <Valeur valeur={null} />
              )}
            </div>
            <div className="ci-champ">
              <span className="ci-champ-libelle">Matricule IP</span>
              <span className="ci-champ-deuxpoints">:</span>
              <Valeur valeur={majuscules(carte.matricule_ip) || null} code />
            </div>
          </div>
        </div>

        <div className="ci-qr-zone">
          <div className="ci-qr-cadre">
            <QRCodeSVG
              value={carte.verification_url}
              level="M"
              marginSize={0}
              bgColor="#FFFFFF"
              fgColor="#111111"
            />
          </div>
          <div className="ci-qr-etiquette">{configuration.verification.etiquette}</div>
        </div>
      </div>

      {/* 3. Bande inférieure */}
      <div className="ci-pied">
        <svg className="ci-pied-vague" viewBox="0 0 856 85" preserveAspectRatio="none">
          <defs>
            <linearGradient id={`ci-pd-${carte.etudiant_id}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={carte.ecole.fonce} />
              <stop offset="100%" stopColor={carte.ecole.principal} />
            </linearGradient>
          </defs>
          <path
            d="M0,22 L490,22 C610,22 650,0 760,0 L856,0 L856,85 L0,85 Z"
            fill={`url(#ci-pd-${carte.etudiant_id})`}
          />
          <path
            d="M0,22 L490,22 C610,22 650,0 760,0 L856,0"
            fill="none"
            stroke={configuration.or.principal}
            strokeWidth="2.8"
          />
        </svg>

        <div className="ci-pied-contenu">
          <div className="ci-pied-bloc">
            <span className="ci-pied-libelle">NIVEAU</span>
            <span className="ci-pied-valeur">{carte.niveau || '—'}</span>
          </div>
          <div className="ci-pied-separateur" />
          <div className="ci-pied-bloc">
            <span className="ci-pied-libelle">ANNÉE</span>
            <span className="ci-pied-valeur">{carte.annee_academique || '—'}</span>
          </div>
          <div className="ci-pied-separateur" />
          <div className="ci-pied-bloc">
            <span className="ci-pied-libelle">VALABLE JUSQU'AU</span>
            <span className="ci-pied-valeur ci-pied-valeur--or">{carte.valable_jusquau || '—'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// VERSO
// ─────────────────────────────────────────────────────────────────────────────
export const CarteVerso = ({ carte, configuration, blason = BLASON_DEFAUT }: Props) => {
  const { mentions_verso: mentions, etablissement } = configuration;
  const contacts = etablissement.contacts;

  const codeBarreValeur = carte.numero_etudiant || 'IIPEA';

  const paragraphes = useMemo(
    () => mentions.corps.map((texte) => avecEmphases(texte, mentions.emphases)),
    [mentions]
  );

  return (
    <div className="ci-carte ci-verso" style={variablesEcole(carte, configuration)}>
      <img className="ci-filigrane ci-filigrane--verso" src={blason} alt="" aria-hidden />

      {/* 1. Grande découpe courbe blanche asymétrique avec son liseré doré coïncident */}
      <svg
        className="ci-verso-decoupe"
        viewBox="0 0 856 540"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M 0,0 L 0,119.5 L 307,119.5 C 430,119.5 420,0 505,0 L 0,0 Z"
          fill="#FFFFFF"
        />
        <path
          d="M 0,119.5 L 307,119.5 C 430,119.5 420,0 505,0"
          fill="none"
          stroke={configuration.or.principal}
          strokeWidth="2.8"
          strokeLinecap="round"
        />
      </svg>

      {/* 2. En-tête : Blason IIPEA, séparateur vertical or, sigle IIPEA, école et pastille */}
      <div className="ci-verso-marque">
        <img className="ci-blason" src={blason} alt="Blason IIPEA" />
        <div className="ci-filet-vertical" />
        <div className="ci-verso-textes">
          <span className="ci-sigle-etab">{etablissement.sigle}</span>
          <span className={`ci-verso-ecole${carte.ecole.code === 'COM' ? ' ci-verso-ecole--com' : ''}`}>
            {carte.ecole.nom}
          </span>
        </div>
        <div className={`ci-pastille${carte.ecole.code === 'COM' ? ' ci-pastille--com' : ''}`}>
          {carte.ecole.code}
        </div>
      </div>

      <div className="ci-verso-corps">
        <div className="ci-verso-gauche">
          <div>
            <div className="ci-verso-titre-ligne">
              <div className="ci-verso-barre" />
              <div className="ci-verso-titre">{mentions.titre}</div>
            </div>

            {/* Cartouche Code-barres horizontal blanc */}
            <div className="ci-cartouche-codebarre">
              <Barcode128 value={codeBarreValeur} className="ci-codebarre-svg" />
              <span className="ci-codebarre-texte">{codeBarreValeur}</span>
            </div>
          </div>

          {/* Mentions légales sous le code-barres */}
          <div className="ci-verso-textes-bloc">
            {paragraphes.map((morceaux, i) => (
              <p className="ci-verso-texte" key={i}>
                {morceaux.map((m, j) =>
                  m.fort ? (
                    <span className="ci-verso-fort" key={j}>
                      {m.texte}
                    </span>
                  ) : (
                    <span key={j}>{m.texte}</span>
                  )
                )}
              </p>
            ))}
          </div>
        </div>

        {/* Séparateur vertical doré */}
        <div className="ci-verso-separateur-vertical" />

        {/* Colonne latérale droite de contacts */}
        <div className="ci-verso-droite">
          <div className="ci-contacts-titre">Contacts utiles</div>
          <div className="ci-contact">Scolarité : {contacts.scolarite_telephone}</div>
          <div className="ci-contact">{contacts.scolarite_email}</div>
          <div className="ci-contact">{contacts.site}</div>
          <div className="ci-contact ci-contact-urgence">
            <span className="ci-contact-cle">Urgence campus :</span>
            <br />
            {contacts.urgence_telephone}
          </div>
        </div>
      </div>

      {/* Filet doré horizontal du pied */}
      <div className="ci-verso-filet" />

      {/* Pied du verso */}
      <div className="ci-verso-pied">
        <span className="ci-verso-pied-gauche">VALIDITÉ : {carte.valable_jusquau || '—'}</span>
        {/* Site de rattachement DE L'ÉTUDIANT (donnée de sa carte, pas de l'agent
            qui imprime). Inconnu : tiret, comme la validité — jamais un site par défaut. */}
        <span className="ci-verso-pied-droite">
          <b>{carte.site || '—'}</b>
        </span>
      </div>
    </div>
  );
};

/**
 * Rendu pour l'impression : recto puis verso, chacun dans sa page.
 */
export const CarteRectoVerso = ({ carte, configuration, blason }: Props) => (
  <>
    <div className="ci-page" data-face="recto">
      <CarteRecto carte={carte} configuration={configuration} blason={blason} />
    </div>
    <div className="ci-page" data-face="verso">
      <CarteVerso carte={carte} configuration={configuration} blason={blason} />
    </div>
  </>
);
