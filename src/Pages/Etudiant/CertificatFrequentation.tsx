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
  Table
} from 'antd';
import { 
  DownloadOutlined, 
  PrinterOutlined, 
  ArrowLeftOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../../Components/PageHeader/PageHeader';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { QRCodeSVG } from 'qrcode.react';

const { Title, Text } = Typography;

interface AnneeHistorique {
  annee: string;
  annee_id: number;
  niveau: string;
  filiere: string;
  groupe: string;
  classe: string;
  date_inscription: string;
}

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
    };
    annee_academique: {
      id: number;
      annee: string;
    };
  };
  historique_annees: AnneeHistorique[];
  historique: {
    annee_bac: string;
    serie_bac: string;
    etablissement_origine: string;
    date_inscription: string;
    statut_scolaire: string;
  };
}

const CertificatFrequentation = () => {
  const [certificatData, setCertificatData] = useState<CertificatData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const API_URL = import.meta.env.VITE_API_URL_SERVER || "";

  useEffect(() => {
    fetchCertificatData();
  }, [id]);

  const fetchCertificatData = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('token');
      if (!token) {
        message.error('Authentification requise');
        navigate('/login');
        return;
      }

      const response = await fetch(`${API_URL}/api/CertificaFrentation/CertificatFrequentation/etudiant/${id}`, {
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
        setCertificatData(result.data);
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

  const generatePDF = async () => {
    setGeneratingPdf(true);
    try {
      const element = document.getElementById('certificat-content');
      if (!element) {
        throw new Error('Element non trouvé');
      }

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      
      const fileName = `certificat_frequentation_${certificatData?.informations_personnelles?.matricule || 'inconnu'}_${new Date().toISOString().slice(0,10)}.pdf`;
      pdf.save(fileName);
      
      message.success('PDF généré avec succès');
    } catch (error) {
      console.error('Erreur génération PDF:', error);
      message.error('Erreur lors de la génération du PDF');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const printCertificat = () => {
    // Créer une nouvelle fenêtre pour l'impression
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      message.error('Impossible d\'ouvrir la fenêtre d\'impression. Autorisez les pop-ups.');
      return;
    }

    const certificatContent = document.getElementById('certificat-content');
    if (!certificatContent) return;

    // Cloner le contenu pour éviter de modifier l'original
    const contentToPrint = certificatContent.cloneNode(true) as HTMLElement;

    // Préparer le HTML pour l'impression
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Certificat de Fréquentation</title>
          <meta charset="utf-8">
          <style>
            body {
              margin: 0;
              padding: 0;
              font-family: Arial, sans-serif;
              background: white;
            }
            .certificat-container {
              width: 210mm;
              min-height: 297mm;
              margin: 0 auto;
              padding: 15mm;
              box-sizing: border-box;
              position: relative;
            }
            .watermark {
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              opacity: 0.05;
              z-index: 0;
              pointer-events: none;
              width: 400px;
              height: 400px;
            }
            .watermark img {
              width: 100%;
              height: 100%;
              object-fit: contain;
              filter: grayscale(100%);
            }
            .content {
              position: relative;
              z-index: 1;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 10px 0;
            }
            table, th, td {
              border: 1px solid #000;
            }
            th, td {
              padding: 8px;
              text-align: left;
              font-size: 12px;
            }
            th {
              background-color: #f0f0f0;
              font-weight: bold;
            }
            .text-center {
              text-align: center;
            }
            .text-strong {
              font-weight: bold;
            }
            .header-section {
              margin-bottom: 20px;
            }
            .main-title {
              text-align: center;
              font-size: 22px;
              font-weight: bold;
              text-transform: uppercase;
              color: #003366;
              margin: 20px 0;
              border: 2px solid #003366;
              border-radius: 10px;
              padding: 10px;
              background-color: #f0f8ff;
            }
            .section {
              margin-bottom: 15px;
            }
            .signature-section {
              margin-top: 40px;
              text-align: center;
            }
            .footer {
              margin-top: 30px;
              padding-top: 10px;
              border-top: 1px solid #ccc;
              font-size: 11px;
              color: #666;
              text-align: center;
            }
            @media print {
              body {
                margin: 0;
                padding: 0;
              }
              .certificat-container {
                width: 100%;
                height: 100%;
                margin: 0;
                padding: 15mm;
              }
            }
          </style>
        </head>
        <body>
          <div class="certificat-container">
            <div class="watermark">
              <img src="/logo.png" alt="Filigrane">
            </div>
            <div class="content">
              ${contentToPrint.innerHTML}
            </div>
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    
    // Attendre que les images soient chargées avant d'imprimer
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
        // printWindow.close();
      }, 500);
    };
  };

  // Colonnes pour le tableau des années académiques
  const anneesColumns = [
    {
      title: 'Année Académique',
      dataIndex: 'annee',
      key: 'annee',
      width: '20%',
      render: (annee: string) => <Text strong>{annee}</Text>
    },
    {
      title: 'Niveau',
      dataIndex: 'niveau',
      key: 'niveau',
      width: '20%'
    },
    {
      title: 'Filière',
      dataIndex: 'filiere',
      key: 'filiere',
      width: '60%'
    },
  ];

  // Données pour le QR Code (sécurisé)
  const qrCodeValue = certificatData ? JSON.stringify({
    nom: certificatData.informations_personnelles.nom,
    prenoms: certificatData.informations_personnelles.prenoms,
    matricule: certificatData.informations_personnelles.matricule,
    code_unique: certificatData.informations_personnelles.code_unique,
    annee_en_cours: certificatData.informations_academiques.annee_academique?.annee || 'Non spécifié',
  }) : '';

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center', minHeight: '50vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <PageHeader />
        <Spin size="large">
          <div>Chargement du certificat de fréquentation...</div>
        </Spin>
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
              onClick={fetchCertificatData}
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
            <Text>Données du certificat de fréquentation non disponibles ou incomplètes</Text>
            <div style={{ marginTop: 16 }}>
              <Button 
                icon={<ReloadOutlined />} 
                onClick={fetchCertificatData}
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

  const { informations_personnelles, historique_annees } = certificatData;

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
            <Button 
              type="primary" 
              icon={<DownloadOutlined />}
              loading={generatingPdf}
              onClick={generatePDF}
            >
              Télécharger PDF
            </Button>
            <Button 
              icon={<PrinterOutlined />}
              onClick={printCertificat}
            >
              Imprimer
            </Button>
            <Button 
              icon={<ReloadOutlined />}
              onClick={fetchCertificatData}
            >
              Actualiser
            </Button>
          </Space>
        </div>

        {/* Certificat de Fréquentation */}
        <Card id="certificat-content" style={{ 
          border: '2px solid #d9d9d9',
          borderRadius: 4,
          padding: 30,
          background: 'white',
          maxWidth: 800,
          margin: '0 auto',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          
          {/* Filigrane logo en fond */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            opacity: 0.05,
            zIndex: 0,
            pointerEvents: 'none',
            width: '400px',
            height: '400px'
          }}>
            <img 
              src="/logo.png" 
              alt="Filigrane IIPEA" 
              style={{ 
                width: '100%', 
                height: '100%',
                objectFit: 'contain',
                filter: 'grayscale(100%)'
              }} 
            />
          </div>

          {/* Contenu du certificat */}
          <div style={{ position: 'relative', zIndex: 1 }}>
            
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
                  padding: '10px 150px',
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
                    CERTIFICAT DE FRÉQUENTATION
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

            {/* Historique complet des années académiques */}
            <Row style={{ marginBottom: 25 }}>
              <Col span={24}>
                
                {historique_annees && historique_annees.length > 0 ? (
                  <Table 
                    dataSource={historique_annees} 
                    columns={anneesColumns} 
                    pagination={false}
                    size="small"
                    bordered
                    rowKey="annee_id"
                  />
                ) : (
                  <Text style={{ fontStyle: 'italic' }}>
                    Aucun historique académique disponible
                  </Text>
                )}
                
                <Text style={{ fontSize: '14px', display: 'block', marginTop: 20 }}>
                  a fréquenté régulièrement les cours de l'Institut International Polytechnique des Elites d'Abidjan (IIPEA) 
                  depuis son inscription le {certificatData.historique.date_inscription ? 
                    new Date(certificatData.historique.date_inscription).toLocaleDateString('fr-FR') : 'Non spécifié'}.
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
                  Ce certificat atteste de la fréquentation régulière de l'étudiant depuis son inscription à l'IIPEA.
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
          </div>
        </Card>
      </Space>
    </div>
  );
};

export default CertificatFrequentation;