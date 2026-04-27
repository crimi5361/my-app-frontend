/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react';
import { 
  Form, 
  Input, 
  Select, 
  DatePicker, 
  Upload, 
  Button, 
  Card, 
  Row, 
  Col,
  Steps,
  message,
  Typography,
  Spin,
  Modal,
  Alert
} from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import PageHeader from '../../Components/PageHeader/PageHeader';
import ResumeFinalisation from './ResumeFinalisation';
import type { UploadFile } from 'antd/es/upload/interface';
import type { InitialValues } from './ResumeFinalisation';
import dayjs from 'dayjs';

const { Step } = Steps;
const { Option } = Select;
const { Text } = Typography;

interface AnneeAcademique {
  id: number;
  annee: string;
  etat: string;
}

interface Nationalite {
  code: string;
  name: string;
  demonym: string;
}

interface Ville {
  id: number;
  nom: string;
}

interface SerieBac {
  id: number;
  nom: string;
}

interface AnneeBac {
  id: number;
  nom: string;
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

const NouvelleAdmission = () => {
  const [form] = Form.useForm();
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [anneesAcademiques, setAnneesAcademiques] = useState<AnneeAcademique[]>([]);
  const [nationalites, setNationalites] = useState<Nationalite[]>([]);
  const [villes, setVilles] = useState<Ville[]>([]);
  const [seriesBac, setSeriesBac] = useState<SerieBac[]>([]);
  const [anneesBac, setAnneesBac] = useState<AnneeBac[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<UserInfo | null>(null);
  const [currentYearId, setCurrentYearId] = useState<number | null>(null);
  
  const [formData, setFormData] = useState<InitialValues>({
    nom: '',
    prenoms: '',
    sexe: '',
    matricule: '',
    statut_scolaire: '',
    date_naissance: undefined,
    lieu_naissance: '',
    pays_naissance: '',
    telephone: '',
    contact_parent: '',
    contact_parent_2: '',
    nom_parent_1: '',
    nom_parent_2: '',
    numero_table: '',
    lieu_residence: '',
    annee_bac: '',
    serie_bac: '',
    etablissement_origine: '',
    annee_academique_id: '',
    nationalite: '',
    photo_url: ''
  });

  const API_URL = import.meta.env.VITE_API_URL_SERVER || "";

  // Chargement utilisateur
  useEffect(() => {
    const user = getUserInfo();
    if (!user) {
      message.error('Impossible de récupérer vos informations. Veuillez vous reconnecter.');
      return;
    }
    if (!user.departement_id) {
      message.error("Aucun département associé à votre compte.");
      return;
    }
    setCurrentUser(user);
  }, []);

  // Récupérer les années académiques du département
  useEffect(() => {
    if (!currentUser?.departement_id) return;
    
    const fetchAcademicYears = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');
        if (!token) {
          message.error('Authentification requise');
          return;
        }

        const response = await fetch(`${API_URL}/api/annees?departement_id=${currentUser.departement_id}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.status === 401) {
          message.error('Session expirée, veuillez vous reconnecter');
          localStorage.removeItem('token');
          return;
        }

        if (!response.ok) {
          throw new Error(`Erreur ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (Array.isArray(data)) {
          setAnneesAcademiques(data);
          
          // Trouver l'année en cours
          const currentYear = data.find((year: AnneeAcademique) => 
            year.etat?.toLowerCase() === 'en cours' || 
            year.etat?.toLowerCase() === 'en cour'
          );
          
          if (currentYear) {
            setCurrentYearId(currentYear.id);
            form.setFieldsValue({
              annee_academique_id: currentYear.id.toString()
            });
            setFormData(prev => ({
              ...prev,
              annee_academique_id: currentYear.id.toString()
            }));
          } else if (data.length > 0) {
            // Si pas d'année en cours, prendre la première et avertir
            setCurrentYearId(data[0].id);
            form.setFieldsValue({
              annee_academique_id: data[0].id.toString()
            });
            setFormData(prev => ({
              ...prev,
              annee_academique_id: data[0].id.toString()
            }));
            message.warning('Aucune année en cours trouvée. Veuillez contacter l\'administrateur.');
          } else {
            message.error('Aucune année académique trouvée pour ce département');
          }
        }
      } catch (error) {
        console.error('Erreur récupération années académiques:', error);
        message.error('Erreur lors du chargement des années académiques');
      } finally {
        setLoading(false);
      }
    };

    fetchAcademicYears();
  }, [API_URL, currentUser, form]);

  // Fetch des autres données
  useEffect(() => {
    if (!currentUser?.departement_id) return;
    
    const fetchOtherData = async () => {
      try {
        await Promise.all([
          fetchNationalites(),
          fetchVilles(),
          fetchSeriesBac(),
          fetchAnneesBac()
        ]);
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchOtherData();
  }, [currentUser]);

  const fetchVilles = async () => {
    try {
      const response = await fetch(`${API_URL}/api/data/villes`);
      if (!response.ok) throw new Error('Erreur lors de la récupération des villes');
      
      const data = await response.json();
      if (data.success) {
        setVilles(data.data);
      }
    } catch (error) {
      message.error('Erreur lors du chargement des villes');
      console.error(error);
    }
  };

  const fetchSeriesBac = async () => {
    try {
      const response = await fetch(`${API_URL}/api/data/series-bac`);
      if (!response.ok) throw new Error('Erreur lors de la récupération des séries de BAC');
      
      const data = await response.json();
      if (data.success) {
        setSeriesBac(data.data);
      }
    } catch (error) {
      message.error('Erreur lors du chargement des séries de BAC');
      console.error(error);
    }
  };

  const fetchAnneesBac = async () => {
    try {
      const response = await fetch(`${API_URL}/api/data/annees-bac`);
      if (!response.ok) throw new Error('Erreur lors de la récupération des années de BAC');
      
      const data = await response.json();
      if (data.success) {
        setAnneesBac(data.data);
      }
    } catch (error) {
      message.error('Erreur lors du chargement des années de BAC');
      console.error(error);
    }
  };

  const fetchNationalites = async () => {
    try {
      const response = await fetch('https://restcountries.com/v3.1/all?fields=name,demonyms,cca2');
      if (!response.ok) throw new Error('Erreur lors de la récupération des nationalités');
      
      const data = await response.json();
      const nationalitesFormattees = data
        .filter((country: any) => country.cca2 && country.name?.common)
        .map((country: any) => ({
          code: country.cca2,
          name: country.name.common,
          demonym: country.demonyms?.eng?.m || country.name.common,
        }))
        .sort((a: any, b: any) => a.name.localeCompare(b.name));

      const coteIvoire = nationalitesFormattees.find((nat: any) => nat.code === 'CI');
      setNationalites(coteIvoire 
        ? [coteIvoire, ...nationalitesFormattees.filter((nat: any) => nat.code !== 'CI')]
        : nationalitesFormattees
      );
    } catch (error) {
      message.error('Erreur lors du chargement des nationalités');
      console.error(error);
    }
  };

  const onFirstStepFinish = async (values: any) => {
    try {
      setSubmitting(true);
      setFormData({ 
        ...values,
        date_naissance: values.date_naissance ? dayjs(values.date_naissance) : undefined,
        photo_url: fileList[0]?.name || '' 
      });
      setCurrentStep(1);
    } catch (error) {
      console.error('Erreur lors de la validation du formulaire:', error);
      message.error('Une erreur est survenue lors de la validation du formulaire');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSuccess = () => {
    const resetForm = () => {
      form.resetFields();
      setFileList([]);
      setCurrentStep(0);
      
      // Réinitialiser avec l'année en cours
      if (currentYearId) {
        form.setFieldsValue({
          annee_academique_id: currentYearId.toString()
        });
        setFormData({
          nom: '',
          prenoms: '',
          sexe: '',
          matricule: '',
          statut_scolaire: '',
          date_naissance: undefined,
          lieu_naissance: '',
          pays_naissance: '',
          telephone: '',
          contact_parent: '',
          contact_parent_2: '',
          nom_parent_1: '',
          nom_parent_2: '',
          numero_table: '',
          lieu_residence: '',
          annee_bac: '',
          serie_bac: '',
          etablissement_origine: '',
          annee_academique_id: currentYearId.toString(),
          nationalite: '',
          photo_url: ''
        });
      }
    };

    message.success('Admission enregistrée avec succès!');
    Modal.success({
      title: 'Admission réussie',
      content: 'Voulez-vous enregistrer un nouvel étudiant ?',
      okText: 'Oui',
      cancelText: 'Non',
      onOk: () => {
        resetForm();
      },
      onCancel: () => {
        // Ne rien faire
      }
    });
  };
  
  // Vérifier si une année est en cours
  const isYearActive = (yearEtat: string) => {
    return yearEtat?.toLowerCase() === 'en cours' || yearEtat?.toLowerCase() === 'en cour';
  };

  const steps = [
    {
      title: 'Informations de base',
      content: (
        <Card 
          style={{ margin: '20px auto', maxWidth: '1400px' }}
          title="Informations de l'étudiant"
          bordered={false}
        >
          <Spin spinning={loading}>
            {/* Message d'information sur le département */}
            {currentUser && (
              <Alert
                message={`Inscription pour le département: ${currentUser.departementName || 'Département ' + currentUser.departement_id}`}
                description={
                  <div>
                    <strong>Attention :</strong> Les inscriptions sont possibles uniquement pour l'année académique en cours.
                    Les autres années sont affichées mais désactivées.
                  </div>
                }
                type="info"
                showIcon
                style={{ marginBottom: 24 }}
                closable
              />
            )}
            
            <Form
              form={form}
              layout="vertical"
              onFinish={onFirstStepFinish}
              autoComplete="off"
              initialValues={formData}
            >
              {/* SECTION 1: INFORMATIONS PERSONNELLES */}
              <Text strong style={{ display: 'block', marginBottom: 16 }}>
                INFORMATIONS PERSONNELLES
              </Text>
              
              <Row gutter={24}>
                <Col span={8}>
                  <Form.Item
                    name="nom"
                    label="Nom"
                    rules={[
                      { required: true, message: 'Veuillez saisir le nom' },
                      { max: 50, message: 'Le nom ne doit pas dépasser 50 caractères' }
                    ]}
                  >
                    <Input placeholder="Nom de famille" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    name="prenoms"
                    label="Prénoms"
                    rules={[
                      { required: true, message: 'Veuillez saisir les prénoms' },
                      { max: 100, message: 'Les prénoms ne doivent pas dépasser 100 caractères' }
                    ]}
                  >
                    <Input placeholder="Prénoms complets" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    name="sexe"
                    label="Sexe"
                    rules={[{ required: true, message: 'Veuillez sélectionner le sexe' }]}
                  >
                    <Select placeholder="Sélectionnez le sexe">
                      <Option value="Masculin">Masculin</Option>
                      <Option value="Féminin">Féminin</Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={24}>
                <Col span={8}>
                  <Form.Item
                    name="date_naissance"
                    label="Date de naissance"
                    rules={[{ required: true, message: 'Veuillez sélectionner la date de naissance' }]}
                  >
                    <DatePicker 
                      style={{ width: '100%' }} 
                      disabledDate={(current) => current && current > dayjs().endOf('day')}
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    name="lieu_naissance"
                    label="Lieu de naissance"
                    rules={[
                      { required: true, message: 'Veuillez saisir le lieu de naissance' },
                      { max: 100, message: 'Le lieu ne doit pas dépasser 100 caractères' }
                    ]}
                  >
                    <Input placeholder="Ville" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    name="pays_naissance"
                    label="Pays de naissance"
                    rules={[{ required: true, message: 'Veuillez sélectionner le pays de naissance' }]}
                  >
                    <Select 
                      placeholder="Sélectionnez le pays" 
                      showSearch
                      optionFilterProp="children"
                      filterOption={(input, option) => 
                        String(option?.props?.children).toLowerCase().includes(input.toLowerCase())
                      }
                    >
                      {nationalites.map(nat => (
                        <Option key={nat.code} value={nat.code}>
                          {nat.name}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={24}>
                <Col span={8}>
                  <Form.Item
                    name="lieu_residence"
                    label="Lieu de résidence"
                    rules={[
                      { required: true, message: 'Veuillez sélectionner le lieu de résidence' }
                    ]}
                  >
                    <Select 
                      placeholder="Sélectionnez la ville" 
                      showSearch
                      optionFilterProp="children"
                      filterOption={(input, option) => 
                        String(option?.props?.children).toLowerCase().includes(input.toLowerCase())
                      }
                      loading={villes.length === 0}
                    >
                      {villes.map(ville => (
                        <Option key={ville.id} value={ville.nom}>
                          {ville.nom}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    name="telephone"
                    label="Téléphone"
                    rules={[
                      { required: true, message: 'Veuillez saisir le téléphone' },
                      { pattern: /^[0-9]{10,15}$/, message: 'Numéro invalide (10-15 chiffres)' }
                    ]}
                  >
                    <Input placeholder="Ex: 2250102030405" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    name="nationalite"
                    label="Nationalité"
                    rules={[{ required: true, message: 'Veuillez sélectionner la nationalité' }]}
                  >
                    <Select 
                      placeholder="Sélectionnez la nationalité" 
                      showSearch 
                      optionFilterProp="children"
                      filterOption={(input, option) => 
                        String(option?.props?.children).toLowerCase().includes(input.toLowerCase())
                      }
                    >
                      {nationalites.map(nat => (
                        <Option key={nat.code} value={nat.code}>
                          {nat.name} ({nat.demonym})
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={24}>
                <Col span={8}>
                  <Form.Item
                    name="contact_parent"
                    label="Contact parent/tuteur 1"
                    rules={[
                      { required: true, message: 'Veuillez saisir le contact du parent' },
                      { pattern: /^[0-9]{10,15}$/, message: 'Numéro invalide (10-15 chiffres)' }
                    ]}
                  >
                    <Input placeholder="Ex: 2250102030405" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    name="contact_parent_2"
                    label="Contact parent/tuteur 2"
                    rules={[
                      { pattern: /^[0-9]{10,15}$/, message: 'Numéro invalide (10-15 chiffres)' }
                    ]}
                  >
                    <Input placeholder="Ex: 2250102030405" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    name="nom_parent_1"
                    label="Nom parent/tuteur 1"
                    rules={[
                      { required: true, message: 'Veuillez saisir le nom du parent' },
                      { max: 100, message: 'Le nom ne doit pas dépasser 100 caractères' }
                    ]}
                  >
                    <Input placeholder="Nom complet du parent/tuteur" />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={24}>
                <Col span={8}>
                  <Form.Item
                    name="nom_parent_2"
                    label="Nom parent/tuteur 2"
                    rules={[
                      { max: 100, message: 'Le nom ne doit pas dépasser 100 caractères' }
                    ]}
                  >
                    <Input placeholder="Nom complet du parent/tuteur secondaire" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="photo_url"
                    label="Photo d'identité"
                    rules={[
                      { 
                        validator: (_, __, callback) => {
                          if (fileList.length === 0) {
                            callback('Veuillez téléverser une photo');
                          } else {
                            callback();
                          }
                        }
                      }
                    ]}
                  >
                    <Upload
                      listType="picture"
                      beforeUpload={(file) => {
                        const isLt2M = file.size / 1024 / 1024 < 2;
                        if (!isLt2M) {
                          message.error('La photo doit faire moins de 2MB');
                          return false;
                        }
                        return false;
                      }}
                      onChange={({ fileList: newFileList }) => setFileList(newFileList)}
                      fileList={fileList}
                      accept="image/*"
                      maxCount={1}
                    >
                      <Button icon={<UploadOutlined />}>Téléverser la photo</Button>
                    </Upload>
                  </Form.Item>
                </Col>
              </Row>

              {/* SECTION 2: INFORMATIONS ACADÉMIQUES */}
              <Text strong style={{ display: 'block', margin: '24px 0 16px' }}>
                INFORMATIONS ACADÉMIQUES
              </Text>
              
              <Row gutter={24}>
                <Col span={8}>
                  <Form.Item
                    name="matricule"
                    label="Matricule Menet"
                    rules={[
                      { required: true, message: 'Veuillez saisir le matricule' },
                      { pattern: /^[A-Za-z0-9]+$/, message: 'Matricule invalide' }
                    ]}
                    tooltip="Le matricule attribué par le Ministère de l'Enseignement Supérieur"
                  >
                    <Input placeholder="Ex: 22ABCD1234" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    name="annee_bac"
                    label="Année d'obtention du BAC"
                    rules={[
                      { required: true, message: 'Veuillez sélectionner l\'année du BAC' }
                    ]}
                  >
                    <Select 
                      placeholder="Sélectionnez l'année"
                      showSearch
                      optionFilterProp="children"
                      filterOption={(input, option) => 
                        String(option?.props?.children).toLowerCase().includes(input.toLowerCase())
                      }
                      loading={anneesBac.length === 0}
                    >
                      {anneesBac.map(annee => (
                        <Option key={annee.id} value={annee.nom}>
                          {annee.nom}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    name="serie_bac"
                    label="Série du BAC"
                    rules={[
                      { required: true, message: 'Veuillez sélectionner la série du BAC' }
                    ]}
                  >
                    <Select 
                      placeholder="Sélectionnez la série"
                      showSearch
                      optionFilterProp="children"
                      filterOption={(input, option) => 
                        String(option?.props?.children).toLowerCase().includes(input.toLowerCase())
                      }
                      loading={seriesBac.length === 0}
                    >
                      {seriesBac.map(serie => (
                        <Option key={serie.id} value={serie.nom}>
                          {serie.nom}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={24}>
                <Col span={8}>
                  <Form.Item
                    name="etablissement_origine"
                    label="Établissement d'origine"
                    rules={[
                      { required: true, message: 'Veuillez saisir l\'établissement d\'origine' },
                      { max: 150, message: 'Le nom ne doit pas dépasser 150 caractères' }
                    ]}
                  >
                    <Input placeholder="Nom complet de l'établissement" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    name="numero_table"
                    label="Numéro de table au BAC"
                    rules={[
                      { required: true, message: 'Veuillez saisir le numéro de table' },
                      { pattern: /^[0-9]+$/, message: 'Numéro invalide' }
                    ]}
                  >
                    <Input placeholder="Numéro de table" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    name="annee_academique_id"
                    label="Année académique"
                    rules={[
                      { required: true, message: 'Veuillez sélectionner l\'année académique' },
                      {
                        validator: (_, value) => {
                          const selectedYear = anneesAcademiques.find(y => y.id.toString() === value);
                          if (selectedYear && !isYearActive(selectedYear.etat)) {
                            return Promise.reject(new Error('Seule l\'année académique en cours est autorisée pour l\'inscription'));
                          }
                          return Promise.resolve();
                        }
                      }
                    ]}
                    tooltip="Seule l'année académique en cours est autorisée pour l'inscription"
                  >
                    <Select 
                      placeholder="Sélectionnez l'année académique"
                      loading={anneesAcademiques.length === 0}
                      disabled={!currentYearId}
                    >
                      {anneesAcademiques.map(annee => {
                        const isActive = isYearActive(annee.etat);
                        return (
                          <Option 
                            key={annee.id} 
                            value={annee.id.toString()}
                            disabled={!isActive}
                            style={!isActive ? { color: '#ccc', backgroundColor: '#f5f5f5' } : {}}
                          >
                            {annee.annee} 
                            {isActive ? '  (En cours - Inscription autorisée)' : '  (Inscription non autorisée)'}
                          </Option>
                        );
                      })}
                    </Select>
                  </Form.Item>
                  {currentYearId && (
                    <div style={{ marginTop: 4 }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        ℹ️ Seule l'année en cours est disponible pour l'inscription
                      </Text>
                    </div>
                  )}
                </Col>
              </Row>

              <Row gutter={24}>
                <Col span={8}>
                  <Form.Item
                    name="statut_scolaire"
                    label="Statut scolaire"
                    rules={[{ required: true, message: 'Veuillez sélectionner le statut scolaire' }]}
                  >
                    <Select placeholder="Sélectionnez le statut">
                      <Option value="Affecté">Affecté</Option>
                      <Option value="Non affecté">Non affecté</Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item style={{ marginTop: '32px', textAlign: 'center' }}>
                <Button 
                  type="primary" 
                  htmlType="submit" 
                  size="large"
                  loading={submitting}
                  style={{ minWidth: 150 }}
                >
                  Suivant
                </Button>
              </Form.Item>
            </Form>
          </Spin>
        </Card>
      ),
    },
    {
      title: 'Finalisation',
      content: (
        <ResumeFinalisation 
          initialValues={formData}
          onPrev={() => setCurrentStep(0)}
          fileList={fileList.map(file => file.originFileObj as File)}
          onSuccess={handleSuccess}
        />
      ),
    },
  ];

  // Guards
  if (!currentUser) {
    return (
      <div style={{ padding: '0 30px' }}>
        <PageHeader />
        <div style={{ padding: '24px' }}>
          <Alert
            message="Accès non autorisé"
            description="Impossible de récupérer vos informations utilisateur. Veuillez vous reconnecter."
            type="error" 
            showIcon
          />
        </div>
      </div>
    );
  }

  if (!currentUser.departement_id) {
    return (
      <div style={{ padding: '0 30px' }}>
        <PageHeader />
        <div style={{ padding: '24px' }}>
          <Alert
            message="Département non assigné"
            description="Votre compte n'est associé à aucun département. Veuillez contacter l'administrateur."
            type="warning" 
            showIcon
          />
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '0 30px' }}>
      <PageHeader />
      
      <Steps 
        current={currentStep} 
        style={{ margin: '20px auto', maxWidth: '1100px' }}
        responsive={true}
      >
        {steps.map(item => (
          <Step key={item.title} title={item.title} />
        ))}
      </Steps>
      
      {steps[currentStep].content}
    </div>
  );
};

export default NouvelleAdmission;