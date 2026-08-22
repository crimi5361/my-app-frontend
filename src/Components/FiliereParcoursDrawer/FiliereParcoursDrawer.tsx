/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Drawer, Table, Button, Space, Input, InputNumber, Select,
  Popconfirm, notification, Divider, Tag, Checkbox, Empty, Alert, Modal, Typography,
} from 'antd';
import { PlusOutlined, DeleteOutlined, SaveOutlined, RocketOutlined, DollarOutlined } from '@ant-design/icons';
import { apiFetch } from '../../lib/api';

const { Text } = Typography;

// Chantier tarification PRO — administration (2026-08-21) : la gestion des tarifs (Affecté/Non
// affecté/Affecté-Réinscription) est réservée à l'ADMIN. Le backend reste la protection réelle
// (PUT /api/tarifs/:id → authorizeRoles('admin')) — ce contrôle frontend n'est qu'une amélioration
// UX pour un rôle "Gestion_academique" qui partage cette même page sans avoir le droit d'éditer
// les tarifs.
const estAdmin = (): boolean => {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}')?.role === 'admin';
  } catch {
    return false;
  }
};

export interface TarifNiveau {
  id: number | null;
  montant_affecte: number | string | null;
  montant_affecte_reinscription: number | string | null;
  montant_non_affecte: number | string | null;
  toujours_non_affecte: boolean;
  // Tarif Affecté STANDARD pour ce niveau (avant toute surcharge filière) — calculé et fourni
  // par le backend (tarif.controller.js::getMontantAffecteStandard), jamais déduit ici : le
  // frontend ne doit jamais deviner quelle est la valeur "standard" pour un libellé donné.
  montant_affecte_standard?: number | null;
}

export interface NiveauParcours {
  id: number;
  libelle: string;
  prix_formation: string | number;
  ordre: number | null;
  niveau_suivant_id: number | null;
  tarif?: TarifNiveau | null;
  parcours?: string[];
}

interface FiliereOption {
  id: number;
  nom: string;
  filiere_mere_id: number | null;
}

interface CatalogueNiveau {
  libelle: string;
  prix_formation: string | number;
  ordre: number | null;
  montant_affecte: number | string | null;
  montant_affecte_reinscription: number | string | null;
  montant_non_affecte: number | string | null;
  toujours_non_affecte: boolean;
  parcours: string[];
}

interface LigneAConfigurer {
  key: string;
  libelle: string;
  prix_formation: number | null;
  ordre: number | null;
  parcours: string[];
  toujours_non_affecte: boolean;
  coche: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  filiereId: number | null;
  filiereNom: string;
  anneeId: number | null;
  anneeLabel: string;
  niveaux: NiveauParcours[]; // niveaux déjà configurés pour anneeId
  toutesLesFilieres: FiliereOption[];
  onChanged: () => void; // recharger la liste des filières après une modification
}

// Vue "préparation de rentrée" d'une filière permanente : la filière n'est jamais recréée
// (filiere_id fixe) — cette vue ne fait que déclarer, pour l'année académique sélectionnée,
// quels niveaux sont ouverts, avec quels parcours et quels tarifs. Une filière peut être préparée
// progressivement (ouvrir Licence 1/2 aujourd'hui, Licence 3 plus tard) : le catalogue proposé
// (dernière année où la filière a été configurée) ne sert qu'au préremplissage, jamais de
// contrainte — chaque niveau reste ajoutable, modifiable ou retirable avant validation.
const FiliereParcoursDrawer: React.FC<Props> = ({
  open, onClose, filiereId, filiereNom, anneeId, anneeLabel, niveaux, toutesLesFilieres, onChanged,
}) => {
  const [editingRows, setEditingRows] = useState<Record<number, Partial<NiveauParcours>>>({});
  const [savingId, setSavingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Chantier tarification PRO — administration (2026-08-21) : modale dédiée à la configuration
  // du tarif d'un niveau (Affecté / Non affecté / Affecté-Réinscription), séparée de l'édition
  // des champs niveau (libellé/prix/ordre/parcours) déjà gérée ci-dessus par editingRows.
  const [tarifRow, setTarifRow] = useState<NiveauParcours | null>(null);
  const [tarifNonAffecte, setTarifNonAffecte] = useState<number | null>(null);
  const [tarifSpecifique, setTarifSpecifique] = useState(false);
  const [tarifAffecte, setTarifAffecte] = useState<number | null>(null);
  const [tarifAffecteReinscription, setTarifAffecteReinscription] = useState<number | null>(null);
  const [savingTarif, setSavingTarif] = useState(false);

  const ouvrirTarifModal = (row: NiveauParcours) => {
    const t = row.tarif;
    const standard = t?.montant_affecte_standard ?? null;
    const affecteActuel = t?.montant_affecte !== null && t?.montant_affecte !== undefined ? Number(t.montant_affecte) : null;
    setTarifRow(row);
    setTarifNonAffecte(t?.montant_non_affecte !== null && t?.montant_non_affecte !== undefined ? Number(t.montant_non_affecte) : null);
    setTarifSpecifique(affecteActuel !== null && affecteActuel !== standard);
    setTarifAffecte(affecteActuel);
    setTarifAffecteReinscription(t?.montant_affecte_reinscription !== null && t?.montant_affecte_reinscription !== undefined ? Number(t.montant_affecte_reinscription) : null);
  };

  const handleSaveTarif = async () => {
    if (!tarifRow?.tarif?.id) return;
    setSavingTarif(true);
    try {
      const standard = tarifRow.tarif.montant_affecte_standard ?? null;
      await apiFetch(`/api/tarifs/${tarifRow.tarif.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          montant_non_affecte: tarifNonAffecte,
          // Décoché = revient explicitement au standard société (jamais laissé à une ancienne
          // valeur périmée) ; coché = la valeur saisie par l'admin, propre à cette filière.
          montant_affecte: tarifRow.tarif.toujours_non_affecte ? null : (tarifSpecifique ? tarifAffecte : standard),
          montant_affecte_reinscription: tarifRow.tarif.toujours_non_affecte ? null : tarifAffecteReinscription,
          toujours_non_affecte: tarifRow.tarif.toujours_non_affecte,
        }),
      });
      notification.success({ message: 'Tarif mis à jour' });
      setTarifRow(null);
      onChanged();
    } catch (error: any) {
      notification.error({ message: 'Erreur', description: error.message || 'Impossible de mettre à jour ce tarif.' });
    } finally {
      setSavingTarif(false);
    }
  };

  const [catalogue, setCatalogue] = useState<{ annee_reference: string | null; niveaux: CatalogueNiveau[] } | null>(null);
  const [chargementCatalogue, setChargementCatalogue] = useState(false);
  const [lignes, setLignes] = useState<LigneAConfigurer[]>([]);
  const [validationEnCours, setValidationEnCours] = useState(false);
  // Parcours réellement proposés par l'établissement (table `curcus`) — jamais codés en dur ici,
  // pour ne jamais dériver des libellés officiels ("Professionnel jour"/"Professionnel soir"),
  // déjà utilisés partout ailleurs (admission, réinscription).
  const [parcoursDisponibles, setParcoursDisponibles] = useState<string[]>([]);

  const libellesDejaConfigures = useMemo(
    () => new Set(niveaux.map(n => n.libelle.trim().toUpperCase())),
    [niveaux]
  );

  useEffect(() => {
    apiFetch('/api/curcus')
      .then((data: { id: number; type_parcours: string }[]) => setParcoursDisponibles(data.map(c => c.type_parcours)))
      .catch(() => notification.error({ message: 'Erreur', description: 'Impossible de charger la liste des parcours.' }));
  }, []);

  useEffect(() => {
    if (!open || !filiereId) return;
    setEditingRows({});
    setCatalogue(null);
    setChargementCatalogue(true);
    apiFetch(`/api/filieres/${filiereId}/niveaux-catalogue`)
      .then((data: { annee_reference: string | null; niveaux: CatalogueNiveau[] }) => {
        setCatalogue(data);
        const proposees = data.niveaux
          .filter(n => !libellesDejaConfigures.has(n.libelle.trim().toUpperCase()))
          .map((n, i): LigneAConfigurer => ({
            key: `catalogue-${i}`,
            libelle: n.libelle,
            prix_formation: n.montant_non_affecte !== null ? Number(n.montant_non_affecte) : Number(n.prix_formation) || 0,
            ordre: n.ordre ?? (niveaux.length + i + 1),
            parcours: n.parcours || [],
            toujours_non_affecte: n.toujours_non_affecte,
            coche: false,
          }));
        setLignes(proposees);
      })
      .catch(() => notification.error({ message: 'Erreur', description: 'Impossible de charger le catalogue de niveaux.' }))
      .finally(() => setChargementCatalogue(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, filiereId]);

  // Purge les lignes proposées dès qu'elles viennent d'être configurées (niveaux prop mis à jour
  // par onChanged après validation) — sans cela, un niveau qui vient d'être créé resterait coché
  // dans "Ouvrir d'autres niveaux", laissant croire à tort qu'il faut revalider.
  useEffect(() => {
    setLignes(prev => prev.filter(l => !libellesDejaConfigures.has(l.libelle.trim().toUpperCase())));
  }, [libellesDejaConfigures]);

  const optionsRattachees = useMemo(
    () => toutesLesFilieres.filter(f => f.filiere_mere_id === filiereId),
    [toutesLesFilieres, filiereId]
  );

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
          parcours: edits.parcours !== undefined ? edits.parcours : row.parcours,
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

  const columnsConfigures = [
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
      title: 'Parcours',
      dataIndex: 'parcours',
      render: (_: any, row: NiveauParcours) => (
        <Select
          mode="multiple"
          value={(getRowValue(row, 'parcours') as string[] | undefined) || []}
          onChange={v => setRowValue(row.id, 'parcours', v)}
          placeholder="Aucun parcours"
          style={{ minWidth: 220 }}
          options={parcoursDisponibles.map(p => ({ value: p, label: p }))}
        />
      ),
    },
    {
      title: 'Tarif',
      dataIndex: 'tarif',
      render: (_: any, row: NiveauParcours) => {
        const t = row.tarif;
        const affecteActuel = t?.montant_affecte !== null && t?.montant_affecte !== undefined ? Number(t.montant_affecte) : null;
        const standard = t?.montant_affecte_standard ?? null;
        const estSpecifique = affecteActuel !== null && affecteActuel !== standard;
        return (
          <Space direction="vertical" size={2}>
            {t?.toujours_non_affecte ? (
              <Tag color="gold">{Number(t.montant_non_affecte).toLocaleString('fr-FR')} FCFA (Non affecté uniquement)</Tag>
            ) : (
              <>
                <Tag color="blue">Non affecté : {Number(t?.montant_non_affecte ?? 0).toLocaleString('fr-FR')} FCFA</Tag>
                {affecteActuel !== null ? (
                  <Tag color={estSpecifique ? 'purple' : 'green'}>
                    Affecté : {affecteActuel.toLocaleString('fr-FR')} FCFA{estSpecifique ? ' (spécifique)' : ' (standard)'}
                  </Tag>
                ) : (
                  <Tag color="red">Affecté : non configuré</Tag>
                )}
              </>
            )}
            {estAdmin() && t?.id && (
              <Button size="small" icon={<DollarOutlined />} onClick={() => ouvrirTarifModal(row)}>
                Configurer le tarif
              </Button>
            )}
          </Space>
        );
      },
    },
    {
      title: 'Ordre',
      dataIndex: 'ordre',
      render: (_: any, row: NiveauParcours) => (
        <InputNumber
          value={getRowValue(row, 'ordre') as number | null}
          onChange={v => setRowValue(row.id, 'ordre', v)}
          min={1}
          style={{ width: 70 }}
        />
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

  const toggleLigne = (key: string) => {
    setLignes(prev => prev.map(l => l.key === key ? { ...l, coche: !l.coche } : l));
  };
  const updateLigne = (key: string, patch: Partial<LigneAConfigurer>) => {
    setLignes(prev => prev.map(l => l.key === key ? { ...l, ...patch } : l));
  };
  const supprimerLigne = (key: string) => {
    setLignes(prev => prev.filter(l => l.key !== key));
  };
  const ajouterLignePersonnalisee = () => {
    setLignes(prev => [...prev, {
      key: `custom-${Date.now()}`,
      libelle: '',
      prix_formation: 0,
      ordre: niveaux.length + prev.length + 1,
      parcours: [],
      toujours_non_affecte: false,
      coche: true,
    }]);
  };

  const handleConfigurer = async () => {
    if (!filiereId || !anneeId) return;
    const selectionnees = lignes.filter(l => l.coche);
    if (selectionnees.length === 0) {
      notification.warning({ message: 'Aucun niveau sélectionné', description: 'Cochez au moins un niveau à ouvrir pour cette année.' });
      return;
    }
    const invalide = selectionnees.find(l => !l.libelle || !l.ordre);
    if (invalide) {
      notification.warning({ message: 'Champs incomplets', description: `Le niveau "${invalide.libelle || '(sans libellé)'}" doit avoir un libellé et un ordre.` });
      return;
    }
    setValidationEnCours(true);
    try {
      const res: { message: string } = await apiFetch(`/api/filieres/${filiereId}/configurer-annee`, {
        method: 'POST',
        body: JSON.stringify({
          annee_academique_id: anneeId,
          niveaux: selectionnees.map(l => ({
            libelle: l.libelle,
            prix_formation: l.prix_formation,
            ordre: l.ordre,
            parcours: l.parcours,
            montant_non_affecte: l.prix_formation,
            toujours_non_affecte: l.toujours_non_affecte,
          })),
        }),
      });
      notification.success({ message: 'Rentrée préparée', description: res.message });
      onChanged();
    } catch (error: any) {
      notification.error({ message: 'Erreur', description: error.message || 'Impossible de configurer ces niveaux.' });
    } finally {
      setValidationEnCours(false);
    }
  };

  return (
    <Drawer
      title={`Préparation de rentrée — ${filiereNom} (${anneeLabel})`}
      width={880}
      open={open}
      onClose={onClose}
    >
      {niveaux.length > 0 && (
        <>
          <Divider orientation="left">Niveaux déjà configurés pour {anneeLabel}</Divider>
          <Table
            rowKey="id"
            columns={columnsConfigures}
            dataSource={niveauxTries}
            pagination={false}
            size="small"
          />
        </>
      )}

      <Divider orientation="left">
        {niveaux.length > 0 ? `Ouvrir d'autres niveaux pour ${anneeLabel}` : `Préparer ${filiereNom} pour ${anneeLabel}`}
      </Divider>

      {catalogue?.annee_reference && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message={`Préremplissage basé sur ${catalogue.annee_reference} — libre à vous d'ajouter, retirer ou modifier chaque niveau avant validation.`}
        />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {chargementCatalogue && <div>Chargement du catalogue…</div>}
        {!chargementCatalogue && lignes.length === 0 && (
          <Empty description="Aucun niveau suggéré — ajoutez-en un manuellement" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}
        {lignes.map(ligne => (
          <div
            key={ligne.key}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px',
              border: '1px solid var(--border, #e4e7f1)', borderRadius: 8,
              background: ligne.coche ? 'var(--success-bg, #e7f6ee)' : 'transparent',
            }}
          >
            <Checkbox checked={ligne.coche} onChange={() => toggleLigne(ligne.key)} />
            <Input
              value={ligne.libelle}
              onChange={e => updateLigne(ligne.key, { libelle: e.target.value })}
              placeholder="Libellé (ex: LICENCE 3)"
              style={{ width: 160 }}
            />
            <InputNumber
              value={ligne.ordre}
              onChange={v => updateLigne(ligne.key, { ordre: v })}
              min={1}
              placeholder="Ordre"
              style={{ width: 70 }}
            />
            <InputNumber
              value={ligne.prix_formation}
              onChange={v => updateLigne(ligne.key, { prix_formation: v })}
              min={0}
              placeholder="Tarif (FCFA)"
              style={{ width: 140 }}
              addonAfter="FCFA"
            />
            <Select
              mode="multiple"
              value={ligne.parcours}
              onChange={v => updateLigne(ligne.key, { parcours: v })}
              placeholder="Parcours"
              style={{ minWidth: 200, flex: 1 }}
              options={parcoursDisponibles.map(p => ({ value: p, label: p }))}
            />
            <Button icon={<DeleteOutlined />} size="small" danger onClick={() => supprimerLigne(ligne.key)} />
          </div>
        ))}
      </div>

      <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button type="dashed" icon={<PlusOutlined />} onClick={ajouterLignePersonnalisee}>
          Ajouter un niveau personnalisé
        </Button>
        <Button
          type="primary"
          icon={<RocketOutlined />}
          loading={validationEnCours}
          onClick={handleConfigurer}
        >
          Configurer les niveaux cochés pour {anneeLabel}
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

      <Modal
        title={`Tarif — ${tarifRow?.libelle ?? ''} (${filiereNom})`}
        open={!!tarifRow}
        onCancel={() => setTarifRow(null)}
        onOk={handleSaveTarif}
        confirmLoading={savingTarif}
        okText="Enregistrer"
        cancelText="Annuler"
        destroyOnClose
      >
        {tarifRow?.tarif?.toujours_non_affecte ? (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            message="Ce niveau n'est jamais accessible au statut Affecté (Master, ou Pro au-delà de Licence 1/2) — seul le tarif Non affecté ci-dessous s'applique."
          />
        ) : (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message={
              tarifRow?.tarif?.montant_affecte_standard != null
                ? `Tarif Affecté standard pour ${tarifRow.libelle} : ${tarifRow.tarif.montant_affecte_standard.toLocaleString('fr-FR')} FCFA`
                : `Aucun tarif Affecté standard défini pour ${tarifRow?.libelle}.`
            }
          />
        )}

        <div style={{ marginBottom: 16 }}>
          <Text strong>Tarif Non affecté</Text>
          <InputNumber
            value={tarifNonAffecte}
            onChange={setTarifNonAffecte}
            min={0}
            addonAfter="FCFA"
            style={{ width: '100%', marginTop: 4 }}
          />
        </div>

        {!tarifRow?.tarif?.toujours_non_affecte && (
          <>
            <Checkbox
              checked={tarifSpecifique}
              onChange={(e) => {
                const coche = e.target.checked;
                setTarifSpecifique(coche);
                // Décocher revient immédiatement au standard à l'écran (cohérent avec ce qui sera
                // réellement enregistré) ; cocher pré-remplit avec la valeur actuelle pour édition.
                if (!coche) setTarifAffecte(tarifRow?.tarif?.montant_affecte_standard ?? null);
              }}
              style={{ marginBottom: 8 }}
            >
              Tarif spécifique à cette filière
            </Checkbox>
            <InputNumber
              value={tarifSpecifique ? tarifAffecte : (tarifRow?.tarif?.montant_affecte_standard ?? null)}
              onChange={setTarifAffecte}
              disabled={!tarifSpecifique}
              min={0}
              addonAfter="FCFA"
              placeholder="Montant Affecté"
              style={{ width: '100%', marginBottom: 16 }}
            />

            <div>
              <Text strong>Tarif Affecté — Réinscription</Text>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>
                Laissez vide si non encore déterminé — une réinscription Affecté sans ce tarif configuré sera
                refusée proprement (aucun montant improvisé), jamais appliquée arbitrairement.
              </Text>
              <InputNumber
                value={tarifAffecteReinscription}
                onChange={setTarifAffecteReinscription}
                min={0}
                addonAfter="FCFA"
                style={{ width: '100%', marginTop: 4 }}
              />
            </div>
          </>
        )}
      </Modal>
    </Drawer>
  );
};

export default FiliereParcoursDrawer;
