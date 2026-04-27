 
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
  Divider
} from 'antd';
import { 
  DollarOutlined,
  BookOutlined,
  ApartmentOutlined
} from '@ant-design/icons';
import PageHeader from "../../Components/PageHeader/PageHeader";

const { Title, Text } = Typography;
const API_URL = import.meta.env.VITE_API_URL_SERVER || "";

interface Niveau {
  id: string;
  libelle: string;
  prix_formation: string;
  typefiliere_libelle: string;
  // Add other properties if your data has more fields
}

const Niviaux = () => {
  const [niveaux, setNiveaux] = useState<Niveau[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalFormation, setTotalFormation] = useState(0);

  useEffect(() => {
    const fetchNiveaux = async () => {
      try {
        const res = await fetch(`${API_URL}/api/niveaux`);
        const data = await res.json();
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
  }, []);

  const columns = [
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