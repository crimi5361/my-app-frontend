/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import { 
  Form, 
  Select, 
  Button, 
  Card, 
  Row, 
  Col,
  Descriptions,
  Checkbox,
  Divider,
  message,
  Input,
  Typography,
  Avatar,
  Space,
  Spin,
  Upload,
  Modal
} from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;

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
  filiere_id: number;
}

interface Parcours {
  id: number;
  type_parcours: string;
}

interface DocumentRequirement {
  nom: string;
  fourni: boolean;
}

export interface InitialValues {
  nom: string;
  prenoms: string;
  sexe: string;
  matricule: string;
  statut_scolaire: string;
  date_naissance?: dayjs.Dayjs;
  lieu_naissance: string;
  pays_naissance: string;
  telephone: string;
  contact_parent: string;
  contact_parent_2: string;
  nom_parent_1: string;
  nom_parent_2: string;
  numero_table: string;
  lieu_residence: string;
  annee_bac: string;
  serie_bac: string;
  etablissement_origine: string;
  annee_academique_id: string;
  nationalite: string;
  photo_url?: string;
}

interface ResumeFinalisationProps {
  initialValues: InitialValues;
  onPrev: () => void;
  fileList: File[];
  onSuccess: () => void;
}

const ResumeFinalisation: React.FC<ResumeFinalisationProps> = ({ 
  initialValues, 
  onPrev, 
  fileList,
  onSuccess 
}) => {
  const [form] = Form.useForm();
  const [filieres, setFilieres] = useState<Filiere[]>([]);
  const [niveaux, setNiveaux] = useState<Niveau[]>([]);
  const [parcours, setParcours] = useState<Parcours[]>([]);
  const [montant, setMontant] = useState<number>(0);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [documents, setDocuments] = useState<DocumentRequirement[]>([
    { nom: 'EXTRAIT DE NAISSANCE', fourni: false },
    { nom: "JUSTIFICATIF D'IDENTITÉ", fourni: false },
    { nom: 'FICHE D\'ORIENTATION', fourni: false },
    { nom: 'COPIES LÉGALISÉES DU BAC', fourni: false }
  ]);
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [generatedMatricule, setGeneratedMatricule] = useState('');
  const [admissionData, setAdmissionData] = useState<any>(null);
  const [showIpMinistere, setShowIpMinistere] = useState(false);
  const [selectedNiveau, setSelectedNiveau] = useState<string>('');

  const API_URL = import.meta.env.VITE_API_URL_SERVER || "";

  // Niveaux éligibles pour la réduction "Affecté par l'État"
  const NIVEAUX_REDUCTION = ['LICENCE 1', 'LICENCE 2', 'LICENCE 3', 'BTS 1', 'BTS 2'];
  
  // Niveaux qui nécessitent le numéro IP du ministère
  const NIVEAUX_IP_MINISTERE = ['BTS 1', 'LICENCE 1 PRO', 'LICENCE 1'];

  useEffect(() => {
    if (fileList.length > 0) {
      setPhotoFile(fileList[0]);
    }
    fetchFilieres();
    fetchParcours();
    checkIpMinistereField();
  }, [fileList, initialValues.annee_bac]);

 const fetchFilieres = async () => {
  setLoading(true);
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/api/filieres`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    if (!response.ok) throw new Error('Erreur lors de la récupération des filières');
    const data: Filiere[] = await response.json();
    setFilieres(data);
  } catch (error) {
    message.error('Erreur lors du chargement des filières');
    console.error(error);
  } finally {
    setLoading(false);
  }
};

  const fetchNiveauxByFiliere = async (filiereId: number) => {
    try {
      const response = await fetch(`${API_URL}/api/niveaux/${filiereId}`);
      if (!response.ok) throw new Error('Erreur lors de la récupération des niveaux');
      const data: Niveau[] = await response.json();
      setNiveaux(data);
    } catch (error) {
      message.error('Erreur lors du chargement des niveaux');
      console.error(error);
    }
  };

  const fetchParcours = async () => {
    try {
      const response = await fetch(`${API_URL}/api/curcus`);
      if (!response.ok) throw new Error('Erreur lors de la récupération des parcours');
      const data: Parcours[] = await response.json();
      setParcours(data);
    } catch (error) {
      message.error('Erreur lors du chargement des parcours');
      console.error(error);
    }
  };

  const checkIpMinistereField = () => {
    const currentYear = new Date().getFullYear();
    const anneeBac = parseInt(initialValues.annee_bac);
    
    // Vérifier si l'année du bac est l'année en cours et si le niveau sélectionné est éligible
    const isBacCurrentYear = anneeBac === currentYear;
    const isNiveauEligible = NIVEAUX_IP_MINISTERE.includes(selectedNiveau.toUpperCase());
    
    setShowIpMinistere(isBacCurrentYear && isNiveauEligible);
  };

  const handleFiliereChange = async (filiereId: number) => {
    form.setFieldsValue({ niveau_id: undefined, parcours: undefined });
    setMontant(0);
    setSelectedNiveau('');
    setShowIpMinistere(false);
    
    if (!filiereId) {
      setNiveaux([]);
      return;
    }

    await fetchNiveauxByFiliere(filiereId);
  };

  const handleNiveauChange = (niveauId: number) => {
    const niveau = niveaux.find(n => n.id === niveauId);
    if (niveau) {
      const prix = parseFloat(niveau.prix_formation) || 0;
      const niveauLibelle = niveau.libelle.toUpperCase();
      
      setSelectedNiveau(niveauLibelle);
      
      // Vérifier si le champ IP ministère doit être affiché
      const currentYear = new Date().getFullYear();
      const anneeBac = parseInt(initialValues.annee_bac);
      const isBacCurrentYear = anneeBac === currentYear;
      const isNiveauEligible = NIVEAUX_IP_MINISTERE.includes(niveauLibelle);
      
      setShowIpMinistere(isBacCurrentYear && isNiveauEligible);
      
      // Appliquer la réduction uniquement pour les niveaux éligibles
      if (initialValues.statut_scolaire === 'Affecté' && NIVEAUX_REDUCTION.includes(niveauLibelle)) {
        setMontant(150000);
      } else {
        setMontant(prix);
      }
    }
  };

  const handleDocumentChange = (index: number, checked: boolean) => {
    const newDocuments = [...documents];
    newDocuments[index].fourni = checked;
    setDocuments(newDocuments);
  };

  const onFinish = async (values: any) => {
    // Validation du champ IP ministère si requis
    if (showIpMinistere && !values.ip_ministere) {
      message.error('Le numéro IP du ministère est obligatoire pour votre profil');
      return;
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Session expirée, veuillez vous reconnecter');
      }

      const formData = new FormData();

      if (!values.filiere_nom || !values.niveau_id || !values.parcours) {
        throw new Error('Veuillez sélectionner une filière, un niveau et un parcours valides');
      }

      // Préparation des données
      const data = {
        etudiant: {
          ...initialValues,
          nom: initialValues.nom.toUpperCase(),
          prenoms: initialValues.prenoms.toUpperCase(),
          lieu_naissance: initialValues.lieu_naissance.toUpperCase(),
          lieu_residence: initialValues.lieu_residence.toUpperCase(),
          date_naissance: initialValues.date_naissance?.format('YYYY-MM-DD'),
          contact_parent_2: initialValues.contact_parent_2 || '',
          nom_parent_1: initialValues.nom_parent_1.toUpperCase(),
          nom_parent_2: initialValues.nom_parent_2?.toUpperCase() || '',
          pays_naissance: initialValues.pays_naissance
        },
        academique: {
          ...initialValues,
          etablissement_origine: initialValues.etablissement_origine.toUpperCase(),
          statut_scolaire: initialValues.statut_scolaire,
          ip_ministere: values.ip_ministere || null // Ajout du champ IP ministère
        },
        inscription: {
          filiere_id: values.filiere_nom,
          niveau_id: values.niveau_id,
          curcus_id: values.parcours,
          montant_scolarite: montant
        },
        documents: [
          { nom: 'EXTRAIT_DE_NAISSANCE', fourni: documents[0].fourni },
          { nom: 'JUSTIFICATIF_IDENTITE', fourni: documents[1].fourni },
          { nom: 'FICHE_ORIENTATION', fourni: documents[2].fourni },
          { nom: 'COPIES_BAC', fourni: documents[3].fourni }
        ]
      };

      // Construction du FormData
      const appendNested = (prefix: string, obj: any) => {
        Object.entries(obj).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            const fullKey = `${prefix}[${key}]`;
            if (typeof value === 'object' && !(value instanceof File)) {
              appendNested(fullKey, value);
            } else {
              formData.append(fullKey, value.toString());
            }
          }
        });
      };

      appendNested('etudiant', data.etudiant);
      appendNested('academique', data.academique);
      appendNested('inscription', data.inscription);

      data.documents.forEach((doc, index) => {
        formData.append(`documents[${index}][nom]`, doc.nom);
        formData.append(`documents[${index}][fourni]`, doc.fourni.toString());
      });

      if (photoFile) {
        formData.append('photo', photoFile);
      }

      const response = await fetch(`${API_URL}/api/etudiants/inscription`, {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const responseData = await response.json();
      
      if (!response.ok) {
        throw new Error(responseData.message || "Erreur lors de l'enregistrement");
      }

      if (responseData.success) {
        setGeneratedMatricule(responseData.data.matricule_iipea);
        setAdmissionData(responseData.data);
        setSuccessModalVisible(true);
      } else {
        throw new Error(responseData.error || "Erreur lors de l'enregistrement");
      }

    } catch (error: any) {
      message.error(error.message || 'Une erreur est survenue');
      console.error('Erreur:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleModalClose = () => {
    setSuccessModalVisible(false);
    onSuccess();
    window.location.href = '/Etudiant/Nouvelle_Admission';
  };

  return (
    <>
      <Card style={{ margin: '20px auto', maxWidth: '1200px' }}>
        <Spin spinning={loading}>
          <div style={{ display: 'flex', marginBottom: 24 }}>
            {photoFile ? (
              <Avatar 
                size={170} 
                src={URL.createObjectURL(photoFile)} 
                style={{ 
                  border: '2px solid #1890ff',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
                }}
              />
            ) : (
              <Upload
                listType="picture-card"
                showUploadList={false}
                beforeUpload={(file) => {
                  setPhotoFile(file);
                  return false;
                }}
                accept="image/*"
              >
                <div>
                  <UploadOutlined />
                  <div style={{ marginTop: 8 }}>Ajouter photo</div>
                </div>
              </Upload>
            )}
            <div style={{ marginLeft: 24, flex: 1 }}>
              <Descriptions column={2}>
                <Descriptions.Item label="Nom">{initialValues.nom}</Descriptions.Item>
                <Descriptions.Item label="Prénom">{initialValues.prenoms}</Descriptions.Item>
                <Descriptions.Item label="Sexe">{initialValues.sexe}</Descriptions.Item>
                <Descriptions.Item label="Matricule">{initialValues.matricule}</Descriptions.Item>
                <Descriptions.Item label="Statut">{initialValues.statut_scolaire}</Descriptions.Item>
                <Descriptions.Item label="Date Naissance">
                  {initialValues.date_naissance?.format('DD/MM/YYYY')}
                </Descriptions.Item>
                <Descriptions.Item label="Lieu Naissance">{initialValues.lieu_naissance}</Descriptions.Item>
                <Descriptions.Item label="Pays Naissance">{initialValues.pays_naissance}</Descriptions.Item>
                <Descriptions.Item label="Téléphone">{initialValues.telephone}</Descriptions.Item>
                <Descriptions.Item label="Contact Parent">{initialValues.contact_parent}</Descriptions.Item>
                <Descriptions.Item label="Contact Parent 2">{initialValues.contact_parent_2 || 'Non renseigné'}</Descriptions.Item>
                <Descriptions.Item label="Nom Parent 1">{initialValues.nom_parent_1}</Descriptions.Item>
                <Descriptions.Item label="Nom Parent 2">{initialValues.nom_parent_2 || 'Non renseigné'}</Descriptions.Item>
                <Descriptions.Item label="Numéro de table">{initialValues.numero_table}</Descriptions.Item>
                <Descriptions.Item label="Lieu de résidence">{initialValues.lieu_residence}</Descriptions.Item>
                <Descriptions.Item label="Nationalité">{initialValues.nationalite}</Descriptions.Item>
                <Descriptions.Item label="Année BAC">{initialValues.annee_bac}</Descriptions.Item>
                <Descriptions.Item label="Série BAC">{initialValues.serie_bac}</Descriptions.Item>
                <Descriptions.Item label="Établissement d'origine">{initialValues.etablissement_origine}</Descriptions.Item>
              </Descriptions>
            </div>
          </div>

          <Divider />

          <Title level={4} style={{ marginBottom: 16 }}>INFORMATIONS SUPPLÉMENTAIRES</Title>
          <Form form={form} layout="vertical" onFinish={onFinish}>
            <Row gutter={16}>
              <Col span={15}>
                <Form.Item
                  name="filiere_nom"
                  label="Filière"
                  rules={[{ required: true, message: 'Sélectionnez une filière' }]}
                >
                  <Select 
                    placeholder="Sélectionnez la filière"
                    onChange={handleFiliereChange}
                    showSearch
                    optionFilterProp="children"
                    filterOption={(input, option) =>
                      (option?.children ?? '').toString().toLowerCase().includes(input.toLowerCase())
                    }
                  >
                    {filieres.map(filiere => (
                      <Option key={`filiere-${filiere.id}`} value={filiere.id}>
                        {filiere.nom} ({filiere.sigle})
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={5}>
                <Form.Item
                  name="niveau_id"
                  label="Niveau"
                  rules={[{ required: true, message: 'Sélectionnez un niveau' }]}
                >
                  <Select 
                    placeholder="Sélectionnez le niveau"
                    onChange={handleNiveauChange}
                    disabled={niveaux.length === 0}
                  >
                    {niveaux.map(niveau => (
                      <Option key={`niveau-${niveau.id}`} value={niveau.id}>
                        {niveau.libelle}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={4}>
                <Form.Item
                  name="parcours"
                  label="Parcours"
                  rules={[{ required: true, message: 'Sélectionnez un parcours' }]}
                >
                  <Select placeholder="Sélectionnez le parcours">
                    {parcours.map((p) => (
                      <Option key={`parcours-${p.id}`} value={p.id}>
                        {p.type_parcours}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            {/* Champ dynamique pour le numéro IP du ministère */}
            {showIpMinistere && (
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="ip_ministere"
                    label="Numéro IP du Ministère"
                    rules={[{ 
                      required: true, 
                      message: 'Le numéro IP du ministère est obligatoire' 
                    }]}
                    help="Numéro d'identification personnel fourni par le ministère"
                  >
                    <Input 
                      placeholder="Ex: ABOY1906070001" 
                      style={{ fontWeight: 'bold' }}
                    />
                  </Form.Item>
                </Col>
              </Row>
            )}

            <Row gutter={16}>
              <Col span={8}>
                <Form.Item label="Montant de la scolarité">
                  <Input 
                    value={montant.toLocaleString('fr-FR') + ' FCFA'} 
                    disabled 
                    style={{ fontWeight: 'bold', color: '#1890ff' }}
                  />
                </Form.Item>
              </Col>
              <Col span={16}>
                {initialValues.statut_scolaire === 'Affecté' && montant === 150000 && (
                  <Text type="secondary">
                    Montant réduit appliqué pour les étudiants affectés
                  </Text>
                )}
              </Col>
            </Row>

            <Divider orientation="left">Documents requis</Divider>
            <Space direction="vertical" style={{ width: '100%' }}>
              {documents.map((doc, index) => (
                <Checkbox 
                  key={`doc-${index}`}
                  checked={doc.fourni}
                  onChange={(e) => handleDocumentChange(index, e.target.checked)}
                >
                  {doc.nom}
                </Checkbox>
              ))}
            </Space>

            <Form.Item style={{ marginTop: 32, textAlign: 'center' }}>
              <Button style={{ marginRight: 16 }} onClick={onPrev}>
                Précédent
              </Button>
              <Button 
                type="primary" 
                htmlType="submit" 
                size="large"
                loading={submitting}
                disabled={submitting}
              >
                Finaliser l'admission
              </Button>
            </Form.Item>
          </Form>
        </Spin>
      </Card>

      {/* Modal de succès */}
      <Modal
        title={<div style={{ textAlign: 'center', fontSize: '20px', fontWeight: 'bold' }}>ADMISSION VALIDÉE</div>}
        open={successModalVisible}
        onCancel={handleModalClose}
        footer={[
          <Button 
            key="ok" 
            type="primary" 
            onClick={handleModalClose}
            style={{ width: '150px', height: '40px', fontSize: '16px' }}
          >
            Fermer
          </Button>
        ]}
        centered
        closable={false}
        width={600}
      >
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <Avatar 
            size={120} 
            src={photoFile ? URL.createObjectURL(photoFile) : undefined}
            style={{ 
              marginBottom: 20,
              border: '3px solid #52c41a',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
            }}
          />
          <Title level={3} style={{ marginBottom: 10, color: '#52c41a' }}>
            {initialValues.nom} {initialValues.prenoms}
          </Title>
          
          <div style={{ 
            background: '#f6ffed',
            padding: '15px',
            borderRadius: '8px',
            margin: '15px 0',
            borderLeft: '4px solid #52c41a'
          }}>
            <Text strong style={{ fontSize: 18, display: 'block' }}>
              Admission enregistrée avec succès
            </Text>
          </div>

          <Divider style={{ margin: '15px 0' }} />

          <div style={{ textAlign: 'left', margin: '0 auto', maxWidth: '400px' }}>
            <div style={{ marginBottom: '12px' }}>
              <Text strong style={{ display: 'inline-block', width: '150px', fontSize: '20px' }}>Matricule IIPEA:</Text>
              <Text style={{ color: '#1890ff', fontWeight: 'bold', fontSize: '20px' }}>
                {generatedMatricule}
              </Text>
            </div>
            
            {admissionData?.email && (
              <div style={{ marginBottom: '12px' }}>
                {/* Email information if needed */}
              </div>
            )}
          </div>

          <div style={{ 
            marginTop: '25px',
            padding: '12px',
            background: '#f0f9ff',
            border: '1px solid #91d5ff',
            borderRadius: '4px'
          }}>
            <Text type="secondary" style={{ fontSize: 14 }}>
              Ce matricule est désormais votre identifiant unique pour toutes vos démarches académiques
            </Text>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default ResumeFinalisation;