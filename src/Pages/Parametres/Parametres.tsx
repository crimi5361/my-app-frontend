import { useEffect, useState } from 'react';
import UserTable, { type UtilisateurGere } from '../../Components/UserTable';
import AddUserModal from '../../Components/AddUserModal';
import PageHeader from '../../Components/PageHeader/PageHeader';
import { Input, Button, Space, Card, message, Spin } from 'antd';
import { SearchOutlined, UserAddOutlined } from '@ant-design/icons';
import { apiFetch, ApiError } from '../../lib/api';

export default function UserManagement() {
  const [users, setUsers] = useState<UtilisateurGere[]>([]);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UtilisateurGere | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<UtilisateurGere[]>('/api/utilisateurs');
      setUsers(data);
    } catch {
      message.error('Erreur lors du chargement des utilisateurs');
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(u =>
    u.nom.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleAddClick = () => {
    setEditingUser(null);
    setShowModal(true);
  };

  const handleEditClick = (user: UtilisateurGere) => {
    setEditingUser(user);
    setShowModal(true);
  };

  // Désactivation logique uniquement — jamais de suppression physique du compte (voir
  // controllers/user.controller.js::deactivateUser). Le login refuse déjà les comptes dont le
  // statut n'est pas 'active'.
  const handleDeactivate = async (id: number) => {
    try {
      await apiFetch(`/api/utilisateurs/${id}/desactiver`, { method: 'PATCH' });
      message.success('Utilisateur désactivé.');
      fetchUsers();
    } catch (e) {
      if (e instanceof ApiError) { message.error(e.message); return; }
      message.error("Erreur lors de la désactivation de l'utilisateur.");
    }
  };

  const handleReactivate = async (id: number) => {
    try {
      await apiFetch(`/api/utilisateurs/${id}/reactiver`, { method: 'PATCH' });
      message.success('Utilisateur réactivé.');
      fetchUsers();
    } catch (e) {
      if (e instanceof ApiError) { message.error(e.message); return; }
      message.error("Erreur lors de la réactivation de l'utilisateur.");
    }
  };

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
            onClick={handleAddClick}
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
              onEdit={handleEditClick}
              onDelete={handleDeactivate}
              onReactivate={handleReactivate}
            />
          </Spin>
        </Space>
      </Card>

      <AddUserModal
        isOpen={showModal}
        editUser={editingUser}
        onClose={() => {
          setShowModal(false);
          setEditingUser(null);
          fetchUsers();
        }}
      />
    </div>
  );
}
