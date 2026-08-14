import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { 
  Card, 
  Descriptions, 
  Typography, 
  Button,
  Divider,
  Table,
  Spin,
  message,
  Row,
  Col,
  Tag,
  Badge,
  Avatar
} from 'antd';
import { 
  PrinterOutlined,
  UserOutlined,
  TeamOutlined,
  CheckCircleOutlined,
  CalendarOutlined,
  ShoppingOutlined,
  SafetyCertificateOutlined,
  CloseCircleOutlined
} from '@ant-design/icons';
import { QRCodeSVG } from 'qrcode.react';

const { Title, Text } = Typography;

interface Paiement {
  id: string;
  montant: number;
  date_paiement: string;
  methode: string;
  recu: {
    id: string;
    numero_recu: string;
    date_emission: string;
    emetteur: string;
  };
}

interface KitDetails {
  montant: number;
  deposer: boolean;
  date_enregistrement: string;
}

interface PriseEnChargeDetails {
  type_pec: string;
  nature_pec?: string;
  pourcentage_reduction: number;
  montant_reduction: number;
  statut: string;
  date_demande: string;
  date_validation?: string;
  valide_par?: string;
  valide_par_nom?: string;
  reference?: string;
  motif_refus?: string;
}

interface EtudiantDetails {
  code_unique: string;
  id: string;
  nom: string;
  prenoms: string;
  matricule: string;
  matricule_iipea: string;
  photo_url: string;
  date_naissance: string;
  lieu_naissance: string;
  telephone: string;
  email: string;
  statut_scolaire: string;
  lieu_residence: string;
  contact_parent: string;
  contact_parent_2: string;
  nationalite: string;
  sexe: string;
  filiere: string;
  filiere_sigle: string;
  niveau: string;
  departement: string;
  annee_academique: string;
  // Chantier 6 (2026-08-01) : classe et groupe sont deux champs indépendants — la classe est
  // connue dès le premier paiement, le groupe seulement une fois la classe découpée manuellement
  // par un administrateur (jusque-là, `groupe` est absent et seule `classe` doit s'afficher).
  classe?: {
    nom: string;
  };
  groupe?: {
    nom: string;
  };
  scolarite: {
    montant_scolarite: number;
    scolarite_verse: number;
    scolarite_restante: number;
    statut_etudiant: 'SOLDE' | 'NON_SOLDE';
  };
  kit?: KitDetails;
  prise_en_charge?: PriseEnChargeDetails;
  // Chantier 2 TER : mention frais de soutenance — présente uniquement pour Licence 3 / Licence 3
  // Pro, année académique concernée (calculée côté backend, cf. mentionSoutenance.service.js).
  mention_soutenance?: string | null;
}

const RecuEtudiant = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const anneeAcademiqueId = searchParams.get('anneeAcademiqueId');
  const [paiements, setPaiements] = useState<Paiement[]>([]);
  const [etudiant, setEtudiant] = useState<EtudiantDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const API_URL = import.meta.env.VITE_API_URL_SERVER || "";

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');
        
        const url = anneeAcademiqueId
          ? `${API_URL}/api/etudiants/recu-data/${id}?anneeAcademiqueId=${encodeURIComponent(anneeAcademiqueId)}`
          : `${API_URL}/api/etudiants/recu-data/${id}`;
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          if (response.status === 404) {
            setEtudiant(null);
            setPaiements([]);
            message.error('Étudiant non trouvé');
          } else {
            throw new Error('Erreur de chargement');
          }
          return;
        }

        const data = await response.json();
        setEtudiant(data.data.etudiant);
        setPaiements(data.data.paiements || []);

      } catch (error) {
        message.error('Erreur lors du chargement des données');
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchData();
    }
  }, [id, API_URL, anneeAcademiqueId]);

  const handlePrint = () => {
    const printContent = document.getElementById('printable-area');
    if (!printContent) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      message.error('Veuillez autoriser les pop-ups pour imprimer');
      return;
    }
    
    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map(el => el.outerHTML)
      .join('');
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Reçu ${etudiant?.matricule}</title>
          <meta charset="utf-8">
          ${styles}
          <style>
            @media print {
              body {
                margin: 0;
                padding: 8px !important;
                background: white !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
                font-size: 10px !important;
                line-height: 1.2 !important;
              }
              .no-print {
                display: none !important;
              }
              .ant-card {
                break-inside: avoid;
                box-shadow: none !important;
                border: 1px solid #d9d9d9 !important;
                margin-bottom: 8px !important;
                padding: 8px !important;
              }
              .ant-card-head {
                padding: 5px 8px !important;
                min-height: auto !important;
              }
              .ant-card-head-title {
                font-size: 12px !important;
                padding: 0 !important;
              }
              .ant-table {
                width: 100% !important;
                font-size: 9px !important;
              }
              .ant-table-thead > tr > th {
                background: #fafafa !important;
                color: #000 !important;
                font-weight: bold !important;
                padding: 4px !important;
                font-size: 9px !important;
              }
              .ant-table-tbody > tr > td {
                padding: 3px !important;
                font-size: 9px !important;
              }
              .ant-tag {
                border: 1px solid #d9d9d9 !important;
                background: #fafafa !important;
                color: #000 !important;
                font-size: 8px !important;
                margin: 1px !important;
                padding: 1px 3px !important;
              }
              .ant-statistic {
                margin: 0 !important;
              }
              .ant-statistic-title {
                font-size: 9px !important;
                margin-bottom: 2px !important;
              }
              .ant-statistic-content {
                font-size: 11px !important;
                color: inherit !important;
              }
              .ant-descriptions-item-label,
              .ant-descriptions-item-content {
                font-size: 9px !important;
                padding: 1px 3px !important;
              }
              .ant-avatar {
                width: 70px !important;
                height: 70px !important;
              }
              .ant-divider {
                margin: 6px 0 !important;
              }
              * {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              @page {
                size: portrait;
                margin: 5mm;
              }
              h1, h2, h3, h4, h5, h6 {
                margin: 5px 0 !important;
              }
              .print-container {
                transform: scale(0.92);
                transform-origin: top center;
                width: 100%;
              }
              .compact-section {
                margin-bottom: 8px !important;
              }
              .compact-row {
                margin-bottom: 6px !important;
              }
              .ant-descriptions-row > td {
                padding-bottom: 4px !important;
              }
              .ant-descriptions-item-content {
                font-size: 9px !important;
              }
              .ant-descriptions-item-label {
                font-size: 9px !important;
              }
              .ant-typography {
                font-size: 10px !important;
              }
              .ant-row {
                margin-right: -6px !important;
                margin-left: -6px !important;
              }
              .ant-col {
                padding-right: 6px !important;
                padding-left: 6px !important;
              }
              .ant-btn {
                display: none !important;
              }
              .logo-container {
                transform: scale(0.85);
                transform-origin: top center;
                margin-bottom: 5px !important;
              }
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              padding: 8px;
              background: white;
              font-size: 10px;
            }
          </style>
        </head>
        <body onload="window.print(); window.onafterprint = function() { window.close(); }">
          <div class="print-container">
            ${printContent.innerHTML}
          </div>
        </body>
      </html>
    `);
    
    printWindow.document.close();
  };

  const columns = [
    {
      title: 'Numéro Reçu',
      dataIndex: ['recu', 'numero_recu'],
      key: 'numero_recu',
      render: (text: string) => <Text strong style={{ fontSize: '10px' }}>{text}</Text>,
      width: 100,
    },
    {
      title: 'Date Paiement',
      dataIndex: 'date_paiement',
      key: 'date',
      render: (date: string) => (
        <Tag icon={<CalendarOutlined />} style={{ fontSize: '9px' }}>
          {new Date(date).toLocaleDateString()}
        </Tag>
      ),
      width: 90,
    },
    {
      title: 'Montant',
      dataIndex: 'montant',
      key: 'montant',
      render: (montant: number) => (
        <Text strong style={{ color: '#1890ff', fontSize: '10px' }}>
          {montant.toLocaleString()} FCFA
        </Text>
      ),
      align: 'right' as const,
      width: 90,
    },
    {
      title: 'Méthode',
      dataIndex: 'methode',
      key: 'methode',
      render: (methode: string) => (
        <Tag color={methode === 'especes' ? 'green' : 'blue'} style={{ fontSize: '9px' }}>
          {methode.toUpperCase()}
        </Tag>
      ),
      width: 70,
    },
    {
      title: 'Émetteur',
      dataIndex: ['recu', 'emetteur'],
      key: 'emetteur',
      render: (text: string) => <span style={{ fontSize: '9px' }}>{text}</span>,
      width: 90,
    },
  ];

  if (loading) {
    return <Spin size="large" style={{ display: 'flex', justifyContent: 'center', marginTop: '55px' }} />;
  }

  if (!etudiant) {
    return (
      <div style={{ padding: '26px' }}>
        <Card>
          <Text type="danger">Étudiant non trouvé</Text>
        </Card>
      </div>
    );
  }

  const isSolde = etudiant.scolarite.statut_etudiant === 'SOLDE';
  // Correction (Chantier 2) : les deux branches renvoyaient la même valeur, la réduction PEC
  // n'apparaissait donc jamais dans le montant total affiché en tête de reçu — seulement dans la
  // section PEC dédiée plus bas. Nécessaire pour que la PEC institutionnelle 100 % (dont la
  // réduction peut être intégrale) reste cohérente ici : Total Scolarité doit refléter le montant
  // réellement dû après prise en charge, l'original restant affiché en dessous à titre indicatif.
  const montantScolariteAvecReduction = etudiant.prise_en_charge?.statut === 'valide'
    ? etudiant.scolarite.montant_scolarite - (etudiant.prise_en_charge.montant_reduction || 0)
    : etudiant.scolarite.montant_scolarite;

  const qrData = JSON.stringify({
    nom_complet: `${etudiant.nom} ${etudiant.prenoms}`,
    matricule: etudiant.code_unique,
    montant_total: montantScolariteAvecReduction,
    montant_verse: etudiant.scolarite.scolarite_verse,
    montant_restant: etudiant.scolarite.scolarite_restante,
    reduction_pec: etudiant.prise_en_charge?.statut === 'valide' ? etudiant.prise_en_charge.montant_reduction : 0,
    statut_pec: etudiant.prise_en_charge?.statut || 'aucune',
    date_emission: new Date().toISOString()
  });

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      
      <div id="printable-area" style={{ 
        position: 'relative',
        backgroundColor: 'white',
        padding: '18px',
        borderRadius: '6px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        {isSolde && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 1,
            opacity: 0.05,
            pointerEvents: 'none'
          }}>
            <CheckCircleOutlined style={{ fontSize: '180px', color: '#52c41a' }} />
          </div>
        )}

        {/* En-tête de l'école */}
        <div style={{ 
          textAlign: 'center', 
          marginBottom: '15px',
          borderBottom: '1px solid #f0f0f0',
          paddingBottom: '10px'
        }}>
          <div className="logo-container" style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}>
            <img 
              src="/IIPEA-Photoroom.png" 
              alt="Logo IIPEA" 
              style={{ height: '50px' }} 
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = '/default-logo.png';
              }}
            />
          </div>
          <Title level={3} style={{ marginBottom: '3px', color: '#1890ff', fontSize: '16px' }}>
            Institut International Polytechnique des Elites d'Abidjan
          </Title>
          <Text strong style={{ fontSize: '13px', display: 'block', marginBottom: '5px' }}>(IIPEA)</Text>
          
          <div style={{ marginTop: '5px', fontSize: '11px', color: '#666' }}>
            <div>secretariat@iipea.com</div>
            <div>+225 05 44 02 60 60 | +225 07 08 08 87 87</div>
          </div>
        </div>

        {isSolde && (
          <div style={{ 
            position: 'absolute',
            top: '15px',
            right: '15px',
            zIndex: 2
          }}>
            <Badge.Ribbon 
              text="SOLDE" 
              color="green"
              style={{ 
                fontSize: '11px',
                fontWeight: 'bold',
                height: '24px',
                lineHeight: '24px'
              }}
            />
          </div>
        )}
        
        {/* CODE UNIQUE */}
        <div style={{
          position: 'absolute',
          top: '10px',
          right: isSolde ? '85px' : '10px',
          zIndex: 2,
          padding: '7px 10px',
          borderRadius: '5px',
          boxShadow: '0 3px 8px rgba(221, 202, 134, 0.3)',
          border: '2px solid #fff',
          backgroundColor: '#fffae6'
        }}>
          <Text strong style={{
            color: '#d48806',
            fontSize: '13px',
            fontWeight: 'bold',
            letterSpacing: '0.5px'
          }}>
            {etudiant.code_unique}
          </Text>
        </div>
        
        {/* QR Code Section */}
        <div style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          zIndex: 2,
          padding: '5px',
          backgroundColor: 'white',
          borderRadius: '5px',
          boxShadow: '0 2px 6px rgba(0, 0, 0, 0.15)',
          border: '1px solid #d9d9d9'
        }}>
          <QRCodeSVG 
            value={qrData}
            size={100}
            level="H"
            includeMargin={true}
            fgColor="#1890ff"
            bgColor="#ffffff"
          />
        </div>
        
        {/* Section Photo et Informations de base */}
        <Row gutter={14} style={{ marginBottom: '15px' }}>
          <Col xs={24} md={8}>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
              minWidth: '110px'
            }}>
              <Avatar 
                size={120} 
                src={etudiant.photo_url ? `${API_URL}${etudiant.photo_url}` : '/user-default.png'} 
                icon={<UserOutlined />}
                style={{ 
                  border: '2px solid #1890ff',
                  boxShadow: '0 2px 6px rgba(24, 144, 255, 0.3)'
                }}
                onError={() => true}
              />
              <div style={{
                backgroundColor: '#1890ff',
                color: 'white',
                padding: '3px 7px',
                borderRadius: '3px',
                fontWeight: 'bold',
                fontSize: '11px'
              }}>
                {etudiant.matricule_iipea}
              </div>
            </div>
          </Col>

          <Col xs={24} md={16}>
            <Row gutter={14}>
              <Col xs={24} md={12}>
                <Descriptions 
                  column={1}
                  size="small"
                  labelStyle={{ 
                    fontWeight: 'bold',
                    color: '#666',
                    fontSize: '10px',
                    padding: '1px 2px'
                  }}
                  contentStyle={{ 
                    fontWeight: '500',
                    fontSize: '10px',
                    padding: '1px 2px'
                  }}
                >
                  <Descriptions.Item label="Nom Complet">
                    <Text strong>{etudiant.nom} {etudiant.prenoms}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="Date de Naissance">
                    {new Date(etudiant.date_naissance).toLocaleDateString()} à {etudiant.lieu_naissance}
                  </Descriptions.Item>
                  <Descriptions.Item label="Nationalité">
                    {etudiant.nationalite}
                  </Descriptions.Item>
                  <Descriptions.Item label="Statut Scolaire">
                    {etudiant.statut_scolaire}
                  </Descriptions.Item>
                </Descriptions>
              </Col>
              <Col xs={24} md={12}>
                <Descriptions 
                  column={1}
                  size="small"
                  labelStyle={{ 
                    fontWeight: 'bold',
                    color: '#666',
                    fontSize: '10px',
                    padding: '1px 2px'
                  }}
                  contentStyle={{ 
                    fontWeight: '500',
                    fontSize: '10px',
                    padding: '1px 2px'
                  }}
                >
                  <Descriptions.Item label="Téléphone">
                    {etudiant.telephone}
                  </Descriptions.Item>
                  <Descriptions.Item label="Résidence">
                    {etudiant.lieu_residence}
                  </Descriptions.Item>
                  <Descriptions.Item label="Contact Parent">
                    {etudiant.contact_parent}
                  </Descriptions.Item>
                  {etudiant.contact_parent_2 && (
                    <Descriptions.Item label="Contact Parent 2">
                      {etudiant.contact_parent_2}
                    </Descriptions.Item>
                  )}
                </Descriptions>
              </Col>
            </Row>
          </Col>
        </Row>
        
        {/* Section Académique */}
        <Card 
          title="Informations Académiques" 
          style={{ marginBottom: '15px' }}
          headStyle={{ 
            backgroundColor: '#f0f9ff',
            borderBottom: '1px solid #e8e8e8',
            fontWeight: 'bold',
            color: '#1890ff',
            fontSize: '12px',
            padding: '5px 8px',
            minHeight: 'auto'
          }}
          bodyStyle={{ padding: '8px' }}
        >
          {/* Texte d'accueil ajouté */}
          <div style={{
            marginBottom: '12px',
            padding: '8px',
            backgroundColor: '#f6ffed',
            border: '1px solid #b7eb8f',
            borderRadius: '3px',
            fontSize: '10px'
          }}>
            <Text>
              Bienvenue à IIPEA, veuillez trouver ci-dessous vos accès étudiant (E-MAIL & Mot de passe), 
              vous donnant accès à votre plateforme MyIIPEA disponible sur <a href="https://www.myiipea.ci" target="_blank">www.myiipea.ci</a>
            </Text>
          </div>

          <Descriptions 
            column={{ xs: 1, sm: 2 }}
            size="small"
            labelStyle={{ 
              fontWeight: 'bold',
              fontSize: '10px',
              padding: '1px 2px'
            }}
            contentStyle={{ 
              fontSize: '10px',
              padding: '1px 2px'
            }}
          >
            <Descriptions.Item label="Filière">
              <Text strong>{etudiant.filiere} ({etudiant.filiere_sigle})</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Département">
              {etudiant.departement}
            </Descriptions.Item>
            <Descriptions.Item label="Niveau">
              {etudiant.niveau}
            </Descriptions.Item>
            <Descriptions.Item label="Année Académique">
              {etudiant.annee_academique}
            </Descriptions.Item>
            {etudiant.classe && (
              <Descriptions.Item label="Classe">
                {etudiant.classe.nom}
              </Descriptions.Item>
            )}
            {etudiant.groupe && (
              <Descriptions.Item label="Groupe">
                {etudiant.groupe.nom}
              </Descriptions.Item>
            )}
            <Descriptions.Item label="Email">
              {etudiant.email}
            </Descriptions.Item>
            <Descriptions.Item label="Mot de passe">
              <Text strong>@elites@</Text>
            </Descriptions.Item>
          </Descriptions>

          {etudiant.scolarite.scolarite_restante > 0 && (
            <div style={{
              marginTop: '10px',
              padding: '7px',
              backgroundColor: '#fff2e8',
              border: '1px solid #ffbb96',
              borderRadius: '3px',
              fontSize: '10px'
            }}>
              <Text strong style={{ color: '#fa541c' }}>
                ⚠️ Important: La totalité des frais de scolarité devra être réglée au plus tard le 15 Janvier 2027.
              </Text>
            </div>
          )}

          {/* Mention obligatoire (Chantier 5) : non liée au solde, affichée sur tout reçu de paiement */}
          <div style={{
            marginTop: '10px',
            padding: '7px',
            backgroundColor: '#fafafa',
            border: '1px solid #d9d9d9',
            borderRadius: '3px',
            fontSize: '9px',
            color: '#666'
          }}>
            Après un délai de 24 heures suivant le paiement, aucun remboursement ne pourra être effectué.
          </div>
        </Card>

        {/* Section Kit École */}
        {etudiant.kit && (
          <Card 
            title="Kit École" 
            style={{ marginBottom: '15px' }}
            headStyle={{ 
              backgroundColor: etudiant.kit.deposer ? '#f6ffed' : '#fff2e8',
              borderBottom: etudiant.kit.deposer ? '1px solid #b7eb8f' : '1px solid #ffbb96',
              fontWeight: 'bold',
              color: etudiant.kit.deposer ? '#52c41a' : '#faad14',
              fontSize: '12px',
              padding: '5px 8px',
              minHeight: 'auto'
            }}
            bodyStyle={{ padding: '8px' }}
          >
            <Row gutter={14}>
              <Col xs={24} md={12}>
                <Descriptions 
                  column={1}
                  size="small"
                  labelStyle={{ 
                    fontWeight: 'bold',
                    fontSize: '10px',
                    padding: '1px 2px'
                  }}
                  contentStyle={{ 
                    fontSize: '10px',
                    padding: '1px 2px'
                  }}
                >
                  <Descriptions.Item label="Statut">
                    <Tag 
                      color={etudiant.kit.deposer ? 'green' : 'orange'} 
                      icon={etudiant.kit.deposer ? <CheckCircleOutlined /> : <ShoppingOutlined />}
                      style={{ fontSize: '9px' }}
                    >
                      {etudiant.kit.deposer ? 'Payé à l\'école' : 'Non payé à l\'école'}
                    </Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="Montant">
                    <Text strong style={{ color: '#1890ff', fontSize: '10px' }}>
                      {etudiant.kit.montant.toLocaleString()} FCFA
                    </Text>
                  </Descriptions.Item>
                </Descriptions>
              </Col>
              <Col xs={24} md={12}>
                <Descriptions 
                  column={1}
                  size="small"
                  labelStyle={{ 
                    fontWeight: 'bold',
                    fontSize: '10px',
                    padding: '1px 2px'
                  }}
                  contentStyle={{ 
                    fontSize: '10px',
                    padding: '1px 2px'
                  }}
                >
                  {etudiant.kit.deposer && (
                    <Descriptions.Item label="Date Paiement">
                      {new Date(etudiant.kit.date_enregistrement).toLocaleDateString()}
                    </Descriptions.Item>
                  )}
                </Descriptions>
              </Col>
            </Row>
          </Card>
        )}

        {/* Section Prise en Charge */}
        {etudiant.prise_en_charge && (
          <>
            {/* En attente (classique) ou initiée à la Caisse (institutionnelle, Chantier 2) —
                même carte, décision Fondateur encore ouverte dans les deux cas. */}
            {(etudiant.prise_en_charge.statut === 'en_attente' || etudiant.prise_en_charge.statut === 'initiee') && (
              <Card
                title={etudiant.prise_en_charge.nature_pec === 'institutionnelle' ? 'Prise en Charge Institutionnelle' : 'Prise en Charge'}
                style={{ marginBottom: '15px' }}
                headStyle={{ 
                  backgroundColor: '#fffbe6',
                  borderBottom: '1px solid #ffe58f',
                  fontWeight: 'bold',
                  color: '#faad14',
                  fontSize: '12px',
                  padding: '5px 8px',
                  minHeight: 'auto'
                }}
                bodyStyle={{ padding: '8px' }}
              >
                <Row gutter={14}>
                  <Col xs={24} md={12}>
                    <Descriptions 
                      column={1}
                      size="small"
                      labelStyle={{ 
                        fontWeight: 'bold',
                        fontSize: '10px',
                        padding: '1px 2px'
                      }}
                      contentStyle={{ 
                        fontSize: '10px',
                        padding: '1px 2px'
                      }}
                    >
                      <Descriptions.Item label="Type">
                        <Tag color="blue" style={{ fontSize: '9px' }}>
                          {etudiant.prise_en_charge.type_pec}
                        </Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label="Pourcentage">
                        <Text strong style={{ fontSize: '10px' }}>
                          {etudiant.prise_en_charge.pourcentage_reduction}%
                        </Text>
                      </Descriptions.Item>
                    </Descriptions>
                  </Col>
                  <Col xs={24} md={12}>
                    <Descriptions 
                      column={1}
                      size="small"
                      labelStyle={{ 
                        fontWeight: 'bold',
                        fontSize: '10px',
                        padding: '1px 2px'
                      }}
                      contentStyle={{ 
                        fontSize: '10px',
                        padding: '1px 2px'
                      }}
                    >
                      <Descriptions.Item label="Statut">
                        <Tag
                          color="gold"
                          icon={<SafetyCertificateOutlined />}
                          style={{ fontSize: '9px' }}
                        >
                          {etudiant.prise_en_charge.statut === 'initiee' ? 'En attente de confirmation du Fondateur' : 'En attente de validation'}
                        </Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label="Date Demande">
                        {new Date(etudiant.prise_en_charge.date_demande).toLocaleDateString()}
                      </Descriptions.Item>
                    </Descriptions>
                  </Col>
                </Row>
              </Card>
            )}

            {/* Validée */}
            {etudiant.prise_en_charge.statut === 'valide' && (
              <Card 
                title="Prise en Charge Validée" 
                style={{ marginBottom: '15px' }}
                headStyle={{ 
                  backgroundColor: '#f6ffed',
                  borderBottom: '1px solid #b7eb8f',
                  fontWeight: 'bold',
                  color: '#52c41a',
                  fontSize: '12px',
                  padding: '5px 8px',
                  minHeight: 'auto'
                }}
                bodyStyle={{ padding: '8px' }}
              >
                <Row gutter={14}>
                  <Col xs={24} md={12}>
                    <Descriptions 
                      column={1}
                      size="small"
                      labelStyle={{ 
                        fontWeight: 'bold',
                        fontSize: '10px',
                        padding: '1px 2px'
                      }}
                      contentStyle={{ 
                        fontSize: '10px',
                        padding: '1px 2px'
                      }}
                    >
                      <Descriptions.Item label="Type">
                        <Tag color="green" style={{ fontSize: '9px' }}>
                          {etudiant.prise_en_charge.type_pec}
                        </Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label="Pourcentage">
                        <Text strong style={{ fontSize: '10px' }}>
                          {etudiant.prise_en_charge.pourcentage_reduction}%
                        </Text>
                      </Descriptions.Item>
                      <Descriptions.Item label="Montant Réduction">
                        <Text strong style={{ color: '#52c41a', fontSize: '10px' }}>
                          {etudiant.prise_en_charge.montant_reduction?.toLocaleString()} FCFA
                        </Text>
                      </Descriptions.Item>
                    </Descriptions>
                  </Col>
                  <Col xs={24} md={12}>
                    <Descriptions 
                      column={1}
                      size="small"
                      labelStyle={{ 
                        fontWeight: 'bold',
                        fontSize: '10px',
                        padding: '1px 2px'
                      }}
                      contentStyle={{ 
                        fontSize: '10px',
                        padding: '1px 2px'
                      }}
                    >
                      <Descriptions.Item label="Statut">
                        <Tag 
                          color="green" 
                          icon={<CheckCircleOutlined />}
                          style={{ fontSize: '9px' }}
                        >
                          Validée
                        </Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label="Référence">
                        {etudiant.prise_en_charge.reference || 'N/A'}
                      </Descriptions.Item>
                      <Descriptions.Item label="Date Validation">
                        {etudiant.prise_en_charge.date_validation ? new Date(etudiant.prise_en_charge.date_validation).toLocaleDateString() : 'N/A'}
                      </Descriptions.Item>
                    </Descriptions>
                  </Col>
                </Row>
              </Card>
            )}

            {/* Refusée */}
            {etudiant.prise_en_charge.statut === 'refuse' && (
              <Card 
                title="Prise en Charge Refusée" 
                style={{ marginBottom: '15px' }}
                headStyle={{ 
                  backgroundColor: '#fff2f0',
                  borderBottom: '1px solid #ffccc7',
                  fontWeight: 'bold',
                  color: '#ff4d4f',
                  fontSize: '12px',
                  padding: '5px 8px',
                  minHeight: 'auto'
                }}
                bodyStyle={{ padding: '8px' }}
              >
                <Row gutter={14}>
                  <Col xs={24} md={12}>
                    <Descriptions 
                      column={1}
                      size="small"
                      labelStyle={{ 
                        fontWeight: 'bold',
                        fontSize: '10px',
                        padding: '1px 2px'
                      }}
                      contentStyle={{ 
                        fontSize: '10px',
                        padding: '1px 2px'
                      }}
                    >
                      <Descriptions.Item label="Type">
                        <Tag color="red" style={{ fontSize: '9px' }}>
                          {etudiant.prise_en_charge.type_pec}
                        </Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label="Pourcentage demandé">
                        <Text style={{ fontSize: '10px' }}>
                          {etudiant.prise_en_charge.pourcentage_reduction}%
                        </Text>
                      </Descriptions.Item>
                    </Descriptions>
                  </Col>
                  <Col xs={24} md={12}>
                    <Descriptions 
                      column={1}
                      size="small"
                      labelStyle={{ 
                        fontWeight: 'bold',
                        fontSize: '10px',
                        padding: '1px 2px'
                      }}
                      contentStyle={{ 
                        fontSize: '10px',
                        padding: '1px 2px'
                      }}
                    >
                      <Descriptions.Item label="Statut">
                        <Tag 
                          color="red" 
                          icon={<CloseCircleOutlined />}
                          style={{ fontSize: '9px' }}
                        >
                          Refusée
                        </Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label="Motif de refus">
                        <Text style={{ fontSize: '10px', color: '#ff4d4f', fontStyle: 'italic' }}>
                          {etudiant.prise_en_charge.motif_refus || 'Non spécifié'}
                        </Text>
                      </Descriptions.Item>
                      <Descriptions.Item label="Date décision">
                        {etudiant.prise_en_charge.date_validation ? new Date(etudiant.prise_en_charge.date_validation).toLocaleDateString() : 'N/A'}
                      </Descriptions.Item>
                    </Descriptions>
                  </Col>
                </Row>
              </Card>
            )}
          </>
        )}

        {/* Section Scolarité */}
        <Card 
          title="Scolarité et Paiements" 
          style={{ marginBottom: '15px' }}
          headStyle={{ 
            backgroundColor: '#f0f9ff',
            borderBottom: '1px solid #e8e8e8',
            fontWeight: 'bold',
            color: '#1890ff',
            fontSize: '12px',
            padding: '5px 8px',
            minHeight: 'auto'
          }}
          bodyStyle={{ padding: '8px' }}
        >
          {/* Information sur la réduction PEC */}
          {etudiant.prise_en_charge?.statut === 'valide' && (
            <div style={{
              marginBottom: '10px',
              padding: '7px',
              backgroundColor: '#f6ffed',
              border: '1px solid #b7eb8f',
              borderRadius: '3px'
            }}>
              <Text strong style={{ color: '#52c41a', fontSize: '10px', display: 'block', marginBottom: '3px' }}>
                ✓ Prise en charge active: {etudiant.prise_en_charge.pourcentage_reduction}% de réduction
              </Text>
              <Text style={{ fontSize: '9px' }}>
                Économie: {etudiant.prise_en_charge.montant_reduction?.toLocaleString()} FCFA
              </Text>
            </div>
          )}

          <Row gutter={11} style={{ marginBottom: '10px' }}>
            <Col xs={24} sm={8}>
              <div style={{ backgroundColor: '#fafafa', padding: '7px', borderRadius: '3px', textAlign: 'center' }}>
                <div style={{ fontSize: '10px', color: '#666', marginBottom: '3px' }}>
                  {etudiant.prise_en_charge?.statut === 'valide' ? 'Total Scolarité' : 'Total Scolarité'}
                </div>
                <div style={{ color: '#1890ff', fontWeight: 'bold', fontSize: '12px' }}>
                  {montantScolariteAvecReduction.toLocaleString()} FCFA
                </div>
                {etudiant.prise_en_charge?.statut === 'valide' && (
                  <div style={{ fontSize: '8px', color: '#999', marginTop: '2px' }}>
                    (Original: {etudiant.scolarite.montant_scolarite.toLocaleString()} FCFA)
                  </div>
                )}
              </div>
            </Col>
            <Col xs={24} sm={8}>
              <div style={{ backgroundColor: '#fafafa', padding: '7px', borderRadius: '3px', textAlign: 'center' }}>
                <div style={{ fontSize: '10px', color: '#666', marginBottom: '3px' }}>Total Payé</div>
                <div style={{ color: '#52c41a', fontWeight: 'bold', fontSize: '12px' }}>
                  {etudiant.scolarite.scolarite_verse.toLocaleString()} FCFA
                </div>
              </div>
            </Col>
            <Col xs={24} sm={8}>
              <div style={{ 
                backgroundColor: '#fafafa', 
                padding: '7px', 
                borderRadius: '3px', 
                textAlign: 'center',
                border: isSolde ? '1px solid #52c41a' : '1px solid #ff4d4f'
              }}>
                <div style={{ fontSize: '10px', color: '#666', marginBottom: '3px' }}>Reste à Payer</div>
                <div style={{ 
                  color: etudiant.scolarite.scolarite_restante > 0 ? '#ff4d4f' : '#52c41a',
                  fontWeight: 'bold', 
                  fontSize: '12px' 
                }}>
                  {etudiant.scolarite.scolarite_restante.toLocaleString()} FCFA
                </div>
              </div>
            </Col>
          </Row>

          <Divider orientation="left" style={{ fontSize: '10px', margin: '7px 0' }}>
            <TeamOutlined /> Historique des Paiements
          </Divider>

          <Table
            columns={columns}
            dataSource={paiements}
            rowKey="id"
            pagination={false}
            bordered
            size="small"
            style={{ marginTop: '7px' }}
            scroll={{ x: 500 }}
            summary={() => (
              <Table.Summary fixed>
                <Table.Summary.Row style={{ fontWeight: 'bold' }}>
                  <Table.Summary.Cell index={0} colSpan={3}>
                    <Text strong style={{ fontSize: '10px' }}>Total Payé</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={1} align="right">
                    <Text strong style={{ color: '#52c41a', fontSize: '10px' }}>
                      {etudiant.scolarite.scolarite_verse.toLocaleString()} FCFA
                    </Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={2} colSpan={1}></Table.Summary.Cell>
                </Table.Summary.Row>
              </Table.Summary>
            )}
          />
        </Card>

        {/* Mention frais de soutenance — Licence 3 / Licence 3 Pro, année académique concernée uniquement */}
        {etudiant.mention_soutenance && (
          <div style={{
            marginTop: '10px',
            padding: '8px',
            backgroundColor: '#fffbe6',
            border: '1px solid #ffe58f',
            borderRadius: '3px'
          }}>
            <Text style={{ fontSize: '9px', color: '#874d00' }}>
              {etudiant.mention_soutenance}
            </Text>
          </div>
        )}

        {/* Pied de page */}
        <div style={{ 
          marginTop: '18px',
          textAlign: 'center',
          color: '#666',
          fontSize: '9px',
          borderTop: '1px solid #f0f0f0',
          paddingTop: '8px'
        }}>
          <div>Reçu généré le {new Date().toLocaleDateString()}</div>
          <div style={{ marginTop: '3px' }}>
            Institut International Polytechnique des Elites d'Abidjan
          </div>
        </div>
      </div>

      {/* Boutons d'actions */}
      <div style={{ 
        marginTop: '15px', 
        textAlign: 'center',
        display: 'flex',
        justifyContent: 'center',
        gap: '11px',
        flexWrap: 'wrap'
      }} className="no-print">
        <Button 
          type="primary" 
          icon={<PrinterOutlined />} 
          onClick={handlePrint}
          size="middle"
          style={{ minWidth: '150px' }}
        >
          Imprimer le Reçu
        </Button>
      </div>
    </div>
  );
};

export default RecuEtudiant;