/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useMemo } from 'react';
import {
  Button, Drawer, Form, Input, Select,
  Space, List, Divider, notification, Popconfirm, Tag,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined, SaveOutlined, DeleteOutlined,
  EditOutlined, SettingOutlined, RocketOutlined,
} from '@ant-design/icons';
import PageHeader from '../../Components/PageHeader/PageHeader';
import PageContainer from '../../Components/ui/PageContainer';
import DataTable from '../../Components/ui/DataTable';
import StatusTag from '../../Components/ui/StatusTag';
import AcademicCascadeSelect, { type AcademicSelection } from '../../Components/AcademicCascadeSelect/AcademicCascadeSelect';
import FiliereParcoursDrawer, { type NiveauParcours } from '../../Components/FiliereParcoursDrawer/FiliereParcoursDrawer';
import { apiFetch } from '../../lib/api';

const { Option } = Select;

interface Niveau {
  id?: number;
  libelle: string;
  prix_formation: string;
  ordre?: number | null;
  niveau_suivant_id?: number | null;
  parcours?: string[];
  tarif?: {
    montant_affecte: number | string | null;
    montant_affecte_reinscription: number | string | null;
    montant_non_affecte: number | string | null;
    toujours_non_affecte: boolean;
  } | null;
}

interface FiliereData {
  id: number;
  nom: string;
  sigle: string;
  typefiliere_id: number;
  typefiliere_libelle: string;
  typefiliere_description: string;
  departement_id: number | null;
  filiere_mere_id: number | null;
  filiere_mere_nom?: string | null;
  niveaux: Niveau[];
  configuree?: boolean;
}

interface TypeFiliere {
  id: string;
  libelle: string;
  description: string;
}

interface AnneeAcademique {
  id: number;
  annee: string;
  etat?: string;
}

// Helper pour ajouter le token d'authentification
const getAuthHeaders = (): HeadersInit => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
};

const Filieres = () => {
  const [form] = Form.useForm();
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [editingFiliere, setEditingFiliere] = useState<FiliereData | null>(null);
  const [filieres, setFilieres] = useState<FiliereData[]>([]);
  const [typesFiliere, setTypesFiliere] = useState<TypeFiliere[]>([]);
  const [niveaux, setNiveaux] = useState<Niveau[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [academicSelection, setAcademicSelection] = useState<AcademicSelection>({});
  const [departementsIndex, setDepartementsIndex] = useState<{ id: number; ecole_id: number }[]>([]);
  const [parcoursFiliere, setParcoursFiliere] = useState<FiliereData | null>(null);
  const [annees, setAnnees] = useState<AnneeAcademique[]>([]);
  const [selectedAnneeId, setSelectedAnneeId] = useState<number | null>(null);
  const [loadingYears, setLoadingYears] = useState(false);

  const nomValue = Form.useWatch('nom', form);
  const sigleValue = Form.useWatch('sigle', form);
  const typeFiliereValue = Form.useWatch('typeFiliere', form);
  const canSubmit = !!nomValue && !!sigleValue && !!typeFiliereValue && !!academicSelection.departement_id
    && (!!editingFiliere || niveaux.length > 0);

  const API_URL = import.meta.env.VITE_API_URL_SERVER || '';

  // ── Fetch filières pour la préparation de rentrée : TOUTES les filières permanentes, avec leur
  // état de configuration pour l'année académique sélectionnée (jamais seulement l'année en cours
  // du site — cette page doit permettre de préparer une année différente de l'année active).
  const fetchFilieres = async (anneeId: number) => {
    try {
      const data: FiliereData[] = await apiFetch(`/api/filieres/table/Filiere?toutes=true&anneeAcademiqueId=${anneeId}`);
      setFilieres(data);
    } catch (error) {
      console.error('Erreur fetchFilieres:', error);
      notification.error({
        message: 'Erreur',
        description: 'Impossible de charger les filières. Vérifiez votre connexion.'
      });
    }
  };

  // ── Chargement des années académiques (même pattern que les autres écrans : Effectifs, etc.) ──
  useEffect(() => {
    const fetchAnnees = async () => {
      setLoadingYears(true);
      try {
        const data: AnneeAcademique[] = await apiFetch('/api/annees');
        setAnnees(data);
        const courante = data.find(a => ['en cours', 'en cour', 'active'].includes((a.etat || '').toLowerCase()));
        setSelectedAnneeId((courante || data[data.length - 1])?.id ?? null);
      } catch {
        notification.error({ message: 'Erreur', description: 'Impossible de charger les années académiques.' });
      } finally {
        setLoadingYears(false);
      }
    };
    fetchAnnees();
  }, []);

  useEffect(() => {
    const fetchAll = async () => {
      if (!selectedAnneeId) return;
      setLoading(true);
      try {
        await fetchFilieres(selectedAnneeId);
        const typesRes = await fetch(`${API_URL}/api/typesfiliere`, {
          headers: getAuthHeaders()
        });
        setTypesFiliere(await typesRes.json());
        const depsRes = await fetch(`${API_URL}/api/departements`, {
          headers: getAuthHeaders()
        });
        setDepartementsIndex(await depsRes.json());
      } catch (error) {
        console.error('Erreur chargement:', error);
        notification.error({ message: 'Erreur', description: 'Impossible de charger les données' });
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [API_URL, selectedAnneeId]);

  const selectedAnneeLabel = annees.find(a => a.id === selectedAnneeId)?.annee || '';

  // Garde parcoursFiliere synchronisé après un rechargement (fetchFilieres) déclenché depuis le
  // Drawer parcours — sinon la liste de niveaux affichée resterait figée sur l'ancien snapshot.
  useEffect(() => {
    if (!parcoursFiliere) return;
    const jourFiliere = filieres.find(f => f.id === parcoursFiliere.id);
    if (jourFiliere && jourFiliere !== parcoursFiliere) setParcoursFiliere(jourFiliere);
  }, [filieres]);

  // ── Recherche ───────────────────────────────────────────────────────────────
  const filteredFilieres = useMemo(() =>
    searchText
      ? filieres.filter(item =>
          item.nom.toLowerCase().includes(searchText.toLowerCase()) ||
          item.sigle.toLowerCase().includes(searchText.toLowerCase()) ||
          item.typefiliere_libelle.toLowerCase().includes(searchText.toLowerCase())
        )
      : filieres,
  [filieres, searchText]);

  // ── Ajouter un niveau ────────────────────────────────────────────────────
  const handleAddNiveau = () => {
    const libelle = form.getFieldValue('niveauLibelle');
    const prix = form.getFieldValue('niveauPrix');
    if (!libelle || !prix) {
      notification.warning({ message: 'Champs manquants', description: 'Saisissez le libellé et le prix du niveau.' });
      return;
    }
    setNiveaux(prev => [...prev, { libelle, prix_formation: prix }]);
    form.setFieldsValue({ niveauLibelle: '', niveauPrix: '' });
  };

  const handleRemoveNiveau = (index: number) => {
    setNiveaux(prev => prev.filter((_, i) => i !== index));
  };

  // ── Soumission ──────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields(['nom', 'sigle', 'typeFiliere']);

      if (!editingFiliere && niveaux.length === 0) {
        notification.warning({ message: 'Niveaux requis', description: 'Ajoutez au moins un niveau de formation.' });
        return;
      }

      setSubmitting(true);

      const isEdit = !!editingFiliere;
      const url = isEdit
        ? `${API_URL}/api/filieres/${editingFiliere!.id}`
        : `${API_URL}/api/filieres`;

      const body = isEdit
        ? {
            nom: values.nom,
            sigle: values.sigle,
            type_filiere_id: values.typeFiliere,
            departement_id: academicSelection.departement_id,
            filiere_mere_id: values.filiereMereId || null,
          }
        : {
            nom: values.nom,
            sigle: values.sigle,
            type_filiere_id: values.typeFiliere,
            departement_id: academicSelection.departement_id,
            filiere_mere_id: values.filiereMereId || null,
            niveaux,
          };

      const response = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
      });

      if (response.status === 401) {
        notification.error({ message: 'Session expirée', description: 'Veuillez vous reconnecter.' });
        // Optionnel : rediriger vers login
        return;
      }

      if (response.status === 409) {
        const errorData = await response.json().catch(() => null);
        notification.warning({
          message: 'Filière déjà existante',
          description: errorData?.message || 'Cette filière existe déjà. Utilisez « Préparer la rentrée » / « Gérer » depuis sa fiche plutôt que d\'en recréer une.',
          duration: 8,
        });
        return;
      }
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erreur réseau');
      }

      notification.success({
        message: 'Succès',
        description: isEdit ? 'Filière mise à jour avec succès' : 'Filière créée avec succès',
      });
      closeDrawer();
      if (selectedAnneeId) await fetchFilieres(selectedAnneeId);
    } catch (error: any) {
      if (error?.errorFields) return;
      console.error('Erreur submit:', error);
      notification.error({ message: 'Erreur', description: error.message || "Une erreur est survenue lors de l'enregistrement" });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Ouvrir en mode édition ──────────────────────────────────────────────────
  const handleEdit = (row: FiliereData) => {
    setEditingFiliere({
      id: row.id,
      nom: row.nom,
      sigle: row.sigle,
      typefiliere_id: row.typefiliere_id,
      typefiliere_libelle: row.typefiliere_libelle,
      typefiliere_description: row.typefiliere_description,
      departement_id: row.departement_id,
      filiere_mere_id: row.filiere_mere_id ?? null,
      niveaux: row.niveaux || [],
    });
    form.setFieldsValue({
      nom: row.nom,
      sigle: row.sigle,
      typeFiliere: String(row.typefiliere_id),
      filiereMereId: row.filiere_mere_id ?? undefined,
    });
    setNiveaux(row.niveaux || []);
    const dep = departementsIndex.find(d => d.id === row.departement_id);
    setAcademicSelection({ ecole_id: dep?.ecole_id, departement_id: row.departement_id ?? undefined });
    setDrawerVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`${API_URL}/api/filieres/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        notification.warning({ message: 'Suppression impossible', description: data.message || 'Cette filière est encore utilisée.' });
        return;
      }
      notification.success({ message: 'Filière supprimée' });
      if (selectedAnneeId) await fetchFilieres(selectedAnneeId);
    } catch (error) {
      console.error('Erreur handleDelete:', error);
      notification.error({ message: 'Erreur', description: 'Impossible de supprimer cette filière.' });
    }
  };

  const openParcours = (row: any) => {
    const filiere = filieres.find(f => f.id === row.id);
    if (filiere) setParcoursFiliere(filiere);
  };

  const showDrawer = () => {
    setEditingFiliere(null);
    setAcademicSelection({});
    setDrawerVisible(true);
  };

  const closeDrawer = () => {
    form.resetFields();
    setNiveaux([]);
    setAcademicSelection({});
    setEditingFiliere(null);
    setDrawerVisible(false);
  };

  // ── Colonnes ────────────────────────────────────────────────────────────────
  const columns: ColumnsType<FiliereData> = [
    {
      title: 'Nom',
      dataIndex: 'nom',
      key: 'nom',
      sorter: (a, b) => a.nom.localeCompare(b.nom),
      render: (nom: string) => <span style={{ fontWeight: 500 }}>{nom}</span>,
    },
    {
      title: 'Sigle',
      dataIndex: 'sigle',
      key: 'sigle',
      sorter: (a, b) => a.sigle.localeCompare(b.sigle),
      render: (sigle: string) => <StatusTag tone="warning" label={sigle} />,
    },
    {
      title: 'Type de filière',
      dataIndex: 'typefiliere_libelle',
      key: 'typefiliere_libelle',
      sorter: (a, b) => a.typefiliere_libelle.localeCompare(b.typefiliere_libelle),
      render: (libelle: string) => <StatusTag tone="info" label={libelle} />,
    },
    {
      title: `État ${selectedAnneeLabel}`,
      key: 'configuree',
      width: 150,
      filters: [
        { text: 'Configurée', value: true },
        { text: 'Non configurée', value: false },
      ],
      onFilter: (value, row) => row.configuree === value,
      render: (_, row) => (
        row.configuree
          ? <StatusTag tone="success" label="✓ Configurée" />
          : <StatusTag tone="warning" label="⚠ Non configurée" />
      ),
    },
    {
      title: 'Niveaux ouverts',
      key: 'niveaux',
      render: (_, row) => (
        (row.niveaux || []).length === 0
          ? <span style={{ color: 'var(--text-soft)', fontSize: 12 }}>Aucun</span>
          : (
            <Space size={4} wrap>
              {(row.niveaux || []).map((n: Niveau, i: number) => (
                <StatusTag key={i} tone="success" label={n.libelle} />
              ))}
            </Space>
          )
      ),
    },
    {
      title: 'Parcours',
      key: 'parcours',
      render: (_, row) => {
        const parcoursUniques = Array.from(new Set((row.niveaux || []).flatMap(n => n.parcours || [])));
        return parcoursUniques.length === 0
          ? <span style={{ color: 'var(--text-soft)', fontSize: 12 }}>—</span>
          : (
            <Space size={4} wrap>
              {parcoursUniques.map(p => <Tag key={p} color="blue">{p}</Tag>)}
            </Space>
          );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 220,
      render: (_, row) => (
        <Space>
          {row.configuree ? (
            <Button icon={<SettingOutlined />} size="small" onClick={() => openParcours(row)}>
              Gérer
            </Button>
          ) : (
            <Button type="primary" icon={<RocketOutlined />} size="small" onClick={() => openParcours(row)}>
              Préparer la rentrée
            </Button>
          )}
          <Button icon={<EditOutlined />} size="small" style={{ color: 'var(--mod-scolarite)' }} onClick={() => handleEdit(row)} title="Modifier nom/sigle/type" />
          <Popconfirm
            title="Supprimer cette filière ?"
            description="Bloqué automatiquement si des niveaux y sont encore rattachés (toutes années confondues)."
            onConfirm={() => handleDelete(row.id)}
          >
            <Button icon={<DeleteOutlined />} size="small" danger />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageHeader />
      <PageContainer
        title="Gestion des filières — Préparation de rentrée"
        actions={
          <Button type="primary" icon={<PlusOutlined />} onClick={showDrawer}>
            Nouvelle Filière
          </Button>
        }
      >
        <div style={{ marginBottom: 16, maxWidth: 280 }}>
          <div style={{ marginBottom: 4, fontWeight: 500 }}>Année académique</div>
          <Select
            value={selectedAnneeId}
            onChange={setSelectedAnneeId}
            style={{ width: '100%' }}
            loading={loadingYears}
            placeholder="Sélectionner une année"
          >
            {annees.map(a => <Option key={a.id} value={a.id}>{a.annee}</Option>)}
          </Select>
        </div>

        <DataTable<FiliereData>
          columns={columns}
          dataSource={filteredFilieres}
          rowKey="id"
          loading={loading}
          searchValue={searchText}
          searchPlaceholder="Rechercher une filière"
          onSearchChange={setSearchText}
          emptyTitle={searchText ? 'Aucun résultat trouvé' : 'Aucune filière'}
        />
      </PageContainer>

      {/* ── Drawer ─────────────────────────────────────────────────────────── */}
      <Drawer
        title={editingFiliere ? 'Modifier la Filière' : 'Nouvelle Filière'}
        width={600}
        onClose={closeDrawer}
        open={drawerVisible}
        styles={{ body: { paddingBottom: 80 } }}
        footer={
          <div style={{ textAlign: 'right' }}>
            <Button onClick={closeDrawer} style={{ marginRight: 8 }}>Annuler</Button>
            <Button
              onClick={handleSubmit}
              type="primary"
              icon={<SaveOutlined />}
              loading={submitting}
              disabled={!canSubmit}
            >
              Enregistrer
            </Button>
          </div>
        }
      >
        <Form form={form} layout="vertical">
          <Form.Item name="nom" label="Nom de la filière"
            rules={[{ required: true, message: 'Veuillez saisir le nom de la filière' }]}>
            <Input placeholder="Ex: Sociologie" />
          </Form.Item>

          <Form.Item name="sigle" label="Sigle"
            rules={[{ required: true, message: 'Veuillez saisir le sigle' }]}>
            <Input placeholder="Ex: SOCIO" />
          </Form.Item>

          <Form.Item name="typeFiliere" label="Type de filière"
            rules={[{ required: true, message: 'Veuillez sélectionner un type' }]}>
            <Select placeholder="Sélectionnez un type de filière">
              {typesFiliere.map(type => (
                <Option key={type.id} value={type.id}>{type.libelle}</Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="filiereMereId" label="Filière-mère (si cette filière est une option)">
            <Select
              placeholder="Aucune — filière normale"
              allowClear
              options={filieres
                .filter(f => f.id !== editingFiliere?.id)
                .map(f => ({ value: f.id, label: f.nom }))}
            />
          </Form.Item>

          <Divider orientation="left">École et Département de rattachement</Divider>
          <AcademicCascadeSelect value={academicSelection} onChange={setAcademicSelection} />

          {/* ── Section Niveaux ────────────────────────────────────────────── */}
          <Divider orientation="left">
            Niveaux de formation{' '}
            <span style={{ color: niveaux.length === 0 ? 'var(--danger)' : 'var(--success)', fontSize: 12 }}>
              ({niveaux.length} ajouté{niveaux.length > 1 ? 's' : ''})
            </span>
          </Divider>

          {editingFiliere ? (
            <div style={{ fontSize: 13, color: 'var(--text-soft)', marginBottom: 12 }}>
              La gestion des niveaux (ajout, modification, suppression, ordre, progression) se fait
              désormais depuis le bouton "Gérer" / "Préparer la rentrée" de la liste des filières.
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'flex-end' }}>
              <Form.Item name="niveauLibelle" label="Libellé du niveau" style={{ flex: 1, marginBottom: 0 }}>
                <Input placeholder="Ex: Licence 1" />
              </Form.Item>
              <Form.Item name="niveauPrix" label="Prix (FCFA)" style={{ flex: 1, marginBottom: 0 }}>
                <Input type="number" placeholder="Ex: 50000" min={0} />
              </Form.Item>
              <Button type="dashed" icon={<PlusOutlined />} onClick={handleAddNiveau} style={{ marginBottom: 0 }}>
                Ajouter
              </Button>
            </div>
          )}

          {niveaux.length > 0 && (
            <List
              size="small"
              bordered
              dataSource={niveaux}
              renderItem={(item, index) => (
                <List.Item
                  actions={editingFiliere ? [] : [
                    <Button
                      icon={<DeleteOutlined />}
                      size="small"
                      danger
                      onClick={() => handleRemoveNiveau(index)}
                    />
                  ]}
                >
                  <List.Item.Meta
                    title={item.libelle}
                    description={`${Number(item.prix_formation).toLocaleString('fr-FR')} FCFA`}
                  />
                </List.Item>
              )}
            />
          )}

          {!editingFiliere && niveaux.length === 0 && (
            <div style={{
              textAlign: 'center', padding: '12px',
              border: '1px dashed var(--danger)', borderRadius: 6,
              color: 'var(--danger)', fontSize: 13
            }}>
              ⚠️ Ajoutez au moins un niveau pour pouvoir enregistrer
            </div>
          )}
        </Form>
      </Drawer>

      <FiliereParcoursDrawer
        open={!!parcoursFiliere}
        onClose={() => setParcoursFiliere(null)}
        filiereId={parcoursFiliere?.id ?? null}
        filiereNom={parcoursFiliere?.nom ?? ''}
        anneeId={selectedAnneeId}
        anneeLabel={selectedAnneeLabel}
        niveaux={(parcoursFiliere?.niveaux ?? []) as NiveauParcours[]}
        toutesLesFilieres={filieres.map(f => ({ id: f.id, nom: f.nom, filiere_mere_id: f.filiere_mere_id }))}
        onChanged={async () => {
          if (selectedAnneeId) await fetchFilieres(selectedAnneeId);
        }}
      />
    </div>
  );
};

export default Filieres;