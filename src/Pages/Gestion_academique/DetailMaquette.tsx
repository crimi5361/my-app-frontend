/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PageHeader from '../../Components/PageHeader/PageHeader';
import { apiFetch } from '../../lib/api';
import {
  Card, Button, Modal, Form, Input, InputNumber, Select, Space,
  message, Spin, Table, Tag, Row, Col, Typography, Tooltip, Popconfirm
} from 'antd';
import {
  PlusOutlined, ArrowLeftOutlined, CheckOutlined,
  EditOutlined, SaveOutlined, CloseOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface MaquetteDetail {
  id: number;
  filiere_nom: string;
  filiere_sigle: string;
  niveau_libelle: string;
  annee_academique: string;
  parcour: string;
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
  code_ue?: string;
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
  code_ecue?: string;
}

interface Categorie {
  id: number;
  nom: string;
}

interface SemestreData {
  id: number;
  libelle: string;
  ues: UE[];
}

interface EditableRow {
  key: string;
  ue_id: number;
  ue_libelle: string;
  ue_code: string;
  ue_rowspan: number;
  ue_credit_total?: number;
  ue_categorie?: string;
  id: number;
  nom: string;
  coefficient: number;
  code_ecue?: string;
  volume_horaire_cm: number;
  taux_horaire_cm: number;
  volume_horaire_td: number;
  taux_horaire_td: number;
}

// ─── Cellule éditable ─────────────────────────────────────────────────────────

interface EditableCellProps {
  editing: boolean;
  dataIndex: string;
  record: EditableRow;
  inputType?: 'number' | 'text';
  children: React.ReactNode;
  [key: string]: any;
}

const EditableCell: React.FC<EditableCellProps> = ({
  editing,
  dataIndex,
  inputType,
  children,
  record,
  ...restProps
}) => {
  const inputNode =
    inputType === 'number' ? (
      <InputNumber
        min={0}
        step={dataIndex === 'coefficient' ? 0.5 : 1}
        style={{ width: '100%' }}
        size="small"
      />
    ) : (
      <Input size="small" />
    );

  return (
    <td {...restProps}>
      {editing ? (
        <Form.Item
          name={dataIndex}
          style={{ margin: 0 }}
          rules={
            ['nom', 'ue_libelle'].includes(dataIndex)
              ? [{ required: true, message: '' }]
              : undefined
          }
        >
          {inputNode}
        </Form.Item>
      ) : (
        children
      )}
    </td>
  );
};

// ─── Composant principal ──────────────────────────────────────────────────────

const DetailMaquette: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [maquette, setMaquette] = useState<MaquetteDetail | null>(null);
  const [semestres, setSemestres] = useState<SemestreData[]>([]);
  const [categories, setCategories] = useState<Categorie[]>([]);
  const [allSemestres, setAllSemestres] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [ueModalVisible, setUeModalVisible] = useState(false);
  const [matiereModalVisible, setMatiereModalVisible] = useState(false);
  const [availableUes, setAvailableUes] = useState<UE[]>([]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const [editMode, setEditMode] = useState(false);
  const [editingKey, setEditingKey] = useState<string>('');
  const [form] = Form.useForm();
  const [ueForm] = Form.useForm();
  const [matiereForm] = Form.useForm();

  useEffect(() => {
    if (id) {
      fetchMaquetteDetail();
      fetchAllSemestres();
      fetchCategories();
    }
  }, [id]);

  // ─── Fetch ─────────────────────────────────────────────────────────────────

  const fetchMaquetteDetail = async () => {
    try {
      setLoading(true);
      const data = await apiFetch(`/api/detailaffichageMaquette/maquettes/${id}/structured`);
      setMaquette(data.maquette);
      setSemestres(data.semestres || []);
    } catch {
      message.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const fetchUesForMaquette = async () => {
    try {
      const data = await apiFetch(`/api/maquettes/maquettes/${id}/ues`);
      const ues = Array.isArray(data) ? data : [];
      setAvailableUes(ues);
      return ues;
    } catch {
      message.error('Erreur lors du chargement des UE');
      return [];
    }
  };

  const fetchAllSemestres = async () => {
    try {
      const data = await apiFetch('/api/semestres');
      setAllSemestres(Array.isArray(data) ? data : []);
    } catch {
      message.error('Erreur lors du chargement des semestres');
    }
  };

  const fetchCategories = async () => {
    try {
      const data = await apiFetch('/api/categorie');
      setCategories(Array.isArray(data) ? data : []);
    } catch {
      message.error('Erreur lors du chargement des catégories');
    }
  };

  // ─── Helpers ───────────────────────────────────────────────────────────────

  const calculateCoutCM = (v: number, t: number) => v * t;
  const calculateCoutTD = (v: number, t: number) => v * t;

  const copyToClipboard = (code: string, type: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    message.success(`${type} copié`);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const generateUECode = (libelle: string, semestreId: number) => {
    const libelleCode = libelle.substring(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, '');
    const semestre = allSemestres.find(s => s.id === semestreId);
    // /api/semestres renvoie { id, nom } — pas "libelle". Un ancien code utilisait
    // semestre.libelle (toujours undefined), générant des codes invalides du type
    // "UE-XXXX-Sundefined-XXX" (minuscules interdites par la règle de validation du champ).
    const semestreCode = semestre?.nom ? `S${semestre.nom.replace(/[^A-Z0-9]/gi, '').toUpperCase()}` : 'S0';
    // Suffixe basé sur l'horodatage (au lieu de 3 chiffres aléatoires, trop peu pour
    // éviter les collisions une fois plusieurs dizaines d'UE créées sur une même maquette).
    const uniqueSuffix = Date.now().toString(36).toUpperCase();
    return `UE-${libelleCode}-${semestreCode}-${uniqueSuffix}`;
  };

  const generateECUECode = (nom: string, ueId: number) => {
    const matiereCode = nom.substring(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, '');
    const ue = availableUes.find(u => u.id === ueId);
    const ueCode = ue?.code_ue ? ue.code_ue.substring(0, 8) : 'UNKNOWN';
    const uniqueSuffix = Date.now().toString(36).toUpperCase();
    return `ECUE-${matiereCode}-${ueCode}-${uniqueSuffix}`;
  };

  // ─── Construction des données ──────────────────────────────────────────────

  const getGroupedDataByUE = (semestre: SemestreData): EditableRow[] => {
    return semestre.ues.flatMap(ue => {
      const matieres = ue.matieres || [];
      if (matieres.length === 0) {
        return [{
          key: `${ue.id}-empty`,
          ue_id: ue.id,
          ue_libelle: ue.libelle,
          ue_code: ue.code_ue || '',
          ue_rowspan: 1,
          ue_credit_total: ue.credit_total,
          ue_categorie: ue.categorie_nom,
          id: -1,
          nom: '',
          coefficient: 0,
          code_ecue: undefined,
          volume_horaire_cm: 0,
          taux_horaire_cm: 0,
          volume_horaire_td: 0,
          taux_horaire_td: 0,
        }];
      }
      return matieres.map((matiere, index) => ({
        ...matiere,
        key: `${ue.id}-${matiere.id}`,
        ue_id: ue.id,
        ue_libelle: ue.libelle,
        ue_code: ue.code_ue || '',
        ue_rowspan: index === 0 ? matieres.length : 0,
        ue_credit_total: ue.credit_total,
        ue_categorie: ue.categorie_nom,
      }));
    });
  };

  // ─── Édition inline ────────────────────────────────────────────────────────

  const isEditing = (record: EditableRow) => record.key === editingKey;

  const startEdit = (record: EditableRow) => {
    form.setFieldsValue({
      ue_libelle: record.ue_libelle,
      ue_code: record.ue_code,
      nom: record.nom,
      code_ecue: record.code_ecue,
      coefficient: record.coefficient,
      volume_horaire_cm: record.volume_horaire_cm,
      taux_horaire_cm: record.taux_horaire_cm,
      volume_horaire_td: record.volume_horaire_td,
      taux_horaire_td: record.taux_horaire_td,
    });
    setEditingKey(record.key);
  };

  const cancelEdit = () => {
    setEditingKey('');
    form.resetFields();
  };

  const saveRow = async (record: EditableRow) => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      const promises: Promise<any>[] = [];

      // Mise à jour UE si c'est la 1ère ligne (rowspan > 0) ou UE sans matière
      if (record.ue_rowspan !== 0) {
        promises.push(
          apiFetch(`/api/ues/ues/${record.ue_id}`, {
            method: 'PUT',
            body: JSON.stringify({
              libelle: values.ue_libelle,
              code_ue: values.ue_code,
            }),
          })
        );
      }

      // Mise à jour matière si elle existe
      if (record.id > 0) {
        promises.push(
          apiFetch(`/api/matiere/${record.id}`, {
            method: 'PUT',
            body: JSON.stringify({
              nom: values.nom,
              code_ecue: values.code_ecue,
              coefficient: values.coefficient,
              volume_horaire_cm: values.volume_horaire_cm ?? 0,
              taux_horaire_cm: values.taux_horaire_cm ?? 0,
              volume_horaire_td: values.volume_horaire_td ?? 0,
              taux_horaire_td: values.taux_horaire_td ?? 0,
            }),
          })
        );
      }

      await Promise.all(promises);
      message.success('Modifications enregistrées');
      setEditingKey('');
      form.resetFields();
      fetchMaquetteDetail();
    } catch (err: any) {
      if (err?.errorFields) {
        message.warning('Veuillez corriger les champs invalides');
      } else {
        message.error(err?.message || 'Erreur lors de la sauvegarde');
      }
    } finally {
      setSaving(false);
    }
  };

  // ─── Création UE ───────────────────────────────────────────────────────────

  const handleCreateUE = async (values: any) => {
    try {
      const codeUE = values.code_ue || generateUECode(values.libelle, values.semestre_id);
      const data = await apiFetch('/api/ues/ues', {
        method: 'POST',
        body: JSON.stringify({ ...values, code_ue: codeUE, maquette_id: parseInt(id || '0') }),
      });
      if (data.success) {
        message.success(`UE créée — Code: ${codeUE}`);
        setUeModalVisible(false);
        ueForm.resetFields();
        fetchMaquetteDetail();
      } else {
        message.error(data.message || 'Erreur lors de la création');
      }
    } catch (err: any) {
      message.error(err?.message || "Erreur lors de la création de l'UE");
    }
  };

  // ─── Création Matière ──────────────────────────────────────────────────────

  const handleCreateMatiere = async (values: any) => {
    try {
      const codeECUE = values.code_ecue || generateECUECode(values.nom, values.ue_id);
      const data = await apiFetch('/api/matiere', {
        method: 'POST',
        body: JSON.stringify({
          ...values,
          code_ecue: codeECUE,
          volume_horaire_td: values.volume_horaire_td || 0,
          taux_horaire_td: values.taux_horaire_td || 0,
          volume_horaire_cm: values.volume_horaire_cm || 0,
          taux_horaire_cm: values.taux_horaire_cm || 0,
        }),
      });
      if (data.success) {
        message.success(`Matière créée — Code: ${codeECUE}`);
        setMatiereModalVisible(false);
        matiereForm.resetFields();
        fetchMaquetteDetail();
      } else {
        message.error(data.message || 'Erreur lors de la création');
      }
    } catch (err: any) {
      message.error(err?.message || 'Erreur lors de la création de la matière');
    }
  };

  // ─── Colonnes ──────────────────────────────────────────────────────────────

  const buildColumns = () => {
    const base: any[] = [
      {
        title: 'CODE UE',
        key: 'code_ue_col',
        dataIndex: 'ue_code',
        editable: true,
        inputType: 'text',
        onCell: (record: EditableRow) => ({
          record,
          dataIndex: 'ue_code',
          editing: editMode && isEditing(record),
          inputType: 'text',
          rowSpan: record.ue_rowspan,
          style: {
            backgroundColor: '#e6f7ff',
            borderRight: '1px solid #d9d9d9',
            borderBottom: '1px solid #d9d9d9',
            verticalAlign: 'middle',
            textAlign: 'center' as const,
          },
        }),
        render: (_: any, record: EditableRow) =>
          record.ue_code ? (
            <Tooltip title="Cliquer pour copier">
              <Tag
                color="blue"
                style={{ cursor: 'pointer', fontSize: 12, wordBreak: 'break-all', whiteSpace: 'normal' }}
                onClick={e => { e.stopPropagation(); copyToClipboard(record.ue_code, 'Code UE'); }}
              >
                {record.ue_code}
                {copiedCode === record.ue_code && <CheckOutlined style={{ marginLeft: 4 }} />}
              </Tag>
            </Tooltip>
          ) : <Text type="secondary">—</Text>,
        width: '10%',
      },
      {
        title: 'UE',
        key: 'ue_libelle_col',
        dataIndex: 'ue_libelle',
        editable: true,
        inputType: 'text',
        onCell: (record: EditableRow) => ({
          record,
          dataIndex: 'ue_libelle',
          editing: editMode && isEditing(record),
          inputType: 'text',
          rowSpan: record.ue_rowspan,
          style: {
            backgroundColor: '#e6f7ff',
            borderRight: '1px solid #d9d9d9',
            borderBottom: '1px solid #d9d9d9',
            verticalAlign: 'middle',
          },
        }),
        render: (_: any, record: EditableRow) => (
          <Text strong style={{ color: '#1d3557' }}>{record.ue_libelle}</Text>
        ),
        width: '18%',
      },
      {
        title: 'CODE ECUE',
        key: 'code_ecue_col',
        dataIndex: 'code_ecue',
        editable: true,
        inputType: 'text',
        onCell: (record: EditableRow) => ({
          record,
          dataIndex: 'code_ecue',
          editing: editMode && isEditing(record),
          inputType: 'text',
          style: {
            borderRight: '1px solid #d9d9d9',
            borderBottom: '1px solid #d9d9d9',
            verticalAlign: 'middle',
            textAlign: 'center' as const,
          },
        }),
        render: (_: any, record: EditableRow) =>
          record.code_ecue ? (
            <Tooltip title="Cliquer pour copier">
              <Tag
                color="green"
                style={{ cursor: 'pointer', fontSize: 12, wordBreak: 'break-all', whiteSpace: 'normal' }}
                onClick={e => { e.stopPropagation(); copyToClipboard(record.code_ecue!, 'Code ECUE'); }}
              >
                {record.code_ecue}
                {copiedCode === record.code_ecue && <CheckOutlined style={{ marginLeft: 4 }} />}
              </Tag>
            </Tooltip>
          ) : <Text type="secondary">—</Text>,
        width: '10%',
      },
      {
        title: 'MATIÈRE (ÉCUE)',
        dataIndex: 'nom',
        key: 'nom',
        editable: true,
        inputType: 'text',
        onCell: (record: EditableRow) => ({
          record,
          dataIndex: 'nom',
          editing: editMode && isEditing(record),
          inputType: 'text',
          style: { borderRight: '1px solid #d9d9d9', borderBottom: '1px solid #d9d9d9', verticalAlign: 'middle' },
        }),
        render: (text: string) => <Text>{text}</Text>,
        width: '15%',
      },
      {
        title: 'VH CM',
        dataIndex: 'volume_horaire_cm',
        key: 'volume_horaire_cm',
        align: 'center' as const,
        editable: true,
        inputType: 'number',
        onCell: (record: EditableRow) => ({
          record,
          dataIndex: 'volume_horaire_cm',
          editing: editMode && isEditing(record),
          inputType: 'number',
          style: { borderRight: '1px solid #d9d9d9', borderBottom: '1px solid #d9d9d9' },
        }),
        render: (v: number) => v > 0 ? `${v}h` : '-',
        width: '6%',
      },
      {
        title: 'TAUX CM',
        dataIndex: 'taux_horaire_cm',
        key: 'taux_horaire_cm',
        align: 'center' as const,
        editable: true,
        inputType: 'number',
        onCell: (record: EditableRow) => ({
          record,
          dataIndex: 'taux_horaire_cm',
          editing: editMode && isEditing(record),
          inputType: 'number',
          style: { borderRight: '1px solid #d9d9d9', borderBottom: '1px solid #d9d9d9' },
        }),
        render: (v: number) => v > 0 ? v?.toLocaleString('fr-FR') + ' F' : '-',
        width: '7%',
      },
      {
        title: 'COUT CM',
        key: 'cout_cm',
        align: 'center' as const,
        editable: false,
        onCell: () => ({ style: { borderRight: '1px solid #d9d9d9', borderBottom: '1px solid #d9d9d9' } }),
        render: (_: any, record: Matiere) => {
          const cout = calculateCoutCM(record.volume_horaire_cm, record.taux_horaire_cm);
          return cout > 0 ? <Tag color="blue" style={{ margin: 0 }}>{cout?.toLocaleString('fr-FR')} F</Tag> : '-';
        },
        width: '8%',
      },
      {
        title: 'VH TD',
        dataIndex: 'volume_horaire_td',
        key: 'volume_horaire_td',
        align: 'center' as const,
        editable: true,
        inputType: 'number',
        onCell: (record: EditableRow) => ({
          record,
          dataIndex: 'volume_horaire_td',
          editing: editMode && isEditing(record),
          inputType: 'number',
          style: { borderRight: '1px solid #d9d9d9', borderBottom: '1px solid #d9d9d9' },
        }),
        render: (v: number) => v > 0 ? `${v}h` : '-',
        width: '6%',
      },
      {
        title: 'TAUX TD',
        dataIndex: 'taux_horaire_td',
        key: 'taux_horaire_td',
        align: 'center' as const,
        editable: true,
        inputType: 'number',
        onCell: (record: EditableRow) => ({
          record,
          dataIndex: 'taux_horaire_td',
          editing: editMode && isEditing(record),
          inputType: 'number',
          style: { borderRight: '1px solid #d9d9d9', borderBottom: '1px solid #d9d9d9' },
        }),
        render: (v: number) => v > 0 ? v?.toLocaleString('fr-FR') + ' F' : '-',
        width: '7%',
      },
      {
        title: 'COUT TD',
        key: 'cout_td',
        align: 'center' as const,
        editable: false,
        onCell: () => ({ style: { borderRight: '1px solid #d9d9d9', borderBottom: '1px solid #d9d9d9' } }),
        render: (_: any, record: Matiere) => {
          const cout = calculateCoutTD(record.volume_horaire_td, record.taux_horaire_td);
          return cout > 0 ? <Tag color="green" style={{ margin: 0 }}>{cout?.toLocaleString('fr-FR')} F</Tag> : '-';
        },
        width: '8%',
      },
      {
        title: 'COEFF',
        dataIndex: 'coefficient',
        key: 'coefficient',
        align: 'center' as const,
        editable: true,
        inputType: 'number',
        onCell: (record: EditableRow) => ({
          record,
          dataIndex: 'coefficient',
          editing: editMode && isEditing(record),
          inputType: 'number',
          style: { borderRight: '1px solid #d9d9d9', borderBottom: '1px solid #d9d9d9' },
        }),
        render: (v: any) => {
          const coeff = typeof v === 'string' ? parseFloat(v) : v;
          return coeff > 0 ? <Tag color="orange" style={{ margin: 0 }}>{coeff}</Tag> : '-';
        },
        width: '5%',
      },
    ];

    if (editMode) {
      base.push({
        title: 'Actions',
        key: 'actions',
        align: 'center' as const,
        editable: false,
        onCell: () => ({ style: { borderBottom: '1px solid #d9d9d9' } }),
        render: (_: any, record: EditableRow) => {
          const editing = isEditing(record);
          return editing ? (
            <Space size={4}>
              <Button
                type="primary"
                size="small"
                icon={<SaveOutlined />}
                loading={saving}
                onClick={() => saveRow(record)}
                style={{ background: '#52c41a', borderColor: '#52c41a' }}
              >
                OK
              </Button>
              <Button size="small" icon={<CloseOutlined />} onClick={cancelEdit}>
                Annuler
              </Button>
            </Space>
          ) : (
            <Button
              size="small"
              icon={<EditOutlined />}
              disabled={editingKey !== ''}
              onClick={() => startEdit(record)}
              style={{ borderColor: '#1890ff', color: '#1890ff' }}
            >
              Éditer
            </Button>
          );
        },
        width: '9%',
      });
    }

    return base;
  };

  const mergedColumns = buildColumns().map(col => {
    if (!col.editable) return col;
    return {
      ...col,
      onCell: (record: EditableRow) => {
        const base = col.onCell ? col.onCell(record) : {};
        return {
          ...base,
          record,
          inputType: col.inputType || 'text',
          dataIndex: col.dataIndex || col.key,
          editing: editMode && isEditing(record),
        };
      },
    };
  });

  // ─── Rendu ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen">
        <PageHeader />
        <div className="flex justify-center items-center h-64">
          <Spin size="large" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <PageHeader />

      <div className="mb-4">
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} className="mb-4">
          Retour
        </Button>
      </div>

      {/* Infos maquette */}
      <Card className="mb-6 shadow-lg border-0" style={{ background: 'linear-gradient(to right, #f5f7fa, #c3cfe2)' }}>
        <Title level={2} className="text-center mb-6 text-blue-800">
          Détails de la Maquette
        </Title>
        <Row gutter={[16, 16]} className="mb-4">
          <Col xs={24} sm={12}>
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <Text strong className="text-blue-700">Filière:</Text><br />
              <Text className="text-lg">{maquette?.filiere_nom} ({maquette?.filiere_sigle})</Text>
            </div>
          </Col>
          <Col xs={24} sm={12}>
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <Text strong className="text-green-700">Niveau:</Text><br />
              <Text className="text-lg">{maquette?.niveau_libelle}</Text>
            </div>
          </Col>
          <Col xs={24} sm={12}>
            <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
              <Text strong className="text-purple-700">Année Académique:</Text><br />
              <Text className="text-lg">{maquette?.annee_academique}</Text>
            </div>
          </Col>
          <Col xs={24} sm={12}>
            <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
              <Text strong className="text-orange-700">Parcour:</Text><br />
              <Text className="text-lg">{maquette?.parcour}</Text>
            </div>
          </Col>
        </Row>
      </Card>

      {/* Barre d'actions */}
      <div className="mb-6 flex flex-wrap gap-3 items-center">
        {!editMode ? (
          <>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setUeModalVisible(true)}
              size="large"
              style={{ borderRadius: '6px' }}
            >
              Nouvelle UE
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={async () => {
                const ues = await fetchUesForMaquette();
                if (ues.length === 0) { message.warning("Veuillez d'abord créer une UE"); return; }
                setMatiereModalVisible(true);
              }}
              size="large"
              style={{ borderRadius: '6px', background: '#389e0d', borderColor: '#389e0d' }}
            >
              Nouvelle Matière
            </Button>
            <Button
              icon={<EditOutlined />}
              size="large"
              onClick={() => { setEditMode(true); setEditingKey(''); }}
              style={{ borderRadius: '6px', borderColor: '#fa8c16', color: '#fa8c16', fontWeight: 600 }}
            >
              Modifier le tableau
            </Button>
          </>
        ) : (
          <>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              background: '#fffbe6',
              border: '1px solid #ffe58f',
              borderRadius: 8,
              padding: '8px 16px',
              flex: 1,
            }}>
              <EditOutlined style={{ color: '#fa8c16', fontSize: 16 }} />
              <Text style={{ color: '#ad6800', fontWeight: 600 }}>
                Mode édition actif — cliquez <b>Éditer</b> sur une ligne, modifiez les champs, puis <b>OK</b> pour enregistrer.
              </Text>
            </div>
            <Popconfirm
              title="Quitter le mode édition ?"
              description="Les modifications non enregistrées seront perdues."
              onConfirm={() => { setEditMode(false); setEditingKey(''); form.resetFields(); }}
              okText="Quitter"
              cancelText="Rester"
            >
              <Button icon={<CloseOutlined />} size="large" danger style={{ borderRadius: '6px' }}>
                Quitter l'édition
              </Button>
            </Popconfirm>
          </>
        )}
      </div>

      {/* Tableaux par semestre */}
      {semestres && semestres.length > 0 ? (
        semestres.map(semestre => (
          <Card
            key={semestre.id}
            title={
              <div className="flex items-center justify-between">
                <span className="text-xl font-bold text-gray-800">SEMESTRE {semestre.libelle}</span>
                <Tag color="blue">{semestre.ues?.length || 0} UE(s)</Tag>
              </div>
            }
            className="mb-6 shadow-lg border-0"
            style={editMode ? { border: '2px solid #fa8c16', borderRadius: 8 } : {}}
          >
            {semestre.ues && semestre.ues.length > 0 ? (
              <Form form={form} component={false}>
                <Table
                  components={{
                    body: { cell: EditableCell },
                    header: {
                      cell: (props: any) => (
                        <th
                          {...props}
                          style={{
                            backgroundColor: editMode ? '#fa8c16' : '#1890ff',
                            color: 'white',
                            fontWeight: 'bold',
                            textAlign: 'center',
                            border: '1px solid transparent',
                            padding: '12px 8px',
                            transition: 'background-color 0.3s',
                          }}
                        />
                      ),
                    },
                  }}
                  columns={mergedColumns}
                  dataSource={getGroupedDataByUE(semestre)}
                  pagination={false}
                  size="middle"
                  bordered
                  rowClassName={(record: any) =>
                    editMode && isEditing(record) ? 'editing-row' : ''
                  }
                  style={{ border: '2px solid #1890ff', borderRadius: '8px', overflow: 'hidden' }}
                  summary={() => {
                    const allMatieres = semestre.ues.flatMap(ue => ue.matieres || []);
                    const totalCM = allMatieres.reduce((t: number, m: any) => t + (m.volume_horaire_cm || 0), 0);
                    const totalTD = allMatieres.reduce((t: number, m: any) => t + (m.volume_horaire_td || 0), 0);
                    const totalCoutCM = allMatieres.reduce((t: number, m: any) => t + calculateCoutCM(m.volume_horaire_cm, m.taux_horaire_cm), 0);
                    const totalCoutTD = allMatieres.reduce((t: number, m: any) => t + calculateCoutTD(m.volume_horaire_td, m.taux_horaire_td), 0);
                    const totalCoeff = allMatieres.reduce((t: number, m: any) => {
                      const c = typeof m.coefficient === 'string' ? parseFloat(m.coefficient) : m.coefficient;
                      return t + (c || 0);
                    }, 0);
                    return (
                      <Table.Summary>
                        <Table.Summary.Row className="bg-blue-50 font-semibold">
                          <Table.Summary.Cell index={0} colSpan={editMode ? 5 : 4}>
                            <Text strong>TOTAL SEMESTRE {semestre.libelle}</Text>
                          </Table.Summary.Cell>
                          <Table.Summary.Cell index={1} align="center">{totalCM > 0 ? <Text strong>{totalCM}h</Text> : '-'}</Table.Summary.Cell>
                          <Table.Summary.Cell index={2} align="center">-</Table.Summary.Cell>
                          <Table.Summary.Cell index={3} align="center">
                            {totalCoutCM > 0 ? <Tag color="blue">{totalCoutCM.toLocaleString('fr-FR')} F</Tag> : '-'}
                          </Table.Summary.Cell>
                          <Table.Summary.Cell index={4} align="center">{totalTD > 0 ? <Text strong>{totalTD}h</Text> : '-'}</Table.Summary.Cell>
                          <Table.Summary.Cell index={5} align="center">-</Table.Summary.Cell>
                          <Table.Summary.Cell index={6} align="center">
                            {totalCoutTD > 0 ? <Tag color="green">{totalCoutTD.toLocaleString('fr-FR')} F</Tag> : '-'}
                          </Table.Summary.Cell>
                          <Table.Summary.Cell index={7} align="center">
                            {totalCoeff > 0 ? <Tag color="orange">{totalCoeff}</Tag> : '-'}
                          </Table.Summary.Cell>
                          {editMode && <Table.Summary.Cell index={8} />}
                        </Table.Summary.Row>
                      </Table.Summary>
                    );
                  }}
                />
              </Form>
            ) : (
              <div className="text-center py-8 bg-white rounded-lg">
                <Text type="secondary" italic>Aucune UE pour ce semestre</Text>
              </div>
            )}
          </Card>
        ))
      ) : (
        <Card className="mb-6 shadow-lg border-0">
          <div className="text-center py-8">
            <Text type="secondary" italic>Aucun semestre disponible pour cette maquette</Text>
          </div>
        </Card>
      )}

      {/* ── Modal UE ──────────────────────────────────────────────────────── */}
      <Modal
        title="Nouvelle Unité d'Enseignement"
        open={ueModalVisible}
        onCancel={() => { setUeModalVisible(false); ueForm.resetFields(); }}
        footer={null}
        width={600}
      >
        <Form form={ueForm} layout="vertical" onFinish={handleCreateUE}>
          <Form.Item
            label="Code UE" name="code_ue"
            tooltip="Laissez vide pour génération automatique"
            rules={[{ pattern: /^[A-Z0-9\-_]+$/, message: 'Majuscules, chiffres, tirets uniquement' }]}
            extra="Format: UE-XXXX-SX-XXX"
          >
            <Input placeholder="Laissez vide pour auto-génération" size="large" />
          </Form.Item>
          <Form.Item label="Libellé" name="libelle" rules={[{ required: true, message: 'Requis' }]}>
            <Input placeholder="Nom de l'UE" size="large" />
          </Form.Item>
          <Form.Item label="Semestre" name="semestre_id" rules={[{ required: true, message: 'Requis' }]}>
            <Select placeholder="Sélectionner un semestre" size="large">
              {allSemestres.map((s: any) => (
                <Select.Option key={s.id} value={s.id}>{s.nom || s.libelle}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item label="Catégorie" name="categorie_id" rules={[{ required: true, message: 'Requis' }]}>
            <Select placeholder="Sélectionner une catégorie" size="large">
              {categories.map(c => <Select.Option key={c.id} value={c.id}>{c.nom}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item className="text-right mb-0">
            <Space>
              <Button onClick={() => setUeModalVisible(false)} size="large">Annuler</Button>
              <Button type="primary" htmlType="submit" size="large">Créer l'UE</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Modal Matière ─────────────────────────────────────────────────── */}
      <Modal
        title="Nouvelle Matière"
        open={matiereModalVisible}
        onCancel={() => { setMatiereModalVisible(false); matiereForm.resetFields(); }}
        footer={null}
        width={800}
      >
        <Form
          form={matiereForm}
          layout="vertical"
          onFinish={handleCreateMatiere}
          initialValues={{ volume_horaire_cm: 0, taux_horaire_cm: 0, volume_horaire_td: 0, taux_horaire_td: 0, coefficient: 1 }}
        >
          <Form.Item
            label="Code ECUE" name="code_ecue"
            tooltip="Laissez vide pour génération automatique"
            rules={[{ pattern: /^[A-Z0-9\-_]+$/, message: 'Majuscules, chiffres, tirets uniquement' }]}
            extra="Format: ECUE-XXXX-UEXXXX-XXX"
          >
            <Input placeholder="Laissez vide pour auto-génération" size="large" />
          </Form.Item>
          <Form.Item label="Unité d'Enseignement" name="ue_id" rules={[{ required: true, message: "Requis" }]}>
            <Select placeholder="Sélectionner une UE" size="large" showSearch optionFilterProp="children">
              {availableUes.map(ue => (
                <Select.Option key={ue.id} value={ue.id}>
                  {ue.code_ue ? `[${ue.code_ue}] ` : ''}{ue.libelle}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item label="Nom de la matière" name="nom" rules={[{ required: true, message: 'Requis' }]}>
            <Input placeholder="Nom de la matière" size="large" />
          </Form.Item>
          <Form.Item label="Coefficient" name="coefficient" rules={[{ required: true, message: 'Requis' }]}>
            <InputNumber min={0} step={0.5} style={{ width: '100%' }} size="large" />
          </Form.Item>
          <Card title="Volumes horaires" size="small" className="mb-4">
            <Row gutter={16}>
              <Col span={12}>
                <div className="bg-blue-50 p-3 rounded">
                  <Text strong className="text-blue-700">Cours Magistral (CM)</Text>
                  <Form.Item label="Volume Horaire" name="volume_horaire_cm" style={{ marginBottom: 8 }}>
                    <InputNumber min={0} style={{ width: '100%' }} placeholder="Heures" />
                  </Form.Item>
                  <Form.Item label="Taux Horaire" name="taux_horaire_cm" style={{ marginBottom: 0 }}>
                    <InputNumber min={0} style={{ width: '100%' }} placeholder="FCFA/heure" />
                  </Form.Item>
                </div>
              </Col>
              <Col span={12}>
                <div className="bg-green-50 p-3 rounded">
                  <Text strong className="text-green-700">Travaux Dirigés (TD)</Text>
                  <Form.Item label="Volume Horaire" name="volume_horaire_td" style={{ marginBottom: 8 }}>
                    <InputNumber min={0} style={{ width: '100%' }} placeholder="Heures" />
                  </Form.Item>
                  <Form.Item label="Taux Horaire" name="taux_horaire_td" style={{ marginBottom: 0 }}>
                    <InputNumber min={0} style={{ width: '100%' }} placeholder="FCFA/heure" />
                  </Form.Item>
                </div>
              </Col>
            </Row>
          </Card>
          <Form.Item className="text-right mb-0">
            <Space>
              <Button onClick={() => setMatiereModalVisible(false)} size="large">Annuler</Button>
              <Button type="primary" htmlType="submit" size="large" style={{ background: '#389e0d', borderColor: '#389e0d' }}>
                Créer la Matière
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <style>{`
        .editing-row td {
          background-color: #fffbe6 !important;
        }
        .editing-row td .ant-form-item {
          margin-bottom: 0 !important;
        }
      `}</style>
    </div>
  );
};

export default DetailMaquette;