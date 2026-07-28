/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useMemo } from 'react';
import {
  Button, Drawer, Form, Input, Select, Tag,
  Space, List, Card, Divider, notification, InputRef, Popconfirm,
} from 'antd';
import {
  PlusOutlined, SaveOutlined, DeleteOutlined,
  EditOutlined, SearchOutlined, ApartmentOutlined,
} from '@ant-design/icons';
import DataTable from 'react-data-table-component';
import PageHeader from '../../Components/PageHeader/PageHeader';
import AcademicCascadeSelect, { type AcademicSelection } from '../../Components/AcademicCascadeSelect/AcademicCascadeSelect';
import FiliereParcoursDrawer, { type NiveauParcours } from '../../Components/FiliereParcoursDrawer/FiliereParcoursDrawer';

const { Option } = Select;

interface Niveau {
  id?: number;
  libelle: string;
  prix_formation: string;
  ordre?: number | null;
  niveau_suivant_id?: number | null;
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
}

interface TypeFiliere {
  id: string;
  libelle: string;
  description: string;
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
  const [filteredData, setFilteredData] = useState<any[]>([]);
  const [academicSelection, setAcademicSelection] = useState<AcademicSelection>({});
  const [departementsIndex, setDepartementsIndex] = useState<{ id: number; ecole_id: number }[]>([]);
  const [parcoursFiliere, setParcoursFiliere] = useState<FiliereData | null>(null);

  const nomValue = Form.useWatch('nom', form);
  const sigleValue = Form.useWatch('sigle', form);
  const typeFiliereValue = Form.useWatch('typeFiliere', form);
  const canSubmit = !!nomValue && !!sigleValue && !!typeFiliereValue && !!academicSelection.departement_id
    && (!!editingFiliere || niveaux.length > 0);

  const API_URL = import.meta.env.VITE_API_URL_SERVER || '';
  const searchInput = React.useRef<InputRef>(null);

  // ── Fetch filières avec authentification ──────────────────────────────────────────
  const fetchFilieres = async () => {
    try {
      const res = await fetch(`${API_URL}/api/filieres/table/Filiere`, {
        headers: getAuthHeaders()
      });
      if (!res.ok) {
        throw new Error(`Erreur HTTP: ${res.status}`);
      }
      const data = await res.json();
      setFilieres(data);
    } catch (error) {
      console.error('Erreur fetchFilieres:', error);
      notification.error({ 
        message: 'Erreur', 
        description: 'Impossible de charger les filières. Vérifiez votre connexion.' 
      });
    }
  };

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        await fetchFilieres();
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
  }, [API_URL]);

  // Garde parcoursFiliere synchronisé après un rechargement (fetchFilieres) déclenché depuis le
  // Drawer parcours — sinon la liste de niveaux affichée resterait figée sur l'ancien snapshot.
  useEffect(() => {
    if (!parcoursFiliere) return;
    const jourFiliere = filieres.find(f => f.id === parcoursFiliere.id);
    if (jourFiliere && jourFiliere !== parcoursFiliere) setParcoursFiliere(jourFiliere);
  }, [filieres]);

  // ── Formatage tableau ───────────────────────────────────────────────────────
  const formattedData = useMemo(() =>
    filieres.map(item => ({
      id: item.id,
      filiere_nom: item.nom,
      filiere_sigle: item.sigle,
      typefiliere_id: item.typefiliere_id,
      type_filiere_libelle: item.typefiliere_libelle,
      type_filiere_description: item.typefiliere_description,
      departement_id: item.departement_id,
      filiere_mere_id: item.filiere_mere_id,
      filiere_mere_nom: item.filiere_mere_nom,
      niveaux: item.niveaux || [],
    })),
  [filieres]);

  // ── Recherche ───────────────────────────────────────────────────────────────
  useEffect(() => {
    setFilteredData(
      searchText
        ? formattedData.filter(item =>
            item.filiere_nom.toLowerCase().includes(searchText.toLowerCase()) ||
            item.filiere_sigle.toLowerCase().includes(searchText.toLowerCase()) ||
            item.type_filiere_libelle.toLowerCase().includes(searchText.toLowerCase())
          )
        : formattedData
    );
  }, [searchText, formattedData]);

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
        notification.warning({ message: 'Doublon', description: 'Cette filière existe déjà.' });
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
      await fetchFilieres();
    } catch (error: any) {
      if (error?.errorFields) return;
      console.error('Erreur submit:', error);
      notification.error({ message: 'Erreur', description: error.message || "Une erreur est survenue lors de l'enregistrement" });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Ouvrir en mode édition ──────────────────────────────────────────────────
  const handleEdit = (row: any) => {
    setEditingFiliere({
      id: row.id,
      nom: row.filiere_nom,
      sigle: row.filiere_sigle,
      typefiliere_id: row.typefiliere_id,
      typefiliere_libelle: row.type_filiere_libelle,
      typefiliere_description: row.type_filiere_description,
      departement_id: row.departement_id,
      filiere_mere_id: row.filiere_mere_id ?? null,
      niveaux: row.niveaux || [],
    });
    form.setFieldsValue({
      nom: row.filiere_nom,
      sigle: row.filiere_sigle,
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
      await fetchFilieres();
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
  const columns = [
    {
      name: 'Nom',
      selector: (row: any) => row.filiere_nom,
      sortable: true,
      cell: (row: any) => <div style={{ fontWeight: 500 }}>{row.filiere_nom}</div>,
    },
    {
      name: 'Sigle',
      selector: (row: any) => row.filiere_sigle,
      sortable: true,
      cell: (row: any) => <Tag color="orange">{row.filiere_sigle}</Tag>,
    },
    {
      name: 'Type de filière',
      selector: (row: any) => row.type_filiere_libelle,
      sortable: true,
      cell: (row: any) => <Tag color="blue">{row.type_filiere_libelle}</Tag>,
    },
    {
      name: 'Niveaux',
      cell: (row: any) => (
        <Space size={4} wrap>
          {(row.niveaux || []).map((n: Niveau, i: number) => (
            <Tag key={i} color="green">{n.libelle}</Tag>
          ))}
        </Space>
      ),
    },
    {
      name: 'Actions',
      cell: (row: any) => (
        <Space>
          <Button icon={<ApartmentOutlined />} size="small" onClick={() => openParcours(row)} title="Parcours (niveaux, orientations, duplication)" />
          <Button icon={<EditOutlined />} size="small" style={{ color: '#1890ff' }} onClick={() => handleEdit(row)} />
          <Popconfirm
            title="Supprimer cette filière ?"
            description="Bloqué automatiquement si des niveaux y sont encore rattachés."
            onConfirm={() => handleDelete(row.id)}
          >
            <Button icon={<DeleteOutlined />} size="small" danger />
          </Popconfirm>
        </Space>
      ),
      width: '160px',
    },
  ];

  const customStyles = {
    headRow: { style: { backgroundColor: '#fafafa', fontWeight: 'bold' } },
    rows: { style: { '&:not(:last-of-type)': { borderBottom: '1px solid #f0f0f0' } } },
    cells: { style: { padding: '16px' } },
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <PageHeader />
        <Button type="primary" icon={<PlusOutlined />} onClick={showDrawer}>
          Ajouter une Filière
        </Button>
      </div>

      <Card
        title="Liste des Filières"
        extra={
          <Input
            ref={searchInput}
            placeholder="Rechercher..."
            prefix={<SearchOutlined />}
            onChange={e => setSearchText(e.target.value)}
            style={{ width: 300 }}
            allowClear
          />
        }
        variant="borderless"
        style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
      >
        <DataTable
          columns={columns}
          data={filteredData}
          pagination
          progressPending={loading}
          highlightOnHover
          customStyles={customStyles}
          noDataComponent={
            <div style={{ padding: 24, textAlign: 'center' }}>
              {searchText ? 'Aucun résultat trouvé' : 'Aucune donnée disponible'}
            </div>
          }
        />
      </Card>

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
              style={{ backgroundColor: '#B56910', borderColor: '#B56910' }}
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
            <span style={{ color: niveaux.length === 0 ? '#ff4d4f' : '#52c41a', fontSize: 12 }}>
              ({niveaux.length} ajouté{niveaux.length > 1 ? 's' : ''})
            </span>
          </Divider>

          {editingFiliere ? (
            <div style={{ fontSize: 13, color: '#888', marginBottom: 12 }}>
              La gestion des niveaux (ajout, modification, suppression, ordre, progression) se fait
              désormais depuis le bouton "Parcours" de la liste des filières.
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
              border: '1px dashed #ffccc7', borderRadius: 6,
              color: '#ff4d4f', fontSize: 13 
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
        niveaux={(parcoursFiliere?.niveaux ?? []) as NiveauParcours[]}
        toutesLesFilieres={filieres.map(f => ({ id: f.id, nom: f.nom, filiere_mere_id: f.filiere_mere_id }))}
        onChanged={async () => {
          await fetchFilieres();
        }}
      />
    </div>
  );
};

export default Filieres;