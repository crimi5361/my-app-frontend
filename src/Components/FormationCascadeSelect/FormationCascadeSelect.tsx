import { useEffect, useState } from 'react';
import { Col, Form, Row, Select, Typography } from 'antd';
import { apiFetch } from '../../lib/api';

const { Option } = Select;
const { Text } = Typography;

interface Departement {
  id: number;
  nom: string;
  ecole_id: number;
  ecole_nom: string;
}

interface Niveau {
  id: number;
  libelle: string;
  prix_formation: string;
  /** Rang de progression du cycle. Déjà renvoyé par l'API, jusqu'ici inutilisé ici. */
  ordre?: number | null;
}

interface FiliereWithNiveaux {
  id: number;
  nom: string;
  sigle: string;
  departement_id: number | null;
  typefiliere_libelle: string;
  niveaux: Niveau[];
}

export interface FormationSelection {
  filiere_id?: number;
  niveau_id?: number;
}

interface Props {
  value?: FormationSelection;
  onChange?: (selection: FormationSelection) => void;
  disabled?: boolean;
  /** Appelé avec l'objet niveau complet (libellé, prix_formation) à chaque changement de niveau */
  onNiveauInfo?: (niveau: Niveau | null) => void;
  /** Appelé avec le type de filière (Universitaire/Professionnelles) et le libellé du niveau à chaque changement */
  onFormationInfo?: (info: { typeFiliereLibelle: string | null; niveauLibelle: string | null }) => void;
  /**
   * N'affiche que les niveaux d'entrée : 1ère année de chaque cycle (BTS 1, LICENCE 1,
   * LICENCE 1 PRO, MASTER 1, MASTER 1 PRO), plus les niveaux atteignables avec un diplôme obtenu
   * ailleurs — BTS 2, LICENCE 2, LICENCE 3 et MASTER 2. À utiliser uniquement pour la Nouvelle
   * inscription. Pour un Non affecté sur une filière professionnelle, LICENCE 2 PRO, LICENCE 3 PRO
   * et MASTER 2 PRO sont également proposés. Ne pas activer pour la Réinscription ni la gestion
   * académique.
   */
  premiereAnneeUniquement?: boolean;
  /**
   * Étudiant affecté par le Ministère : restreint encore le niveau, en plus de
   * premiereAnneeUniquement — LICENCE 1 (ou LICENCE 1 PRO) pour une filière universitaire
   * n'ayant pas cette distinction, BTS 1 ou LICENCE 1 PRO pour une filière professionnelle
   * (aucun Master/Master Pro, même en 1ère année), plus BTS 2, LICENCE 2 et LICENCE 3 dans les
   * deux cas. LICENCE 3 PRO reste exclu pour un affecté (voir NIVEAU_PRO_AFFECTE_ADMISSION_REGEX,
   * non modifié).
   * Chantier tarification PRO (2026-08-21) : LICENCE 1 PRO est désormais autorisé pour un
   * affecté (tarif dédié, voir controllers/tarif.controller.js) — LICENCE 2 PRO reste absent
   * de cette liste : ce n'est jamais un niveau d'entrée en nouvelle admission (progression =
   * réinscription). Sans effet si premiereAnneeUniquement n'est pas activé.
   */
  statutAffecte?: boolean;
}

// Règles de filtrage du niveau, copiées à l'origine depuis
// Components/AcademicCascadeSelect/AcademicCascadeSelect.tsx (pas partagées par import : les deux
// composants ont des flux de données inversés — École→Département→Filière là-bas, Filière→École→
// Département ici — copier cette logique isolée évite un couplage artificiel entre deux composants
// qui ne partagent que ce fragment).
//
// ⚠️ Depuis le chantier Master 2 (2026-10-19), les deux copies ne sont plus identiques : seule
// celle-ci connaît MASTER 2 / MASTER 2 PRO. La copie d'AcademicCascadeSelect n'a volontairement pas
// été touchée — son unique appelant (Pages/Gestion_academique/Filieres.tsx) ne passe ni
// `premiereAnneeUniquement` ni `statutAffecte`, ces expressions n'y sont donc jamais évaluées.
// À synchroniser le jour où ce composant servirait à une saisie d'admission.
// Chantier Master 2 (2026-10-19) : MASTER 2 rejoint BTS 2 / LICENCE 2 / LICENCE 3 — même cas de
// figure, un candidat qui entre directement à ce niveau avec le diplôme précédent (MASTER 1)
// obtenu dans un autre établissement. L'ancre finale `$` fait que « MASTER 2 PRO » n'est pas
// couvert ici : la variante professionnelle est traitée plus bas, comme LICENCE 2/3 PRO.
const NIVEAU_PREMIERE_ANNEE_REGEX = /^(?:(?:BTS|LICENCE|MASTER) 1( PRO)?|BTS 2|LICENCE 2|LICENCE 3|MASTER 2)$/i;
const NIVEAU_LICENCE_1_REGEX = /^(?:LICENCE 1|BTS 2|LICENCE 2|LICENCE 3)$/i;
// Chantier tarification PRO (2026-08-21) : un affecté sur une filière professionnelle peut
// désormais choisir BTS 1 OU LICENCE 1 PRO (avant : BTS 1 uniquement).
const NIVEAU_PRO_AFFECTE_ADMISSION_REGEX = /^(?:BTS 1|LICENCE 1 PRO|BTS 2|LICENCE 2)$/i;
// LICENCE 2 PRO, LICENCE 3 PRO et MASTER 2 PRO (diplôme précédent obtenu ailleurs) — uniquement
// pour les Non affecté, uniquement sur une filière professionnelle (cf. usage ci-dessous).
// MASTER 2 PRO ajouté avec le chantier Master 2 : les deux listes « affecté » restent volontairement
// inchangées, un étudiant affecté par le Ministère n'entre à aucun niveau de Master.
const NIVEAU_PRO_SUPERIEUR_NON_AFFECTE_REGEX = /^(?:LICENCE 2 PRO|LICENCE 3 PRO|MASTER 2 PRO)$/i;

/**
 * Sélecteur en cascade Filière → Niveau (Chantier 7, 2026-08-01), pour le formulaire
 * d'inscription/vérification/réinscription — remplace l'ordre École → Département → Filière →
 * Niveau de AcademicCascadeSelect (conservé tel quel pour le filtre de
 * Pages/Gestion_academique/Filieres.tsx, qui a besoin de l'ordre inverse).
 *
 * École et Département ne sont plus choisis par l'agent : ils sont déterminés automatiquement à
 * partir de la filière sélectionnée (filiere.departement_id → departement.ecole_id, tous deux
 * fiables à 100% en base au 2026-08-01) et affichés en lecture seule, pour confirmation visuelle
 * uniquement — comme avant ce chantier, ils ne sont jamais transmis au backend (l'inscription n'a
 * toujours utilisé que filiere_id/niveau_id).
 */
const FormationCascadeSelect = ({
  value,
  onChange,
  disabled = false,
  onNiveauInfo,
  onFormationInfo,
  premiereAnneeUniquement = false,
  statutAffecte = false,
}: Props) => {
  const [filieres, setFilieres] = useState<FiliereWithNiveaux[]>([]);
  const [departements, setDepartements] = useState<Departement[]>([]);
  const [loadingFilieres, setLoadingFilieres] = useState(false);
  const [loadingDepartements, setLoadingDepartements] = useState(false);

  const filiereId = value?.filiere_id;
  const niveauId = value?.niveau_id;

  useEffect(() => {
    setLoadingFilieres(true);
    apiFetch('/api/filieres/table/Filiere')
      .then(setFilieres)
      .catch(() => setFilieres([]))
      .finally(() => setLoadingFilieres(false));

    // Chargée une seule fois (pas de cascade séquentielle) : sert uniquement à résoudre
    // affichage École/Département à partir de la filière choisie.
    setLoadingDepartements(true);
    apiFetch('/api/departements')
      .then(setDepartements)
      .catch(() => setDepartements([]))
      .finally(() => setLoadingDepartements(false));
  }, []);

  const filiereSelectionnee = filiereId ? filieres.find(f => f.id === filiereId) : undefined;
  const departementResolu = filiereSelectionnee?.departement_id
    ? departements.find(d => d.id === filiereSelectionnee.departement_id)
    : undefined;

  const niveauxDeLaFiliere = filiereId
    ? (filiereSelectionnee?.niveaux ?? []).filter(n => {
        if (!premiereAnneeUniquement) return true;
        if (statutAffecte) {
          // Étudiant affecté : niveau(x) autorisé(s) selon le type de filière. L'exception
          // LICENCE 2 PRO / LICENCE 3 PRO (BTS/LICENCE 2 obtenu ailleurs) ne concerne que les
          // étudiants Non affecté — aucune filière Affecté n'y a droit ici.
          const estUniversitaire = filiereSelectionnee?.typefiliere_libelle === 'Universitaire';
          return estUniversitaire ? NIVEAU_LICENCE_1_REGEX.test(n.libelle) : NIVEAU_PRO_AFFECTE_ADMISSION_REGEX.test(n.libelle);
        }
        if (NIVEAU_PREMIERE_ANNEE_REGEX.test(n.libelle)) return true;
        if (filiereSelectionnee?.typefiliere_libelle === 'Professionnelles' && NIVEAU_PRO_SUPERIEUR_NON_AFFECTE_REGEX.test(n.libelle)) {
          return true;
        }
        return false;
      })
      /* Tri par rang de cycle. /api/filieres/table/Filiere agrège les niveaux sans ORDER BY —
         contrairement à sa variante « préparation », qui trie par `n.ordre NULLS LAST, n.libelle`.
         L'ordre d'affichage dépendait donc de l'ordre physique des lignes : il paraissait correct
         tant que MASTER 1 fermait la liste, et devient faux dès que MASTER 2 (id inférieur) s'y
         ajoute. Le tri est fait ici, sur le champ `ordre` déjà présent dans la charge utile, plutôt
         que dans l'endpoint, partagé avec d'autres écrans. */
      .slice()
      .sort((a, b) => {
        const oa = a.ordre ?? Number.MAX_SAFE_INTEGER;
        const ob = b.ordre ?? Number.MAX_SAFE_INTEGER;
        return oa !== ob ? oa - ob : a.libelle.localeCompare(b.libelle, 'fr');
      })
    : [];

  // Étudiant affecté : si le niveau déjà sélectionné n'est plus dans la liste autorisée
  // (changement de filière ou bascule Non affecté → Affecté après sélection), on le réinitialise
  // automatiquement pour empêcher toute combinaison invalide.
  useEffect(() => {
    if (!premiereAnneeUniquement || !niveauId) return;
    if (!niveauxDeLaFiliere.some(n => n.id === niveauId)) {
      onChange?.({ filiere_id: filiereId, niveau_id: undefined });
      onNiveauInfo?.(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statutAffecte, filiereId]);

  const handleFiliereChange = (id: number) => {
    onChange?.({ filiere_id: id, niveau_id: undefined });
    onNiveauInfo?.(null);
  };

  const handleNiveauChange = (id: number) => {
    onChange?.({ filiere_id: filiereId, niveau_id: id });
    const niveau = niveauxDeLaFiliere.find(n => n.id === id) ?? null;
    onNiveauInfo?.(niveau);
    onFormationInfo?.({
      typeFiliereLibelle: filiereSelectionnee?.typefiliere_libelle ?? null,
      niveauLibelle: niveau?.libelle ?? null,
    });
  };

  return (
    <Row gutter={12}>
      <Col span={8}>
        <Form.Item label="Filière" required>
          <Select
            placeholder="Sélectionner une filière"
            value={filieres.length > 0 ? filiereId : undefined}
            onChange={handleFiliereChange}
            loading={loadingFilieres}
            disabled={disabled}
            showSearch
            optionFilterProp="children"
            allowClear
          >
            {filieres.map(f => <Option key={f.id} value={f.id}>{f.nom} ({f.sigle})</Option>)}
          </Select>
        </Form.Item>
      </Col>
      <Col span={6}>
        <Form.Item label="Niveau" required>
          <Select
            placeholder="Sélectionner un niveau"
            value={niveauxDeLaFiliere.length > 0 ? niveauId : undefined}
            onChange={handleNiveauChange}
            disabled={disabled || !filiereId}
            allowClear
          >
            {niveauxDeLaFiliere.map(n => <Option key={n.id} value={n.id}>{n.libelle}</Option>)}
          </Select>
        </Form.Item>
      </Col>
      <Col span={5}>
        <Form.Item label="Département">
          <Text type={departementResolu ? undefined : 'secondary'}>
            {loadingDepartements ? '…' : (departementResolu?.nom || (filiereId ? 'Non renseigné' : '—'))}
          </Text>
        </Form.Item>
      </Col>
      <Col span={5}>
        <Form.Item label="École">
          <Text type={departementResolu ? undefined : 'secondary'}>
            {loadingDepartements ? '…' : (departementResolu?.ecole_nom || (filiereId ? 'Non renseigné' : '—'))}
          </Text>
        </Form.Item>
      </Col>
    </Row>
  );
};

export default FormationCascadeSelect;
