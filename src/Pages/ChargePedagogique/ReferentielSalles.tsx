/* eslint-disable @typescript-eslint/no-explicit-any */
// Référentiel des salles physiques — prérequis de l'allocation des salles (§3.1).
//
// La page /Gestion_academique/Salles existait sans table ni contenu ; c'est ce référentiel
// qui l'alimente désormais. Pas de suppression : une salle ayant accueilli des cours garde
// son historique, on la désactive.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Modal, Form, Input, Select, InputNumber, message, Popconfirm, Tag } from 'antd';
import { PlusOutlined, EditOutlined, StopOutlined, CheckCircleOutlined } from '@ant-design/icons';
import PageHeader from '../../Components/PageHeader/PageHeader';
import PageContainer from '../../Components/ui/PageContainer';
import DataTable from '../../Components/ui/DataTable';
import StatusTag from '../../Components/ui/StatusTag';
import { apiFetch, ApiError } from '../../lib/api';
import { Salle, TYPE_SALLE, getUtilisateurCourant } from '../../lib/enseignants';

interface Site { id: number; nom: string }

const ReferentielSalles = () => {
  const utilisateur = getUtilisateurCourant();

  const [salles, setSalles] = useState<Salle[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [chargement, setChargement] = useState(false);
  const [recherche, setRecherche] = useState('');
  const [filtreStatut, setFiltreStatut] = useState('tous');
  const [modalOuvert, setModalOuvert] = useState(false);
  const [enEdition, setEnEdition] = useState<Salle | null>(null);
  const [enregistrement, setEnregistrement] = useState(false);
  const [form] = Form.useForm();

  const charger = useCallback(() => {
    setChargement(true);
    apiFetch<{ data: Salle[] }>('/api/salles')
      .then((res) => setSalles(res.data))
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) return;
        message.error('Erreur lors du chargement des salles.');
      })
      .finally(() => setChargement(false));
  }, []);

  useEffect(() => { charger(); }, [charger]);

  useEffect(() => {
    apiFetch<Site[]>('/api/sites')
      .then((data) => setSites(Array.isArray(data) ? data : []))
      .catch(() => { /* le sélecteur retombe sur le site de l'agent */ });
  }, []);

  const sallesFiltrees = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return salles.filter((s) => {
      const okStatut = filtreStatut === 'tous' || s.statut === filtreStatut;
      const okRecherche = !q
        || s.code.toLowerCase().includes(q)
        || s.nom.toLowerCase().includes(q)
        || (s.batiment ?? '').toLowerCase().includes(q)
        || (s.site_nom ?? '').toLowerCase().includes(q);
      return okStatut && okRecherche;
    });
  }, [salles, recherche, filtreStatut]);

  const ouvrirCreation = () => {
    setEnEdition(null);
    form.resetFields();
    form.setFieldsValue({ type_salle: 'cours', capacite: 30, site_id: utilisateur?.departement_id });
    setModalOuvert(true);
  };

  const ouvrirEdition = (salle: Salle) => {
    setEnEdition(salle);
    form.setFieldsValue(salle);
    setModalOuvert(true);
  };

  const enregistrer = async () => {
    try {
      const valeurs = await form.validateFields();
      setEnregistrement(true);
      if (enEdition) {
        await apiFetch(`/api/salles/${enEdition.id}`, { method: 'PUT', body: JSON.stringify(valeurs) });
        message.success('Salle mise à jour');
      } else {
        await apiFetch('/api/salles', { method: 'POST', body: JSON.stringify(valeurs) });
        message.success('Salle créée');
      }
      setModalOuvert(false);
      charger();
    } catch (e) {
      if (e instanceof ApiError) { message.error(e.message); return; }
      if ((e as any)?.errorFields) return;
      message.error("Erreur lors de l'enregistrement.");
    } finally {
      setEnregistrement(false);
    }
  };

  const basculerStatut = async (salle: Salle) => {
    const statut = salle.statut === 'actif' ? 'inactif' : 'actif';
    try {
      await apiFetch(`/api/salles/${salle.id}/statut`, { method: 'PATCH', body: JSON.stringify({ statut }) });
      message.success(statut === 'inactif' ? 'Salle désactivée' : 'Salle réactivée');
      charger();
    } catch (e) {
      if (e instanceof ApiError) { message.error(e.message); return; }
      message.error('Erreur lors du changement de statut.');
    }
  };

  const colonnes = [
    {
      title: 'Code', dataIndex: 'code',
      render: (v: string) => <Tag style={{ fontWeight: 600 }}>{v}</Tag>,
      sorter: (a: Salle, b: Salle) => a.code.localeCompare(b.code),
    },
    { title: 'Nom', dataIndex: 'nom' },
    { title: 'Site', dataIndex: 'site_nom', render: (v: string | null) => v || '—' },
    {
      title: 'Localisation',
      render: (_: any, r: Salle) => [r.batiment, r.etage].filter(Boolean).join(' · ') || '—',
    },
    {
      title: 'Type', dataIndex: 'type_salle',
      render: (v: string) => TYPE_SALLE[v] ?? v,
    },
    {
      title: 'Capacité', dataIndex: 'capacite', align: 'right' as const,
      render: (v: number) => `${v} places`,
      sorter: (a: Salle, b: Salle) => a.capacite - b.capacite,
    },
    {
      title: 'Statut', dataIndex: 'statut',
      render: (v: string) => <StatusTag tone={v === 'actif' ? 'success' : 'danger'} label={v === 'actif' ? 'Active' : 'Inactive'} />,
    },
    {
      title: 'Action',
      render: (_: any, r: Salle) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button size="small" icon={<EditOutlined />} onClick={() => ouvrirEdition(r)} />
          <Popconfirm
            title={r.statut === 'actif' ? 'Désactiver cette salle ?' : 'Réactiver cette salle ?'}
            description={r.statut === 'actif' ? "Elle ne sera plus proposée lors de l'allocation des salles." : undefined}
            onConfirm={() => basculerStatut(r)}
            okText="Confirmer"
            cancelText="Annuler"
          >
            <Button size="small" danger={r.statut === 'actif'} icon={r.statut === 'actif' ? <StopOutlined /> : <CheckCircleOutlined />} />
          </Popconfirm>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader />
      <PageContainer
        title="Référentiel des salles"
        description="Salles physiques disponibles pour l'affectation des cours."
      >
        <DataTable<Salle>
          columns={colonnes}
          dataSource={sallesFiltrees}
          rowKey="id"
          loading={chargement}
          searchValue={recherche}
          onSearchChange={setRecherche}
          searchPlaceholder="Rechercher par code, nom, bâtiment ou site"
          filters={
            <Select
              value={filtreStatut}
              onChange={setFiltreStatut}
              style={{ width: 160 }}
              options={[
                { value: 'tous', label: 'Toutes' },
                { value: 'actif', label: 'Actives' },
                { value: 'inactif', label: 'Inactives' },
              ]}
            />
          }
          toolbarExtra={
            <Button type="primary" icon={<PlusOutlined />} onClick={ouvrirCreation}>Nouvelle salle</Button>
          }
          emptyTitle="Aucune salle enregistrée"
          emptyDescription="Créez vos salles physiques : sans elles, aucun cours ne peut être localisé."
        />
      </PageContainer>

      <Modal
        title={enEdition ? 'Modifier la salle' : 'Nouvelle salle'}
        open={modalOuvert}
        onCancel={() => setModalOuvert(false)}
        onOk={enregistrer}
        okText="Enregistrer"
        cancelText="Annuler"
        confirmLoading={enregistrement}
      >
        <Form form={form} layout="vertical">
          <div style={{ display: 'flex', gap: 12 }}>
            <Form.Item name="code" label="Code" rules={[{ required: true, message: 'Code requis' }]} style={{ flex: 1 }}>
              <Input placeholder="Ex : A101" />
            </Form.Item>
            <Form.Item name="site_id" label="Site" rules={[{ required: true, message: 'Site requis' }]} style={{ flex: 2 }}>
              <Select options={sites.map((s) => ({ value: s.id, label: s.nom }))} placeholder="Sélectionnez un site" />
            </Form.Item>
          </div>
          <Form.Item name="nom" label="Nom" rules={[{ required: true, message: 'Nom requis' }]}>
            <Input placeholder="Ex : Salle informatique 1" />
          </Form.Item>
          <div style={{ display: 'flex', gap: 12 }}>
            <Form.Item name="batiment" label="Bâtiment" style={{ flex: 1 }}>
              <Input placeholder="Ex : Bâtiment A" />
            </Form.Item>
            <Form.Item name="etage" label="Étage" style={{ flex: 1 }}>
              <Input placeholder="Ex : RDC, 1er" />
            </Form.Item>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <Form.Item name="type_salle" label="Type" style={{ flex: 1 }}>
              <Select options={Object.entries(TYPE_SALLE).map(([value, label]) => ({ value, label }))} />
            </Form.Item>
            <Form.Item name="capacite" label="Capacité (places)" style={{ flex: 1 }}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </div>
          <Form.Item name="equipements" label="Équipements">
            <Input.TextArea rows={2} placeholder="Vidéoprojecteur, tableau interactif, postes informatiques…" />
          </Form.Item>
          <Form.Item name="observations" label="Observations">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ReferentielSalles;
