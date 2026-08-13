/* eslint-disable @typescript-eslint/no-explicit-any */
// Espace Ressources Humaines — tableau de bord (§3.2).
//
// Deux angles : le flux de recrutement (ce qui attend une décision) et l'engagement
// contractuel (ce que l'institution s'est engagée à payer).
import { useCallback, useEffect, useState } from 'react';
import { Row, Col, Select, Spin, Alert, Table, Button } from 'antd';
import {
  InboxOutlined, TeamOutlined, AuditOutlined, FileTextOutlined,
  ArrowRightOutlined, DollarOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../Components/PageHeader/PageHeader';
import PageContainer from '../../Components/ui/PageContainer';
import Card from '../../Components/ui/Card';
import StatCard from '../../Components/ui/StatCard';
import StatusTag from '../../Components/ui/StatusTag';
import { apiFetch, ApiError } from '../../lib/api';
import {
  useAnneesAcademiques, formatDate, formatMontant, nomComplet,
  STATUT_CANDIDATURE, StatutCandidature,
} from '../../lib/enseignants';

interface DonneesRH {
  candidatures: Record<string, number>;
  /** Transmises par un CP + déposées directement sur une offre (§3.2). */
  a_decider: number;
  offres: Record<string, number>;
  enseignants: Record<string, number>;
  contrats: Record<string, number>;
  engagement: { total: string; heures: number };
  candidatures_recentes: {
    id: number;
    reference: string;
    nom: string;
    prenoms: string;
    specialite: string | null;
    statut: StatutCandidature;
    created_at: string;
    offre_titre: string | null;
  }[];
}

const DashboardRH = () => {
  const navigate = useNavigate();
  const { annees, anneeId, setAnneeId, chargement: chargementAnnees, erreur } = useAnneesAcademiques();

  const [donnees, setDonnees] = useState<DonneesRH | null>(null);
  const [chargement, setChargement] = useState(false);
  const [erreurStats, setErreurStats] = useState<string | null>(null);

  const charger = useCallback(() => {
    setChargement(true);
    const suffixe = anneeId ? `?annee_id=${anneeId}` : '';
    apiFetch<{ data: DonneesRH }>(`/api/rh/dashboard${suffixe}`)
      .then((res) => { setDonnees(res.data); setErreurStats(null); })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) return;
        setErreurStats('Impossible de charger le tableau de bord.');
      })
      .finally(() => setChargement(false));
  }, [anneeId]);

  useEffect(() => { charger(); }, [charger]);

  if (chargementAnnees) {
    return <div><PageHeader /><div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div></div>;
  }
  if (erreur) {
    return <div><PageHeader /><PageContainer><Alert type="error" showIcon message="Erreur" description={erreur} /></PageContainer></div>;
  }

  const aDecider = donnees?.a_decider || 0;

  return (
    <div>
      <PageHeader />
      <PageContainer
        title="Tableau de bord — Ressources Humaines"
        description="Recrutement enseignant, accès au portail et engagements contractuels."
        actions={
          <Select
            value={anneeId}
            onChange={setAnneeId}
            style={{ width: 220 }}
            options={annees.map((a) => ({ value: a.id, label: `${a.annee} (${a.etat})` }))}
          />
        }
      >
        {erreurStats && <Alert type="error" showIcon message={erreurStats} style={{ marginBottom: 20 }} />}

        {chargement || !donnees ? (
          <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
        ) : (
          <>
            {aDecider > 0 && (
              <Alert
                type="info"
                showIcon
                style={{ marginBottom: 20 }}
                message={`${aDecider} candidature(s) attendent votre décision`}
                action={
                  <Button size="small" type="primary" onClick={() => navigate('/rh/candidatures')}>
                    Traiter
                  </Button>
                }
              />
            )}

            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
              <Col xs={24} sm={12} lg={6}>
                <StatCard
                  label="À décider"
                  value={aDecider}
                  icon={<InboxOutlined />}
                  tone={aDecider > 0 ? 'warning' : 'ink'}
                  hint={`transmises par un CP ou reçues sur une offre`}
                />
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <StatCard
                  label="Offres publiées"
                  value={donnees.offres.publiee || 0}
                  icon={<FileTextOutlined />}
                  hint={`${donnees.offres.brouillon || 0} brouillon(s)`}
                />
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <StatCard
                  label="Enseignants actifs"
                  value={donnees.enseignants.actif || 0}
                  icon={<TeamOutlined />}
                  tone="success"
                  hint={`${donnees.contrats.actif || 0} contrat(s) actif(s)`}
                />
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <StatCard
                  label="Engagement prévisionnel"
                  value={formatMontant(donnees.engagement.total)}
                  icon={<DollarOutlined />}
                  tone="gold"
                  hint={`${donnees.engagement.heures} h contractualisées`}
                />
              </Col>
            </Row>

            <Row gutter={[16, 16]}>
              <Col xs={24} lg={16}>
                <Card
                  title="Dernières candidatures"
                  extra={
                    <Button type="link" icon={<ArrowRightOutlined />} onClick={() => navigate('/rh/candidatures')}>
                      Toutes les candidatures
                    </Button>
                  }
                >
                  <Table
                    dataSource={donnees.candidatures_recentes}
                    rowKey="id"
                    size="small"
                    pagination={false}
                    locale={{ emptyText: 'Aucune candidature reçue pour l\'instant.' }}
                    columns={[
                      {
                        title: 'Candidat',
                        render: (_: any, r) => (
                          <div>
                            <div style={{ fontWeight: 600 }}>{nomComplet(r.nom, r.prenoms)}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>{r.reference}</div>
                          </div>
                        ),
                      },
                      { title: 'Spécialité', dataIndex: 'specialite', render: (v: string | null) => v || '—' },
                      { title: 'Offre', dataIndex: 'offre_titre', render: (v: string | null) => v || 'Spontanée' },
                      {
                        title: 'Statut', dataIndex: 'statut',
                        render: (v: StatutCandidature) => (
                          <StatusTag tone={STATUT_CANDIDATURE[v].tone} label={STATUT_CANDIDATURE[v].label} />
                        ),
                      },
                      { title: 'Reçue le', dataIndex: 'created_at', render: (v: string) => formatDate(v) },
                    ]}
                  />
                </Card>
              </Col>

              <Col xs={24} lg={8}>
                <Card title={<><AuditOutlined /> Répartition du pipeline</>}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {(Object.keys(STATUT_CANDIDATURE) as StatutCandidature[]).map((statut) => (
                      <div key={statut} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <StatusTag tone={STATUT_CANDIDATURE[statut].tone} label={STATUT_CANDIDATURE[statut].label} />
                        <span style={{ fontWeight: 700, fontSize: 18 }}>{donnees.candidatures[statut] || 0}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              </Col>
            </Row>
          </>
        )}
      </PageContainer>
    </div>
  );
};

export default DashboardRH;
