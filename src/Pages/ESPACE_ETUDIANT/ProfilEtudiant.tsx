/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Form, 
  Input, 
  Button, 
  DatePicker, 
  Select, 
  Upload, 
  message, 
  Spin,
  Row,
  Col,
  Descriptions,
  Divider,
  Tag,
  Alert,
  Modal
} from 'antd';
import { 
  CameraOutlined, 
  SaveOutlined,
  ArrowLeftOutlined,
  InfoCircleOutlined,
  UserOutlined,
  MailOutlined,
  PhoneOutlined,
  HomeOutlined,
  CalendarOutlined,
  IdcardOutlined,
  LockOutlined,
  EyeOutlined,

} from '@ant-design/icons';
import type { UploadFile, UploadProps } from 'antd';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';

// Types TypeScript pour les données
interface StudentData {
  id: number;
  nom: string;
  prenoms: string;
  email: string;
  etablissement_origine: string;
  date_naissance: string;
  matricule: string;
  numero_table: string;
  ip_ministere: string;
  lieu_naissance: string;
  sexe: string;
  serie_bac: string;
  photo_url: string;
  telephone: string;
  contact_parent: string;
  contact_parent_2: string;
  lieu_residence: string;
  nationalite: string;
  code_unique: string;
  annee_bac: string;
  pays_naissance: string;
  is_profile_complete?: boolean;
}

const MiseAJourProfil: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [studentData, setStudentData] = useState<StudentData | null>(null);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [isProfileComplete, setIsProfileComplete] = useState<boolean>(false);
  const [showReadOnlyModal, setShowReadOnlyModal] = useState<boolean>(false);

  const API_URL = import.meta.env.VITE_API_URL_SERVER || '';

  // Vérifier si le profil est complet
  const checkProfileCompletion = (data: any) => {
    const requiredFields = [
      'etablissement_origine',
      'date_naissance',
      'matricule',
      'numero_table',
      'ip_ministere',
      'lieu_naissance',
      'sexe',
      'serie_bac',
      'lieu_residence',
      'pays_naissance',
      'annee_bac' // AJOUTÉ ICI
    ];

    return requiredFields.every(field => {
      const value = data[field];
      return value !== null && value !== undefined && value !== '';
    });
  };

  // Récupération des données de l'étudiant
  const fetchStudentData = async () => {
    try {
      const token = localStorage.getItem('token');
      const studentId = localStorage.getItem('user_id');
      
      if (!token || !studentId) {
        throw new Error('Token ou ID étudiant manquant');
      }
      
      const response = await fetch(`${API_URL}/api/donneeespaceetudiant/infoProfile/${studentId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        throw new Error('Erreur lors de la récupération des données');
      }
      
      const data = await response.json();
      const studentInfo = data.informations_personnelles;

      setStudentData(studentInfo);
      
      // Vérifier si le profil est complet
      const profileComplete = checkProfileCompletion(studentInfo);
      setIsProfileComplete(profileComplete);

      // Pré-remplir le formulaire avec les données
      if (studentInfo) {
        const formValues = {
          etablissement_origine: studentInfo.etablissement_origine,
          date_naissance: studentInfo.date_naissance ? dayjs(studentInfo.date_naissance) : null,
          matricule_mers: studentInfo.matricule,
          numero_table_bac: studentInfo.numero_table,
          matricule_menet: studentInfo.ip_ministere,
          lieu_naissance: studentInfo.lieu_naissance,
          sexe: studentInfo.sexe,
          serie_bac: studentInfo.serie_bac,
          annee_bac: studentInfo.annee_bac, // AJOUTÉ ICI
          lieu_residence: studentInfo.lieu_residence,
          pays_naissance: studentInfo.pays_naissance
        };

        form.setFieldsValue(formValues);
        
        // Configurer l'upload de photo si une photo existe
        if (studentInfo.photo_url) {
          setFileList([{
            uid: '-1',
            name: 'photo_profil',
            status: 'done',
            url: `${API_URL}${studentInfo.photo_url}`,
          }]);
        }
      }
    } catch (error) {
      message.error('Erreur lors du chargement des données du profil');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudentData();
  }, []);

  // Gestion de l'upload de photo - TOUJOURS AUTORISÉ
  const handleUploadChange: UploadProps['onChange'] = ({ fileList: newFileList }) => {
    setFileList(newFileList);
  };

  // Vérifier avant l'upload - TOUJOURS AUTORISÉ
  const beforeUpload = (file: File) => {
    const isImage = file.type.startsWith('image/');
    if (!isImage) {
      message.error('Vous ne pouvez uploader que des images!');
      return false;
    }

    const isLt2M = file.size / 1024 / 1024 < 2;
    if (!isLt2M) {
      message.error('L\'image doit être inférieure à 2MB!');
      return false;
    }

    return true;
  };

  // Soumission du formulaire
  const handleSubmit = async (values: any) => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const studentId = localStorage.getItem('user_id');
      
      if (!token || !studentId) {
        throw new Error('Token ou ID étudiant manquant');
      }

      let hasUpdates = false;

      // 1. Si le profil n'est PAS complet, mettre à jour les informations
      if (!isProfileComplete) {
        const formattedValues = {
          etablissement_origine: values.etablissement_origine,
          date_naissance: values.date_naissance ? values.date_naissance.format('YYYY-MM-DD') : null,
          matricule_mers: values.matricule_mers,
          numero_table_bac: values.numero_table_bac,
          matricule_menet: values.matricule_menet,
          lieu_naissance: values.lieu_naissance,
          sexe: values.sexe,
          serie_bac: values.serie_bac,
          annee_bac: values.annee_bac, // AJOUTÉ ICI
          lieu_residence: values.lieu_residence,
          pays_naissance: values.pays_naissance
        };

        console.log('Données envoyées:', formattedValues);

        const response = await fetch(`${API_URL}/api/donneeespaceetudiant/mise-a-jour-profile/${studentId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(formattedValues),
        });
        
        const responseData = await response.json();
        
        if (!response.ok) {
          throw new Error(responseData.message || 'Erreur lors de la mise à jour');
        }
        
        message.success('Informations du profil mises à jour avec succès');
        hasUpdates = true;
      }

      // 2. Si un nouveau fichier a été uploadé, mettre à jour la photo (TOUJOURS AUTORISÉ)
      if (fileList.length > 0 && fileList[0].originFileObj) {
        const formData = new FormData();
        formData.append('photo', fileList[0].originFileObj as File);
        
        const uploadResponse = await fetch(`${API_URL}/api/donneeespaceetudiant/profile/${studentId}/photo`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: formData,
        });
        
        if (!uploadResponse.ok) {
          const uploadError = await uploadResponse.json();
          throw new Error(uploadError.message || 'Erreur lors de l\'upload de la photo');
        }
        
        message.success('Photo de profil mise à jour avec succès');
        hasUpdates = true;
      }
      
      // Recharger les données seulement si des mises à jour ont été faites
      if (hasUpdates) {
        fetchStudentData();
      } else {
        message.info('Aucune modification à enregistrer');
      }
      
    } catch (error: any) {
      console.error('Erreur détaillée:', error);
      message.error(error.message || 'Erreur lors de la mise à jour');
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    window.history.back();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <style>{`
        @keyframes scroll-left {
          0% {
            transform: translateX(100%);
          }
          100% {
            transform: translateX(-100%);
          }
        }
        
        .scrolling-text-container {
          overflow: hidden;
          white-space: nowrap;
          background: #fff7e6;
          border: 1px solid #ffd591;
          border-radius: 8px;
          padding: 12px 0;
        }
        
        .scrolling-text {
          display: inline-block;
          animation: scroll-left 25s linear infinite;
          padding-left: 100%;
        }
        
        .scrolling-text:hover {
          animation-play-state: paused;
        }
      `}</style>

      <div className="max-w-6xl mx-auto">
        
        {/* Bannière d'information défilante */}
        <div className="scrolling-text-container mb-6 shadow-sm">
          <div className="scrolling-text text-base">
            <InfoCircleOutlined className="mr-2 text-orange-500" />
            <span className="font-semibold text-gray-800">Cher(e) étudiant(e)</span>
            <span className="text-gray-700">, nous vous invitons à mettre à jour vos informations avant le </span>
            <span className="font-bold text-orange-600">10 Janvier</span>
            <span className="text-gray-700"> dans l'onglet </span>
            <span className="font-semibold text-blue-600">"Mise à Jour Profil"</span>
            <span className="text-gray-700">, ces informations seront transmises au </span>
            <span className="font-semibold text-gray-800">Ministère de l'enseignement supérieur</span>
            <span className="text-gray-700">.</span>
          </div>
        </div>

        {/* Alertes importantes */}
        {isProfileComplete && (
          <Alert
            message="Profil Complet"
            description="Votre profil est désormais complet. Seule la photo peut encore être modifiée."
            type="success"
            showIcon
            className="mb-6"
            action={
              <Button 
                size="small" 
                icon={<EyeOutlined />}
                onClick={() => setShowReadOnlyModal(true)}
              >
                Voir mes informations
              </Button>
            }
          />
        )}

        {/* En-tête avec bouton retour */}
        <div className="flex items-center justify-between mb-6">
          <Button 
            icon={<ArrowLeftOutlined />} 
            onClick={handleBack}
            className="flex items-center"
            size="large"
          >
            Retour
          </Button>
          
          <div className="w-24"></div>
        </div>

        {/* Informations étudiant */}
        {studentData && (
          <div className="text-center mb-6 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg shadow-sm border border-blue-100">
            <h2 className="text-2xl font-bold text-gray-900">
              {studentData.prenoms} {studentData.nom}
            </h2>
            <p className="text-gray-600 mt-2 text-base">
              <MailOutlined className="mr-2" />
              {studentData.email}
            </p>
            {isProfileComplete && (
              <Tag color="green" className="mt-2">
                <LockOutlined /> Profil Verrouillé (sauf photo)
              </Tag>
            )}
          </div>
        )}

        {/* Formulaire de mise à jour */}
        <Card 
          title={
            <div className="flex items-center">
             
              <div className="ml-4">
                {isProfileComplete ? (
                  <Tag color="green" icon={<LockOutlined />}>
                    Lecture Seule
                  </Tag>
                ) : (
                  <Tag color="blue"></Tag>
                )}
              </div>
            </div>
          } 
          className="w-full shadow-md border-0 mb-6"
          // extra={
          //   isProfileComplete && (
          //     <Button 
          //       icon={<EditOutlined />}
          //       onClick={() => setShowReadOnlyModal(true)}
          //     >
          //       Mode Consultation
          //     </Button>
          //   )
          // }
        >
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            scrollToFirstError
            disabled={isProfileComplete}
          >
            <Row gutter={[24, 24]}>
              
              {/* Section Photo - TOUJOURS MODIFIABLE */}
              <Col xs={24} lg={6}>
                <div className="flex flex-col items-center">
                  <div className="mb-4">
                    <Upload
                      listType="picture-circle"
                      fileList={fileList}
                      onChange={handleUploadChange}
                      beforeUpload={beforeUpload}
                      accept="image/*"
                      showUploadList={{ showPreviewIcon: false }}
                      // SUPPRIMEZ disabled={isProfileComplete} - LA PHOTO EST TOUJOURS MODIFIABLE
                    >
                      {fileList.length >= 1 ? null : (
                        <div className="flex flex-col items-center justify-center">
                          <CameraOutlined style={{ fontSize: '28px', color: '#1890ff' }} />
                          <div className="mt-2 text-sm text-blue-600 font-medium">
                            {studentData?.photo_url ? 'Changer photo' : 'Charger photo'}
                          </div>
                        </div>
                      )}
                    </Upload>
                  </div>
                  <p className="text-xs text-gray-500 text-center">
                    Format: JPG, PNG
                    <br />
                    Taille max: 2MB
                    <br />
                    {isProfileComplete && (
                      <Tag color="blue" className="mt-1">
                        Toujours modifiable
                      </Tag>
                    )}
                  </p>
                </div>
              </Col>

              {/* Formulaire principal */}
              <Col xs={24} lg={18}>
                <Row gutter={[16, 8]}>
                  
                  <Col xs={24}>
                    <Form.Item
                      label="Établissement d'origine"
                      name="etablissement_origine"
                      rules={[{ required: true, message: 'Veuillez saisir votre établissement d\'origine' }]}
                    >
                      <Input 
                        size="large" 
                        placeholder="Ex: Lycée Moderne..." 
                        suffix={isProfileComplete ? <LockOutlined /> : null}
                      />
                    </Form.Item>
                  </Col>

                  <Col xs={24} md={12}>
                    <Form.Item
                      label="Date de naissance"
                      name="date_naissance"
                      rules={[{ required: true, message: 'Veuillez sélectionner votre date de naissance' }]}
                    >
                      <DatePicker 
                        className="w-full" 
                        format="DD/MM/YYYY"
                        size="large"
                        placeholder="Sélectionnez la date"
                        disabled={isProfileComplete}
                      />
                    </Form.Item>
                  </Col>

                  <Col xs={24} md={12}>
                    <Form.Item
                      label="Lieu de naissance"
                      name="lieu_naissance"
                      rules={[{ required: true, message: 'Veuillez saisir votre lieu de naissance' }]}
                    >
                      <Input 
                        size="large" 
                        placeholder="Ex: Abidjan, Cocody..." 
                        suffix={isProfileComplete ? <LockOutlined /> : null}
                      />
                    </Form.Item>
                  </Col>

                  <Col xs={24} md={8}>
                    <Form.Item
                      label="Matricule MERS"
                      name="matricule_mers"
                      rules={[{ required: true, message: 'Requis' }]}
                      extra="Format attendu : 183456789F"
                    >
                      <Input 
                        size="large" 
                        placeholder="Ex: 183456789F" 
                        suffix={isProfileComplete ? <LockOutlined /> : null}
                      />
                    </Form.Item>
                  </Col>

                  <Col xs={24} md={8}>
                    <Form.Item
                      label="Matricule MENET"
                      name="matricule_menet"
                      rules={[{ required: true, message: 'Requis' }]}
                      extra="Format attendu : COUA0906070001"
                    >
                      <Input 
                        size="large" 
                        placeholder="Ex: COUA0906070001" 
                        suffix={isProfileComplete ? <LockOutlined /> : null}
                      />
                    </Form.Item>
                  </Col>

                  <Col xs={24} md={8}>
                    <Form.Item
                      label="Numéro de table BAC"
                      name="numero_table_bac"
                      rules={[{ required: true, message: 'Requis' }]}
                      extra="Numéro figurant sur votre collante du BAC"
                    >
                      <Input 
                        size="large" 
                        placeholder="Ex : 00000" 
                        suffix={isProfileComplete ? <LockOutlined /> : null}
                      />
                    </Form.Item>
                  </Col>

                  <Col xs={24} md={8}>
                    <Form.Item
                      label="Sexe"
                      name="sexe"
                      rules={[{ required: true, message: 'Veuillez sélectionner votre sexe' }]}
                    >
                      <Select 
                        size="large" 
                        placeholder="Sélectionnez"
                        disabled={isProfileComplete}
                      >
                        <Select.Option value="Masculin">Masculin</Select.Option>
                        <Select.Option value="Féminin">Féminin</Select.Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  
                  <Col xs={24} md={8}>
                    <Form.Item
                      label="Série BAC"
                      name="serie_bac"
                      rules={[{ required: true, message: 'Veuillez saisir votre série BAC' }]}
                    >
                      <Input 
                        size="large" 
                        placeholder="Ex: G2, D, C..." 
                        suffix={isProfileComplete ? <LockOutlined /> : null}
                      />
                    </Form.Item>
                  </Col>

                  <Col xs={24} md={8}>
                    <Form.Item
                      label="Année du BAC"
                      name="annee_bac"
                      rules={[{ required: true, message: 'Veuillez saisir l\'année du BAC' }]}
                      extra="Ex: 2023, 2024..."
                    >
                      <Input 
                        size="large" 
                        placeholder="Ex: 2024" 
                        suffix={isProfileComplete ? <LockOutlined /> : null}
                      />
                    </Form.Item>
                  </Col>

                  <Col xs={24} md={12}>
                    <Form.Item
                      label="Lieu de résidence"
                      name="lieu_residence"
                      rules={[{ required: true, message: 'Veuillez saisir votre lieu de résidence' }]}
                    >
                      <Input 
                        size="large" 
                        placeholder="Ex: Abidjan, Cocody..." 
                        suffix={isProfileComplete ? <LockOutlined /> : null}
                      />
                    </Form.Item>
                  </Col>

                  <Col xs={24} md={12}>
                    <Form.Item
                      label="Pays de naissance"
                      name="pays_naissance"
                      rules={[{ required: true, message: 'Veuillez saisir votre pays de naissance' }]}
                    >
                      <Input 
                        size="large" 
                        placeholder="Ex: Côte d'Ivoire" 
                        suffix={isProfileComplete ? <LockOutlined /> : null}
                      />
                    </Form.Item>
                  </Col>

                </Row>

                {/* Bouton de soumission - TOUJOURS VISIBLE POUR LA PHOTO */}
                <div className="flex justify-end mt-6">
                  <Button 
                    type="primary" 
                    icon={<SaveOutlined />}
                    loading={saving}
                    onClick={() => form.submit()}
                    size="large"
                    className="min-w-48 h-12 text-base font-medium"
                  >
                    {isProfileComplete ? 'Mettre à jour la photo' : 'Enregistrer les modifications'}
                  </Button>
                </div>
              </Col>
            </Row>
          </Form>
        </Card>

        {/* Section Informations complètes de l'étudiant */}
        {studentData && (
          <Card 
            title={
              <div className="flex items-center">
                <UserOutlined className="mr-1 text-blue-500" />
                <span>Informations Complètes de l'Étudiant</span>
              </div>
            } 
            className="w-full shadow-md border-0"
          >
            <Row gutter={[24, 16]}>
              <Col xs={24} lg={12}>
                <Descriptions column={1} bordered size="small" className="custom-descriptions">
                  <Descriptions.Item label="Nom et Prénoms" labelStyle={{ fontWeight: 'bold', width: '40%' }}>
                    {studentData.prenoms} {studentData.nom}
                  </Descriptions.Item>
                  <Descriptions.Item label="Email" labelStyle={{ fontWeight: 'bold' }}>
                    <MailOutlined className="mr-2" />
                    {studentData.email}
                  </Descriptions.Item>
                  <Descriptions.Item label="Téléphone" labelStyle={{ fontWeight: 'bold' }}>
                    <PhoneOutlined className="mr-2" />
                    {studentData.telephone || 'Non renseigné'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Contact Parent" labelStyle={{ fontWeight: 'bold' }}>
                    <PhoneOutlined className="mr-2" />
                    {studentData.contact_parent || 'Non renseigné'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Contact Parent 2" labelStyle={{ fontWeight: 'bold' }}>
                    <PhoneOutlined className="mr-2" />
                    {studentData.contact_parent_2 || 'Non renseigné'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Lieu de Résidence" labelStyle={{ fontWeight: 'bold' }}>
                    <HomeOutlined className="mr-2" />
                    {studentData.lieu_residence || 'Non renseigné'}
                  </Descriptions.Item>
                </Descriptions>
              </Col>

              <Col xs={24} lg={12}>
                <Descriptions column={1} bordered size="small">
                  <Descriptions.Item label="Matricule IIPEA" labelStyle={{ fontWeight: 'bold', width: '40%' }}>
                    <IdcardOutlined className="mr-2" />
                    {studentData.matricule || 'Non attribué'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Code Unique" labelStyle={{ fontWeight: 'bold' }}>
                    <IdcardOutlined className="mr-2" />
                    {studentData.code_unique || 'Non attribué'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Nationalité" labelStyle={{ fontWeight: 'bold' }}>
                    {studentData.nationalite || 'Non renseignée'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Date de Naissance" labelStyle={{ fontWeight: 'bold' }}>
                    <CalendarOutlined className="mr-2" />
                    {studentData.date_naissance ? dayjs(studentData.date_naissance).format('DD/MM/YYYY') : 'Non renseignée'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Sexe" labelStyle={{ fontWeight: 'bold' }}>
                    {studentData.sexe || 'Non renseigné'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Série BAC" labelStyle={{ fontWeight: 'bold' }}>
                    {studentData.serie_bac || 'Non renseignée'}
                  </Descriptions.Item>
                </Descriptions>
              </Col>
            </Row>

            <Divider />

            <Row gutter={[24, 16]}>
              <Col xs={24} lg={12}>
                <Descriptions column={1} bordered size="small">
                  <Descriptions.Item label="Établissement d'Origine" labelStyle={{ fontWeight: 'bold', width: '40%' }}>
                    {studentData.etablissement_origine || 'Non renseigné'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Lieu de Naissance" labelStyle={{ fontWeight: 'bold' }}>
                    {studentData.lieu_naissance || 'Non renseigné'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Pays de Naissance" labelStyle={{ fontWeight: 'bold' }}>
                    {studentData.pays_naissance || 'Non renseigné'}
                  </Descriptions.Item>
                </Descriptions>
              </Col>

              <Col xs={24} lg={12}>
                <Descriptions column={1} bordered size="small">
                  <Descriptions.Item label="Matricule MERS" labelStyle={{ fontWeight: 'bold', width: '40%' }}>
                    {studentData.matricule || 'Non renseigné'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Matricule MENET" labelStyle={{ fontWeight: 'bold' }}>
                    {studentData.ip_ministere || 'Non renseigné'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Numéro Table BAC" labelStyle={{ fontWeight: 'bold' }}>
                    {studentData.numero_table || 'Non renseigné'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Année BAC" labelStyle={{ fontWeight: 'bold' }}>
                    {studentData.annee_bac || 'Non renseigné'}
                  </Descriptions.Item>
                </Descriptions>
              </Col>
            </Row>
          </Card>
        )}

        {/* Modal de consultation en lecture seule */}
        <Modal
          title="Mes Informations (Lecture Seule)"
          open={showReadOnlyModal}
          onCancel={() => setShowReadOnlyModal(false)}
          footer={[
            <Button key="close" onClick={() => setShowReadOnlyModal(false)}>
              Fermer
            </Button>,
            <Button 
              key="photo" 
              type="primary" 
              icon={<CameraOutlined />}
              onClick={() => {
                setShowReadOnlyModal(false);
                // Focus sur l'upload de photo
                setTimeout(() => {
                  const uploadElement = document.querySelector('.ant-upload-select');
                  if (uploadElement) {
                    uploadElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }
                }, 100);
              }}
            >
              Modifier ma photo
            </Button>
          ]}
          width={800}
        >
          <div className="p-4">
            <Alert
              message="Profil Verrouillé"
              description="Votre profil est complet. Seule la photo peut être modifiée."
              type="info"
              showIcon
              className="mb-4"
            />
            
            <Form
              form={form}
              layout="vertical"
              disabled={true}
            >
              <Row gutter={[16, 8]}>
                <Col span={12}>
                  <Form.Item label="Établissement d'origine" name="etablissement_origine">
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="Date de naissance" name="date_naissance">
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="Lieu de naissance" name="lieu_naissance">
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="Pays de naissance" name="pays_naissance">
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label="Matricule MERS" name="matricule_mers">
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label="Matricule MENET" name="matricule_menet">
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label="Numéro table BAC" name="numero_table_bac">
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label="Sexe" name="sexe">
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label="Série BAC" name="serie_bac">
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label="Année BAC" name="annee_bac">
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={24}>
                  <Form.Item label="Lieu de résidence" name="lieu_residence">
                    <Input />
                  </Form.Item>
                </Col>
              </Row>
            </Form>
          </div>
        </Modal>
      </div>
    </div>
  );
};

export default MiseAJourProfil;