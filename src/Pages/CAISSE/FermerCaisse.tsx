import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Form, InputNumber, Button, message, Spin, Result, Descriptions, Space } from 'antd';
import { PrinterOutlined } from '@ant-design/icons';
import PageHeader from '../../Components/PageHeader/PageHeader';
import DataTable from '../../Components/ui/DataTable';
import { apiFetch, ApiError } from '../../lib/api';

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
  };
  nb_paiements: number;
  total_encaisse: number;
  repartition_methode: { methode: string; nb: number; total: number }[];
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

  const handleFermer = async (values: { montant_compte: number }) => {
    if (!session) return;
    setFermeture(true);
    try {
      const result = await apiFetch(`/api/caisse/session/${session.id}/fermer`, {
        method: 'POST',
        body: JSON.stringify({ montant_compte: values.montant_compte }),
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
              <Descriptions.Item label="Solde de clôture (compté)">{Number(rapport.session.montant_fermeture ?? 0).toLocaleString('fr-FR')} FCFA</Descriptions.Item>
            </Descriptions>

            <DataTable
              style={{ maxWidth: 500, margin: '0 auto 24px auto' }}
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
