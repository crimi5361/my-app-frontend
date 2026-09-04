/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Typography,
  Spin,
  Button,
  message,
  Image,
  Space,
  Table,
  Select
} from 'antd';
import { 
  PrinterOutlined, 
  ArrowLeftOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../../Components/PageHeader/PageHeader';
import { QRCodeSVG } from 'qrcode.react';

const { Title, Text } = Typography;

interface CertificatData {
  informations_personnelles: {
    id: number;
    matricule: string;
    code_unique: string;
    nom: string;
    prenoms: string;
    date_naissance: string;
    lieu_naissance: string;
    sexe: string;
    nationalite: string;
    telephone: string;
    email: string;
    contact_etudiant: string;
    contact_parent: string;
    contact_parent_2: string;
    lieu_residence: string;
    photo_url: string;
    matricule_iipea: string;
    pays_naissance: string;
    nom_parent_1: string;
    nom_parent_2: string;
  };
  informations_academiques: {
    filiere: {
      id: number;
      nom: string;
      sigle: string;
    };
    niveau: {
      id: number;
      libelle: string;
      prix_formation: string;
    };
    annee_academique: {
      id: number;
      annee: string;
      etat: string;
    };
    groupe: {
      id: number;
      nom: string;
      capacite_max: number;
    };
    classe: {
      id: number;
      nom: string;
    };
  };
  historique: {
    annee_bac: string;
    serie_bac: string;
    etablissement_origine: string;
    date_inscription: string;
    statut_scolaire: string;
  };
  documents: {
    extrait_naissance: string;
    justificatif_identite: string;
    dernier_diplome: string;
    fiche_orientation: string;
  };
  scolarite: {
    montant: string;
    verse: string;
    restant: string;
  };
}

// Chantier "Fiche étudiant + Historique PEC + Certificats par année" (2026-09-04) — année
// académique sélectionnable, année courante par défaut (comportement identique à avant ce
// chantier si l'agent ne touche pas le sélecteur). Liste des années réutilisée telle quelle
// depuis /api/caisse/etudiant/:id/annees (déjà utilisée par DetailEtudiant.tsx pour l'historique
// financier) — précisément les années où CET étudiant a une position, pas la liste globale du site.
interface AnneeOption {
  annee_academique_id: number;
  annee: string;
  is_current: boolean;
}

const CertificatScolarite = () => {
  const [certificatData, setCertificatData] = useState<CertificatData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [annees, setAnnees] = useState<AnneeOption[]>([]);
  const [selectedAnneeId, setSelectedAnneeId] = useState<number | null>(null);
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const API_URL = import.meta.env.VITE_API_URL_SERVER || "";

  useEffect(() => {
    initCertificat();
  }, [id]);

  const initCertificat = async () => {
    const anneeCourante = await fetchAnnees();
    await fetchCertificatData(anneeCourante);
  };

  const fetchAnnees = async (): Promise<number | null> => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/caisse/etudiant/${id}/annees`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) return null;
      const result = await response.json();
      if (!result.success) return null;
      const liste: AnneeOption[] = result.data.annees || [];
      setAnnees(liste);
      const courante = liste.find((a) => a.is_current) || liste[0];
      const anneeId = courante ? courante.annee_academique_id : null;
      setSelectedAnneeId(anneeId);
      return anneeId;
    } catch {
      return null;
    }
  };

  const handleChangeAnnee = (anneeId: number) => {
    setSelectedAnneeId(anneeId);
    fetchCertificatData(anneeId);
  };

  const fetchCertificatData = async (anneeAcademiqueId?: number | null) => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('token');
      if (!token) {
        message.error('Authentification requise');
        navigate('/login');
        return;
      }

      const anneeQuery = anneeAcademiqueId ? `?anneeAcademiqueId=${anneeAcademiqueId}` : '';
      const response = await fetch(`${API_URL}/api/CertificatScolarite/certificat/etudiant/${id}${anneeQuery}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        message.error('Session expirée');
        navigate('/login');
        return;
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erreur ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      
      if (result.success) {
        // Gestion flexible de la structure des données
        let dataToSet;
        
        if (Array.isArray(result.data) && result.data.length > 0) {
          dataToSet = result.data[0];
        } else if (typeof result.data === 'object' && result.data !== null) {
          dataToSet = result.data;
        } else {
          throw new Error('Format de données non supporté');
        }
        
        setCertificatData(dataToSet);
      } else {
        setError(result.message || 'Données non trouvées');
        message.error(result.message || 'Données non trouvées');
      }
    } catch (error) {
      console.error('Erreur:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erreur de connexion';
      setError(errorMessage);
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };


  const printCertificat = () => {
    window.print();
  };

  // Données pour le tableau des informations académiques
  const academicData = [
    {
      key: '1',
      libelle: 'Filière',
      valeur: certificatData?.informations_academiques?.filiere?.nom || 'Non spécifié'
    },
    {
      key: '2',
      libelle: 'Niveau',
      valeur: certificatData?.informations_academiques?.niveau?.libelle || 'Non spécifié'
    },
    {
      key: '3',
      libelle: 'Année académique',
      valeur: certificatData?.informations_academiques?.annee_academique?.annee || 'Non spécifié'
    },
    {
      key: '4',
      libelle: 'Date d\'inscription',
      valeur: certificatData?.historique?.date_inscription ? 
        new Date(certificatData.historique.date_inscription).toLocaleDateString('fr-FR') : 'Non spécifié'
    }
  ];

  // Colonnes pour le tableau
  const columns = [
    {
      title: 'Information',
      dataIndex: 'libelle',
      key: 'libelle',
      width: '40%',
      render: (text: string) => <Text strong>{text}</Text>
    },
    {
      title: 'Valeur',
      dataIndex: 'valeur',
      key: 'valeur',
      width: '60%'
    }
  ];

  // Données pour le QR Code
  const qrCodeValue = certificatData ? JSON.stringify({
    nom: certificatData.informations_personnelles.nom,
    prenoms: certificatData.informations_personnelles.prenoms,
    matricule: certificatData.informations_personnelles.matricule,
    code_unique: certificatData.informations_personnelles.code_unique,
    filiere: certificatData.informations_academiques.filiere.nom,
    niveau: certificatData.informations_academiques.niveau.libelle,
    annee_academique: certificatData.informations_academiques.annee_academique.annee
  }) : '';

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <PageHeader />
        <Spin size="large" tip="Chargement du certificat..." />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <PageHeader />
        <Card>
          <div style={{ textAlign: 'center', padding: 20 }}>
            <Text type="danger" style={{ display: 'block', marginBottom: 16 }}>
              {error}
            </Text>
            <Button 
              icon={<ReloadOutlined />} 
              onClick={() => fetchCertificatData(selectedAnneeId)}
              type="primary"
            >
              Réessayer
            </Button>
            <Button 
              icon={<ArrowLeftOutlined />} 
              onClick={() => navigate('/Etudiant/Listes_Etudiant')}
              style={{ marginLeft: 16 }}
            >
              Retour
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (!certificatData || !certificatData.informations_personnelles) {
    return (
      <div style={{ padding: 24 }}>
        <PageHeader />
        <Card>
          <div style={{ textAlign: 'center', padding: 20 }}>
            <Text>Données du certificat non disponibles ou incomplètes</Text>
            <div style={{ marginTop: 16 }}>
              <Button 
                icon={<ReloadOutlined />} 
                onClick={() => fetchCertificatData(selectedAnneeId)}
                style={{ marginRight: 8 }}
              >
                Réessayer
              </Button>
              <Button 
                icon={<ArrowLeftOutlined />} 
                onClick={() => navigate('/Etudiant/Listes_Etudiant')}
              >
                Retour
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const { informations_personnelles } = certificatData;

  // Sécurisation des données
  const safePhotoUrl = informations_personnelles.photo_url || '/default-avatar.png';
  const safeDateNaissance = informations_personnelles.date_naissance ? 
    new Date(informations_personnelles.date_naissance).toLocaleDateString('fr-FR') : 'Non spécifié';
  const safeLieuNaissance = informations_personnelles.lieu_naissance || 'Non spécifié';
  const safeNationalite = informations_personnelles.nationalite === 'CI' ? 'IVOIRIENNE' : informations_personnelles.nationalite || 'Non spécifié';

  return (
    <div style={{ padding: 24 }}>
      <PageHeader />
      
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div className="no-print">
          <Button 
            icon={<ArrowLeftOutlined />} 
            onClick={() => navigate('/Etudiant/Listes_Etudiant')}
            style={{ marginBottom: 16, marginRight: 8 }}
          >
            Retour à la liste
          </Button>

          <Space>
            <Text strong>Année académique :</Text>
            <Select
              value={selectedAnneeId ?? undefined}
              onChange={handleChangeAnnee}
              style={{ width: 160 }}
              options={annees.map((a) => ({ value: a.annee_academique_id, label: a.annee }))}
              placeholder="Année"
            />
            {/* <Button
              type="primary"
              icon={<DownloadOutlined />}
              loading={generatingPdf}
              onClick={generatePDF}
            >
              Télécharger PDF
            </Button> */}
            <Button
              icon={<PrinterOutlined />}
              onClick={printCertificat}
            >
              Imprimer
            </Button>
            <Button 
              icon={<ReloadOutlined />}
              onClick={() => fetchCertificatData(selectedAnneeId)}
            >
              Actualiser
            </Button>
          </Space>
        </div>

        {/* Certificat de Scolarité */}
        <Card id="certificat-content" style={{ 
          border: '2px solid #d9d9d9',
          borderRadius: 4,
          padding: 30,
          background: 'white',
          maxWidth: 800,
          margin: '0 auto',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          

          {/* En-tête avec informations ministère */}
          <Row justify="space-between" align="top" style={{ marginBottom: 15 }}>
            <Col span={10} style={{ textAlign: 'left' }}>
              <Text strong style={{ fontSize: '10px', color: '#003366', display: 'block' }}>
                MINISTÈRE DE L'ENSEIGNEMENT SUPÉRIEUR
              </Text>
              <Text strong style={{ fontSize: '10px', color: '#003366', display: 'block' }}>
                ET DE LA RECHERCHE SCIENTIFIQUE
              </Text>
            </Col>
            
            <Col span={10} style={{ textAlign: 'right' }}>
              <Text style={{ fontSize: '10px', color: '#003366', display: 'block' }}>
                RÉPUBLIQUE DE CÔTE D'IVOIRE
              </Text>
              <Text style={{ fontSize: '10px', color: '#003366', display: 'block' }}>
                Union - Discipline - Travail
              </Text>
            </Col>
          </Row>

          {/* Barre de soulignement */}
          <div style={{ 
            borderBottom: '3px solid #003366', 
            marginBottom: 20,
            width: '100%'
          }}></div>
          {/* Logo et nom de l'école */}
          <Row justify="center" align="middle" style={{ marginBottom: 20 }}>
            <Col>
              <img 
                src="/IIPEA-Photoroom.png" 
                alt="Logo IIPEA" 
                style={{ height: 60, width: 'auto', marginRight: 15 }} 
              />
            </Col>
            <Col>
              <Text strong style={{ 
                fontSize: '16px', 
                color: '#003366',
                display: 'block',
                textAlign: 'center'
              }}>
                Institut International Polytechnique des Elites d'Abidjan - (IIPEA)
              </Text>
            </Col>
          </Row>

          {/* Titre Principal */}
          <Row justify="center" style={{ marginBottom: 20 }}>
            <Col>
              <div style={{
                border: '2px solid #003366',
                borderRadius: '10px',
                padding: '10px 200px',
                textAlign: 'center',
                backgroundColor: '#f0f8ff'
              }}>
                <Title level={1} style={{ 
                  color: '#003366', 
                  textAlign: 'center',
                  fontSize: '22px',
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  margin: 0
                }}>
                  CERTIFICAT DE SCOLARITE
                </Title>
              </div>
            </Col>
          </Row>

          {/* Année universitaire */}
          <Row justify="center" style={{ marginBottom: 25 }}>
            <Col>
              <Text strong style={{ 
                fontSize: '16px', 
                color: '#003366',
                display: 'block',
                textAlign: 'center'
              }}>
                ANNÉE UNIVERSITAIRE : {certificatData.informations_academiques.annee_academique.annee}
              </Text>
            </Col>
          </Row>

          {/* Corps du Certificat */}
          <Row gutter={[20, 0]} style={{ marginBottom: 25 }}>
            {/* Informations Personnelles */}
            <Col xs={24} md={16}>
              <Text strong style={{ fontSize: '14px', display: 'block', marginBottom: 15 }}>
                Nous certifions que,
              </Text>
              
              <div style={{ marginBottom: 10 }}>
                <Text strong>Etudiant(e) : </Text>
                <Text> {informations_personnelles.nom} {informations_personnelles.prenoms}</Text>
              </div>
              
              <div style={{ marginBottom: 10 }}>
                <Text strong>Né(e) le : </Text>
                <Text>{safeDateNaissance} à {safeLieuNaissance}</Text>
              </div>
              
              <div style={{ marginBottom: 10 }}>
                <Text strong>Nationalité : </Text>
                <Text>{safeNationalite}</Text>
              </div>
              
              <div style={{ marginBottom: 10 }}>
                <Text strong>Matricule IIPEA : </Text>
                <Text>{informations_personnelles.matricule_iipea}</Text>
              </div>
              <div style={{ marginBottom: 10 }}>
                <Text strong>Elites-ID : </Text>
                <Text>{informations_personnelles.code_unique}</Text>
              </div>
              
              <div style={{ marginBottom: 10 }}>
                <Text strong>Matricule MESRS : </Text>
                <Text>{informations_personnelles.matricule}</Text>
              </div>
            </Col>

            {/* Photo */}
            <Col xs={24} md={8}>
              <div style={{ textAlign: 'center' }}>
                <Image
                  src={`${API_URL}${safePhotoUrl}`}
                  alt="Photo étudiant"
                  style={{
                    width: 120,
                    height: 150,
                    borderRadius: 4,
                    border: '1px solid #d9d9d9',
                    objectFit: 'cover'
                  }}
                  fallback="/default-avatar.png"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = '/default-avatar.png';
                  }}
                />
              </div>
            </Col>
          </Row>

          {/* Informations Académiques sous forme de tableau */}
          <Row style={{ marginBottom: 25 }}>
            <Col span={24}>
              <Table 
                dataSource={academicData} 
                columns={columns} 
                pagination={false}
                showHeader={false}
                size="small"
                bordered
              />
              
              <Text style={{ fontSize: '14px', display: 'block', marginTop: 20 }}>
                est régulièrement inscrit(e) au titre de l'année académique {certificatData.informations_academiques.annee_academique.annee}, 
                à l'Institut International Polytechnique des Elites d'Abidjan (IIPEA).
              </Text>
            </Col>
          </Row>

          {/* QR Code et Signature */}
          <Row justify="space-between" align="bottom" style={{ marginTop: 40 }}>
            <Col span={8}>
              <div style={{ textAlign: 'center' }}>
                {qrCodeValue && (
                  <QRCodeSVG
                    value={qrCodeValue} 
                    size={120}
                    level="M"
                  />
                )}
                <Text style={{ fontSize: '10px', display: 'block', marginTop: 5 }}>
                  Code de vérification
                </Text>
              </div>
            </Col>
            
            <Col span={10}>
              <div style={{ textAlign: 'center' }}>
                <Text style={{ display: 'block', marginBottom: 40 }}>
                  Fait à Abidjan, le {new Date().toLocaleDateString('fr-FR')}
                </Text>
                
                <div style={{ borderTop: '1px solid #000', width: 200, margin: '0 auto' }}>
                  <Text strong>Le Directeur des Études</Text>
                </div>
              </div>
            </Col>
          </Row>

          {/* Notes de bas de page */}
          <Row style={{ marginTop: 40, borderTop: '1px solid #d9d9d9', paddingTop: 15 }}>
            <Col span={24}>
              <Text type="secondary" style={{ fontSize: '11px', display: 'block' }}>
                <strong>NB:</strong> L'authenticité du présent document peut être vérifiée en scannant le QR code ou auprès du service scolarité.
              </Text>
              <Text type="secondary" style={{ fontSize: '11px', display: 'block' }}>
                Ce certificat doit être imprimé en couleur.
              </Text>
            </Col>
          </Row>

          {/* Pied de page */}
          <Row style={{ marginTop: 20 }}>
            <Col span={24} style={{ textAlign: 'center' }}>
              <Text type="secondary" style={{ fontSize: '11px', display: 'block' }}>
                Cocody Riviera 2, Route d'Attoban / Riviera Triangle /Abobo/ Yamoussoukro 
                Tel : +225 05 44 02 60 60 / +225 07 08 08 87 87
              </Text>
              <Text type="secondary" style={{ fontSize: '11px', display: 'block' }}>
                Email : secretariat@iipea.com | Copyright © IIPEA Tous droits réservés
              </Text>
            </Col>
          </Row>
        </Card>
      </Space>

      {/* Styles d'impression */}
      <style>
        {`
          @media print {
            body * {
              visibility: hidden;
            }
            #certificat-content, #certificat-content * {
              visibility: visible;
            }
            #certificat-content {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              padding: 20px;
              border: none !important;
              box-shadow: none !important;
            }
            .no-print {
              display: none !important;
            }
          }
        `}
      </style>
    </div>
  );
};

export default CertificatScolarite;