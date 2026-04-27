import { User } from '../type/User';
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { useMemo } from 'react';
import { Table, Tag, Button, Tooltip } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';

interface Props {
  users: User[];
  onDelete: (id: number) => void;
}

export default function UserTable({ users, onDelete }: Props) {
  const columns = useMemo<ColumnDef<User>[]>(
    () => [
      { 
        accessorKey: 'nom', 
        header: 'Nom',
        cell: ({ getValue }) => <span className="font-semibold text-gray-800">{getValue() as string}</span>
      },
      { 
        accessorKey: 'email', 
        header: 'Email',
        cell: ({ getValue }) => <span className="text-gray-600">{getValue() as string}</span>
      },
      { 
        accessorKey: 'departement', 
        header: 'Département',
        cell: ({ getValue }) => <span className="text-gray-600">{getValue() as string}</span>
      },
      { 
        accessorKey: 'role', 
        header: 'Rôle',
        cell: ({ getValue }) => <Tag color="geekblue">{getValue() as string}</Tag>
      },
      {
        accessorKey: 'statut',
        header: 'Statut',
        cell: ({ row }) => (
          <Tag color={row.original.statut === 'active' ? 'green' : 'red'}>
            {row.original.statut.toUpperCase()}
          </Tag>
        )
      },
      { 
        accessorKey: 'code', 
        header: 'Code',
        cell: ({ getValue }) => <span className="text-gray-600">{getValue() as string}</span>
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <Tooltip title="Supprimer l'utilisateur">
            <Button 
              danger
              icon={<DeleteOutlined />}
              onClick={() => onDelete(row.original.id)}
            >
              Supprimer
            </Button>
          </Tooltip>
        )
      }
    ],
    [onDelete]
  );

  const table = useReactTable({ 
    data: users, 
    columns, 
    getCoreRowModel: getCoreRowModel() 
  });

  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <Table
        bordered
        rowKey="id"
        columns={table.getAllLeafColumns().map(col => ({
          title: col.columnDef.header as string,
          dataIndex: col.id,
          key: col.id,
          render: (_value: unknown, _record: User, index: number) => {
            const cell = table.getRowModel().rows[index]?.getVisibleCells().find(c => c.column.id === col.id);
            return cell ? flexRender(cell.column.columnDef.cell, cell.getContext()) : null;
          }
        }))}
        dataSource={users}
        pagination={{ pageSize: 100 }}
        className="antd-table-custom"
      />
    </div>
  );
}
