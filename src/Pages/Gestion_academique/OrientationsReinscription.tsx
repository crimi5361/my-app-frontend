/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react';
import { Button, Drawer, Form, Select, Space, Popconfirm, notification, Tag, Typography } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import PageHeader from '../../Components/PageHeader/PageHeader';
import PageContainer from '../../Components/ui/PageContainer';
import DataTable from '../../Components/ui/DataTable';
import { apiFetch, ApiError } from '../../lib/api';

const { Option } = Select;
const { Text } = Typography;

// ✅ Chantier "Orientations de réinscription LICENCE 2 PRO → LICENCE 3 PRO" (2026-08-29) — écran
// ADMIN uniquement. Ne fait qu'afficher/saisir : aucune règle métier ni orientation n'est déduite
// ici, tout est explicitement configuré par l'administrateur puis lu tel quel par la réinscription
// (agent + portail public, via resoudreOrientationsNiveau côté backend).

interface AnneeAcademique {
  id: number;
  annee: string;
}

interface NiveauCandidat {
  niveau_id: number;
  libelle: string;
  anneeacademique_id: number;
  annee: string;
  filiere_id: number;
  filiere_nom: string;
  filiere_sigle: string;
}

interface OrientationRow {
  id: number;
  niveau_origine_id: number;
  niveau_destination_id: number;
  created_at: string;
  origine_niveau_libelle: string;
  origine_annee_id: number;
  origine_annee: string;
  origine_filiere_nom: string;
  origine_filiere_sigle: string;
  destination_niveau_libelle: string;
  destination_annee_id: number;
  destination_annee: string;
  destination_filiere_nom: string;
  destination_filiere_sigle: string;
  cree_par_nom: string | null;
}

const OrientationsReinscription = () => {
  const [annees, setAnnees] = useState<AnneeAcademique[]>([]);
  const [anneeFiltre, setAnneeFiltre] = useState<number | null>(null);
  const [orientations, setOrientations] = useState<OrientationRow[]>([]);
  const [niveauxOrigine, setNiveauxOrigine] = useState<NiveauCandidat[]>([]);
  const [niveauxDestination, setNiveauxDestination] = useState<NiveauCandidat[]>([]);
  const [loading, setLoading] = useState(false);
  const [drawerOuvert, setDrawerOuvert] = useState(false);
  const [ligneEnEdition, setLigneEnEdition] = useState<OrientationRow | null>(null);
  const [enregistrement, setEnregistrement] = useState(false);
  const [form] = Form.useForm();

  const fetchAnnees = async () => {
    try {
      const data: AnneeAcademique[] = await apiFetch('/api/annees');
      setAnnees(data);
      if (!anneeFiltre && data.length > 0) {
        const enCours = data.find((a: any) => a.etat === 'en cour' || a.etat === 'en cours');
        setAnneeFiltre(enCours ? enCours.id : data[0].id);
      }
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 401)) {
        notification.error({ message: 'Impossible de charger les années académiques.' });
      }
    }
  };

  const fetchOrientations = async () => {
    setLoading(true);
    try {
      const res: { data: OrientationRow[] } = await apiFetch('/api/orientations-reinscription');
      setOrientations(res.data);
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 401)) {
        notification.error({ message: 'Impossible de charger les orientations.' });
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchNiveauxCandidats = async (anneeId: number | null) => {
    const suffixe = anneeId ? `?anneeId=${anneeId}` : '';
    try {
      const [origine, destination] = await Promise.all([
        apiFetch<{ data: NiveauCandidat[] }>(`/api/orientations-reinscription/niveaux-origine${suffixe}`),
        apiFetch<{ data: NiveauCandidat[] }>(`/api/orientations-reinscription/niveaux-destination${suffixe}`),
      ]);
      setNiveauxOrigine(origine.data);
      setNiveauxDestination(destination.data);
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 401)) {
        notification.error({ message: 'Impossible de charger les niveaux LICENCE 2 PRO / LICENCE 3 PRO.' });
      }
    }
  };

  useEffect(() => { fetchAnnees(); fetchOrientations(); }, []);
  useEffect(() => { fetchNiveauxCandidats(anneeFiltre); }, [anneeFiltre]);

  const ouvrirCreation = () => {
    setLigneEnEdition(null);
    form.resetFields();
    setDrawerOuvert(true);
  };

  const ouvrirEdition = (ligne: OrientationRow) => {
    setLigneEnEdition(ligne);
    form.setFieldsValue({
      niveau_origine_id: ligne.niveau_origine_id,
      niveau_destination_ids: [ligne.niveau_destination_id],
    });
    setDrawerOuvert(true);
  };

  const supprimer = async (id: number) => {
    try {
      await apiFetch(`/api/orientations-reinscription/${id}`, { method: 'DELETE' });
      notification.success({ message: 'Orientation supprimée.' });
      fetchOrientations();
    } catch (e: any) {
      notification.error({ message: e?.message || 'Suppression impossible.' });
    }
  };

  const enregistrer = async () => {
    try {
      const values = await form.validateFields();
      setEnregistrement(true);

      if (ligneEnEdition) {
        // ✅ Modification : une seule destination (le formulaire d'édition n'accepte qu'un choix).
        const destinationId = values.niveau_destination_ids[0];
        await apiFetch(`/api/orientations-reinscription/${ligneEnEdition.id}`, {
          method: 'PUT',
          body: JSON.stringify({ niveau_origine_id: values.niveau_origine_id, niveau_destination_id: destinationId }),
        });
        notification.success({ message: 'Orientation modifiée.' });
      } else {
        // ✅ Création : plusieurs destinations à la fois pour une même origine (ex. AD → ADAF + MAM
        // en une seule saisie) — une requête POST par destination sélectionnée.
        const destinations: number[] = values.niveau_destination_ids || [];
        const resultats = await Promise.allSettled(
          destinations.map((destinationId) =>
            apiFetch('/api/orientations-reinscription', {
              method: 'POST',
              body: JSON.stringify({ niveau_origine_id: values.niveau_origine_id, niveau_destination_id: destinationId }),
            })
          )
        );
        const echecs = resultats.filter((r) => r.status === 'rejected');
        if (echecs.length > 0) {
          notification.warning({
            message: `${destinations.length - echecs.length}/${destinations.length} orientation(s) créée(s)`,
            description: 'Certaines existaient peut-être déjà.',
          });
        } else {
          notification.success({ message: `${destinations.length} orientation(s) créée(s).` });
        }
      }

      setDrawerOuvert(false);
      fetchOrientations();
    } catch (e: any) {
      if (e?.errorFields) return; // erreurs de validation antd, déjà affichées sous les champs
      notification.error({ message: e?.message || 'Enregistrement impossible.' });
    } finally {
      setEnregistrement(false);
    }
  };

  const columns = [
    {
      title: 'Origine',
      key: 'origine',
      render: (_: any, r: OrientationRow) => (
        <div>
          <Text strong>{r.origine_filiere_sigle}</Text>
          <div><Text type="secondary" style={{ fontSize: 12 }}>{r.origine_niveau_libelle} — {r.origine_annee}</Text></div>
        </div>
      ),
    },
    {
      title: 'Destination',
      key: 'destination',
      render: (_: any, r: OrientationRow) => (
        <div>
          <Tag color="blue">{r.destination_filiere_sigle}</Tag>
          <div><Text type="secondary" style={{ fontSize: 12 }}>{r.destination_niveau_libelle} — {r.destination_annee}</Text></div>
        </div>
      ),
    },
    {
      title: 'Créée par',
      dataIndex: 'cree_par_nom',
      render: (v: string | null) => v || <Text type="secondary">—</Text>,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, r: OrientationRow) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => ouvrirEdition(r)}>Modifier</Button>
          <Popconfirm title="Supprimer cette orientation ?" onConfirm={() => supprimer(r.id)} okText="Supprimer" cancelText="Annuler">
            <Button size="small" danger icon={<DeleteOutlined />}>Supprimer</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const libelleNiveau = (n: NiveauCandidat) => `${n.filiere_sigle} — ${n.libelle} (${n.annee})`;

  return (
    <div>
      <PageHeader />
      <PageContainer
        title="Orientations de réinscription"
        description="Configure, pour une LICENCE 2 PRO qui n'a volontairement pas de LICENCE 3 PRO portant le même nom, la ou les filières de destination réellement autorisées."
        actions={
          <Space>
            <Select
              style={{ width: 200 }}
              placeholder="Année académique"
              value={anneeFiltre}
              onChange={setAnneeFiltre}
              allowClear
            >
              {annees.map((a) => <Option key={a.id} value={a.id}>{a.annee}</Option>)}
            </Select>
            <Button type="primary" icon={<PlusOutlined />} onClick={ouvrirCreation}>
              Ajouter une orientation
            </Button>
          </Space>
        }
      >
        <DataTable
          columns={columns}
          dataSource={orientations.filter((o) => !anneeFiltre || o.origine_annee_id === anneeFiltre)}
          rowKey="id"
          loading={loading}
          emptyTitle="Aucune orientation configurée"
          emptyDescription="Ajoutez une orientation pour permettre la réinscription des étudiants d'une filière sans LICENCE 3 PRO propre."
        />
      </PageContainer>

      <Drawer
        title={ligneEnEdition ? 'Modifier une orientation' : 'Ajouter une ou plusieurs orientations'}
        open={drawerOuvert}
        onClose={() => setDrawerOuvert(false)}
        width={480}
        extra={
          <Button type="primary" loading={enregistrement} onClick={enregistrer}>
            Enregistrer
          </Button>
        }
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="niveau_origine_id"
            label="Filière / Niveau d'origine"
            rules={[{ required: true, message: "Sélectionnez l'origine." }]}
            extra="Seuls les niveaux LICENCE 2 PRO réellement configurés sont proposés."
          >
            <Select showSearch optionFilterProp="children" placeholder="Choisir la LICENCE 2 PRO d'origine">
              {niveauxOrigine.map((n) => (
                <Option key={n.niveau_id} value={n.niveau_id}>{libelleNiveau(n)}</Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="niveau_destination_ids"
            label="Filière(s) / Niveau(x) de destination"
            rules={[{ required: true, message: 'Sélectionnez au moins une destination.' }]}
            extra="Seuls les niveaux LICENCE 3 PRO réellement configurés sont proposés — impossible de sélectionner un niveau inexistant."
          >
            <Select
              mode={ligneEnEdition ? undefined : 'multiple'}
              showSearch
              optionFilterProp="children"
              placeholder="Choisir une ou plusieurs LICENCE 3 PRO de destination"
            >
              {niveauxDestination.map((n) => (
                <Option key={n.niveau_id} value={n.niveau_id}>{libelleNiveau(n)}</Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  );
};

export default OrientationsReinscription;
