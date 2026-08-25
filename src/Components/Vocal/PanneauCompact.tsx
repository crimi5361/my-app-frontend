/**
 * Le panneau ancré à la mascotte : ce qui vient d'être dit, de part et d'autre.
 *
 * CE QU'IL MONTRE, ET CE QU'IL NE MONTRE PAS. La transcription en cours et les
 * derniers tours, rien de plus. Les graphiques et les fiches passent par les
 * modales — un classement de trente-trois agents dans un panneau de 340 px
 * serait illisible, et c'est précisément ce qu'on a corrigé au bloc 3.
 *
 * IL NE COUPE PAS LA SESSION. Le refermer masque le panneau, pas la
 * conversation : la mascotte reste animée, le cadre reste allumé, l'assistante
 * continue d'écouter. C'est la différence entre « je n'ai plus besoin de lire »
 * et « j'ai fini de parler » — deux intentions distinctes, deux gestes
 * distincts.
 *
 * L'AFFICHAGE DU TEXTE EST DÉLIBÉRÉMENT SIMPLE ici. L'écran vocal déroule les
 * mots au rythme de la voix ; ce panneau affiche le texte tel quel. Reproduire
 * l'animation demanderait la boucle d'images et la référence d'avancement, pour
 * un cadre de quelques lignes qu'on lit d'un coup d'œil. Le compromis est
 * assumé : la page vocale reste l'endroit où l'on regarde parler l'assistante.
 */
import { useEffect, useRef, useState } from 'react';
import { X, Loader2, Database, Volume2, Mic, MicOff } from 'lucide-react';
import { useVocalOptionnel } from '../../lib/ContexteVocal';
import './PanneauCompact.css';

/** Ce que l'écran annonce, par état. Repris de ModeVocal pour rester cohérent. */
const LIBELLES: Record<string, string> = {
  connexion: 'Liaison en cours',
  ecoute: 'À votre écoute',
  reflexion: 'Lecture de la base',
  construction: 'Assemblage du visuel',
  parle: 'Transmission',
  erreur: 'Liaison interrompue',
};

/** Les derniers tours suffisent : au-delà, on relit une conversation, on ne
 *  suit plus un échange. La page vocale garde le fil complet. */
const TOURS_AFFICHES = 6;

const PanneauCompact = () => {
  const session = useVocalOptionnel();
  const [ferme, setFerme] = useState(false);
  const fil = useRef<HTMLDivElement>(null);

  const tours = session?.tours;
  const statut = session?.statut ?? 'inactif';

  // Le dernier tour reste visible sans que le fondateur ait à faire défiler.
  useEffect(() => {
    fil.current?.scrollTo({ top: fil.current.scrollHeight, behavior: 'smooth' });
  }, [tours]);

  // Une nouvelle session rouvre le panneau : refermer vaut pour la
  // conversation en cours, pas pour toutes les suivantes.
  useEffect(() => {
    if (statut === 'inactif') setFerme(false);
  }, [statut]);

  if (!session || statut === 'inactif' || ferme) return null;

  const derniers = (tours ?? []).slice(-TOURS_AFFICHES);
  const Icone = statut === 'reflexion' ? Database
    : statut === 'parle' ? Volume2
      : statut === 'connexion' ? Loader2 : Mic;

  return (
    <section className="pc-panneau" aria-label="Conversation avec l'assistante">
      <header className="pc-entete">
        <span className={`pc-etat pc-etat-${statut}`}>
          <Icone size={13} className={statut === 'connexion' ? 'pc-tourne' : undefined} />
          {LIBELLES[statut] ?? statut}
        </span>

        <div className="pc-actions">
          <button
            type="button"
            className={`pc-micro${session.micCoupe ? ' est-coupe' : ''}`}
            onClick={session.basculerMicro}
            aria-pressed={session.micCoupe}
            aria-label={session.micCoupe ? 'Réactiver le micro' : 'Couper le micro'}
            title={session.micCoupe ? 'Réactiver le micro' : 'Couper le micro'}
          >
            {session.micCoupe ? <MicOff size={14} /> : <Mic size={14} />}
          </button>

          {/* Ferme le PANNEAU, jamais la session — voir l'en-tête du fichier. */}
          <button
            type="button"
            className="pc-fermer"
            onClick={() => setFerme(true)}
            aria-label="Masquer le panneau, sans couper la conversation"
            title="Masquer le panneau (la conversation continue)"
          >
            <X size={14} />
          </button>
        </div>
      </header>

      <div className="pc-fil" ref={fil}>
        {derniers.length === 0 && (
          <p className="pc-vide">Posez votre question à voix haute.</p>
        )}
        {derniers.map((t) => (
          <p
            key={t.id}
            className={`pc-tour pc-${t.rôle}${t.partiel ? ' est-partiel' : ''}`}
          >
            {t.texteFinal ?? t.texte}
          </p>
        ))}
      </div>

      {session.erreur && <p className="pc-erreur">{session.erreur}</p>}
    </section>
  );
};

export default PanneauCompact;
