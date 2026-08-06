/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from 'react';
import { Drawer, Select, Button, Input, notification, Descriptions, Space, Alert } from 'antd';
import { apiFetch } from '../../lib/api';

const { Option } = Select;
const { TextArea } = Input;

interface Situation {
  id: number;
  nom: string;
  prenoms: string;
  niveau_id: number;
  niveau_libelle: string;
  filiere_nom: string;
  type_filiere_libelle: string | null;
  curcus_id: number | null;
  type_parcours: string | null;
  annee_academique_id: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  situation: Situation | null;
  onChanged: () => void;
}

// Changement de parcours : réservé aux formations professionnelles, ne touche jamais le niveau,
// la filière ni la scolarité — uniquement le curcus (Jour/Soir) et la classe/groupe associés.
// Pas de simulation nécessaire (aucun changement de statut ni de tarif).
const ChangementParcoursDrawer: React.FC<Props> = ({ open, onClose, situation, onChanged }) => {
  const [parcoursDisponibles, setParcoursDisponibles] = useState<string[]>([]);
  const [curcusOptions, setCurcusOptions] = useState<{ id: number; type_parcours: string }[]>([]);
  const [nouveauCurcusId, setNouveauCurcusId] = useState<number | null>(null);
  const [motif, setMotif] = useState('');
  const [validationEnCours, setValidationEnCours] = useState(false);

  useEffect(() => {
    if (!open || !situation) return;
    setNouveauCurcusId(null);
    setMotif('');
    apiFetch('/api/curcus').then(setCurcusOptions).catch(() => {});
    apiFetch(`/api/filieres/table/Filiere?toutes=true&anneeAcademiqueId=${situation.annee_academique_id}`)
      .then((filieres: { nom: string; niveaux: { id: number; parcours: string[] }[] }[]) => {
        const filiere = filieres.find(f => f.nom === situation.filiere_nom);
        const niveau = filiere?.niveaux.find(n => n.id === situation.niveau_id);
        setParcoursDisponibles((niveau?.parcours || []).filter(p => p !== situation.type_parcours));
      })
      .catch(() => notification.error({ message: 'Erreur', description: 'Impossible de charger les parcours disponibles.' }));
  }, [open, situation]);

  const valider = async () => {
    if (!situation || !nouveauCurcusId) return;
    if (!motif.trim()) {
      notification.warning({ message: 'Motif requis', description: 'Saisissez le motif de cette opération.' });
      return;
    }
    setValidationEnCours(true);
    try {
      await apiFetch(`/api/operations-admin/etudiant/${situation.id}/changer-parcours`, {
        method: 'POST',
        body: JSON.stringify({ nouveau_curcus_id: nouveauCurcusId, motif: motif.trim() }),
      });
      notification.success({ message: 'Changement de parcours effectué' });
      onChanged();
      onClose();
    } catch (error: any) {
      notification.error({ message: 'Erreur', description: error.message || 'Une erreur est survenue.' });
    } finally {
      setValidationEnCours(false);
    }
  };

  const options = curcusOptions.filter(c => parcoursDisponibles.includes(c.type_parcours));

  return (
    <Drawer title={`Changement de parcours — ${situation ? `${situation.nom} ${situation.prenoms}` : ''}`} width={520} open={open} onClose={onClose}>
      {situation && (
        <>
          <Descriptions column={1} bordered size="small" style={{ marginBottom: 16 }}>
            <Descriptions.Item label="Filière / Niveau">{situation.filiere_nom} — {situation.niveau_libelle}</Descriptions.Item>
            <Descriptions.Item label="Parcours actuel">{situation.type_parcours || 'Aucun'}</Descriptions.Item>
          </Descriptions>

          {situation.type_filiere_libelle !== 'Professionnelles' ? (
            <Alert type="warning" showIcon message="Le changement de parcours est réservé aux formations professionnelles." />
          ) : options.length === 0 ? (
            <Alert type="info" showIcon message="Aucun autre parcours n'est configuré pour ce niveau cette année." />
          ) : (
            <>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, marginBottom: 4 }}>Nouveau parcours</div>
                <Select style={{ width: '100%' }} placeholder="Sélectionner un parcours" value={nouveauCurcusId ?? undefined} onChange={setNouveauCurcusId}>
                  {options.map(o => <Option key={o.id} value={o.id}>{o.type_parcours}</Option>)}
                </Select>
              </div>
              <Alert
                type="info" showIcon style={{ marginBottom: 16 }}
                message="Le niveau, la filière et la scolarité restent inchangés — seuls la classe et le groupe seront mis à jour."
              />
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, marginBottom: 4 }}>Motif de l'opération *</div>
                <TextArea rows={3} value={motif} onChange={e => setMotif(e.target.value)} placeholder="Ex : contrainte d'emploi du temps de l'étudiant" />
              </div>
              <Space>
                <Button type="primary" loading={validationEnCours} disabled={!nouveauCurcusId} onClick={valider}>
                  Valider le changement de parcours
                </Button>
              </Space>
            </>
          )}
        </>
      )}
    </Drawer>
  );
};

export default ChangementParcoursDrawer;
