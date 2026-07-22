/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Input, Button, Card, Descriptions, Alert, Row, Col, Form, message,
  Spin, Typography, Space, Select, InputNumber, Result, Avatar
} from 'antd';
import { SearchOutlined, CheckCircleOutlined, LockOutlined } from '@ant-design/icons';
import PageHeader from '../../Components/PageHeader/PageHeader';
import { apiFetch, ApiError } from '../../lib/api';

const { Title, Text } = Typography;
const { Option } = Select;

const API_URL = import.meta.env.VITE_API_URL_SERVER || '';

const METHODES_PAIEMENT = ['Espèces', 'Mobile Money', 'Orange Money', 'Wave'];

interface DossierCaisse {
  reinscription_id?: number;
  statut?: string;
  montant_annuel_nouveau: number;
  code_paiement: string;
  nombre_versements_prevu?: number | null;
  modalite_paiement?: string | null;
  etudiant_id: number;
  nom: string;
  prenoms: string;
  matricule_iipea: string;
  photo_url: string | null;
  filiere_nom: string;
  niveau_libelle: string;
  annee: string;
}

interface ValidationResultat {
  etudiant_id: number;
  numero_recu: string;
  scolarite_verse: number;
  scolarite_restante: number;
  statut_etudiant: string;
}

const Encaisser = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [checkingSession, setCheckingSession] = useState(true);
  const [sessionOuverte, setSessionOuverte] = useState(false);
  const [code, setCode] = useState('');
  const [searching, setSearching] = useState(false);
  const [dossier, setDossier] = useState<DossierCaisse | null>(null);
  const [notFoundMessage, setNotFoundMessage] = useState<string | null>(null);
  const [form] = Form.useForm();
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResultat | null>(null);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const data = await apiFetch('/api/caisse/session/active');
        setSessionOuverte(!!data.data);
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return;
      } finally {
        setCheckingSession(false);
      }
    };
    checkSession();
  }, []);

  const handleSearch = useCallback(async (codeOverride?: string) => {
    const codeRecherche = (codeOverride ?? code).trim();
    if (!codeRecherche) {
      message.warning('Saisissez un code de paiement');
      return;
    }
    setSearching(true);
    setDossier(null);
    setNotFoundMessage(null);
    setValidationResult(null);
    try {
      const data = await apiFetch(`/api/caisse/recherche?code=${encodeURIComponent(codeRecherche)}`);
      setDossier(data.data);
      form.setFieldsValue({ montant: data.data.montant_annuel_nouveau, methode: undefined });
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.status === 401) return;
        setNotFoundMessage(e.message);
        return;
      }
      message.error('Erreur lors de la recherche du dossier');
    } finally {
      setSearching(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  useEffect(() => {
    const codeParam = searchParams.get('code');
    if (codeParam && sessionOuverte && !checkingSession) {
      setCode(codeParam);
      handleSearch(codeParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionOuverte, checkingSession]);

  const handleValider = async (values: any) => {
    if (!dossier) return;
    setValidating(true);
    try {
      const result = await apiFetch(`/api/caisse/${dossier.code_paiement}/valider`, {
        method: 'POST',
        body: JSON.stringify({ montant: values.montant, methode: values.methode }),
      });
      message.success(result.message || 'Paiement validé');
      setValidationResult(result.data);
      // Ouverture automatique du reçu : le caissier ne doit pas avoir à le rechercher
      // manuellement — il reste sur cet écran pour enchaîner un nouvel encaissement.
      if (result.data?.etudiant_id) {
        const win = window.open(`/Etudiant/Recu_Payement/${result.data.etudiant_id}`, '_blank');
        if (!win) {
          message.warning('Le navigateur a bloqué l\'ouverture automatique du reçu. Autorisez les popups pour ce site.');
        }
      }
    } catch (e) {
      if (e instanceof ApiError) {
        message.error(e.message);
        return;
      }
      message.error('Erreur lors de la validation du paiement');
    } finally {
      setValidating(false);
    }
  };

  const nouvelleRecherche = () => {
    setCode('');
    setDossier(null);
    setNotFoundMessage(null);
    setValidationResult(null);
    form.resetFields();
  };

  if (checkingSession) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!sessionOuverte) {
    return (
      <div style={{ padding: 24 }}>
        <PageHeader />
        <Card style={{ marginTop: 24 }}>
          <Result
            icon={<LockOutlined />}
            title="Votre caisse n'est pas ouverte"
            subTitle="Vous devez ouvrir votre caisse avant de pouvoir encaisser un paiement."
            extra={
              <Button type="primary" onClick={() => navigate('/caisse/dashboard')}>
                Aller au tableau de bord pour ouvrir la caisse
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <PageHeader />

      <Card title="Encaisser — Code de paiement (inscription ou réinscription)" style={{ marginBottom: 24 }}>
        <Space.Compact style={{ width: '100%', maxWidth: 500 }}>
          <Input
            placeholder="Code de paiement (ex : RI-2026-XXXXX)"
            value={code}
            onChange={e => setCode(e.target.value)}
            onPressEnter={() => handleSearch()}
            disabled={!!dossier}
          />
          {!dossier ? (
            <Button type="primary" icon={<SearchOutlined />} loading={searching} onClick={() => handleSearch()}>
              Rechercher
            </Button>
          ) : (
            <Button onClick={nouvelleRecherche}>Nouvelle recherche</Button>
          )}
        </Space.Compact>

        {notFoundMessage && (
          <Alert style={{ marginTop: 16 }} type="error" showIcon message={notFoundMessage} />
        )}
      </Card>

      {searching && (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin size="large" tip="Recherche du dossier..." />
        </div>
      )}

      {validationResult && (
        <Card>
          <Result
            status="success"
            icon={<CheckCircleOutlined />}
            title="Paiement validé — Réinscription finalisée"
            subTitle={`Reçu N° ${validationResult.numero_recu} — l'étudiant est désormais officiellement inscrit.`}
          >
            <Descriptions column={1} bordered size="small" style={{ maxWidth: 500, margin: '0 auto 24px auto' }}>
              <Descriptions.Item label="Montant versé">{validationResult.scolarite_verse.toLocaleString('fr-FR')} FCFA</Descriptions.Item>
              <Descriptions.Item label="Reste à payer">{validationResult.scolarite_restante.toLocaleString('fr-FR')} FCFA</Descriptions.Item>
              <Descriptions.Item label="Statut scolarité">{validationResult.statut_etudiant}</Descriptions.Item>
            </Descriptions>
            <Space>
              <Button type="primary" onClick={() => navigate(`/Etudiant/Recu_Payement/${validationResult.etudiant_id}`)}>
                Voir / imprimer le reçu
              </Button>
              <Button onClick={nouvelleRecherche}>Nouvelle recherche</Button>
            </Space>
          </Result>
        </Card>
      )}

      {dossier && !validationResult && (
        <Card title="Dossier trouvé">
          <Row gutter={24} style={{ marginBottom: 24 }}>
            <Col span={4} style={{ textAlign: 'center' }}>
              <Avatar size={80} src={dossier.photo_url ? `${API_URL}${dossier.photo_url}` : undefined}>
                {dossier.nom[0]}
              </Avatar>
            </Col>
            <Col span={20}>
              <Descriptions column={3} size="small">
                <Descriptions.Item label="Nom">{dossier.nom}</Descriptions.Item>
                <Descriptions.Item label="Prénoms">{dossier.prenoms}</Descriptions.Item>
                <Descriptions.Item label="Matricule IIPEA">{dossier.matricule_iipea}</Descriptions.Item>
                <Descriptions.Item label="Filière">{dossier.filiere_nom || 'Non spécifié'}</Descriptions.Item>
                <Descriptions.Item label="Niveau">{dossier.niveau_libelle}</Descriptions.Item>
                <Descriptions.Item label="Année académique">{dossier.annee}</Descriptions.Item>
                <Descriptions.Item label="Montant à payer">
                  <Text strong>{Number(dossier.montant_annuel_nouveau).toLocaleString('fr-FR')} FCFA</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Versements prévus">
                  {dossier.modalite_paiement || (dossier.nombre_versements_prevu ? `${dossier.nombre_versements_prevu} versement(s)` : 'Non précisé')}
                </Descriptions.Item>
              </Descriptions>
            </Col>
          </Row>

          <Title level={5}>Enregistrer le paiement</Title>
          <Form form={form} layout="vertical" onFinish={handleValider}>
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item
                  name="montant"
                  label="Montant reçu (FCFA)"
                  rules={[{ required: true, message: 'Montant requis' }]}
                >
                  <InputNumber style={{ width: '100%' }} min={1} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name="methode"
                  label="Méthode de paiement"
                  rules={[{ required: true, message: 'Méthode requise' }]}
                >
                  <Select placeholder="Sélectionnez la méthode">
                    {METHODES_PAIEMENT.map(m => <Option key={m} value={m}>{m}</Option>)}
                  </Select>
                </Form.Item>
              </Col>
            </Row>
            <Form.Item>
              <Button type="primary" htmlType="submit" size="large" loading={validating}>
                Valider le paiement
              </Button>
            </Form.Item>
          </Form>
        </Card>
      )}

      {!dossier && !searching && !notFoundMessage && (
        <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>
          <Title level={5} type="secondary">Saisissez le code de paiement remis à l'étudiant</Title>
          <Text type="secondary">Le dossier correspondant (inscription ou réinscription) s'affichera automatiquement</Text>
        </div>
      )}
    </div>
  );
};

export default Encaisser;
