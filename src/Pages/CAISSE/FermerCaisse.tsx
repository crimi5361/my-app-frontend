import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Form, InputNumber, Input, Button, message, Spin, Result, Descriptions, Space, Row, Col, Statistic, Tag } from 'antd';
import { PrinterOutlined } from '@ant-design/icons';
import PageHeader from '../../Components/PageHeader/PageHeader';
import DataTable from '../../Components/ui/DataTable';
import { apiFetch, ApiError } from '../../lib/api';

const { TextArea } = Input;

const API_URL = import.meta.env.VITE_API_URL_SERVER || '';

interface SessionActive {
  id: number;
  montant_ouverture: number;
  date_ouverture: string;
}

interface Rapport {
  session: {
    id: number; caisse_libelle: string; caissier_nom: string; caissier_code: string;
    date_ouverture: string; date_fermeture: string | null;
    montant_ouverture: number; montant_fermeture: number | null;
    observations: string | null;
  };
  nb_paiements: number;
  total_encaisse: number;
  repartition_methode: { methode: string; nb: number; total: number }[];
  repartition_type_frais: { type_frais: string; nb: number; total: number }[];
  repartition_annee_academique: { annee_id: number; annee: string; nb: number; total: number }[];
  sorties: {
    id: number; date_depense: string; montant: number; motif: string; beneficiaire: string;
    mode_paiement: string; reference_justificatif: string | null; categorie_libelle: string | null;
  }[];
  total_sorties: number;
  details_operations: {
    id: number; date_paiement: string; montant: number; methode: string; type_frais: string;
    numero_recu: string | null; etudiant_nom: string | null; etudiant_prenoms: string | null;
    matricule_iipea: string | null;
  }[];
  montant_theorique: number;
  ecart: number | null;
}

const FermerCaisse = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<SessionActive | null>(null);
  const [form] = Form.useForm();
  const [fermeture, setFermeture] = useState(false);
  const [rapport, setRapport] = useState<Rapport | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await apiFetch<{ data: SessionActive | null }>('/api/caisse/session/active');
        setSession(data.data);
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return;
        message.error('Erreur lors du chargement de la session');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleFermer = async (values: { montant_compte: number; observations?: string }) => {
    if (!session) return;
    setFermeture(true);
    try {
      const result = await apiFetch(`/api/caisse/session/${session.id}/fermer`, {
        method: 'POST',
        body: JSON.stringify({ montant_compte: values.montant_compte, observations: values.observations }),
      });
      message.success('Caisse fermée avec succès.');
      setRapport(result.data);
    } catch (e) {
      if (e instanceof ApiError) {
        message.error(e.message);
        return;
      }
      message.error('Erreur lors de la fermeture de la caisse');
    } finally {
      setFermeture(false);
    }
  };

  const ouvrirImpression = () => {
    if (!rapport) return;
    const token = localStorage.getItem('token') || '';
    window.open(`${API_URL}/api/caisse/session/${rapport.session.id}/rapport/impression?token=${encodeURIComponent(token)}`, '_blank');
  };

  if (loading) {
    return <div style={{ padding: 24, textAlign: 'center' }}><Spin size="large" /></div>;
  }

  return (
    <div style={{ padding: 24 }}>
      <PageHeader />

      {rapport ? (
        <Card>
          <Result
            status="success"
            title="Caisse fermée"
            subTitle={`Rapport de clôture — ${rapport.session.caisse_libelle}`}
          >
            <Descriptions column={1} bordered size="small" style={{ maxWidth: 500, margin: '0 auto 24px auto' }}>
              <Descriptions.Item label="Solde d'ouverture">{Number(rapport.session.montant_ouverture).toLocaleString('fr-FR')} FCFA</Descriptions.Item>
              <Descriptions.Item label="Total encaissé">{Number(rapport.total_encaisse).toLocaleString('fr-FR')} FCFA</Descriptions.Item>
              <Descriptions.Item label="Nombre de paiements">{rapport.nb_paiements}</Descriptions.Item>
              <Descriptions.Item label="Montant théorique">{Number(rapport.montant_theorique).toLocaleString('fr-FR')} FCFA</Descriptions.Item>
              <Descriptions.Item label="Solde de clôture (compté)">{Number(rapport.session.montant_fermeture ?? 0).toLocaleString('fr-FR')} FCFA</Descriptions.Item>
              <Descriptions.Item label="Écart">
                {rapport.ecart !== null ? (
                  <Tag color={Math.abs(rapport.ecart) < 0.01 ? 'green' : rapport.ecart > 0 ? 'blue' : 'red'}>
                    {Number(rapport.ecart).toLocaleString('fr-FR')} FCFA
                  </Tag>
                ) : '—'}
              </Descriptions.Item>
              {rapport.session.observations && (
                <Descriptions.Item label="Observations">{rapport.session.observations}</Descriptions.Item>
              )}
            </Descriptions>

            <Row gutter={16} style={{ maxWidth: 900, margin: '0 auto 24px auto' }}>
              <Col span={12}>
                <Card size="small" title="Répartition par type de frais">
                  <DataTable
                    dataSource={rapport.repartition_type_frais}
                    rowKey="type_frais"
                    pagination={false}
                    emptyTitle="Aucune opération"
                    columns={[
                      { title: 'Type', dataIndex: 'type_frais', render: (v: string) => <span style={{ textTransform: 'capitalize' }}>{v}</span> },
                      { title: 'Nombre', dataIndex: 'nb' },
                      { title: 'Total', dataIndex: 'total', render: (v) => `${Number(v).toLocaleString('fr-FR')} FCFA` },
                    ]}
                  />
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small" title="Répartition par année académique">
                  <DataTable
                    dataSource={rapport.repartition_annee_academique}
                    rowKey="annee_id"
                    pagination={false}
                    emptyTitle="Aucune opération"
                    columns={[
                      { title: 'Année', dataIndex: 'annee' },
                      { title: 'Nombre', dataIndex: 'nb' },
                      { title: 'Total', dataIndex: 'total', render: (v) => `${Number(v).toLocaleString('fr-FR')} FCFA` },
                    ]}
                  />
                </Card>
              </Col>
            </Row>

            <Card size="small" title="Répartition par méthode de paiement" style={{ maxWidth: 900, margin: '0 auto 24px auto' }}>
              <DataTable
                dataSource={rapport.repartition_methode}
                rowKey="methode"
                pagination={false}
                emptyTitle="Aucun paiement"
                columns={[
                  { title: 'Méthode', dataIndex: 'methode' },
                  { title: 'Nombre', dataIndex: 'nb' },
                  { title: 'Total', dataIndex: 'total', render: (v) => `${Number(v).toLocaleString('fr-FR')} FCFA` },
                ]}
              />
            </Card>

            <Card
              size="small"
              title="Sorties / dépenses validées"
              extra={<Statistic value={rapport.total_sorties} formatter={(v) => `${Number(v).toLocaleString('fr-FR')} FCFA`} valueStyle={{ fontSize: 14 }} />}
              style={{ maxWidth: 900, margin: '0 auto 24px auto' }}
            >
              <DataTable
                dataSource={rapport.sorties}
                rowKey="id"
                pagination={false}
                emptyTitle="Aucune sortie sur cette période"
                columns={[
                  { title: 'Date', dataIndex: 'date_depense', render: (v) => new Date(v).toLocaleDateString('fr-FR') },
                  { title: 'Catégorie', dataIndex: 'categorie_libelle' },
                  { title: 'Motif', dataIndex: 'motif' },
                  { title: 'Bénéficiaire', dataIndex: 'beneficiaire' },
                  { title: 'Montant', dataIndex: 'montant', render: (v) => `${Number(v).toLocaleString('fr-FR')} FCFA` },
                ]}
              />
            </Card>

            <Card size="small" title="Détail des opérations" style={{ maxWidth: 900, margin: '0 auto 24px auto' }}>
              <DataTable
                dataSource={rapport.details_operations}
                rowKey="id"
                pagination={{ pageSize: 10 }}
                emptyTitle="Aucune opération"
                columns={[
                  { title: 'Heure', dataIndex: 'date_paiement', render: (v) => new Date(v).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) },
                  { title: 'Reçu', dataIndex: 'numero_recu', render: (v) => v || '—' },
                  { title: 'Étudiant', render: (_v, r) => r.etudiant_nom ? `${r.etudiant_nom} ${r.etudiant_prenoms || ''}`.trim() : '—' },
                  { title: 'Matricule', dataIndex: 'matricule_iipea', render: (v) => v || '—' },
                  { title: 'Type', dataIndex: 'type_frais', render: (v: string) => <span style={{ textTransform: 'capitalize' }}>{v}</span> },
                  { title: 'Méthode', dataIndex: 'methode' },
                  { title: 'Montant', dataIndex: 'montant', render: (v) => `${Number(v).toLocaleString('fr-FR')} FCFA` },
                ]}
              />
            </Card>

            <Space>
              <Button type="primary" icon={<PrinterOutlined />} onClick={ouvrirImpression}>
                Imprimer le rapport
              </Button>
              <Button onClick={() => navigate('/caisse/dashboard')}>Retour au tableau de bord</Button>
            </Space>
          </Result>
        </Card>
      ) : session ? (
        <Card title="Fermer la caisse">
          <p>Comptez physiquement le contenu de votre caisse et saisissez le montant total ci-dessous.</p>
          <Form form={form} layout="vertical" onFinish={handleFermer} style={{ maxWidth: 400 }}>
            <Form.Item
              name="montant_compte"
              label="Montant compté (FCFA)"
              rules={[{ required: true, message: 'Veuillez saisir le montant compté' }]}
            >
              <InputNumber style={{ width: '100%' }} min={0} step={1000} />
            </Form.Item>
            <Form.Item name="observations" label="Observations (optionnel)">
              <TextArea rows={3} placeholder="Ex : écart justifié par..., incident particulier..." maxLength={1000} />
            </Form.Item>
            <Form.Item>
              <Button type="primary" danger htmlType="submit" loading={fermeture} block>
                Fermer la caisse
              </Button>
            </Form.Item>
          </Form>
        </Card>
      ) : (
        <Card>
          <Result
            status="info"
            title="Aucune caisse ouverte"
            subTitle="Vous n'avez pas de session de caisse active à fermer."
            extra={<Button type="primary" onClick={() => navigate('/caisse/dashboard')}>Retour au tableau de bord</Button>}
          />
        </Card>
      )}
    </div>
  );
};

export default FermerCaisse;
