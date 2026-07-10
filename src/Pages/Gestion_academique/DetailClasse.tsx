/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Card, 
  Table, 
  Typography, 
  Button,
  Tag,
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

  // Fonction pour normaliser les noms (supprimer les sigles et espaces superflus)
  //   const normalizeName = (name: string): string => {
  //   return name
  //     .toLowerCase()
  //     .replace(/\s+/g, ' ') // Remplacer les espaces multiples par un seul
  //     .trim()
  //     .replace(/[^a-z0-9\s]/g, '') // Supprimer les caractères spéciaux
  //     .replace(/\b(scj|sic|adaf|lic|licence|master|doctorat)\b/gi, '') // Supprimer les sigles communs
  //     .replace(/\s+/g, ' ') // Nettoyer à nouveau les espaces
  //     .trim();
  // };

  // Fonction pour extraire le niveau du nom
  const extractNiveau = (name: string): string => {
    const niveauMatch = name.match(/(licence|master|doctorat)\s*(\d+)/i);
    return niveauMatch ? `${niveauMatch[1]} ${niveauMatch[2]}`.toLowerCase() : '';
  };

  // Fonction pour extraire la filière du nom (sans le niveau)
  const extractFiliere = (name: string): string => {
    return name
      .replace(/(licence|master|doctorat)\s*\d+/gi, '') // Supprimer le niveau
      .replace(/\b(scj|sic|adaf)\b/gi, '') // Supprimer les sigles
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  };

  // Fonction pour extraire le type de parcours (Jour ou Soir)
  const extractRegime = (text: string): string => {
    if (!text) return '';
    const match = text.match(/(Jour|Soir)/i);
    return match ? match[1].toLowerCase() : '';
  };

  const fetchMaquettesForClasse = async () => {
    if (!classe) return;
    
    setLoadingMaquettes(true);
    try {
      // Récupérer toutes les maquettes
      const response = await fetch(`${API_URL}/api/maquettes`);
      
      const data = await response.json();
      
      if (Array.isArray(data)) {
        console.log('Toutes les maquettes:', data);
        console.log('Nom de la classe:', classe.nom);
        console.log('Description de la classe:', classe.description);
        
        // Filtrer les maquettes avec une correspondance plus intelligente
        const maquettesFiltrees = data.filter(maquette => {
          const filiereClasse = extractFiliere(classe.nom);
          const filiereMaquette = extractFiliere(maquette.filiere_nom);
          const niveauClasse = extractNiveau(classe.nom);
          const niveauMaquette = extractNiveau(maquette.niveau_libelle);
          
          // Extraction du régime depuis la description de la classe et le parcours de la maquette
          const regimeClasse = extractRegime(classe.description);
          const regimeMaquette = extractRegime(maquette.parcour || '');

          console.log('Comparaison détaillée:', {
            classe: classe.nom,
            classeDescription: classe.description,
            maquette: `${maquette.filiere_nom} ${maquette.niveau_libelle}`,
            maquetteParcours: maquette.parcour,
            filiereClasse,
            filiereMaquette,
            niveauClasse,
            niveauMaquette,
            regimeClasse,
            regimeMaquette
          });

          // Vérifier la correspondance sur plusieurs critères
          const correspondanceFiliere = filiereClasse.includes(filiereMaquette) || 
                                      filiereMaquette.includes(filiereClasse);
          
          const correspondanceNiveau = niveauClasse === niveauMaquette;
          
          // Correspondance du régime :
          // - Si les deux ont un régime détecté, ils doivent correspondre.
          // - Si aucun des deux n'a de régime (filières sans jour/soir), on ignore ce critère.
          const correspondanceRegime =
            (regimeClasse === '' && regimeMaquette === '') || regimeClasse === regimeMaquette;

          console.log('Résultat correspondance:', {
            correspondanceFiliere,
            correspondanceNiveau,
            correspondanceRegime,
            correspondanceGlobale: correspondanceFiliere && correspondanceNiveau && correspondanceRegime
          });

          return correspondanceFiliere && correspondanceNiveau && correspondanceRegime;
        });
        
        console.log('Maquettes filtrées:', maquettesFiltrees);
        setMaquettes(maquettesFiltrees);
        
        // Si une maquette correspond, charger ses détails
        if (maquettesFiltrees.length > 0) {
          fetchMaquetteDetail(maquettesFiltrees[0].id);
        } else {
          // Debug: Afficher pourquoi aucune correspondance n'a été trouvée
          console.warn('Aucune maquette trouvée. Raisons possibles:');
          console.warn('- Les noms ne correspondent pas');
          console.warn('- Différence de format (sigles, espaces)');
          console.warn('- Le régime (Jour/Soir) ne correspond pas');
          console.warn('- Données de maquettes vides:', data.length === 0);
        }
      } else {
        setMaquettes([]);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des maquettes:', error);
      message.warning('Impossible de charger les maquettes associées');
    } finally {
      setLoadingMaquettes(false);
    }
  };

  const fetchMaquetteDetail = async (maquetteId: number) => {
    setLoadingMaquetteDetail(true);
    try {
      const response = await fetch(`${API_URL}/api/detailaffichageMaquette/maquettes/${maquetteId}/structured`);
      
      if (!response.ok) {
        throw new Error('Erreur de chargement des détails de la maquette');
      }

      const data = await response.json();
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
    if (taux >= 90) return 'red';
    if (taux >= 70) return 'orange';
    return 'green';
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
        children: text ? <Text strong style={{ color: '#1d3557' }}>{text}</Text> : null,
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
        <Tag color="blue" style={{ margin: 0 }}>
          {calculateCoutCM(record.volume_horaire_cm, record.taux_horaire_cm)?.toLocaleString('fr-FR')} F
        </Tag>
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
        <Tag color="green" style={{ margin: 0 }}>
          {calculateCoutTD(record.volume_horaire_td, record.taux_horaire_td)?.toLocaleString('fr-FR')} F
        </Tag>
      ),
      width: '10%',
    },
    { 
      title: 'COEFFICIENT', 
      dataIndex: 'coefficient', 
      key: 'coefficient',
      align: 'center' as const,
      render: (value: any) => <Tag color="orange" style={{ margin: 0 }}>{typeof value === 'string' ? parseFloat(value) : value}</Tag>,
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
      render: (capacite: number) => <Tag color="blue">{capacite} places</Tag>,
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
              backgroundColor: '#52c41a', 
              borderColor: '#52c41a',
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
              <Tag color="blue">{classe.filiere}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Niveau">
              <Tag color="green">{classe.niveau}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Année Académique">
              <Tag color="orange">{classe.annee_academique}</Tag>
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
              <Table
                columns={groupeColumns}
                dataSource={classe.groupes}
                rowKey="id"
                pagination={false}
                bordered
                size="middle"
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
                    style={{ background: 'linear-gradient(to right, #f5f7fa, #c3cfe2)' }}
                  >
                    <Title level={4} className="text-center mb-4">
                      Maquette associée: {maquetteDetail?.filiere_nom} - {maquetteDetail?.niveau_libelle}
                    </Title>
                    
                    <Row gutter={[16, 16]}>
                      <Col xs={24} sm={8}>
                        <div className="text-center">
                          <Text strong>Filière:</Text>
                          <br />
                          <Tag color="blue">{maquetteDetail?.filiere_nom}</Tag>
                        </div>
                      </Col>
                      <Col xs={24} sm={8}>
                        <div className="text-center">
                          <Text strong>Niveau:</Text>
                          <br />
                          <Tag color="green">{maquetteDetail?.niveau_libelle}</Tag>
                        </div>
                      </Col>
                      <Col xs={24} sm={8}>
                        <div className="text-center">
                          <Text strong>Année:</Text>
                          <br />
                          <Tag color="orange">{maquetteDetail?.annee_academique}</Tag>
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
                            <Tag color="blue">{semestre.ues?.length || 0} UE(s)</Tag>
                          </div>
                        } 
                        className="mb-6"
                      >
                        {semestre.ues && semestre.ues.length > 0 ? (
                          <Table 
                            columns={maquetteTableColumns} 
                            dataSource={getGroupedDataByUE(semestre)}
                            pagination={false}
                            size="middle"
                            bordered
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
                                  <Table.Summary.Row className="bg-blue-50 font-semibold">
                                    <Table.Summary.Cell index={0} colSpan={2}>
                                      <Text strong>TOTAL SEMESTRE {semestre.libelle}</Text>
                                    </Table.Summary.Cell>
                                    <Table.Summary.Cell index={1} align="center">
                                      <Text strong>{totalCM}h</Text>
                                    </Table.Summary.Cell>
                                    <Table.Summary.Cell index={2} align="center">-</Table.Summary.Cell>
                                    <Table.Summary.Cell index={3} align="center">
                                      <Tag color="blue">{totalCoutCM.toLocaleString('fr-FR')} F</Tag>
                                    </Table.Summary.Cell>
                                    <Table.Summary.Cell index={4} align="center">
                                      <Text strong>{totalTD}h</Text>
                                    </Table.Summary.Cell>
                                    <Table.Summary.Cell index={5} align="center">-</Table.Summary.Cell>
                                    <Table.Summary.Cell index={6} align="center">
                                      <Tag color="green">{totalCoutTD.toLocaleString('fr-FR')} F</Tag>
                                    </Table.Summary.Cell>
                                    <Table.Summary.Cell index={7} align="center">
                                      <Tag color="orange">{totalCoeff}</Tag>
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
                      <Text>Aucune maquette trouvée pour cette classe</Text>
                      <br />
                      <Text type="secondary">
                        Le nom de la maquette doit correspondre au nom de la classe: {classe.nom}
                      </Text>
                      <br />
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        (Vérifiez la console pour plus de détails sur la correspondance)
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