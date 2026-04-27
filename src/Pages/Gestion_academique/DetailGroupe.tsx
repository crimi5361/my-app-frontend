/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Card, 
  Table, 
  Typography, 
  Button,
  Tag,
  Spin,
  message,
  Descriptions,
  Row,
  Col,
  Statistic,
  Modal,
  Form,
  Upload,
  Space,
  Tooltip
} from 'antd';
import { 
  TeamOutlined, 
  UserOutlined,
  ArrowLeftOutlined,
  DownloadOutlined,
  FilePdfOutlined,
  UploadOutlined,
  FileOutlined,
  EyeOutlined,
  FileExcelOutlined,
  CalendarOutlined,
  BarChartOutlined,
  FileTextOutlined,
  FileDoneOutlined
} from '@ant-design/icons';
import PageHeader from '../../Components/PageHeader/PageHeader';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { UploadFile, UploadProps } from 'antd';
import * as XLSX from 'xlsx';

const { Title, Text } = Typography;

interface Etudiant {
  id: number;
  matricule_iipea: string;
  nom: string;
  prenoms: string;
  telephone: string;
  email: string;
  photo_url: string;
  filiere: string;
  niveau: string;
  cursus: string;
  statut_scolaire: string;
  matricule: string;
  code_unique: string;
}

interface GroupeDetail {
  id: number;
  nom: string;
  capacite_max: number;
  effectif: number;
  taux_remplissage: number;
  classe_nom: string;
  etudiants: Etudiant[];
}

interface EmploiDuTemps {
  id: number;
  groupe_id: number;
  file_path: string;
  original_name: string;
  uploaded_at: string;
}

// Helper function to safely extract an error message
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

const DetailGroupe = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [groupe, setGroupe] = useState<GroupeDetail | null>(null);
  const [emploiDuTemps, setEmploiDuTemps] = useState<EmploiDuTemps | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingEdt, setLoadingEdt] = useState(false);
  const [loadingCertificats, setLoadingCertificats] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [form] = Form.useForm();
  const tableRef = useRef<HTMLDivElement>(null);
  const API_URL = import.meta.env.VITE_API_URL_SERVER || "";

  useEffect(() => {
    if (id) {
      fetchGroupeDetail(id);
      fetchEmploiDuTemps(id);
    }
  }, [id]);

  const fetchGroupeDetail = async (groupeId: string) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/classes/groupe/${groupeId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      
      if (data.success) {
        setGroupe(data.data);
      }
    } catch (error) {
      message.error('Erreur lors du chargement des détails du groupe');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmploiDuTemps = async (groupeId: string) => {
    setLoadingEdt(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/emploiDuTemps/${groupeId}/emploi-du-temps`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      
      if (data.success) {
        setEmploiDuTemps(data.data);
      } else {
        setEmploiDuTemps(null);
      }
    } catch (error) {
      message.error('Erreur lors du chargement de l\'emploi du temps');
      setEmploiDuTemps(null);
    } finally {
      setLoadingEdt(false);
    }
  };

  // Fonction pour générer les certificats en masse pour le groupe
  const handleMassDownloadCertificats = async (type: 'scolarite' | 'frequentation') => {
    if (!groupe || !id) {
      message.error('Groupe non trouvé');
      return;
    }

    try {
      setLoadingCertificats(type);
      
      const token = localStorage.getItem('token');
      const departement_id = localStorage.getItem('departement_id');
      
      if (!token || !departement_id) {
        message.error('Authentification requise');
        return;
      }

      message.loading({ 
        content: `Génération des certificats de ${type === 'scolarite' ? 'scolarité' : 'fréquentation'} pour le groupe ${groupe.nom}...`, 
        key: 'mass-download',
        duration: 2 
      });

      // Utiliser le bon endpoint selon le type
      const endpoint = type === 'scolarite' 
        ? `${API_URL}/api/Certificat_Scolarite/certificats/html/masse/groupe`
        : `${API_URL}/api/certificats-frequentation/certificats-frequentation/html/masse/groupe`;

      // Créer un formulaire pour soumettre la requête POST
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = endpoint;
      form.target = '_blank';
      
      // Ajouter le token d'authentification
      const tokenInput = document.createElement('input');
      tokenInput.type = 'hidden';
      tokenInput.name = 'token';
      tokenInput.value = token;
      form.appendChild(tokenInput);
      
      // Ajouter l'ID du département
      const departementInput = document.createElement('input');
      departementInput.type = 'hidden';
      departementInput.name = 'departement_id';
      departementInput.value = departement_id;
      form.appendChild(departementInput);
      
      // Ajouter l'ID du groupe
      const groupeInput = document.createElement('input');
      groupeInput.type = 'hidden';
      groupeInput.name = 'groupe_id';
      groupeInput.value = id;
      form.appendChild(groupeInput);
      
      // Pour les certificats de fréquentation, ajouter le type
      if (type === 'frequentation') {
        const typeInput = document.createElement('input');
        typeInput.type = 'hidden';
        typeInput.name = 'type_certificat';
        typeInput.value = type;
        form.appendChild(typeInput);
      }
      
      // Ajouter le formulaire à la page et le soumettre
      document.body.appendChild(form);
      form.submit();
      document.body.removeChild(form);

      message.success({ 
        content: `Certificats de ${type === 'scolarite' ? 'scolarité' : 'fréquentation'} générés pour le groupe ${groupe.nom}!`, 
        key: 'mass-download' 
      });

    } catch (error) {
      const errorMessage = getErrorMessage(error);
      console.error('Erreur génération certificats:', error);
      message.error({ 
        content: `Erreur lors de la génération: ${errorMessage}`, 
        key: 'mass-download' 
      });
    } finally {
      setLoadingCertificats(null);
    }
  };

  const handleUpload = async () => {
    try {
      await form.validateFields();
      
      if (fileList.length === 0) {
        message.error('Veuillez sélectionner un fichier');
        return;
      }
      
      const file = fileList[0] as unknown as File;
      const formData = new FormData();
      formData.append('emploiDuTemps', file);

      const token = localStorage.getItem('token');
      
      const response = await fetch(`${API_URL}/api/emploiDuTemps/${id}/emploi-du-temps`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const result = await response.json();
      
      if (result.success) {
        message.success('Emploi du temps téléchargé avec succès !');
        setModalVisible(false);
        form.resetFields();
        setFileList([]);
        fetchEmploiDuTemps(id!);
      } else {
        message.error(result.message || 'Erreur lors du téléchargement');
      }
    } catch (error) {
      console.error('Upload error:', error);
      message.error('Erreur lors du téléchargement');
    }
  };

  const uploadProps: UploadProps = {
    onRemove: (file) => {
      const index = fileList.indexOf(file);
      const newFileList = fileList.slice();
      newFileList.splice(index, 1);
      setFileList(newFileList);
    },
    beforeUpload: (file) => {
      setFileList([...fileList, file]);
      return false;
    },
    fileList,
    accept: '.pdf,.doc,.docx,.xlsx,.xls,.xlsm'
  };

  // Générer la liste PDF avec zone de signatures stylée
  const generateListPDF = () => {
    if (!groupe) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // En-tête principal centré
    doc.setFontSize(14);
    doc.setTextColor(0, 51, 102);
    doc.setFont("helvetica", "bold");
    doc.text(`${groupe.classe_nom}`, pageWidth / 2, 20, { align: 'center' });
    
    // Informations du groupe à gauche
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    doc.text(`Groupe: ${groupe.nom}`, 20, 35);
    doc.text(`Effectif: ${groupe.effectif} étudiants`, 20, 42);
    
    if (groupe.etudiants.length > 0 && groupe.etudiants[0].cursus) {
      doc.text(`Cursus: ${groupe.etudiants[0].cursus}`, 20, 49);
    }

    // ZONE DE SIGNATURES STYLÉE - AVANT LE TABLEAU
    const startY = 65;
    
    // Fond léger pour la zone signatures
    doc.setFillColor(245, 249, 255);
    doc.rect(15, startY - 10, pageWidth - 30, 35, 'F');
    
    // Bordure élégante
    doc.setDrawColor(41, 128, 185);
    doc.setLineWidth(0.8);
    doc.roundedRect(15, startY - 10, pageWidth - 30, 35, 3, 3);
    
    // Titre de la section
    doc.setFontSize(11);
    doc.setTextColor(41, 128, 185);
    doc.setFont("helvetica", "bold");
    doc.text("VALIDATION", pageWidth / 2, startY - 2, { align: 'center' });
    
    // Ligne séparatrice sous le titre
    doc.setDrawColor(200, 220, 240);
    doc.setLineWidth(0.3);
    doc.line(40, startY, pageWidth - 40, startY);
    
    // Calcul des positions pour un centrage parfait
    const sectionWidth = (pageWidth - 60) / 2;
    const leftSectionX = 30;
    const rightSectionX = leftSectionX + sectionWidth + 10;
    
    // Section Professeur (à gauche)
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.setFont("helvetica", "bold");
    doc.text("PROFESSEUR", leftSectionX, startY + 8);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text("Nom:", leftSectionX, startY + 13);
    doc.text("Signature:", leftSectionX, startY + 20);
    
    // Lignes de signature avec texte pointillé
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text("................................", leftSectionX + 15, startY + 12.5);
    doc.text("................................", leftSectionX + 15, startY + 19.5);
    
    // Section Délégué (à droite)
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.setFont("helvetica", "bold");
    doc.text("DÉLÉGUÉ", rightSectionX, startY + 8);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text("Nom:", rightSectionX, startY + 13);
    doc.text("Signature:", rightSectionX, startY + 20);
    
    // Lignes de signature délégué avec texte pointillé
    doc.setTextColor(150, 150, 150);
    doc.text("................................", rightSectionX + 15, startY + 12.5);
    doc.text("................................", rightSectionX + 15, startY + 19.5);
    
    // Date en bas de la zone
    doc.setFontSize(8);
    doc.setTextColor(41, 128, 185);
    doc.text("Fait à ................................., le ../../....", pageWidth / 2, startY + 32, { align: 'center' });

    // TABLEAU DES ÉTUDIANTS
    const tableData = groupe.etudiants.map((etudiant, index) => [
      (index + 1).toString(),
      `${etudiant.nom} ${etudiant.prenoms}`,
      '', '', '', ''
    ]);
    
    autoTable(doc, {
      head: [['N°', 'Nom & Prénoms', 'Note1', 'Note2', 'Partiel', 'Moyenne']],
      body: tableData,
      startY: startY + 45,
      theme: 'grid',
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 9
      },
      styles: {
        fontSize: 8,
        cellPadding: 2,
        valign: 'middle',
        textColor: [60, 60, 60]
      },
      columnStyles: {
        0: { 
          cellWidth: 12,
          halign: 'center'
        },
        1: { 
          cellWidth: 75,
          fontStyle: 'bold'
        },
        2: { 
          cellWidth: 18,
          halign: 'center'
        },
        3: { 
          cellWidth: 18,
          halign: 'center'
        },
        4: { 
          cellWidth: 18,
          halign: 'center'
        },
        5: { 
          cellWidth: 18,
          halign: 'center',
          fontStyle: 'bold'
        }
      },
      alternateRowStyles: {
        fillColor: [250, 250, 250]
      },
      margin: { left: 15, right: 15 }
    });

    // Pied de page avec pagination
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(9);
      doc.setTextColor(120, 120, 120);
      doc.text(`Page ${i} sur ${pageCount}`, pageWidth / 2, doc.internal.pageSize.height - 10, { align: 'center' });
    }

    doc.save(`liste-${groupe.nom}-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // Générer la liste d'appel PDF
  const generateListeAppelPDF = () => {
    if (!groupe) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    
    // Titre simple
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text('LISTE DE PRÉSENCE', pageWidth / 2, 15, { align: 'center' });
    
    // Période avec dates vides
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const datesText = 'Du:.........../........../..........        au        ......../......../..........';
    const datesTextWidth = doc.getTextWidth(datesText);
    doc.text(datesText, (pageWidth - datesTextWidth) / 2, 25);
    
    // Informations du groupe
    doc.text(`Groupe: ${groupe.nom}`, margin, 35);
    doc.text(`Effectif: ${groupe.effectif} étudiants`, pageWidth - margin - 40, 25);

    // En-têtes du tableau
    const headers = ['N°', 'Nom & Prénoms', 'L', 'M', 'M', 'J', 'V', 'S', 'TOTAL'];
    
    // Données des étudiants
    const tableData = groupe.etudiants.map((etudiant, index) => {
      const row = [
        (index + 1).toString(),
        `${etudiant.nom} ${etudiant.prenoms}`,
        '', '', '', '', '', '', // Cases vides pour L M M J V S
        '' // Colonne TOTAL
      ];
      return row;
    });

    // Création du tableau
    autoTable(doc, {
      head: [headers],
      body: tableData,
      startY: 45,
      theme: 'grid',
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 10,
        cellPadding: 3,
        halign: 'center'
      },
      bodyStyles: {
        fontSize: 9,
        cellPadding: 3,
        valign: 'middle'
      },
      styles: {
        lineColor: [100, 100, 100],
        lineWidth: 0.1
      },
      columnStyles: {
        0: { cellWidth: 12, halign: 'center' },
        1: { cellWidth: 70, halign: 'left' },
        2: { cellWidth: 12, halign: 'center' },
        3: { cellWidth: 12, halign: 'center' },
        4: { cellWidth: 12, halign: 'center' },
        5: { cellWidth: 12, halign: 'center' },
        6: { cellWidth: 12, halign: 'center' },
        7: { cellWidth: 12, halign: 'center' },
        8: { cellWidth: 18, halign: 'center', fontStyle: 'bold' }
      },
      margin: { left: margin, right: margin }
    });

    // Pied de page
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text(
        `Page ${i}/${pageCount}`,
        pageWidth / 2,
        doc.internal.pageSize.height - 10,
        { align: 'center' }
      );
    }

    doc.save(`liste-appel-${groupe.nom}-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // Générer l'exportation Excel
  const generateExportExcel = () => {
    if (!groupe) return;

    // Créer un nouveau classeur
    const workbook = XLSX.utils.book_new();
    
    // Préparer les données
    const data = [
      ['Code', 'Nom', 'Prénom', 'Note 1', 'Note 2', 'Note 3', 'Partiel']
    ];
    
    // Ajouter les étudiants
    groupe.etudiants.forEach((etudiant) => {
      data.push([
        etudiant.matricule_iipea,
        etudiant.nom,
        etudiant.prenoms,
        '', // Note 1 vide
        '', // Note 2 vide
        '', // Note 3 vide
        ''  // Partiel vide
      ]);
    });

    // Créer la feuille de calcul
    const worksheet = XLSX.utils.aoa_to_sheet(data);
    
    // Définir les largeurs de colonnes
    worksheet['!cols'] = [
      { wch: 15 },
      { wch: 20 },
      { wch: 20 },
      { wch: 10 },
      { wch: 10 },
      { wch: 10 },
      { wch: 10 }
    ];
    
    // Ajouter la feuille au classeur
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Liste Étudiants');
    
    // Générer le fichier Excel
    XLSX.writeFile(workbook, `liste-etudiants-${groupe.nom}-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Navigation vers les pages Evaluation et Resultats
  const handleGoToEvaluation = () => {
    if (id) {
      navigate(`/Gestion_academique/Groupe-Evaluation/${id}`);
    }
  };

  const handleGoToResultats = () => {
    if (id) {
      navigate(`/Gestion_academique/Groupe-Resultats/${id}`);
    }
  };

  const columns = [
    {
      title: 'N°',
      key: 'numero',
      render: (_: any, __: any, index: number) => index + 1,
      width: 50,
      align: 'center' as const,
    },
    {
      title: 'Code',
      dataIndex: 'matricule_iipea',
      key: 'matricule',
      render: (matricule: string) => (
        <Tag color="blue">{matricule}</Tag>
      ),
      width: 100,
    },
    {
      title: 'Nom & Prénoms',
      key: 'nom_complet',
      render: (record: Etudiant) => (
        <div>
          <Text strong>{record.nom} {record.prenoms}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {record.filiere} - {record.niveau}
          </Text>
        </div>
      ),
      width: 200,
    },
    {
      title: 'Note1',
      key: 'note1',
      render: () => (
        <div style={{ 
          height: '30px', 
          border: '1px dashed #d9d9d9', 
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Text type="secondary">-</Text>
        </div>
      ),
      width: 80,
      align: 'center' as const,
    },
    {
      title: 'Note2',
      key: 'note2',
      render: () => (
        <div style={{ 
          height: '30px', 
          border: '1px dashed #d9d9d9', 
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Text type="secondary">-</Text>
        </div>
      ),
      width: 80,
      align: 'center' as const,
    },
    {
      title: 'Note3',
      key: 'note3',
      render: () => (
        <div style={{ 
          height: '30px', 
          border: '1px dashed #d9d9d9', 
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Text type="secondary">-</Text>
        </div>
      ),
      width: 80,
      align: 'center' as const,
    },
    {
      title: 'Partiel',
      key: 'partiel',
      render: () => (
        <div style={{ 
          height: '30px', 
          border: '1px dashed #d9d9d9', 
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Text type="secondary">-</Text>
        </div>
      ),
      width: 80,
      align: 'center' as const,
    },
    {
      title: 'Contact',
      key: 'contact',
      render: (record: Etudiant) => (
        <div>
          <div>{record.email}</div>
          <Text type="secondary">{record.telephone}</Text>
        </div>
      ),
      width: 150,
    },
    {
      title: 'Statut',
      dataIndex: 'statut_scolaire',
      key: 'statut',
      render: (statut: string) => (
        <Tag color={statut === 'Regular' ? 'green' : 'orange'}>
          {statut}
        </Tag>
      ),
      width: 100,
      align: 'center' as const,
    },
  ];

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <Spin size="large" />
        <div>Chargement des détails du groupe...</div>
      </div>
    );
  }

  if (!groupe) {
    return (
      <div style={{ padding: '24px' }}>
        <Card>
          <Text type="danger">Groupe non trouvé</Text>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader />
      
      <div style={{ padding: '24px' }}>
        <Button 
          type="text" 
          icon={<ArrowLeftOutlined />} 
          onClick={() => navigate(-1)}
          style={{ marginBottom: '16px' }}
        >
          Retour
        </Button>

        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <Title level={2} style={{ margin: 0 , fontSize: '17px'}}>
              <TeamOutlined /> DÉTAILS DU GROUPE: {groupe.nom}
            </Title>
            
            <Space>
              {/* BOUTONS POUR GÉNÉRER LES CERTIFICATS EN MASSE POUR LE GROUPE */}
              <Tooltip title={`Générer tous les certificats de scolarité pour le groupe ${groupe.nom}`}>
                <Button 
                  type="primary"
                  icon={<FileTextOutlined />}
                  onClick={() => handleMassDownloadCertificats('scolarite')}
                  loading={loadingCertificats === 'scolarite'}
                  style={{ 
                    backgroundColor: '#1890ff', 
                    borderColor: '#1890ff',
                    fontSize: '12px'
                  }}
                >
                  Certificats Scolarité
                </Button>
              </Tooltip>

              <Tooltip title={`Générer tous les certificats de fréquentation pour le groupe ${groupe.nom}`}>
                <Button 
                  type="primary"
                  icon={<FileDoneOutlined />}
                  onClick={() => handleMassDownloadCertificats('frequentation')}
                  loading={loadingCertificats === 'frequentation'}
                  style={{ 
                    backgroundColor: '#52c41a', 
                    borderColor: '#52c41a',
                    fontSize: '12px'
                  }}
                >
                  Certificats Fréquentation
                </Button>
              </Tooltip>

              <Button 
                type="primary" 
                icon={<CalendarOutlined />}
                onClick={generateListeAppelPDF}
                size="large"
                style={{ 
                  marginRight: '6px', 
                  backgroundColor: '#fa8c16', 
                  borderColor: '#fa8c16',
                  fontSize: '12px'
                }}
              >
                <FilePdfOutlined /> Liste d'appel
              </Button>
              
              <Button 
                type="primary" 
                icon={<DownloadOutlined />}
                onClick={generateExportExcel}
                size="large"
                style={{ 
                  marginRight: '6px',
                  backgroundColor: '#52c41a', 
                  borderColor: '#52c41a',
                  fontSize: '12px'
                }}
              >
                <FileExcelOutlined /> Export Excel
              </Button>

              <Button 
                type="primary" 
                icon={<DownloadOutlined />}
                onClick={generateListPDF}
                size="large"
                style={{
                  fontSize: '12px'
                }}
              >
                <FilePdfOutlined /> Liste PDF
              </Button>
            </Space>
          </div>

          <Descriptions bordered style={{ marginBottom: '24px' }}>
            <Descriptions.Item label="Classe">
              <Text strong>{groupe.classe_nom}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Capacité">
              <Tag color="blue">{groupe.capacite_max} places</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Effectif">
              <Text strong>{groupe.effectif} étudiants</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Taux de remplissage">
              <Tag color={groupe.taux_remplissage >= 90 ? 'red' : 'green'}>
                {groupe.taux_remplissage}%
              </Tag>
            </Descriptions.Item>
          </Descriptions>

          {/* Section Emploi du temps */}
          <Card type="inner" title="Emploi du temps du groupe" style={{ marginBottom: '24px' }} loading={loadingEdt}>
            <Row gutter={[16, 16]} align="middle">
              {emploiDuTemps ? (
                <>
                  <Col>
                    <FileOutlined style={{ fontSize: '24px', color: '#1890ff' }} />
                  </Col>
                  <Col flex="auto">
                    <Text strong>{emploiDuTemps.original_name}</Text>
                    <br />
                    <Text type="secondary">
                      Uploadé le: {new Date(emploiDuTemps.uploaded_at).toLocaleDateString()}
                    </Text>
                  </Col>
                  <Col>
                    <Button 
                      type="primary" 
                      icon={<EyeOutlined />}
                      href={`${API_URL}/api/emploiDuTemps/emploi-du-temps/${emploiDuTemps.id}/download`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Télécharger
                    </Button>
                  </Col>
                  <Col>
                    <Button 
                      icon={<UploadOutlined />}
                      onClick={() => setModalVisible(true)}
                    >
                      Remplacer
                    </Button>
                  </Col>
                </>
              ) : (
                <Col span={24}>
                  <Text type="secondary">Aucun emploi du temps n'a été chargé pour ce groupe.</Text>
                  <br />
                  <Button 
                    type="dashed" 
                    icon={<UploadOutlined />} 
                    onClick={() => setModalVisible(true)}
                    style={{ marginTop: '8px' }}
                  >
                    Charger l'emploi du temps
                  </Button>
                </Col>
              )}
            </Row>
          </Card>

          {/* Sections Évaluation et Résultats */}
          <Row gutter={16} style={{ marginBottom: '24px' }}>
            <Col span={12}>
              <Card 
                type="inner" 
                title={
                  <span>
                    <FileTextOutlined style={{ color: '#fa8c16', marginRight: '8px' }} />
                    ÉVALUATION
                  </span>
                }
                style={{ textAlign: 'center' }}
              >
                <Text type="secondary" style={{ display: 'block', marginBottom: '16px' }}>
                  Gérer les évaluations et les notes des étudiants
                </Text>
                <Button 
                  type="primary" 
                  icon={<FileTextOutlined />}
                  onClick={handleGoToEvaluation}
                  size="large"
                  style={{ 
                    backgroundColor: '#fa8c16', 
                    borderColor: '#fa8c16',
                    width: '100%'
                  }}
                >
                  Accéder aux Évaluations
                </Button>
              </Card>
            </Col>
            <Col span={12}>
              <Card 
                type="inner" 
                title={
                  <span>
                    <BarChartOutlined style={{ color: '#52c41a', marginRight: '8px' }} />
                    RÉSULTATS
                  </span>
                }
                style={{ textAlign: 'center' }}
              >
                <Text type="secondary" style={{ display: 'block', marginBottom: '16px' }}>
                  Consulter les résultats et statistiques du groupe
                </Text>
                <Button 
                  type="primary" 
                  icon={<BarChartOutlined />}
                  onClick={handleGoToResultats}
                  size="large"
                  style={{ 
                    backgroundColor: '#52c41a', 
                    borderColor: '#52c41a',
                    width: '100%'
                  }}
                >
                  Voir les Résultats
                </Button>
              </Card>
            </Col>
          </Row>

          <Row gutter={16} style={{ marginBottom: '24px' }}>
            <Col span={6}>
              <Statistic
                title="Total Étudiants"
                value={groupe.effectif}
                prefix={<UserOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="Places disponibles"
                value={groupe.capacite_max - groupe.effectif}
                valueStyle={{ color: '#52c41a' }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="Taux de remplissage"
                value={groupe.taux_remplissage}
                suffix="%"
                valueStyle={{ color: groupe.taux_remplissage >= 90 ? '#f5222d' : '#52c41a' }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="Certificats à générer"
                value={groupe.effectif}
                prefix={<FileTextOutlined />}
                valueStyle={{ color: '#722ed1' }}
              />
            </Col>
          </Row>

          <Title level={4}>
            Liste des étudiants ({groupe.etudiants.length})
            <Text type="secondary" style={{ fontSize: '14px', marginLeft: '8px' }}>
              N° - Code - Nom & Prénoms - Notes - Partiel
            </Text>
          </Title>
          
          <div ref={tableRef}>
            <Table
              columns={columns}
              dataSource={groupe.etudiants}
              rowKey="id"
              pagination={{ pageSize: 10 }}
              bordered
              size="middle"
              scroll={{ x: 1000 }}
              style={{ marginTop: '16px' }}
            />
          </div>
        </Card>

        {/* Modal pour l'upload */}
        <Modal
          title={`Charger l'emploi du temps pour ${groupe.nom}`}
          open={modalVisible}
          onOk={handleUpload}
          onCancel={() => {
            setModalVisible(false);
            form.resetFields();
            setFileList([]);
          }}
          okText="Charger"
          cancelText="Annuler"
        >
          <Form form={form} layout="vertical">
            <Form.Item
              name="emploiDuTemps"
              label="Fichier (PDF, Word, Excel)"
              rules={[{ required: true, message: 'Veuillez sélectionner un fichier' }]}
            >
              <Upload {...uploadProps}>
                <Button icon={<UploadOutlined />}>Sélectionner le fichier</Button>
              </Upload>
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </div>
  );
};

export default DetailGroupe;