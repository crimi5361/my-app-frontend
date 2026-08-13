/* eslint-disable @typescript-eslint/no-explicit-any */
// Espace Chargé Pédagogique — tableau de bord (§3.1).
//
// Cadré sur les deux gestes quotidiens du CP : allouer les salles des séances à venir et
// traiter sa bannette. Le reste (besoins, volumétrie) est du contexte, pas de l'action.
import { useCallback, useEffect, useState } from 'react';
import { Row, Col, Select, Spin, Alert, Table, Tag, Button } from 'antd';
import {
  ApartmentOutlined, InboxOutlined, CalendarOutlined, WarningOutlined,
  SolutionOutlined, ArrowRightOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../Components/PageHeader/PageHeader';
import PageContainer from '../../Components/ui/PageContainer';
import Card from '../../Components/ui/Card';
import StatCard from '../../Components/ui/StatCard';
import { apiFetch, ApiError } from '../../lib/api';
import {
  useAnneesAcademiques, formatDate, formatHeure, nomComplet,
} from '../../lib/enseignants';

interface DonneesDashboard {
  besoins: { par_statut: Record<string, number>; postes_ouverts: number };
  classes: number;
  seances_planifiees: number;
  seances_sans_salle: number;
  candidatures: Record<string, number>;
  prochaines_seances: {
    id: number;
    date_seance: string;
    heure_debut: string;
    heure_fin: string;
    salle_id: number | null;
    classe: string;
    matiere: string | null;
    salle: string | null;
    enseignant_nom: string | null;
    enseignant_prenoms: string | null;
  }[];
}

const DashboardChargePedagogique = () => {
  const navigate = useNavigate();
  const { annees, anneeId, setAnneeId, chargement: chargementAnnees, erreur } = useAnneesAcademiques();

  const [donnees, setDonnees] = useState<DonneesDashboard | null>(null);
  const [chargement, setChargement] = useState(false);
  const [erreurStats, setErreurStats] = useState<string | null>(null);

  const charger = useCallback(() => {
    if (!anneeId) return;
    setChargement(true);
    apiFetch<{ data: DonneesDashboard }>(`/api/charge-pedagogique/dashboard?annee_id=${anneeId}`)
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

  const aTraiter = (donnees?.candidatures.recue || 0) + (donnees?.candidatures.preselectionnee || 0);

  return (
    <div>
      <PageHeader />
      <PageContainer
        title="Tableau de bord — Chargé Pédagogique"
        description="Vos filières : besoins en enseignants, planning et allocation des salles."
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
            {/* Séances à venir sans salle : c'est l'alerte qui déclenche le travail du jour. */}
            {donnees.seances_sans_salle > 0 && (
              <Alert
                type="warning"
                showIcon
                icon={<WarningOutlined />}
                style={{ marginBottom: 20 }}
                message={`${donnees.seances_sans_salle} séance(s) à venir sans salle affectée`}
                description="Les cours planifiés sans salle physique ne sont pas exploitables par les enseignants ni par les étudiants."
                action={
                  <Button size="small" type="primary" onClick={() => navigate('/charge-pedagogique/allocation-salles')}>
                    Allouer les salles
                  </Button>
                }
              />
            )}

            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
              <Col xs={24} sm={12} lg={6}>
                <StatCard label="Classes de mon périmètre" value={donnees.classes} icon={<ApartmentOutlined />} />
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <StatCard
                  label="Séances planifiées"
                  value={donnees.seances_planifiees}
                  icon={<CalendarOutlined />}
                  hint={`dont ${donnees.seances_sans_salle} sans salle`}
                  tone={donnees.seances_sans_salle > 0 ? 'warning' : 'success'}
                />
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <StatCard
                  label="Postes à pourvoir"
                  value={donnees.besoins.postes_ouverts}
                  icon={<SolutionOutlined />}
                  hint={`${donnees.besoins.par_statut.ouvert || 0} besoin(s) ouvert(s)`}
                  tone="gold"
                />
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <StatCard
                  label="Candidatures à pré-évaluer"
                  value={aTraiter}
                  icon={<InboxOutlined />}
                  tone={aTraiter > 0 ? 'warning' : 'ink'}
                  hint={`${donnees.candidatures.transmise_rh || 0} transmise(s) aux RH`}
                />
              </Col>
            </Row>

            <Card
              title="Prochaines séances (7 jours)"
              extra={
                <Button type="link" icon={<ArrowRightOutlined />} onClick={() => navigate('/charge-pedagogique/emploi-du-temps')}>
                  Emploi du temps
                </Button>
              }
            >
              <Table
                dataSource={donnees.prochaines_seances}
                rowKey="id"
                size="small"
                pagination={false}
                locale={{ emptyText: 'Aucune séance programmée dans les 7 prochains jours.' }}
                columns={[
                  { title: 'Date', dataIndex: 'date_seance', render: (v: string) => formatDate(v) },
                  {
                    title: 'Horaire',
                    render: (_: any, r) => `${formatHeure(r.heure_debut)} – ${formatHeure(r.heure_fin)}`,
                  },
                  { title: 'Classe', dataIndex: 'classe' },
                  { title: 'Matière', dataIndex: 'matiere', render: (v: string | null) => v || '—' },
                  {
                    title: 'Enseignant',
                    render: (_: any, r) => nomComplet(r.enseignant_nom, r.enseignant_prenoms),
                  },
                  {
                    title: 'Salle',
                    dataIndex: 'salle',
                    render: (v: string | null) =>
                      v ? <Tag color="green">{v}</Tag> : <Tag color="warning">À affecter</Tag>,
                  },
                ]}
              />
            </Card>
          </>
        )}
      </PageContainer>
    </div>
  );
};

export default DashboardChargePedagogique;
