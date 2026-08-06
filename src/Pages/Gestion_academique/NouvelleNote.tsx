/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Typography,
  Button,
  Select,
  Upload,
  Form,
  Row,
  Col,
  Spin,
  message,
  Space,
  Alert,
  Checkbox,
  Descriptions,
  Steps,
  Modal,
  List,
} from 'antd';
import StatusTag from '../../Components/ui/StatusTag';
import { 
  UploadOutlined, 
  FileExcelOutlined, 
  ArrowLeftOutlined,
  BookOutlined,
  CheckCircleOutlined,
  TeamOutlined,
  InfoCircleOutlined,
  SettingOutlined,
  FileDoneOutlined,
  UserOutlined,
  WarningOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import PageHeader from '../../Components/PageHeader/PageHeader';
import { apiFetch } from '../../lib/api';
import type { UploadFile } from 'antd';

const { Title, Text } = Typography;
const { Option } = Select;
const { Step } = Steps;

interface Matiere {
  id: number;
  nom: string;
  coefficient: string;
  volume_horaire_cm: number;
  volume_horaire_td: number;
}

interface Professeur {
  id: number;
  nom: string;
  prenom: string;
  statut: string;
  id_matiere: number | null;
}

interface GroupeInfo {
  id: number;
  nom: string;
  classe_nom?: string;
  classe_description?: string;   // NOUVEAU
  filiere_id?: number | null;
  niveau_id?: number | null;
  annee_academique_id?: number | null;
}

interface MaquetteDetail {
  maquette: {
    id: number;
    parcour: string;
    filiere_nom: string;
    filiere_sigle: string;
    niveau_libelle: string;
    annee_academique: string;
  };
  semestres: any[];
}

interface UploadResult {
  success: boolean;
  message: string;
  details: {
    fichier: string;
    fichierSauvegarde: string;
    chemin: string;
    parcour: string;
    matiere: string;
    groupe: string;
    session: string;
    stats: {
      totalTraitees: number;
      notesInserees: number;
      notesMisesAJour: number;
      erreurs: number;
      etudiantsNonTrouves: number;
    };
  };
  avertissements?: {
    message: string;
    etudiants: Array<{
      numero: string;
      nom: string;
      prenom: string;
    }>;
  };
  erreurs?: Array<{
    etudiant: string;
    erreur: string;
  }>;
}

interface ExistingNotesInfo {
  notesExistantes: boolean;
  count: number;
  etudiantsAvecNotes: number;
  totalEtudiants: number;
  pourcentage: number;
  derniereImportation: string;
  dernierFichier: string;
  message: string;
}

const NouvelleNote = () => {
  const API_URL = import.meta.env.VITE_API_URL_SERVER || "";
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  
  const [groupeInfo, setGroupeInfo] = useState<GroupeInfo | null>(null);
  const [maquetteDetail, setMaquetteDetail] = useState<MaquetteDetail | null>(null);
  const [matieres, setMatieres] = useState<Matiere[]>([]);
  const [professeurs, setProfesseurs] = useState<Professeur[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMatieres, setLoadingMatieres] = useState(false);
  const [loadingProfesseurs, setLoadingProfesseurs] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedMatiere, setSelectedMatiere] = useState<Matiere | null>(null);
  const [selectedProfesseur, setSelectedProfesseur] = useState<number | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [existingNotesInfo, setExistingNotesInfo] = useState<ExistingNotesInfo | null>(null);
  const [checkingExistingNotes, setCheckingExistingNotes] = useState(false);

  // Récupérer le token du localStorage
  const getToken = () => {
    return localStorage.getItem('token');
  };

  // Fonction fetch avec gestion d'erreurs
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

  // Charger les professeurs actifs
  const loadProfesseurs = async () => {
    setLoadingProfesseurs(true);
    try {
      const data = await fetchWithAuth(`${API_URL}/api/professeur`);
      // Filtrer seulement les professeurs actifs
      const professeursActifs = data.filter((prof: Professeur) => prof.statut === 'Actif');
      setProfesseurs(professeursActifs);
    } catch (error) {
      console.error('Erreur lors du chargement des professeurs:', error);
      message.error('Erreur de chargement des professeurs');
    } finally {
      setLoadingProfesseurs(false);
    }
  };

  // 1. Récupérer les infos du groupe
  useEffect(() => {
    const fetchGroupeInfo = async () => {
      if (!id) {
        message.error('ID du groupe manquant');
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        
        const response = await fetch(`${API_URL}/api/classes/groupe/${id}/info`);
        
        if (!response.ok) {
          throw new Error(`Erreur HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        const groupeInfo: GroupeInfo = {
          id: data.id,
          nom: data.nom,
          classe_description: data.classe_description,   // NOUVEAU
          filiere_id: data.filiere_id,
          niveau_id: data.niveau_id,
          annee_academique_id: data.annee_academique_id
        };

        setGroupeInfo(groupeInfo);
        await fetchMaquetteForClasse(data.nom, data.classe_description, data.filiere_id, data.niveau_id, data.annee_academique_id);
        
      } catch (error: any) {
        console.error('Erreur chargement groupe:', error);
        message.error(`Erreur: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };
    
    fetchGroupeInfo();
    // Charger aussi les professeurs
    loadProfesseurs();
  }, [id]);

  /**
   * Extrait la filière depuis un nom de classe ou de maquette.
   * Supprime : le niveau (Licence/Master/Doctorat/BTS + chiffre),
   *            "Groupe N", les sigles connus, les espaces superflus.
   */
  const extractFiliere = (name: string | null | undefined): string => {
    if (!name) return '';
    return name
      .replace(/(licence|master|doctorat)\s*\d+/gi, '')   // Licence 1, Master 2...
      .replace(/\bbts\s*\d+/gi, '')                        // BTS 1, BTS 2, BTS1...
      .replace(/\bgroupe\s*\d+/gi, '')                     // Groupe 1, Groupe 2...
      .replace(/\b(scj|sic|adaf|ang|lmo)\b/gi, '')         // Sigles spécifiques
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  };

  /**
   * Extrait le régime (Jour/Soir) d'un texte.
   */
  const extractRegime = (text: string): string => {
    if (!text) return '';
    const match = text.match(/(Jour|Soir)/i);
    return match ? match[1].toLowerCase() : '';
  };

  /**
   * Extrait le niveau depuis un nom de classe ou de maquette.
   * Gère : Licence/Master/Doctorat + chiffre  ET  BTS + chiffre.
   * Retourne une chaîne normalisée ex: "bts 1", "licence 2", "master 1".
   * Retourne '' si aucun niveau reconnu.
   */
  const extractNiveau = (name: string | null | undefined): string => {
    if (!name) return '';
    // Licence 1 / Master 2 / Doctorat 3
    const matchLMD = name.match(/\b(licence|master|doctorat)\s*(\d+)/i);
    if (matchLMD) {
      return `${matchLMD[1].toLowerCase()} ${matchLMD[2]}`;
    }

    // BTS 1 / BTS 2 / BTS1 / BTS2
    const matchBTS = name.match(/\bbts\s*(\d+)/i);
    if (matchBTS) {
      return `bts ${matchBTS[1]}`;
    }

    return '';
  };

  const fetchMaquetteForClasse = async (
    classeNom: string,
    classeDescription?: string,
    filiereId?: number | null,
    niveauId?: number | null,
    anneeAcademiqueId?: number | null
  ) => {
    try {

      const data = await apiFetch('/api/maquettes');

      if (Array.isArray(data)) {
        const regimeClasse = extractRegime(classeDescription || '');

        // Identifiants fiables (filiere_id/niveau_id/annee_academique_id de la classe, via le
        // groupe) — prioritaires sur toute extraction textuelle : le nom d'un groupe est un champ
        // libre choisi par l'agent (ex: "Groupe A", "TD1") et ne contient pas forcément le
        // filière/niveau, contrairement à ce que l'ancienne extraction par regex supposait. Cette
        // même correspondance par ID évite aussi de matcher, par coïncidence de nom, la maquette
        // d'une AUTRE année académique.
        let maquettesCandidates: any[] = [];
        if (filiereId && niveauId && anneeAcademiqueId) {
          maquettesCandidates = data.filter((maquette: any) =>
            maquette.filiere_id === filiereId &&
            maquette.niveau_id === niveauId &&
            maquette.anneeacademique_id === anneeAcademiqueId
          );
        }

        // Repli sur l'ancienne extraction textuelle si les IDs sont indisponibles (compatibilité).
        if (maquettesCandidates.length === 0 && (!filiereId || !niveauId || !anneeAcademiqueId)) {
          const filiereClasse = extractFiliere(classeNom);
          const niveauClasse = extractNiveau(classeNom);
          if (!niveauClasse) {
            console.warn('⚠️ Niveau non reconnu dans le nom du groupe:', classeNom);
            message.warning('Impossible de détecter le niveau depuis le nom du groupe');
            return;
          }
          maquettesCandidates = data.filter((maquette: any) => {
            const filiereMaquette = extractFiliere(maquette.filiere_nom);
            const niveauMaquette = extractNiveau(maquette.niveau_libelle);
            const correspondanceFiliere =
              filiereClasse.includes(filiereMaquette) ||
              filiereMaquette.includes(filiereClasse);
            const correspondanceNiveau =
              niveauClasse !== '' &&
              niveauMaquette !== '' &&
              niveauClasse === niveauMaquette;
            return correspondanceFiliere && correspondanceNiveau;
          });
        }

        let maquetteTrouvee = null;

        if (maquettesCandidates.length > 1 && regimeClasse) {
          // Plusieurs maquettes possibles (jour/soir) : on filtre par régime
          maquetteTrouvee = maquettesCandidates.find((m: any) => extractRegime(m.parcour || '') === regimeClasse);
        }

        // Fallback si un seul candidat, ou si le régime n'a pas permis de trancher
        if (!maquetteTrouvee) {
          maquetteTrouvee = maquettesCandidates[0];
        }

        if (maquetteTrouvee) {
          await fetchMaquetteDetail(maquetteTrouvee.id);
        } else {
          console.warn('⚠️ Aucune maquette correspondante trouvée');
          message.warning('Aucune maquette correspondante trouvée');
        }
      }
    } catch (error: any) {
      console.error('Erreur recherche maquette:', error);
      message.error('Erreur lors de la recherche de la maquette');
    }
  };

  const fetchMaquetteDetail = async (maquetteId: number) => {
    setLoadingMatieres(true);
    try {
      
      const data = await apiFetch(`/api/detailaffichageMaquette/maquettes/${maquetteId}/structured`);
      setMaquetteDetail(data);
      
      const matieresList: Matiere[] = [];
      if (data.semestres && Array.isArray(data.semestres)) {
        data.semestres.forEach((semestre: any) => {
          if (semestre.ues && Array.isArray(semestre.ues)) {
            semestre.ues.forEach((ue: any) => {
              if (ue.matieres && Array.isArray(ue.matieres)) {
                ue.matieres.forEach((matiere: any) => {
                  matieresList.push({
                    id: matiere.id,
                    nom: matiere.nom,
                    coefficient: matiere.coefficient,
                    volume_horaire_cm: matiere.volume_horaire_cm || 0,
                    volume_horaire_td: matiere.volume_horaire_td || 0
                  });
                });
              }
            });
          }
        });
      }
      
      setMatieres(matieresList);
      
    } catch (error: any) {
      console.error('Erreur chargement matières:', error);
      message.error('Erreur lors du chargement des matières');
    } finally {
      setLoadingMatieres(false);
    }
  };

  const checkExistingNotes = async (matiereId: number) => {
    if (!id || !matiereId) return;
    
    try {
      setCheckingExistingNotes(true);
      
      const data = await apiFetch(`/api/notes/check-existing/${id}/${matiereId}`);

      if (data.success) {
        setExistingNotesInfo(data);
        
        if (data.notesExistantes) {
          message.info({
            content: data.message,
            duration: 6,
            icon: <SyncOutlined />
          });
        }
      }
      
    } catch (error) {
      console.error('❌ Erreur vérification notes existantes:', error);
      // On ignore l'erreur, ce n'est pas bloquant
    } finally {
      setCheckingExistingNotes(false);
    }
  };

  // Assigner un professeur à la matière
  const assignerProfesseur = async (professeurId: number, matiereId: number) => {
    try {
      
      const token = getToken();
      const response = await fetch(`${API_URL}/api/professeur/${professeurId}/assign-matiere`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          matiereId: matiereId
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erreur lors de l\'assignation');
      }
      
      const result = await response.json();
      return result;
    } catch (error) {
      console.error('❌ Erreur assignation professeur:', error);
      throw error;
    }
  };

  const onFinish = async (values: any) => {
    
    if (fileList.length === 0) {
      message.error('Veuillez sélectionner un fichier Excel');
      return;
    }

    if (!selectedMatiere) {
      message.error('Erreur: Aucune matière sélectionnée.');
      return;
    }

    if (!selectedMatiere.id) {
      message.error('Erreur: La matière sélectionnée n\'a pas d\'ID valide');
      return;
    }

    setUploading(true);
    
    try {
      // 1. Si un professeur est sélectionné, l'assigner à la matière
      if (selectedProfesseur) {
        try {
          await assignerProfesseur(selectedProfesseur, selectedMatiere.id);
          message.success('Professeur assigné à la matière avec succès');
        } catch (error: any) {
          console.warn('⚠️ Erreur lors de l\'assignation du professeur:', error);
          // On continue quand même avec l'importation des notes
          message.warning('Assignation du professeur échouée, mais importation des notes continue...');
        }
      }

      // 2. Importer les notes
      const formData = new FormData();
      formData.append('groupeId', String(id || ''));
      formData.append('matiereId', String(selectedMatiere.id));
      formData.append('noteTypes', JSON.stringify(values.noteTypes || ['Note 1']));
      
      // Ajouter l'ID du professeur s'il est sélectionné
      if (selectedProfesseur) {
        formData.append('professeurId', String(selectedProfesseur));
      }

      const uploadFile = fileList[0];
      
      if (uploadFile.originFileObj) {
        formData.append('fichier', uploadFile.originFileObj);
      } else if (uploadFile && typeof uploadFile === 'object') {
        const fileAsAny = uploadFile as any;
        const hasFileProperties = 
          fileAsAny.name !== undefined && 
          fileAsAny.size !== undefined && 
          fileAsAny.type !== undefined;
        
        if (hasFileProperties) {
          formData.append('fichier', fileAsAny);
        } else {
          throw new Error('Le fichier sélectionné n\'est pas valide.');
        }
      } else {
        throw new Error('Impossible de récupérer le fichier.');
      }
      
      
      const result = await apiFetch('/api/notes/upload', {
        method: 'POST',
        body: formData,
      });

      if (result.success) {
        setUploadResult(result);
        setShowResultModal(true);
        message.success({
          content: result.message,
          duration: 5,
          icon: <CheckCircleOutlined />
        });
        
        // Réinitialiser les infos sur les notes existantes
        setExistingNotesInfo(null);
      } else {
        message.error({
          content: result.error || 'Erreur lors de l\'importation',
          duration: 10
        });
      }
      
    } catch (error: any) {
      console.error('❌ Erreur upload:', error);
      message.error({
        content: `Erreur: ${error.message || 'Veuillez réessayer'}`,
        duration: 10
      });
    } finally {
      setUploading(false);
    }
  };

  const uploadProps = {
    onRemove: () => {
      setFileList([]);
      setCurrentStep(1);
    },
    beforeUpload: (file: UploadFile) => {
      
      const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
      if (!isExcel) {
        message.error('Seuls les fichiers Excel (.xlsx, .xls) sont acceptés');
        return false;
      }
      
      const isLt5M = (file.size || 0) / 1024 / 1024 < 5;
      if (!isLt5M) {
        message.error('Le fichier doit faire moins de 5MB');
        return false;
      }
      
      setFileList([file]);
      setCurrentStep(2);
      return false;
    },
    fileList,
    accept: '.xlsx,.xls',
    maxCount: 1
  };

  const handleMatiereChange = (matiereId: number) => {
    const matiere = matieres.find(m => m.id === matiereId);
    setSelectedMatiere(matiere || null);
    setCurrentStep(1);
    setExistingNotesInfo(null); // Réinitialiser les infos
    
    // Réinitialiser la sélection du professeur
    setSelectedProfesseur(null);
    
    if (matiere) {
      // Vérifier si des notes existent déjà
      checkExistingNotes(matiereId);
      
      // Trouver si un professeur est déjà assigné à cette matière
      const professeurAssigne = professeurs.find(p => p.id_matiere === matiereId);
      if (professeurAssigne) {
        setSelectedProfesseur(professeurAssigne.id);
      }
    }
  };

  const handleProfesseurChange = (professeurId: number) => {
    setSelectedProfesseur(professeurId);
  };

  const handleReset = () => {
    form.resetFields();
    setFileList([]);
    setSelectedMatiere(null);
    setSelectedProfesseur(null);
    setCurrentStep(0);
    setUploadResult(null);
    setShowResultModal(false);
    setExistingNotesInfo(null);
  };

  const handleCloseResultModal = () => {
    setShowResultModal(false);
  };

  const handleViewImportedNotes = () => {
    navigate(`/notes/groupe/${id}`);
  };

  useEffect(() => {
  }, []);

  // Fonction de recherche pour les options du select
  const filterOption = (input: string, option?: any) => {
    if (!input) return true;
    const searchText = input.toLowerCase();
    // Chercher dans le nom de la matière
    return option?.children?.toString().toLowerCase().includes(searchText) || false;
  };

  // Fonction de recherche pour les professeurs
  const filterProfesseurOption = (input: string, option?: any) => {
    if (!input) return true;
    const searchText = input.toLowerCase();
    // Chercher dans le nom complet du professeur (prénom + nom)
    const professeurNom = option?.label?.toString().toLowerCase() || '';
    return professeurNom.includes(searchText);
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <Spin size="large" />
        <div style={{ marginTop: 16, color: '#666' }}>
          Chargement des informations du groupe...
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--paper)' }}>
      <PageHeader />
      
      <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          marginBottom: '24px',
          gap: '16px'
        }}>
          <Button 
            type="text" 
            icon={<ArrowLeftOutlined />} 
            onClick={() => navigate(-1)}
            style={{ 
              padding: '4px 12px',
              border: '1px solid #d9d9d9'
            }}
          >
            Retour
          </Button>
          
          <div>
            <Title level={2} style={{ margin: 0, fontSize: '24px', color: 'var(--mod-scolarite)' }}>
              <TeamOutlined style={{ marginRight: '8px' }} />
              Importation des notes
            </Title>
            <Text type="secondary">
              Groupe: <Text strong>{groupeInfo?.nom}</Text>
              <Text type="secondary" style={{ marginLeft: '16px', fontSize: '12px' }}>
                (ID: {id})
              </Text>
            </Text>
          </div>
        </div>

        <Card style={{ marginBottom: '24px' }}>
          <Steps current={currentStep}>
            <Step 
              title="Sélection matière" 
              description="Choisir la matière" 
              icon={<BookOutlined />}
            />
            <Step 
              title="Configuration" 
              description="Types de notes" 
              icon={<SettingOutlined />}
            />
            <Step 
              title="Importation" 
              description="Charger le fichier" 
              icon={<UploadOutlined />}
            />
            <Step 
              title="Validation" 
              description="Confirmer l'import" 
              icon={<FileDoneOutlined />}
            />
          </Steps>
        </Card>

        <Row gutter={28}>
          <Col span={10}>
            <Card 
              title={
                <span>
                  <InfoCircleOutlined style={{ marginRight: '8px' }} />
                  INFORMATIONS
                </span>
              }
              style={{ marginBottom: '16px' }}
            >
              <Descriptions column={1} size="small">
                <Descriptions.Item label="Groupe">
                  <StatusTag tone="info" label={groupeInfo?.nom || ''} />
                </Descriptions.Item>
                
                {maquetteDetail && (
                  <>
                    <Descriptions.Item label="Filière">
                      <Text strong>{maquetteDetail.maquette.filiere_nom}</Text>
                    </Descriptions.Item>
                    <Descriptions.Item label="Niveau">
                      <StatusTag tone="neutral" label={maquetteDetail.maquette.niveau_libelle} />
                    </Descriptions.Item>
                    <Descriptions.Item label="Année académique">
                      <Text>{maquetteDetail.maquette.annee_academique}</Text>
                    </Descriptions.Item>
                    <Descriptions.Item label="Parcours">
                      <StatusTag
                        tone={maquetteDetail.maquette.parcour === 'Universitaire' ? 'success' : 'warning'}
                        label={maquetteDetail.maquette.parcour}
                      />
                    </Descriptions.Item>
                  </>
                )}
              </Descriptions>
              
              <div style={{ 
                marginTop: '16px', 
                padding: '8px', 
                background: '#f0f0f0', 
                borderRadius: '4px',
                fontSize: '11px',
                color: '#666'
              }}>
                <div>📊 Debug:</div>
                <div>Matières chargées: {matieres.length}</div>
                <div>Professeurs: {professeurs.length}</div>
                <div>Fichier: {fileList.length > 0 ? fileList[0].name : 'Aucun'}</div>
                <div>Matière: {selectedMatiere?.nom || 'Aucune'}</div>
                <div>Professeur: {selectedProfesseur ? 'Sélectionné' : 'Non sélectionné'}</div>
              </div>
            </Card>

            <Card
              title={
                <span>
                  <BookOutlined style={{ marginRight: '8px' }} />
                  SÉLECTION MATIÈRE
                </span>
              }
            >
              <Form.Item
                name="matiereId"
                rules={[{ required: true, message: 'Sélection obligatoire' }]}
                style={{ marginBottom: '16px' }}
              >
                <Select
                  placeholder={loadingMatieres ? "Chargement..." : "Choisir une matière"}
                  loading={loadingMatieres}
                  size="large"
                  onChange={handleMatiereChange}
                  showSearch
                  filterOption={filterOption}
                  optionFilterProp="children"
                  allowClear
                  listHeight={300}
                  dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
                  notFoundContent={loadingMatieres ? "Chargement..." : "Aucune matière disponible"}
                >
                  {matieres.map(matiere => (
                    <Option 
                      key={matiere.id} 
                      value={matiere.id}
                    >
                      {matiere.nom}
                    </Option>
                  ))}
                </Select>
              </Form.Item>

              {/* Sélection du professeur */}
              {selectedMatiere && (
                <>
                  <Form.Item
                    label="Professeur responsable"
                    style={{ marginBottom: '16px' }}
                  >
                    <Select
                      placeholder={loadingProfesseurs ? "Chargement..." : "Sélectionner un professeur"}
                      loading={loadingProfesseurs}
                      size="large"
                      onChange={handleProfesseurChange}
                      value={selectedProfesseur}
                      showSearch
                      filterOption={filterProfesseurOption}
                      optionFilterProp="label"
                      allowClear
                      listHeight={300}
                      dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
                      notFoundContent={loadingProfesseurs ? "Chargement..." : "Aucun professeur disponible"}
                    >
                      {professeurs.map(professeur => {
                        const nomComplet = `${professeur.prenom} ${professeur.nom}`;
                        return (
                          <Option 
                            key={professeur.id} 
                            value={professeur.id}
                            label={nomComplet}
                          >
                            <div style={{ 
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '4px 0'
                            }}>
                              <span style={{ fontWeight: 500 }}>{nomComplet}</span>
                              <div style={{ marginLeft: 8 }}>
                                {professeur.id_matiere === selectedMatiere.id && (
                                  <StatusTag tone="success" label="Déjà assigné" />
                                )}
                                {professeur.id_matiere && professeur.id_matiere !== selectedMatiere.id && (
                                  <StatusTag tone="warning" label="Assigné à autre" />
                                )}
                                {!professeur.id_matiere && (
                                  <StatusTag tone="info" label="Disponible" />
                                )}
                              </div>
                            </div>
                          </Option>
                        );
                      })}
                    </Select>
                  </Form.Item>

                  {selectedProfesseur && (
                    <Alert
                      message="Professeur sélectionné"
                      description={
                        <div style={{ marginTop: '8px' }}>
                          Le professeur sera assigné à cette matière lors de l'importation des notes.
                          {professeurs.find(p => p.id === selectedProfesseur)?.id_matiere &&
                           professeurs.find(p => p.id === selectedProfesseur)?.id_matiere !== selectedMatiere.id && (
                            <div style={{ marginTop: '4px', color: 'var(--warning)' }}>
                              ⚠️ Attention: Ce professeur est déjà assigné à une autre matière.
                            </div>
                          )}
                        </div>
                      }
                      type="info"
                      showIcon
                      style={{ marginBottom: '16px' }}
                    />
                  )}
                </>
              )}

              {selectedMatiere && (
                <div style={{
                  background: 'var(--paper)',
                  padding: '16px',
                  borderRadius: '8px',
                  border: '1px solid var(--mist)',
                  marginTop: '16px'
                }}>
                  <div style={{
                    fontSize: '16px',
                    fontWeight: 'bold',
                    color: 'var(--mod-scolarite)',
                    marginBottom: '12px',
                    wordBreak: 'break-word'
                  }}>
                    {selectedMatiere.nom}
                  </div>
                  <Row gutter={16}>
                    <Col span={8}>
                      <div style={{ textAlign: 'center' }}>
                        <Text type="secondary" style={{ fontSize: '12px' }}>Coefficient</Text>
                        <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--mod-scolarite)' }}>
                          {selectedMatiere.coefficient}
                        </div>
                      </div>
                    </Col>
                    <Col span={8}>
                      <div style={{ textAlign: 'center' }}>
                        <Text type="secondary" style={{ fontSize: '12px' }}>Volume CM</Text>
                        <div style={{ fontSize: '16px', fontWeight: '500', color: 'var(--success)' }}>
                          {selectedMatiere.volume_horaire_cm}h
                        </div>
                      </div>
                    </Col>
                    <Col span={8}>
                      <div style={{ textAlign: 'center' }}>
                        <Text type="secondary" style={{ fontSize: '12px' }}>Volume TD</Text>
                        <div style={{ fontSize: '16px', fontWeight: '500', color: 'var(--warning)' }}>
                          {selectedMatiere.volume_horaire_td}h
                        </div>
                      </div>
                    </Col>
                  </Row>
                </div>
              )}
            </Card>
          </Col>

          <Col span={14}>
            <Form
              form={form}
              layout="vertical"
              onFinish={onFinish}
              initialValues={{
                noteTypes: ['Note 1']
              }}
            >
              <Card
                title={
                  <span>
                    <SettingOutlined style={{ marginRight: '8px' }} />
                    CONFIGURATION DES NOTES
                  </span>
                }
                style={{ marginBottom: '16px' }}
              >
                <Form.Item
                  label="Types de notes à importer"
                  name="noteTypes"
                  rules={[{ required: true, message: 'Sélectionnez au moins un type' }]}
                >
                  <Checkbox.Group style={{ width: '100%' }}>
                    <Row gutter={[16, 8]}>
                      {['Note 1', 'Note 2', 'Partiel'].map((type) => (
                        <Col span={8} key={type}>
                          <Checkbox value={type}>{type}</Checkbox>
                        </Col>
                      ))}
                    </Row>
                  </Checkbox.Group>
                </Form.Item>

                <Alert
                  message="Format du fichier Excel requis"
                  description={
                    <div>
                      <Text>Votre fichier doit contenir ces colonnes obligatoires :</Text>
                      <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        <StatusTag tone="info" label="CODE (matricule_iipea)" />
                        <StatusTag tone="info" label="NOM" />
                        <StatusTag tone="info" label="PRENOM" />
                        {form.getFieldValue('noteTypes')?.map((type: string) => (
                          <StatusTag tone="success" key={type} label={type.toUpperCase().replace(/ /g, '_')} />
                        ))}
                      </div>
                      <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--warning)' }}>
                        ⚠️ IMPORTANT: La colonne "CODE" doit correspondre exactement au "matricule_iipea" des étudiants dans la base de données.
                      </div>
                    </div>
                  }
                  type="info"
                  showIcon
                  style={{ marginBottom: '16px' }}
                />

                {/* Affichage des informations sur les notes existantes */}
                {checkingExistingNotes && (
                  <div style={{ textAlign: 'center', margin: '16px 0' }}>
                    <Spin size="small" />
                    <div style={{ marginTop: 8, color: '#666' }}>
                      Vérification des notes existantes...
                    </div>
                  </div>
                )}

                {existingNotesInfo && (
                  <Alert
                    message={
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <SyncOutlined />
                        <span>{existingNotesInfo.message}</span>
                      </div>
                    }
                    description={
                      <div>
                        <div style={{ marginTop: '8px', fontSize: '13px' }}>
                          <strong>Détails :</strong>
                        </div>
                        <Row gutter={16} style={{ marginTop: '8px' }}>
                          <Col span={6}>
                            <div style={{ textAlign: 'center' }}>
                              <div style={{ fontSize: '18px', fontWeight: 'bold', color: existingNotesInfo.notesExistantes ? 'var(--warning)' : 'var(--success)' }}>
                                {existingNotesInfo.etudiantsAvecNotes}/{existingNotesInfo.totalEtudiants}
                              </div>
                              <Text type="secondary">Étudiants</Text>
                            </div>
                          </Col>
                          <Col span={6}>
                            <div style={{ textAlign: 'center' }}>
                              <div style={{ fontSize: '18px', fontWeight: 'bold', color: existingNotesInfo.notesExistantes ? 'var(--warning)' : 'var(--success)' }}>
                                {existingNotesInfo.pourcentage}%
                              </div>
                              <Text type="secondary">Couverture</Text>
                            </div>
                          </Col>
                          <Col span={6}>
                            <div style={{ textAlign: 'center' }}>
                              <div style={{ fontSize: '18px', fontWeight: 'bold', color: existingNotesInfo.notesExistantes ? 'var(--warning)' : 'var(--success)' }}>
                                {existingNotesInfo.count}
                              </div>
                              <Text type="secondary">Notes</Text>
                            </div>
                          </Col>
                          <Col span={6}>
                            <div style={{ textAlign: 'center' }}>
                              <StatusTag
                                tone={existingNotesInfo.notesExistantes ? 'warning' : 'success'}
                                label={existingNotesInfo.notesExistantes ? 'MISE À JOUR' : 'NOUVELLES'}
                              />
                            </div>
                          </Col>
                        </Row>
                        {existingNotesInfo.derniereImportation && (
                          <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-soft)' }}>
                            Dernière importation: {new Date(existingNotesInfo.derniereImportation).toLocaleString()}
                          </div>
                        )}
                      </div>
                    }
                    type={existingNotesInfo.notesExistantes ? 'warning' : 'info'}
                    showIcon={false}
                    style={{ marginBottom: '16px' }}
                  />
                )}
              </Card>

              <Card
                title={
                  <span>
                    <UploadOutlined style={{ marginRight: '8px' }} />
                    IMPORTATION DU FICHIER
                  </span>
                }
                style={{ marginBottom: '16px' }}
              >
                <Form.Item
                  rules={[{ required: true, message: 'Un fichier Excel est requis' }]}
                >
                  <Upload.Dragger
                    {...uploadProps}
                    style={{
                      padding: '40px 0',
                      background: fileList.length > 0 ? 'var(--paper)' : 'var(--surface-2)',
                      border: fileList.length > 0 ? '1px solid var(--success)' : '1px dashed var(--border)'
                    }}
                  >
                    <p className="ant-upload-drag-icon">
                      <FileExcelOutlined style={{
                        fontSize: '48px',
                        color: fileList.length > 0 ? 'var(--success)' : 'var(--text-soft)'
                      }} />
                    </p>
                    <p className="ant-upload-text" style={{ fontSize: '16px', fontWeight: 500 }}>
                      {fileList.length > 0 ? 'Fichier Excel sélectionné' : 'Cliquez ou glissez-déposez votre fichier Excel'}
                    </p>
                    <p className="ant-upload-hint" style={{ fontSize: '14px' }}>
                      {fileList.length > 0 
                        ? `Fichier: ${fileList[0].name} (${Math.round((fileList[0].size || 0) / 1024)} KB)`
                        : 'Formats acceptés: .xlsx, .xls uniquement (max 5MB)'
                      }
                    </p>
                    {fileList.length === 0 && (
                      <p style={{ color: 'var(--warning)', marginTop: '8px' }}>
                        ⚠️ Un seul fichier Excel par matière
                      </p>
                    )}
                  </Upload.Dragger>
                </Form.Item>
              </Card>

              <div style={{ 
                marginTop: '24px', 
                padding: '20px', 
                background: '#fff',
                borderRadius: '8px',
                border: '1px solid #f0f0f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <Text type="secondary">
                    {selectedMatiere 
                      ? `Matière sélectionnée: ${selectedMatiere.nom}`
                      : 'Sélectionnez une matière pour commencer'
                    }
                  </Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    {selectedProfesseur 
                      ? `Professeur: ${professeurs.find(p => p.id === selectedProfesseur)?.prenom} ${professeurs.find(p => p.id === selectedProfesseur)?.nom}`
                      : 'Aucun professeur sélectionné'
                    }
                  </Text>
                  <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginTop: '4px' }}>
                    {fileList.length > 0 
                      ? `Fichier prêt: ${fileList[0].name}`
                      : 'Aucun fichier sélectionné'
                    }
                  </Text>
                  {existingNotesInfo && existingNotesInfo.notesExistantes && (
                    <div style={{ marginTop: '8px' }}>
                      <StatusTag tone="warning" icon={<WarningOutlined />} label="MISE À JOUR DES NOTES EXISTANTES" />
                    </div>
                  )}
                </div>
                
                <Space>
                  <Button
                    onClick={handleReset}
                    size="large"
                  >
                    Réinitialiser
                  </Button>
                  
                  <Button
                    type="primary"
                    htmlType="submit"
                    size="large"
                    loading={uploading}
                    icon={<UploadOutlined />}
                    disabled={fileList.length === 0 || !selectedMatiere}
                    style={{ minWidth: '180px' }}
                  >
                    {uploading ? 'Importation en cours...' : 'Importer les notes'}
                  </Button>
                </Space>
              </div>
            </Form>
          </Col>
        </Row>

        <Alert
          message="Instructions importantes"
          description={
            <div style={{ paddingLeft: '8px' }}>
              <ul style={{ marginBottom: 0 }}>
                <li><strong>Format fichier:</strong> Seul un fichier Excel (.xlsx ou .xls) est accepté pour chaque matière</li>
                <li><strong>Professeur:</strong> Si vous sélectionnez un professeur, il sera automatiquement assigné à la matière</li>
                <li><strong>Session:</strong> Les notes seront associées automatiquement à la session de l'année en cours</li>
                <li><strong>Colonne CODE:</strong> Doit contenir exactement le matricule_iipea (vérifiez dans la base de données)</li>
                <li><strong>Décimales:</strong> Utilisez la virgule (ex: 15,5)</li>
                <li><strong>Absence:</strong> Laissez vide ou mettez 0 pour les notes absentes</li>
                <li><strong>Mise à jour:</strong> Si des notes existent déjà, elles seront automatiquement mises à jour</li>
              </ul>
            </div>
          }
          type="warning"
          showIcon
          style={{ marginTop: '24px' }}
        />
      </div>

      <Modal
        title={
          <span>
            <CheckCircleOutlined style={{ color: 'var(--success)', marginRight: 8 }} />
            Résultat de l'importation
          </span>
        }
        open={showResultModal}
        onCancel={handleCloseResultModal}
        footer={[
          <Button key="close" onClick={handleCloseResultModal}>
            Fermer
          </Button>,
          <Button 
            key="view" 
            type="primary" 
            onClick={handleViewImportedNotes}
            icon={<FileDoneOutlined />}
          >
            Voir les notes importées
          </Button>,
          <Button 
            key="new" 
            onClick={() => {
              handleCloseResultModal();
              handleReset();
            }}
          >
            Nouvelle importation
          </Button>
        ]}
        width={700}
      >
        {uploadResult && (
          <div>
            <Alert
              message={uploadResult.message}
              type="success"
              showIcon
              style={{ marginBottom: 16 }}
            />
            
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="Fichier" span={2}>
                <Text strong>{uploadResult.details.fichier}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Matière">
                {uploadResult.details.matiere}
              </Descriptions.Item>
              <Descriptions.Item label="Groupe">
                {uploadResult.details.groupe}
              </Descriptions.Item>
              {selectedProfesseur && (
                <Descriptions.Item label="Professeur assigné">
                  {professeurs.find(p => p.id === selectedProfesseur)?.prenom} {professeurs.find(p => p.id === selectedProfesseur)?.nom}
                </Descriptions.Item>
              )}
              <Descriptions.Item label="Parcours">
                <StatusTag
                  tone={uploadResult.details.parcour === 'Universitaire' ? 'success' : 'warning'}
                  label={uploadResult.details.parcour}
                />
              </Descriptions.Item>
              <Descriptions.Item label="Session">
                {uploadResult.details.session}
              </Descriptions.Item>
            </Descriptions>
            
            <div style={{ marginTop: 16 }}>
              <Title level={5}>Statistiques</Title>
              <Row gutter={16}>
                <Col span={6}>
                  <Card size="small" style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 24, fontWeight: 'bold', color: 'var(--mod-scolarite)' }}>
                      {uploadResult.details.stats.totalTraitees}
                    </div>
                    <Text type="secondary">Total traité</Text>
                  </Card>
                </Col>
                <Col span={6}>
                  <Card size="small" style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 24, fontWeight: 'bold', color: 'var(--success)' }}>
                      {uploadResult.details.stats.notesInserees}
                    </div>
                    <Text type="secondary">Nouvelles notes</Text>
                  </Card>
                </Col>
                <Col span={6}>
                  <Card size="small" style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 24, fontWeight: 'bold', color: 'var(--warning)' }}>
                      {uploadResult.details.stats.notesMisesAJour}
                    </div>
                    <Text type="secondary">Notes mises à jour</Text>
                  </Card>
                </Col>
                <Col span={6}>
                  <Card size="small" style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 24, fontWeight: 'bold', color: 'var(--danger)' }}>
                      {uploadResult.details.stats.erreurs}
                    </div>
                    <Text type="secondary">Erreurs</Text>
                  </Card>
                </Col>
              </Row>
            </div>
            
            {uploadResult.avertissements && uploadResult.avertissements.etudiants && uploadResult.avertissements.etudiants.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <Alert
                  message={uploadResult.avertissements.message}
                  type="warning"
                  showIcon
                  style={{ marginBottom: 8 }}
                />
                <List
                  size="small"
                  dataSource={uploadResult.avertissements.etudiants}
                  renderItem={(item) => (
                    <List.Item>
                      <Space>
                        <UserOutlined />
                        <Text>{item.numero}</Text>
                        <Text type="secondary">{item.nom} {item.prenom}</Text>
                      </Space>
                    </List.Item>
                  )}
                  style={{ maxHeight: 150, overflow: 'auto' }}
                />
              </div>
            )}
            
            {uploadResult.erreurs && uploadResult.erreurs.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <Alert
                  message={`${uploadResult.erreurs.length} erreur(s) rencontrée(s)`}
                  type="error"
                  showIcon
                  style={{ marginBottom: 8 }}
                />
                <List
                  size="small"
                  dataSource={uploadResult.erreurs}
                  renderItem={(item) => (
                    <List.Item>
                      <Text type="danger">{item.etudiant}: {item.erreur}</Text>
                    </List.Item>
                  )}
                  style={{ maxHeight: 150, overflow: 'auto' }}
                />
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default NouvelleNote;