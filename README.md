# IIPEA — Interface Agent (Frontend)

## A. Présentation du projet

Cette application est l'**interface interne** de la plateforme de gestion scolaire IIPEA : le poste de travail utilisé au quotidien par le personnel de l'établissement (agents de scolarité, caissiers, comptabilité, direction, moyens généraux) pour gérer l'ensemble du cycle de vie académique et financier d'un étudiant — admission, réinscription, paiement, gestion des filières/classes/groupes, statistiques, opérations administratives exceptionnelles.

**Public visé :** le personnel administratif et pédagogique de l'IIPEA, avec des vues et permissions adaptées à chaque rôle (admin, scolarité, caissier, comptabilité, fondateur, moyens généraux, étudiant pour l'espace dédié).

Ce projet est distinct du portail public (`IIpea`) utilisé par les candidats pour déposer une demande d'admission ou de réinscription en ligne — voir la section D.

## B. Technologies utilisées

| Catégorie | Choix |
|---|---|
| Langage | TypeScript |
| Framework | React 19 |
| Outil de build / dev server | Vite 6 |
| Composants UI | Ant Design 5 (composant principal), complété ponctuellement par MUI, Radix UI et Headless UI selon les écrans |
| Style | Tailwind CSS + CSS modules/inline selon les composants |
| Routage | React Router 7 |
| Graphiques / tableaux de bord | `@ant-design/charts`, `recharts` |
| Génération de documents côté client | `jspdf` / `jspdf-autotable` (exports PDF), `html2canvas`, `react-to-print`, `xlsx` (exports Excel) |
| QR codes | `qrcode.react` (cartes étudiant) |
| Formulaires | `react-hook-form` (ponctuel) + formulaires Ant Design (majoritaire) |
| Autres | `framer-motion` (animations), `date-fns`/`moment` (dates), `react-hot-toast` |
| Linting | ESLint 9 + `typescript-eslint` |

Pas de framework de test automatisé en place à ce jour.

## C. Architecture

```
src/
  main.tsx / App.tsx        → point d'entrée, montage du routeur et des providers globaux
  Components/
    AppRoutes/                → déclaration centralisée de toutes les routes de l'application
    Sidemenu/, Header/, PageHeader/, PageContent/, Layout/ → ossature visuelle commune
    ui/                       → composants UI génériques réutilisés dans toute l'application (DataTable, StatusTag, PageContainer, ...)
    FormationCascadeSelect/, AcademicCascadeSelect/ → sélecteurs filière→niveau→parcours réutilisés par plusieurs écrans
    FiliereParcoursDrawer/, ChangementPositionDrawer/, ChangementParcoursDrawer/ → composants métier de la gestion des filières et des opérations administratives
    ProtectedRoute.tsx        → garde d'accès basée sur le rôle de l'utilisateur connecté
  Pages/
    Hub/                      → écran d'accueil / sélection de module selon le rôle
    Etudiant/                 → admission, réinscription, vérification de dossier, dossier étudiant (opérations exceptionnelles), fiche étudiant
    Gestion_academique/       → filières, niveaux, classes, groupes, maquettes, années académiques, statistiques
    CAISSE/                   → encaissement, situation étudiant, fermeture de caisse
    Scolarite/                → paiements, reçus, statuts
    Dashboard/                → tableaux de bord par rôle (fondateur, administrateur, comptabilité, scolarité, moyens généraux)
    MoyensGeneraux/, Kit/     → gestion des accessoires, fournisseurs, stock, distribution, kits scolaires
    ESPACE_ETUDIANT/          → espace self-service pour l'étudiant connecté
    Parametres/                → gestion des utilisateurs, rôles, paramétrage
  lib/
    api.ts                     → client HTTP unique (fetch authentifié, gestion de session expirée, normalisation des erreurs)
    access.ts                  → règles d'accès par rôle
    referenceData.ts, echeancier.ts, joursFeries.ts → helpers métier partagés
  context/                    → contextes React globaux (session utilisateur, etc.)
  theme/                      → configuration du thème Ant Design
```

**Convention :** tout appel réseau passe par `apiFetch` (`src/lib/api.ts`), qui centralise l'ajout du token JWT, la détection de session expirée (redirection vers `/login`) et la normalisation des erreurs (`ApiError`).

## D. Communication avec les autres applications

```
┌───────────────────────┐        ┌──────────────────────────┐
│   my-app-frontend      │  HTTP  │      my-app-backend       │
│   (ce projet)           │ ─────▶ │   API Express (port 5000)  │
│   React + Vite (5173)   │ ◀───── │                             │
└───────────────────────┘        └──────────────────────────┘
```

- **API consommée :** l'intégralité des endpoints exposés par `my-app-backend` (`/api/*`) — aucune autre source de données. L'URL de base est configurée via la variable d'environnement `VITE_API_URL_SERVER`.
- **Authentification :** connexion via `POST /api/auth/login`, token JWT stocké côté client et transmis en en-tête `Authorization: Bearer` sur chaque requête (`apiFetch`).
- **Aucune API n'est exposée** par ce projet — c'est une application cliente pure (SPA), sans serveur applicatif propre en dehors du serveur de développement Vite / des fichiers statiques servis en production.
- **Relation avec `IIpea` (portail public) :** aucune communication directe entre les deux frontends. Le lien se fait uniquement via le backend commun : une demande d'admission ou de réinscription déposée sur le portail public apparaît dans cette interface (files d'attente "Inscriptions en attente", "Vérification") pour validation par un agent avant activation du paiement.

## E. Configuration

### Variables d'environnement

- `VITE_API_URL_SERVER` — URL de base de l'API backend (ex. `http://localhost:5000` en local, URL de production sinon). Définie dans `.env.local` / `.env.production` (non versionnés).

### Ports

| Environnement | Port |
|---|---|
| Serveur de développement (`vite`) | `5173` |

### Commandes

```bash
npm install       # installation des dépendances
npm run dev         # serveur de développement Vite (HMR)
npm run build        # vérification TypeScript (tsc -b) puis build de production Vite
npm run preview      # sert localement le build de production pour vérification
npm run lint          # ESLint
```

## F. Déploiement

1. **Local** : renseigner `.env.local` (`VITE_API_URL_SERVER` pointant vers le backend local), puis `npm install && npm run dev`.
2. **Build de production** : `npm run build` — génère le dossier `dist/` (fichiers statiques). `VITE_API_URL_SERVER` doit pointer vers l'API de production au moment du build (les variables Vite sont injectées à la compilation, pas à l'exécution).
3. **Mise à jour** : `git pull`, `npm install` (si dépendances modifiées), `npm run build`, puis republier le contenu de `dist/` sur l'hébergement statique.

## G. Historique de la V1

**Version : V1**

- Refonte complète de la page **Gestion des filières**, devenue la page officielle de préparation d'une rentrée académique (sélecteur d'année, état de préparation visible par filière, configuration progressive des niveaux/parcours/tarifs sans notion de duplication).
- Stabilisation des écrans d'**admission** et de **réinscription** (agent), avec parité confirmée face au portail public.
- Nouvel espace **Dossier étudiant — Opérations exceptionnelles** : changement de filière, changement de parcours, changement de cycle, chacun avec vérifications métier et affichage explicite des conséquences avant validation (statut scolaire, tarif, classe cible).
- Historique des opérations administratives consultable directement depuis la fiche étudiant.
- Migration des **tableaux de bord** par rôle (fondateur, administrateur, comptabilité, scolarité, moyens généraux) sur les données historisées du backend.
- Finalisation de l'expérience utilisateur V1 sur l'ensemble des parcours académiques et financiers.
