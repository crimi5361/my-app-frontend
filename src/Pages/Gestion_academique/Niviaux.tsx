
import { useEffect, useState } from "react";
import {
  Card,
  Table,
  Tag,
  Typography,
  Space,
  Statistic,
  Row,
  Col,
  Spin,
  Divider,
  Select
} from 'antd';
import {
  DollarOutlined,
  BookOutlined,
  ApartmentOutlined
} from '@ant-design/icons';
import PageHeader from "../../Components/PageHeader/PageHeader";
import { apiFetch } from "../../lib/api";

const { Title, Text } = Typography;
const { Option } = Select;

interface Niveau {
  id: number;
  libelle: string;
  prix_formation: string;
  filiere_nom: string;
  filiere_sigle: string;
  typefiliere_libelle: string;
}

interface AnneeAcademique {
  id: number;
  annee: string;
  etat: string | null;
}

const getDepartementId = (): number | null => {
  try {
    const userStr = localStorage.getItem('user');
    if (!userStr) return null;
    const user = JSON.parse(userStr);
    return user?.departement_id ?? null;
  } catch {
    return null;
  }
};

const Niviaux = () => {
  const [niveaux, setNiveaux] = useState<Niveau[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalFormation, setTotalFormation] = useState(0);
  const [departementId] = useState<number | null>(getDepartementId());
  const [annees, setAnnees] = useState<AnneeAcademique[]>([]);
  const [selectedAnneeId, setSelectedAnneeId] = useState<number | null>(null);

  // Récupère les années académiques du site et sélectionne l'année en cours par défaut
  useEffect(() => {
    if (!departementId) return;
    apiFetch(`/api/annees?site_id=${departementId}`)
      .then((data: AnneeAcademique[]) => {
        const liste = data || [];
        setAnnees(liste);
        const anneeCourante = liste.find(a => a.etat === 'en cour');
        setSelectedAnneeId((anneeCourante || liste[0])?.id ?? null);
      })
      .catch(err => console.error("Erreur lors du chargement des années académiques :", err));
  }, [departementId]);

  useEffect(() => {
    if (!departementId || !selectedAnneeId) return;

    const fetchNiveaux = async () => {
      setLoading(true);
      try {
        const data = await apiFetch(
          `/api/niveaux?site_id=${departementId}&anneeacademique_id=${selectedAnneeId}`
        );
        setNiveaux(data);

        // Calculate total formation prices
        const total = data.reduce((sum: number, niveau: Niveau) => {
          return sum + parseFloat(niveau.prix_formation);
        }, 0);
        setTotalFormation(total);
      } catch (error) {
        console.error("Erreur lors du chargement des niveaux :", error);
      } finally {
        setLoading(false);
      }
    };

    fetchNiveaux();
  }, [departementId, selectedAnneeId]);

  const columns = [
    {
      title: 'Filière',
      dataIndex: 'filiere_nom',
      key: 'filiere_nom',
      render: (text: string, record: Niveau) => <Text>{text} {record.filiere_sigle ? `(${record.filiere_sigle})` : ''}</Text>,
      sorter: (a: Niveau, b: Niveau) => (a.filiere_nom || '').localeCompare(b.filiere_nom || ''),
    },
    {
      title: 'Libellé',
      dataIndex: 'libelle',
      key: 'libelle',
      render: (text: string) => <Text strong>{text}</Text>,
      sorter: (a: Niveau, b: Niveau) => a.libelle.localeCompare(b.libelle),
    },
    {
      title: 'Prix Formation',
      dataIndex: 'prix_formation',
      key: 'prix_formation',
      render: (value: string) => (
        <Tag color="green" icon={<DollarOutlined />}>
          {parseFloat(value).toLocaleString("fr-FR", { 
            style: "currency", 
            currency: "XOF",
            minimumFractionDigits: 0
          })}
        </Tag>
      ),
      sorter: (a: Niveau, b: Niveau) => parseFloat(a.prix_formation) - parseFloat(b.prix_formation),
    },
    {
      title: 'Type Filière',
      dataIndex: 'typefiliere_libelle',
      key: 'typefiliere_libelle',
      render: (text: string) => (
        <Tag color="blue" icon={<ApartmentOutlined />}>
          {text}
        </Tag>
      ),
      sorter: (a: Niveau, b: Niveau) => a.typefiliere_libelle.localeCompare(b.typefiliere_libelle),
    },
  ];

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <PageHeader />
      
      <Card
        title={
          <Space>
            <BookOutlined />
            <Title level={3} style={{ margin: 0 }}>Liste des Niveaux</Title>
          </Space>
        }
        bordered={false}
        headStyle={{ borderBottom: 'none' }}
      >
        <Space style={{ marginBottom: 16 }}>
          <Text type="secondary">Année académique :</Text>
          <Select
            value={selectedAnneeId ?? undefined}
            onChange={(value) => setSelectedAnneeId(value)}
            style={{ minWidth: 220 }}
            loading={annees.length === 0}
            placeholder="Sélectionner une année"
          >
            {annees.map(a => (
              <Option key={a.id} value={a.id}>{a.annee} ({a.etat})</Option>
            ))}
          </Select>
        </Space>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
            <Spin size="large" tip="Chargement des niveaux..." />
          </div>
        ) : (
          <>
            <Row gutter={16} style={{ marginBottom: 24 }}>
              <Col xs={24} sm={12} md={8}>
                <Card size="small">
                  <Statistic
                    title="Nombre de Niveaux"
                    value={niveaux.length}
                    prefix={<BookOutlined />}
                    valueStyle={{ color: '#1890ff' }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} md={8}>
                <Card size="small">
                  <Statistic
                    title="Total Formations"
                    value={totalFormation}
                    precision={0}
                    prefix="FCFA"
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} md={8}>
                <Card size="small">
                  <Statistic
                    title="Moyenne Prix"
                    value={(totalFormation / (niveaux.length || 1)).toFixed(0)}
                    precision={0}
                    prefix="FCFA"
                    valueStyle={{ color: '#722ed1' }}
                  />
                </Card>
              </Col>
            </Row>

            <Divider orientation="left">
              <BookOutlined /> Détails des Niveaux
            </Divider>

            <Table<Niveau>
              columns={columns}
              dataSource={niveaux}
              rowKey="id"
              pagination={{
                pageSizeOptions: ['10', '20', '50'],
                showSizeChanger: true,
                showTotal: (total, range) => `${range[0]}-${range[1]} sur ${total} niveaux`,
              }}
              bordered
              size="middle"
              scroll={{ x: 'max-content' }}
              locale={{
                emptyText: 'Aucun niveau trouvé'
              }}
            />
          </>
        )}
      </Card>
    </div>
  );
};

export default Niviaux;