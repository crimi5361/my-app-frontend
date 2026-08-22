import { Card, Row, Col, Statistic } from 'antd';
import { GiftOutlined, CheckCircleOutlined, ShoppingOutlined, ClockCircleOutlined } from '@ant-design/icons';

// Chantier Kit étudiant — Phase Statistiques (2026-08-21). Carte PARTAGÉE, réutilisée à
// l'identique par les 4 dashboards (Fondateur, Administrateur, Comptabilité, Caisse) — un seul
// affichage pour un seul service backend (services/kitStatistiques.service.js), jamais une
// deuxième mise en forme divergente par dashboard.
export interface StatistiquesKit {
  eligibles: number;
  exemptes: number;
  apportes: number;
  payes: number;
  sans_kit: number;
  montant_total_paye: number;
}

const formatFcfa = (v: number) => `${Number(v).toLocaleString('fr-FR')} FCFA`;

const KitStatsCard = ({ kit }: { kit: StatistiquesKit }) => (
  <Card title={<span><GiftOutlined /> Kit étudiant (rames + marqueurs)</span>} style={{ marginBottom: 24 }}>
    <Row gutter={[16, 16]}>
      <Col xs={12} sm={8} md={4}>
        <Statistic title="Éligibles" value={kit.eligibles} />
      </Col>
      <Col xs={12} sm={8} md={4}>
        <Statistic title="Exemptés (1ère année)" value={kit.exemptes} />
      </Col>
      <Col xs={12} sm={8} md={4}>
        <Statistic title="Sans kit" value={kit.sans_kit} valueStyle={{ color: 'var(--warning)' }} prefix={<ClockCircleOutlined />} />
      </Col>
      <Col xs={12} sm={8} md={4}>
        <Statistic title="Apportés" value={kit.apportes} valueStyle={{ color: 'var(--mod-caisse)' }} prefix={<CheckCircleOutlined />} />
      </Col>
      <Col xs={12} sm={8} md={4}>
        <Statistic title="Payés" value={kit.payes} valueStyle={{ color: 'var(--success)' }} prefix={<ShoppingOutlined />} />
      </Col>
      <Col xs={12} sm={8} md={4}>
        <Statistic title="Montant total payé" value={kit.montant_total_paye} formatter={(v) => formatFcfa(Number(v))} />
      </Col>
    </Row>
  </Card>
);

export default KitStatsCard;
