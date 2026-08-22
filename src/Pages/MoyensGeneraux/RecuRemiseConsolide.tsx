import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Card, Descriptions, Typography, Button, Table, Spin, message, Row, Col, Avatar, Alert } from 'antd';
import { PrinterOutlined, UserOutlined, GiftOutlined, ShoppingOutlined } from '@ant-design/icons';
import { QRCodeSVG } from 'qrcode.react';
import { apiFetch, ApiError } from '../../lib/api';
import { hasAnyPermission } from '../../lib/permissions';
import AccesRestreint from '../../Components/ui/AccesRestreint';

const { Title, Text } = Typography;
const API_URL = import.meta.env.VITE_API_URL_SERVER;

interface LigneOfferte {
  accessoire_id: number;
  code: string;
  nom: string;
  quantite: number;
}

interface LigneSurplus {
  accessoire_id: number;
  code: string;
  nom: string;
  quantite: number;
  reference: string;
  prix_unitaire_vente: string;
  montant_total: string;
  date_distribution: string;
  methode_paiement: string | null;
  date_paiement: string | null;
  paiement_numero_recu: string | null;
  caissier_nom: string | null;
}

interface RecuConsolideData {
  etudiant: {
    id: number; nom: string; prenoms: string; matricule: string; matricule_iipea: string;
    sexe: string; photo_url: string | null;
  };
  annee_academique: string;
  ecole_nom: string;
  filiere_nom: string;
  niveau_nom: string;
  classe_nom: string | null;
  site_nom: string;
  numero_recu_reference: string;
  date_derniere_remise: string;
  lignes_offertes: LigneOfferte[];
  lignes_surplus: LigneSurplus[];
  total_offerts: number;
  total_surplus_paye: number;
}

const formatFcfa = (v: number | string) => `${Number(v).toLocaleString('fr-FR')} FCFA`;

// Chantier Moyens Généraux, Phase 2D — ajustements (2026-08-19) : reçu de remise CONSOLIDÉ,
// distinct du reçu par session (RecuDistribution.tsx, inchangé) — reflète l'état COMPLET des
// remises d'un étudiant pour une année (offertes + surplus), actualisé à chaque nouvelle
// distribution sans jamais remplacer/détruire l'historique (§3/§4). Toujours et uniquement un
// "REÇU DE REMISE D'ACCESSOIRES" — jamais confondu avec le reçu d'inscription (§1/§5), qui reste
// entièrement géré ailleurs (Etudiant/Recu_Payement), non touché par ce chantier.
const RecuRemiseConsolide = () => {
  const { etudiantId } = useParams<{ etudiantId: string }>();
  const [searchParams] = useSearchParams();
  const anneeAcademiqueId = searchParams.get('anneeAcademiqueId');
  const [recu, setRecu] = useState<RecuConsolideData | null>(null);
  const [loading, setLoading] = useState(true);

  const peutConsulter = hasAnyPermission('distribution.voir', 'distribution.effectuer');

  useEffect(() => {
    if (!etudiantId || !anneeAcademiqueId || !peutConsulter) { setLoading(false); return; }
    apiFetch<{ data: RecuConsolideData }>(`/api/moyens-generaux/distribution/etudiant/${etudiantId}/recu-consolide?anneeAcademiqueId=${anneeAcademiqueId}`)
      .then((res) => setRecu(res.data))
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) return;
        message.error("Impossible de charger le reçu de remise");
      })
      .finally(() => setLoading(false));
  }, [etudiantId, anneeAcademiqueId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePrint = () => {
    const printContent = document.getElementById('printable-area');
    if (!printContent) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) { message.error('Veuillez autoriser les pop-ups pour imprimer'); return; }
    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]')).map((el) => el.outerHTML).join('');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Reçu de remise ${recu?.numero_recu_reference}</title>
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

  if (!peutConsulter) {
    return (
      <div style={{ padding: 26 }}>
        <AccesRestreint description="Vous n'avez pas la permission de consulter ce reçu de remise." />
      </div>
    );
  }

  if (!recu) {
    return (
      <div style={{ padding: 26 }}>
        <Card><Text type="danger">Reçu de remise introuvable — aucune remise enregistrée pour cet étudiant sur cette année académique.</Text></Card>
      </div>
    );
  }

  const qrData = JSON.stringify({
    type: 'recu_remise_accessoires_consolide',
    reference: recu.numero_recu_reference,
    matricule_iipea: recu.etudiant.matricule_iipea,
    nom_complet: `${recu.etudiant.nom} ${recu.etudiant.prenoms}`,
    date: recu.date_derniere_remise,
  });

  const aDuSurplus = recu.lignes_surplus.length > 0;

  return (
    <div style={{ padding: 20, maxWidth: 900, margin: '0 auto' }}>
      <div
        id="printable-area"
        style={{ position: 'relative', backgroundColor: 'white', padding: 18, borderRadius: 6, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
      >
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

        <div style={{
          position: 'absolute', top: 10, right: 10, zIndex: 2, padding: '7px 10px', borderRadius: 5,
          boxShadow: '0 3px 8px rgba(221, 202, 134, 0.3)', border: '2px solid #fff', backgroundColor: '#fffae6',
        }}>
          <Text strong style={{ color: '#d48806', fontSize: 13, letterSpacing: 0.5 }}>{recu.numero_recu_reference}</Text>
        </div>

        <div style={{
          position: 'absolute', top: 10, left: 10, zIndex: 2, padding: 5, backgroundColor: 'white',
          borderRadius: 5, boxShadow: '0 2px 6px rgba(0,0,0,0.15)', border: '1px solid #d9d9d9',
        }}>
          <QRCodeSVG value={qrData} size={90} level="H" includeMargin fgColor="#1890ff" bgColor="#ffffff" />
        </div>

        <Row gutter={14} style={{ marginBottom: 15 }}>
          <Col xs={24} md={8} style={{ textAlign: 'center' }}>
            <Avatar
              size={120}
              src={recu.etudiant.photo_url ? `${API_URL}${recu.etudiant.photo_url}` : undefined}
              icon={<UserOutlined />}
              style={{ border: '2px solid #1890ff', boxShadow: '0 2px 6px rgba(24,144,255,0.3)' }}
            />
            <div style={{ marginTop: 8, backgroundColor: '#1890ff', color: 'white', padding: '3px 7px', borderRadius: 3, fontWeight: 'bold', fontSize: 11, display: 'inline-block' }}>
              {recu.etudiant.matricule_iipea}
            </div>
          </Col>
          <Col xs={24} md={16}>
            <Descriptions column={2} size="small" labelStyle={{ fontWeight: 'bold', fontSize: 10 }} contentStyle={{ fontSize: 10 }}>
              <Descriptions.Item label="Nom et prénoms" span={2}>
                <Text strong>{recu.etudiant.nom} {recu.etudiant.prenoms}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Matricule">{recu.etudiant.matricule}</Descriptions.Item>
              <Descriptions.Item label="Sexe">{recu.etudiant.sexe}</Descriptions.Item>
              <Descriptions.Item label="École">{recu.ecole_nom}</Descriptions.Item>
              <Descriptions.Item label="Filière">{recu.filiere_nom}</Descriptions.Item>
              <Descriptions.Item label="Niveau">{recu.niveau_nom}</Descriptions.Item>
              <Descriptions.Item label="Classe">{recu.classe_nom ?? 'Non affecté'}</Descriptions.Item>
              <Descriptions.Item label="Année académique" span={2}>{recu.annee_academique}</Descriptions.Item>
            </Descriptions>
          </Col>
        </Row>

        {/* Accessoires offerts */}
        <Card
          title="Accessoires offerts"
          style={{ marginBottom: 15 }}
          headStyle={{ backgroundColor: '#f0f9ff', borderBottom: '1px solid #e8e8e8', fontWeight: 'bold', color: '#1890ff', fontSize: 12, padding: '5px 8px', minHeight: 'auto' }}
          bodyStyle={{ padding: 8 }}
        >
          <Table
            dataSource={recu.lignes_offertes}
            rowKey="accessoire_id"
            pagination={false}
            bordered
            size="small"
            locale={{ emptyText: 'Aucun accessoire offert' }}
            columns={[
              { title: 'Accessoire', dataIndex: 'nom' },
              { title: 'Code', dataIndex: 'code', width: 100 },
              { title: 'Quantité', dataIndex: 'quantite', align: 'right' as const, width: 100 },
            ]}
            summary={() => (
              <Table.Summary fixed>
                <Table.Summary.Row style={{ fontWeight: 'bold' }}>
                  <Table.Summary.Cell index={0} colSpan={2}><Text strong style={{ fontSize: 10 }}>Total offert</Text></Table.Summary.Cell>
                  <Table.Summary.Cell index={1} align="right">
                    <Text strong style={{ fontSize: 10 }}>{recu.total_offerts} article(s)</Text>
                  </Table.Summary.Cell>
                </Table.Summary.Row>
              </Table.Summary>
            )}
          />
        </Card>

        {/* Accessoires achetés en surplus */}
        {aDuSurplus && (
          <Card
            title={<><ShoppingOutlined /> Accessoires achetés en surplus</>}
            style={{ marginBottom: 15 }}
            headStyle={{ backgroundColor: '#fff7e6', borderBottom: '1px solid #e8e8e8', fontWeight: 'bold', color: '#d46b08', fontSize: 12, padding: '5px 8px', minHeight: 'auto' }}
            bodyStyle={{ padding: 8 }}
          >
            <Table
              dataSource={recu.lignes_surplus}
              rowKey="accessoire_id"
              pagination={false}
              bordered
              size="small"
              columns={[
                { title: 'Accessoire', dataIndex: 'nom' },
                { title: 'Référence', dataIndex: 'reference' },
                { title: 'Quantité', dataIndex: 'quantite', align: 'right' as const },
                { title: 'Prix unitaire', dataIndex: 'prix_unitaire_vente', align: 'right' as const, render: (v: string) => formatFcfa(v) },
                { title: 'Montant', dataIndex: 'montant_total', align: 'right' as const, render: (v: string) => formatFcfa(v) },
              ]}
              summary={() => (
                <Table.Summary fixed>
                  <Table.Summary.Row style={{ fontWeight: 'bold' }}>
                    <Table.Summary.Cell index={0} colSpan={4}><Text strong style={{ fontSize: 10 }}>Total surplus payé</Text></Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="right">
                      <Text strong style={{ fontSize: 10 }}>{formatFcfa(recu.total_surplus_paye)}</Text>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                </Table.Summary>
              )}
            />

            <div style={{ marginTop: 12, marginBottom: 4, fontWeight: 'bold', fontSize: 10, color: '#d46b08' }}>Paiement du surplus</div>
            <Descriptions column={3} size="small" bordered labelStyle={{ fontWeight: 'bold', fontSize: 10 }} contentStyle={{ fontSize: 10 }}>
              {recu.lignes_surplus.map((l) => (
                <Descriptions.Item key={l.accessoire_id} label={l.nom} span={3}>
                  {l.methode_paiement || '—'} · {l.date_paiement ? new Date(l.date_paiement).toLocaleDateString('fr-FR') : '—'} ·
                  {' '}Reçu {l.paiement_numero_recu || '—'} · Caissier : {l.caissier_nom || '—'}
                </Descriptions.Item>
              ))}
            </Descriptions>

            <Alert
              style={{ marginTop: 10 }}
              type="warning"
              showIcon
              message="Les accessoires achetés en surplus ne sont pas remboursables après paiement."
            />
          </Card>
        )}

        <div style={{ marginTop: 18, textAlign: 'center', color: '#666', fontSize: 9, borderTop: '1px solid #f0f0f0', paddingTop: 8 }}>
          <div>Document généré le {new Date().toLocaleDateString('fr-FR')} — reflète l'état complet des remises à cet étudiant pour l'année {recu.annee_academique}</div>
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

export default RecuRemiseConsolide;
