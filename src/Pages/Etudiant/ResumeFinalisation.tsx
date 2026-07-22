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
  Upload,
  Modal,
  Table
} from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { apiFetch, ApiError } from '../../lib/api';
import AcademicCascadeSelect, { type AcademicSelection } from '../../Components/AcademicCascadeSelect/AcademicCascadeSelect';
import WebcamCapture from '../../Components/WebcamCapture/WebcamCapture';
import { calculerApercuEcheancier, PREMIER_VERSEMENT_FIXE } from '../../lib/echeancier';

const { Title, Text } = Typography;
const { Option } = Select;

interface NiveauInfo {
  id: number;
  libelle: string;
  prix_formation: string;
}

interface Parcours {
  id: number;
  type_parcours: string;
}

interface DocumentRequirement {
  code: string;
  libelle: string;
  obligatoire: boolean;
  fourni: boolean;
}

interface FormationInfo {
  typeFiliereLibelle: string | null;
  niveauLibelle: string | null;
}

type CurcusMode = 'none' | 'auto' | 'choice';

const PIECES_REQUISES: { code: string; libelle: string; obligatoire: boolean }[] = [
  { code: 'DIPLOME_BAC', libelle: 'Diplôme du BAC', obligatoire: true },
  { code: 'EXTRAIT_NAISSANCE', libelle: 'Extrait de naissance', obligatoire: true },
  { code: 'PIECE_IDENTITE', libelle: "Pièce d'identité", obligatoire: true },
  { code: 'PHOTO', libelle: 'Photos', obligatoire: true },
  { code: 'CMU', libelle: 'CMU', obligatoire: false },
  { code: 'FICHE_ORIENTATION', libelle: "Fiche d'orientation", obligatoire: false },
  { code: 'PIECE_IDENTITE_PARENT', libelle: "Pièce d'identité du parent", obligatoire: true },
];

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
  adresse_parent_1: string;
  adresse_parent_2: string;
  numero_table: string;
  lieu_residence: string;
  numero_acte_naissance: string;
  numero_piece_identite: string;
  annee_bac: string;
  serie_bac: string;
  session_bac: string;
  mention_bac: string;
  etablissement_origine: string;
  annee_academique_id: string;
  nationalite: string;
  photo_url?: string;
}

interface ResumeFinalisationProps {
  initialValues: InitialValues;
  onPrev: () => void;
  onSuccess: () => void;
}

const ResumeFinalisation: React.FC<ResumeFinalisationProps> = ({
  initialValues,
  onPrev,
  onSuccess
}) => {
  const [form] = Form.useForm();
  const [academicSelection, setAcademicSelection] = useState<AcademicSelection>({});
  const [parcours, setParcours] = useState<Parcours[]>([]);
  const [montant, setMontant] = useState<number>(0);
  const [statutApplique, setStatutApplique] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [documents, setDocuments] = useState<DocumentRequirement[]>(
    PIECES_REQUISES.map(p => ({ ...p, fourni: false }))
  );
  const [engagementAccepte, setEngagementAccepte] = useState(false);
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [generatedMatricule, setGeneratedMatricule] = useState('');
  const [admissionData, setAdmissionData] = useState<any>(null);
  const [showIpMinistere, setShowIpMinistere] = useState(false);
  const [curcusMode, setCurcusMode] = useState<CurcusMode>('none');
  const [nombreVersements, setNombreVersements] = useState<number>(1);
  const [ficheImprimee, setFicheImprimee] = useState(false);

  const API_URL = import.meta.env.VITE_API_URL_SERVER || "";

  // Niveaux qui nécessitent l'identifiant permanent (ip_ministere)
  const NIVEAUX_IP_MINISTERE = ['BTS 1', 'LICENCE 1 PRO', 'LICENCE 1'];

  const parcoursLabel = (id: number | undefined) => parcours.find(p => p.id === id)?.type_parcours ?? '';

  const echeancier = calculerApercuEcheancier(montant, nombreVersements);

  useEffect(() => {
    fetchParcours();
  }, []);

  const fetchParcours = async () => {
    try {
      const data: Parcours[] = await apiFetch(`/api/curcus`);
      setParcours(data);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return;
      message.error('Erreur lors du chargement des parcours');
      console.error(error);
    }
  };

  const handleNiveauInfo = async (niveau: NiveauInfo | null) => {
    form.setFieldsValue({ ip_ministere: undefined });

    if (!niveau) {
      setMontant(0);
      setStatutApplique(null);
      setShowIpMinistere(false);
      return;
    }

    const niveauLibelle = niveau.libelle.toUpperCase();

    const currentYear = new Date().getFullYear();
    const anneeBac = parseInt(initialValues.annee_bac);
    const isBacCurrentYear = anneeBac === currentYear;
    const isNiveauEligible = NIVEAUX_IP_MINISTERE.includes(niveauLibelle);
    setShowIpMinistere(isBacCurrentYear && isNiveauEligible);

    try {
      const statut = initialValues.statut_scolaire === 'Affecté' ? 'Affecté' : 'Non affecté';
      const res = await apiFetch<{ success: boolean; data: { montant: number | null; statut_applique: string } }>(
        `/api/tarifs/niveau/${niveau.id}?statut=${encodeURIComponent(statut)}`
      );
      setMontant(res.data.montant ?? 0);
      setStatutApplique(res.data.statut_applique);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return;
      message.error('Aucun tarif configuré pour ce niveau. Contactez un administrateur.');
      setMontant(0);
      setStatutApplique(null);
    }
  };

  const handleFormationInfo = (info: FormationInfo) => {
    const { typeFiliereLibelle, niveauLibelle } = info;

    if (!typeFiliereLibelle) {
      setCurcusMode('none');
      form.setFieldsValue({ parcours: undefined });
      return;
    }

    if (typeFiliereLibelle === 'Universitaire') {
      setCurcusMode('auto');
      form.setFieldsValue({ parcours: 1 }); // Universitaire
      return;
    }

    // Professionnelles
    if (niveauLibelle?.toUpperCase().startsWith('BTS')) {
      setCurcusMode('auto');
      form.setFieldsValue({ parcours: 2 }); // Professionnel jour
      return;
    }

    setCurcusMode('choice');
    form.setFieldsValue({ parcours: undefined });
  };

  const handleDocumentChange = (index: number, checked: boolean) => {
    const next = [...documents];
    next[index].fourni = checked;
    setDocuments(next);
  };

  const onFinish = async (values: any) => {
    if (!academicSelection.ecole_id || !academicSelection.departement_id || !academicSelection.filiere_id || !academicSelection.niveau_id) {
      message.error('Veuillez sélectionner école, département, filière et niveau');
      return;
    }
    if (!values.parcours) {
      message.error('Veuillez sélectionner un parcours');
      return;
    }
    if (showIpMinistere && !values.ip_ministere) {
      message.error("L'identifiant permanent est obligatoire pour votre profil");
      return;
    }
    const piecesManquantes = documents.filter(d => d.obligatoire && !d.fourni);
    if (piecesManquantes.length > 0) {
      message.error(`Pièces obligatoires manquantes : ${piecesManquantes.map(d => d.libelle).join(', ')}`);
      return;
    }
    if (!engagementAccepte) {
      message.error("Vous devez certifier l'exactitude des informations pour continuer");
      return;
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Session expirée, veuillez vous reconnecter');
      }

      const formData = new FormData();

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
          adresse_parent_1: initialValues.adresse_parent_1 || '',
          adresse_parent_2: initialValues.adresse_parent_2 || '',
          numero_acte_naissance: initialValues.numero_acte_naissance,
          numero_piece_identite: initialValues.numero_piece_identite,
          pays_naissance: initialValues.pays_naissance
        },
        academique: {
          ...initialValues,
          etablissement_origine: initialValues.etablissement_origine.toUpperCase(),
          statut_scolaire: initialValues.statut_scolaire,
          mention_bac: initialValues.mention_bac,
          session_bac: initialValues.session_bac,
          ip_ministere: values.ip_ministere || null // = identifiant permanent
        },
        inscription: {
          filiere_id: academicSelection.filiere_id,
          niveau_id: academicSelection.niveau_id,
          curcus_id: values.parcours,
          montant_scolarite: montant,
          nombre_versements: nombreVersements,
          modalite_paiement: nombreVersements === 1 ? 'Comptant' : `${nombreVersements} versements`
        }
      };

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

      documents.forEach((doc, index) => {
        formData.append(`documents[${index}][code]`, doc.code);
        formData.append(`documents[${index}][fourni]`, doc.fourni.toString());
      });

      formData.append('engagement_accepte', engagementAccepte.toString());

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
        throw new Error(responseData.message || responseData.error || "Erreur lors de l'enregistrement");
      }

      if (responseData.success) {
        setGeneratedMatricule(responseData.data.matricule_iipea);
        setAdmissionData(responseData.data);
        setFicheImprimee(false);
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
        <>
          <div style={{ display: 'flex', marginBottom: 24 }}>
            <div>
              {photoFile ? (
                <Avatar
                  size={170}
                  src={URL.createObjectURL(photoFile)}
                  style={{
                    border: '2px solid #1890ff',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                    marginBottom: 8
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
              <div>
                <WebcamCapture
                  buttonLabel={photoFile ? 'Reprendre la photo' : 'Prendre une photo'}
                  onCapture={setPhotoFile}
                />
              </div>
            </div>
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
                <Descriptions.Item label="N° acte de naissance">{initialValues.numero_acte_naissance}</Descriptions.Item>
                <Descriptions.Item label="N° pièce d'identité">{initialValues.numero_piece_identite}</Descriptions.Item>
                <Descriptions.Item label="Téléphone">{initialValues.telephone}</Descriptions.Item>
                <Descriptions.Item label="Contact Parent 1 (Père)">{initialValues.contact_parent}</Descriptions.Item>
                <Descriptions.Item label="Contact Parent 2 (Mère)">{initialValues.contact_parent_2 || 'Non renseigné'}</Descriptions.Item>
                <Descriptions.Item label="Nom Parent 1 (Père)">{initialValues.nom_parent_1}</Descriptions.Item>
                <Descriptions.Item label="Adresse Parent 1 (Père)">{initialValues.adresse_parent_1 || 'Non renseignée'}</Descriptions.Item>
                <Descriptions.Item label="Nom Parent 2 (Mère)">{initialValues.nom_parent_2 || 'Non renseigné'}</Descriptions.Item>
                <Descriptions.Item label="Adresse Parent 2 (Mère)">{initialValues.adresse_parent_2 || 'Non renseignée'}</Descriptions.Item>
                <Descriptions.Item label="Numéro de table">{initialValues.numero_table}</Descriptions.Item>
                <Descriptions.Item label="Lieu de résidence">{initialValues.lieu_residence}</Descriptions.Item>
                <Descriptions.Item label="Nationalité">{initialValues.nationalite}</Descriptions.Item>
                <Descriptions.Item label="Année BAC">{initialValues.annee_bac}</Descriptions.Item>
                <Descriptions.Item label="Série BAC">{initialValues.serie_bac}</Descriptions.Item>
                <Descriptions.Item label="Session BAC">{initialValues.session_bac}</Descriptions.Item>
                <Descriptions.Item label="Mention">{initialValues.mention_bac}</Descriptions.Item>
                <Descriptions.Item label="Établissement d'origine">{initialValues.etablissement_origine}</Descriptions.Item>
              </Descriptions>
            </div>
          </div>

          <Divider />

          <Title level={4} style={{ marginBottom: 16 }}>FORMATION DEMANDÉE</Title>
          <Form form={form} layout="vertical" onFinish={onFinish}>
            <AcademicCascadeSelect
              value={academicSelection}
              onChange={setAcademicSelection}
              onNiveauInfo={handleNiveauInfo}
              onFormationInfo={handleFormationInfo}
              showFiliereNiveau
            />

            <Row gutter={16}>
              <Col span={8}>
                <Form.Item
                  name="parcours"
                  label="Parcours"
                  getValueProps={(value) => (curcusMode === 'auto' ? { value: parcoursLabel(value) } : { value })}
                  rules={curcusMode === 'auto' ? [] : [{ required: true, message: 'Sélectionnez un parcours' }]}
                >
                  {curcusMode === 'auto' ? (
                    <Input disabled />
                  ) : (
                    <Select placeholder="Sélectionnez le parcours" disabled={curcusMode === 'none'}>
                      {parcours.filter(p => p.type_parcours !== 'Universitaire').map((p) => (
                        <Option key={`parcours-${p.id}`} value={p.id}>
                          {p.type_parcours}
                        </Option>
                      ))}
                    </Select>
                  )}
                </Form.Item>
              </Col>
            </Row>

            {/* Champ dynamique pour l'identifiant permanent */}
            {showIpMinistere && (
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="ip_ministere"
                    label="Identifiant permanent"
                    rules={[{
                      required: true,
                      message: "L'identifiant permanent est obligatoire"
                    }]}
                    help="Identifiant national fourni par le ministère lors de votre affectation"
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
                {statutApplique && (
                  <Text type="secondary">
                    Tarif appliqué selon le statut « {statutApplique} »
                  </Text>
                )}
              </Col>
            </Row>

            <Divider orientation="left">Modalité de paiement</Divider>
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item label="Nombre de versements">
                  <Select value={nombreVersements} onChange={setNombreVersements}>
                    <Option value={1}>1 fois (comptant)</Option>
                    <Option value={2}>2 fois</Option>
                    <Option value={3}>3 fois</Option>
                    <Option value={4}>4 fois</Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={16}>
                <Text type="secondary">
                  Le premier versement lors de l'inscription est toujours de {PREMIER_VERSEMENT_FIXE.toLocaleString('fr-FR')} FCFA
                  {nombreVersements > 1 ? ', le solde est réparti sur les versements suivants (à titre indicatif).' : '.'}
                </Text>
              </Col>
            </Row>
            {echeancier.length > 0 && (
              <Table
                size="small"
                pagination={false}
                style={{ marginBottom: 16 }}
                dataSource={echeancier.map(l => ({ ...l, key: l.numero }))}
                columns={[
                  { title: 'Versement', dataIndex: 'numero' },
                  { title: 'Montant', dataIndex: 'montant', render: (v: number) => `${v.toLocaleString('fr-FR')} FCFA` },
                  { title: 'Date indicative', dataIndex: 'date' }
                ]}
              />
            )}

            <Divider orientation="left">Pièces justificatives</Divider>
            <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
              Cocher chaque pièce présentée par l'étudiant et vérifiée par l'agent. Aucun scan n'est requis à cette étape.
            </Text>
            <Space direction="vertical" style={{ width: '100%' }}>
              {documents.map((doc, index) => (
                <Row key={`doc-${doc.code}`} align="middle" gutter={12}>
                  <Col span={24}>
                    <Checkbox
                      checked={doc.fourni}
                      onChange={(e) => handleDocumentChange(index, e.target.checked)}
                    >
                      {doc.libelle} {doc.obligatoire && <Text type="danger">*</Text>} — Document présenté et vérifié
                    </Checkbox>
                  </Col>
                </Row>
              ))}
            </Space>

            <Divider orientation="left">Engagement</Divider>
            <Checkbox checked={engagementAccepte} onChange={(e) => setEngagementAccepte(e.target.checked)}>
              Je certifie l'exactitude des informations fournies et j'accepte les conditions d'admission de l'IIPEA.
            </Checkbox>

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
        </>
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
            disabled={!!admissionData?.code_paiement && !ficheImprimee}
            title={!!admissionData?.code_paiement && !ficheImprimee ? "Veuillez d'abord imprimer la fiche récapitulative" : undefined}
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
              Demande d'admission enregistrée — en attente de paiement
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
          </div>

          {admissionData?.code_paiement && (
            <div style={{
              margin: '20px auto',
              padding: '16px',
              border: '2px dashed #1890ff',
              borderRadius: '8px',
              maxWidth: '400px'
            }}>
              <Text>Code de paiement à présenter à la caisse</Text>
              <div style={{ fontSize: 24, fontWeight: 'bold', letterSpacing: 2, color: '#1890ff', margin: '8px 0' }}>
                {admissionData.code_paiement}
              </div>
              <Button
                type={ficheImprimee ? 'default' : 'primary'}
                onClick={() => {
                  const token = localStorage.getItem('token') || '';
                  window.open(`${API_URL}/api/etudiants/${admissionData.id}/fiche?token=${encodeURIComponent(token)}`, '_blank');
                  setFicheImprimee(true);
                }}
              >
                Imprimer la fiche récapitulative
              </Button>
              {!ficheImprimee && (
                <div style={{ marginTop: 8 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    La fenêtre ne peut être fermée qu'après impression de la fiche.
                  </Text>
                </div>
              )}
            </div>
          )}

          <div style={{
            marginTop: '25px',
            padding: '12px',
            background: '#f0f9ff',
            border: '1px solid #91d5ff',
            borderRadius: '4px'
          }}>
            <Text type="secondary" style={{ fontSize: 14 }}>
              L'étudiant doit se présenter à la caisse avec ce code pour finaliser officiellement son inscription.
            </Text>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default ResumeFinalisation;
