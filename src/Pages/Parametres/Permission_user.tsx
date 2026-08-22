import { useEffect, useMemo, useState } from 'react';
import { Card, Select, Checkbox, Button, Space, Typography, Alert, Spin, Empty, message, Tag, Row, Col } from 'antd';
import { SaveOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import PageHeader from '../../Components/PageHeader/PageHeader';
import { apiFetch, ApiError } from '../../lib/api';
import { grouperParModule, type PermissionCatalogueLigne } from '../../lib/permissions';

const { Text, Title } = Typography;

interface UtilisateurOption {
  id: number;
  nom: string;
  email: string;
  role: string;
  departement: string;
}

interface PermissionsUtilisateurReponse {
  role: string;
  permissions: PermissionCatalogueLigne[];
}

const Permission_user = () => {
  const [utilisateurs, setUtilisateurs] = useState<UtilisateurOption[]>([]);
  const [loadingUtilisateurs, setLoadingUtilisateurs] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  const [roleSelectionne, setRoleSelectionne] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<PermissionCatalogueLigne[]>([]);
  const [loadingPermissions, setLoadingPermissions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dejaModifie, setDejaModifie] = useState(false);

  useEffect(() => {
    apiFetch<UtilisateurOption[]>('/api/utilisateurs')
      .then(setUtilisateurs)
      .catch(() => message.error('Impossible de charger la liste des utilisateurs.'))
      .finally(() => setLoadingUtilisateurs(false));
  }, []);

  const selectedUser = useMemo(
    () => utilisateurs.find((u) => u.id === selectedUserId) || null,
    [utilisateurs, selectedUserId]
  );

  // ✅ Chaque option porte un `label` texte simple (pas des enfants JSX) — un Select antd en mode
  // recherche filtre par défaut sur `label`/`value` quand on utilise le prop `options`. La version
  // précédente utilisait des enfants JSX (`{u.nom} — {u.email} (...)`) comme source de filtrage
  // (`option.children` casté en `string`) : à l'exécution `children` est un TABLEAU de nœuds React
  // dès qu'il y a plus d'une expression, pas une chaîne — `.toLowerCase()` levait une exception dès
  // la première frappe, non rattrapée par React (page blanche). Un `label` string dès la
  // construction élimine la classe d'erreur entière, plutôt que de la contourner.
  const optionsUtilisateurs = useMemo(
    () => utilisateurs.map((u) => ({
      value: u.id,
      label: `${u.nom} — ${u.email} (${u.role})`,
    })),
    [utilisateurs]
  );

  const chargerPermissions = (userId: number) => {
    setLoadingPermissions(true);
    setDejaModifie(false);
    apiFetch<PermissionsUtilisateurReponse>(`/api/utilisateurs/${userId}/permissions`)
      .then((res) => {
        setRoleSelectionne(res.role);
        setPermissions(res.permissions);
      })
      .catch((e) => {
        setRoleSelectionne(null);
        setPermissions([]);
        if (e instanceof ApiError) { message.error(e.message); return; }
        message.error('Impossible de charger les permissions de cet utilisateur.');
      })
      .finally(() => setLoadingPermissions(false));
  };

  const handleSelectUser = (userId: number | null) => {
    setSelectedUserId(userId);
    if (userId) chargerPermissions(userId);
    else { setPermissions([]); setRoleSelectionne(null); }
  };

  const toggle = (id: number, checked: boolean) => {
    setPermissions((prev) => prev.map((p) => (p.id === id ? { ...p, accorde: checked } : p)));
    setDejaModifie(true);
  };

  const permissionsAccordeesCount = permissions.filter((p) => p.accorde).length;
  const groupes = useMemo(() => grouperParModule(permissions), [permissions]);

  const handleSave = async () => {
    if (!selectedUserId) return;
    setSaving(true);
    try {
      const permission_ids = permissions.filter((p) => p.accorde).map((p) => p.id);
      await apiFetch(`/api/utilisateurs/${selectedUserId}/permissions`, {
        method: 'PUT',
        body: JSON.stringify({ permission_ids }),
      });
      message.success('Permissions mises à jour avec succès.');
      setDejaModifie(false);
    } catch (e) {
      if (e instanceof ApiError) { message.error(e.message); return; }
      message.error('Erreur lors de la mise à jour des permissions.');
    } finally {
      setSaving(false);
    }
  };

  const estAdmin = selectedUser?.role === 'admin';

  return (
    <div style={{ padding: 24 }}>
      <PageHeader />

      <Card style={{ marginBottom: 24 }}>
        <Space direction="vertical" size={4} style={{ width: '100%' }}>
          <Title level={4} style={{ margin: 0 }}>
            <SafetyCertificateOutlined /> Gestion des permissions
          </Title>
          <Text type="secondary">
            Le rôle détermine quelles permissions peuvent être configurées ; l'administrateur attribue ensuite,
            parmi celles-ci, celles que ce collaborateur précis reçoit réellement.
          </Text>
        </Space>

        <div style={{ marginTop: 20, maxWidth: 480 }}>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>Rechercher un collaborateur</Text>
          <Select
            showSearch
            allowClear
            placeholder="Rechercher un collaborateur par nom ou email"
            style={{ width: '100%' }}
            loading={loadingUtilisateurs}
            value={selectedUserId ?? undefined}
            onChange={handleSelectUser}
            options={optionsUtilisateurs}
            filterOption={(input, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
            notFoundContent="Aucun collaborateur trouvé."
          />
        </div>
      </Card>

      {!selectedUserId ? (
        <Empty description="Sélectionnez un collaborateur pour voir et modifier ses permissions" style={{ marginTop: 60 }} />
      ) : loadingPermissions ? (
        <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
      ) : (
        <Card
          title={
            <Space>
              <span>{selectedUser?.nom}</span>
              <Tag color={estAdmin ? 'gold' : 'blue'}>{roleSelectionne ?? selectedUser?.role}</Tag>
              {!estAdmin && <Text type="secondary" style={{ fontWeight: 400 }}>{permissionsAccordeesCount} permission(s) accordée(s)</Text>}
            </Space>
          }
          extra={
            !estAdmin && permissions.length > 0 && (
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={handleSave}
                loading={saving}
                disabled={!dejaModifie}
              >
                Enregistrer
              </Button>
            )
          }
        >
          {estAdmin ? (
            <Alert
              type="info"
              showIcon
              message="Administrateur"
              description="Un compte administrateur a toujours un accès complet à toutes les actions — aucune permission à cocher individuellement."
            />
          ) : permissions.length === 0 ? (
            <Alert
              type="info"
              showIcon
              message="Aucune permission configurée pour ce rôle."
              description={`Le rôle "${roleSelectionne}" n'a aucune permission fine définie pour l'instant — aucune restriction supplémentaire ne peut être configurée ici pour ce collaborateur.`}
            />
          ) : (
            <Row gutter={[24, 24]}>
              {groupes.map((groupe) => (
                <Col xs={24} sm={12} lg={8} key={groupe.module}>
                  <Card size="small" title={groupe.module.toUpperCase()} style={{ height: '100%' }}>
                    <Space direction="vertical" size={10}>
                      {groupe.permissions.map((permDef) => (
                        <Checkbox
                          key={permDef.code}
                          checked={permDef.accorde}
                          onChange={(e) => toggle(permDef.id, e.target.checked)}
                        >
                          {permDef.label}
                        </Checkbox>
                      ))}
                    </Space>
                  </Card>
                </Col>
              ))}
            </Row>
          )}
        </Card>
      )}
    </div>
  );
};

export default Permission_user;
