import { useEffect, useState } from 'react';
import { Col, Form, Row, Select } from 'antd';
import { apiFetch } from '../../lib/api';

const { Option } = Select;

interface Ecole {
  id: number;
  nom: string;
  code: string;
}

interface Departement {
  id: number;
  nom: string;
  ecole_id: number;
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

export interface AcademicSelection {
  ecole_id?: number;
  departement_id?: number;
  filiere_id?: number;
  niveau_id?: number;
}

interface Props {
  value?: AcademicSelection;
  onChange?: (selection: AcademicSelection) => void;
  /** Affiche aussi les niveaux Filière et Niveau (désactivé par défaut : École + Département seulement) */
  showFiliereNiveau?: boolean;
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
   * premiereAnneeUniquement — LICENCE 1 pour une filière universitaire, BTS 1 ou LICENCE 1 PRO
   * pour une filière professionnelle (aucun Master/Master Pro, même en 1ère année). Chantier
   * tarification PRO (2026-08-21) : LICENCE 1 PRO est désormais autorisé pour un affecté (tarif
   * dédié, voir controllers/tarif.controller.js) ; LICENCE 2 PRO reste absent (jamais un niveau
   * d'entrée en nouvelle admission). Sans effet si premiereAnneeUniquement n'est pas activé.
   */
  statutAffecte?: boolean;
}

const NIVEAU_PREMIERE_ANNEE_REGEX = /^(BTS|LICENCE|MASTER) 1( PRO)?$/i;
const NIVEAU_LICENCE_1_REGEX = /^LICENCE 1$/i;
// Chantier tarification PRO (2026-08-21) : un affecté sur une filière professionnelle peut
// désormais choisir BTS 1 OU LICENCE 1 PRO (avant : BTS 1 uniquement).
const NIVEAU_PRO_AFFECTE_ADMISSION_REGEX = /^(BTS 1|LICENCE 1 PRO)$/i;
// ✅ Exception métier : un étudiant titulaire d'un BTS obtenu dans un autre établissement peut
// s'inscrire directement en LICENCE 3 PRO (nouvelle inscription, pas une réinscription) — proposée
// en plus des premières années, uniquement pour les filières professionnelles. Le choix du
// parcours (Jour/Soir) et toute la suite (classe/groupe/maquette) sont déjà gérés dès lors que ce
// niveau est sélectionné (voir ResumeFinalisation.tsx::handleFormationInfo).
const NIVEAU_LICENCE_3_PRO_REGEX = /^LICENCE 3 PRO$/i;

/**
 * Sélecteur en cascade École → Département → Filière → Niveau.
 * Filière/Niveau sont dérivés de /api/filieres/table/Filiere (déjà scopé site + année
 * en cours côté backend) et filtrés côté client par département académique sélectionné.
 */
const AcademicCascadeSelect = ({ value, onChange, showFiliereNiveau = false, disabled = false, onNiveauInfo, onFormationInfo, premiereAnneeUniquement = false, statutAffecte = false }: Props) => {
  const [ecoles, setEcoles] = useState<Ecole[]>([]);
  const [departements, setDepartements] = useState<Departement[]>([]);
  const [filieres, setFilieres] = useState<FiliereWithNiveaux[]>([]);
  const [loadingEcoles, setLoadingEcoles] = useState(false);
  const [loadingDepartements, setLoadingDepartements] = useState(false);
  const [loadingFilieres, setLoadingFilieres] = useState(false);

  const ecoleId = value?.ecole_id;
  const departementId = value?.departement_id;
  const filiereId = value?.filiere_id;
  const niveauId = value?.niveau_id;

  useEffect(() => {
    setLoadingEcoles(true);
    apiFetch('/api/ecoles')
      .then(setEcoles)
      .catch(() => setEcoles([]))
      .finally(() => setLoadingEcoles(false));

    if (showFiliereNiveau) {
      setLoadingFilieres(true);
      apiFetch('/api/filieres/table/Filiere')
        .then(setFilieres)
        .catch(() => setFilieres([]))
        .finally(() => setLoadingFilieres(false));
    }
  }, [showFiliereNiveau]);

  useEffect(() => {
    if (!ecoleId) {
      setDepartements([]);
      return;
    }
    setLoadingDepartements(true);
    apiFetch(`/api/departements?ecole_id=${ecoleId}`)
      .then(setDepartements)
      .catch(() => setDepartements([]))
      .finally(() => setLoadingDepartements(false));
  }, [ecoleId]);

  const filieresDuDepartement = departementId
    ? filieres.filter(f => f.departement_id === departementId)
    : [];

  const filiereSelectionnee = filiereId ? filieresDuDepartement.find(f => f.id === filiereId) : undefined;

  const niveauxDeLaFiliere = filiereId
    ? (filiereSelectionnee?.niveaux ?? []).filter(n => {
        if (!premiereAnneeUniquement) return true;
        if (statutAffecte) {
          // Étudiant affecté : un seul niveau autorisé, selon le type de filière. L'exception
          // LICENCE 3 PRO (BTS obtenu ailleurs) ne concerne que les étudiants Non affecté —
          // aucune filière Affecté n'y a droit ici.
          const estUniversitaire = filiereSelectionnee?.typefiliere_libelle === 'Universitaire';
          return estUniversitaire ? NIVEAU_LICENCE_1_REGEX.test(n.libelle) : NIVEAU_PRO_AFFECTE_ADMISSION_REGEX.test(n.libelle);
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
      onChange?.({ ecole_id: ecoleId, departement_id: departementId, filiere_id: filiereId, niveau_id: undefined });
      onNiveauInfo?.(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statutAffecte, filiereId]);

  const emit = (next: Partial<AcademicSelection>) => {
    onChange?.({ ecole_id: ecoleId, departement_id: departementId, filiere_id: filiereId, niveau_id: niveauId, ...next });
  };

  const handleEcoleChange = (id: number) => {
    emit({ ecole_id: id, departement_id: undefined, filiere_id: undefined, niveau_id: undefined });
  };

  const handleDepartementChange = (id: number) => {
    emit({ departement_id: id, filiere_id: undefined, niveau_id: undefined });
  };

  const handleFiliereChange = (id: number) => {
    emit({ filiere_id: id, niveau_id: undefined });
    onNiveauInfo?.(null);
  };

  const handleNiveauChange = (id: number) => {
    emit({ niveau_id: id });
    const niveau = niveauxDeLaFiliere.find(n => n.id === id) ?? null;
    onNiveauInfo?.(niveau);
    const filiere = filieresDuDepartement.find(f => f.id === filiereId);
    onFormationInfo?.({
      typeFiliereLibelle: filiere?.typefiliere_libelle ?? null,
      niveauLibelle: niveau?.libelle ?? null,
    });
  };

  return (
    <Row gutter={12}>
      <Col span={showFiliereNiveau ? 6 : 12}>
        <Form.Item label="École" required>
          <Select
            placeholder="Sélectionner une école"
            // ✅ Ne jamais lier la value tant que la liste correspondante n'a pas chargé — sinon
            // rc-select affiche l'id numérique brut le temps du fetch asynchrone (pré-remplissage
            // depuis un dossier existant, ex. page Vérification), au lieu du libellé.
            value={ecoles.length > 0 ? ecoleId : undefined}
            onChange={handleEcoleChange}
            loading={loadingEcoles}
            disabled={disabled}
            allowClear
          >
            {ecoles.map(e => <Option key={e.id} value={e.id}>{e.nom}</Option>)}
          </Select>
        </Form.Item>
      </Col>
      <Col span={showFiliereNiveau ? 6 : 12}>
        <Form.Item label="Département" required>
          <Select
            placeholder="Sélectionner un département"
            value={departements.length > 0 ? departementId : undefined}
            onChange={handleDepartementChange}
            loading={loadingDepartements}
            disabled={disabled || !ecoleId}
            allowClear
          >
            {departements.map(d => <Option key={d.id} value={d.id}>{d.nom}</Option>)}
          </Select>
        </Form.Item>
      </Col>
      {showFiliereNiveau && (
        <>
          <Col span={8}>
            <Form.Item label="Filière" required>
              <Select
                placeholder="Sélectionner une filière"
                value={filieresDuDepartement.length > 0 ? filiereId : undefined}
                onChange={handleFiliereChange}
                loading={loadingFilieres}
                disabled={disabled || !departementId}
                allowClear
              >
                {filieresDuDepartement.map(f => <Option key={f.id} value={f.id}>{f.nom}</Option>)}
              </Select>
            </Form.Item>
          </Col>
          <Col span={4}>
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
        </>
      )}
    </Row>
  );
};

export default AcademicCascadeSelect;
