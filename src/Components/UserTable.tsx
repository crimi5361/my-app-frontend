import { Button, Popconfirm, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { StopOutlined, CheckCircleOutlined, EditOutlined, GlobalOutlined } from '@ant-design/icons';
import DataTable from './ui/DataTable';
import StatusTag from './ui/StatusTag';

// Ligne telle que retournée par GET /api/utilisateurs — distinct du User de type/User.ts, qui
// décrit l'utilisateur de la session en cours (UserContext), une forme différente.
export interface UtilisateurGere {
  id: number;
  nom: string;
  email: string;
  departement: string;
  site_id: number;
  role: string;
  role_id: number;
  statut: string;
  code: string;
  ecole_id: number | null;
  ecole_nom: string | null;
}

interface Props {
  users: UtilisateurGere[];
  onDelete: (id: number) => void;
  onEdit: (user: UtilisateurGere) => void;
  onReactivate: (id: number) => void;
}

export default function UserTable({ users, onDelete, onEdit, onReactivate }: Props) {
  const columns: ColumnsType<UtilisateurGere> = [
    {
      title: 'Nom',
      dataIndex: 'nom',
      key: 'nom',
      render: (value: string) => <span className="font-semibold text-gray-800">{value}</span>,
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      render: (value: string) => <span className="text-gray-600">{value}</span>,
    },
    {
      title: 'Département',
      dataIndex: 'departement',
      key: 'departement',
      render: (value: string) => <span className="text-gray-600">{value}</span>,
    },
    {
      title: 'Rôle',
      dataIndex: 'role',
      key: 'role',
      render: (value: string) => <StatusTag tone="info" label={value} />,
    },
    {
      title: 'École (Chantier 3)',
      dataIndex: 'ecole_nom',
      key: 'ecole_nom',
      render: (value: string | null) =>
        value ? (
          <StatusTag tone="success" label={value} />
        ) : (
          <Tooltip title="Aucune école affectée : cet agent voit les données de toutes les écoles">
            <span className="inline-flex items-center gap-1 text-gray-500 text-sm">
              <GlobalOutlined /> Vue globale
            </span>
          </Tooltip>
        ),
    },
    {
      title: 'Statut',
      dataIndex: 'statut',
      key: 'statut',
      render: (value: string) => (
        <StatusTag tone={value === 'active' ? 'success' : 'danger'} label={value.toUpperCase()} />
      ),
    },
    {
      title: 'Code',
      dataIndex: 'code',
      key: 'code',
      render: (value: string) => <span className="text-gray-600">{value}</span>,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_value, record) => (
        <div className="flex gap-2">
          <Tooltip title="Modifier le rôle, le site ou l'école de l'utilisateur">
            <Button icon={<EditOutlined />} onClick={() => onEdit(record)}>
              Modifier
            </Button>
          </Tooltip>
          {record.statut === 'active' ? (
            <Tooltip title="Désactiver le compte — l'utilisateur ne pourra plus se connecter">
              <Popconfirm
                title="Désactiver ce compte ?"
                description="L'utilisateur ne pourra plus se connecter. Le compte n'est pas supprimé."
                onConfirm={() => onDelete(record.id)}
                okText="Désactiver"
                cancelText="Annuler"
              >
                <Button danger icon={<StopOutlined />}>
                  Désactiver
                </Button>
              </Popconfirm>
            </Tooltip>
          ) : (
            <Tooltip title="Réactiver le compte — l'utilisateur pourra de nouveau se connecter">
              <Popconfirm
                title="Réactiver ce compte ?"
                onConfirm={() => onReactivate(record.id)}
                okText="Réactiver"
                cancelText="Annuler"
              >
                <Button icon={<CheckCircleOutlined />}>
                  Réactiver
                </Button>
              </Popconfirm>
            </Tooltip>
          )}
        </div>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      dataSource={users}
      rowKey="id"
      pagination={{ pageSize: 100 }}
    />
  );
}
