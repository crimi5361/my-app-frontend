/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react';
import {
  Table, Button, Modal, Form, Input, Tag, Card,
  Space, Typography, Popconfirm, message, Badge, Statistic,
  Input as AntInput, Divider, Avatar, Alert, Spin, Tooltip,
  Dropdown, Menu, Row, Col, Descriptions, Drawer,
  Collapse, Statistic as AntStatistic
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined, EditOutlined, UserOutlined,
  TeamOutlined, CheckCircleOutlined,
  SearchOutlined, ReloadOutlined, ExclamationCircleOutlined,
  EyeOutlined, EyeInvisibleOutlined, MoreOutlined,
  CheckOutlined, CloseOutlined, PoweroffOutlined,
  DollarOutlined, BookOutlined,
  InfoCircleOutlined, ScheduleOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;
const { Search } = AntInput;
const { Panel } = Collapse;
const API_URL = import.meta.env.VITE_API_URL_SERVER || "";

interface Professeur {
  id: number;
  nom: string;
  prenom: string;
  date_creation: string;
  statut: string;
  statut_assignation?: string;
  nombre_enseignements: number;
  matieres_enseignees?: string;
}

interface MatiereDetail {
  enseignement_id: number;
  matiere_id: number;
  matiere_nom: string;
  coefficient: number;
  type_evaluation: string;
  volume_horaire_cm: number;
  taux_horaire_cm: number;
  volume_horaire_td: number;
  taux_horaire_td: number;
  groupe_id: number;
  groupe_nom: string;
  classe_id: number;
  classe_nom: string;
  annee_academique: string;
  cout_total: number;
}

interface MatieresDetailResponse {
  matieres: MatiereDetail[];
  total_cout: number;
  nombre_matieres: number;
}

const Professeur = () => {
  const [professeurs, setProfesseurs] = useState<Professeur[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [selectedProfesseur, setSelectedProfesseur] = useState<Professeur | null>(null);
  const [matieresDetail, setMatieresDetail] = useState<MatiereDetail[]>([]);
  const [totalCout, setTotalCout] = useState<number>(0);
  const [detailLoading, setDetailLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [showInactifs, setShowInactifs] = useState(false);
  const [form] = Form.useForm();
  const navigate = useNavigate();

  const getToken = () => {
    return localStorage.getItem('token');
  };

  const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
    const token = getToken();
    
    const defaultOptions: RequestInit = {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    };

    try {
      const response = await fetch(url, defaultOptions);
      
      if (response.status === 401) {
        message.error('Session expirée, veuillez vous reconnecter');
        localStorage.removeItem('token');
        navigate('/login');
        throw new Error('Unauthorized');
      }
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erreur serveur');
      }
      
      return await response.json();
    } catch (error) {
      if ((error as Error).message !== 'Unauthorized') {
        message.error((error as Error).message || 'Erreur de connexion');
      }
      throw error;
    }
  };

  const loadProfesseurs = async () => {
    setLoading(true);
    try {
      const url = `${API_URL}/api/professeur${showInactifs ? '?showInactifs=true' : ''}`;
      const data = await fetchWithAuth(url);
      setProfesseurs(data);
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMatieresDetail = async (professeurId: number) => {
    setDetailLoading(true);
    try {
      const url = `${API_URL}/api/professeur/${professeurId}/matieres-detail`;
      const data: MatieresDetailResponse = await fetchWithAuth(url);
      setMatieresDetail(data.matieres || []);
      setTotalCout(data.total_cout || 0);
    } catch (error) {
      console.error('Erreur:', error);
      setMatieresDetail([]);
      setTotalCout(0);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    loadProfesseurs();
  }, [showInactifs]);

  const handleSubmit = async (values: { nom: string; prenom: string }) => {
    try {
      if (selectedProfesseur && selectedProfesseur.id) {
        await fetchWithAuth(`${API_URL}/api/professeur/${selectedProfesseur.id}`, {
          method: 'POST',
          body: JSON.stringify(values)
        });
        message.success('Professeur modifié avec succès');
      } else {
        await fetchWithAuth(`${API_URL}/api/professeur`, {
          method: 'POST',
          body: JSON.stringify(values)
        });
        message.success('Professeur ajouté avec succès');
      }
      
      setModalVisible(false);
      setSelectedProfesseur(null);
      form.resetFields();
      loadProfesseurs();
    } catch (error) {
      console.error('Erreur:', error);
    }
  };

  const handleSoftDelete = async (id: number) => {
    try {
      await fetchWithAuth(`${API_URL}/api/professeur/${id}`, {
        method: 'DELETE'
      });
      message.success('Professeur désactivé avec succès');
      loadProfesseurs();
    } catch (error) {
      console.error('Erreur:', error);
    }
  };

  const handleActivate = async (id: number) => {
    try {
      await fetchWithAuth(`${API_URL}/api/professeur/${id}/activate`, {
        method: 'POST'
      });
      message.success('Professeur réactivé avec succès');
      loadProfesseurs();
    } catch (error) {
      console.error('Erreur:', error);
    }
  };

  const handleShowDetails = async (professeur: Professeur) => {
    setSelectedProfesseur(professeur);
    await loadMatieresDetail(professeur.id);
    setDetailDrawerVisible(true);
  };

  const filteredProfesseurs = professeurs.filter(prof =>
    prof.nom.toLowerCase().includes(searchText.toLowerCase()) ||
    prof.prenom.toLowerCase().includes(searchText.toLowerCase()) ||
    (prof.matieres_enseignees && prof.matieres_enseignees.toLowerCase().includes(searchText.toLowerCase()))
  );

  // Formater les nombres avec séparateurs de milliers
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('fr-FR').format(num);
  };

  const stats = {
    total: professeurs.length,
    actifs: professeurs.filter(p => p.statut === 'Actif').length,
    inactifs: professeurs.filter(p => p.statut === 'Inactif').length,
    assignes: professeurs.filter(p => p.nombre_enseignements > 0).length,
    nonAssignes: professeurs.filter(p => p.nombre_enseignements === 0).length,
    totalHeures: matieresDetail.reduce((sum, item) => 
      sum + (item.volume_horaire_cm || 0) + (item.volume_horaire_td || 0), 0
    )
  };

  const columns: ColumnsType<Professeur> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 70,
      align: 'center',
      responsive: ['md'] as any,
      sorter: (a, b) => a.id - b.id
    },
    {
      title: 'Professeur',
      key: 'professeur',
      render: (_, record) => (
        <Space align="center">
          <Avatar 
            size="large"
            icon={<UserOutlined />}
            style={{ 
              backgroundColor: record.statut === 'Actif' 
                ? (record.nombre_enseignements > 0 ? '#52c41a' : '#faad14')
                : '#d9d9d9',
              color: record.statut === 'Actif' ? 'white' : '#8c8c8c'
            }}
          />
          <div>
            <Text 
              strong 
              className="text-base font-semibold cursor-pointer hover:text-blue-600"
              onClick={() => handleShowDetails(record)}
              style={{ color: record.statut === 'Actif' ? '#262626' : '#8c8c8c' }}
            >
              {record.prenom} {record.nom}
            </Text>
            <br />
            <Text type="secondary" className="text-xs">
              {record.nombre_enseignements} enseignement(s)
            </Text>
            {record.matieres_enseignees && (
              <Text type="secondary" className="text-xs block">
                Matières: {record.matieres_enseignees}
              </Text>
            )}
          </div>
        </Space>
      ),
      sorter: (a, b) => a.nom.localeCompare(b.nom)
    },
    {
      title: 'Enseignements',
      key: 'enseignements',
      width: 120,
      align: 'center',
      render: (_, record) => (
        <Badge
          count={record.nombre_enseignements}
          style={{ 
            backgroundColor: record.nombre_enseignements > 0 ? '#52c41a' : '#faad14'
          }}
        />
      ),
      sorter: (a, b) => a.nombre_enseignements - b.nombre_enseignements
    },
    {
      title: 'Statut',
      key: 'statut',
      width: 110,
      render: (_, record) => (
        <Tag 
          color={record.statut === 'Actif' ? 'success' : 'error'}
          icon={record.statut === 'Actif' ? <CheckOutlined /> : <CloseOutlined />}
          className="px-2 py-0.5 rounded text-xs"
        >
          {record.statut}
        </Tag>
      ),
      filters: [
        { text: 'Actifs', value: 'Actif' },
        { text: 'Inactifs', value: 'Inactif' }
      ],
      onFilter: (value, record) => record.statut === value
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 200,
      align: 'center',
      render: (_, record) => {
        const menu = (
          <Menu>
            <Menu.Item 
              key="details"
              icon={<InfoCircleOutlined />}
              onClick={() => handleShowDetails(record)}
            >
              Détails
            </Menu.Item>
            {record.statut === 'Actif' && (
              <>
                <Menu.Item 
                  key="edit"
                  icon={<EditOutlined />}
                  onClick={() => {
                    setSelectedProfesseur(record);
                    form.setFieldsValue({
                      nom: record.nom,
                      prenom: record.prenom
                    });
                    setModalVisible(true);
                  }}
                >
                  Modifier
                </Menu.Item>
                <Menu.Item 
                  key="deactivate"
                  icon={<PoweroffOutlined />}
                  danger
                  onClick={() => handleSoftDelete(record.id)}
                >
                  Désactiver
                </Menu.Item>
              </>
            )}
            {record.statut === 'Inactif' && (
              <Menu.Item 
                key="activate"
                icon={<CheckOutlined />}
                onClick={() => handleActivate(record.id)}
              >
                Réactiver
              </Menu.Item>
            )}
          </Menu>
        );

        return (
          <Space size="small">
            <Tooltip title="Voir les détails">
              <Button
                type="default"
                icon={<InfoCircleOutlined />}
                size="small"
                onClick={() => handleShowDetails(record)}
              />
            </Tooltip>
            
            {record.statut === 'Actif' && (
              <>
                <Tooltip title="Modifier">
                  <Button
                    type="primary"
                    icon={<EditOutlined />}
                    size="small"
                    onClick={() => {
                      setSelectedProfesseur(record);
                      form.setFieldsValue({
                        nom: record.nom,
                        prenom: record.prenom
                      });
                      setModalVisible(true);
                    }}
                  />
                </Tooltip>
                
                <Popconfirm
                  title="Désactiver ce professeur ?"
                  description="Le professeur sera marqué comme inactif mais ne sera pas supprimé."
                  onConfirm={() => handleSoftDelete(record.id)}
                  okText="Désactiver"
                  cancelText="Annuler"
                  okButtonProps={{ danger: true }}
                  icon={<ExclamationCircleOutlined className="text-yellow-500" />}
                >
                  <Tooltip title="Désactiver">
                    <Button
                      danger
                      icon={<PoweroffOutlined />}
                      size="small"
                    />
                  </Tooltip>
                </Popconfirm>
              </>
            )}
            
            {record.statut === 'Inactif' && (
              <Popconfirm
                title="Réactiver ce professeur ?"
                description="Le professeur sera à nouveau disponible pour les affectations."
                onConfirm={() => handleActivate(record.id)}
                okText="Réactiver"
                cancelText="Annuler"
                icon={<CheckOutlined className="text-green-500" />}
              >
                <Tooltip title="Réactiver">
                  <Button
                    type="primary"
                    icon={<CheckOutlined />}
                    size="small"
                    ghost
                  />
                </Tooltip>
              </Popconfirm>
            )}
            
            <Dropdown overlay={menu} trigger={['click']}>
              <Button
                icon={<MoreOutlined />}
                size="small"
              />
            </Dropdown>
          </Space>
        );
      }
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <Card 
        className="mb-6 border-0 shadow-sm rounded-xl bg-white"
        bodyStyle={{ padding: '24px' }}
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <Title level={2} className="!m-0 text-gray-800 flex items-center">
              <TeamOutlined className="mr-3 text-blue-600" />
              Gestion des Professeurs
              {showInactifs && (
                <Tag color="orange" className="ml-3">
                  <EyeInvisibleOutlined /> Inactifs visibles
                </Tag>
              )}
            </Title>
            <Text type="secondary" className="text-gray-600">
              Gérez les professeurs avec suppression douce (soft delete)
            </Text>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <Search
              placeholder="Rechercher un professeur..."
              prefix={<SearchOutlined className="text-gray-400" />}
              onChange={(e) => setSearchText(e.target.value)}
              value={searchText}
              allowClear
              size="middle"
              className="min-w-[200px]"
            />
            
            <Tooltip title={showInactifs ? "Masquer les inactifs" : "Afficher les inactifs"}>
              <Button
                icon={showInactifs ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                onClick={() => setShowInactifs(!showInactifs)}
                type={showInactifs ? "primary" : "default"}
              />
            </Tooltip>
            
            <Tooltip title="Actualiser">
              <Button
                icon={<ReloadOutlined />}
                onClick={loadProfesseurs}
                loading={loading}
              />
            </Tooltip>
            
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setSelectedProfesseur(null);
                form.resetFields();
                setModalVisible(true);
              }}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Nouveau Professeur
            </Button>
          </div>
        </div>

        <Divider className="my-4" />

        {/* Statistiques */}
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={6}>
            <Card className="border-0 shadow-sm bg-gradient-to-r from-blue-50 to-blue-100">
              <Statistic
                title="Total"
                value={stats.total}
                prefix={<TeamOutlined className="text-blue-600" />}
                valueStyle={{ color: '#1890ff', fontSize: '24px' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card className="border-0 shadow-sm bg-gradient-to-r from-green-50 to-green-100">
              <Statistic
                title="Actifs"
                value={stats.actifs}
                prefix={<CheckOutlined className="text-green-600" />}
                valueStyle={{ color: '#52c41a', fontSize: '24px' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card className="border-0 shadow-sm bg-gradient-to-r from-red-50 to-red-100">
              <Statistic
                title="Inactifs"
                value={stats.inactifs}
                prefix={<CloseOutlined className="text-red-600" />}
                valueStyle={{ color: '#ff4d4f', fontSize: '24px' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card className="border-0 shadow-sm bg-gradient-to-r from-teal-50 to-teal-100">
              <Statistic
                title="Assignés"
                value={stats.assignes}
                prefix={<CheckCircleOutlined className="text-teal-600" />}
                valueStyle={{ color: '#13c2c2', fontSize: '24px' }}
              />
            </Card>
          </Col>
        </Row>
      </Card>

      {/* Tableau */}
      <Card 
        className="border-0 shadow-sm rounded-xl overflow-hidden"
        bodyStyle={{ padding: 0 }}
      >
        {loading && professeurs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Spin size="large" className="mb-4" />
            <Text className="text-gray-500">Chargement des professeurs...</Text>
          </div>
        ) : filteredProfesseurs.length === 0 ? (
          <div className="py-20 text-center">
            {searchText ? (
              <Alert
                message="Aucun professeur trouvé"
                description={`Aucun résultat pour "${searchText}"`}
                type="info"
                showIcon
                className="max-w-md mx-auto"
              />
            ) : (
              <div className="max-w-md mx-auto">
                <UserOutlined className="text-5xl text-gray-300 mb-4" />
                <Title level={4} className="text-gray-500 mb-2">
                  {showInactifs 
                    ? "Aucun professeur inactif" 
                    : "Aucun professeur enregistré"}
                </Title>
                <Text type="secondary" className="block mb-6">
                  {showInactifs
                    ? "Tous les professeurs sont actuellement actifs."
                    : "Commencez par ajouter votre premier professeur."}
                </Text>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    setSelectedProfesseur(null);
                    form.resetFields();
                    setModalVisible(true);
                  }}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {showInactifs ? "Voir les actifs" : "Ajouter le premier professeur"}
                </Button>
              </div>
            )}
          </div>
        ) : (
          <Table<Professeur>
            columns={columns}
            dataSource={filteredProfesseurs}
            rowKey="id"
            loading={loading}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) => 
                `${range[0]}-${range[1]} sur ${total} professeurs`,
              className: "px-6 py-4"
            }}
            className="professeurs-table"
            rowClassName={(record) => 
              record.statut === 'Inactif' 
                ? "bg-gray-50 hover:bg-gray-100 text-gray-400"
                : record.nombre_enseignements > 0 
                  ? "bg-green-50 hover:bg-green-100"
                  : "bg-orange-50 hover:bg-orange-100"
            }
            scroll={{ x: 800 }}
          />
        )}
      </Card>

      {/* Modal d'ajout/modification */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <UserOutlined className="text-blue-500" />
            <span className="text-gray-800 font-medium">
              {selectedProfesseur ? 'Modifier le Professeur' : 'Nouveau Professeur'}
            </span>
          </div>
        }
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setSelectedProfesseur(null);
          form.resetFields();
        }}
        footer={null}
        width={400}
        className="rounded-lg"
        styles={{
          header: { borderBottom: '1px solid #f0f0f0', padding: '16px 24px' },
          body: { padding: '24px' }
        }}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          size="large"
        >
          <Form.Item
            label="Nom"
            name="nom"
            rules={[
              { required: true, message: 'Le nom est requis' },
              { min: 2, message: 'Minimum 2 caractères' }
            ]}
            className="mb-4"
          >
            <Input
              placeholder="Entrez le nom"
              prefix={<UserOutlined className="text-gray-400" />}
              className="border-gray-300 hover:border-blue-400 focus:border-blue-500"
            />
          </Form.Item>

          <Form.Item
            label="Prénom"
            name="prenom"
            rules={[
              { required: true, message: 'Le prénom est requis' },
              { min: 2, message: 'Minimum 2 caractères' }
            ]}
            className="mb-6"
          >
            <Input
              placeholder="Entrez le prénom"
              prefix={<UserOutlined className="text-gray-400" />}
              className="border-gray-300 hover:border-blue-400 focus:border-blue-500"
            />
          </Form.Item>

          <Divider className="my-4" />

          <div className="flex justify-end gap-3">
            <Button
              onClick={() => setModalVisible(false)}
              className="border-gray-300 hover:border-gray-400"
            >
              Annuler
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              icon={selectedProfesseur ? <EditOutlined /> : <PlusOutlined />}
              className="bg-blue-600 hover:bg-blue-700 border-blue-600"
            >
              {selectedProfesseur ? 'Mettre à jour' : 'Ajouter'}
            </Button>
          </div>
        </Form>
      </Modal>

      {/* Drawer de détails */}
      <Drawer
        title={
          <div className="flex items-center gap-2">
            <UserOutlined className="text-blue-500" />
            <span className="text-gray-800 font-medium">
              Détails du professeur
            </span>
          </div>
        }
        width={800}
        open={detailDrawerVisible}
        onClose={() => setDetailDrawerVisible(false)}
        styles={{
          body: { padding: 0 }
        }}
      >
        {selectedProfesseur && (
          <div className="p-6">
            {/* En-tête avec infos du professeur */}
            <div className="mb-6 p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-4 mb-4">
                <Avatar 
                  size={64}
                  icon={<UserOutlined />}
                  style={{ 
                    backgroundColor: selectedProfesseur.statut === 'Actif' ? '#52c41a' : '#d9d9d9'
                  }}
                />
                <div>
                  <Title level={3} className="!m-0">
                    {selectedProfesseur.prenom} {selectedProfesseur.nom}
                  </Title>
                  <Space>
                    <Tag color={selectedProfesseur.statut === 'Actif' ? 'success' : 'error'}>
                      {selectedProfesseur.statut}
                    </Tag>
                    <Tag color={selectedProfesseur.nombre_enseignements > 0 ? 'green' : 'orange'}>
                      {selectedProfesseur.nombre_enseignements} enseignement(s)
                    </Tag>
                  </Space>
                </div>
              </div>
              
              <Descriptions column={2} size="small">
                <Descriptions.Item label="Date de création">
                  {new Date(selectedProfesseur.date_creation).toLocaleDateString('fr-FR')}
                </Descriptions.Item>
                <Descriptions.Item label="ID">
                  {selectedProfesseur.id}
                </Descriptions.Item>
              </Descriptions>
            </div>

            {/* Statistiques */}
            <div className="mb-6">
              <Title level={4} className="mb-4">
                <DollarOutlined className="mr-2" />
                Statistiques financières
              </Title>
              <Row gutter={[16, 16]}>
                <Col span={12}>
                  <Card size="small">
                    <AntStatistic
                      title="Coût total"
                      value={formatNumber(totalCout)}
                      prefix={<DollarOutlined />}
                      valueStyle={{ color: '#3f8600' }}
                      suffix="FCFA"
                    />
                  </Card>
                </Col>
                <Col span={12}>
                  <Card size="small">
                    <AntStatistic
                      title="Heures totales"
                      value={stats.totalHeures}
                      prefix={<ScheduleOutlined />}
                      valueStyle={{ color: '#1890ff' }}
                      suffix="h"
                    />
                  </Card>
                </Col>
              </Row>
            </div>

            {/* Liste des matières enseignées */}
            <div>
              <Title level={4} className="mb-4">
                <BookOutlined className="mr-2" />
                Matières enseignées ({matieresDetail.length})
              </Title>

              {detailLoading ? (
                <div className="text-center py-8">
                  <Spin size="large" />
                  <div className="mt-2">Chargement des matières...</div>
                </div>
              ) : matieresDetail.length === 0 ? (
                <Alert
                  message="Aucune matière assignée"
                  description="Ce professeur n'a encore aucune matière assignée."
                  type="info"
                  showIcon
                />
              ) : (
                <Collapse>
                  {matieresDetail.map((matiere) => {
                    const coutCM = (matiere.volume_horaire_cm || 0) * (matiere.taux_horaire_cm || 0);
                    const coutTD = (matiere.volume_horaire_td || 0) * (matiere.taux_horaire_td || 0);
                    const coutTotal = coutCM + coutTD;
                    
                    return (
                      <Panel
                        key={matiere.enseignement_id}
                        header={
                          <div className="flex justify-between items-center">
                            <span>
                              <strong>{matiere.matiere_nom}</strong>
                              <Tag color="blue" className="ml-2">
                                Coef: {matiere.coefficient}
                              </Tag>
                            </span>
                            <span className="text-green-600 font-bold">
                              {formatNumber(matiere.cout_total)} FCFA
                            </span>
                          </div>
                        }
                      >
                        <Descriptions column={2} size="small">
                          <Descriptions.Item label="Classe">
                            {matiere.classe_nom}
                          </Descriptions.Item>
                          <Descriptions.Item label="Groupe">
                            {matiere.groupe_nom}
                          </Descriptions.Item>
                          <Descriptions.Item label="Coefficient">
                            {matiere.coefficient}
                          </Descriptions.Item>
                          <Descriptions.Item label="Type d'évaluation">
                            {matiere.type_evaluation}
                          </Descriptions.Item>
                          <Descriptions.Item label="Heures CM">
                            {matiere.volume_horaire_cm}h × {formatNumber(matiere.taux_horaire_cm)} FCFA/h
                          </Descriptions.Item>
                          <Descriptions.Item label="Heures TD">
                            {matiere.volume_horaire_td}h × {formatNumber(matiere.taux_horaire_td)} FCFA/h
                          </Descriptions.Item>
                          <Descriptions.Item label="Année académique">
                            {matiere.annee_academique}
                          </Descriptions.Item>
                          <Descriptions.Item label="Coût détaillé">
                            {formatNumber(coutTotal)} FCFA
                            <div className="text-xs text-gray-500 mt-1">
                              ({matiere.volume_horaire_cm}h × {formatNumber(matiere.taux_horaire_cm)} + {matiere.volume_horaire_td}h × {formatNumber(matiere.taux_horaire_td)})
                            </div>
                          </Descriptions.Item>
                        </Descriptions>
                      </Panel>
                    );
                  })}
                </Collapse>
              )}
            </div>
          </div>
        )}
      </Drawer>

      {/* Info sur le soft delete */}
      <Alert
        message="Note sur la suppression douce"
        description="Les professeurs ne sont jamais supprimés définitivement. Ils sont simplement marqués comme 'inactifs' et peuvent être réactivés à tout moment."
        type="info"
        showIcon
        className="mt-6 border-blue-200 bg-blue-50"
      />
    </div>
  );
};

export default Professeur;