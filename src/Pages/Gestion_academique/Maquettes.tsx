/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../Components/PageHeader/PageHeader';
import { 
  Table, 
  Button, 
  Select, 
  Card, 
  Space, 
  Modal, 
  Form, 
  message, 
  Spin, 
  Tag,
  Row,
  Col,
  Input,
  Tooltip,
  Badge,
  Alert
} from 'antd';
import { 
  PlusOutlined, 
  EyeOutlined, 
  SearchOutlined, 
  FilterOutlined,
  ReloadOutlined 
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';


const API_URL = import.meta.env.VITE_API_URL_SERVER || "";

interface Maquette {
  id: number;
  filiere_nom: string;
  filiere_sigle: string;
  niveau_libelle: string;
  annee_academique: string;
  parcour: string;
  date_creation: string;
  annee_id: number;
}

interface Filiere {
  id: number;
  nom: string;
  sigle: string;
  type_filiere_id: number;
}

interface Niveau {
  id: number;
  libelle: string;
  prix_formation: string;
  typefiliere_description: string;
  typefiliere_libelle: string;
}

interface Parcours {
  id: number;
  type_parcours: string;
}

interface AnneeAcademique {
  id: number;
  annee: string;
  etat: string;
}

interface UserInfo {
  id: number;
  nom: string;
  email: string;
  role: string;
  code: string;
  userType: string;
  departementName: string;
  departement_id: number;
}

const getUserInfo = (): UserInfo | null => {
  try {
    const userStr = localStorage.getItem('user');
    if (!userStr) return null;
    const user = JSON.parse(userStr);
    if (!user.departement_id) {
      const deptId = localStorage.getItem('departement_id');
      if (deptId) user.departement_id = parseInt(deptId, 10);
    }
    return user;
  } catch (e) {
    console.error('Erreur parsing user:', e);
    return null;
  }
};

const Maquettes: React.FC = () => {
  const navigate = useNavigate();
  const [maquettes, setMaquettes] = useState<Maquette[]>([]);
  const [filieres, setFilieres] = useState<Filiere[]>([]);
  const [niveaux, setNiveaux] = useState<Niveau[]>([]);
  const [parcours, setParcours] = useState<Parcours[]>([]);
  const [annees, setAnnees] = useState<AnneeAcademique[]>([]);
  const [selectedAnnee, setSelectedAnnee] = useState<number | null>(null);
  const [selectedAnneeInfo, setSelectedAnneeInfo] = useState<{annee: string; etat: string} | null>(null);
  const [currentUser, setCurrentUser] = useState<UserInfo | null>(null);
  const [searchText, setSearchText] = useState<string>('');
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingYears, setLoadingYears] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [initialYearSet, setInitialYearSet] = useState(false);
  const [form] = Form.useForm();

  // Chargement utilisateur
  useEffect(() => {
    const user = getUserInfo();
    if (!user) {
      message.error('Impossible de récupérer vos informations. Veuillez vous reconnecter.');
      setLoading(false);
      return;
    }
    if (!user.departement_id) {
      message.error("Aucun département associé à votre compte.");
      setLoading(false);
      return;
    }
    setCurrentUser(user);
  }, []);

  // Récupérer les années académiques par département
  useEffect(() => {
    const fetchAnnees = async () => {
      if (!currentUser?.departement_id) return;
      
      setLoadingYears(true);
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          message.error('Authentification requise');
          setLoading(false);
          return;
        }

        const response = await fetch(`${API_URL}/api/annees?site_id=${currentUser.departement_id}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.status === 401) {
          message.error('Session expirée, veuillez vous reconnecter');
          localStorage.removeItem('token');
          navigate('/login');
          return;
        }

        if (!response.ok) {
          throw new Error(`Erreur ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        if (Array.isArray(data)) {
          setAnnees(data);
          // Sélectionner l'année "en cours" par défaut
          const currentYear = data.find((year: AnneeAcademique) => 
            year.etat?.toLowerCase() === 'en cours' || 
            year.etat?.toLowerCase() === 'en cour'
          );
          if (currentYear) {
            setSelectedAnnee(currentYear.id);
            setSelectedAnneeInfo({ annee: currentYear.annee, etat: currentYear.etat });
          } else if (data.length > 0) {
            setSelectedAnnee(data[0].id);
            setSelectedAnneeInfo({ annee: data[0].annee, etat: data[0].etat });
          }
          setInitialYearSet(true);
        } else {
          throw new Error('Format de réponse inattendu');
        }
      } catch (err) {
        console.error('Erreur récupération années académiques:', err);
        message.error('Impossible de charger les années académiques');
      } finally {
        setLoadingYears(false);
      }
    };

    fetchAnnees();
  }, [API_URL, currentUser, navigate]);

  // Récupérer les filières et parcours
  useEffect(() => {
    const fetchInitialData = async () => {
      if (!currentUser?.departement_id) return;
      
      try {
        const token = localStorage.getItem('token');
        const headers = {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        };

        const [filieresData, parcoursData] = await Promise.all([
          fetch(`${API_URL}/api/filieres`, { headers }),
          fetch(`${API_URL}/api/curcus`, { headers })
        ]);

        if (filieresData.ok) {
          const filieresResult = await filieresData.json();
          setFilieres(Array.isArray(filieresResult) ? filieresResult : []);
        }

        if (parcoursData.ok) {
          const parcoursResult = await parcoursData.json();
          setParcours(Array.isArray(parcoursResult) ? parcoursResult : []);
        }
      } catch (error) {
        console.error('Erreur lors du chargement des données initiales:', error);
        message.error('Erreur lors du chargement des données');
      }
    };

    fetchInitialData();
  }, [API_URL, currentUser]);

  // Charger les maquettes quand l'année change
  useEffect(() => {
    if (initialYearSet && selectedAnnee && currentUser?.departement_id) {
      fetchMaquettes(selectedAnnee);
    }
  }, [selectedAnnee, initialYearSet, currentUser]);

  const fetchMaquettes = async (anneeId: number) => {
    if (!currentUser?.departement_id) return;
    
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      if (!token) {
        message.error('Authentification requise');
        return;
      }

      const url = `${API_URL}/api/maquettes?annee_id=${anneeId}&departement_id=${currentUser.departement_id}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 401) {
        message.error('Session expirée, veuillez vous reconnecter');
        localStorage.removeItem('token');
        navigate('/login');
        return;
      }

      const data = await response.json();
      
      if (Array.isArray(data)) {
        setMaquettes(data);
      } else if (data.data && Array.isArray(data.data)) {
        setMaquettes(data.data);
      } else {
        setMaquettes([]);
      }
    } catch (error) {
      console.error('Erreur de connexion au serveur:', error);
      message.error('Erreur de connexion au serveur');
      setMaquettes([]);
    } finally {
      setLoading(false);
    }
  };

  // anneeId est requis : un niveau appartient à une année académique précise (la
  // filière, elle, est un catalogue partagé entre années) — sans ce filtre, le Select
  // proposait les niveaux de TOUTES les années de la filière, permettant de créer une
  // maquette dont l'anneeacademique_id ne correspond pas à celle du niveau choisi.
  const fetchNiveauxByFiliere = async (filiereId: number, anneeId?: number | null) => {
    if (!currentUser?.departement_id) return;
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({ site_id: String(currentUser.departement_id) });
      if (anneeId) params.append('anneeacademique_id', String(anneeId));
      const response = await fetch(`${API_URL}/api/niveaux/${filiereId}?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      if (Array.isArray(data)) {
        setNiveaux(data);
      } else {
        setNiveaux([]);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des niveaux:', error);
      message.error('Erreur lors du chargement des niveaux');
    }
  };

  const handleFiliereChange = (filiereId: number) => {
    form.setFieldsValue({ niveau_id: undefined });
    if (filiereId) {
      fetchNiveauxByFiliere(filiereId, form.getFieldValue('anneeacademique_id'));
    } else {
      setNiveaux([]);
    }
  };

  const handleAnneeCreationChange = (anneeId: number) => {
    form.setFieldsValue({ niveau_id: undefined });
    const filiereId = form.getFieldValue('filiere_id');
    if (filiereId) {
      fetchNiveauxByFiliere(filiereId, anneeId);
    }
  };

  const handleSubmit = async (values: any) => {
    if (!currentUser?.departement_id) {
      message.error('Département non trouvé');
      return;
    }

    try {
      setSubmitting(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/maquettes/create-maquettes`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({
          ...values,
          departement_id: currentUser.departement_id
        }),
      });
      
      const data = await response.json();
      if (data.success) {
        message.success('Maquette créée avec succès');
        setModalVisible(false);
        form.resetFields();
        setNiveaux([]);
        fetchMaquettes(selectedAnnee!);
      } else {
        message.error(data.message || 'Erreur lors de la création');
      }
    } catch (error) {
      console.error('Erreur détaillée:', error);
      message.error('Erreur lors de la création de la maquette');
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewDetails = (maquetteId: number) => {
    navigate(`/Gestion_academique/DetailMaquette/${maquetteId}`);
  };

  const handleRefresh = () => {
    if (selectedAnnee) {
      fetchMaquettes(selectedAnnee);
    }
  };

  const filteredMaquettes = maquettes.filter(maquette =>
    maquette.filiere_nom?.toLowerCase().includes(searchText.toLowerCase()) ||
    maquette.filiere_sigle?.toLowerCase().includes(searchText.toLowerCase()) ||
    maquette.niveau_libelle?.toLowerCase().includes(searchText.toLowerCase()) ||
    maquette.parcour?.toLowerCase().includes(searchText.toLowerCase())
  );

  const columns: ColumnsType<Maquette> = [
    { 
      title: 'Filière', 
      dataIndex: 'filiere_nom', 
      key: 'filiere_nom',
      render: (text, record) => (
        <div>
          <div className="filiere-name">{text}</div>
          <Tag color="blue">{record.filiere_sigle}</Tag>
        </div>
      )
    },
    { 
      title: 'Niveau', 
      dataIndex: 'niveau_libelle', 
      key: 'niveau_libelle',
      render: (text) => <Tag color="green">{text}</Tag>
    },
    { 
      title: 'Année Académique', 
      dataIndex: 'annee_academique', 
      key: 'annee_academique',
      render: (text) => <Badge status="processing" text={text} />
    },
    { 
      title: 'Parcour', 
      dataIndex: 'parcour', 
      key: 'parcour',
      render: (text) => <Tag color="orange">{text}</Tag>
    },
    { 
      title: 'Date Création', 
      dataIndex: 'date_creation', 
      key: 'date_creation',
      render: (date) => (
        <span className="date-text">
          {new Date(date).toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
          })}
        </span>
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Tooltip title="Voir les détails">
          <Button 
            icon={<EyeOutlined />} 
            type="primary"
            size="small"
            onClick={() => handleViewDetails(record.id)}
            className="action-btn"
          />
        </Tooltip>
      ),
    },
  ];

  // Guards
  if (!currentUser) {
    return (
      <div className="p-6 maquettes-container">
        <PageHeader />
        <Alert
          message="Accès non autorisé"
          description="Impossible de récupérer vos informations utilisateur. Veuillez vous reconnecter."
          type="error" 
          showIcon
        />
      </div>
    );
  }

  if (!currentUser.departement_id) {
    return (
      <div className="p-6 maquettes-container">
        <PageHeader />
        <Alert
          message="Département non assigné"
          description="Votre compte n'est associé à aucun département. Veuillez contacter l'administrateur."
          type="warning" 
          showIcon
        />
      </div>
    );
  }

  if (loading && maquettes.length === 0) {
    return (
      <div className="p-6 maquettes-container">
        <PageHeader />
        <div className="flex justify-center items-center h-64">
          <Spin size="large" tip="Chargement des maquettes..." />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 maquettes-container">
      <PageHeader />
      
      <Alert
        message={`Maquettes pédagogiques — ${currentUser.departementName || 'Département ' + currentUser.departement_id}`}
        description={`Vous visualisez uniquement les maquettes du département ${currentUser.departementName || ''}.`}
        type="info" 
        showIcon 
        style={{ marginBottom: 16 }} 
        closable
      />
      
      <Card className="maquettes-card">
        <Row gutter={[16, 16]} className="mb-4">
          <Col xs={24} md={8}>
            <div style={{ marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: '#666' }}>Année académique</span>
            </div>
            <Select
              placeholder="Sélectionner une année académique"
              style={{ width: '100%' }}
              value={selectedAnnee}
              onChange={(value: number) => {
                const selectedYear = annees.find(y => y.id === value);
                if (selectedYear) {
                  setSelectedAnneeInfo({ annee: selectedYear.annee, etat: selectedYear.etat });
                }
                setSelectedAnnee(value);
              }}
              loading={loadingYears}
              suffixIcon={<FilterOutlined />}
            >
              {annees.map(annee => (
                <Select.Option key={annee.id} value={annee.id}>
                  {annee.annee} ({annee.etat})
                </Select.Option>
              ))}
            </Select>
            {selectedAnneeInfo && (
              <div style={{ marginTop: 8 }}>
                <Tag color={selectedAnneeInfo.etat === 'en cours' || selectedAnneeInfo.etat === 'en cour' ? 'green' : 'blue'}>
                  Année sélectionnée: {selectedAnneeInfo.annee}
                </Tag>
              </div>
            )}
          </Col>
          
          <Col xs={24} md={10}>
            <div style={{ marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: '#666' }}>Recherche</span>
            </div>
            <Input
              placeholder="Rechercher par filière, niveau, parcour..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
          </Col>
          
          <Col xs={24} md={6}>
            <div style={{ marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: '#666' }}>Actions</span>
            </div>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Tooltip title="Actualiser">
                <Button 
                  icon={<ReloadOutlined />} 
                  onClick={handleRefresh}
                  loading={loading}
                />
              </Tooltip>
              
              <Button 
                type="primary" 
                icon={<PlusOutlined />}
                onClick={() => setModalVisible(true)}
                className="new-maquette-btn"
              >
                Nouvelle Maquette
              </Button>
            </Space>
          </Col>
        </Row>

        {!selectedAnnee ? (
          <Alert
            message="Aucune année sélectionnée"
            description="Veuillez sélectionner une année académique pour afficher les maquettes."
            type="warning"
            showIcon
          />
        ) : (
          <Table 
            columns={columns} 
            dataSource={filteredMaquettes} 
            rowKey="id"
            pagination={{ 
              pageSize: 10, 
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) => 
                `${range[0]}-${range[1]} sur ${total} maquettes`
            }}
            loading={loading}
            scroll={{ x: 800 }}
            className="maquettes-table"
            locale={{
              emptyText: loading ? 'Chargement...' : `Aucune maquette trouvée pour l'année ${selectedAnneeInfo?.annee || 'sélectionnée'}`
            }}
          />
        )}
      </Card>

      <Modal
        title="Créer une Nouvelle Maquette Pédagogique"
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
          setNiveaux([]);
        }}
        footer={null}
        width={800}
        className="maquette-modal"
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          className="mt-4"
        >
          <Row gutter={16}>
            <Col xs={24} md={15}>
              <Form.Item
                label="Filière"
                name="filiere_id"
                rules={[{ required: true, message: 'Veuillez sélectionner une filière' }]}
              >
                <Select
                  placeholder="Sélectionner une filière"
                  onChange={handleFiliereChange}
                  optionFilterProp="children"
                  showSearch
                  allowClear
                >
                  {filieres.map(filiere => (
                    <Select.Option key={filiere.id} value={filiere.id}>
                      {filiere.nom} ({filiere.sigle})
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            <Col xs={24} md={9}>
              <Form.Item
                label="Niveau"
                name="niveau_id"
                rules={[{ required: true, message: 'Veuillez sélectionner un niveau' }]}
              >
                <Select
                  placeholder="Sélectionner un niveau"
                  disabled={niveaux.length === 0}
                  showSearch
                  optionFilterProp="children"
                  allowClear
                >
                  {niveaux.map((niveau) => (
                    <Select.Option key={niveau.id} value={niveau.id}>
                      {niveau.libelle}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                label="Année Académique"
                name="anneeacademique_id"
                rules={[{ required: true, message: 'Veuillez sélectionner une année académique' }]}
              >
                <Select
                  placeholder="Sélectionner une année académique"
                  showSearch
                  optionFilterProp="children"
                  allowClear
                  onChange={handleAnneeCreationChange}
                >
                  {annees.map(annee => (
                    <Select.Option key={annee.id} value={annee.id}>
                      {annee.annee} ({annee.etat})
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                label="Parcour"
                name="parcour"
                rules={[{ required: true, message: 'Veuillez sélectionner un parcour' }]}
              >
                <Select 
                  placeholder="Sélectionner un parcour"
                  showSearch
                  optionFilterProp="children"
                  allowClear
                >
                  {parcours.map(parcour => (
                    <Select.Option key={parcour.id} value={parcour.type_parcours}>
                      {parcour.type_parcours}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item className="text-right modal-actions">
            <Space>
              <Button 
                onClick={() => {
                  setModalVisible(false);
                  form.resetFields();
                  setNiveaux([]);
                }}
                disabled={submitting}
              >
                Annuler
              </Button>
              <Button 
                type="primary" 
                htmlType="submit"
                loading={submitting}
                className="submit-btn"
              >
                Créer la Maquette
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Maquettes;