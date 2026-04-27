/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { useEffect, useState } from 'react';
import { User } from '../../type/User';
import UserTable from '../../Components/UserTable';
import AddUserModal from '../../Components/AddUserModal';
import PageHeader from '../../Components/PageHeader/PageHeader';
import { Input, Button, Space, Card, message, Spin } from 'antd';
import { SearchOutlined, UserAddOutlined } from '@ant-design/icons';

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const API_URL = import.meta.env.VITE_API_URL_SERVER || "";

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/utilisateurs`);
      const data = await res.json();
      setUsers(data);
    } catch (error) {
      message.error('Erreur lors du chargement des utilisateurs');
    } finally {
      setLoading(false);
    }
  };



  const filteredUsers = users.filter(u =>
    u.nom.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6">
      <PageHeader />
      
      <Card
        title="Liste des Utilisateurs"
        bordered={false}
        extra={
          <Button
            type="primary"
            icon={<UserAddOutlined />}
            onClick={() => setShowModal(true)}
          >
            Ajouter Utilisateur
          </Button>
        }
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Input
            placeholder="Rechercher un utilisateur..."
            prefix={<SearchOutlined />}
            size="large"
            allowClear
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ maxWidth: 400 }}
          />

          <Spin spinning={loading}>
            <UserTable 
              users={filteredUsers} 
            
              onDelete={() => {
                
              }} 
            />
          </Spin>
        </Space>
      </Card>

      <AddUserModal 
        isOpen={showModal} 
        onClose={() => {
          setShowModal(false);
          fetchUsers();
        }} 
      />
    </div>
  );
}