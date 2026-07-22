/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react';
import {
  Form, Input, Select, DatePicker, Button, Card,
  Row, Col, Steps, message, Typography, Spin, Modal, Alert
} from 'antd';
import PageHeader from '../../Components/PageHeader/PageHeader';
import ResumeFinalisation from './ResumeFinalisation';
import type { InitialValues } from './ResumeFinalisation';
import dayjs from 'dayjs';
import { apiFetch, ApiError } from '../../lib/api';

const { Step } = Steps;
const { Option } = Select;
const { Text } = Typography;

interface AnneeAcademique { id: number; annee: string; etat: string; }
interface Pays { id: number; code_iso: string; nom: string; nationalite: string; }
interface Ville { id: number; nom: string; }
interface SerieBac { id: number; nom: string; }
interface AnneeBac { id: number; nom: string; }
interface UserInfo {
  id: number; nom: string; email: string; role: string;
  code: string; userType: string; departementName: string; departement_id: number;
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
  } catch (e) { console.error('Erreur parsing user:', e); return null; }
};

const NouvelleAdmission = () => {
  const [form] = Form.useForm();
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [anneesAcademiques, setAnneesAcademiques] = useState<AnneeAcademique[]>([]);
  const [pays, setPays] = useState<Pays[]>([]);
  const [villes, setVilles] = useState<Ville[]>([]);
  const [seriesBac, setSeriesBac] = useState<SerieBac[]>([]);
  const [anneesBac, setAnneesBac] = useState<AnneeBac[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<UserInfo | null>(null);
  const [currentYearId, setCurrentYearId] = useState<number | null>(null);

  const [formData, setFormData] = useState<InitialValues>({
    nom: '', prenoms: '', sexe: '', matricule: '', statut_scolaire: '',
    date_naissance: undefined, lieu_naissance: '', pays_naissance: '',
    telephone: '', contact_parent: '', contact_parent_2: '',
    nom_parent_1: '', nom_parent_2: '', adresse_parent_1: '', adresse_parent_2: '',
    numero_table: '', lieu_residence: '',
    numero_acte_naissance: '', numero_piece_identite: '',
    annee_bac: '', serie_bac: '', session_bac: '', mention_bac: '', etablissement_origine: '',
    annee_academique_id: '', nationalite: '', photo_url: ''
  });

  const API_URL = import.meta.env.VITE_API_URL_SERVER || "";

  // ── Chargement utilisateur ────────────────────────────────────────────────────
  useEffect(() => {
    const user = getUserInfo();
    if (!user) { message.error('Impossible de récupérer vos informations. Veuillez vous reconnecter.'); return; }
    if (!user.departement_id) { message.error("Aucun département associé à votre compte."); return; }
    setCurrentUser(user);
  }, []);

  // ── Années académiques ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentUser?.departement_id) return;
    (async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');
        if (!token) { message.error('Authentification requise'); return; }

        const res = await fetch(`${API_URL}/api/annees?site_id=${currentUser.departement_id}`, {
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        });
        if (res.status === 401) { message.error('Session expirée'); localStorage.removeItem('token'); return; }
        if (!res.ok) throw new Error(`Erreur ${res.status}`);

        const data = await res.json();
        if (Array.isArray(data)) {
          setAnneesAcademiques(data);
          const cur = data.find((y: AnneeAcademique) =>
            y.etat?.toLowerCase() === 'en cours' || y.etat?.toLowerCase() === 'en cour');
          const target = cur ?? data[0];
          if (target) {
            setCurrentYearId(target.id);
            form.setFieldsValue({ annee_academique_id: target.id.toString() });
            setFormData(p => ({ ...p, annee_academique_id: target.id.toString() }));
            if (!cur) message.warning("Aucune année en cours. Veuillez contacter l'administrateur.");
          } else {
            message.error('Aucune année académique trouvée pour ce département');
          }
        }
      } catch (e) {
        console.error(e);
        message.error('Erreur lors du chargement des années académiques');
      } finally { setLoading(false); }
    })();
  }, [API_URL, currentUser, form]);

  // ── Données de référence ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentUser?.departement_id) return;
    Promise.all([fetchPays(), fetchVilles(), fetchSeriesBac(), fetchAnneesBac()])
      .catch(e => console.error('Erreur chargement données:', e));
  }, [currentUser]);

  // ── Pays & nationalités depuis /api/data/pays ─────────────────────────────────
  const fetchPays = async () => {
    try {
      const data = await apiFetch('/api/data/pays');
      if (!data.success) throw new Error(data.message || 'Erreur inconnue');

      const liste: Pays[] = data.data;

      // Côte d'Ivoire en premier
      const ci = liste.find(p => p.code_iso === 'CI');
      setPays(ci ? [ci, ...liste.filter(p => p.code_iso !== 'CI')] : liste);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return;
      console.error('Erreur chargement pays:', e);
      message.error('Erreur lors du chargement des pays');
    }
  };

  const fetchVilles = async () => {
    try {
      const data = await apiFetch('/api/data/villes');
      if (data.success) setVilles(data.data);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return;
      message.error('Erreur lors du chargement des villes'); console.error(e);
    }
  };

  const fetchSeriesBac = async () => {
    try {
      const data = await apiFetch('/api/data/series-bac');
      if (data.success) setSeriesBac(data.data);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return;
      message.error('Erreur lors du chargement des séries de BAC'); console.error(e);
    }
  };

  const fetchAnneesBac = async () => {
    try {
      const data = await apiFetch('/api/data/annees-bac');
      if (data.success) setAnneesBac(data.data);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return;
      message.error('Erreur lors du chargement des années de BAC'); console.error(e);
    }
  };

  const onFirstStepFinish = async (values: any) => {
    try {
      setSubmitting(true);
      setFormData({
        ...values,
        date_naissance: values.date_naissance ? dayjs(values.date_naissance) : undefined,
      });
      setCurrentStep(1);
    } catch (e) {
      console.error(e);
      message.error('Une erreur est survenue lors de la validation du formulaire');
    } finally { setSubmitting(false); }
  };

  const handleSuccess = () => {
    const reset = () => {
      form.resetFields();
      setCurrentStep(0);
      if (currentYearId) {
        form.setFieldsValue({ annee_academique_id: currentYearId.toString() });
        setFormData({
          nom: '', prenoms: '', sexe: '', matricule: '', statut_scolaire: '',
          date_naissance: undefined, lieu_naissance: '', pays_naissance: '',
          telephone: '', contact_parent: '', contact_parent_2: '',
          nom_parent_1: '', nom_parent_2: '', adresse_parent_1: '', adresse_parent_2: '',
          numero_table: '', lieu_residence: '',
          numero_acte_naissance: '', numero_piece_identite: '',
          annee_bac: '', serie_bac: '', session_bac: '', mention_bac: '', etablissement_origine: '',
          annee_academique_id: currentYearId.toString(), nationalite: '', photo_url: ''
        });
      }
    };
    message.success('Admission enregistrée avec succès!');
    Modal.success({
      title: 'Admission réussie',
      content: 'Voulez-vous enregistrer un nouvel étudiant ?',
      okText: 'Oui', cancelText: 'Non',
      onOk: reset, onCancel: () => {}
    });
  };

  const isYearActive = (etat: string) =>
    etat?.toLowerCase() === 'en cours' || etat?.toLowerCase() === 'en cour';

  const filterOption = (input: string, option: any) =>
    String(option?.children).toLowerCase().includes(input.toLowerCase());

  const steps = [
    {
      title: 'Informations de base',
      content: (
        <Card style={{ margin: '20px auto', maxWidth: '1400px' }}
          title="Informations de l'étudiant" variant="borderless">
          <Spin spinning={loading}>
            {currentUser && (
              <Alert
                message={`Inscription pour le département: ${currentUser.departementName || 'Département ' + currentUser.departement_id}`}
                description={<div><strong>Attention :</strong> Les inscriptions sont possibles uniquement pour l'année académique en cours.</div>}
                type="info" showIcon style={{ marginBottom: 24 }} closable
              />
            )}

            <Form form={form} layout="vertical" onFinish={onFirstStepFinish} autoComplete="off" initialValues={formData}>

              <Text strong style={{ display: 'block', marginBottom: 16 }}>INFORMATIONS PERSONNELLES</Text>

              <Row gutter={24}>
                <Col span={8}>
                  <Form.Item name="nom" label="Nom"
                    rules={[{ required: true, message: 'Veuillez saisir le nom' }, { max: 50, message: 'Max 50 caractères' }]}>
                    <Input placeholder="Nom de famille" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="prenoms" label="Prénoms"
                    rules={[{ required: true, message: 'Veuillez saisir les prénoms' }, { max: 100, message: 'Max 100 caractères' }]}>
                    <Input placeholder="Prénoms complets" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="sexe" label="Sexe"
                    rules={[{ required: true, message: 'Veuillez sélectionner le sexe' }]}>
                    <Select placeholder="Sélectionnez le sexe">
                      <Option value="Masculin">Masculin</Option>
                      <Option value="Féminin">Féminin</Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={24}>
                <Col span={8}>
                  <Form.Item name="date_naissance" label="Date de naissance"
                    rules={[{ required: true, message: 'Veuillez sélectionner la date de naissance' }]}>
                    <DatePicker style={{ width: '100%' }}
                      disabledDate={c => c && c > dayjs().endOf('day')} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="lieu_naissance" label="Lieu de naissance"
                    rules={[{ required: true, message: 'Veuillez saisir le lieu de naissance' }, { max: 100, message: 'Max 100 caractères' }]}>
                    <Input placeholder="Ville" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  {/* Pays de naissance → affiche le nom, stocke le code_iso */}
                  <Form.Item name="pays_naissance" label="Pays de naissance"
                    rules={[{ required: true, message: 'Veuillez sélectionner le pays de naissance' }]}>
                    <Select placeholder="Sélectionnez le pays" showSearch optionFilterProp="children"
                      loading={pays.length === 0} filterOption={filterOption}>
                      {pays.map(p => (
                        <Option key={`pays-${p.code_iso}`} value={p.code_iso}>{p.nom}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={24}>
                <Col span={8}>
                  <Form.Item name="numero_acte_naissance" label="Numéro d'acte de naissance"
                    rules={[{ required: true, message: "Veuillez saisir le numéro d'acte de naissance" }, { max: 50, message: 'Max 50 caractères' }]}>
                    <Input placeholder="Ex: 123/2005" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="numero_piece_identite" label="Numéro de pièce d'identité"
                    rules={[{ required: true, message: "Veuillez saisir le numéro de pièce d'identité" }, { max: 50, message: 'Max 50 caractères' }]}>
                    <Input placeholder="Ex: CI001234567890" />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={24}>
                <Col span={8}>
                  <Form.Item name="lieu_residence" label="Lieu de résidence"
                    rules={[{ required: true, message: 'Veuillez sélectionner le lieu de résidence' }]}>
                    <Select placeholder="Sélectionnez la ville" showSearch optionFilterProp="children"
                      loading={villes.length === 0} filterOption={filterOption}>
                      {villes.map(v => <Option key={v.id} value={v.nom}>{v.nom}</Option>)}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="telephone" label="Téléphone"
                    rules={[{ required: true, message: 'Veuillez saisir le téléphone' },
                            { pattern: /^[0-9]{10,15}$/, message: 'Numéro invalide (10-15 chiffres)' }]}>
                    <Input placeholder="Ex: 2250102030405" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  {/* Nationalité → affiche nom (nationalite), stocke code_iso */}
                  <Form.Item name="nationalite" label="Nationalité"
                    rules={[{ required: true, message: 'Veuillez sélectionner la nationalité' }]}>
                    <Select placeholder="Sélectionnez la nationalité" showSearch optionFilterProp="children"
                      loading={pays.length === 0} filterOption={filterOption}>
                      {pays.map(p => (
                        <Option key={`nat-${p.code_iso}`} value={p.code_iso}>
                          {p.nom} ({p.nationalite})
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={24}>
                <Col span={8}>
                  <Form.Item name="contact_parent" label="Contact parent/tuteur 1"
                    rules={[{ required: true, message: 'Veuillez saisir le contact du parent' },
                            { pattern: /^[0-9]{10,15}$/, message: 'Numéro invalide (10-15 chiffres)' }]}>
                    <Input placeholder="Ex: 2250102030405" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="contact_parent_2" label="Contact parent/tuteur 2"
                    rules={[{ pattern: /^[0-9]{10,15}$/, message: 'Numéro invalide (10-15 chiffres)' }]}>
                    <Input placeholder="Ex: 2250102030405" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="nom_parent_1" label="Nom parent/tuteur 1 (Père)"
                    rules={[{ required: true, message: 'Veuillez saisir le nom du parent' }, { max: 100, message: 'Max 100 caractères' }]}>
                    <Input placeholder="Nom complet du parent/tuteur" />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={24}>
                <Col span={8}>
                  <Form.Item name="adresse_parent_1" label="Adresse parent/tuteur 1 (Père)"
                    rules={[{ max: 200, message: 'Max 200 caractères' }]}>
                    <Input placeholder="Adresse complète" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="nom_parent_2" label="Nom parent/tuteur 2 (Mère)"
                    rules={[{ max: 100, message: 'Max 100 caractères' }]}>
                    <Input placeholder="Nom complet du parent/tuteur secondaire" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="adresse_parent_2" label="Adresse parent/tuteur 2 (Mère)"
                    rules={[{ max: 200, message: 'Max 200 caractères' }]}>
                    <Input placeholder="Adresse complète" />
                  </Form.Item>
                </Col>
              </Row>

              <Text strong style={{ display: 'block', margin: '24px 0 16px' }}>INFORMATIONS ACADÉMIQUES</Text>

              <Row gutter={24}>
                <Col span={8}>
                  <Form.Item name="matricule" label="Matricule Menet"
                    tooltip="Le matricule attribué par le Ministère de l'Enseignement Supérieur"
                    rules={[{ required: true, message: 'Veuillez saisir le matricule' },
                            { pattern: /^[A-Za-z0-9]+$/, message: 'Matricule invalide' }]}>
                    <Input placeholder="Ex: 22ABCD1234" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="annee_bac" label="Année d'obtention du BAC"
                    rules={[{ required: true, message: "Veuillez sélectionner l'année du BAC" }]}>
                    <Select placeholder="Sélectionnez l'année" showSearch optionFilterProp="children"
                      loading={anneesBac.length === 0} filterOption={filterOption}>
                      {anneesBac.map(a => <Option key={a.id} value={a.nom}>{a.nom}</Option>)}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="serie_bac" label="Série du BAC"
                    rules={[{ required: true, message: 'Veuillez sélectionner la série du BAC' }]}>
                    <Select placeholder="Sélectionnez la série" showSearch optionFilterProp="children"
                      loading={seriesBac.length === 0} filterOption={filterOption}>
                      {seriesBac.map(s => <Option key={s.id} value={s.nom}>{s.nom}</Option>)}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={24}>
                <Col span={8}>
                  <Form.Item name="session_bac" label="Session du BAC"
                    rules={[{ required: true, message: 'Veuillez sélectionner la session du BAC' }]}>
                    <Select placeholder="Sélectionnez la session">
                      <Option value="Juin">Juin</Option>
                      <Option value="Septembre">Septembre</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="mention_bac" label="Mention"
                    rules={[{ required: true, message: 'Veuillez sélectionner la mention' }]}>
                    <Select placeholder="Sélectionnez la mention">
                      <Option value="Passable">Passable</Option>
                      <Option value="Assez Bien">Assez Bien</Option>
                      <Option value="Bien">Bien</Option>
                      <Option value="Très Bien">Très Bien</Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={24}>
                <Col span={8}>
                  <Form.Item name="etablissement_origine" label="Établissement d'origine"
                    rules={[{ required: true, message: "Veuillez saisir l'établissement d'origine" }, { max: 150, message: 'Max 150 caractères' }]}>
                    <Input placeholder="Nom complet de l'établissement" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="numero_table" label="Numéro de table au BAC"
                    rules={[{ required: true, message: 'Veuillez saisir le numéro de table' },
                            { pattern: /^[0-9]+$/, message: 'Numéro invalide' }]}>
                    <Input placeholder="Numéro de table" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="annee_academique_id" label="Année académique"
                    tooltip="Seule l'année académique en cours est autorisée pour l'inscription"
                    rules={[
                      { required: true, message: "Veuillez sélectionner l'année académique" },
                      {
                        validator: (_, v) => {
                          const s = anneesAcademiques.find(y => y.id.toString() === v);
                          if (s && !isYearActive(s.etat))
                            return Promise.reject(new Error("Seule l'année en cours est autorisée"));
                          return Promise.resolve();
                        }
                      }
                    ]}>
                    <Select placeholder="Sélectionnez l'année académique"
                      loading={anneesAcademiques.length === 0} disabled={!currentYearId}>
                      {anneesAcademiques.map(a => {
                        const active = isYearActive(a.etat);
                        return (
                          <Option key={a.id} value={a.id.toString()} disabled={!active}
                            style={!active ? { color: '#ccc', backgroundColor: '#f5f5f5' } : {}}>
                            {a.annee}{active ? '  (En cours - Inscription autorisée)' : '  (Inscription non autorisée)'}
                          </Option>
                        );
                      })}
                    </Select>
                  </Form.Item>
                  {currentYearId && (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      ℹ️ Seule l'année en cours est disponible pour l'inscription
                    </Text>
                  )}
                </Col>
              </Row>

              <Row gutter={24}>
                <Col span={8}>
                  <Form.Item name="statut_scolaire" label="Statut scolaire"
                    rules={[{ required: true, message: 'Veuillez sélectionner le statut scolaire' }]}>
                    <Select placeholder="Sélectionnez le statut">
                      <Option value="Affecté">Affecté</Option>
                      <Option value="Non affecté">Non affecté</Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item style={{ marginTop: '32px', textAlign: 'center' }}>
                <Button type="primary" htmlType="submit" size="large" loading={submitting} style={{ minWidth: 150 }}>
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
          onSuccess={handleSuccess}
        />
      ),
    },
  ];

  if (!currentUser) return (
    <div style={{ padding: '0 30px' }}><PageHeader />
      <div style={{ padding: '24px' }}>
        <Alert message="Accès non autorisé"
          description="Impossible de récupérer vos informations utilisateur. Veuillez vous reconnecter."
          type="error" showIcon />
      </div>
    </div>
  );

  if (!currentUser.departement_id) return (
    <div style={{ padding: '0 30px' }}><PageHeader />
      <div style={{ padding: '24px' }}>
        <Alert message="Département non assigné"
          description="Votre compte n'est associé à aucun département. Veuillez contacter l'administrateur."
          type="warning" showIcon />
      </div>
    </div>
  );

  return (
    <div style={{ padding: '0 30px' }}>
      <PageHeader />
      <Steps current={currentStep} style={{ margin: '20px auto', maxWidth: '1100px' }} responsive>
        {steps.map(s => <Step key={s.title} title={s.title} />)}
      </Steps>
      {steps[currentStep].content}
    </div>
  );
};

export default NouvelleAdmission;