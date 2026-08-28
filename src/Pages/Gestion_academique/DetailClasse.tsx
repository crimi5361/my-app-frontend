/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Table,
  Typography,
  Button,
  Progress,
  Spin,
  message,
  Descriptions,
  Row,
  Col,
  Empty,
  Tabs
} from 'antd';
import {  
  EyeOutlined,
  ArrowLeftOutlined,
  ApartmentOutlined,
  FileTextOutlined,
  TeamOutlined,
  PlusOutlined
} from '@ant-design/icons';
import PageHeader from '../../Components/PageHeader/PageHeader';
import DataTable from '../../Components/ui/DataTable';
import StatusTag from '../../Components/ui/StatusTag';
import { apiFetch } from '../../lib/api';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

interface Groupe {
  id: number;
  nom: string;
  capacite_max: number;
  effectif: number;
  taux_remplissage: number;
}

interface Maquette {
  id: number;
  filiere_nom: string;
  filiere_sigle: string;
  niveau_libelle: string;
  annee_academique: string;
  parcour: string;
  date_creation: string;
  annee_id: number;
}

interface UE {
  id: number;
  libelle: string;
  semestre_id: number;
  semestre_libelle: string;
  categorie_id: number;
  categorie_nom: string;
  credit_total?: number;
  matieres?: Matiere[];
}

interface Matiere {
  id: number;
  nom: string;
  coefficient: number;
  ue_id: number;
  volume_horaire_cm: number;
  taux_horaire_cm: number;
  volume_horaire_td: number;
  taux_horaire_td: number;
}

interface SemestreData {
  id: number;
  libelle: string;
  ues: UE[];
}

interface ClasseDetail {
  id: number;
  nom: string;
  description: string;
  annee_academique: string;
  annee_academique_id: number;
  annee_etat: string;
  filiere: string;
  niveau: string;
  effectif_total: number;
  groupes: Groupe[];
  filiere_id: number;
  niveau_id: number;
}

const DetailClasse = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [classe, setClasse] = useState<ClasseDetail | null>(null);
  const [maquettes, setMaquettes] = useState<Maquette[]>([]);
  const [maquetteDetail, setMaquetteDetail] = useState<any>(null);
  const [semestres, setSemestres] = useState<SemestreData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMaquettes, setLoadingMaquettes] = useState(false);
  const [loadingMaquetteDetail, setLoadingMaquetteDetail] = useState(false);
  // ✅ Correctif 2026-08-28 — message explicite quand le backend ne trouve aucune maquette pour
  // le parcours réel de la classe (jamais de repli vers une autre maquette).
  const [maquetteMessage, setMaquetteMessage] = useState<string | null>(null);
  const API_URL = import.meta.env.VITE_API_URL_SERVER || "";

  useEffect(() => {
    if (id) {
      fetchClasseDetail(id);
    }
  }, [id]);

  useEffect(() => {
    if (classe) {
      fetchMaquettesForClasse();
    }
  }, [classe]);

  const fetchClasseDetail = async (classeId: string) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/classes/classe/${classeId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      
      if (data.success) {
        setClasse(data.data);
      }
    } catch (error) {
      message.error('Erreur lors du chargement des détails de la classe');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * ✅ CORRECTIF (2026-08-28, bug "maquette JOUR affichée pour un groupe SOIR") — la résolution
   * par correspondance textuelle (filière/niveau extraits par regex du nom de classe, régime
   * départagé seulement si plusieurs candidats) a été ENTIÈREMENT déplacée côté backend
   * (GET /api/PV/vue/classe/:classeId/structure, PV.controller.js::getStructureClasse), seule
   * source de vérité : elle résout le parcours réel de la classe (curcus d'un étudiant inscrit
   * dans l'un de ses groupes) puis la maquette correspondant EXACTEMENT à ce parcours — jamais un
   * repli vers une autre maquette. `maquette_id: null` si aucune maquette n'est configurée pour ce
   * parcours précis : `maquettes` reste alors vide (l'état vide existant de cet écran s'affiche),
   * sans fallback frontend.
   */
  const fetchMaquettesForClasse = async () => {
    if (!classe) return;

    setLoadingMaquettes(true);
    try {
      const data = await apiFetch(`/api/PV/vue/classe/${classe.id}/structure`);

      if (data.maquette_id) {
        setMaquetteMessage(null);
        setMaquettes([{ id: data.maquette_id } as Maquette]);
        fetchMaquetteDetail(data.maquette_id);
      } else {
        setMaquettes([]);
        setMaquetteDetail(null);
        setMaquetteMessage(data.message || "Aucune maquette pédagogique n'est configurée pour ce parcours.");
      }
    } catch (error) {
      console.error('Erreur lors de la résolution de la maquette:', error);
      message.warning('Impossible de résoudre la maquette associée à cette classe');
      setMaquettes([]);
    } finally {
      setLoadingMaquettes(false);
    }
  };

  const fetchMaquetteDetail = async (maquetteId: number) => {
    setLoadingMaquetteDetail(true);
    try {
      const data = await apiFetch(`/api/detailaffichageMaquette/maquettes/${maquetteId}/structured`);
      setMaquetteDetail(data.maquette);
      setSemestres(data.semestres || []);
    } catch (error) {
      console.error('Erreur détaillée:', error);
      message.error('Erreur lors du chargement des détails de la maquette');
    } finally {
      setLoadingMaquetteDetail(false);
    }
  };

  const handleVoirGroupe = (groupeId: number) => {
    navigate(`/Gestion_academique/DetailGroupe/${groupeId}`);
  };

  const handleNouvelleNote = (groupeId: number) => {
    navigate(`/Gestion_academique/Groupe-NouvelleNote/${groupeId}`);
  };

  const getProgressColor = (taux: number) => {
    if (taux >= 90) return 'var(--danger)';
    if (taux >= 70) return 'var(--warning)';
    return 'var(--success)';
  };

  // Calculer le coût CM
  const calculateCoutCM = (volumeCM: number, tauxCM: number) => {
    return volumeCM * tauxCM;
  };

  // Calculer le coût TD
  const calculateCoutTD = (volumeTD: number, tauxTD: number) => {
    return volumeTD * tauxTD;
  };

  // Fonction pour regrouper les données par UE avec fusion des cellules
  const getGroupedDataByUE = (semestre: SemestreData) => {
    return semestre.ues.flatMap(ue => {
      const matieres = ue.matieres || [];
      return matieres.map((matiere, index) => ({
        ...matiere,
        ue_libelle: index === 0 ? ue.libelle : '',
        ue_id: ue.id,
        ue_rowspan: index === 0 ? matieres.length : 0,
        key: `${ue.id}-${matiere.id}`,
        ue_credit_total: ue.credit_total,
        ue_categorie: ue.categorie_nom
      }));
    });
  };

  // Colonnes du tableau pour l'affichage de la maquette
  const maquetteTableColumns = [
    { 
      title: 'UE', 
      dataIndex: 'ue_libelle', 
      key: 'ue_libelle',
      render: (text: string, record: any) => ({
        children: text ? <Text strong style={{ color: 'var(--ink)' }}>{text}</Text> : null,
        props: { rowSpan: record.ue_rowspan || 0 },
      }),
      width: '15%',
    },
    { 
      title: 'MATIÈRE (ÉCUE)', 
      dataIndex: 'nom', 
      key: 'nom',
      render: (text: string) => <Text>{text}</Text>,
      width: '20%',
    },
    { 
      title: 'VOLUME HORAIRE CM', 
      dataIndex: 'volume_horaire_cm', 
      key: 'volume_horaire_cm',
      align: 'center' as const,
      width: '8%',
    },
    { 
      title: 'TAUX HORAIRE CM', 
      dataIndex: 'taux_horaire_cm', 
      key: 'taux_horaire_cm',
      align: 'center' as const,
      render: (value: number) => value?.toLocaleString('fr-FR'),
      width: '8%',
    },
    { 
      title: 'COUT CM', 
      key: 'cout_cm',
      align: 'center' as const,
      render: (_: any, record: Matiere) => (
        <StatusTag tone="info" label={`${calculateCoutCM(record.volume_horaire_cm, record.taux_horaire_cm)?.toLocaleString('fr-FR')} F`} />
      ),
      width: '10%',
    },
    {
      title: 'VOLUME HORAIRE TD',
      dataIndex: 'volume_horaire_td', 
      key: 'volume_horaire_td',
      align: 'center' as const,
      width: '8%',
    },
    { 
      title: 'TAUX HORAIRE TD', 
      dataIndex: 'taux_horaire_td', 
      key: 'taux_horaire_td',
      align: 'center' as const,
      render: (value: number) => value?.toLocaleString('fr-FR'),
      width: '8%',
    },
    { 
      title: 'COUT TD', 
      key: 'cout_td',
      align: 'center' as const,
      render: (_: any, record: Matiere) => (
        <StatusTag tone="success" label={`${calculateCoutTD(record.volume_horaire_td, record.taux_horaire_td)?.toLocaleString('fr-FR')} F`} />
      ),
      width: '10%',
    },
    {
      title: 'COEFFICIENT',
      dataIndex: 'coefficient',
      key: 'coefficient',
      align: 'center' as const,
      render: (value: any) => <StatusTag tone="warning" label={String(typeof value === 'string' ? parseFloat(value) : value)} />,
      width: '8%',
    }
  ];

  const groupeColumns = [
    {
      title: 'Groupe',
      dataIndex: 'nom',
      key: 'nom',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: 'Capacité',
      dataIndex: 'capacite_max',
      key: 'capacite_max',
      render: (capacite: number) => <StatusTag tone="info" label={`${capacite} places`} />,
      align: 'center' as const,
    },
    {
      title: 'Taux de remplissage',
      key: 'taux_remplissage',
      render: (record: Groupe) => (
        <Progress 
          percent={record.taux_remplissage}
          strokeColor={getProgressColor(record.taux_remplissage)}
          size="small"
        />
      ),
      align: 'center' as const,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (record: Groupe) => (
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
          <Button 
            type="primary" 
            icon={<EyeOutlined />}
            onClick={() => handleVoirGroupe(record.id)}
            size="small"
          >
            Voir étudiants
          </Button>
          <Button 
            type="default" 
            icon={<PlusOutlined />}
            onClick={() => handleNouvelleNote(record.id)}
            size="small"
            style={{
              backgroundColor: 'var(--success)',
              borderColor: 'var(--success)',
              color: 'white'
            }}
          >
            Nouvelle note
          </Button>
        </div>
      ),
      align: 'center' as const,
    },
  ];

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <Spin size="large" />
        <div>Chargement des détails de la classe...</div>
      </div>
    );
  }

  if (!classe) {
    return (
      <div style={{ padding: '24px' }}>
        <Card>
          <Text type="danger">Classe non trouvée</Text>
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
          onClick={() => navigate('/Gestion_academique/Classes')}
          style={{ marginBottom: '16px' }}
        >
          Retour aux classes
        </Button>

        <Card>
          <Title level={2} style={{ marginBottom: '24px', fontSize: '20px' }}>
            <ApartmentOutlined /> DÉTAILS DE LA CLASSE: {classe.nom}
          </Title>

          <Descriptions bordered style={{ marginBottom: '24px' }}>
            <Descriptions.Item label="Description" span={3}>
              {classe.description}
            </Descriptions.Item>
            <Descriptions.Item label="Filière">
              <StatusTag tone="info" label={classe.filiere} />
            </Descriptions.Item>
            <Descriptions.Item label="Niveau">
              <StatusTag tone="success" label={classe.niveau} />
            </Descriptions.Item>
            <Descriptions.Item label="Année Académique">
              <StatusTag tone="warning" label={classe.annee_academique} />
            </Descriptions.Item>
            <Descriptions.Item label="Effectif Total">
              <Text strong>{classe.effectif_total} étudiants</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Nombre de Groupes">
              <Text strong>{classe.groupes.length} groupes</Text>
            </Descriptions.Item>
          </Descriptions>

          <Tabs defaultActiveKey="groupes">
            {/* Tab Groupes */}
            <TabPane 
              tab={
                <span>
                  <TeamOutlined />
                  Groupes de la classe
                </span>
              } 
              key="groupes"
            >
              <DataTable<Groupe>
                columns={groupeColumns}
                dataSource={classe.groupes}
                rowKey="id"
                pagination={false}
              />
            </TabPane>

            {/* Tab Maquette */}
            <TabPane 
              tab={
                <span>
                  <FileTextOutlined />
                  Maquette pédagogique
                </span>
              } 
              key="maquette"
            >
              {loadingMaquettes ? (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <Spin size="large" />
                  <div>Recherche des maquettes correspondantes...</div>
                </div>
              ) : maquettes.length > 0 ? (
                <div>
                  {/* Informations de la maquette */}
                  <Card
                    className="mb-6"
                    style={{ background: 'linear-gradient(to right, var(--paper), var(--mist))' }}
                  >
                    <Title level={4} className="text-center mb-4">
                      Maquette associée: {maquetteDetail?.filiere_nom} - {maquetteDetail?.niveau_libelle}
                    </Title>

                    <Row gutter={[16, 16]}>
                      <Col xs={24} sm={8}>
                        <div className="text-center">
                          <Text strong>Filière:</Text>
                          <br />
                          <StatusTag tone="info" label={maquetteDetail?.filiere_nom || ''} />
                        </div>
                      </Col>
                      <Col xs={24} sm={8}>
                        <div className="text-center">
                          <Text strong>Niveau:</Text>
                          <br />
                          <StatusTag tone="success" label={maquetteDetail?.niveau_libelle || ''} />
                        </div>
                      </Col>
                      <Col xs={24} sm={8}>
                        <div className="text-center">
                          <Text strong>Année:</Text>
                          <br />
                          <StatusTag tone="warning" label={maquetteDetail?.annee_academique || ''} />
                        </div>
                      </Col>
                    </Row>
                  </Card>

                  {/* Affichage des semestres de la maquette */}
                  {loadingMaquetteDetail ? (
                    <div style={{ textAlign: 'center', padding: '40px' }}>
                      <Spin size="large" />
                      <div>Chargement de la maquette...</div>
                    </div>
                  ) : semestres && semestres.length > 0 ? (
                    semestres.map((semestre) => (
                      <Card 
                        key={semestre.id} 
                        title={
                          <div className="flex items-center justify-between">
                            <span className="text-lg font-bold">SEMESTRE {semestre.libelle}</span>
                            <StatusTag tone="info" label={`${semestre.ues?.length || 0} UE(s)`} />
                          </div>
                        } 
                        className="mb-6"
                      >
                        {semestre.ues && semestre.ues.length > 0 ? (
                          <DataTable
                            columns={maquetteTableColumns}
                            dataSource={getGroupedDataByUE(semestre)}
                            rowKey="key"
                            pagination={false}
                            summary={() => {
                              const allMatieres = semestre.ues.flatMap(ue => ue.matieres || []);
                              const totalCM = allMatieres.reduce((total: number, m: any) => total + (m.volume_horaire_cm || 0), 0);
                              const totalTD = allMatieres.reduce((total: number, m: any) => total + (m.volume_horaire_td || 0), 0);
                              const totalCoutCM = allMatieres.reduce((total: number, m: any) => total + calculateCoutCM(m.volume_horaire_cm, m.taux_horaire_cm), 0);
                              const totalCoutTD = allMatieres.reduce((total: number, m: any) => total + calculateCoutTD(m.volume_horaire_td, m.taux_horaire_td), 0);
                              const totalCoeff = allMatieres.reduce((total: number, m: any) => {
                                const coeff = typeof m.coefficient === 'string' 
                                  ? parseFloat(m.coefficient) 
                                  : m.coefficient;
                                return total + (coeff || 0);
                              }, 0);

                              return (
                                <Table.Summary>
                                  <Table.Summary.Row style={{ background: 'var(--paper)', fontWeight: 600 }}>
                                    <Table.Summary.Cell index={0} colSpan={2}>
                                      <Text strong>TOTAL SEMESTRE {semestre.libelle}</Text>
                                    </Table.Summary.Cell>
                                    <Table.Summary.Cell index={1} align="center">
                                      <Text strong>{totalCM}h</Text>
                                    </Table.Summary.Cell>
                                    <Table.Summary.Cell index={2} align="center">-</Table.Summary.Cell>
                                    <Table.Summary.Cell index={3} align="center">
                                      <StatusTag tone="info" label={`${totalCoutCM.toLocaleString('fr-FR')} F`} />
                                    </Table.Summary.Cell>
                                    <Table.Summary.Cell index={4} align="center">
                                      <Text strong>{totalTD}h</Text>
                                    </Table.Summary.Cell>
                                    <Table.Summary.Cell index={5} align="center">-</Table.Summary.Cell>
                                    <Table.Summary.Cell index={6} align="center">
                                      <StatusTag tone="success" label={`${totalCoutTD.toLocaleString('fr-FR')} F`} />
                                    </Table.Summary.Cell>
                                    <Table.Summary.Cell index={7} align="center">
                                      <StatusTag tone="warning" label={String(totalCoeff)} />
                                    </Table.Summary.Cell>
                                  </Table.Summary.Row>
                                </Table.Summary>
                              );
                            }}
                          />
                        ) : (
                          <Empty description="Aucune UE pour ce semestre" />
                        )}
                      </Card>
                    ))
                  ) : (
                    <Empty description="Aucun semestre disponible pour cette maquette" />
                  )}
                </div>
              ) : (
                <Empty
                  description={
                    <div>
                      <Text>{maquetteMessage || "Aucune maquette pédagogique n'a encore été créée pour cette année académique/ce parcours."}</Text>
                      <br />
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        Aucune maquette d'un autre parcours ou d'une autre année n'est proposée à la place.
                      </Text>
                    </div>
                  }
                >
                  <Button
                    type="primary"
                    icon={<FileTextOutlined />}
                    onClick={() => navigate('/Gestion_academique/Maquettes')}
                  >
                    Créer une maquette
                  </Button>
                </Empty>
              )}
            </TabPane>
          </Tabs>
        </Card>
      </div>
    </div>
  );
};

export default DetailClasse;