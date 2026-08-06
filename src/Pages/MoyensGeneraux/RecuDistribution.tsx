import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, Descriptions, Typography, Button, Table, Spin, message, Row, Col, Avatar } from 'antd';
import { PrinterOutlined, UserOutlined, GiftOutlined } from '@ant-design/icons';
import { QRCodeSVG } from 'qrcode.react';
import { apiFetch, ApiError } from '../../lib/api';

const { Title, Text } = Typography;
const API_URL = import.meta.env.VITE_API_URL_SERVER;

interface LigneRemise {
  accessoire_id: number;
  code: string;
  nom: string;
  quantite: number;
}

interface RecuData {
  id: number;
  numero_recu: string;
  date_remise: string;
  ecole_nom: string;
  filiere_nom: string;
  niveau_nom: string;
  classe_nom: string | null;
  site_nom: string;
  nom: string;
  prenoms: string;
  matricule: string;
  matricule_iipea: string;
  sexe: string;
  photo_url: string | null;
  agent_nom: string;
  annee_academique: string;
  lignes: LigneRemise[];
}

const RecuDistribution = () => {
  const { id } = useParams<{ id: string }>();
  const [recu, setRecu] = useState<RecuData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    apiFetch<{ data: RecuData }>(`/api/moyens-generaux/distribution/${id}`)
      .then((res) => setRecu(res.data))
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) return;
        message.error("Impossible de charger le reçu de remise");
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handlePrint = () => {
    const printContent = document.getElementById('printable-area');
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      message.error('Veuillez autoriser les pop-ups pour imprimer');
      return;
    }

    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map((el) => el.outerHTML)
      .join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Reçu de remise ${recu?.numero_recu}</title>
          <meta charset="utf-8">
          ${styles}
          <style>
            @media print {
              body { margin: 0; padding: 8px !important; background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-size: 10px !important; }
              .no-print { display: none !important; }
              .ant-card { break-inside: avoid; box-shadow: none !important; border: 1px solid #d9d9d9 !important; margin-bottom: 8px !important; padding: 8px !important; }
              .ant-card-head { padding: 5px 8px !important; min-height: auto !important; }
              .ant-card-head-title { font-size: 12px !important; padding: 0 !important; }
              .ant-table { width: 100% !important; font-size: 10px !important; }
              .ant-table-thead > tr > th { background: #fafafa !important; color: #000 !important; font-weight: bold !important; padding: 5px !important; }
              .ant-table-tbody > tr > td { padding: 5px !important; }
              .ant-descriptions-item-label, .ant-descriptions-item-content { font-size: 10px !important; padding: 2px 4px !important; }
              .ant-avatar { width: 90px !important; height: 90px !important; }
              * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              @page { size: portrait; margin: 8mm; }
              .ant-btn { display: none !important; }
              .logo-container { transform: scale(0.85); transform-origin: top center; margin-bottom: 5px !important; }
            }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 8px; background: white; font-size: 10px; }
          </style>
        </head>
        <body onload="window.print(); window.onafterprint = function() { window.close(); }">
          <div class="print-container">${printContent.innerHTML}</div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  if (loading) {
    return <Spin size="large" style={{ display: 'flex', justifyContent: 'center', marginTop: 55 }} />;
  }

  if (!recu) {
    return (
      <div style={{ padding: 26 }}>
        <Card><Text type="danger">Reçu de remise introuvable.</Text></Card>
      </div>
    );
  }

  const qrData = JSON.stringify({
    type: 'recu_remise_accessoires',
    numero_recu: recu.numero_recu,
    matricule_iipea: recu.matricule_iipea,
    nom_complet: `${recu.nom} ${recu.prenoms}`,
    date_remise: recu.date_remise,
  });

  return (
    <div style={{ padding: 20, maxWidth: 900, margin: '0 auto' }}>
      <div
        id="printable-area"
        style={{ position: 'relative', backgroundColor: 'white', padding: 18, borderRadius: 6, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
      >
        {/* En-tête institution */}
        <div style={{ textAlign: 'center', marginBottom: 15, borderBottom: '1px solid #f0f0f0', paddingBottom: 10 }}>
          <div className="logo-container" style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
            <img
              src="/IIPEA-Photoroom.png"
              alt="Logo IIPEA"
              style={{ height: 50 }}
              onError={(e) => { (e.target as HTMLImageElement).src = '/default-logo.png'; }}
            />
          </div>
          <Title level={3} style={{ marginBottom: 3, color: '#1890ff', fontSize: 16 }}>
            Institut International Polytechnique des Elites d'Abidjan
          </Title>
          <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 5 }}>(IIPEA)</Text>
        </div>

        {/* Titre du document — distinct sans ambiguïté d'un reçu de paiement */}
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 18px',
            backgroundColor: '#f6ffed', border: '2px solid #52c41a', borderRadius: 20,
          }}>
            <GiftOutlined style={{ color: '#52c41a', fontSize: 16 }} />
            <Text strong style={{ color: '#237804', fontSize: 14, letterSpacing: 0.5 }}>
              REÇU DE REMISE D'ACCESSOIRES
            </Text>
          </div>
        </div>

        {/* Numéro de reçu */}
        <div style={{
          position: 'absolute', top: 10, right: 10, zIndex: 2, padding: '7px 10px', borderRadius: 5,
          boxShadow: '0 3px 8px rgba(221, 202, 134, 0.3)', border: '2px solid #fff', backgroundColor: '#fffae6',
        }}>
          <Text strong style={{ color: '#d48806', fontSize: 13, letterSpacing: 0.5 }}>{recu.numero_recu}</Text>
        </div>

        {/* QR code */}
        <div style={{
          position: 'absolute', top: 10, left: 10, zIndex: 2, padding: 5, backgroundColor: 'white',
          borderRadius: 5, boxShadow: '0 2px 6px rgba(0,0,0,0.15)', border: '1px solid #d9d9d9',
        }}>
          <QRCodeSVG value={qrData} size={90} level="H" includeMargin fgColor="#1890ff" bgColor="#ffffff" />
        </div>

        {/* Identité de l'étudiant */}
        <Row gutter={14} style={{ marginBottom: 15 }}>
          <Col xs={24} md={8} style={{ textAlign: 'center' }}>
            <Avatar
              size={120}
              src={recu.photo_url ? `${API_URL}${recu.photo_url}` : undefined}
              icon={<UserOutlined />}
              style={{ border: '2px solid #1890ff', boxShadow: '0 2px 6px rgba(24,144,255,0.3)' }}
            />
            <div style={{ marginTop: 8, backgroundColor: '#1890ff', color: 'white', padding: '3px 7px', borderRadius: 3, fontWeight: 'bold', fontSize: 11, display: 'inline-block' }}>
              {recu.matricule_iipea}
            </div>
          </Col>
          <Col xs={24} md={16}>
            <Descriptions column={2} size="small" labelStyle={{ fontWeight: 'bold', fontSize: 10 }} contentStyle={{ fontSize: 10 }}>
              <Descriptions.Item label="Nom et prénoms" span={2}>
                <Text strong>{recu.nom} {recu.prenoms}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Matricule">{recu.matricule}</Descriptions.Item>
              <Descriptions.Item label="Sexe">{recu.sexe}</Descriptions.Item>
              <Descriptions.Item label="École">{recu.ecole_nom}</Descriptions.Item>
              <Descriptions.Item label="Filière">{recu.filiere_nom}</Descriptions.Item>
              <Descriptions.Item label="Niveau">{recu.niveau_nom}</Descriptions.Item>
              <Descriptions.Item label="Classe">{recu.classe_nom ?? 'Non affecté'}</Descriptions.Item>
              <Descriptions.Item label="Année académique" span={2}>{recu.annee_academique}</Descriptions.Item>
            </Descriptions>
          </Col>
        </Row>

        {/* Informations de la remise */}
        <Card
          title="Informations de la remise"
          style={{ marginBottom: 15 }}
          headStyle={{ backgroundColor: '#f0f9ff', borderBottom: '1px solid #e8e8e8', fontWeight: 'bold', color: '#1890ff', fontSize: 12, padding: '5px 8px', minHeight: 'auto' }}
          bodyStyle={{ padding: 8 }}
        >
          <Descriptions column={3} size="small" labelStyle={{ fontWeight: 'bold', fontSize: 10 }} contentStyle={{ fontSize: 10 }}>
            <Descriptions.Item label="Date et heure">{new Date(recu.date_remise).toLocaleString('fr-FR')}</Descriptions.Item>
            <Descriptions.Item label="Agent">{recu.agent_nom}</Descriptions.Item>
            <Descriptions.Item label="Site">{recu.site_nom}</Descriptions.Item>
          </Descriptions>
        </Card>

        {/* Accessoires remis */}
        <Card
          title="Accessoires remis"
          style={{ marginBottom: 15 }}
          headStyle={{ backgroundColor: '#f0f9ff', borderBottom: '1px solid #e8e8e8', fontWeight: 'bold', color: '#1890ff', fontSize: 12, padding: '5px 8px', minHeight: 'auto' }}
          bodyStyle={{ padding: 8 }}
        >
          <Table
            dataSource={recu.lignes}
            rowKey="accessoire_id"
            pagination={false}
            bordered
            size="small"
            columns={[
              { title: 'Accessoire', dataIndex: 'nom' },
              { title: 'Code', dataIndex: 'code', width: 100 },
              { title: 'Quantité', dataIndex: 'quantite', align: 'right' as const, width: 100 },
            ]}
            summary={() => (
              <Table.Summary fixed>
                <Table.Summary.Row style={{ fontWeight: 'bold' }}>
                  <Table.Summary.Cell index={0} colSpan={2}><Text strong style={{ fontSize: 10 }}>Total articles</Text></Table.Summary.Cell>
                  <Table.Summary.Cell index={1} align="right">
                    <Text strong style={{ fontSize: 10 }}>{recu.lignes.reduce((s, l) => s + l.quantite, 0)}</Text>
                  </Table.Summary.Cell>
                </Table.Summary.Row>
              </Table.Summary>
            )}
          />
        </Card>

        <div style={{ marginTop: 18, textAlign: 'center', color: '#666', fontSize: 9, borderTop: '1px solid #f0f0f0', paddingTop: 8 }}>
          <div>Document généré le {new Date().toLocaleDateString('fr-FR')} — réimpression illimitée, aucune donnée modifiée</div>
          <div style={{ marginTop: 3 }}>Institut International Polytechnique des Elites d'Abidjan</div>
        </div>
      </div>

      <div className="no-print" style={{ marginTop: 15, textAlign: 'center', display: 'flex', justifyContent: 'center', gap: 11 }}>
        <Button type="primary" icon={<PrinterOutlined />} onClick={handlePrint} style={{ minWidth: 180 }}>
          Imprimer le reçu
        </Button>
      </div>
    </div>
  );
};

export default RecuDistribution;
