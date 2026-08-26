// Console d'administration — écran « Santé » (2026-08-26).
//
// CET ÉCRAN N'EST PAS POUR LE FONDATEUR. Il parle de crédits, de facturation et
// de replis : exactement ce que l'assistante s'applique à ne jamais dire, jusque
// sous la question directe. La route est fermée au rôle `fondateur` côté serveur
// comme côté navigateur.
//
// CE QU'IL MONTRE, ET CE QU'IL NE PEUT PAS MONTRER. Le journal recense les
// pannes, les recherches infructueuses et les impasses déclarées. Il ne voit pas
// le chiffre FAUX donné avec assurance : aucun signal ne l'accompagne. L'écran
// le dit noir sur blanc, sans quoi un compteur à zéro se lirait « aucune
// erreur » alors qu'il signifie « aucune erreur de cette nature ».
import { useCallback, useEffect, useState } from 'react';
import {
  Card, Row, Col, Button, Alert, Spin, Progress, Typography, Space, Modal,
  InputNumber, DatePicker, Input, Form, Empty, Tag, message,
} from 'antd';
import { PlusOutlined, BellOutlined, WarningOutlined } from '@ant-design/icons';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid,
} from 'recharts';
import dayjs from 'dayjs';
import { apiFetch } from '../../lib/api';
import { formatNombre } from '../../lib/montants';
import CadreConsole from './CadreConsole';
import './Console.css';

const { Text, Paragraph } = Typography;

type EtatVoyant = 'repond' | 'lent' | 'muet';

interface Voyant {
  nom: string;
  libelle: string;
  etat: EtatVoyant;
  duree_ms: number;
  motif: string | null;
}

interface Credits {
  configure: boolean;
  recharge_usd: number;
  consomme_usd: number;
  solde_usd: number;
  pourcentage: number;
  seuil_pourcentage: number;
  alerte: boolean;
  questions: number;
  cout_par_question_fcfa: number;
  questions_echantillon: number;
  questions_restantes: number | null;
}

interface Recharge {
  id: number;
  montant_usd: number;
  date_recharge: string;
  note: string | null;
  saisi_par: string | null;
}

interface Echec {
  id: number;
  canal: string;
  genre: string;
  genre_libelle: string;
  outil: string | null;
  question: string | null;
  detail: string | null;
  cree_le: string;
}

interface Sante {
  mesure_le: string;
  voyants: Voyant[] | null;
  dernier_incident: { genre: string; detail: string; cree_le: string } | null;
  credits: Credits | null;
  recharges: Recharge[] | null;
  usage_7_jours: { jour: string; canal: string; appels: number; cout_usd: number }[] | null;
  modeles: { role: string; libelle: string; appels: number; cout_usd: number }[] | null;
  echecs: Echec[] | null;
  retention_echecs_jours: number;
}

/** Un état de voyant, dit en toutes lettres autant qu'en couleur. */
const MOTS_ETAT: Record<EtatVoyant, { mot: string; classe: string }> = {
  repond: { mot: 'répond', classe: 'est-vert' },
  lent: { mot: 'lent', classe: 'est-orange' },
  muet: { mot: 'ne répond pas', classe: 'est-rouge' },
};

/** Les genres d'échec, avec la couleur de leur étiquette. */
const COULEUR_GENRE: Record<string, string> = {
  panne: 'red',
  repli: 'volcano',
  vide: 'gold',
  impasse: 'blue',
  introuvable: 'default',
  ambigu: 'default',
};

const usd = (v: number) => `${v.toFixed(2)} $`;

/** Un délai en millisecondes, dit comme on le lit : « 1,4 s » et non « 1389 ms ». */
function secondes(ms: number): string {
  return `${(ms / 1000).toFixed(1).replace('.', ',')} s`;
}

export default function ConsoleSante() {
  const [donnees, setDonnees] = useState<Sante | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [formRecharge] = Form.useForm();
  const [formSeuil] = Form.useForm();
  const [modaleRecharge, setModaleRecharge] = useState(false);
  const [modaleSeuil, setModaleSeuil] = useState(false);
  const [envoi, setEnvoi] = useState(false);

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      setDonnees(await apiFetch<Sante>('/api/assistant/console/sante'));
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "L'écran n'a pas pu être chargé.");
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => { void charger(); }, [charger]);

  const enregistrerRecharge = async (valeurs: any) => {
    setEnvoi(true);
    try {
      await apiFetch('/api/assistant/console/recharge', {
        method: 'POST',
        body: JSON.stringify({
          montant_usd: valeurs.montant_usd,
          date_recharge: valeurs.date_recharge ? valeurs.date_recharge.format('YYYY-MM-DD') : null,
          note: valeurs.note || null,
        }),
      });
      message.success('Recharge enregistrée.');
      setModaleRecharge(false);
      formRecharge.resetFields();
      await charger();
    } catch (e) {
      message.error(e instanceof Error ? e.message : "La recharge n'a pas pu être enregistrée.");
    } finally {
      setEnvoi(false);
    }
  };

  const enregistrerSeuil = async (valeurs: any) => {
    setEnvoi(true);
    try {
      await apiFetch('/api/assistant/console/seuil', {
        method: 'PUT',
        body: JSON.stringify({ seuil_pourcentage: valeurs.seuil_pourcentage }),
      });
      message.success('Seuil enregistré.');
      setModaleSeuil(false);
      await charger();
    } catch (e) {
      message.error(e instanceof Error ? e.message : "Le seuil n'a pas pu être enregistré.");
    } finally {
      setEnvoi(false);
    }
  };

  if (chargement && !donnees) {
    return (
      <CadreConsole courant="sante" onRafraichir={charger} chargement libelleRafraichir="Vérifier">
        <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>
      </CadreConsole>
    );
  }

  const c = donnees?.credits ?? null;

  /*
   * L'histogramme des sept jours : un bâton par jour, les deux canaux empilés.
   * Les jours sans appel sont créés explicitement — sans eux, recharts resserre
   * l'axe sur les seuls jours actifs et une interruption de trois jours devient
   * invisible, alors que c'est précisément ce qu'on veut voir.
   */
  const jours: { jour: string; ecrite: number; vocale: number }[] = [];
  for (let i = 6; i >= 0; i -= 1) {
    const j = dayjs().subtract(i, 'day');
    const cle = j.format('YYYY-MM-DD');
    const duJour = (donnees?.usage_7_jours || []).filter((u) => dayjs(u.jour).format('YYYY-MM-DD') === cle);
    jours.push({
      jour: j.format('DD/MM'),
      ecrite: duJour.filter((u) => u.canal === 'texte').reduce((s, u) => s + u.appels, 0),
      vocale: duJour.filter((u) => u.canal === 'vocal').reduce((s, u) => s + u.appels, 0),
    });
  }

  return (
    <CadreConsole
      courant="sante"
      fraicheur={donnees ? dayjs(donnees.mesure_le).format('HH:mm:ss') : null}
      onRafraichir={charger}
      chargement={chargement}
      libelleRafraichir="Vérifier maintenant"
    >
      {erreur && <Alert type="error" showIcon message={erreur} style={{ marginBottom: 16 }} />}

      {c?.alerte && (
        <Alert
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          message={`Seuil dépassé — ${c.pourcentage} % du montant rechargé est consommé`}
          description={`L'alerte est réglée à ${c.seuil_pourcentage} %. Il reste environ ${usd(c.solde_usd)}.`}
          style={{ marginBottom: 16 }}
        />
      )}

      <Row gutter={[16, 16]}>
        {/* ── Ce qui doit répondre ─────────────────────────────────────────── */}
        <Col xs={24} lg={12}>
          <Card title="Ce qui doit répondre" size="small">
            {donnees?.voyants ? donnees.voyants.map((v) => {
              const mot = MOTS_ETAT[v.etat] || MOTS_ETAT.muet;
              return (
                <div key={v.nom} className="console-voyant">
                  <span className={`console-pastille ${mot.classe}`} aria-hidden />
                  <span className="console-voyant-nom">
                    <Text strong>{v.libelle}</Text>
                    {v.motif && <div className="console-echec-detail">{v.motif}</div>}
                  </span>
                  <span className="console-voyant-mesure">
                    {mot.mot}{v.etat !== 'muet' && ` en ${secondes(v.duree_ms)}`}
                  </span>
                </div>
              );
            }) : <Text type="secondary">Vérification indisponible.</Text>}

            <Paragraph className="console-reserve" style={{ marginTop: 12 }}>
              {donnees?.dernier_incident
                ? `Dernier incident : ${dayjs(donnees.dernier_incident.cree_le).format('D MMMM, HH:mm')} — ${donnees.dernier_incident.detail}`
                : 'Aucun incident enregistré.'}
            </Paragraph>
          </Card>
        </Col>

        {/* ── Crédits et consommation ──────────────────────────────────────── */}
        <Col xs={24} lg={12}>
          <Card
            title="Crédits et consommation"
            size="small"
            extra={(
              <Space>
                <Button size="small" icon={<PlusOutlined />} onClick={() => setModaleRecharge(true)}>
                  Recharge
                </Button>
                <Button
                  size="small"
                  icon={<BellOutlined />}
                  onClick={() => {
                    formSeuil.setFieldsValue({ seuil_pourcentage: c?.seuil_pourcentage ?? 80 });
                    setModaleSeuil(true);
                  }}
                >
                  Seuil
                </Button>
              </Space>
            )}
          >
            {!c ? <Text type="secondary">Lecture indisponible.</Text> : !c.configure ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={(
                  <span>
                    Aucune recharge saisie. Le solde ne peut pas être estimé tant que
                    le montant mis sur le compte n'est pas déclaré.
                  </span>
                )}
              />
            ) : (
              <>
                <div className="console-ligne-montant">
                  <Text>Rechargé au total</Text>
                  <Text className="console-montant">{usd(c.recharge_usd)}</Text>
                </div>
                <div className="console-ligne-montant">
                  <Text>Consommé depuis</Text>
                  <Text className="console-montant">{usd(c.consomme_usd)}</Text>
                </div>
                <div className="console-ligne-montant est-total">
                  <Text>Solde estimé</Text>
                  <Text className="console-montant" type={c.solde_usd < 0 ? 'danger' : undefined}>
                    {usd(c.solde_usd)}
                  </Text>
                </div>

                <Progress
                  percent={Math.min(c.pourcentage, 100)}
                  status={c.alerte ? 'exception' : 'normal'}
                  format={() => `${c.pourcentage} %`}
                  style={{ marginTop: 8 }}
                />

                <div className="console-ligne-montant" style={{ marginTop: 8 }}>
                  <Text>Une question coûte en moyenne</Text>
                  <Text strong>{formatNombre(c.cout_par_question_fcfa)} FCFA</Text>
                </div>
                <div className="console-ligne-montant">
                  <Text>À ce rythme, il reste</Text>
                  <Text strong>
                    {c.questions_restantes === null ? '—' : `${formatNombre(c.questions_restantes)} questions`}
                  </Text>
                </div>

                <Paragraph className="console-reserve">
                  Moyenne établie sur {formatNombre(c.questions_echantillon)} questions.
                  Le solde est une <strong>estimation</strong> : il est déduit de ce qui a été
                  déclaré moins ce qui a été mesuré, avec une table de tarifs relevée le
                  12 août. C'est un ordre de grandeur pour décider quand recharger, jamais
                  un relevé de compte.
                </Paragraph>
              </>
            )}
          </Card>
        </Col>

        {/* ── Usage des sept derniers jours ────────────────────────────────── */}
        <Col xs={24} lg={12}>
          <Card title="Usage des 7 derniers jours" size="small">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={jours}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="jour" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="ecrite" name="À l'écrit" stackId="a" fill="#2b5fd9" />
                <Bar dataKey="vocale" name="À la voix" stackId="a" fill="#0c8cb2" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        {/* ── Ce qui a servi à répondre ────────────────────────────────────── */}
        <Col xs={24} lg={12}>
          <Card title="Ce qui a servi à répondre" size="small">
            {(donnees?.modeles || []).map((m) => (
              <div key={m.role} className="console-ligne-montant">
                <Text>{m.libelle}</Text>
                <Space>
                  <Text type="secondary">{usd(m.cout_usd)}</Text>
                  <Text strong>{formatNombre(m.appels)} appels</Text>
                </Space>
              </div>
            ))}
            {(donnees?.modeles || []).some((m) => m.role === 'secours') && (
              <Alert
                type="warning"
                showIcon
                style={{ marginTop: 12 }}
                message="Un modèle de secours a répondu"
                description="Le modèle de tête a été épuisé ou indisponible. Vérifier le solde de crédits."
              />
            )}
          </Card>
        </Col>

        {/* ── Le journal des échecs ────────────────────────────────────────── */}
        <Col xs={24}>
          <Card
            title="Quand l'assistante n'a pas su répondre"
            size="small"
            extra={<Text type="secondary">conservés {donnees?.retention_echecs_jours ?? 10} jours</Text>}
          >
            {(donnees?.echecs || []).length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Aucun échec enregistré." />
            ) : (donnees?.echecs || []).map((e) => (
              <div key={e.id} className="console-echec">
                <Space size={8} wrap>
                  <Text type="secondary">{dayjs(e.cree_le).format('D MMM, HH:mm')}</Text>
                  <Text type="secondary">{e.canal === 'vocal' ? 'à la voix' : "à l'écrit"}</Text>
                  <Tag color={COULEUR_GENRE[e.genre] || 'default'}>{e.genre_libelle}</Tag>
                </Space>
                {e.question && <div className="console-echec-question">« {e.question} »</div>}
                {e.detail && <div className="console-echec-detail">→ {e.detail}</div>}
              </div>
            ))}

            <Paragraph className="console-reserve">
              Ce journal montre les pannes, les recherches sans résultat et les cas où
              l'assistante a elle-même signalé une impasse. Il ne montre <strong>pas</strong> un
              chiffre faux donné avec assurance : rien n'accompagne cette erreur-là, et
              elle reste hors de portée. Un journal vide signifie donc « aucune erreur de
              cette nature », et non « aucune erreur ».
            </Paragraph>
          </Card>
        </Col>

        {/* ── Les recharges déclarées ──────────────────────────────────────── */}
        <Col xs={24}>
          <Card title="Recharges enregistrées" size="small">
            {(donnees?.recharges || []).length === 0 ? (
              <Text type="secondary">Aucune recharge saisie.</Text>
            ) : (donnees?.recharges || []).map((r) => (
              <div key={r.id} className="console-ligne-montant">
                <Space>
                  <Text>{dayjs(r.date_recharge).format('D MMMM YYYY')}</Text>
                  {r.note && <Text type="secondary">{r.note}</Text>}
                </Space>
                <Space>
                  <Text type="secondary">{r.saisi_par || '—'}</Text>
                  <Text strong>{usd(r.montant_usd)}</Text>
                </Space>
              </div>
            ))}
            <Paragraph className="console-reserve">
              Le total consommé est calculé depuis la <strong>première</strong> recharge, et non
              depuis l'origine du projet : avant elle, rien n'était facturé.
            </Paragraph>
          </Card>
        </Col>
      </Row>

      <Modal
        title="Enregistrer une recharge"
        open={modaleRecharge}
        onCancel={() => setModaleRecharge(false)}
        onOk={() => formRecharge.submit()}
        confirmLoading={envoi}
        okText="Enregistrer"
        cancelText="Annuler"
      >
        <Form form={formRecharge} layout="vertical" onFinish={enregistrerRecharge}>
          <Form.Item
            name="montant_usd"
            label="Montant rechargé, en dollars"
            rules={[{ required: true, message: 'Indiquez le montant rechargé.' }]}
            extra="En dollars, l'unité dans laquelle le compte est facturé."
          >
            <InputNumber min={0.01} step={1} style={{ width: '100%' }} addonAfter="$" />
          </Form.Item>
          <Form.Item name="date_recharge" label="Date de la recharge" extra="Par défaut, aujourd'hui.">
            <DatePicker
              style={{ width: '100%' }}
              format="DD/MM/YYYY"
              disabledDate={(d) => d && d.isAfter(dayjs(), 'day')}
            />
          </Form.Item>
          <Form.Item name="note" label="Note">
            <Input placeholder="Facultatif — référence, moyen de paiement…" maxLength={300} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Régler le seuil d'alerte"
        open={modaleSeuil}
        onCancel={() => setModaleSeuil(false)}
        onOk={() => formSeuil.submit()}
        confirmLoading={envoi}
        okText="Enregistrer"
        cancelText="Annuler"
      >
        <Form form={formSeuil} layout="vertical" onFinish={enregistrerSeuil}>
          <Form.Item
            name="seuil_pourcentage"
            label="Prévenir à partir de"
            rules={[{ required: true, message: 'Indiquez un pourcentage.' }]}
            extra="En pourcentage du montant rechargé. L'alerte s'affiche ici, jamais dans l'assistante."
          >
            <InputNumber min={1} max={100} style={{ width: '100%' }} addonAfter="%" />
          </Form.Item>
        </Form>
      </Modal>
    </CadreConsole>
  );
}
