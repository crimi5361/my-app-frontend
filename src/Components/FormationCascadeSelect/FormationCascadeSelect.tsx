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
   * N'affiche que les niveaux de 1ère année de chaque cycle (BTS 1, LICENCE 1, LICENCE 1 PRO,
   * MASTER 1, MASTER 1 PRO) — à utiliser uniquement pour la Nouvelle inscription, qui ne concerne
   * jamais un niveau supérieur. Ne pas activer pour la Réinscription ni la gestion académique.
   */
  premiereAnneeUniquement?: boolean;
  /**
   * Étudiant affecté par le Ministère : restreint encore le niveau, en plus de
   * premiereAnneeUniquement — LICENCE 1 uniquement pour une filière universitaire, BTS 1
   * uniquement pour une filière professionnelle (aucune Licence Pro/Master/Master Pro, même
   * en 1ère année). Sans effet si premiereAnneeUniquement n'est pas activé.
   */
  statutAffecte?: boolean;
}

// Règles de filtrage du niveau identiques à Components/AcademicCascadeSelect/AcademicCascadeSelect.tsx
// (copiées, pas partagées par import : les deux composants ont des flux de données inversés —
// École→Département→Filière ici Filière→École→Département — copier cette logique isolée évite un
// couplage artificiel entre deux composants qui ne partagent que ce fragment).
const NIVEAU_PREMIERE_ANNEE_REGEX = /^(BTS|LICENCE|MASTER) 1( PRO)?$/i;
const NIVEAU_LICENCE_1_REGEX = /^LICENCE 1$/i;
const NIVEAU_BTS_1_REGEX = /^BTS 1$/i;
const NIVEAU_LICENCE_3_PRO_REGEX = /^LICENCE 3 PRO$/i;

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
          // Étudiant affecté : un seul niveau autorisé, selon le type de filière. L'exception
          // LICENCE 3 PRO (BTS obtenu ailleurs) ne concerne que les étudiants Non affecté —
          // aucune filière Affecté n'y a droit ici.
          const estUniversitaire = filiereSelectionnee?.typefiliere_libelle === 'Universitaire';
          return estUniversitaire ? NIVEAU_LICENCE_1_REGEX.test(n.libelle) : NIVEAU_BTS_1_REGEX.test(n.libelle);
        }
        if (NIVEAU_PREMIERE_ANNEE_REGEX.test(n.libelle)) return true;
        if (filiereSelectionnee?.typefiliere_libelle === 'Professionnelles' && NIVEAU_LICENCE_3_PRO_REGEX.test(n.libelle)) {
          return true;
        }
        return false;
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
