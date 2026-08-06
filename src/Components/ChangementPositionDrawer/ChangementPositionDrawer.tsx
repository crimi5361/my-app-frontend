/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Drawer, Select, Button, Alert, Descriptions, Input, notification, Divider, Tag, Space,
} from 'antd';
import { RocketOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { apiFetch } from '../../lib/api';

const { Option } = Select;
const { TextArea } = Input;

interface NiveauOption {
  id: number;
  libelle: string;
  ordre: number | null;
  parcours: string[];
}
interface FiliereOption {
  id: number;
  nom: string;
  sigle: string;
  configuree: boolean;
  niveaux: NiveauOption[];
}
interface Situation {
  id: number;
  nom: string;
  prenoms: string;
  niveau_libelle: string;
  filiere_nom: string;
  type_parcours: string | null;
  annee_academique_id: number;
  annee: string;
}
interface Simulation {
  niveau_cible: { libelle: string; filiere_nom: string; filiere_sigle: string };
  changement_de_cycle_detecte: boolean;
  statut_scolaire_propose: string;
  parcours_requis: boolean;
  parcours_disponibles: string[];
  tarif_propose: { montant: number | null; statut_applique: string };
  classe_cible: { existe: boolean; nom?: string };
}

interface Props {
  open: boolean;
  onClose: () => void;
  mode: 'filiere' | 'cycle';
  situation: Situation | null;
  onChanged: () => void;
}

// Drawer partagé "Changer de filière" / "Changer de cycle" — même mécanisme sous-jacent
// (simulation obligatoire avant validation, statut scolaire toujours explicite, jamais recalculé
// silencieusement), seul le libellé, l'avertissement et l'endpoint de commit diffèrent.
const ChangementPositionDrawer: React.FC<Props> = ({ open, onClose, mode, situation, onChanged }) => {
  const [filieres, setFilieres] = useState<FiliereOption[]>([]);
  const [filiereId, setFiliereId] = useState<number | null>(null);
  const [niveauId, setNiveauId] = useState<number | null>(null);
  const [curcusId, setCurcusId] = useState<number | null>(null);
  const [parcoursOptions, setParcoursOptions] = useState<{ id: number; type_parcours: string }[]>([]);

  const [simulation, setSimulation] = useState<Simulation | null>(null);
  const [statutChoisi, setStatutChoisi] = useState<string | null>(null);
  const [simulationEnCours, setSimulationEnCours] = useState(false);
  const [motif, setMotif] = useState('');
  const [validationEnCours, setValidationEnCours] = useState(false);

  useEffect(() => {
    if (!open || !situation) return;
    setFiliereId(null); setNiveauId(null); setCurcusId(null);
    setSimulation(null); setStatutChoisi(null); setMotif('');
    apiFetch(`/api/filieres/table/Filiere?toutes=true&anneeAcademiqueId=${situation.annee_academique_id}`)
      .then((data: FiliereOption[]) => setFilieres(data.filter(f => f.configuree)))
      .catch(() => notification.error({ message: 'Erreur', description: 'Impossible de charger les filières.' }));
    apiFetch('/api/curcus')
      .then((data: { id: number; type_parcours: string }[]) => setParcoursOptions(data))
      .catch(() => {});
  }, [open, situation]);

  const filiereChoisie = useMemo(() => filieres.find(f => f.id === filiereId), [filieres, filiereId]);
  const niveauChoisi = useMemo(() => filiereChoisie?.niveaux.find(n => n.id === niveauId), [filiereChoisie, niveauId]);
  const parcoursNiveauChoisi = useMemo(
    () => parcoursOptions.filter(p => (niveauChoisi?.parcours || []).includes(p.type_parcours)),
    [parcoursOptions, niveauChoisi]
  );

  const invaliderSimulation = () => { setSimulation(null); setStatutChoisi(null); };

  const lancerSimulation = async () => {
    if (!situation || !niveauId) return;
    setSimulationEnCours(true);
    try {
      const res: { data: Simulation } = await apiFetch(`/api/operations-admin/etudiant/${situation.id}/simuler`, {
        method: 'POST',
        body: JSON.stringify({ niveau_cible_id: niveauId, curcus_id: curcusId || undefined }),
      });
      setSimulation(res.data);
      setStatutChoisi(res.data.statut_scolaire_propose);
    } catch (error: any) {
      notification.error({ message: 'Simulation impossible', description: error.message || 'Erreur inconnue.' });
    } finally {
      setSimulationEnCours(false);
    }
  };

  const valider = async () => {
    if (!situation || !niveauId || !simulation || !statutChoisi) return;
    if (!motif.trim()) {
      notification.warning({ message: 'Motif requis', description: 'Saisissez le motif de cette opération.' });
      return;
    }
    setValidationEnCours(true);
    try {
      const endpoint = mode === 'cycle' ? 'changer-cycle' : 'changer-filiere';
      await apiFetch(`/api/operations-admin/etudiant/${situation.id}/${endpoint}`, {
        method: 'POST',
        body: JSON.stringify({ niveau_cible_id: niveauId, curcus_id: curcusId || undefined, statut_scolaire: statutChoisi, motif: motif.trim() }),
      });
      notification.success({ message: mode === 'cycle' ? 'Changement de cycle effectué' : 'Changement de filière effectué' });
      onChanged();
      onClose();
    } catch (error: any) {
      notification.error({ message: 'Erreur', description: error.message || 'Une erreur est survenue.' });
    } finally {
      setValidationEnCours(false);
    }
  };

  const titre = mode === 'cycle' ? 'Changement de cycle' : 'Changement de filière';

  return (
    <Drawer title={`${titre} — ${situation ? `${situation.nom} ${situation.prenoms}` : ''}`} width={640} open={open} onClose={onClose}>
      {situation && (
        <>
          <Descriptions column={1} bordered size="small" style={{ marginBottom: 16 }}>
            <Descriptions.Item label="Situation actuelle">
              {situation.filiere_nom} — {situation.niveau_libelle}{situation.type_parcours ? ` (${situation.type_parcours})` : ''}
            </Descriptions.Item>
            <Descriptions.Item label="Année académique">{situation.annee}</Descriptions.Item>
          </Descriptions>

          {mode === 'cycle' && (
            <Alert
              type="warning"
              showIcon
              icon={<ExclamationCircleOutlined />}
              message="Opération sensible"
              description="Un changement de cycle (BTS ↔ Licence ↔ Master) peut modifier le statut scolaire de l'étudiant. Vérifiez attentivement la simulation ci-dessous avant de valider — aucune valeur n'est appliquée automatiquement."
              style={{ marginBottom: 16 }}
            />
          )}

          <Divider orientation="left">Nouvelle position</Divider>
          <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, marginBottom: 4 }}>Filière cible</div>
              <Select
                style={{ width: '100%' }}
                placeholder="Sélectionner une filière"
                value={filiereId ?? undefined}
                onChange={v => { setFiliereId(v); setNiveauId(null); setCurcusId(null); invaliderSimulation(); }}
                showSearch
                optionFilterProp="children"
              >
                {filieres.map(f => <Option key={f.id} value={f.id}>{f.nom} ({f.sigle})</Option>)}
              </Select>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, marginBottom: 4 }}>Niveau cible</div>
              <Select
                style={{ width: '100%' }}
                placeholder="Sélectionner un niveau"
                value={niveauId ?? undefined}
                disabled={!filiereChoisie}
                onChange={v => { setNiveauId(v); setCurcusId(null); invaliderSimulation(); }}
              >
                {(filiereChoisie?.niveaux || []).map(n => <Option key={n.id} value={n.id}>{n.libelle}</Option>)}
              </Select>
            </div>
          </div>

          {niveauChoisi && niveauChoisi.parcours.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, marginBottom: 4 }}>Parcours cible</div>
              <Select
                style={{ width: '100%' }}
                placeholder="Sélectionner un parcours"
                value={curcusId ?? undefined}
                onChange={v => { setCurcusId(v); invaliderSimulation(); }}
              >
                {parcoursNiveauChoisi.map(p => <Option key={p.id} value={p.id}>{p.type_parcours}</Option>)}
              </Select>
            </div>
          )}

          <Button
            icon={<RocketOutlined />}
            onClick={lancerSimulation}
            loading={simulationEnCours}
            disabled={!niveauId || (niveauChoisi ? niveauChoisi.parcours.length > 0 && !curcusId : false)}
            style={{ marginBottom: 16 }}
          >
            Simuler les conséquences
          </Button>

          {simulation && (
            <>
              <Divider orientation="left">Conséquences de cette opération</Divider>
              <Descriptions column={1} bordered size="small" style={{ marginBottom: 12 }}>
                <Descriptions.Item label="Changement de cycle détecté">
                  {simulation.changement_de_cycle_detecte ? <Tag color="orange">Oui</Tag> : <Tag color="green">Non</Tag>}
                </Descriptions.Item>
                <Descriptions.Item label="Classe cible">
                  {simulation.classe_cible.existe ? simulation.classe_cible.nom : 'Sera créée automatiquement'}
                </Descriptions.Item>
                <Descriptions.Item label="Tarif applicable proposé">
                  {simulation.tarif_propose.montant !== null
                    ? `${Number(simulation.tarif_propose.montant).toLocaleString('fr-FR')} FCFA (${simulation.tarif_propose.statut_applique})`
                    : 'Non déterminé'}
                </Descriptions.Item>
              </Descriptions>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, marginBottom: 4 }}>
                  Statut scolaire à appliquer
                  {simulation.changement_de_cycle_detecte && (
                    <span style={{ color: 'var(--text-soft)' }}> — proposé par défaut : {simulation.statut_scolaire_propose} (modifiable)</span>
                  )}
                </div>
                <Select style={{ width: '100%' }} value={statutChoisi ?? undefined} onChange={setStatutChoisi}>
                  <Option value="Affecté">Affecté</Option>
                  <Option value="Non affecté">Non affecté</Option>
                </Select>
                {statutChoisi !== simulation.statut_scolaire_propose && (
                  <Alert
                    type="info"
                    showIcon
                    style={{ marginTop: 8 }}
                    message={`Vous appliquez "${statutChoisi}" au lieu de la règle par défaut ("${simulation.statut_scolaire_propose}") — ce choix sera tracé dans l'historique.`}
                  />
                )}
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, marginBottom: 4 }}>Motif de l'opération *</div>
                <TextArea rows={3} value={motif} onChange={e => setMotif(e.target.value)} placeholder="Ex : réorientation demandée par la direction pédagogique" />
              </div>

              <Space>
                <Button type="primary" danger={mode === 'cycle'} loading={validationEnCours} onClick={valider}>
                  Valider {mode === 'cycle' ? 'le changement de cycle' : 'le changement de filière'}
                </Button>
              </Space>
            </>
          )}
        </>
      )}
    </Drawer>
  );
};

export default ChangementPositionDrawer;
