/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Card, 
  Form, 
  InputNumber, 
  Button, 
  Typography, 
  Divider,
  Statistic,
  message,
  Spin,
  Col,
  Row,
  Modal,
  Input,
  Select,
  Alert,
  Tabs
} from 'antd';
import { DollarOutlined, ArrowLeftOutlined, CheckCircleFilled, PercentageOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { METHODES_PAIEMENT } from '../../lib/methodesPaiement';
import KitTraitement from '../../Components/KitTraitement/KitTraitement';

const { Title, Text } = Typography;
const { Option } = Select;
const { TabPane } = Tabs;

interface EtudiantData {
  id: string;
  nom: string;
  prenoms: string;
  matricule_iipea: string;
  filiere: string;
  filiere_sigle: string;
  niveau: string;
  montant_scolarite: number;
  scolarite_verse: number;
  scolarite_restante: number;
}

interface PriseEnChargeData {
  id: string;
  type_pec: string;
  pourcentage_reduction: number;
  montant_reduction: number;
  statut: 'en_attente' | 'valide' | 'refuse';
  date_demande: string;
  date_validation?: string;
  valide_par?: string;
  motif_refus?: string;
}

interface PaymentSuccessModalProps {
  visible: boolean;
  onClose: () => void;
  hasPEC: boolean;
  pecStatus?: string;
  isPECOnly?: boolean;
}

const PaymentSuccessModal = ({
  visible,
  onClose,
  hasPEC,
  pecStatus,
  isPECOnly = false
}: PaymentSuccessModalProps) => {
  return (
    <Modal
      title={null}
      visible={visible}
      onOk={onClose}
      onCancel={onClose}
      footer={null}
      closable={false}
      width={500}
      bodyStyle={{ padding: '40px 24px', textAlign: 'center' }}
    >
      <CheckCircleFilled style={{ fontSize: '64px', color: 'var(--success)', marginBottom: '20px' }} />
      
      {isPECOnly ? (
        <Title level={3} style={{ marginBottom: '16px' }}>Demande envoyée avec succès</Title>
      ) : (
        <Title level={3} style={{ marginBottom: '16px' }}>Paiement effectué avec succès</Title>
      )}
      
      {hasPEC && pecStatus === 'en_attente' && (
        <Alert
          message="Demande de prise en charge envoyée"
          description="Votre demande est en attente de validation par l'administration."
          type="warning"
          showIcon
          style={{ marginBottom: '16px' }}
        />
      )}
      
      {hasPEC && pecStatus === 'valide' && (
        <Alert
          message="Réduction appliquée"
          description="Votre prise en charge a été appliquée à votre scolarité."
          type="success"
          showIcon
          style={{ marginBottom: '16px' }}
        />
      )}

      <Text style={{ display: 'block', marginBottom: '24px' }}>
        {isPECOnly 
          ? 'Votre demande de réduction a été enregistrée et sera traitée par l\'administration.' 
          : 'Le paiement a été enregistré et le reçu est disponible.'
        }
      </Text>
      
      <Button 
        type="primary" 
        size="large" 
        onClick={onClose}
        style={{ width: '60%' }}
      >
        {isPECOnly ? 'Fermer' : 'Voir le reçu'}
      </Button>
    </Modal>
  );
};

const EffectuerPaiement = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [pecForm] = Form.useForm();
  const [etudiant, setEtudiant] = useState<EtudiantData | null>(null);
  const [priseEnCharge, setPriseEnCharge] = useState<PriseEnChargeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submittingPEC, setSubmittingPEC] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState('paiement');
  const [isPremierPaiement, setIsPremierPaiement] = useState(false);
  const API_URL = import.meta.env.VITE_API_URL_SERVER || "";

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');

        // ✅ PERF : ces 3 appels sont indépendants (aucun ne dépend du résultat d'un autre) —
        // lancés en parallèle au lieu d'être enchaînés séquentiellement pour ne payer qu'une
        // seule fois la latence réseau. Traitement des réponses inchangé.
        // Chantier Kit étudiant, Phase 1 (2026-08-21) : les appels /api/kit/* sont retirés d'ici —
        // le Kit est désormais géré par le composant KitTraitement, totalement indépendant du
        // paiement de scolarité (plus jamais mêlé à ce formulaire ni à son montant).
        const [etudiantResponse, paiementsResponse, pecResponse] = await Promise.all([
          fetch(`${API_URL}/api/etudiants/etudiant/${id}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }),
          fetch(`${API_URL}/api/paiements/etudiant/${id}/count`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
            }
          }),
          fetch(`${API_URL}/api/priseEnCharge/etudiant/${id}/active`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
            }
          }),
        ]);

        // Fetch student data
        const etudiantData = await etudiantResponse.json();
        if (!etudiantResponse.ok || !etudiantData.success) {
          throw new Error(etudiantData.message || 'Erreur de chargement étudiant');
        }
        setEtudiant(etudiantData.data);

        // Vérifier si c'est le premier paiement
        if (paiementsResponse.ok) {
          const paiementsData = await paiementsResponse.json();
          setIsPremierPaiement(paiementsData.count === 0);
        }

        // Fetch active PEC
        if (pecResponse.ok) {
          const pecData = await pecResponse.json();
          if (pecData.success && pecData.data) {
            setPriseEnCharge(pecData.data);
          }
        }

      } catch (error: unknown) {
        if (error instanceof Error) {
          message.error(`Erreur lors du chargement des données: ${error.message}`);
        } else {
          message.error('Une erreur inconnue est survenue');
        }
        navigate(-1);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, navigate, API_URL]);

  const handleSubmitPaiement = async (values: any) => {
    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      
      const payload = {
        etudiant_id: id,
        montant: values.montant,
        methode: values.methode,
        date_paiement: values.date_paiement,
        demande_pec: values.demande_pec,
        type_pec: values.type_pec,
        pourcentage_reduction: values.pourcentage_reduction,
        reference_pec: values.reference_pec
      };

      const response = await fetch(`${API_URL}/api/paiements`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      
      if (!response.ok) {
        if (data.message.includes('contrainte de vérification')) {
          throw new Error('Le montant payé dépasse le montant total de la scolarité');
        }
        throw new Error(data.message);
      }

      setPaymentSuccess(true);
        
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`Erreur lors de l'enregistrement: ${error.message}`);
      } else {
        message.error('Une erreur inconnue est survenue');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitPECOnly = async (values: any) => {
    setSubmittingPEC(true);
    try {
      const token = localStorage.getItem('token');
      
      const payload = {
        etudiant_id: id,
        type_pec: values.type_pec,
        pourcentage_reduction: values.pourcentage_reduction,
        reference_pec: values.reference_pec
      };

      const response = await fetch(`${API_URL}/api/paiements/demande-pec`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message);
      }

      setPaymentSuccess(true);
      message.success('Demande de réduction envoyée avec succès');
        
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`Erreur lors de l'envoi de la demande: ${error.message}`);
      } else {
        message.error('Une erreur inconnue est survenue');
      }
    } finally {
      setSubmittingPEC(false);
    }
  };

  const handleModalClose = () => {
    setPaymentSuccess(false);
    if (activeTab === 'paiement') {
      navigate(`/Etudiant/Recu_Payement/${id}`);
    } else {
      navigate(-1);
    }
  };

  if (loading) return <Spin size="large" style={{ display: 'flex', justifyContent: 'center', marginTop: '100px' }} />;

  const hasActivePEC = priseEnCharge && priseEnCharge.statut === 'valide';
  const hasPendingPEC = priseEnCharge && priseEnCharge.statut === 'en_attente';

  // Calcul du montant total payé (scolarité versée + réduction si PEC active)
  const montantTotalVerse = hasActivePEC 
    ? (etudiant?.scolarite_verse || 0) + (priseEnCharge?.montant_reduction || 0)
    : etudiant?.scolarite_verse || 0;

  // CORRECTION ICI : Calcul du reste à payer qui prend en compte la réduction
  const montantRestantAvecReduction = hasActivePEC 
    ? (etudiant?.scolarite_restante || 0) - (priseEnCharge?.montant_reduction || 0)
    : etudiant?.scolarite_restante || 0;

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '20px' }}>
      <Button 
        type="text" 
        icon={<ArrowLeftOutlined />} 
        onClick={() => navigate(-1)}
        style={{ marginBottom: '20px' }}
      >
        Retour
      </Button>

      <Card>
        <Title level={3} style={{ marginBottom: '24px' }}>Gestion financière</Title>
        
        <Divider orientation="left">Informations étudiant</Divider>
        {etudiant && (
          <div style={{ marginBottom: '24px' }}>
            <Text strong>Nom: </Text>
            <Text>{etudiant.nom} {etudiant.prenoms}</Text><br />
            <Text strong>Matricule: </Text>
            <Text>{etudiant.matricule_iipea}</Text><br />
            <Text strong>Filière: </Text>
            <Text>{etudiant.filiere} ({etudiant.filiere_sigle}) - {etudiant.niveau}</Text>
          </div>
        )}

        <Divider orientation="left">Informations financières</Divider>
        <Row gutter={16} style={{ marginBottom: '24px' }}>
          <Col span={8}>
            <Statistic
              title="Scolarité totale"
              value={etudiant?.montant_scolarite || 0}
              prefix="FCFA"
              valueStyle={{ color: 'var(--mod-scolarite)' }}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title="Total payé"
              value={montantTotalVerse}
              prefix="FCFA"
              valueStyle={{ color: 'var(--success)' }}
            />
            {hasActivePEC && (
              <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-soft)' }}>
                (dont {priseEnCharge.montant_reduction.toLocaleString()} FCFA de réduction)
              </div>
            )}
          </Col>
          <Col span={8}>
            <Statistic
              title="Reste à payer"
              value={montantRestantAvecReduction}
              prefix="FCFA"
              valueStyle={{
                color: montantRestantAvecReduction > 0 ? 'var(--danger)' : 'var(--success)'
              }}
            />
            {hasActivePEC && (
              <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-soft)' }}>
                (après déduction de la réduction)
              </div>
            )}
          </Col>
        </Row>

        {hasActivePEC && (
          <Alert
            message="Prise en charge active"
            description={`Réduction de ${priseEnCharge.pourcentage_reduction}% appliquée (${priseEnCharge.montant_reduction.toLocaleString()} FCFA)`}
            type="success"
            showIcon
            style={{ marginBottom: '16px' }}
          />
        )}

        {hasPendingPEC && (
          <Alert
            message="Demande en attente"
            description="Votre demande de prise en charge est en cours de traitement par l'administration"
            type="warning"
            showIcon
            style={{ marginBottom: '16px' }}
          />
        )}

        {/* Chantier Kit étudiant, Phase 1 (2026-08-21) : totalement indépendant du paiement de
            scolarité ci-dessous — sa propre section, son propre appel, jamais mêlé au montant
            payé ici. Se masque elle-même si l'étudiant n'est pas concerné ou si suspendu. */}
        {etudiant && <KitTraitement etudiantId={Number(id)} />}

        <Divider />

        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane tab="Effectuer un paiement" key="paiement">
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmitPaiement}
              initialValues={{
                date_paiement: dayjs(),
                demande_pec: false,
                montant: isPremierPaiement ? 0 : 0,
                methode: 'especes'
              }}
            >
              {!hasActivePEC && !hasPendingPEC && (
                <Form.Item
                  name="demande_pec"
                  valuePropName="checked"
                  style={{ marginBottom: '16px' }}
                >
                  {/* <Checkbox>
                    Inclure une demande de prise en charge
                  </Checkbox> */}
                </Form.Item>
              )}

              {form.getFieldValue('demande_pec') && (
                <Card size="small" style={{ marginBottom: '16px', backgroundColor: 'var(--paper)' }}>
                  <Title level={5}>Demande de prise en charge</Title>
                  
                  <Form.Item
                    name="type_pec"
                    label="Type de prise en charge"
                    rules={[{ required: true, message: 'Veuillez sélectionner le type' }]}
                  >
                    <Select placeholder="Sélectionner le type">
                      <Option value="bourse">Bourse</Option>
                      <Option value="entreprise">Entreprise</Option>
                      <Option value="organisation">Organisation</Option>
                      <Option value="autre">Autre</Option>
                    </Select>
                  </Form.Item>

                  <Form.Item
                    name="pourcentage_reduction"
                    label="Pourcentage de réduction"
                    rules={[
                      { required: true, message: 'Veuillez entrer le pourcentage' },
                      { type: 'number', min: 1, max: 100, message: 'Entre 1% et 100%' }
                    ]}
                  >
                    <InputNumber
                      min={1}
                      max={100}
                      formatter={(value) => `${value}%`}
                      parser={(value) => value?.replace('%', '') as any}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>

                  <Form.Item
                    name="reference_pec"
                    label="Référence du document"
                  >
                    <Input placeholder="N° de référence ou description" />
                  </Form.Item>
                </Card>
              )}

              <Text strong style={{ display: 'block', marginBottom: '8px' }}>
                {isPremierPaiement 
                  ? 'Le versement initial de la scolarité est de 150 000 F' 
                  : 'Montant du paiement'}
              </Text>

              <Form.Item
                name="montant"
                label="Montant payé"
                rules={[
                  { required: true, message: 'Veuillez entrer le montant' },
                  { type: 'number', min: 0, message: 'Le montant doit être supérieur à 0' }
                ]}
              >
                <InputNumber<number> 
                  style={{ width: '100%' }}
                  min={0}
                  step={1000}
                  formatter={(value) =>
                    `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
                  }
                  parser={(value) =>
                    parseFloat(value?.replace(/\s/g, '') || '0')
                  }
                />
              </Form.Item>

              <Form.Item
                name="methode"
                label="Méthode de paiement"
                rules={[{ required: true, message: 'Veuillez sélectionner la méthode' }]}
              >
                <Select placeholder="Sélectionner la méthode">
                  {METHODES_PAIEMENT.map(m => <Option key={m.value} value={m.value}>{m.label}</Option>)}
                </Select>
              </Form.Item>

              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={submitting}
                  icon={<DollarOutlined />}
                  size="large"
                  style={{ width: '100%' }}
                >
                  Enregistrer le paiement
                </Button>
              </Form.Item>
            </Form>
          </TabPane>

          <TabPane tab="Demander une réduction" key="reduction">
            <Form
              form={pecForm}
              layout="vertical"
              onFinish={handleSubmitPECOnly}
              initialValues={{
                type_pec: 'bourse',
                pourcentage_reduction: 0
              }}
            >
              <Alert
                message="Demande de réduction uniquement"
                description="Cette option vous permet de soumettre une demande de réduction sans effectuer de paiement. L'administration traitera votre demande et appliquera la réduction une fois validée."
                type="info"
                showIcon
                style={{ marginBottom: '16px' }}
              />

              <Form.Item
                name="type_pec"
                label="Type de prise en charge"
                rules={[{ required: true, message: 'Veuillez sélectionner le type' }]}
              >
                <Select placeholder="Sélectionner le type">
                  <Option value="bourse">Bourse</Option>
                  <Option value="entreprise">Entreprise</Option>
                  <Option value="organisation">Organisation</Option>
                  <Option value="autre">Autre</Option>
                </Select>
              </Form.Item>

              <Form.Item
                name="pourcentage_reduction"
                label="Pourcentage de réduction demandé"
                rules={[
                  { required: true, message: 'Veuillez entrer le pourcentage' },
                  { type: 'number', min: 1, max: 99, message: 'Entre 1% et 99%' }
                ]}
              >
                <InputNumber
                  min={1}
                  max={99}
                  formatter={(value) => `${value}%`}
                  parser={(value) => value?.replace('%', '') as any}
                  style={{ width: '100%' }}
                />
              </Form.Item>

              <Form.Item
                name="reference_pec"
                label="Référence du document"
                rules={[{ required: true, message: 'Veuillez fournir une référence' }]}
              >
                <Input placeholder="N° de référence ou description du document justificatif" />
              </Form.Item>

              <Form.Item>
                <Button 
                  type="primary" 
                  htmlType="submit" 
                  loading={submittingPEC}
                  icon={<PercentageOutlined />}
                  size="large"
                  style={{ width: '100%', backgroundColor: 'var(--mod-comptabilite)' }}
                >
                  Envoyer la demande de réduction
                </Button>
              </Form.Item>
            </Form>
          </TabPane>
        </Tabs>
      </Card>

      <PaymentSuccessModal
        visible={paymentSuccess}
        onClose={handleModalClose}
        hasPEC={form.getFieldValue('demande_pec') || activeTab === 'reduction'}
        pecStatus={priseEnCharge?.statut}
        isPECOnly={activeTab === 'reduction'}
      />
    </div>
  );
};

export default EffectuerPaiement;