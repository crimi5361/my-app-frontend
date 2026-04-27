/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Button, 
  Drawer, 
  Form, 
  Input, 
  Select, 
  Tag, 
  Space, 
  List, 
  Card, 
  Divider, 
  notification,
  InputRef
} from 'antd';
import { 
  PlusOutlined, 
  SaveOutlined, 
  DeleteOutlined,
  EditOutlined,
  SearchOutlined 
} from '@ant-design/icons';
import DataTable from 'react-data-table-component';
import PageHeader from '../../Components/PageHeader/PageHeader';

const { Option } = Select;

interface Niveau {
  libelle: string;
  prix_formation: string;
}


interface FiliereData {
  id: number;
  nom: string;
  sigle: string;
  typefiliere_id: number;
  typefiliere_libelle: string;
  typefiliere_description: string;
  niveaux?: Niveau[]; // Ajouté pour conserver la structure existante
}

interface TypeFiliere {
  id: string;
  libelle: string;
  description: string;
}

const Filieres = () => {
  const [form] = Form.useForm();
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [filieres, setFilieres] = useState<FiliereData[]>([]);
  const [typesFiliere, setTypesFiliere] = useState<TypeFiliere[]>([]);
  const [niveaux, setNiveaux] = useState<Niveau[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [filteredData, setFilteredData] = useState<any[]>([]);
  const API_URL = import.meta.env.VITE_API_URL_SERVER || "";
  const searchInput = React.useRef<InputRef>(null);

  // Fetch data from API
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch filieres - modification de l'URL pour utiliser le nouveau endpoint
        const filieresResponse = await fetch(`${API_URL}/api/filieres/table/Filiere`);
        const filieresData = await filieresResponse.json();
        setFilieres(filieresData);

        // Fetch types filiere
        const typesResponse = await fetch(`${API_URL}/api/typesfiliere`);
        const typesData = await typesResponse.json();
        setTypesFiliere(typesData);
      } catch (error) {
        console.error('Error fetching data:', error);
        notification.error({
          message: 'Erreur',
          description: 'Impossible de charger les données',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [API_URL]);

  // Format data for the table - modification pour utiliser le nouveau format
  const formattedData = useMemo(() => {
    return filieres.map(item => ({
      id: item.id,
      filiere_nom: item.nom,
      filiere_sigle: item.sigle,
      type_filiere_libelle: item.typefiliere_libelle,
      type_filiere_description: item.typefiliere_description,
      niveaux: item.niveaux || [] // Conserve la structure attendue par le tableau
    }));
  }, [filieres]);

  // Handle search
  useEffect(() => {
    if (searchText) {
      const filtered = formattedData.filter(item =>
        item.filiere_nom.toLowerCase().includes(searchText.toLowerCase()) ||
        item.filiere_sigle.toLowerCase().includes(searchText.toLowerCase()) ||
        item.type_filiere_libelle.toLowerCase().includes(searchText.toLowerCase())
      );
      setFilteredData(filtered);
    } else {
      setFilteredData(formattedData);
    }
  }, [searchText, formattedData]);

  // Handle add niveau
  const handleAddNiveau = () => {
    const niveauLibelle = form.getFieldValue('niveauLibelle');
    const niveauPrix = form.getFieldValue('niveauPrix');

    if (niveauLibelle && niveauPrix) {
      setNiveaux([...niveaux, {
        libelle: niveauLibelle,
        prix_formation: niveauPrix
      }]);
      form.setFieldsValue({
        niveauLibelle: '',
        niveauPrix: ''
      });
    }
  };

  // Handle remove niveau
  const handleRemoveNiveau = (index: number) => {
    const newNiveaux = [...niveaux];
    newNiveaux.splice(index, 1);
    setNiveaux(newNiveaux);
  };

  // Handle form submit
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      const response = await fetch(`${API_URL}/api/filieres/filiere`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nom: values.nom,
          sigle: values.sigle,
          type_filiere_id: values.typeFiliere,
          niveaux: niveaux
        }),
      });

      if (response.ok) {
        notification.success({
          message: 'Succès',
          description: 'Filière ajoutée avec succès',
        });
        closeDrawer();
        // Refresh data
        const filieresResponse = await fetch(`${API_URL}/api/filieres`);
        const filieresData = await filieresResponse.json();
        setFilieres(filieresData);
      } else {
        throw new Error('Erreur lors de l\'ajout');
      }
    } catch (error) {
      console.error('Error:', error);
      notification.error({
        message: 'Erreur',
        description: 'Une erreur est survenue lors de l\'ajout de la filière',
      });
    }
  };

  // Open drawer
  const showDrawer = () => {
    setDrawerVisible(true);
  };

  // Close drawer and reset form
  const closeDrawer = () => {
    form.resetFields();
    setNiveaux([]);
    setDrawerVisible(false);
  };

  // Table columns
  const columns = [
    {
      name: 'Nom',
      selector: (row: any) => row.filiere_nom,
      sortable: true,
      cell: (row: any) => (
        <div style={{ fontWeight: 500 }}>{row.filiere_nom}</div>
      ),
    },
    {
      name: 'Sigle',
      selector: (row: any) => row.filiere_sigle,
      sortable: true,
      cell: (row: any) => (
        <Tag color="orange">{row.filiere_sigle}</Tag>
      ),
    },
    
    {
      name: 'Actions',
      cell: (_row: any) => (
        <Space>
          <Button 
            icon={<EditOutlined />} 
            size="small" 
            style={{ color: '#1890ff' }}
          />
          <Button 
            icon={<DeleteOutlined />} 
            size="small" 
            danger 
          />
        </Space>
      ),
      width: '120px'
    },
  ];

  // Custom styles for the table
  const customStyles = {
    headRow: {
      style: {
        backgroundColor: '#fafafa',
        fontWeight: 'bold',
      },
    },
    rows: {
      style: {
        '&:not(:last-of-type)': {
          borderBottom: '1px solid #f0f0f0',
        },
      },
    },
    cells: {
      style: {
        padding: '16px',
      },
    },
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <PageHeader />
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          onClick={showDrawer}
          // style={{ backgroundColor: '#B56910', borderColor: '#B56910' }}
        >
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
        bordered={false}
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

      <Drawer
        title="Nouvelle Filière"
        width={600}
        onClose={closeDrawer}
        visible={drawerVisible}
        bodyStyle={{ paddingBottom: 80 }}
        footer={
          <div style={{ textAlign: 'right' }}>
            <Button onClick={closeDrawer} style={{ marginRight: 8 }}>
              Annuler
            </Button>
            <Button 
              onClick={handleSubmit} 
              type="primary" 
              icon={<SaveOutlined />}
              disabled={!form.getFieldValue('nom') || !form.getFieldValue('sigle') || !form.getFieldValue('typeFiliere') || niveaux.length === 0}
              style={{ backgroundColor: '#B56910', borderColor: '#B56910' }}
            >
              Enregistrer
            </Button>
          </div>
        }
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="nom"
            label="Nom de la filière"
            rules={[{ required: true, message: 'Veuillez saisir le nom de la filière' }]}
          >
            <Input placeholder="Ex: Sociologie" />
          </Form.Item>

          <Form.Item
            name="sigle"
            label="Sigle"
            rules={[{ required: true, message: 'Veuillez saisir le sigle' }]}
          >
            <Input placeholder="Ex: SOCIO" />
          </Form.Item>

          <Form.Item
            name="typeFiliere"
            label="Type de filière"
            rules={[{ required: true, message: 'Veuillez sélectionner un type' }]}
          >
            <Select placeholder="Sélectionnez un type de filière">
              {typesFiliere.map(type => (
                <Option key={type.id} value={type.id}>
                  {type.libelle}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Divider orientation="left">Niveaux de formation</Divider>

          <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
            <Form.Item
              name="niveauLibelle"
              label="Libellé du niveau"
              style={{ flex: 1 }}
            >
              <Input placeholder="Ex: Licence 1" />
            </Form.Item>

            <Form.Item
              name="niveauPrix"
              label="Prix (FCFA)"
              style={{ flex: 1 }}
            >
              <Input type="number" placeholder="Ex: 50000" />
            </Form.Item>

            <Form.Item label=" " colon={false} style={{ alignSelf: 'flex-end' }}>
              <Button 
                type="dashed" 
                icon={<PlusOutlined />} 
                onClick={handleAddNiveau}
              >
                Ajouter
              </Button>
            </Form.Item>
          </div>

          {niveaux.length > 0 && (
            <List
              size="small"
              bordered
              dataSource={niveaux}
              renderItem={(item, index) => (
                <List.Item
                  actions={[
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
                    description={`${item.prix_formation} FCFA`}
                  />
                </List.Item>
              )}
            />
          )}
        </Form>
      </Drawer>
    </div>
  );
};

export default Filieres;