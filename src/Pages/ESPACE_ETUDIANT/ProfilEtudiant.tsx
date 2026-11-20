/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Card, 
  Form, 
  Input, 
  Button, 
  DatePicker, 
  Select,
  App,
  Spin,
  Row,
  Col,
  Descriptions,
  Divider,
  Tag,
  Alert,
  Modal,
  Avatar
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
  CheckCircleOutlined,
  UploadOutlined
} from '@ant-design/icons';
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

const MiseAJourProfilContent: React.FC = () => {
  // `message` statique d'antd n'affiche rien sous React 19 : on passe par le
  // contexte <App> (voir l'enveloppe en bas de fichier).
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState<boolean>(true);
  const [studentData, setStudentData] = useState<StudentData | null>(null);
  const [isProfileComplete, setIsProfileComplete] = useState<boolean>(false);
  const [showReadOnlyModal, setShowReadOnlyModal] = useState<boolean>(false);

  // Gestion du verrouillage et de la photo de profil
  const [photosVerrouillees, setPhotosVerrouillees] = useState<boolean>(false);
  const [selectedPhotoFile, setSelectedPhotoFile] = useState<File | null>(null);
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);
  const [savingPhoto, setSavingPhoto] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoCardRef = useRef<HTMLDivElement>(null);

  const API_URL = import.meta.env.VITE_API_URL_SERVER || '';

  const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  const MAX_PHOTO_SIZE = 5 * 1024 * 1024; // 5 Mo = 5 242 880 octets inclus

  // Formater la taille des fichiers
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} Mo`;
  };

  // Nettoyage de l'URL objet en cas de démontage
  useEffect(() => {
    return () => {
      if (previewPhotoUrl) {
        URL.revokeObjectURL(previewPhotoUrl);
      }
    };
  }, [previewPhotoUrl]);

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
      'annee_bac'
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

      // Statut du verrouillage global des photos
      const verrouille = Boolean(data.photos_verrouillees ?? data.securite?.photos_verrouillees ?? false);
      setPhotosVerrouillees(verrouille);
      if (verrouille) {
        handleCancelSelectedPhoto();
      }
      
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
          annee_bac: studentInfo.annee_bac,
          lieu_residence: studentInfo.lieu_residence,
          pays_naissance: studentInfo.pays_naissance
        };

        form.setFieldsValue(formValues);
      }
    } catch (error) {
      message.error('Erreur lors du chargement des données du profil');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Annulation de la sélection en cours
  const handleCancelSelectedPhoto = () => {
    if (previewPhotoUrl) {
      URL.revokeObjectURL(previewPhotoUrl);
    }
    setSelectedPhotoFile(null);
    setPreviewPhotoUrl(null);
  };

  // Vérification périodique légère du statut de verrouillage (actualisation en temps réel sans reconnexion)
  const verifierStatutVerrouillage = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`${API_URL}/api/donneeespaceetudiant/statut-photos`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) return;

      const data = await response.json();
      if (typeof data.photos_verrouillees !== 'boolean') return;
      const estVerrouille = data.photos_verrouillees;

      setPhotosVerrouillees(estVerrouille);
      // Verrouillage survenu pendant une sélection : on l'abandonne. L'URL d'aperçu
      // est révoquée par l'effet de nettoyage lié à `previewPhotoUrl`.
      if (estVerrouille) {
        setSelectedPhotoFile(null);
        setPreviewPhotoUrl(null);
      }
    } catch (_) {
      // Échec silencieux pour le polling périodique en arrière-plan
    }
  }, [API_URL]);

  useEffect(() => {
    // 1. Chargement complet à l'ouverture, au rafraîchissement ou après reconnexion
    fetchStudentData();

    // 2. Vérification périodique légère toutes les 15 secondes, et immédiate au
    //    retour sur l'onglet (cas le plus fréquent : l'étudiant revient sur la page).
    const intervalId = setInterval(verifierStatutVerrouillage, 15000);
    const auRetourSurOnglet = () => {
      if (document.visibilityState === 'visible') verifierStatutVerrouillage();
    };
    document.addEventListener('visibilitychange', auRetourSurOnglet);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', auRetourSurOnglet);
    };
  }, [verifierStatutVerrouillage]);

  // Sélection d'un nouveau fichier photo
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Réinitialiser la valeur de l'input pour permettre de resélectionner le même fichier si besoin
    e.target.value = '';

    if (photosVerrouillees) {
      message.warning("La modification des photos de profil est temporairement suspendue par l'administration.");
      handleCancelSelectedPhoto();
      return;
    }

    if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
      message.error('Format de fichier non accepté. Formats autorisés : JPG, PNG, WebP.');
      return;
    }

    if (file.size > MAX_PHOTO_SIZE) {
      message.error("L'image ne doit pas dépasser 5 Mo !");
      return;
    }

    if (previewPhotoUrl) {
      URL.revokeObjectURL(previewPhotoUrl);
    }

    const objectUrl = URL.createObjectURL(file);
    setSelectedPhotoFile(file);
    setPreviewPhotoUrl(objectUrl);
  };

  // Confirmation et enregistrement définitif de la photo sur le serveur
  const handleConfirmPhotoUpload = async () => {
    if (!selectedPhotoFile) return;

    const token = localStorage.getItem('token');
    const studentId = localStorage.getItem('user_id');

    if (!token || !studentId) {
      message.error('Session expirée, veuillez vous reconnecter');
      return;
    }

    if (photosVerrouillees) {
      message.error("La modification des photos de profil est temporairement suspendue par l'administration.");
      handleCancelSelectedPhoto();
      return;
    }

    setSavingPhoto(true);
    try {
      const formData = new FormData();
      formData.append('photo', selectedPhotoFile);

      const response = await fetch(`${API_URL}/api/donneeespaceetudiant/profile/${studentId}/photo`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 403) {
          setPhotosVerrouillees(true);
          handleCancelSelectedPhoto();
          throw new Error(data.message || "La modification des photos de profil est temporairement suspendue par l'administration.");
        }
        throw new Error(data.message || "Erreur lors de l'enregistrement de la photo");
      }

      message.success('Photo de profil mise à jour avec succès');
      handleCancelSelectedPhoto();
      await fetchStudentData();
    } catch (error: any) {
      message.error(error.message || "Erreur lors de l'enregistrement de la photo");
    } finally {
      setSavingPhoto(false);
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

        {/* Informations officielles : plus modifiables depuis l'espace étudiant
            (Phase 0, 2026-11-11). Dit explicitement, pour qu'une saisie ignorée
            par le serveur ne passe pas pour un enregistrement réussi. */}
        <Alert
          message="Informations officielles"
          description={
            "Votre matricule, votre IP Ministère, votre date et lieu de naissance et vos "
            + "informations de BAC sont désormais gérés par l'administration et ne peuvent "
            + "plus être modifiés depuis cet espace. Pour signaler une erreur, adressez-vous "
            + "à la Scolarité. Votre adresse de résidence et votre photo restent modifiables ici."
          }
          type="info"
          showIcon
          className="mb-6"
        />

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

        {/* Carte dédiée à la gestion de la photo de profil */}
        <div ref={photoCardRef}>
          <Card 
            title={
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center">
                  <CameraOutlined className="text-blue-600 text-lg mr-2" />
                  <span className="font-semibold text-gray-800">Photo de profil</span>
                </div>
                {photosVerrouillees ? (
                  <Tag color="red" icon={<LockOutlined />}>
                    Verrouillée par l'administration
                  </Tag>
                ) : (
                  <Tag color="green" icon={<CheckCircleOutlined />}>
                    Modification autorisée
                  </Tag>
                )}
              </div>
            }
            className="w-full shadow-md border-0 mb-6"
          >
            {/* Input de sélection masqué */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
              onChange={handleFileSelect}
              className="hidden"
              disabled={photosVerrouillees}
            />

            {/* Alerte si modification suspendue */}
            {photosVerrouillees && (
              <Alert
                message="Modification des photos suspendue"
                description="La modification des photos de profil est temporairement suspendue par l'administration."
                type="warning"
                showIcon
                icon={<LockOutlined />}
                className="mb-6"
              />
            )}

            <Row gutter={[24, 24]} align="middle">
              {/* Colonne 1 : Photo actuelle */}
              <Col xs={24} md={(!photosVerrouillees && selectedPhotoFile) ? 8 : 8} className="flex flex-col items-center text-center">
                <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                  Photo actuelle
                </div>
                <div className="relative w-36 h-44 rounded-lg overflow-hidden border-2 border-gray-200 shadow-sm bg-gray-100 flex items-center justify-center">
                  {studentData?.photo_url ? (
                    <img
                      src={`${API_URL}${studentData.photo_url}`}
                      alt="Photo actuelle"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Avatar size={72} icon={<UserOutlined />} className="bg-gray-300" />
                  )}
                </div>
                <span className="text-xs text-gray-500 mt-2">
                  {studentData?.photo_url ? 'Photo enregistrée' : 'Aucune photo enregistrée'}
                </span>
              </Col>

              {/* Colonne 2 : Aperçu nouvelle photo si sélectionnée (uniquement si déverrouillé) */}
              {!photosVerrouillees && selectedPhotoFile && previewPhotoUrl && (
                <Col xs={24} md={8} className="flex flex-col items-center text-center">
                  <div className="text-xs font-semibold uppercase tracking-wider text-blue-600 mb-2">
                    Aperçu avant enregistrement
                  </div>
                  <div className="relative w-36 h-44 rounded-lg overflow-hidden border-2 border-blue-500 shadow-md bg-gray-100 flex items-center justify-center">
                    <img
                      src={previewPhotoUrl}
                      alt="Nouvel aperçu"
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute top-1 right-1 bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                      Nouveau
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-gray-700 font-medium truncate max-w-[200px]" title={selectedPhotoFile.name}>
                    {selectedPhotoFile.name}
                  </div>
                  <div className="text-[11px] text-gray-500">
                    Taille : {formatFileSize(selectedPhotoFile.size)}
                  </div>
                </Col>
              )}

              {/* Colonne 3 : Consignes et Actions */}
              <Col xs={24} md={(!photosVerrouillees && selectedPhotoFile) ? 8 : 16}>
                <div className="space-y-4">
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <h4 className="text-sm font-semibold text-gray-800 mb-2">
                      Consignes pour la photo de profil
                    </h4>
                    <ul className="text-xs text-gray-600 space-y-1.5 list-disc list-inside">
                      <li>Format photo d'identité : cadrage buste / visage de face, fond clair et neutre.</li>
                      <li>Formats de fichier acceptés : <strong>JPG, JPEG, PNG, WebP</strong>.</li>
                      <li>Taille maximale autorisée : <strong>5 Mo</strong>.</li>
                      <li>Cette photo figurera notamment sur votre carte étudiante officielle.</li>
                    </ul>
                  </div>

                  {/* Boutons d'action */}
                  <div className="pt-2">
                    {photosVerrouillees ? (
                      <Button
                        disabled
                        icon={<LockOutlined />}
                        size="large"
                        className="w-full sm:w-auto font-medium"
                      >
                        La modification des photos de profil est temporairement suspendue par l'administration.
                      </Button>
                    ) : !selectedPhotoFile ? (
                      <Button
                        type="primary"
                        icon={<CameraOutlined />}
                        size="large"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full sm:w-auto"
                      >
                        {studentData?.photo_url ? 'Sélectionner une nouvelle photo' : 'Sélectionner une photo'}
                      </Button>
                    ) : (
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Button
                          type="primary"
                          icon={<SaveOutlined />}
                          size="large"
                          loading={savingPhoto}
                          onClick={handleConfirmPhotoUpload}
                          className="bg-blue-600 hover:bg-blue-500 font-medium"
                        >
                          Confirmer l'enregistrement
                        </Button>
                        <Button
                          icon={<UploadOutlined />}
                          size="large"
                          disabled={savingPhoto}
                          onClick={() => fileInputRef.current?.click()}
                        >
                          Remplacer la sélection
                        </Button>
                        <Button
                          danger
                          size="large"
                          disabled={savingPhoto}
                          onClick={handleCancelSelectedPhoto}
                        >
                          Annuler
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </Col>
            </Row>
          </Card>
        </div>

        {/* Formulaire en lecture seule des informations d'état civil et académiques */}
        <Card 
          title={
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center">
                <IdcardOutlined className="text-blue-500 mr-2 text-lg" />
                <span className="font-semibold text-gray-800">Informations Personnelles et Académiques</span>
              </div>
              <Tag color="blue" icon={<LockOutlined />}>
                Lecture Seule
              </Tag>
            </div>
          } 
          className="w-full shadow-md border-0 mb-6"
        >
          <Form
            form={form}
            layout="vertical"
            disabled={true}
          >
            <Row gutter={[16, 8]}>
              <Col xs={24}>
                <Form.Item
                  label="Établissement d'origine"
                  name="etablissement_origine"
                >
                  <Input 
                    size="large" 
                    placeholder="Ex: Lycée Moderne..." 
                    suffix={<LockOutlined />}
                  />
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                <Form.Item
                  label="Date de naissance"
                  name="date_naissance"
                >
                  <DatePicker 
                    className="w-full" 
                    format="DD/MM/YYYY"
                    size="large"
                    placeholder="Date de naissance"
                    disabled={true}
                  />
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                <Form.Item
                  label="Lieu de naissance"
                  name="lieu_naissance"
                >
                  <Input 
                    size="large" 
                    placeholder="Ex: Abidjan, Cocody..." 
                    suffix={<LockOutlined />}
                  />
                </Form.Item>
              </Col>

              <Col xs={24} md={8}>
                <Form.Item
                  label="Matricule MERS"
                  name="matricule_mers"
                  extra="Format attendu : 183456789F"
                >
                  <Input 
                    size="large" 
                    placeholder="Ex: 183456789F" 
                    suffix={<LockOutlined />}
                  />
                </Form.Item>
              </Col>

              <Col xs={24} md={8}>
                <Form.Item
                  label="Matricule MENET"
                  name="matricule_menet"
                  extra="Format attendu : COUA0906070001"
                >
                  <Input 
                    size="large" 
                    placeholder="Ex: COUA0906070001" 
                    suffix={<LockOutlined />}
                  />
                </Form.Item>
              </Col>

              <Col xs={24} md={8}>
                <Form.Item
                  label="Numéro de table BAC"
                  name="numero_table_bac"
                  extra="Numéro figurant sur votre collante du BAC"
                >
                  <Input 
                    size="large" 
                    placeholder="Ex : 00000" 
                    suffix={<LockOutlined />}
                  />
                </Form.Item>
              </Col>

              <Col xs={24} md={8}>
                <Form.Item
                  label="Sexe"
                  name="sexe"
                >
                  <Select 
                    size="large" 
                    placeholder="Sélectionnez"
                    disabled={true}
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
                >
                  <Input 
                    size="large" 
                    placeholder="Ex: G2, D, C..." 
                    suffix={<LockOutlined />}
                  />
                </Form.Item>
              </Col>

              <Col xs={24} md={8}>
                <Form.Item
                  label="Année du BAC"
                  name="annee_bac"
                  extra="Ex: 2023, 2024..."
                >
                  <Input 
                    size="large" 
                    placeholder="Ex: 2024" 
                    suffix={<LockOutlined />}
                  />
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                <Form.Item
                  label="Lieu de résidence"
                  name="lieu_residence"
                >
                  <Input 
                    size="large" 
                    placeholder="Ex: Abidjan, Cocody..." 
                    suffix={<LockOutlined />}
                  />
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                <Form.Item
                  label="Pays de naissance"
                  name="pays_naissance"
                >
                  <Input 
                    size="large" 
                    placeholder="Ex: Côte d'Ivoire" 
                    suffix={<LockOutlined />}
                  />
                </Form.Item>
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
              disabled={photosVerrouillees}
              onClick={() => {
                setShowReadOnlyModal(false);
                setTimeout(() => {
                  if (photoCardRef.current) {
                    photoCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }
                  if (!photosVerrouillees && fileInputRef.current) {
                    fileInputRef.current.click();
                  }
                }, 200);
              }}
            >
              {photosVerrouillees ? 'Modification suspendue' : 'Modifier ma photo'}
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

/* Enveloppe <App> : fournit `message` à App.useApp(). Même convention que
   CartesEtudiantes.tsx, RecusGroupe.tsx et AttestationsMasse.tsx. */
const MiseAJourProfil: React.FC = () => (
  <App>
    <MiseAJourProfilContent />
  </App>
);

export default MiseAJourProfil;