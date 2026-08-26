// Console d'administration — écran « Ce que l'assistante peut lire » (2026-08-26).
//
// AUCUN MOT DE BASE DE DONNÉES À L'ÉCRAN. Ni vue, ni reflet, ni jointure, ni
// schéma. On dit : une donnée, un sujet, ce que l'assistante peut lire,
// cloisonnement par site, lignes sans rattachement. L'administrateur gère un
// établissement, pas un catalogue PostgreSQL.
//
// LA QUESTION À LAQUELLE CET ÉCRAN RÉPOND n'est pas « qu'y a-t-il dans la
// base » mais « qu'est-ce que l'assistante en voit ». L'écart entre les deux est
// l'endroit exact où naissent les réponses fausses.
//
// LE PANNEAU QUI JUSTIFIE L'ÉCRAN est celui des sujets à vérifier. C'est là que
// le cas des 115 professeurs devient visible : un sujet VIDE dont le nom
// recouvre un sujet PEUPLÉ. L'assistante ne manquait pas de droits — elle
// cherchait « enseignants », tombait sur un sujet vide portant ce nom, et
// concluait qu'il n'y en avait aucun.
import { useCallback, useEffect, useState } from 'react';
import {
  Card, Row, Col, Button, Alert, Spin, Table, Typography, Space, Radio, Tag,
  Modal, Statistic, Empty,
} from 'antd';
import { EyeOutlined, WarningOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { apiFetch } from '../../lib/api';
import { formatNombre } from '../../lib/montants';
import CadreConsole from './CadreConsole';
import './Console.css';

const { Text, Paragraph } = Typography;

interface Sujet {
  vue: string;
  libelle: string;
  dans_la_base: number | null;
  lu_par_assistante: number;
  ecart: number | null;
  vide: boolean;
}

interface AVerifier {
  vide: string;
  vide_libelle: string;
  peuple: string;
  peuple_libelle: string;
  lignes: number;
  mots: string | null;
  origine: 'declare' | 'detecte';
}

interface Couverture {
  mesure_le: string;
  total: number;
  lus_en_entier: number;
  lus_en_partie: number;
  sujets: Sujet[];
  ecarts: Sujet[];
  vides: Sujet[];
  a_verifier: AVerifier[];
}

interface Echantillon {
  vue: string;
  libelle: string;
  total_exact: number;
  colonnes: string[];
  lignes: Record<string, unknown>[];
}

type Filtre = 'tout' | 'ecarts' | 'verifier' | 'vides';

/**
 * Pourquoi l'assistante lit moins que ce que la base contient.
 *
 * On ne prétend pas connaître la cause exacte de chaque ligne manquante : on
 * énonce ce que l'écart PEUT recouvrir, et on laisse l'administrateur ouvrir le
 * détail. Affirmer « 2 579 documents ne sont rattachés à aucun étudiant » sans
 * l'avoir vérifié ligne à ligne serait une déduction présentée comme un fait.
 */
function raisonEcart(s: Sujet): string {
  if (s.ecart === null) return '—';
  if (s.ecart <= 0) return 'Lue en entier';
  const part = s.dans_la_base ? Math.round((s.ecart / s.dans_la_base) * 100) : 0;
  return `${formatNombre(s.ecart)} ligne${s.ecart > 1 ? 's' : ''} hors de portée (${part} %) — `
    + 'autre site, ou sans rattachement';
}

export default function ConsoleDonnees() {
  const [donnees, setDonnees] = useState<Couverture | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [filtre, setFiltre] = useState<Filtre>('ecarts');
  const [echantillon, setEchantillon] = useState<Echantillon | null>(null);
  const [chargementEchantillon, setChargementEchantillon] = useState(false);

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      setDonnees(await apiFetch<Couverture>('/api/assistant/console/couverture'));
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "L'écran n'a pas pu être chargé.");
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => { void charger(); }, [charger]);

  const ouvrirEchantillon = async (vue: string) => {
    setChargementEchantillon(true);
    setEchantillon(null);
    try {
      setEchantillon(await apiFetch<Echantillon>(`/api/assistant/console/couverture/${vue}`));
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Le détail n'a pas pu être lu.");
    } finally {
      setChargementEchantillon(false);
    }
  };

  if (chargement && !donnees) {
    return (
      <CadreConsole courant="donnees" onRafraichir={charger} chargement libelleRafraichir="Mesurer">
        <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>
      </CadreConsole>
    );
  }

  const lignes: Sujet[] = !donnees ? [] : (
    filtre === 'ecarts' ? donnees.ecarts
      : filtre === 'vides' ? donnees.vides
        : filtre === 'verifier'
          ? donnees.sujets.filter((s) => donnees.a_verifier.some((a) => a.vide === s.vue))
          : donnees.sujets
  );

  const colonnes = [
    {
      title: 'Donnée',
      dataIndex: 'libelle',
      key: 'libelle',
      render: (v: string, s: Sujet) => (
        <Space>
          <Text strong>{v}</Text>
          {s.vide && <Tag>vide</Tag>}
        </Space>
      ),
    },
    {
      title: 'Dans la base',
      dataIndex: 'dans_la_base',
      key: 'dans_la_base',
      align: 'right' as const,
      render: (v: number | null) => (v === null ? '—' : formatNombre(v)),
    },
    {
      title: "Lue par l'assistante",
      dataIndex: 'lu_par_assistante',
      key: 'lu',
      align: 'right' as const,
      render: (v: number) => formatNombre(v),
    },
    {
      title: "Pourquoi l'écart",
      key: 'ecart',
      render: (_: unknown, s: Sujet) => <Text type="secondary">{raisonEcart(s)}</Text>,
    },
    {
      title: '',
      key: 'actions',
      align: 'right' as const,
      render: (_: unknown, s: Sujet) => (
        <Button size="small" icon={<EyeOutlined />} onClick={() => ouvrirEchantillon(s.vue)}>
          Ouvrir
        </Button>
      ),
    },
  ];

  return (
    <CadreConsole
      courant="donnees"
      fraicheur={donnees ? dayjs(donnees.mesure_le).format('HH:mm:ss') : null}
      onRafraichir={charger}
      chargement={chargement}
      libelleRafraichir="Mesurer à nouveau"
    >
      {erreur && <Alert type="error" showIcon message={erreur} style={{ marginBottom: 16 }} />}

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}>
          <Card size="small"><Statistic title="Données au total" value={donnees?.total ?? 0} /></Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small"><Statistic title="Lues en entier" value={donnees?.lus_en_entier ?? 0} /></Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small"><Statistic title="Lues en partie" value={donnees?.lus_en_partie ?? 0} /></Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic
              title="À vérifier"
              value={donnees?.a_verifier.length ?? 0}
              valueStyle={donnees?.a_verifier.length ? { color: '#cf1322' } : undefined}
            />
          </Card>
        </Col>
      </Row>

      {/* ── Le cœur de l'écran ───────────────────────────────────────────────
          Un sujet vide dont le nom recouvre un sujet peuplé. C'est le seul
          panneau qui appelle une action, et il est donc au-dessus du tableau. */}
      {donnees && donnees.a_verifier.length > 0 && (
        <Card
          size="small"
          style={{ marginBottom: 16 }}
          title={(
            <Space>
              <WarningOutlined style={{ color: '#cf1322' }} />
              <span>
                {donnees.a_verifier.length} sujet{donnees.a_verifier.length > 1 ? 's' : ''} où
                l'assistante pourrait répondre « il n'y en a pas » alors que la donnée existe ailleurs
              </span>
            </Space>
          )}
        >
          {donnees.a_verifier.map((a) => (
            <div key={a.vide} className="console-echec">
              <Space wrap>
                <Text strong>{a.vide_libelle}</Text>
                <Tag>0 ligne</Tag>
                <Text type="secondary">→ la donnée se trouve dans</Text>
                <Text strong>{a.peuple_libelle}</Text>
                <Tag color="green">{formatNombre(a.lignes)} lignes</Tag>
                <Tag color={a.origine === 'declare' ? 'blue' : 'purple'}>
                  {a.origine === 'declare' ? 'correspondance déclarée' : 'détecté dans la description'}
                </Tag>
              </Space>
              {a.mots && (
                <div className="console-echec-detail">
                  Mots que le fondateur emploie : {a.mots}
                </div>
              )}
            </div>
          ))}
          <Paragraph className="console-reserve">
            Ces correspondances sont déjà enseignées à l'assistante : elle sait qu'un sujet
            vide ne prouve pas l'absence de la donnée. Ce panneau sert à vérifier que la
            liste reste à jour — un sujet qui se remplit doit en sortir.
          </Paragraph>
        </Card>
      )}

      <Card
        size="small"
        title={(
          <Radio.Group value={filtre} onChange={(e) => setFiltre(e.target.value)} size="small">
            <Radio.Button value="ecarts">Écarts</Radio.Button>
            <Radio.Button value="verifier">À vérifier</Radio.Button>
            <Radio.Button value="vides">Sans donnée</Radio.Button>
            <Radio.Button value="tout">Tout</Radio.Button>
          </Radio.Group>
        )}
      >
        {filtre === 'vides' && (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message="Ces sujets n'ont aucune donnée saisie, et c'est normal."
            description="Aucun équivalent peuplé n'existe ailleurs : la donnée n'est réellement pas
              renseignée dans cette base. L'écran le dit plutôt que de laisser croire à un problème."
          />
        )}

        <div className="console-tableau">
          <Table
            rowKey="vue"
            dataSource={lignes}
            columns={colonnes}
            size="small"
            pagination={lignes.length > 20 ? { pageSize: 20 } : false}
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Rien dans ce filtre." /> }}
          />
        </div>

        <Paragraph className="console-reserve">
          « Dans la base » est une <strong>estimation</strong> tenue par PostgreSQL : sur les
          grandes tables elle s'écarte de quelques lignes du comptage exact. Elle suffit à
          repérer un écart, et compter exactement les {donnees?.total ?? 74} sujets prendrait
          plusieurs secondes à chaque ouverture. « Lue par l'assistante » est un comptage
          réel, fait avec ses droits et son cloisonnement. Ouvrir une ligne compte exactement.
        </Paragraph>
      </Card>

      <Modal
        title={echantillon ? echantillon.libelle : 'Détail'}
        open={chargementEchantillon || echantillon !== null}
        onCancel={() => setEchantillon(null)}
        footer={null}
        width={900}
      >
        {chargementEchantillon || !echantillon ? (
          <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
        ) : (
          <>
            <Statistic
              title="Lignes que l'assistante lit réellement (comptage exact)"
              value={echantillon.total_exact}
              style={{ marginBottom: 16 }}
            />
            <div className="console-tableau">
              <Table
                rowKey={(_, i) => String(i)}
                size="small"
                pagination={false}
                dataSource={echantillon.lignes}
                columns={echantillon.colonnes.map((c) => ({
                  title: c,
                  dataIndex: c,
                  key: c,
                  // Une valeur de base de données peut être un objet ou une date :
                  // la rendre telle quelle ferait planter React sur un enfant non
                  // valide. On la ramène toujours à du texte.
                  render: (v: unknown) => (v === null || v === undefined ? '—' : String(v)),
                }))}
              />
            </div>
            <Paragraph className="console-reserve">
              Cinq lignes au plus, telles que l'assistante les voit — avec son rôle en
              lecture seule et le cloisonnement du site.
            </Paragraph>
          </>
        )}
      </Modal>
    </CadreConsole>
  );
}
