/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import {
  Input, Button, List, Avatar, Card, Descriptions, Alert, Row, Col,
  Divider, Form, message, Spin, Typography, Space, Radio, Select, Result, DatePicker, Checkbox, Tabs
} from 'antd';
import DataTable from '../../Components/ui/DataTable';
import StatusTag from '../../Components/ui/StatusTag';
import { SearchOutlined, CheckCircleOutlined, ClockCircleOutlined, PrinterOutlined } from '@ant-design/icons';
import PageHeader from '../../Components/PageHeader/PageHeader';
import { apiFetch, ApiError } from '../../lib/api';
import FormationCascadeSelect, { type FormationSelection } from '../../Components/FormationCascadeSelect/FormationCascadeSelect';
import WebcamCapture from '../../Components/WebcamCapture/WebcamCapture';
import { getReferenceData, type ReferenceData } from '../../lib/referenceData';

const { Option } = Select;
const { Text, Title } = Typography;
const { TextArea } = Input;

const API_URL = import.meta.env.VITE_API_URL_SERVER || '';

type StatutFiltre = 'en_attente' | 'verifies' | 'tous';

interface EtudiantResultat {
  id: number;
  nom: string;
  prenoms: string;
  matricule_iipea: string;
  photo_url: string | null;
  valide_scolarite: boolean;
  filiere: string;
  niveau: string;
}

interface DocumentInfo {
  code: string;
  libelle: string;
  obligatoire: boolean;
  fourni: boolean;
  declare_par_etudiant: boolean;
  fichier_path: string | null;
}

interface DossierEtudiant {
  id: number;
  matricule: string;
  matricule_iipea: string;
  nom: string;
  prenoms: string;
  date_naissance: string;
  lieu_naissance: string | null;
  pays_naissance: string | null;
  sexe: string;
  nationalite: string;
  telephone: string;
  email_personnel: string;
  lieu_residence: string | null;
  contact_parent: string;
  contact_parent_2: string | null;
  nom_parent_1: string | null;
  nom_parent_2: string | null;
  adresse_parent_1: string | null;
  adresse_parent_2: string | null;
  numero_acte_naissance: string | null;
  numero_piece_identite: string | null;
  numero_table: string | null;
  annee_bac: string | null;
  serie_bac: string | null;
  mention_bac: string | null;
  etablissement_origine: string | null;
  statut_scolaire: string;
  ip_ministere: string | null;
  photo_url: string | null;
  code_paiement: string;
  standing: string;
  valide_scolarite: boolean;
  verifie_par: number | null;
  date_verification: string | null;
  observation_verification: string | null;
  niveau_id: number;
  id_filiere: number;
  curcus_id: number | null;
  niveau_libelle: string;
  filiere_nom: string;
  departement_id: number | null;
  type_filiere_libelle: string | null;
  ecole_id: number | null;
  parcours_actuel: string | null;
  montant_scolarite: string | null;
}

interface Dossier {
  etudiant: DossierEtudiant;
  hierarchie: { ecole: string; departement: string; filiere: string; niveau: string; site: string };
  parcours_requis: boolean;
  parcours_options: { id: number; type_parcours: string }[];
  documents: DocumentInfo[];
}

interface ConfirmResult {
  code_paiement: string;
  nom: string;
  prenoms: string;
}

// ✅ Même règle que côté serveur (services/parcoursProfessionnel.service.js::requiertChoixParcours) —
// dupliquée ici en JS pur faute de code partagé entre front et back (même pattern que Reinscription.tsx).
const requiertChoixParcoursClient = (typeFiliereLibelle: string | null, niveauLibelle: string | null) => {
  const lib = (niveauLibelle || '').trim().toUpperCase();
  const contientPro = lib.includes('PRO');
  const estL1OuL2 = /^LICENCE\s*[12]\b/.test(lib);
  return typeFiliereLibelle === 'Professionnelles' && contientPro && !estL1OuL2;
};

// Sexe : pas de référentiel en base (ni côté portail Web ni côté API reference-data), même
// liste statique des deux côtés.
const SEXES_STATIQUES = ['Masculin', 'Féminin'];

const optionsFilter = (input: string, option?: { children?: unknown }) =>
  String(option?.children ?? '').toLowerCase().includes(input.toLowerCase());

const VerificationAdmission = () => {
  const [query, setQuery] = useState('');
  const [statutFiltre, setStatutFiltre] = useState<StatutFiltre>('en_attente');
  const [results, setResults] = useState<EtudiantResultat[]>([]);
  const [searching, setSearching] = useState(false);
  const [dossier, setDossier] = useState<Dossier | null>(null);
  const [loadingDossier, setLoadingDossier] = useState(false);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const [cascadeSelection, setCascadeSelection] = useState<FormationSelection>({});
  const [formationInfo, setFormationInfo] = useState<{ typeFiliereLibelle: string | null; niveauLibelle: string | null }>({ typeFiliereLibelle: null, niveauLibelle: null });
  const [curcusId, setCurcusId] = useState<number | null>(null);
  const [documentsFourni, setDocumentsFourni] = useState<Record<string, boolean>>({});
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [confirmResult, setConfirmResult] = useState<ConfirmResult | null>(null);
  const [referentiel, setReferentiel] = useState<ReferenceData | null>(null);

  useEffect(() => {
    getReferenceData().then(res => setReferentiel(res.data)).catch(() => setReferentiel(null));
  }, []);

  const handleSearch = async () => {
    if (query.trim().length < 2) {
      message.warning('Saisissez au moins 2 caractères');
      return;
    }
    setSearching(true);
    setDossier(null);
    try {
      const data = await apiFetch(`/api/verification/recherche?q=${encodeURIComponent(query.trim())}&statut=${statutFiltre}`);
      setResults(data.data || []);
      if ((data.data || []).length === 0) message.info('Aucun dossier trouvé');
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return;
      message.error('Erreur lors de la recherche');
    } finally {
      setSearching(false);
    }
  };

  // Rechercher à nouveau automatiquement quand l'agent change de filtre de statut, sans exiger
  // un nouveau clic sur "Rechercher" (une fois qu'une recherche a déjà été lancée).
  useEffect(() => {
    if (query.trim().length >= 2) handleSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statutFiltre]);

  const loadDossier = async (etudiantId: number) => {
    setResults([]);
    setLoadingDossier(true);
    setDossier(null);
    try {
      const dossierData = await apiFetch(`/api/verification/etudiant/${etudiantId}`);
      setDossier(dossierData.data);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return;
      if (e instanceof ApiError) { message.error(e.message); return; }
      message.error('Erreur lors du chargement du dossier');
    } finally {
      setLoadingDossier(false);
    }
  };

  useEffect(() => {
    if (!dossier) return;
    const e = dossier.etudiant;
    form.setFieldsValue({
      nom: e.nom,
      prenoms: e.prenoms,
      date_naissance: e.date_naissance ? dayjs(e.date_naissance) : undefined,
      sexe: e.sexe,
      nationalite: e.nationalite,
      lieu_naissance: e.lieu_naissance,
      pays_naissance: e.pays_naissance,
      telephone: e.telephone,
      email_personnel: e.email_personnel,
      lieu_residence: e.lieu_residence,
      contact_parent: e.contact_parent,
      contact_parent_2: e.contact_parent_2,
      nom_parent_1: e.nom_parent_1,
      nom_parent_2: e.nom_parent_2,
      adresse_parent_1: e.adresse_parent_1,
      adresse_parent_2: e.adresse_parent_2,
      numero_acte_naissance: e.numero_acte_naissance,
      numero_piece_identite: e.numero_piece_identite,
      numero_table: e.numero_table,
      annee_bac: e.annee_bac,
      serie_bac: e.serie_bac,
      mention_bac: e.mention_bac,
      etablissement_origine: e.etablissement_origine,
      ip_ministere: e.ip_ministere,
      observation_verification: e.observation_verification,
    });
    setCascadeSelection({
      filiere_id: e.id_filiere,
      niveau_id: e.niveau_id,
    });
    setFormationInfo({ typeFiliereLibelle: e.type_filiere_libelle, niveauLibelle: e.niveau_libelle });
    setCurcusId(e.curcus_id);
    setDocumentsFourni(Object.fromEntries(dossier.documents.map(d => [d.code, d.fourni])));
    setPhotoFile(null);
  }, [dossier, form]);

  // Le parcours déjà choisi n'est valable que pour la formation d'origine du dossier — toute
  // correction réelle de filière/niveau par l'agent doit l'invalidater (jamais le reporter sur
  // la nouvelle formation), exactement comme dans Reinscription.tsx. Ne se déclenche pas au
  // chargement initial car cascadeSelection est alors déjà alignée sur la formation d'origine.
  useEffect(() => {
    if (!dossier) return;
    const inchange = cascadeSelection.niveau_id === dossier.etudiant.niveau_id
      && cascadeSelection.filiere_id === dossier.etudiant.id_filiere;
    if (!inchange) setCurcusId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cascadeSelection.niveau_id, cascadeSelection.filiere_id]);

  const parcoursRequisAffiche = requiertChoixParcoursClient(formationInfo.typeFiliereLibelle, formationInfo.niveauLibelle);
  const dejaPaye = dossier?.etudiant.standing === 'Inscrit';

  const handleConfirmer = async (values: any) => {
    if (!dossier) return;
    if (!cascadeSelection.niveau_id || !cascadeSelection.filiere_id) {
      message.error('Veuillez sélectionner la filière et le niveau.');
      return;
    }
    if (parcoursRequisAffiche && !curcusId) {
      message.error('Veuillez choisir le parcours (Jour/Soir) pour ce niveau.');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      const identite: Record<string, any> = {
        nom: values.nom, prenoms: values.prenoms,
        date_naissance: values.date_naissance ? values.date_naissance.format('YYYY-MM-DD') : '',
        sexe: values.sexe, nationalite: values.nationalite,
        lieu_naissance: values.lieu_naissance, pays_naissance: values.pays_naissance,
        telephone: values.telephone, email_personnel: values.email_personnel,
        lieu_residence: values.lieu_residence, contact_parent: values.contact_parent,
        contact_parent_2: values.contact_parent_2, nom_parent_1: values.nom_parent_1, nom_parent_2: values.nom_parent_2,
        adresse_parent_1: values.adresse_parent_1, adresse_parent_2: values.adresse_parent_2,
        numero_acte_naissance: values.numero_acte_naissance, numero_piece_identite: values.numero_piece_identite,
        numero_table: values.numero_table, annee_bac: values.annee_bac, serie_bac: values.serie_bac,
        mention_bac: values.mention_bac, etablissement_origine: values.etablissement_origine,
        ip_ministere: values.ip_ministere,
      };
      Object.entries(identite).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') formData.append(`identite[${key}]`, String(value));
      });

      formData.append('formation[niveau_id]', String(cascadeSelection.niveau_id));
      formData.append('formation[id_filiere]', String(cascadeSelection.filiere_id));
      if (curcusId) formData.append('formation[curcus_id]', String(curcusId));

      Object.entries(documentsFourni).forEach(([code, fourni]) => {
        formData.append(`fourni[${code}]`, String(fourni));
      });

      if (values.observation_verification) {
        formData.append('observation_verification', values.observation_verification);
      }
      if (photoFile) formData.append('photo', photoFile);

      const result = await apiFetch(`/api/verification/etudiant/${dossier.etudiant.id}/confirmer`, {
        method: 'POST',
        body: formData,
      });
      message.success(result.message || 'Dossier vérifié avec succès.');
      setConfirmResult({
        code_paiement: dossier.etudiant.code_paiement,
        nom: values.nom || dossier.etudiant.nom,
        prenoms: values.prenoms || dossier.etudiant.prenoms,
      });
      // ✅ Activation du code de paiement (admission Web) = signal d'ouvrir immédiatement la
      // fiche d'engagement pour impression/signature — elle n'est plus téléchargeable depuis le
      // portail public (voir afficherFicheEngagementSeule côté backend).
      const token = localStorage.getItem('token');
      window.open(`${API_URL}/api/etudiants/${dossier.etudiant.id}/fiche-engagement?token=${encodeURIComponent(token || '')}`, '_blank');
    } catch (e) {
      if (e instanceof ApiError) { message.error(e.message); return; }
      message.error('Erreur lors de la confirmation du dossier.');
    } finally {
      setSubmitting(false);
    }
  };

  const nouvelleVerification = () => {
    setConfirmResult(null);
    setDossier(null);
    setResults([]);
    setQuery('');
  };

  return (
    <div>
      <Card title="Recherche d'un dossier d'admission Web" style={{ marginBottom: 24 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Space.Compact style={{ width: '100%', maxWidth: 500 }}>
            <Input
              placeholder="Nom, prénom ou matricule IIPEA"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onPressEnter={handleSearch}
            />
            <Button type="primary" icon={<SearchOutlined />} loading={searching} onClick={handleSearch}>
              Rechercher
            </Button>
          </Space.Compact>
          <Radio.Group value={statutFiltre} onChange={e => setStatutFiltre(e.target.value)}>
            <Radio.Button value="en_attente">En attente</Radio.Button>
            <Radio.Button value="verifies">Vérifiés</Radio.Button>
            <Radio.Button value="tous">Tous</Radio.Button>
          </Radio.Group>
        </Space>

        {results.length > 0 && (
          <List
            style={{ marginTop: 16 }}
            bordered
            dataSource={results}
            renderItem={item => (
              <List.Item
                style={{ cursor: 'pointer' }}
                onClick={() => loadDossier(item.id)}
                actions={[<Button size="small" type="link">Sélectionner</Button>]}
              >
                <List.Item.Meta
                  avatar={<Avatar src={item.photo_url ? `${API_URL}${item.photo_url}` : undefined}>{item.nom[0]}</Avatar>}
                  title={<>
                    {item.nom} {item.prenoms}{' '}
                    {item.valide_scolarite
                      ? <StatusTag tone="success" icon={<CheckCircleOutlined />} label="Vérifié" />
                      : <StatusTag tone="warning" icon={<ClockCircleOutlined />} label="En attente" />}
                  </>}
                  description={`${item.matricule_iipea} — ${item.filiere} (${item.niveau})`}
                />
              </List.Item>
            )}
          />
        )}
      </Card>

      {loadingDossier && (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin size="large" tip="Chargement du dossier..." />
        </div>
      )}

      {confirmResult && (
        <Card style={{ marginBottom: 24 }}>
          <Result
            status="success"
            title="Dossier vérifié — paiement autorisé"
            subTitle="L'étudiant peut désormais se présenter à la caisse avec son code de paiement (inchangé) pour finaliser son admission."
          >
            <Descriptions column={1} bordered size="small" style={{ maxWidth: 500, margin: '0 auto 24px auto' }}>
              <Descriptions.Item label="Étudiant">{confirmResult.nom} {confirmResult.prenoms}</Descriptions.Item>
              <Descriptions.Item label="Code de paiement">
                <Text strong style={{ fontSize: 16 }}>{confirmResult.code_paiement}</Text>
              </Descriptions.Item>
            </Descriptions>
            <Space>
              <Button onClick={nouvelleVerification}>Nouvelle vérification</Button>
            </Space>
          </Result>
        </Card>
      )}

      {!confirmResult && dossier && (
        <>
          <Card title="Dossier étudiant" style={{ marginBottom: 24 }}>
            <Row gutter={24}>
              <Col span={4} style={{ textAlign: 'center' }}>
                <Avatar
                  size={100}
                  src={photoFile ? URL.createObjectURL(photoFile) : (dossier.etudiant.photo_url ? `${API_URL}${dossier.etudiant.photo_url}` : undefined)}
                >
                  {dossier.etudiant.nom[0]}
                </Avatar>
                <div style={{ marginTop: 8 }}>
                  <WebcamCapture
                    buttonLabel={dossier.etudiant.photo_url || photoFile ? 'Remplacer la photo' : 'Prendre une photo'}
                    onCapture={setPhotoFile}
                  />
                </div>
              </Col>
              <Col span={20}>
                <Descriptions column={3} size="small">
                  <Descriptions.Item label="Matricule IIPEA">{dossier.etudiant.matricule_iipea}</Descriptions.Item>
                  <Descriptions.Item label="Code de paiement">{dossier.etudiant.code_paiement}</Descriptions.Item>
                  <Descriptions.Item label="Statut">
                    {dossier.etudiant.valide_scolarite
                      ? <StatusTag tone="success" label={`Vérifié${dossier.etudiant.date_verification ? ` le ${new Date(dossier.etudiant.date_verification).toLocaleString('fr-FR')}` : ''}`} />
                      : <StatusTag tone="warning" label="En attente de vérification" />}
                  </Descriptions.Item>
                  <Descriptions.Item label="École">{dossier.hierarchie.ecole || 'Non défini'}</Descriptions.Item>
                  <Descriptions.Item label="Filière">{dossier.hierarchie.filiere}</Descriptions.Item>
                  <Descriptions.Item label="Niveau">{dossier.hierarchie.niveau}</Descriptions.Item>
                  <Descriptions.Item label="Site">{dossier.hierarchie.site}</Descriptions.Item>
                  <Descriptions.Item label="Parcours déclaré">{dossier.etudiant.parcours_actuel || 'Non applicable'}</Descriptions.Item>
                  <Descriptions.Item label="Montant scolarité">
                    {dossier.etudiant.montant_scolarite ? `${Number(dossier.etudiant.montant_scolarite).toLocaleString('fr-FR')} FCFA` : 'Non déterminé'}
                  </Descriptions.Item>
                </Descriptions>
              </Col>
            </Row>
          </Card>

          {dejaPaye && (
            <Alert
              style={{ marginBottom: 24 }}
              type="info"
              showIcon
              message="Ce dossier a déjà été payé et finalisé"
              description="La formation et les documents ne peuvent plus être modifiés depuis cette page."
            />
          )}

          <Card title="Formation">
            <FormationCascadeSelect
              value={cascadeSelection}
              onChange={setCascadeSelection}
              onFormationInfo={setFormationInfo}
              disabled={dejaPaye}
            />
            {parcoursRequisAffiche && (
              <>
                <Form.Item label="Choisissez le parcours" required style={{ maxWidth: 500, marginTop: 16 }}>
                  <Select
                    placeholder="Cours du jour ou cours du soir"
                    value={curcusId ?? undefined}
                    onChange={setCurcusId}
                    disabled={dejaPaye}
                  >
                    {dossier.parcours_options.map(p => (
                      <Option key={p.id} value={p.id}>{p.type_parcours}</Option>
                    ))}
                  </Select>
                </Form.Item>
                <Alert
                  type="info"
                  showIcon
                  message="Choix du parcours obligatoire"
                  description="Ce niveau professionnel se décline en plusieurs parcours (Jour/Soir), qui correspondent à des classes et groupes distincts."
                />
              </>
            )}
          </Card>

          <Divider />

          <Card title="Pièces justificatives" style={{ marginBottom: 24 }}>
            <DataTable
              pagination={false}
              rowKey="code"
              dataSource={dossier.documents}
              columns={[
                { title: 'Pièce', dataIndex: 'libelle' },
                {
                  title: 'Déclaré par le candidat',
                  dataIndex: 'declare_par_etudiant',
                  render: (v: boolean) => <StatusTag tone={v ? 'info' : 'neutral'} label={v ? 'Déclaré' : 'Non déclaré'} />
                },
                {
                  title: 'Fourni physiquement (contrôle agent)',
                  dataIndex: 'code',
                  render: (code: string) => (
                    <Checkbox
                      checked={!!documentsFourni[code]}
                      disabled={dejaPaye}
                      onChange={e => setDocumentsFourni(prev => ({ ...prev, [code]: e.target.checked }))}
                    >
                      Fourni
                    </Checkbox>
                  )
                }
              ]}
            />
          </Card>

          <Card title="Vérification et correction des informations">
            <Form form={form} layout="vertical" onFinish={handleConfirmer} disabled={dejaPaye}>
              <Divider orientation="left">Identité</Divider>
              <Row gutter={16}>
                <Col span={8}><Form.Item name="nom" label="Nom" rules={[{ required: true, message: 'Champ requis' }]}><Input /></Form.Item></Col>
                <Col span={8}><Form.Item name="prenoms" label="Prénoms" rules={[{ required: true, message: 'Champ requis' }]}><Input /></Form.Item></Col>
                <Col span={8}>
                  <Form.Item name="date_naissance" label="Date de naissance" rules={[{ required: true, message: 'Champ requis' }]}>
                    <DatePicker style={{ width: '100%' }} disabledDate={c => !!c && c > dayjs().endOf('day')} />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="sexe" label="Sexe" rules={[{ required: true, message: 'Champ requis' }]}>
                    <Select placeholder="Sélectionnez le sexe">
                      {SEXES_STATIQUES.map(s => <Option key={s} value={s}>{s}</Option>)}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="nationalite" label="Nationalité" rules={[{ required: true, message: 'Champ requis' }]}>
                    <Select showSearch placeholder="Sélectionnez la nationalité" filterOption={optionsFilter}>
                      {referentiel?.pays.map(p => <Option key={p.id} value={p.nationalite}>{p.nationalite}</Option>)}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={8}><Form.Item name="lieu_naissance" label="Lieu de naissance"><Input /></Form.Item></Col>
              </Row>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="pays_naissance" label="Pays de naissance">
                    <Select showSearch allowClear placeholder="Sélectionnez le pays" filterOption={optionsFilter}>
                      {referentiel?.pays.map(p => <Option key={p.id} value={p.nom}>{p.nom}</Option>)}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={8}><Form.Item name="telephone" label="Téléphone" rules={[{ required: true, message: 'Champ requis' }]}><Input /></Form.Item></Col>
                <Col span={8}><Form.Item name="email_personnel" label="Email personnel" rules={[{ required: true, message: 'Champ requis' }]}><Input /></Form.Item></Col>
              </Row>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="lieu_residence" label="Lieu de résidence">
                    <Select showSearch allowClear placeholder="Sélectionnez la ville" filterOption={optionsFilter}>
                      {referentiel?.villes.map(v => <Option key={v.id} value={v.nom}>{v.nom}</Option>)}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={8}><Form.Item name="contact_parent" label="Contact parent 1" rules={[{ required: true, message: 'Champ requis' }]}><Input /></Form.Item></Col>
                <Col span={8}><Form.Item name="contact_parent_2" label="Contact parent 2"><Input /></Form.Item></Col>
              </Row>
              <Row gutter={16}>
                <Col span={8}><Form.Item name="nom_parent_1" label="Nom parent/tuteur 1"><Input /></Form.Item></Col>
                <Col span={8}><Form.Item name="nom_parent_2" label="Nom parent/tuteur 2"><Input /></Form.Item></Col>
                <Col span={8}><Form.Item name="adresse_parent_1" label="Adresse parent 1"><Input /></Form.Item></Col>
              </Row>
              <Row gutter={16}>
                <Col span={8}><Form.Item name="adresse_parent_2" label="Adresse parent 2"><Input /></Form.Item></Col>
                <Col span={8}><Form.Item name="numero_acte_naissance" label="N° acte de naissance"><Input /></Form.Item></Col>
                <Col span={8}><Form.Item name="numero_piece_identite" label="N° pièce d'identité"><Input /></Form.Item></Col>
              </Row>

              <Divider orientation="left">Informations académiques</Divider>
              <Row gutter={16}>
                <Col span={8}><Form.Item name="numero_table" label="Numéro de table"><Input /></Form.Item></Col>
                <Col span={8}>
                  <Form.Item name="annee_bac" label="Année du BAC">
                    <Select showSearch allowClear placeholder="Sélectionnez l'année" filterOption={optionsFilter}>
                      {referentiel?.anneesBac.map(a => <Option key={a.id} value={a.nom}>{a.nom}</Option>)}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="serie_bac" label="Série du BAC">
                    <Select showSearch allowClear placeholder="Sélectionnez la série" filterOption={optionsFilter}>
                      {referentiel?.seriesBac.map(s => <Option key={s.id} value={s.nom}>{s.nom}</Option>)}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="mention_bac" label="Mention BAC">
                    <Select placeholder="Sélectionnez la mention" allowClear>
                      <Option value="Passable">Passable</Option>
                      <Option value="Assez Bien">Assez Bien</Option>
                      <Option value="Bien">Bien</Option>
                      <Option value="Très Bien">Très Bien</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="etablissement_origine" label="Établissement d'origine">
                    <Select showSearch allowClear placeholder="Sélectionnez l'établissement" filterOption={optionsFilter}>
                      {referentiel?.etablissementsOrigine.map(e => (
                        <Option key={e.id} value={e.nom_etablissement}>{e.nom_etablissement}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={8}><Form.Item name="ip_ministere" label="Identifiant Ministère (si affecté)"><Input /></Form.Item></Col>
              </Row>

              <Divider orientation="left">Observation de vérification (facultatif)</Divider>
              <Form.Item name="observation_verification" label="Observation">
                <TextArea rows={3} placeholder="Note facultative sur le contrôle effectué — n'empêche jamais la confirmation" />
              </Form.Item>

              <Form.Item style={{ textAlign: 'center', marginTop: 16 }}>
                <Button type="primary" htmlType="submit" size="large" loading={submitting} disabled={dejaPaye} icon={<PrinterOutlined />}>
                  {dossier.etudiant.valide_scolarite ? 'Mettre à jour la vérification' : 'Confirmer pour paiement'}
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </>
      )}

      {!dossier && !loadingDossier && results.length === 0 && !confirmResult && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-soft)' }}>
          <Title level={5} type="secondary">Recherchez un dossier d'admission Web pour commencer la vérification</Title>
          <Text type="secondary">Par nom, prénom ou matricule IIPEA</Text>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// Vérification des réinscriptions Web — même principe que l'onglet Admissions,
// appliqué à la table `reinscription` (dossier identifié par reinscription_id,
// pas etudiant_id). Aucun impact sur VerificationAdmission ci-dessus.
// ═══════════════════════════════════════════════════════════════════════════

interface ReinscriptionResultat {
  reinscription_id: number;
  etudiant_id: number;
  nom: string;
  prenoms: string;
  matricule_iipea: string;
  photo_url: string | null;
  valide_scolarite: boolean;
  filiere: string;
  niveau: string;
}

interface DocumentReinscriptionInfo {
  code: string;
  libelle: string;
  obligatoire: boolean;
  fourni: boolean;
  declare_par_etudiant: boolean;
}

interface DossierReinscription {
  id: number;
  etudiant_id: number;
  statut: string;
  decision_academique: string;
  moyenne_annuelle: string | null;
  credits_valides: number | null;
  credits_total: number | null;
  montant_annuel_nouveau: string | null;
  code_paiement: string | null;
  motif_non_eligibilite: string | null;
  curcus_id: number | null;
  valide_scolarite: boolean;
  verifie_par: number | null;
  date_verification: string | null;
  observation_verification: string | null;
  nom: string;
  prenoms: string;
  matricule_iipea: string;
  photo_url: string | null;
  telephone: string | null;
  email: string | null;
  lieu_residence: string | null;
  contact_parent: string | null;
  contact_parent_2: string | null;
  adresse_parent_1: string | null;
  adresse_parent_2: string | null;
  numero_acte_naissance: string | null;
  numero_piece_identite: string | null;
  mention_bac: string | null;
  annee_bac: string | null;
  sexe: string | null;
  nationalite: string | null;
  pays_naissance: string | null;
  serie_bac: string | null;
  etablissement_origine: string | null;
  statut_scolaire: string;
  niveau_retenu_id: number;
  id_filiere_retenu: number | null;
  etudiant_id_filiere_actuel: number;
  etudiant_niveau_id_actuel: number;
  niveau_retenu_libelle: string;
  filiere_retenu_nom: string;
  departement_id: number | null;
  ecole_id: number | null;
  ecole_nom: string | null;
  departement_nom: string | null;
  type_filiere_libelle: string | null;
  niveau_precedent_libelle: string | null;
  parcours_actuel: string | null;
  site_nom: string;
}

interface DossierReinscriptionReponse {
  dossier: DossierReinscription;
  parcours_options: { id: number; type_parcours: string }[];
  est_bts2_vers_l3pro: boolean;
  documents: DocumentReinscriptionInfo[];
}

interface ConfirmReinscriptionResult {
  code_paiement: string | null;
  nom: string;
  prenoms: string;
}

const VerificationReinscription = () => {
  const [query, setQuery] = useState('');
  const [statutFiltre, setStatutFiltre] = useState<StatutFiltre>('en_attente');
  const [results, setResults] = useState<ReinscriptionResultat[]>([]);
  const [searching, setSearching] = useState(false);
  const [dossierReponse, setDossierReponse] = useState<DossierReinscriptionReponse | null>(null);
  const [loadingDossier, setLoadingDossier] = useState(false);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const [cascadeSelection, setCascadeSelection] = useState<FormationSelection>({});
  const [formationInfo, setFormationInfo] = useState<{ typeFiliereLibelle: string | null; niveauLibelle: string | null }>({ typeFiliereLibelle: null, niveauLibelle: null });
  const [curcusId, setCurcusId] = useState<number | null>(null);
  const [documentsFourni, setDocumentsFourni] = useState<Record<string, boolean>>({});
  const [confirmResult, setConfirmResult] = useState<ConfirmReinscriptionResult | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [referentiel, setReferentiel] = useState<ReferenceData | null>(null);

  useEffect(() => {
    getReferenceData().then(res => setReferentiel(res.data)).catch(() => setReferentiel(null));
  }, []);

  const handleSearch = async () => {
    if (query.trim().length < 2) {
      message.warning('Saisissez au moins 2 caractères');
      return;
    }
    setSearching(true);
    setDossierReponse(null);
    try {
      const data = await apiFetch(`/api/verification/reinscription/recherche?q=${encodeURIComponent(query.trim())}&statut=${statutFiltre}`);
      setResults(data.data || []);
      if ((data.data || []).length === 0) message.info('Aucun dossier trouvé');
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return;
      message.error('Erreur lors de la recherche');
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    if (query.trim().length >= 2) handleSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statutFiltre]);

  const loadDossier = async (reinscriptionId: number) => {
    setResults([]);
    setLoadingDossier(true);
    setDossierReponse(null);
    try {
      const data = await apiFetch(`/api/verification/reinscription/${reinscriptionId}`);
      setDossierReponse(data.data);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return;
      if (e instanceof ApiError) { message.error(e.message); return; }
      message.error('Erreur lors du chargement du dossier');
    } finally {
      setLoadingDossier(false);
    }
  };

  useEffect(() => {
    if (!dossierReponse) return;
    const d = dossierReponse.dossier;
    form.setFieldsValue({
      telephone: d.telephone,
      email: d.email,
      lieu_residence: d.lieu_residence,
      contact_parent: d.contact_parent,
      contact_parent_2: d.contact_parent_2,
      adresse_parent_1: d.adresse_parent_1,
      adresse_parent_2: d.adresse_parent_2,
      numero_acte_naissance: d.numero_acte_naissance,
      numero_piece_identite: d.numero_piece_identite,
      mention_bac: d.mention_bac,
      annee_bac: d.annee_bac,
      sexe: d.sexe,
      nationalite: d.nationalite,
      pays_naissance: d.pays_naissance,
      serie_bac: d.serie_bac,
      etablissement_origine: d.etablissement_origine,
      statut_scolaire: d.statut_scolaire,
      observation_verification: d.observation_verification,
    });
    // ✅ Les 2 valeurs (filière/niveau) viennent toutes de la formation RETENUE pour la
    // réinscription (r.niveau_retenu_id / r.id_filiere_retenu, cohérentes entre elles côté
    // backend) — jamais un mélange avec la formation actuelle de l'étudiant, qui laissait les
    // Select Filière/Niveau vides dès que les deux différaient (changement de cycle).
    setCascadeSelection({
      filiere_id: d.id_filiere_retenu ?? d.etudiant_id_filiere_actuel,
      niveau_id: d.niveau_retenu_id,
    });
    setFormationInfo({ typeFiliereLibelle: d.type_filiere_libelle, niveauLibelle: d.niveau_retenu_libelle });
    setCurcusId(d.curcus_id);
    setDocumentsFourni(Object.fromEntries(dossierReponse.documents.map(doc => [doc.code, doc.fourni])));
    setPhotoFile(null);
  }, [dossierReponse, form]);

  useEffect(() => {
    if (!dossierReponse) return;
    const d = dossierReponse.dossier;
    const inchange = cascadeSelection.niveau_id === d.niveau_retenu_id
      && cascadeSelection.filiere_id === (d.id_filiere_retenu ?? d.etudiant_id_filiere_actuel);
    if (!inchange) setCurcusId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cascadeSelection.niveau_id, cascadeSelection.filiere_id]);

  const parcoursRequisAffiche = requiertChoixParcoursClient(formationInfo.typeFiliereLibelle, formationInfo.niveauLibelle);
  const dejaPaye = dossierReponse?.dossier.statut === 'inscrit';

  const handleConfirmer = async (values: any) => {
    if (!dossierReponse) return;
    if (!cascadeSelection.niveau_id || !cascadeSelection.filiere_id) {
      message.error('Veuillez sélectionner la filière et le niveau.');
      return;
    }
    if (parcoursRequisAffiche && !curcusId) {
      message.error('Veuillez choisir le parcours (Jour/Soir) pour ce niveau.');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      const identite: Record<string, any> = {
        telephone: values.telephone, email: values.email, lieu_residence: values.lieu_residence,
        contact_parent: values.contact_parent, contact_parent_2: values.contact_parent_2,
        adresse_parent_1: values.adresse_parent_1, adresse_parent_2: values.adresse_parent_2,
        numero_acte_naissance: values.numero_acte_naissance, numero_piece_identite: values.numero_piece_identite,
        mention_bac: values.mention_bac, annee_bac: values.annee_bac,
        sexe: values.sexe, nationalite: values.nationalite, pays_naissance: values.pays_naissance,
        serie_bac: values.serie_bac, etablissement_origine: values.etablissement_origine,
      };
      Object.entries(identite).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') formData.append(`identite[${key}]`, String(value));
      });

      formData.append('formation[niveau_retenu_id]', String(cascadeSelection.niveau_id));
      formData.append('formation[id_filiere]', String(cascadeSelection.filiere_id));
      if (curcusId) formData.append('formation[curcus_id]', String(curcusId));

      Object.entries(documentsFourni).forEach(([code, valeur]) => {
        formData.append(`fourni[${code}]`, String(valeur));
      });

      if (values.observation_verification) formData.append('observation_verification', values.observation_verification);
      if (values.statut_scolaire) formData.append('statut_scolaire', values.statut_scolaire);
      if (photoFile) formData.append('photo', photoFile);

      const result = await apiFetch(`/api/verification/reinscription/${dossierReponse.dossier.id}/confirmer`, {
        method: 'POST',
        body: formData,
      });
      message.success(result.message || 'Dossier vérifié avec succès.');
      setConfirmResult({
        code_paiement: dossierReponse.dossier.code_paiement,
        nom: dossierReponse.dossier.nom,
        prenoms: dossierReponse.dossier.prenoms,
      });
      // Même comportement qu'une admission (voir handleConfirm ci-dessus) : ouverture immédiate
      // de la fiche d'engagement pour impression/signature après confirmation du dossier.
      const token = localStorage.getItem('token');
      window.open(`${API_URL}/api/etudiants/${dossierReponse.dossier.etudiant_id}/fiche-engagement?token=${encodeURIComponent(token || '')}`, '_blank');
    } catch (e) {
      if (e instanceof ApiError) { message.error(e.message); return; }
      message.error('Erreur lors de la confirmation du dossier.');
    } finally {
      setSubmitting(false);
    }
  };

  const nouvelleVerification = () => {
    setConfirmResult(null);
    setDossierReponse(null);
    setResults([]);
    setQuery('');
  };

  return (
    <div>
      <Card title="Recherche d'un dossier de réinscription Web" style={{ marginBottom: 24 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Space.Compact style={{ width: '100%', maxWidth: 500 }}>
            <Input
              placeholder="Nom, prénom ou matricule IIPEA"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onPressEnter={handleSearch}
            />
            <Button type="primary" icon={<SearchOutlined />} loading={searching} onClick={handleSearch}>
              Rechercher
            </Button>
          </Space.Compact>
          <Radio.Group value={statutFiltre} onChange={e => setStatutFiltre(e.target.value)}>
            <Radio.Button value="en_attente">En attente</Radio.Button>
            <Radio.Button value="verifies">Vérifiés</Radio.Button>
            <Radio.Button value="tous">Tous</Radio.Button>
          </Radio.Group>
        </Space>

        {results.length > 0 && (
          <List
            style={{ marginTop: 16 }}
            bordered
            dataSource={results}
            renderItem={item => (
              <List.Item
                style={{ cursor: 'pointer' }}
                onClick={() => loadDossier(item.reinscription_id)}
                actions={[<Button size="small" type="link">Sélectionner</Button>]}
              >
                <List.Item.Meta
                  avatar={<Avatar src={item.photo_url ? `${API_URL}${item.photo_url}` : undefined}>{item.nom[0]}</Avatar>}
                  title={<>
                    {item.nom} {item.prenoms}{' '}
                    {item.valide_scolarite
                      ? <StatusTag tone="success" icon={<CheckCircleOutlined />} label="Vérifié" />
                      : <StatusTag tone="warning" icon={<ClockCircleOutlined />} label="En attente" />}
                  </>}
                  description={`${item.matricule_iipea} — ${item.filiere} (${item.niveau})`}
                />
              </List.Item>
            )}
          />
        )}
      </Card>

      {loadingDossier && (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin size="large" tip="Chargement du dossier..." />
        </div>
      )}

      {confirmResult && (
        <Card style={{ marginBottom: 24 }}>
          <Result
            status="success"
            title="Dossier vérifié — paiement autorisé"
            subTitle="L'étudiant peut désormais se présenter à la caisse avec son code de paiement (inchangé) pour finaliser sa réinscription."
          >
            <Descriptions column={1} bordered size="small" style={{ maxWidth: 500, margin: '0 auto 24px auto' }}>
              <Descriptions.Item label="Étudiant">{confirmResult.nom} {confirmResult.prenoms}</Descriptions.Item>
              <Descriptions.Item label="Code de paiement">
                <Text strong style={{ fontSize: 16 }}>{confirmResult.code_paiement || 'Non éligible'}</Text>
              </Descriptions.Item>
            </Descriptions>
            <Space>
              <Button onClick={nouvelleVerification}>Nouvelle vérification</Button>
            </Space>
          </Result>
        </Card>
      )}

      {!confirmResult && dossierReponse && (
        <>
          <Card title="Dossier de réinscription" style={{ marginBottom: 24 }}>
            <Row gutter={24}>
              <Col span={4} style={{ textAlign: 'center' }}>
                <Avatar
                  size={100}
                  src={photoFile ? URL.createObjectURL(photoFile) : (dossierReponse.dossier.photo_url ? `${API_URL}${dossierReponse.dossier.photo_url}` : undefined)}
                >
                  {dossierReponse.dossier.nom[0]}
                </Avatar>
                <div style={{ marginTop: 8 }}>
                  <WebcamCapture
                    buttonLabel={dossierReponse.dossier.photo_url || photoFile ? 'Remplacer la photo' : 'Prendre une photo'}
                    onCapture={setPhotoFile}
                  />
                </div>
              </Col>
              <Col span={20}>
                <Descriptions column={3} size="small">
                  <Descriptions.Item label="Matricule IIPEA">{dossierReponse.dossier.matricule_iipea}</Descriptions.Item>
                  <Descriptions.Item label="Code de paiement">{dossierReponse.dossier.code_paiement || 'Non généré'}</Descriptions.Item>
                  <Descriptions.Item label="Statut">
                    {dossierReponse.dossier.valide_scolarite
                      ? <StatusTag tone="success" label={`Vérifié${dossierReponse.dossier.date_verification ? ` le ${new Date(dossierReponse.dossier.date_verification).toLocaleString('fr-FR')}` : ''}`} />
                      : <StatusTag tone="warning" label="En attente de vérification" />}
                  </Descriptions.Item>
                  <Descriptions.Item label="École">{dossierReponse.dossier.ecole_nom || 'Non défini'}</Descriptions.Item>
                  <Descriptions.Item label="Filière retenue">{dossierReponse.dossier.filiere_retenu_nom}</Descriptions.Item>
                  <Descriptions.Item label="Niveau retenu">{dossierReponse.dossier.niveau_retenu_libelle}</Descriptions.Item>
                  <Descriptions.Item label="Site">{dossierReponse.dossier.site_nom}</Descriptions.Item>
                  <Descriptions.Item label="Parcours déclaré">{dossierReponse.dossier.parcours_actuel || 'Non applicable'}</Descriptions.Item>
                  <Descriptions.Item label="Statut scolaire">
                    <StatusTag
                      tone={dossierReponse.dossier.statut_scolaire === 'Affecté' ? 'success' : 'neutral'}
                      label={dossierReponse.dossier.statut_scolaire || 'Non défini'}
                    />
                  </Descriptions.Item>
                  <Descriptions.Item label="Montant scolarité">
                    {dossierReponse.dossier.montant_annuel_nouveau ? `${Number(dossierReponse.dossier.montant_annuel_nouveau).toLocaleString('fr-FR')} FCFA` : 'Non déterminé'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Décision académique">{dossierReponse.dossier.decision_academique}</Descriptions.Item>
                  <Descriptions.Item label="Statut du dossier">{dossierReponse.dossier.statut}</Descriptions.Item>
                  {dossierReponse.dossier.motif_non_eligibilite && (
                    <Descriptions.Item label="Motif non éligibilité" span={3}>{dossierReponse.dossier.motif_non_eligibilite}</Descriptions.Item>
                  )}
                </Descriptions>
              </Col>
            </Row>
          </Card>

          {dejaPaye && (
            <Alert
              style={{ marginBottom: 24 }}
              type="info"
              showIcon
              message="Ce dossier a déjà été payé et finalisé"
              description="La formation ne peut plus être modifiée depuis cette page."
            />
          )}

          <Card title="Formation">
            <FormationCascadeSelect
              value={cascadeSelection}
              onChange={setCascadeSelection}
              onFormationInfo={setFormationInfo}
              disabled={dejaPaye}
            />
            {parcoursRequisAffiche && (
              <>
                <Form.Item label="Choisissez le parcours" required style={{ maxWidth: 500, marginTop: 16 }}>
                  <Select
                    placeholder="Cours du jour ou cours du soir"
                    value={curcusId ?? undefined}
                    onChange={setCurcusId}
                    disabled={dejaPaye}
                  >
                    {dossierReponse.parcours_options.map(p => (
                      <Option key={p.id} value={p.id}>{p.type_parcours}</Option>
                    ))}
                  </Select>
                </Form.Item>
                <Alert
                  type="info"
                  showIcon
                  message="Choix du parcours obligatoire"
                  description="Ce niveau professionnel se décline en plusieurs parcours (Jour/Soir), qui correspondent à des classes et groupes distincts."
                />
              </>
            )}
          </Card>

          <Divider />
          <Card
            title={dossierReponse.est_bts2_vers_l3pro
              ? "Pièces justificatives (dont changement de cycle BTS → Licence 3 PRO)"
              : "Pièces justificatives"}
            style={{ marginBottom: 24 }}
          >
            {dossierReponse.documents.length === 0 ? (
              <Text type="secondary">Aucun type de document configuré.</Text>
            ) : (
              <DataTable
                pagination={false}
                rowKey="code"
                dataSource={dossierReponse.documents}
                columns={[
                  {
                    title: 'Pièce',
                    dataIndex: 'libelle',
                    render: (libelle: string, doc: DocumentReinscriptionInfo) => (
                      <Space>
                        {libelle}
                        <StatusTag tone={doc.obligatoire ? 'danger' : 'neutral'} label={doc.obligatoire ? 'Obligatoire' : 'Facultatif'} />
                      </Space>
                    )
                  },
                  {
                    title: 'Déclaré par le candidat',
                    dataIndex: 'declare_par_etudiant',
                    render: (v: boolean) => <StatusTag tone={v ? 'info' : 'neutral'} label={v ? 'Déclaré' : 'Non déclaré'} />
                  },
                  {
                    title: 'Fourni physiquement (contrôle agent)',
                    dataIndex: 'code',
                    render: (code: string) => (
                      <Checkbox
                        checked={!!documentsFourni[code]}
                        disabled={dejaPaye}
                        onChange={e => setDocumentsFourni(prev => ({ ...prev, [code]: e.target.checked }))}
                      >
                        Fourni
                      </Checkbox>
                    )
                  }
                ]}
              />
            )}
          </Card>

          <Divider />

          <Card title="Vérification et correction des informations">
            <Form form={form} layout="vertical" onFinish={handleConfirmer} disabled={dejaPaye}>
              <Divider orientation="left">Identité</Divider>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="sexe" label="Sexe">
                    <Select placeholder="Sélectionnez le sexe" allowClear>
                      {SEXES_STATIQUES.map(s => <Option key={s} value={s}>{s}</Option>)}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="nationalite" label="Nationalité">
                    <Select showSearch allowClear placeholder="Sélectionnez la nationalité" filterOption={optionsFilter}>
                      {referentiel?.pays.map(p => <Option key={p.id} value={p.nationalite}>{p.nationalite}</Option>)}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="pays_naissance" label="Pays de naissance">
                    <Select showSearch allowClear placeholder="Sélectionnez le pays" filterOption={optionsFilter}>
                      {referentiel?.pays.map(p => <Option key={p.id} value={p.nom}>{p.nom}</Option>)}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="statut_scolaire" label="Statut scolaire">
                    <Select placeholder="Sélectionnez le statut">
                      <Option value="Affecté">Affecté</Option>
                      <Option value="Non affecté">Non affecté</Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Divider orientation="left">Coordonnées</Divider>
              <Row gutter={16}>
                <Col span={8}><Form.Item name="telephone" label="Téléphone"><Input /></Form.Item></Col>
                <Col span={8}><Form.Item name="email" label="Email"><Input /></Form.Item></Col>
                <Col span={8}>
                  <Form.Item name="lieu_residence" label="Lieu de résidence">
                    <Select showSearch allowClear placeholder="Sélectionnez la ville" filterOption={optionsFilter}>
                      {referentiel?.villes.map(v => <Option key={v.id} value={v.nom}>{v.nom}</Option>)}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={8}><Form.Item name="contact_parent" label="Contact parent 1"><Input /></Form.Item></Col>
                <Col span={8}><Form.Item name="contact_parent_2" label="Contact parent 2"><Input /></Form.Item></Col>
                <Col span={8}><Form.Item name="numero_acte_naissance" label="N° acte de naissance"><Input /></Form.Item></Col>
              </Row>
              <Row gutter={16}>
                <Col span={8}><Form.Item name="numero_piece_identite" label="N° pièce d'identité"><Input /></Form.Item></Col>
                <Col span={8}><Form.Item name="adresse_parent_1" label="Adresse parent 1"><Input /></Form.Item></Col>
                <Col span={8}><Form.Item name="adresse_parent_2" label="Adresse parent 2"><Input /></Form.Item></Col>
              </Row>

              <Divider orientation="left">Informations académiques</Divider>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="mention_bac" label="Mention BAC">
                    <Select placeholder="Sélectionnez la mention" allowClear>
                      <Option value="Passable">Passable</Option>
                      <Option value="Assez Bien">Assez Bien</Option>
                      <Option value="Bien">Bien</Option>
                      <Option value="Très Bien">Très Bien</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="annee_bac" label="Année d'obtention du BAC">
                    <Select showSearch allowClear placeholder="Sélectionnez l'année" filterOption={optionsFilter}>
                      {referentiel?.anneesBac.map(a => <Option key={a.id} value={a.nom}>{a.nom}</Option>)}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="serie_bac" label="Série du BAC">
                    <Select showSearch allowClear placeholder="Sélectionnez la série" filterOption={optionsFilter}>
                      {referentiel?.seriesBac.map(s => <Option key={s.id} value={s.nom}>{s.nom}</Option>)}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="etablissement_origine" label="Établissement d'origine">
                    <Select showSearch allowClear placeholder="Sélectionnez l'établissement" filterOption={optionsFilter}>
                      {referentiel?.etablissementsOrigine.map(e => (
                        <Option key={e.id} value={e.nom_etablissement}>{e.nom_etablissement}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Divider orientation="left">Observation de vérification (facultatif)</Divider>
              <Form.Item name="observation_verification" label="Observation">
                <TextArea rows={3} placeholder="Note facultative sur le contrôle effectué — n'empêche jamais la confirmation" />
              </Form.Item>

              <Form.Item style={{ textAlign: 'center', marginTop: 16 }}>
                <Button type="primary" htmlType="submit" size="large" loading={submitting} disabled={dejaPaye} icon={<PrinterOutlined />}>
                  {dossierReponse.dossier.valide_scolarite ? 'Mettre à jour la vérification' : 'Confirmer pour paiement'}
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </>
      )}

      {!dossierReponse && !loadingDossier && results.length === 0 && !confirmResult && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-soft)' }}>
          <Title level={5} type="secondary">Recherchez un dossier de réinscription Web pour commencer la vérification</Title>
          <Text type="secondary">Par nom, prénom ou matricule IIPEA</Text>
        </div>
      )}
    </div>
  );
};

const Verification = () => {
  return (
    <div style={{ padding: 24 }}>
      <PageHeader />
      <Tabs
        defaultActiveKey="admission"
        items={[
          { key: 'admission', label: 'Admissions Web', children: <VerificationAdmission /> },
          { key: 'reinscription', label: 'Réinscriptions Web', children: <VerificationReinscription /> },
        ]}
      />
    </div>
  );
};

export default Verification;
