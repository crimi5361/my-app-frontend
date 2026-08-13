/* eslint-disable @typescript-eslint/no-explicit-any */
// Espace RH — rattachement des Chargés Pédagogiques à leurs filières (§3.1
// « Gestion des affectations », règle §4 « Périmètre d'action CP »).
//
// Sans affectation, un Chargé Pédagogique se connecte sur un espace vide : c'est cet écran
// qui ouvre son périmètre. Il vit côté RH parce que le CP ne doit pas pouvoir élargir
// lui-même son propre champ d'action.
import { useCallback, useEffect, useState } from 'react';
import { Button, Modal, Form, Select, message, Tag, Alert, Popconfirm, Empty, Spin } from 'antd';
import { PlusOutlined, DeleteOutlined, UserOutlined } from '@ant-design/icons';
import PageHeader from '../../Components/PageHeader/PageHeader';
import PageContainer from '../../Components/ui/PageContainer';
import Card from '../../Components/ui/Card';
import { apiFetch, ApiError } from '../../lib/api';
import { ChargePedagogique } from '../../lib/enseignants';

interface Filiere { id: number; nom: string; sigle: string | null }
interface NiveauCatalogue { id: number; libelle: string }

const ChargesPedagogiques = () => {
  const [charges, setCharges] = useState<ChargePedagogique[]>([]);
  const [filieres, setFilieres] = useState<Filiere[]>([]);
  const [niveaux, setNiveaux] = useState<NiveauCatalogue[]>([]);
  const [chargement, setChargement] = useState(false);
  const [modalOuvert, setModalOuvert] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [form] = Form.useForm();

  const filiereChoisie = Form.useWatch('filiere_id', form);

  const charger = useCallback(() => {
    setChargement(true);
    apiFetch<{ data: ChargePedagogique[] }>('/api/rh/charges-pedagogiques')
      .then((res) => setCharges(res.data))
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) return;
        message.error('Erreur lors du chargement des Chargés Pédagogiques.');
      })
      .finally(() => setChargement(false));
  }, []);

  useEffect(() => { charger(); }, [charger]);

  useEffect(() => {
    apiFetch<Filiere[]>('/api/filieres')
      .then((d) => setFilieres(Array.isArray(d) ? d : []))
      .catch(() => setFilieres([]));
  }, []);

  // Les niveaux dépendent de la filière : proposer le catalogue complet ferait choisir un
  // niveau qui n'existe pas dans cette filière. Les doublons de libellé (un niveau par
  // année académique) sont réduits ici — l'affectation porte sur le niveau, pas sur l'année.
  useEffect(() => {
    if (!filiereChoisie) { setNiveaux([]); return; }
    apiFetch<NiveauCatalogue[]>(`/api/niveaux/${filiereChoisie}`)
      .then((liste) => {
        const parLibelle = new Map<string, NiveauCatalogue>();
        (Array.isArray(liste) ? liste : []).forEach((n) => {
          if (!parLibelle.has(n.libelle)) parLibelle.set(n.libelle, n);
        });
        setNiveaux([...parLibelle.values()]);
      })
      .catch(() => setNiveaux([]));
  }, [filiereChoisie]);

  const ouvrirAffectation = (utilisateurId: number) => {
    form.resetFields();
    form.setFieldsValue({ utilisateur_id: utilisateurId });
    setModalOuvert(true);
  };

  const affecter = async () => {
    try {
      const v = await form.validateFields();
      setEnvoi(true);
      await apiFetch('/api/rh/charges-pedagogiques/affectations', {
        method: 'POST', body: JSON.stringify(v),
      });
      message.success('Affectation enregistrée');
      setModalOuvert(false);
      charger();
    } catch (e) {
      if (e instanceof ApiError) { message.error(e.message); return; }
      if ((e as any)?.errorFields) return;
      message.error("Erreur lors de l'affectation.");
    } finally {
      setEnvoi(false);
    }
  };

  const retirer = async (affectationId: number) => {
    try {
      await apiFetch(`/api/rh/charges-pedagogiques/affectations/${affectationId}`, { method: 'DELETE' });
      message.success('Affectation retirée');
      charger();
    } catch (e) {
      if (e instanceof ApiError) { message.error(e.message); return; }
      message.error('Erreur lors du retrait.');
    }
  };

  return (
    <div>
      <PageHeader />
      <PageContainer
        title="Affectation des Chargés Pédagogiques"
        description="Chaque Chargé Pédagogique ne voit et ne gère que les filières qui lui sont rattachées."
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 20 }}
          message="Comment créer un Chargé Pédagogique"
          description="Le compte se crée depuis Paramètres › Gestion utilisateurs, avec le rôle « charge_pedagogique ». Il apparaît ensuite ici pour recevoir son périmètre."
        />

        {chargement ? (
          <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
        ) : charges.length === 0 ? (
          <Card><Empty description="Aucun compte au rôle « Chargé Pédagogique » pour l'instant." /></Card>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
            {charges.map((cp) => (
              <Card
                key={cp.id}
                title={<><UserOutlined /> {cp.nom}</>}
                extra={
                  <Button size="small" type="primary" icon={<PlusOutlined />} onClick={() => ouvrirAffectation(cp.id)}>
                    Affecter
                  </Button>
                }
              >
                <div style={{ fontSize: 12, color: 'var(--text-soft)', marginBottom: 12 }}>
                  {cp.email}{cp.site_nom ? ` · ${cp.site_nom}` : ''}
                  {cp.statut !== 'active' && <Tag color="red" style={{ marginLeft: 8 }}>Compte inactif</Tag>}
                </div>

                {cp.affectations.length === 0 ? (
                  <Alert
                    type="warning"
                    showIcon
                    message="Aucun périmètre"
                    description="Son espace est vide tant qu'aucune filière ne lui est rattachée."
                  />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {cp.affectations.map((a) => (
                      <div
                        key={a.id}
                        style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600 }}>{a.filiere}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>
                            {a.niveau ?? 'Toute la filière'}
                          </div>
                        </div>
                        <Popconfirm
                          title="Retirer cette affectation ?"
                          description="Le Chargé Pédagogique perdra l'accès à cette filière."
                          onConfirm={() => retirer(a.id)}
                          okText="Retirer"
                          cancelText="Annuler"
                        >
                          <Button size="small" danger icon={<DeleteOutlined />} />
                        </Popconfirm>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </PageContainer>

      <Modal
        title="Nouvelle affectation"
        open={modalOuvert}
        onCancel={() => setModalOuvert(false)}
        onOk={affecter}
        okText="Affecter"
        cancelText="Annuler"
        confirmLoading={envoi}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="utilisateur_id" hidden><input /></Form.Item>
          <Form.Item name="filiere_id" label="Filière" rules={[{ required: true, message: 'Filière requise' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Sélectionnez une filière"
              options={filieres.map((f) => ({ value: f.id, label: f.sigle ? `${f.nom} (${f.sigle})` : f.nom }))}
            />
          </Form.Item>
          <Form.Item
            name="niveau_id"
            label="Niveau"
            extra="Laissez vide pour confier toute la filière (tous niveaux confondus)."
          >
            <Select
              allowClear
              placeholder="Toute la filière"
              options={niveaux.map((n) => ({ value: n.id, label: n.libelle }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ChargesPedagogiques;
