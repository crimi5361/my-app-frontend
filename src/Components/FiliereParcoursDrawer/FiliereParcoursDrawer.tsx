/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Drawer, Table, Button, Space, Input, InputNumber, Select,
  Popconfirm, notification, Divider, Tag, Modal, Checkbox, Empty,
} from 'antd';
import { PlusOutlined, DeleteOutlined, SaveOutlined, CopyOutlined } from '@ant-design/icons';
import { apiFetch } from '../../lib/api';

const { Option } = Select;

export interface NiveauParcours {
  id: number;
  libelle: string;
  prix_formation: string | number;
  ordre: number | null;
  niveau_suivant_id: number | null;
}

interface AnneeAcademiqueOption {
  id: number;
  annee: string;
}

interface FiliereOption {
  id: number;
  nom: string;
  filiere_mere_id: number | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  filiereId: number | null;
  filiereNom: string;
  niveaux: NiveauParcours[];
  toutesLesFilieres: FiliereOption[];
  onChanged: () => void; // recharger la liste des filières après une modification
}

// Vue "parcours" d'une filière : gestion des niveaux (ordre, niveau suivant), des filières-options
// rattachées (filiere_mere_id), et duplication vers une nouvelle année académique. Complète
// Filieres.tsx sans remplacer son Drawer de création/édition existant.
const FiliereParcoursDrawer: React.FC<Props> = ({
  open, onClose, filiereId, filiereNom, niveaux, toutesLesFilieres, onChanged,
}) => {
  const [editingRows, setEditingRows] = useState<Record<number, Partial<NiveauParcours>>>({});
  const [savingId, setSavingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [nouveauLibelle, setNouveauLibelle] = useState('');
  const [nouveauPrix, setNouveauPrix] = useState<number | null>(null);
  const [nouveauOrdre, setNouveauOrdre] = useState<number | null>(null);
  const [ajoutEnCours, setAjoutEnCours] = useState(false);

  const [dupliquerOpen, setDupliquerOpen] = useState(false);
  const [annees, setAnnees] = useState<AnneeAcademiqueOption[]>([]);
  const [anneeCibleId, setAnneeCibleId] = useState<number | null>(null);
  const [dupliquerOptions, setDupliquerOptions] = useState(false);
  const [dupliquerEnCours, setDupliquerEnCours] = useState(false);

  useEffect(() => {
    if (!open) {
      setEditingRows({});
      setNouveauLibelle('');
      setNouveauPrix(null);
      setNouveauOrdre(null);
    }
  }, [open]);

  const optionsRattachees = useMemo(
    () => toutesLesFilieres.filter(f => f.filiere_mere_id === filiereId),
    [toutesLesFilieres, filiereId]
  );

  const niveauLibelleById = useMemo(() => {
    const map = new Map<number, string>();
    niveaux.forEach(n => map.set(n.id, n.libelle));
    return map;
  }, [niveaux]);

  const getRowValue = (row: NiveauParcours, field: keyof NiveauParcours) =>
    editingRows[row.id]?.[field] !== undefined ? editingRows[row.id]![field] : row[field];

  const setRowValue = (id: number, field: keyof NiveauParcours, value: any) => {
    setEditingRows(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  const handleSaveNiveau = async (row: NiveauParcours) => {
    const edits = editingRows[row.id];
    if (!edits) return;
    setSavingId(row.id);
    try {
      await apiFetch(`/api/niveaux/${row.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          libelle: edits.libelle ?? row.libelle,
          prix_formation: edits.prix_formation ?? row.prix_formation,
          ordre: edits.ordre ?? row.ordre,
          niveau_suivant_id: edits.niveau_suivant_id !== undefined ? edits.niveau_suivant_id : row.niveau_suivant_id,
        }),
      });
      notification.success({ message: 'Niveau mis à jour' });
      setEditingRows(prev => {
        const next = { ...prev };
        delete next[row.id];
        return next;
      });
      onChanged();
    } catch (error: any) {
      notification.error({ message: 'Erreur', description: error.message || 'Impossible de mettre à jour ce niveau.' });
    } finally {
      setSavingId(null);
    }
  };

  const handleDeleteNiveau = async (id: number) => {
    setDeletingId(id);
    try {
      await apiFetch(`/api/niveaux/${id}`, { method: 'DELETE' });
      notification.success({ message: 'Niveau supprimé' });
      onChanged();
    } catch (error: any) {
      notification.error({ message: 'Suppression impossible', description: error.message || 'Ce niveau est probablement encore rattaché à des données.' });
    } finally {
      setDeletingId(null);
    }
  };

  const handleAjouterNiveau = async () => {
    if (!filiereId || !nouveauLibelle || !nouveauPrix) {
      notification.warning({ message: 'Champs manquants', description: 'Libellé et prix sont requis.' });
      return;
    }
    setAjoutEnCours(true);
    try {
      await apiFetch('/api/niveaux', {
        method: 'POST',
        body: JSON.stringify({
          filiere_id: filiereId,
          libelle: nouveauLibelle,
          prix_formation: nouveauPrix,
          ordre: nouveauOrdre,
        }),
      });
      notification.success({ message: 'Niveau ajouté' });
      setNouveauLibelle('');
      setNouveauPrix(null);
      setNouveauOrdre(null);
      onChanged();
    } catch (error: any) {
      notification.error({ message: 'Erreur', description: error.message || "Impossible d'ajouter ce niveau." });
    } finally {
      setAjoutEnCours(false);
    }
  };

  const openDupliquer = async () => {
    setDupliquerOpen(true);
    try {
      const data: AnneeAcademiqueOption[] = await apiFetch('/api/annees');
      setAnnees(data);
    } catch {
      notification.error({ message: 'Erreur', description: 'Impossible de charger les années académiques.' });
    }
  };

  const handleDupliquer = async () => {
    if (!filiereId || !anneeCibleId) {
      notification.warning({ message: 'Année requise', description: 'Sélectionnez une année académique cible.' });
      return;
    }
    setDupliquerEnCours(true);
    try {
      const res: { message: string } = await apiFetch(`/api/filieres/${filiereId}/dupliquer`, {
        method: 'POST',
        body: JSON.stringify({
          annee_academique_cible_id: anneeCibleId,
          dupliquer_options: dupliquerOptions,
        }),
      });
      notification.success({ message: 'Duplication réussie', description: res.message });
      setDupliquerOpen(false);
      setAnneeCibleId(null);
      setDupliquerOptions(false);
      onChanged();
    } catch (error: any) {
      notification.error({ message: 'Duplication impossible', description: error.message || 'Une erreur est survenue.' });
    } finally {
      setDupliquerEnCours(false);
    }
  };

  const columns = [
    {
      title: 'Libellé',
      dataIndex: 'libelle',
      render: (_: any, row: NiveauParcours) => (
        <Input
          value={getRowValue(row, 'libelle') as string}
          onChange={e => setRowValue(row.id, 'libelle', e.target.value)}
          style={{ minWidth: 140 }}
        />
      ),
    },
    {
      title: 'Prix (FCFA)',
      dataIndex: 'prix_formation',
      render: (_: any, row: NiveauParcours) => (
        <InputNumber
          value={Number(getRowValue(row, 'prix_formation'))}
          onChange={v => setRowValue(row.id, 'prix_formation', v)}
          min={0}
          style={{ width: 130 }}
        />
      ),
    },
    {
      title: 'Ordre',
      dataIndex: 'ordre',
      render: (_: any, row: NiveauParcours) => (
        <InputNumber
          value={getRowValue(row, 'ordre') as number | null}
          onChange={v => setRowValue(row.id, 'ordre', v)}
          min={1}
          style={{ width: 80 }}
        />
      ),
    },
    {
      title: 'Niveau suivant',
      dataIndex: 'niveau_suivant_id',
      render: (_: any, row: NiveauParcours) => (
        <Select
          allowClear
          placeholder="Aucun"
          value={getRowValue(row, 'niveau_suivant_id') as number | null | undefined}
          onChange={v => setRowValue(row.id, 'niveau_suivant_id', v ?? null)}
          style={{ minWidth: 160 }}
        >
          {niveaux.filter(n => n.id !== row.id).map(n => (
            <Option key={n.id} value={n.id}>{n.libelle}</Option>
          ))}
        </Select>
      ),
    },
    {
      title: 'Actions',
      render: (_: any, row: NiveauParcours) => (
        <Space>
          <Button
            icon={<SaveOutlined />}
            size="small"
            type="primary"
            disabled={!editingRows[row.id]}
            loading={savingId === row.id}
            onClick={() => handleSaveNiveau(row)}
          />
          <Popconfirm
            title="Supprimer ce niveau ?"
            description="Bloqué automatiquement si des étudiants, classes ou maquettes y sont rattachés."
            onConfirm={() => handleDeleteNiveau(row.id)}
          >
            <Button icon={<DeleteOutlined />} size="small" danger loading={deletingId === row.id} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const niveauxTries = useMemo(
    () => [...niveaux].sort((a, b) => (a.ordre ?? 999) - (b.ordre ?? 999)),
    [niveaux]
  );

  return (
    <Drawer
      title={`Parcours — ${filiereNom}`}
      width={800}
      open={open}
      onClose={onClose}
    >
      <Divider orientation="left">Niveaux (ordre et progression)</Divider>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={niveauxTries}
        pagination={false}
        size="small"
        locale={{ emptyText: <Empty description="Aucun niveau pour l'année en cours" /> }}
      />

      <div style={{ display: 'flex', gap: 8, marginTop: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 12, marginBottom: 4 }}>Libellé du nouveau niveau</div>
          <Input value={nouveauLibelle} onChange={e => setNouveauLibelle(e.target.value)} placeholder="Ex: LICENCE 1" style={{ width: 160 }} />
        </div>
        <div>
          <div style={{ fontSize: 12, marginBottom: 4 }}>Prix (FCFA)</div>
          <InputNumber value={nouveauPrix} onChange={setNouveauPrix} min={0} style={{ width: 130 }} />
        </div>
        <div>
          <div style={{ fontSize: 12, marginBottom: 4 }}>Ordre</div>
          <InputNumber value={nouveauOrdre} onChange={setNouveauOrdre} min={1} style={{ width: 80 }} />
        </div>
        <Button type="dashed" icon={<PlusOutlined />} loading={ajoutEnCours} onClick={handleAjouterNiveau}>
          Ajouter un niveau
        </Button>
      </div>

      <Divider orientation="left">Filières-options rattachées</Divider>
      {optionsRattachees.length === 0 ? (
        <Empty description="Aucune option — cette filière ne se scinde pas" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <Space wrap>
          {optionsRattachees.map(o => <Tag key={o.id} color="purple">{o.nom}</Tag>)}
        </Space>
      )}
      <div style={{ fontSize: 12, color: '#888', marginTop: 8 }}>
        Pour rattacher une option, créez ou modifiez la filière-option et sélectionnez cette filière comme "filière-mère".
      </div>

      <Divider orientation="left">Préparer une nouvelle année</Divider>
      <Button icon={<CopyOutlined />} onClick={openDupliquer}>
        Dupliquer vers une année académique
      </Button>

      <Modal
        title={`Dupliquer "${filiereNom}"`}
        open={dupliquerOpen}
        onCancel={() => setDupliquerOpen(false)}
        onOk={handleDupliquer}
        confirmLoading={dupliquerEnCours}
        okText="Dupliquer"
      >
        <div style={{ marginBottom: 12 }}>
          <div style={{ marginBottom: 4 }}>Année académique cible</div>
          <Select
            style={{ width: '100%' }}
            placeholder="Sélectionnez l'année cible"
            value={anneeCibleId ?? undefined}
            onChange={setAnneeCibleId}
          >
            {annees.map(a => <Option key={a.id} value={a.id}>{a.annee}</Option>)}
          </Select>
        </div>
        {optionsRattachees.length > 0 && (
          <Checkbox checked={dupliquerOptions} onChange={e => setDupliquerOptions(e.target.checked)}>
            Dupliquer aussi les {optionsRattachees.length} filière(s)-option(s) rattachée(s)
          </Checkbox>
        )}
      </Modal>
    </Drawer>
  );
};

export default FiliereParcoursDrawer;
