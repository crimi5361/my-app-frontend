/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PageHeader from '../../Components/PageHeader/PageHeader';
import { Card, Button, Modal, Form, Input, InputNumber, Select, Space, message, Spin, Table, Tag, Row, Col, Typography } from 'antd';
import { PlusOutlined, ArrowLeftOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

const API_URL = import.meta.env.VITE_API_URL_SERVER || "";

// Interfaces pour typer nos données
interface MaquetteDetail {
  id: number;
  filiere_nom: string;
  filiere_sigle: string;
  niveau_libelle: string;
  annee_academique: string;
  parcour: string;
}

interface UE {
  id: number;
  libelle: string;
  semestre_id: number;
  semestre_libelle: string;
  categorie_id: number;
  categorie_nom: string;
  credit_total?: number;
  matieres?: Matiere[];
}

interface Matiere {
  id: number;
  nom: string;
  coefficient: number;
  ue_id: number;
  volume_horaire_cm: number;
  taux_horaire_cm: number;
  volume_horaire_td: number;
  taux_horaire_td: number;
}

interface Categorie {
  id: number;
  nom: string;
}

interface SemestreData {
  id: number;
  libelle: string;
  ues: UE[];
}

const DetailMaquette: React.FC = () => {
  // Récupération de l'ID de la maquette depuis l'URL
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  // États pour stocker les données
  const [maquette, setMaquette] = useState<MaquetteDetail | null>(null);
  const [semestres, setSemestres] = useState<SemestreData[]>([]);
  const [categories, setCategories] = useState<Categorie[]>([]);
  const [allSemestres, setAllSemestres] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // États pour gérer les modals
  const [ueModalVisible, setUeModalVisible] = useState(false);
  const [matiereModalVisible, setMatiereModalVisible] = useState(false);
  const [availableUes, setAvailableUes] = useState<UE[]>([]);
  
  // Forms pour les modals
  const [ueForm] = Form.useForm();
  const [matiereForm] = Form.useForm();

  // Chargement initial des données
  useEffect(() => {
    if (id) {
      fetchMaquetteDetail();
      fetchAllSemestres();
      fetchCategories();
    }
  }, [id]);

  // Fonction pour charger les détails structurés de la maquette
  const fetchMaquetteDetail = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/detailaffichageMaquette/maquettes/${id}/structured`);
      
      if (!response.ok) {
        throw new Error('Erreur de chargement des données');
      }

      const data = await response.json();
      setMaquette(data.maquette);
      setSemestres(data.semestres || []);
    } catch (error) {
      console.error('Erreur détaillée:', error);
      message.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  // Chargement des UE pour la maquette (pour le select des matières)
  const fetchUesForMaquette = async () => {
    try {
      const response = await fetch(`${API_URL}/api/maquettes/maquettes/${id}/ues`);
      if (!response.ok) {
        throw new Error('Erreur de chargement des UE');
      }
      const data = await response.json();
      const ues = Array.isArray(data) ? data : [];
      setAvailableUes(ues);
      return ues;
    } catch (error) {
      console.error('Erreur UE:', error);
      message.error('Erreur lors du chargement des UE');
      return [];
    }
  };

  // Chargement de tous les semestres (pour le formulaire UE)
  const fetchAllSemestres = async () => {
    try {
      const response = await fetch(`${API_URL}/api/semestres`);
      if (!response.ok) {
        throw new Error('Erreur de chargement des semestres');
      }
      const data = await response.json();
      setAllSemestres(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Erreur semestres:', error);
      message.error('Erreur lors du chargement des semestres');
    }
  };

  // Chargement des catégories
  const fetchCategories = async () => {
    try {
      const response = await fetch(`${API_URL}/api/categorie`);
      if (!response.ok) {
        throw new Error('Erreur de chargement des catégories');
      }
      const data = await response.json();
      setCategories(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Erreur catégories:', error);
      message.error('Erreur lors du chargement des catégories');
    }
  };

  // Création d'une nouvelle UE
  const handleCreateUE = async (values: any) => {
    try {
      const response = await fetch(`${API_URL}/api/ues/ues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...values,
          maquette_id: parseInt(id || '0')
        }),
      });

      const data = await response.json();
      if (data.success) {
        message.success('UE créée avec succès');
        setUeModalVisible(false);
        ueForm.resetFields();
        fetchMaquetteDetail(); // Recharger les données
      } else {
        message.error(data.message || 'Erreur lors de la création');
      }
    } catch (error) {
      message.error('Erreur lors de la création de l\'UE');
    }
  };

  // Création d'une nouvelle matière
const handleCreateMatiere = async (values: any) => {
  try {
    // Préparer les données avec des valeurs par défaut si nécessaire
    const dataToSend = {
      ...values,
      volume_horaire_td: values.volume_horaire_td || 0,
      taux_horaire_td: values.taux_horaire_td || 0,
      volume_horaire_cm: values.volume_horaire_cm || 0,
      taux_horaire_cm: values.taux_horaire_cm || 0,
    };

    const response = await fetch(`${API_URL}/api/matiere`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dataToSend),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erreur HTTP: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    if (data.success) {
      message.success('Matière créée avec succès');
      setMatiereModalVisible(false);
      matiereForm.resetFields();
      fetchMaquetteDetail(); // Recharger les données
    } else {
      message.error(data.message || 'Erreur lors de la création');
    }
  } catch (error) {
    console.error('Erreur détaillée:', error);
    message.error('Erreur lors de la création de la matière');
  }
};

  // Calculer le coût CM (Volume Horaire CM * Taux Horaire CM)
  const calculateCoutCM = (volumeCM: number, tauxCM: number) => {
    return volumeCM * tauxCM;
  };

  // Calculer le coût TD (Volume Horaire TD * Taux Horaire TD)
  const calculateCoutTD = (volumeTD: number, tauxTD: number) => {
    return volumeTD * tauxTD;
  };

  // Calculer le crédit total d'une UE (somme des coefficients des matières)

  // Fonction pour regrouper les données par UE avec fusion des cellules
  const getGroupedDataByUE = (semestre: SemestreData) => {
    return semestre.ues.flatMap(ue => {
      const matieres = ue.matieres || [];
      return matieres.map((matiere, index) => ({
        ...matiere,
        ue_libelle: index === 0 ? ue.libelle : '', // Afficher le nom de l'UE seulement pour la première matière
        ue_id: ue.id,
        ue_rowspan: index === 0 ? matieres.length : 0, // Rowspan pour fusionner les cellules UE
        key: `${ue.id}-${matiere.id}`,
        // Ajout des propriétés de l'UE pour les totaux
        ue_credit_total: ue.credit_total,
        ue_categorie: ue.categorie_nom
      }));
    });
  };

  // Colonnes du tableau pour l'affichage groupé par UE
  const tableColumns = [
    { 
      title: 'UE', 
      dataIndex: 'ue_libelle', 
      key: 'ue_libelle',
      render: (text: string, record: any) => ({
        children: text ? <Text strong style={{ color: '#1d3557' }}>{text}</Text> : null,
        props: {
          rowSpan: record.ue_rowspan || 0,
          style: { 
            backgroundColor: record.ue_rowspan ? '#e6f7ff' : 'transparent',
            borderRight: '1px solid #d9d9d9',
            borderBottom: '1px solid #d9d9d9'
          }
        },
      }),
      onCell: (record: any) => ({
        rowSpan: record.ue_rowspan || 0,
        style: { 
          backgroundColor: record.ue_rowspan ? '#e6f7ff' : 'transparent',
          borderRight: '1px solid #d9d9d9',
          borderBottom: '1px solid #d9d9d9'
        }
      }),
      width: '15%',
    },
    { 
      title: 'MATIÈRE (ÉCUE)', 
      dataIndex: 'nom', 
      key: 'nom',
      render: (text: string) => <Text>{text}</Text>,
      onCell: () => ({
        style: { 
          borderRight: '1px solid #d9d9d9',
          borderBottom: '1px solid #d9d9d9'
        }
      }),
      width: '20%',
    },
    { 
      title: 'VOLUME HORAIRE CM', 
      dataIndex: 'volume_horaire_cm', 
      key: 'volume_horaire_cm',
      align: 'center' as const,
      onCell: () => ({
        style: { 
          borderRight: '1px solid #d9d9d9',
          borderBottom: '1px solid #d9d9d9'
        }
      }),
      width: '8%',
    },
    { 
      title: 'TAUX HORAIRE CM', 
      dataIndex: 'taux_horaire_cm', 
      key: 'taux_horaire_cm',
      align: 'center' as const,
      render: (value: number) => value?.toLocaleString('fr-FR'),
      onCell: () => ({
        style: { 
          borderRight: '1px solid #d9d9d9',
          borderBottom: '1px solid #d9d9d9'
        }
      }),
      width: '8%',
    },
    { 
      title: 'COUT CM', 
      key: 'cout_cm',
      align: 'center' as const,
      render: (_: any, record: Matiere) => (
        <Tag color="blue" style={{ margin: 0 }}>
          {calculateCoutCM(record.volume_horaire_cm, record.taux_horaire_cm)?.toLocaleString('fr-FR')} F
        </Tag>
      ),
      onCell: () => ({
        style: { 
          borderRight: '1px solid #d9d9d9',
          borderBottom: '1px solid #d9d9d9'
        }
      }),
      width: '10%',
    },
    { 
      title: 'VOLUME HORAIRE TD', 
      dataIndex: 'volume_horaire_td', 
      key: 'volume_horaire_td',
      align: 'center' as const,
      onCell: () => ({
        style: { 
          borderRight: '1px solid #d9d9d9',
          borderBottom: '1px solid #d9d9d9'
        }
      }),
      width: '8%',
    },
    { 
      title: 'TAUX HORAIRE TD', 
      dataIndex: 'taux_horaire_td', 
      key: 'taux_horaire_td',
      align: 'center' as const,
      render: (value: number) => value?.toLocaleString('fr-FR'),
      onCell: () => ({
        style: { 
          borderRight: '1px solid #d9d9d9',
          borderBottom: '1px solid #d9d9d9'
        }
      }),
      width: '8%',
    },
    { 
      title: 'COUT TD', 
      key: 'cout_td',
      align: 'center' as const,
      render: (_: any, record: Matiere) => (
        <Tag color="green" style={{ margin: 0 }}>
          {calculateCoutTD(record.volume_horaire_td, record.taux_horaire_td)?.toLocaleString('fr-FR')} F
        </Tag>
      ),
      onCell: () => ({
        style: { 
          borderRight: '1px solid #d9d9d9',
          borderBottom: '1px solid #d9d9d9'
        }
      }),
      width: '10%',
    },
    { 
      title: 'COEFFICIENT', 
      dataIndex: 'coefficient', 
      key: 'coefficient',
      align: 'center' as const,
      render: (value: any) => <Tag color="orange" style={{ margin: 0 }}>{typeof value === 'string' ? parseFloat(value) : value}</Tag>,
      onCell: () => ({
        style: { 
          borderRight: '1px solid #d9d9d9',
          borderBottom: '1px solid #d9d9d9'
        }
      }),
      width: '8%',
    }
  ];

  if (loading) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen">
        <PageHeader />
        <div className="flex justify-center items-center h-64">
          <Spin size="large" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* En-tête de la page */}
      <PageHeader />
      
      {/* Bouton retour */}
      <div className="mb-4">
        <Button 
          icon={<ArrowLeftOutlined />} 
          onClick={() => navigate(-1)}
          className="mb-4"
        >
          Retour
        </Button>
      </div>

      {/* Informations de la maquette */}
      <Card className="mb-6 shadow-lg border-0" style={{ background: 'linear-gradient(to right, #f5f7fa, #c3cfe2)' }}>
        <Title level={2} className="text-center mb-6 text-blue-800">
          Détails de la Maquette
        </Title>
        
        <Row gutter={[16, 16]} className="mb-4">
          <Col xs={24} sm={12}>
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <Text strong className="text-blue-700">Filière:</Text>
              <br />
              <Text className="text-lg">{maquette?.filiere_nom} ({maquette?.filiere_sigle})</Text>
            </div>
          </Col>
          <Col xs={24} sm={12}>
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <Text strong className="text-green-700">Niveau:</Text>
              <br />
              <Text className="text-lg">{maquette?.niveau_libelle}</Text>
            </div>
          </Col>
          <Col xs={24} sm={12}>
            <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
              <Text strong className="text-purple-700">Année Académique:</Text>
              <br />
              <Text className="text-lg">{maquette?.annee_academique}</Text>
            </div>
          </Col>
          <Col xs={24} sm={12}>
            <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
              <Text strong className="text-orange-700">Parcour:</Text>
              <br />
              <Text className="text-lg">{maquette?.parcour}</Text>
            </div>
          </Col>
        </Row>
      </Card>

      {/* Boutons d'action */}
      <div className="mb-6 flex flex-wrap gap-4">
        <Button 
          type="primary" 
          icon={<PlusOutlined />}
          onClick={() => setUeModalVisible(true)}
          size="large"
          className="bg-blue-600 hover:bg-blue-700 border-0 shadow-md"
          style={{ borderRadius: '6px' }}
        >
          Nouvelle Unité d'Enseignement
        </Button>
        
        <Button 
          type="primary" 
          icon={<PlusOutlined />}
          onClick={async () => {
            const ues = await fetchUesForMaquette();
            if (ues.length === 0) {
              message.warning('Veuillez d\'abord créer une UE');
              return;
            }
            setMatiereModalVisible(true);
          }}
          size="large"
          className="bg-green-600 hover:bg-green-700 border-0 shadow-md"
          style={{ borderRadius: '6px' }}
        >
          Nouvelle Matière
        </Button>
      </div>

      {/* Affichage des semestres */}
      {semestres && semestres.length > 0 ? (
        semestres.map((semestre) => (
          <Card 
            key={semestre.id} 
            title={
              <div className="flex items-center justify-between">
                <span className="text-xl font-bold text-gray-800">SEMESTRE {semestre.libelle}</span>
                <Tag color="blue" className="text-sm">
                  {semestre.ues?.length || 0} UE(s)
                </Tag>
              </div>
            } 
            className="mb-6 shadow-lg border-0"
          >
            {semestre.ues && semestre.ues.length > 0 ? (
              <Table 
                columns={tableColumns} 
                dataSource={getGroupedDataByUE(semestre)}
                pagination={false}
                size="middle"
                className="shadow-sm"
                bordered
                // Ajout de styles pour un tableau plus lisible
                style={{ 
                  border: '2px solid #1890ff',
                  borderRadius: '8px',
                  overflow: 'hidden'
                }}
                components={{
                  header: {
                    cell: (props: any) => (
                      <th 
                        {...props} 
                        style={{ 
                          backgroundColor: '#1890ff', 
                          color: 'white', 
                          fontWeight: 'bold', 
                          textAlign: 'center',
                          border: '1px solid #1890ff',
                          padding: '12px 8px'
                        }} 
                      />
                    ),
                  },
                  body: {
                    cell: (props: any) => (
                      <td 
                        {...props} 
                        style={{ 
                          border: '1px solid #d9d9d9', 
                          padding: '10px 8px', 
                          backgroundColor: props.children && props.children.props && props.children.props.rowSpan ? '#e6f7ff' : 'white'
                        }} 
                      />
                    ),
                  },
                }}
                summary={() => {
                  const allMatieres = semestre.ues.flatMap(ue => ue.matieres || []);
                  const totalCM = allMatieres.reduce((total: number, m: any) => total + (m.volume_horaire_cm || 0), 0);
                  const totalTD = allMatieres.reduce((total: number, m: any) => total + (m.volume_horaire_td || 0), 0);
                  const totalCoutCM = allMatieres.reduce((total: number, m: any) => total + calculateCoutCM(m.volume_horaire_cm, m.taux_horaire_cm), 0);
                  const totalCoutTD = allMatieres.reduce((total: number, m: any) => total + calculateCoutTD(m.volume_horaire_td, m.taux_horaire_td), 0);
                  const totalCoeff = allMatieres.reduce((total: number, m: any) => {
                    const coeff = typeof m.coefficient === 'string' 
                      ? parseFloat(m.coefficient) 
                      : m.coefficient;
                    return total + (coeff || 0);
                  }, 0);

                  return (
                    <Table.Summary>
                      <Table.Summary.Row className="bg-blue-50 font-semibold">
                        <Table.Summary.Cell index={0} colSpan={2}>
                          <Text strong>TOTAL SEMESTRE {semestre.libelle}</Text>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={1} align="center">
                          <Text strong>{totalCM}h</Text>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={2} align="center">
                          -
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={3} align="center">
                          <Tag color="blue" className="font-semibold">
                            {totalCoutCM.toLocaleString('fr-FR')} F
                          </Tag>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={4} align="center">
                          <Text strong>{totalTD}h</Text>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={5} align="center">
                          -
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={6} align="center">
                          <Tag color="green" className="font-semibold">
                            {totalCoutTD.toLocaleString('fr-FR')} F
                          </Tag>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={7} align="center">
                          <Tag color="orange" className="font-semibold">
                            {totalCoeff}
                          </Tag>
                        </Table.Summary.Cell>
                      </Table.Summary.Row>
                    </Table.Summary>
                  );
                }}
              />
            ) : (
              <div className="text-center py-8 bg-white rounded-lg">
                <Text type="secondary" italic className="text-gray-500">
                  Aucune UE pour ce semestre
                </Text>
              </div>
            )}
          </Card>
        ))
      ) : (
        <Card className="mb-6 shadow-lg border-0">
          <div className="text-center py-8">
            <Text type="secondary" italic className="text-gray-500">
              Aucun semestre disponible pour cette maquette
            </Text>
          </div>
        </Card>
      )}

      {/* Modal pour créer une UE */}
      <Modal
        title="Nouvelle Unité d'Enseignement"
        open={ueModalVisible}
        onCancel={() => {
          setUeModalVisible(false);
          ueForm.resetFields();
        }}
        footer={null}
        width={500}
        className="rounded-lg"
        style={{ borderRadius: '8px' }}
      >
        <Form form={ueForm} layout="vertical" onFinish={handleCreateUE}>
          <Form.Item label="Libellé" name="libelle" rules={[{ required: true, message: 'Le libellé est requis' }]}>
            <Input placeholder="Nom de l'UE" size="large" />
          </Form.Item>

          <Form.Item label="Semestre" name="semestre_id" rules={[{ required: true, message: 'Le semestre est requis' }]}>
            <Select placeholder="Sélectionner un semestre" size="large">
              {allSemestres.map((semestre: any) => (
                <Select.Option key={semestre.id} value={semestre.id}>
                  {semestre.nom || semestre.libelle}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item label="Catégorie" name="categorie_id" rules={[{ required: true, message: 'La catégorie est requise' }]}>
            <Select placeholder="Sélectionner une catégorie" size="large">
              {categories.map(categorie => (
                <Select.Option key={categorie.id} value={categorie.id}>
                  {categorie.nom}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item className="text-right mb-0">
            <Space>
              <Button onClick={() => setUeModalVisible(false)} size="large">
                Annuler
              </Button>
              <Button type="primary" htmlType="submit" size="large" className="bg-blue-600 border-0">
                Créer l'UE
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal pour créer une matière */}
      <Modal
        title="Nouvelle Matière"
        open={matiereModalVisible}
        onCancel={() => {
          setMatiereModalVisible(false);
          matiereForm.resetFields();
        }}
        footer={null}
        width={700}
        className="rounded-lg"
        style={{ borderRadius: '8px' }}
      >
        <Form 
          form={matiereForm} 
          layout="vertical" 
          onFinish={handleCreateMatiere}
          initialValues={{
            volume_horaire_cm: 0,
            taux_horaire_cm: 0,
            volume_horaire_td: 0,
            taux_horaire_td: 0,
            coefficient: 1
          }}
        >
          <Form.Item 
            label="Unité d'Enseignement" 
            name="ue_id" 
            rules={[{ required: true, message: 'L\'UE est requise' }]}
          >
            <Select 
              placeholder="Sélectionner une UE" 
              size="large"
              optionFilterProp="children"
              showSearch
              onClick={async () => {
                const ues = await fetchUesForMaquette();
                setAvailableUes(ues);
              }}
            >
              {availableUes.map(ue => (
                <Select.Option key={ue.id} value={ue.id}>
                  {ue.libelle}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item label="Nom" name="nom" rules={[{ required: true, message: 'Le nom est requis' }]}>
            <Input placeholder="Nom de la matière" size="large" />
          </Form.Item>

          <Form.Item label="Coefficient" name="coefficient" rules={[{ required: true, message: 'Le coefficient est requis' }]}>
            <InputNumber min={0} step={0.5} style={{ width: '100%' }} size="large" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item 
                label="Volume Horaire CM" 
                name="volume_horaire_cm" 
                rules={[{ required: false }, { type: 'number', min: 0 }]}
                initialValue={0}
              >
                <InputNumber min={0} style={{ width: '100%' }} size="large" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item 
                label="Taux Horaire CM" 
                name="taux_horaire_cm" 
                rules={[{ required: false }, { type: 'number', min: 0 }]}
                initialValue={0}
              >
                <InputNumber min={0} style={{ width: '100%' }} size="large" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item 
                label="Volume Horaire TD" 
                name="volume_horaire_td" 
                rules={[{ required: false }, { type: 'number', min: 0 }]}
                initialValue={0}
              >
                <InputNumber min={0} style={{ width: '100%' }} size="large" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item 
                label="Taux Horaire TD" 
                name="taux_horaire_td" 
                rules={[{ required: false }, { type: 'number', min: 0 }]}
                initialValue={0}
              >
                <InputNumber min={0} style={{ width: '100%' }} size="large" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item className="text-right mb-0">
            <Space>
              <Button onClick={() => setMatiereModalVisible(false)} size="large">
                Annuler
              </Button>
              <Button type="primary" htmlType="submit" size="large" className="bg-green-600 border-0">
                Créer la Matière
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default DetailMaquette;