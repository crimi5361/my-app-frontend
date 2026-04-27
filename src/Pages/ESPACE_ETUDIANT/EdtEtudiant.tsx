/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Card, 
  Typography, 
  Button,
  Spin,
  message,
  Row,
  Col,
  Empty,
  Alert,
  Divider
} from 'antd';
import { 
  ArrowLeftOutlined,
  DownloadOutlined,
  FilePdfOutlined,
  FileWordOutlined,
  FileExcelOutlined,
  CalendarOutlined,
} from '@ant-design/icons';

const { Title, Text } = Typography;

interface EmploiDuTemps {
  id: number;
  groupe_id: number;
  file_path: string;
  original_name: string;
  uploaded_at: string;
  file_extension?: string;
}

interface GroupeEtudiant {
  id: number;
  nom: string;
  classe_nom: string;
}

const EdtEtudiant = () => {
  const navigate = useNavigate();
  const [emploiDuTemps, setEmploiDuTemps] = useState<EmploiDuTemps | null>(null);
  const [groupe, setGroupe] = useState<GroupeEtudiant | null>(null);
  const [loading, setLoading] = useState(true);
  const API_URL = import.meta.env.VITE_API_URL_SERVER || "";

  useEffect(() => {
    fetchEmploiDuTempsEtudiant();
  }, []);

  const fetchEmploiDuTempsEtudiant = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const studentId = localStorage.getItem('user_id');
      
      if (!token || !studentId) {
        message.error('Session invalide. Veuillez vous reconnecter.');
        setLoading(false);
        return;
      }

      // 1. Récupérer les infos de l'étudiant
      const responseEtudiant = await fetch(`${API_URL}/api/donneeespaceetudiant/profile/${studentId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const dataEtudiant = await responseEtudiant.json();
      
      console.log('Profil étudiant:', dataEtudiant);
      
      // 2. Extraction du groupe_id
      let groupeId;
      let nomGroupe = '';
      
      if (dataEtudiant.informations_academiques) {
        groupeId = dataEtudiant.informations_academiques.groupe_id || 
                   dataEtudiant.informations_academiques.id_groupe;
        
        nomGroupe = dataEtudiant.informations_academiques.groupe || '';
        
        console.log('Groupe ID trouvé:', groupeId);
        console.log('Nom du groupe:', nomGroupe);
      }

      if (groupeId) {
        // 3. Récupérer DIRECTEMENT l'emploi du temps
        const responseEdt = await fetch(`${API_URL}/api/emploiDuTemps/${groupeId}/emploi-du-temps`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        // Vérifie si la réponse est du JSON
        const responseText = await responseEdt.text();
        let dataEdt;
        
        try {
          dataEdt = JSON.parse(responseText);
          console.log('Emploi du temps:', dataEdt);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (error) {
          console.error('La réponse n\'est pas du JSON:', responseText);
          throw new Error('Format de réponse invalide');
        }
        
        if (dataEdt.success && dataEdt.data) {
          const edt = dataEdt.data;
          const extension = edt.original_name.split('.').pop()?.toLowerCase();
          setEmploiDuTemps({
            ...edt,
            file_extension: extension
          });
          
          // Set le groupe avec les infos que tu as déjà
          setGroupe({
            id: groupeId,
            nom: nomGroupe,
            classe_nom: dataEtudiant.informations_academiques.classe || ''
          });
        } else {
          setEmploiDuTemps(null);
          setGroupe({
            id: groupeId,
            nom: nomGroupe,
            classe_nom: dataEtudiant.informations_academiques.classe || ''
          });
        }
      } else {
        console.error('Aucun groupe_id trouvé dans le profil étudiant');
        message.error('Impossible de trouver votre groupe');
        setEmploiDuTemps(null);
      }
    } catch (error) {
      console.error('Erreur chargement EDT étudiant:', error);
      message.error('Erreur lors du chargement de votre emploi du temps');
      setEmploiDuTemps(null);
    } finally {
      setLoading(false);
    }
  };

  const getFileIcon = (extension?: string) => {
    switch (extension) {
      case 'pdf':
        return <FilePdfOutlined style={{ color: '#ff4d4f', fontSize: '24px' }} />;
      case 'doc':
      case 'docx':
        return <FileWordOutlined style={{ color: '#1890ff', fontSize: '24px' }} />;
      case 'xls':
      case 'xlsx':
        return <FileExcelOutlined style={{ color: '#52c41a', fontSize: '24px' }} />;
      default:
        return <FilePdfOutlined style={{ fontSize: '24px' }} />;
    }
  };

  const getFileTypeText = (extension?: string) => {
    switch (extension) {
      case 'pdf':
        return 'PDF';
      case 'doc':
      case 'docx':
        return 'Document Word';
      case 'xls':
      case 'xlsx':
        return 'Fichier Excel';
      default:
        return 'Fichier';
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" />
        <div style={{ marginLeft: '16px' }}>Chargement de votre emploi du temps...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      <div style={{ padding: '16px' }}>
        {/* Header avec bouton retour */}
        <div style={{ marginBottom: '24px' }}>
          <Button 
            type="text" 
            icon={<ArrowLeftOutlined />} 
            onClick={() => navigate(-1)}
            style={{ marginBottom: '16px' }}
          >
            Retour
          </Button>
          
          <Title level={2} style={{ margin: 0, fontSize: '24px' }}>
            <CalendarOutlined /> Mon Emploi du Temps
          </Title>
          
          {groupe && (
            <Text type="secondary">
              Groupe: {groupe.nom} | Classe: {groupe.classe_nom}
            </Text>
          )}
        </div>

        {/* Content */}
        <Row justify="center">
          <Col xs={24} sm={22} md={20} lg={18} xl={16}>
            {emploiDuTemps ? (
              <Card>
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  {getFileIcon(emploiDuTemps.file_extension)}
                  
                  <Title level={3} style={{ marginTop: '16px', marginBottom: '8px' }}>
                    {emploiDuTemps.original_name}
                  </Title>
                  
                  <Text type="secondary" style={{ display: 'block', marginBottom: '16px' }}>
                    {getFileTypeText(emploiDuTemps.file_extension)} • 
                    Mis à jour le: {new Date(emploiDuTemps.uploaded_at).toLocaleDateString()}
                  </Text>
                  
                  <Divider />
                  
                  <Alert 
                    message="Information" 
                    description="Votre emploi du temps est disponible en téléchargement. Consultez-le régulièrement pour rester informé des changements."
                    type="info" 
                    showIcon 
                    style={{ marginBottom: '20px' }}
                  />
                  
                  <Button 
                    type="primary" 
                    icon={<DownloadOutlined />}
                    size="large"
                    href={`${API_URL}/api/emploiDuTemps/emploi-du-temps/${emploiDuTemps.id}/download`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ marginRight: '12px' }}
                  >
                    Télécharger
                  </Button>
                </div>
              </Card>
            ) : (
              <Card>
                <Empty 
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    <div>
                      <Title level={4} style={{ color: '#8c8c8c' }}>
                        Votre emploi du temps n'est pas encore disponible
                      </Title>
                      <Text type="secondary">
                        L'administration n'a pas encore uploadé l'emploi du temps pour votre groupe.
                        Veuillez revenir ultérieurement ou contacter votre administrateur.
                      </Text>
                    </div>
                  }
                >
                  <Button 
                    type="primary"
                    onClick={fetchEmploiDuTempsEtudiant}
                    loading={loading}
                  >
                    Actualiser
                  </Button>
                </Empty>
              </Card>
            )}
          </Col>
        </Row>

        {/* Informations supplémentaires */}
        {emploiDuTemps && (
          <Row style={{ marginTop: '24px' }}>
            <Col span={24}>
              <Alert
                message="Conseil d'utilisation"
                description="Téléchargez et imprimez votre emploi du temps pour l'avoir toujours avec vous. Vérifiez régulièrement les mises à jour."
                type="warning"
                showIcon
              />
            </Col>
          </Row>
        )}
      </div>
    </div>
  );
};

export default EdtEtudiant;