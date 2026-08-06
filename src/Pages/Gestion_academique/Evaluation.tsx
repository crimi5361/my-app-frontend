/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react';
import {
  Button, Card, Typography,
  Row, Col, Spin, Tooltip,
  Drawer,
  Progress, Empty,
  Breadcrumb, Alert, Statistic} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import DataTable from '../../Components/ui/DataTable';
import StatusTag, { type StatusTone } from '../../Components/ui/StatusTag';
import {
  BookOutlined, TeamOutlined, UserOutlined,
  DollarOutlined, ScheduleOutlined, EyeOutlined,
  FileTextOutlined, CalendarOutlined,
  ArrowLeftOutlined,
  HomeOutlined, GroupOutlined, CheckCircleOutlined
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';

const { Title, Text } = Typography;
const API_URL = import.meta.env.VITE_API_URL_SERVER || "";

interface Evaluation {
  enseignement_id: number;
  groupe_id: number;
  annee_academique: string;
  date_chargement: string;

  matiere_id: number;
  matiere_nom: string;
  coefficient: string;
  type_evaluation: string;
  volume_horaire_cm: number;
  taux_horaire_cm: string;
  volume_horaire_td: number;
  taux_horaire_td: string;
  matiere_updated_at: string;

  professeur_id: number;
  professeur_nom: string;
  professeur_prenom: string;
  professeur_statut: string;

  ue_id: number;
  ue_nom: string;

  semestre_id: number;
  semestre_nom: string;

  groupe_nom: string;
  capacite_max: number;

  classe_id: number;
  classe_nom: string;

  nombre_notes: string;
  nombre_etudiants: string;
  cout_total: string;
}

interface EvaluationDetail {
  evaluation: Evaluation & {
    total_etudiants_groupe: string;
    volume_horaire_total: number;
  };
  notes: Array<{
    id: number;
    note1: number;
    note2: number;
    partiel: number;
    moyenne: string;
    coefficient: string;
    statut: string;
    created_at: string;
    etudiant_id: number;
    matricule: string;
    etudiant_nom: string;
    etudiant_prenoms: string;
  }>;
  total_notes: number;
}

interface GroupStats {
  total_matieres: number;
  total_cout: number;
  total_heures: number;
  total_notes: number;
}

interface NoteRecord {
  id: number;
  note1: number;
  note2: number;
  partiel: number;
  moyenne: string;
  coefficient: string;
  statut: string;
  created_at: string;
  etudiant_id: number;
  matricule: string;
  etudiant_nom: string;
  etudiant_prenoms: string;
}

const Evaluation = () => {
  const params = useParams();
  const navigate = useNavigate();

  // Récupérer le groupeId depuis les params
  const groupeId = params.groupeId || params.id; // Supporte les deux noms de paramètres


  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [selectedEvaluation, setSelectedEvaluation] = useState<EvaluationDetail | null>(null);
  const [stats, setStats] = useState<GroupStats | null>(null);
  const [groupeInfo, setGroupeInfo] = useState<any>(null);
  const [error, setError] = useState<string>('');

  const getToken = () => {
    const token = localStorage.getItem('token');
    return token;
  };

  const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
    const token = getToken();

    if (!token) {
      console.error('Aucun token trouvé, redirection vers login');
      navigate('/login');
      throw new Error('Non authentifié');
    }

    const defaultOptions: RequestInit = {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    };


    try {
      const response = await fetch(url, defaultOptions);


      if (response.status === 401) {
        localStorage.removeItem('token');
        navigate('/login');
        throw new Error('Session expirée');
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Réponse non OK:', response.status, errorText);
        throw new Error(`Erreur ${response.status}: ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Erreur fetch:', error);
      setError(error instanceof Error ? error.message : 'Erreur de connexion au serveur');
      throw error;
    }
  };

  const loadEvaluations = async (annee?: string) => {
    if (!groupeId) {
      console.error('Erreur: groupeId est undefined!');
      setError('ID du groupe manquant dans l\'URL');
      return;
    }


    setLoading(true);
    setError('');
    try {
      let url = `${API_URL}/api/evaluation/groupe/${groupeId}`;
      if (annee) {
        url += `?annee_academique=${annee}`;
      }


      const data = await fetchWithAuth(url);

      if (data.evaluations) {
        setEvaluations(data.evaluations);
      } else {
        setEvaluations([]);
      }

      if (data.statistiques) {
        setStats(data.statistiques);
      }

      if (data.groupe) {
        setGroupeInfo(data.groupe);
      }

    } catch (error: any) {
      console.error('Erreur lors du chargement des évaluations:', error);
      setError('Impossible de charger les évaluations. Vérifiez votre connexion et réessayez.');
    } finally {
      setLoading(false);
    }
  };

  const loadEvaluationDetail = async (enseignementId: number) => {

    setDetailLoading(true);
    setError('');
    try {
      const url = `${API_URL}/api/evaluation/detail/${enseignementId}`;

      const data = await fetchWithAuth(url);

      setSelectedEvaluation(data);
      setDetailDrawerVisible(true);
    } catch (error) {
      console.error('Erreur chargement détails:', error);
      setError('Impossible de charger les détails de l\'évaluation');
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    if (groupeId) {
      loadEvaluations();
    } else {
      setError('ID du groupe non spécifié dans l\'URL');
    }
  }, [groupeId]);

  const handleGoBack = () => {
    navigate(-1);
  };

  const formatNumber = (num: number | string) => {
    const number = typeof num === 'string' ? parseFloat(num) : num;
    if (isNaN(number)) return '0';
    return new Intl.NumberFormat('fr-FR').format(number);
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      return 'Date invalide';
    }
  };

  const getTypeEvaluationTone = (type: string): StatusTone => {
    if (!type) return 'neutral';
    const typeLower = type.toLowerCase();
    if (typeLower.includes('note_1_note_2')) return 'info';
    if (typeLower.includes('note_1')) return 'success';
    if (typeLower.includes('partiel')) return 'warning';
    if (typeLower.includes('examen')) return 'danger';
    return 'neutral';
  };

  const calculateTauxEvaluation = (evaluation: Evaluation) => {
    if (!evaluation?.nombre_etudiants || !groupeInfo?.capacite) return 0;
    try {
      const nbEtudiants = parseInt(evaluation.nombre_etudiants);
      const capacite = typeof groupeInfo.capacite === 'string' ? parseInt(groupeInfo.capacite) : groupeInfo.capacite;
      if (capacite === 0) return 0;
      return Math.round((nbEtudiants / capacite) * 100);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      return 0;
    }
  };

  const columns: ColumnsType<Evaluation> = [
    {
      title: 'Matière',
      key: 'matiere',
      width: 250,
      render: (_, record) => (
        <div>
          <Text strong className="block">{record.matiere_nom || 'Non spécifié'}</Text>
          <div className="flex items-center gap-2 mt-1">
            <StatusTag tone="info" label={`Coef: ${record.coefficient || '0'}`} />
            <StatusTag tone={getTypeEvaluationTone(record.type_evaluation)} label={(record.type_evaluation || '').replace(/_/g, ' ')} />
          </div>
        </div>
      ),
      sorter: (a, b) => (a.matiere_nom || '').localeCompare(b.matiere_nom || '')
    },
    {
      title: 'Professeur',
      key: 'professeur',
      width: 180,
      render: (_, record) => (
        <div>
          <Text strong className="block">
            {record.professeur_prenom || ''} {record.professeur_nom || ''}
          </Text>
          <StatusTag tone={record.professeur_statut === 'Actif' ? 'success' : 'neutral'} label={record.professeur_statut || 'Inconnu'} />
        </div>
      )
    },
    {
      title: 'Semestre',
      key: 'semestre',
      width: 120,
      render: (_, record) => (
        <div>
          <StatusTag tone="info" label={record.semestre_nom || 'Non spécifié'} />
          {record.ue_nom && (
            <Text type="secondary" className="block text-xs mt-1">
              {record.ue_nom}
            </Text>
          )}
        </div>
      )
    },
    {
      title: 'Horaires',
      key: 'horaires',
      width: 120,
      render: (_, record) => (
        <div>
          <div className="flex items-center gap-1">
            <Text>CM: {record.volume_horaire_cm || 0}h</Text>
          </div>
          <div className="flex items-center gap-1">
            <Text>TD: {record.volume_horaire_td || 0}h</Text>
          </div>
        </div>
      )
    },
    {
      title: 'Coût',
      key: 'cout',
      width: 130,
      render: (_, record) => (
        <div>
          <Text strong className="text-green-700">
            {formatNumber(record.cout_total || 0)} FCFA
          </Text>
        </div>
      )
    },
    {
      title: 'Évaluation',
      key: 'evaluation',
      width: 140,
      render: (_, record) => {
        const taux = calculateTauxEvaluation(record);
        return (
          <div>
            <div className="flex items-center gap-1 mb-1">
              <FileTextOutlined />
              <Text strong>{record.nombre_notes || 0} notes</Text>
            </div>
            <Progress
              percent={taux}
              size="small"
              status={taux >= 80 ? "success" : taux >= 50 ? "active" : "exception"}
            />
          </div>
        );
      }
    },
    {
      title: 'Date',
      key: 'date',
      width: 160,
      render: (_, record) => (
        <div>
          <div className="flex items-center gap-1">
            <CalendarOutlined />
            <Text>{formatDate(record.date_chargement)}</Text>
          </div>
          <Text type="secondary" className="text-xs block">
            {record.annee_academique || 'Non spécifié'}
          </Text>
        </div>
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 80,
      align: 'center',
      render: (_, record) => (
        <Tooltip title="Voir les détails">
          <Button
            type="primary"
            icon={<EyeOutlined />}
            size="small"
            onClick={() => loadEvaluationDetail(record.enseignement_id)}
          />
        </Tooltip>
      )
    }
  ];

  // Message de chargement initial
  if (!groupeId) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <Alert
          message="Erreur"
          description="ID du groupe non spécifié dans l'URL"
          type="error"
          showIcon
          action={
            <Button type="primary" onClick={handleGoBack}>
              Retour
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      {/* Header avec Breadcrumb */}
      <Card className="mb-6">
        <Breadcrumb
          className="mb-4"
          items={[
            {
              title: <HomeOutlined />,
              href: '#',
            },
            {
              title: 'Gestion académique',
              href: '#',
            },
            {
              title: 'Groupes',
              href: '#',
            },
            {
              title: groupeInfo?.nom || `Groupe ${groupeId}`,
            },
          ]}
        />

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={handleGoBack}
            />
            <div>
              <Title level={2} className="!m-0">
                Évaluations Chargées
              </Title>
              {groupeInfo ? (
                <div className="flex items-center gap-2 mt-1">
                  <StatusTag tone="info" icon={<GroupOutlined />} label={`${groupeInfo.classe} • ${groupeInfo.nom}`} />
                  <Text type="secondary">
                    <TeamOutlined className="mr-1" />
                    {groupeInfo.capacite} étudiants
                  </Text>
                </div>
              ) : (
                <Text type="secondary" className="mt-1">
                  ID du groupe: {groupeId}
                </Text>
              )}
            </div>
          </div>
        </div>
      </Card>

      {error && (
        <Alert
          message="Erreur"
          description={error}
          type="error"
          showIcon
          className="mb-6"
          closable
          onClose={() => setError('')}
        />
      )}

      {/* Statistiques en cartes */}
      {stats && (
        <Row gutter={[16, 16]} className="mb-6">
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Matières chargées"
                value={stats.total_matieres || 0}
                prefix={<BookOutlined />}
              />
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Coût total"
                value={formatNumber(stats.total_cout || 0)}
                prefix={<DollarOutlined />}
                suffix="FCFA"
              />
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Heures totales"
                value={stats.total_heures || 0}
                prefix={<ScheduleOutlined />}
                suffix="h"
              />
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Notes enregistrées"
                value={stats.total_notes || 0}
                prefix={<FileTextOutlined />}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* Tableau des évaluations */}
      <Card>
        {loading && evaluations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32">
            <Spin size="large" className="mb-4" />
            <Text className="text-gray-500">Chargement des évaluations...</Text>
            <Text type="secondary" className="text-xs mt-2">
              Groupe ID: {groupeId}
            </Text>
          </div>
        ) : evaluations.length === 0 ? (
          <div className="py-20 px-6 text-center">
            <Empty
              description={
                <div>
                  <Title level={4} className="text-gray-600 mb-2">
                    {loading ? 'Chargement...' : 'Aucune évaluation chargée'}
                  </Title>
                  <Text type="secondary" className="max-w-md mx-auto block">
                    {groupeInfo
                      ? `Le groupe "${groupeInfo.nom}" n'a pas encore de matières chargées pour évaluation.`
                      : 'Groupe non trouvé ou aucune donnée disponible.'}
                  </Text>
                  <Text type="secondary" className="mt-2 text-xs">
                    ID: {groupeId}
                  </Text>
                </div>
              }
            />
          </div>
        ) : (
          <>
            <div className="px-6 pt-6 pb-4 border-b">
              <div className="flex items-center justify-between">
                <Text strong className="text-lg">
                  Liste des évaluations ({evaluations.length})
                </Text>
                <Text type="secondary" className="text-sm">
                  Cliquez sur <EyeOutlined className="ml-1 mr-1" /> pour voir les détails
                </Text>
              </div>
            </div>
            <DataTable<Evaluation>
              columns={columns}
              dataSource={evaluations}
              rowKey="enseignement_id"
              loading={loading}
              pagination={{
                pageSize: 20,
                showQuickJumper: true,
                showTotal: (total, range) =>
                  `${range[0]}-${range[1]} sur ${total} évaluations`,
              }}
              scroll={{ x: 1200 }}
            />
          </>
        )}
      </Card>

      {/* Drawer de détails */}
      <Drawer
        title="Détails de l'évaluation"
        width={1200}
        open={detailDrawerVisible}
        onClose={() => {
          setDetailDrawerVisible(false);
          setSelectedEvaluation(null);
        }}
        closable={true}
        styles={{
          body: {
            padding: 0,
            height: 'calc(100% - 55px)',
            overflow: 'hidden'
          }
        }}
      >
        {selectedEvaluation && (
          <div className="h-full overflow-y-auto">
            {detailLoading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Spin size="large" className="mb-4" />
                <Text className="text-gray-500">Chargement des détails...</Text>
              </div>
            ) : (
              <div className="flex flex-col h-full">
                {/* En-tête avec matières */}
                <div className="bg-gray-50 p-6 border-b">
                  <Title level={2} className="!mb-3">{selectedEvaluation.evaluation.matiere_nom}</Title>
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusTag tone="info" label={`Coef: ${selectedEvaluation.evaluation.coefficient}`} />
                    <StatusTag tone={getTypeEvaluationTone(selectedEvaluation.evaluation.type_evaluation)} label={selectedEvaluation.evaluation.type_evaluation.replace(/_/g, ' ')} />
                    <StatusTag tone="info" label={selectedEvaluation.evaluation.semestre_nom} />
                    {selectedEvaluation.evaluation.ue_nom && (
                      <StatusTag tone="neutral" label={`UE: ${selectedEvaluation.evaluation.ue_nom}`} />
                    )}
                  </div>
                </div>

                {/* Section supérieure avec informations générales */}
                <div className="p-6 border-b bg-white">
                  <Row gutter={[24, 16]}>
                    <Col span={6}>
                      <div className="space-y-1">
                        <Text type="secondary" className="text-xs">Professeur</Text>
                        <div className="flex items-center gap-2">
                          <UserOutlined className="text-gray-400" />
                          <Text strong>
                            {selectedEvaluation.evaluation.professeur_prenom} {selectedEvaluation.evaluation.professeur_nom}
                          </Text>
                          <StatusTag tone={selectedEvaluation.evaluation.professeur_statut === 'Actif' ? 'success' : 'neutral'} label={selectedEvaluation.evaluation.professeur_statut} />
                        </div>
                      </div>
                    </Col>
                    
                    <Col span={12}>
                      <div className="space-y-1">
                        <Text type="secondary" className="text-xs">Classe & Groupe</Text>
                        <div className="flex items-center gap-2">
                          <GroupOutlined className="text-gray-400" />
                          <Text>{selectedEvaluation.evaluation.classe_nom} • {selectedEvaluation.evaluation.groupe_nom}</Text>
                        </div>
                      </div>
                    </Col>
                    
                    <Col span={6}>
                      <div className="space-y-1">
                        <Text type="secondary" className="text-xs">Année académique</Text>
                        <div className="flex items-center gap-2">
                          <CalendarOutlined className="text-gray-400" />
                          <Text>{selectedEvaluation.evaluation.annee_academique}</Text>
                        </div>
                      </div>
                    </Col>
                    
                    <Col span={6}>
                      <div className="space-y-1">
                        <Text type="secondary" className="text-xs">Capacité</Text>
                        <div className="flex items-center gap-2">
                          <TeamOutlined className="text-gray-400" />
                          <Text>{selectedEvaluation.evaluation.capacite_max} étudiants</Text>
                        </div>
                      </div>
                    </Col>
                  </Row>
                </div>

                {/* Section centrale - Informations financières et statistiques compactes */}
                <div className="p-6 border-b">
                  <Row gutter={[24, 16]}>
                    <Col span={12}>
                      <Card 
                        title={
                          <div className="flex items-center gap-2">
                            <DollarOutlined />
                            <span>Informations financières</span>
                          </div>
                        }
                        size="small"
                        className="h-full"
                      >
                        <div className="space-y-4">
                          <div className="flex justify-between items-center">
                            <div>
                              <Text strong>Cours Magistraux (CM)</Text>
                              <div className="text-sm text-gray-500">
                                {selectedEvaluation.evaluation.volume_horaire_cm}h × {formatNumber(selectedEvaluation.evaluation.taux_horaire_cm)} FCFA/h
                              </div>
                            </div>
                            <Text strong className="text-green-600">
                              {formatNumber(selectedEvaluation.evaluation.volume_horaire_cm * parseFloat(selectedEvaluation.evaluation.taux_horaire_cm || '0'))} FCFA
                            </Text>
                          </div>
                          
                          <div className="flex justify-between items-center">
                            <div>
                              <Text strong>Travaux Dirigés (TD)</Text>
                              <div className="text-sm text-gray-500">
                                {selectedEvaluation.evaluation.volume_horaire_td}h × {formatNumber(selectedEvaluation.evaluation.taux_horaire_td)} FCFA/h
                              </div>
                            </div>
                            <Text strong className="text-green-600">
                              {formatNumber(selectedEvaluation.evaluation.volume_horaire_td * parseFloat(selectedEvaluation.evaluation.taux_horaire_td || '0'))} FCFA
                            </Text>
                          </div>
                          
                          <div className="pt-3 border-t">
                            <div className="flex justify-between items-center">
                              <Text strong className="text-lg">Coût total</Text>
                              <Title level={3} className="!mt-0 !mb-0 text-green-700">
                                {formatNumber(selectedEvaluation.evaluation.cout_total)} FCFA
                              </Title>
                            </div>
                          </div>
                        </div>
                      </Card>
                    </Col>
                    
                    <Col span={12}>
                      <Card 
                        title={
                          <div className="flex items-center gap-2">
                            <FileTextOutlined />
                            <span>Résumé de l'évaluation</span>
                          </div>
                        }
                        size="small"
                        className="h-full"
                      >
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <UserOutlined className="text-gray-400" />
                                <Text>Étudiants évalués</Text>
                              </div>
                              <div className="flex items-center gap-2">
                                <Text strong>{selectedEvaluation.evaluation.nombre_etudiants}</Text>
                                <Text type="secondary">/</Text>
                                <Text>{selectedEvaluation.evaluation.total_etudiants_groupe || selectedEvaluation.evaluation.capacite_max}</Text>
                                <Text type="secondary">étudiants</Text>
                              </div>
                            </div>
                            <StatusTag
                              tone="info"
                              label={`${Math.round(
                                (parseInt(selectedEvaluation.evaluation.nombre_etudiants) /
                                 parseInt(selectedEvaluation.evaluation.total_etudiants_groupe || selectedEvaluation.evaluation.capacite_max.toString())) * 100
                              )}%`}
                            />
                          </div>
                          
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <Text>Progression</Text>
                              <Text type="secondary">
                                {selectedEvaluation.evaluation.nombre_etudiants} / {selectedEvaluation.evaluation.total_etudiants_groupe || selectedEvaluation.evaluation.capacite_max}
                              </Text>
                            </div>
                            <Progress 
                              percent={Math.round(
                                (parseInt(selectedEvaluation.evaluation.nombre_etudiants) /
                                 parseInt(selectedEvaluation.evaluation.total_etudiants_groupe || selectedEvaluation.evaluation.capacite_max.toString())) * 100
                              )}
                              size="small"
                            />
                          </div>
                          
                          {selectedEvaluation.total_notes > 0 && (
                            <div className="pt-3 border-t">
                              <div className="flex items-center gap-2">
                                <FileTextOutlined className="text-gray-400" />
                                <Text strong>{selectedEvaluation.total_notes} notes enregistrées</Text>
                              </div>
                            </div>
                          )}
                        </div>
                      </Card>
                    </Col>
                  </Row>
                </div>

                {/* Tableau des notes - Pleine largeur */}
                <div className="flex-1 p-6">
                  <Card 
                    title={
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileTextOutlined />
                          <span>Liste des notes</span>
                          {selectedEvaluation.notes && selectedEvaluation.notes.length > 0 && (
                            <StatusTag tone="info" label={`${selectedEvaluation.notes.length} notes`} />
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Text type="secondary" className="text-sm">
                            Enseignement ID: #{selectedEvaluation.evaluation.enseignement_id}
                          </Text>
                        </div>
                      </div>
                    }
                    className="h-full"
                    bodyStyle={{ padding: 0 }}
                  >
                    {selectedEvaluation.notes && selectedEvaluation.notes.length > 0 ? (
                      <div className="overflow-hidden">
                        <DataTable<NoteRecord>
                          dataSource={selectedEvaluation.notes}
                          rowKey="id"
                          columns={[
                            {
                              title: 'Matricule',
                              dataIndex: 'matricule',
                              width: 120,
                              fixed: 'left' as const,
                              sorter: (a, b) => a.matricule.localeCompare(b.matricule),
                            },
                            {
                              title: 'Étudiant',
                              key: 'etudiant',
                              width: 200,
                              render: (_, record) => (
                                <div>
                                  <Text strong className="block">{record.etudiant_nom} {record.etudiant_prenoms}</Text>
                                  <Text type="secondary" className="text-xs">ID: {record.etudiant_id}</Text>
                                </div>
                              ),
                              sorter: (a, b) => a.etudiant_nom.localeCompare(b.etudiant_nom),
                            },
                            {
                              title: 'Note 1',
                              dataIndex: 'note1',
                              align: 'center' as const,
                              width: 100,
                              sorter: (a, b) => (a.note1 || 0) - (b.note1 || 0),
                              render: (value: number) => (
                                <StatusTag tone={value >= 10 ? 'success' : 'danger'} label={String(value || '-')} />
                              )
                            },
                            {
                              title: 'Note 2',
                              dataIndex: 'note2',
                              align: 'center' as const,
                              width: 100,
                              sorter: (a, b) => (a.note2 || 0) - (b.note2 || 0),
                              render: (value: number) => (
                                <StatusTag tone={value >= 10 ? 'success' : 'danger'} label={String(value || '-')} />
                              )
                            },
                            {
                              title: 'Partiel',
                              dataIndex: 'partiel',
                              align: 'center' as const,
                              width: 100,
                              sorter: (a, b) => (a.partiel || 0) - (b.partiel || 0),
                              render: (value: number) => (
                                <StatusTag tone={value >= 10 ? 'success' : 'danger'} label={String(value || '-')} />
                              )
                            },
                            {
                              title: 'Moyenne',
                              dataIndex: 'moyenne',
                              align: 'center' as const,
                              width: 120,
                              fixed: 'right' as const,
                              sorter: (a, b) => parseFloat(a.moyenne || '0') - parseFloat(b.moyenne || '0'),
                              render: (value: string) => {
                                const moyenneValue = parseFloat(value || '0');
                                return (
                                  <div className="flex flex-col items-center">
                                    <StatusTag
                                      tone={moyenneValue >= 10 ? 'success' : moyenneValue >= 7 ? 'warning' : 'danger'}
                                      label={value || '0.00'}
                                    />
                                    <Text type="secondary" className="text-xs mt-1">
                                      Coef: {selectedEvaluation.evaluation.coefficient}
                                    </Text>
                                  </div>
                                );
                              }
                            },
                            {
                              title: 'Statut',
                              dataIndex: 'statut',
                              align: 'center' as const,
                              width: 120,
                              fixed: 'right' as const,
                              render: (value: string) => (
                                <StatusTag
                                  tone={value === 'Validé' ? 'success' : value === 'En attente' ? 'warning' : 'danger'}
                                  label={value || 'Non défini'}
                                />
                              ),
                              filters: [
                                { text: 'Validé', value: 'Validé' },
                                { text: 'En attente', value: 'En attente' },
                                { text: 'Rejeté', value: 'Rejeté' },
                              ],
                              onFilter: (value, record) => record.statut === value,
                            },
                          ]}
                          pagination={{
                            pageSize: 150,
                            showSizeChanger: true,
                            showQuickJumper: true,
                            showTotal: (total, range) => 
                              `${range[0]}-${range[1]} sur ${total} notes`,
                            pageSizeOptions: ['50', '100', '150', '200'],
                            defaultPageSize: 150,
                          }}
                          scroll={{ 
                            x: 1000,
                            y: 500
                          }}
                          rowClassName={(record) => 
                            record.statut === 'Validé' ? 'bg-green-50 hover:bg-green-100' : 
                            record.statut === 'En attente' ? 'bg-yellow-50 hover:bg-yellow-100' : 
                            'bg-red-50 hover:bg-red-100'
                          }
                        />
                      </div>
                    ) : (
                      <div className="py-16 text-center">
                        <Empty
                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                          description={
                            <div>
                              <Text className="text-gray-600">Aucune note enregistrée pour cette évaluation</Text>
                              <Text type="secondary" className="block mt-2 text-sm">
                                Les notes seront visibles ici une fois chargées
                              </Text>
                            </div>
                          }
                        />
                      </div>
                    )}
                  </Card>
                </div>

                {/* Pied de page avec informations de chargement */}
                <div className="p-6 border-t bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <CheckCircleOutlined className="text-green-500" />
                        <div>
                          <Text type="secondary" className="text-xs">Date de chargement</Text>
                          <Text className="text-sm">{formatDate(selectedEvaluation.evaluation.date_chargement)}</Text>
                        </div>
                      </div>
                      
                      {selectedEvaluation.evaluation.matiere_updated_at && (
                        <div className="flex items-center gap-2">
                          <BookOutlined className="text-blue-500" />
                          <div>
                            <Text type="secondary" className="text-xs">Dernière mise à jour</Text>
                            <Text className="text-sm">
                              {formatDate(selectedEvaluation.evaluation.matiere_updated_at)}
                            </Text>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="text-right">
                      <Text type="secondary" className="text-xs">Dernière actualisation</Text>
                      <Text className="text-sm">{new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</Text>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </Drawer>

      {/* Pied de page */}
      <div className="mt-6 text-center">
        <Text type="secondary" className="text-sm">
          {evaluations.length} évaluation(s) chargée(s) •
          Dernière mise à jour: {new Date().toLocaleTimeString('fr-FR')}
        </Text>
      </div>
    </div>
  );
};

export default Evaluation;