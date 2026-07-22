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
}

/**
 * Sélecteur en cascade École → Département → Filière → Niveau.
 * Filière/Niveau sont dérivés de /api/filieres/table/Filiere (déjà scopé site + année
 * en cours côté backend) et filtrés côté client par département académique sélectionné.
 */
const AcademicCascadeSelect = ({ value, onChange, showFiliereNiveau = false, disabled = false, onNiveauInfo, onFormationInfo }: Props) => {
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

  const niveauxDeLaFiliere = filiereId
    ? filieresDuDepartement.find(f => f.id === filiereId)?.niveaux ?? []
    : [];

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
            value={ecoleId}
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
            value={departementId}
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
                value={filiereId}
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
                value={niveauId}
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
