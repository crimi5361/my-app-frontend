/**
 * La session vocale, remontée au niveau du shell applicatif.
 *
 * POURQUOI. Jusqu'ici la session vivait dans la mémoire de `ModeVocal`, monté en
 * surcouche de la page assistant : quitter cette page tuait la conversation. Le
 * fondateur ne pouvait pas parler à son assistante tout en naviguant dans son
 * tableau de bord — ce qui est précisément l'usage visé.
 *
 * Le fournisseur est monté dans `Layout`, autour de `{children}`. `Layout`
 * enveloppe toutes les routes du tableau de bord et reste monté d'une route à
 * l'autre : seul le `<Routes>` interne change de page. La session survit donc aux
 * navigations, et se démonte proprement à la déconnexion, quand `Layout` cède la
 * place à la redirection vers /login.
 *
 * ═══ UN SEUL POINT D'INSTANCIATION, ET C'EST VITAL ═══
 *
 * Le serveur n'autorise QU'UNE session vocale par utilisateur : il ferme
 * silencieusement l'ancienne au profit de la nouvelle
 * (assistantVocal.service.js, `sessionsOuvertes`). Si deux composants appelaient
 * chacun `useAssistantVocal()`, la seconde instance tuerait la première — et le
 * symptôme serait incompréhensible : un micro qui s'éteint sans raison, une
 * conversation qui se fige. `useAssistantVocal()` n'est donc appelé QU'ICI.
 * Tout le reste consomme ce contexte.
 *
 * ═══ ACCÈS PAR RÔLE ═══
 *
 * `Layout` enveloppe toutes les routes pour TOUS les rôles — un caissier, un
 * enseignant, un agent des moyens généraux passent par lui. La liste ci-dessous
 * reprend celle du serveur (`ROLES_AUTORISES`) : hors de ces deux rôles, aucune
 * session n'est instanciée, et le contexte vaut `null`. Le bouton flottant et le
 * cadre néon disparaissent d'eux-mêmes, sans avoir à le vérifier ailleurs.
 *
 * Le contrôle d'accès RÉEL reste côté serveur, qui refuse la connexion WebSocket
 * avec un 403. Celui-ci ne fait qu'éviter d'afficher une porte fermée.
 */
import { createContext, ReactNode, useContext } from 'react';
import { useAssistantVocal } from './useAssistantVocal';
import BoutonMascotte from '../Components/Vocal/BoutonMascotte';
import CadreNeon from '../Components/Vocal/CadreNeon';

export type SessionVocale = ReturnType<typeof useAssistantVocal>;

const ContexteVocal = createContext<SessionVocale | null>(null);

/** Miroir de ROLES_AUTORISES dans assistantVocal.service.js. */
const ROLES_ASSISTANT = new Set(['admin', 'fondateur']);

export const roleAAccesVocal = (role?: string | null): boolean =>
  ROLES_ASSISTANT.has(String(role || ''));

/**
 * Instancie la session. Composant séparé pour que le hook — et son minuteur de
 * surveillance du micro — ne tourne que pour les rôles concernés.
 */
const SessionActive = ({ children }: { children: ReactNode }) => {
  const session = useAssistantVocal();
  return (
    <ContexteVocal.Provider value={session}>
      {children}
      {/* Montés ICI et non dans une page : ils doivent suivre le fondateur d'un
          écran à l'autre. Sous le fournisseur, donc ils lisent la session sans
          jamais en créer une seconde. */}
      <BoutonMascotte />
      <CadreNeon />
    </ContexteVocal.Provider>
  );
};

export const FournisseurVocal = ({
  role, children,
}: {
  role?: string | null;
  children: ReactNode;
}) => {
  if (!roleAAccesVocal(role)) {
    // Contexte présent mais vide : les consommateurs facultatifs s'effacent
    // sans erreur, et `useVocal()` lève si quelqu'un l'appelle quand même.
    return <ContexteVocal.Provider value={null}>{children}</ContexteVocal.Provider>;
  }
  return <SessionActive>{children}</SessionActive>;
};

/**
 * Pour les écrans qui ne fonctionnent PAS sans session — `ModeVocal`. Lève
 * plutôt que de rendre un objet vide : une erreur nommée au montage vaut mieux
 * qu'un écran qui ne réagit à rien.
 */
export function useVocal(): SessionVocale {
  const session = useContext(ContexteVocal);
  if (!session) {
    throw new Error(
      "Session vocale absente. Ce composant doit être rendu sous <FournisseurVocal>, "
      + "et l'utilisateur doit avoir un rôle autorisé (admin ou fondateur).",
    );
  }
  return session;
}

/**
 * Pour ce qui s'affiche PARTOUT et doit disparaître sans bruit quand le rôle
 * n'y a pas droit : le bouton flottant, le cadre néon.
 */
export function useVocalOptionnel(): SessionVocale | null {
  return useContext(ContexteVocal);
}
