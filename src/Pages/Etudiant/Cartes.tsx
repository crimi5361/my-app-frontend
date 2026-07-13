/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
// pages/Cartes/Cartes.tsx
import { useState, useEffect } from 'react';
import {
  Select,
  Table,
  Avatar,
  Card,
  Row,
  Col,
  message,
  Spin,
  Empty,
  Button,
  Tooltip,
} from 'antd';
import {
  UserOutlined,
  PhoneOutlined,
  MailOutlined,
  BookOutlined,
  TeamOutlined,
  SolutionOutlined,
  FileExcelOutlined,
  EyeOutlined,
  DownloadOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  PictureOutlined,
  FilterOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import * as XLSX from 'xlsx';
import PageHeader from '../../Components/PageHeader/PageHeader';
import { apiFetch } from '../../lib/api';
import type { AnneeAcademique } from '../../type/AnneeAcademique';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Classe {
  id: number;
  nom: string;
  description: string;
  nombre_groupes: number;
}

interface Groupe {
  id: number;
  nom: string;
  capacite_max: number;
  effectif_actuel: number;
}

interface GroupeInfo {
  groupe_id: number;
  groupe_nom: string;
  classe_id: number;
  classe_nom: string;
  classe_description: string;
  effectif_total: number;
}

interface Etudiant {
  id: number;
  matricule_iipea: string;
  nom: string;
  prenoms: string;
  sexe: 'M' | 'F';
  date_naissance: string;
  lieu_naissance: string;
  telephone: string;
  email: string;
  photo_url: string | null;
  photo_path: string | null;
  statut_scolaire: string;
  filiere: string;
  niveau: string;
  parcours: string;
  annee_academique: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getInitials = (nom: string, prenoms: string) => {
  const n = (nom || '').trim().charAt(0).toUpperCase();
  const p = (prenoms || '').trim().charAt(0).toUpperCase();
  return `${n}${p}`;
};

const filiereColor = (filiere: string): string => {
  const f = (filiere || '').toLowerCase();
  if (f.includes('logiciel') || f.includes('gl')) return '#185FA5';
  if (f.includes('intellig') || f.includes('ia')) return '#534AB7';
  if (f.includes('réseau') || f.includes('rsi') || f.includes('réseau')) return '#854F0B';
  if (f.includes('sécur') || f.includes('se')) return '#3B6D11';
  return '#5F5E5A';
};

const filiereBg = (filiere: string): string => {
  const f = (filiere || '').toLowerCase();
  if (f.includes('logiciel') || f.includes('gl')) return '#E6F1FB';
  if (f.includes('intellig') || f.includes('ia')) return '#EEEDFE';
  if (f.includes('réseau') || f.includes('rsi')) return '#FAEEDA';
  if (f.includes('sécur') || f.includes('se')) return '#EAF3DE';
  return '#F1EFE8';
};

// ─── Component ────────────────────────────────────────────────────────────────

const Cartes = () => {
  const [classes, setClasses] = useState<Classe[]>([]);
  const [groupes, setGroupes] = useState<Groupe[]>([]);
  const [etudiants, setEtudiants] = useState<Etudiant[]>([]);
  const [groupesInfo, setGroupesInfo] = useState<GroupeInfo | null>(null);
  const [anneesAcademiques, setAnneesAcademiques] = useState<AnneeAcademique[]>([]);

  const [selectedClasse, setSelectedClasse] = useState<number | null>(null);
  const [selectedGroupe, setSelectedGroupe] = useState<number | null>(null);
  const [selectedAnnee, setSelectedAnnee] = useState<number | null>(null);

  const [loading, setLoading] = useState(false);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [loadingGroupes, setLoadingGroupes] = useState(false);

  // ── Loaders ─────────────────────────────────────────────────────────────────

  const loadClasses = async () => {
    setLoadingClasses(true);
    try {
      const res = await apiFetch('/api/CarteEtudiante/classes');
      if (res.success) setClasses(res.data);
      else throw new Error(res.message);
    } catch (e: any) {
      message.error('Erreur chargement classes : ' + e.message);
    } finally {
      setLoadingClasses(false);
    }
  };

  const loadAnneesAcademiques = async () => {
    try {
      const res = await apiFetch('/api/CarteEtudiante/annees');
      if (res.success && res.data.length > 0) {
        setAnneesAcademiques(res.data);
        const current = res.data.find((a: AnneeAcademique) => a.etat === 'en cours');
        setSelectedAnnee(current ? current.id : res.data[0].id);
      }
    } catch (e: any) {
      console.warn('Années académiques :', e.message);
    }
  };

  useEffect(() => { loadClasses(); loadAnneesAcademiques(); }, []);

  useEffect(() => {
    if (selectedGroupe && selectedAnnee) handleGroupeChange(selectedGroupe);
  }, [selectedAnnee]);

  const handleClasseChange = async (classeId: number) => {
    setSelectedClasse(classeId);
    setSelectedGroupe(null);
    setEtudiants([]);
    setGroupesInfo(null);
    setLoadingGroupes(true);
    try {
      const res = await apiFetch(`/api/CarteEtudiante/classes/${classeId}/groupes`);
      setGroupes(res.success ? res.data : []);
    } catch {
      message.error('Erreur chargement des groupes');
      setGroupes([]);
    } finally {
      setLoadingGroupes(false);
    }
  };

  const handleGroupeChange = async (groupeId: number) => {
    setSelectedGroupe(groupeId);
    setLoading(true);
    try {
      const url = `/api/CarteEtudiante/groupes/${groupeId}/etudiants${selectedAnnee ? `?annee_id=${selectedAnnee}` : ''}`;
      const res = await apiFetch(url);
      if (res.success) {
        setEtudiants(res.data.etudiants || []);
        setGroupesInfo(res.data.groupe_info);
      } else {
        setEtudiants([]);
        setGroupesInfo(null);
      }
    } catch {
      message.error('Erreur chargement des étudiants');
      setEtudiants([]);
    } finally {
      setLoading(false);
    }
  };

  // ── Export Excel ─────────────────────────────────────────────────────────────

  const exportToExcel = () => {
    if (!etudiants.length) { message.warning('Aucune donnée à exporter'); return; }
    const data = etudiants.map((e) => ({
      Matricule: e.matricule_iipea,
      Nom: e.nom,
      Prénoms: e.prenoms,
      Sexe: e.sexe === 'M' ? 'Masculin' : 'Féminin',
      'Date de naissance': e.date_naissance ? new Date(e.date_naissance).toLocaleDateString('fr-FR') : 'N/A',
      'Lieu de naissance': e.lieu_naissance,
      Téléphone: e.telephone,
      Email: e.email,
      Filière: e.filiere,
      Niveau: e.niveau,
      Parcours: e.parcours,
      Statut: e.statut_scolaire,
      'Année académique': e.annee_academique,
      'Photo URL': e.photo_path || 'N/A',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Etudiants');
    XLSX.writeFile(wb, `etudiants_${groupesInfo?.classe_nom}_${groupesInfo?.groupe_nom}_${new Date().toISOString().split('T')[0]}.xlsx`);
    message.success('Export Excel réussi !');
  };

  // ── Statistiques calculées ───────────────────────────────────────────────────

  const nbActifs = etudiants.filter((e) => e.statut_scolaire === 'actif').length;
  const nbPhotos = etudiants.filter((e) => !!e.photo_path).length;

  // ── Fonctions de recherche pour les Select ──────────────────────────────────

  // Recherche pour les classes
  const filterClasse = (input: string, option: any) => {
    const children = option?.props?.children;
    if (!children) return false;
    // Récupère le texte du premier élément (le nom de la classe)
    const text = typeof children === 'string' ? children : children.props?.children?.[0]?.props?.children || '';
    return text.toString().toLowerCase().includes(input.toLowerCase());
  };

  // Recherche pour les groupes
  const filterGroupe = (input: string, option: any) => {
    const children = option?.props?.children;
    if (!children) return false;
    // Récupère le texte du premier élément (le nom du groupe)
    const text = typeof children === 'string' ? children : children.props?.children?.[0]?.props?.children || '';
    return text.toString().toLowerCase().includes(input.toLowerCase());
  };

  // Recherche pour les années académiques
  const filterAnnee = (input: string, option: any) => {
    const children = option?.props?.children;
    if (!children) return false;
    // Récupère le texte du premier élément (l'année)
    const text = typeof children === 'string' ? children : children.props?.children?.[0]?.props?.children || '';
    return text.toString().toLowerCase().includes(input.toLowerCase());
  };

  // ── Colonnes tableau ─────────────────────────────────────────────────────────

  const columns: ColumnsType<Etudiant> = [
    {
      title: 'Étudiant',
      key: 'etudiant',
      width: 220,
      render: (_, r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Tooltip title="Voir la photo">
            <a href={r.photo_path || '#'} target="_blank" rel="noopener noreferrer">
              <Avatar
                size={38}
                src={r.photo_path || undefined}
                icon={!r.photo_path ? <UserOutlined /> : undefined}
                style={{
                  backgroundColor: r.photo_path ? undefined : (r.sexe === 'F' ? '#FBEAF0' : '#E6F1FB'),
                  color: r.sexe === 'F' ? '#993556' : '#185FA5',
                  fontWeight: 600,
                  fontSize: 13,
                  flexShrink: 0,
                  cursor: 'pointer',
                }}
              >
                {!r.photo_path && getInitials(r.nom, r.prenoms)}
              </Avatar>
            </a>
          </Tooltip>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, color: 'inherit', lineHeight: 1.3 }}>
              {r.nom || 'N/A'}
            </div>
            <div style={{ fontSize: 12, color: '#888', lineHeight: 1.3 }}>
              {r.prenoms || ''}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Matricule',
      dataIndex: 'matricule_iipea',
      key: 'matricule',
      width: 160,
      render: (t) => (
        <span style={{
          fontFamily: 'monospace',
          fontSize: 11,
          padding: '3px 8px',
          background: 'rgba(0,0,0,0.04)',
          border: '0.5px solid rgba(0,0,0,0.1)',
          borderRadius: 4,
          color: '#5F5E5A',
          whiteSpace: 'nowrap',
        }}>
          {t || 'N/A'}
        </span>
      ),
    },
    {
      title: 'Filière',
      dataIndex: 'filiere',
      key: 'filiere',
      width: 160,
      render: (t) => (
        <span style={{
          fontSize: 11,
          fontWeight: 500,
          padding: '3px 10px',
          borderRadius: 20,
          background: filiereBg(t),
          color: filiereColor(t),
          whiteSpace: 'nowrap',
        }}>
          {t || 'N/A'}
        </span>
      ),
    },
    {
      title: 'Niveau',
      dataIndex: 'niveau',
      key: 'niveau',
      width: 100,
      align: 'center',
    },
    {
      title: 'Parcours',
      dataIndex: 'parcours',
      key: 'parcours',
      width: 160,
      render: (t) => (
        <span style={{ fontSize: 12, color: '#666' }}>{t || 'N/A'}</span>
      ),
    },
    {
      title: 'Contact',
      key: 'contact',
      width: 190,
      render: (_, r) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {r.telephone && (
            <div style={{ fontSize: 12, color: '#666', display: 'flex', alignItems: 'center', gap: 5 }}>
              <PhoneOutlined style={{ fontSize: 12 }} /> {r.telephone}
            </div>
          )}
          {r.email && (
            <div style={{ fontSize: 12, color: '#666', display: 'flex', alignItems: 'center', gap: 5 }}>
              <MailOutlined style={{ fontSize: 12 }} /> {r.email}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Photo',
      key: 'photo_link',
      width: 90,
      align: 'center',
      render: (_, r) =>
        r.photo_path ? (
          <a
            href={r.photo_path}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#1D9E75', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}
          >
            <EyeOutlined /> Voir
          </a>
        ) : (
          <span style={{ fontSize: 12, color: '#bbb' }}>Aucune</span>
        ),
    },
    {
      title: 'Statut',
      dataIndex: 'statut_scolaire',
      key: 'statut',
      width: 100,
      render: (s) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
            background: s === 'actif' ? '#1D9E75' : '#bbb',
          }} />
          {s === 'actif' ? 'Actif' : (s || 'Actif')}
        </span>
      ),
    },
  ];

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: '#F6F7FA', fontFamily: "'DM Sans', sans-serif" }}>

      {/* Google Font import */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@600;700&display=swap');

        .iipea-page { font-family: 'DM Sans', sans-serif !important; }

        /* Ant Design overrides */
        .iipea-select .ant-select-selector {
          border-radius: 8px !important;
          border: 0.5px solid rgba(0,0,0,0.15) !important;
          background: #fff !important;
          height: 40px !important;
          display: flex !important;
          align-items: center !important;
          font-size: 13px !important;
          transition: border-color 0.15s !important;
        }
        .iipea-select .ant-select-selector:hover {
          border-color: rgba(0,0,0,0.3) !important;
        }
        .iipea-select.ant-select-focused .ant-select-selector {
          border-color: #1D9E75 !important;
          box-shadow: 0 0 0 2px rgba(29,158,117,0.12) !important;
        }
        .iipea-select .ant-select-selection-placeholder {
          color: #aaa !important;
          font-size: 13px !important;
        }
        .iipea-select .ant-select-selection-item {
          font-size: 13px !important;
          line-height: 38px !important;
        }
        .iipea-select .ant-select-arrow { color: #aaa !important; }

        .iipea-table .ant-table-thead > tr > th {
          background: #F8FAFC !important;
          font-size: 11px !important;
          font-weight: 600 !important;
          text-transform: uppercase !important;
          letter-spacing: 0.06em !important;
          color: #888 !important;
          border-bottom: 0.5px solid rgba(0,0,0,0.08) !important;
          padding: 10px 16px !important;
        }
        .iipea-table .ant-table-tbody > tr > td {
          padding: 12px 16px !important;
          border-bottom: 0.5px solid rgba(0,0,0,0.06) !important;
          font-size: 13px !important;
        }
        .iipea-table .ant-table-tbody > tr:hover > td {
          background: #F0FBF7 !important;
        }
        .iipea-table .ant-table-tbody > tr:last-child > td {
          border-bottom: none !important;
        }
        .iipea-table .ant-pagination {
          padding: 12px 16px !important;
          margin: 0 !important;
          border-top: 0.5px solid rgba(0,0,0,0.06) !important;
        }
        .iipea-table .ant-pagination-item-active {
          background: #1D9E75 !important;
          border-color: #1D9E75 !important;
        }
        .iipea-table .ant-pagination-item-active a {
          color: #fff !important;
        }

        .stat-card-iipea {
          border-radius: 12px !important;
          border: 0.5px solid rgba(0,0,0,0.07) !important;
          box-shadow: none !important;
        }

        .filter-card-iipea {
          border-radius: 12px !important;
          border: 0.5px solid rgba(0,0,0,0.07) !important;
          box-shadow: 0 1px 4px rgba(0,0,0,0.04) !important;
        }

        .table-card-iipea {
          border-radius: 12px !important;
          border: 0.5px solid rgba(0,0,0,0.07) !important;
          box-shadow: 0 1px 4px rgba(0,0,0,0.04) !important;
          overflow: hidden !important;
        }
        .table-card-iipea .ant-card-body {
          padding: 0 !important;
        }

        .btn-export {
          border-radius: 8px !important;
          font-size: 13px !important;
          height: 36px !important;
          font-weight: 500 !important;
          display: inline-flex !important;
          align-items: center !important;
          gap: 6px !important;
        }
        .btn-green {
          background: #1D9E75 !important;
          border-color: #1D9E75 !important;
          color: #fff !important;
        }
        .btn-green:hover {
          background: #0F6E56 !important;
          border-color: #0F6E56 !important;
        }

        .filter-label {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.07em;
          text-transform: uppercase;
          color: #888;
          margin-bottom: 6px;
          display: flex;
          align-items: center;
          gap: 5px;
        }

        /* Responsive adjustments */
        @media (max-width: 768px) {
          .iipea-page-container {
            padding-left: 12px !important;
            padding-right: 12px !important;
          }
        }
      `}</style>

      <PageHeader />

      <div className="iipea-page" style={{ 
        maxWidth: 1600, 
        margin: '0 auto', 
        padding: '0 32px 40px' 
      }}>

        {/* ── Page Header ── */}
        <div style={{ padding: '32px 0 24px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{
              fontFamily: "'Syne', sans-serif",
              fontSize: 28,
              fontWeight: 900,
              letterSpacing: '-0.4px',
              margin: 0,
              color: '#1a1a1a',
              lineHeight: 1.2,
            }}>
              Cartes étudiantes
            </h1>
            <p style={{ fontSize: 14, color: '#888', marginTop: 4, fontWeight: 400 }}>
              Consultez et gérez les cartes par classe, groupe et année académique
            </p>
          </div>
          {etudiants.length > 0 && (
            <Button
              icon={<DownloadOutlined />}
              onClick={exportToExcel}
              className="btn-export btn-green"
            >
              Exporter Excel
            </Button>
          )}
        </div>

        {/* ── Filtres ── */}
        <Card className="filter-card-iipea" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
            <FilterOutlined style={{ fontSize: 15, color: '#888' }} />
            <span style={{ fontSize: 14, fontWeight: 500, color: '#333' }}>Filtres de recherche</span>
          </div>
          <Row gutter={[20, 16]}>
            {/* Classe */}
            <Col xs={24} md={13}>
              <div className="filter-label">
                <BookOutlined /> Classe
              </div>
              <Select
                className="iipea-select"
                showSearch
                style={{ width: '100%' }}
                placeholder="Choisir une classe..."
                onChange={handleClasseChange}
                value={selectedClasse}
                loading={loadingClasses}
                allowClear
                filterOption={filterClasse}
                optionFilterProp="children"
              >
                {classes.map((c) => (
                  <Select.Option key={c.id} value={c.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 500 }}>{c.nom}</span>
                      <span style={{ color: '#aaa', fontSize: 11, marginLeft: 8 }}>
                        {c.nombre_groupes || 0} groupe{c.nombre_groupes !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </Select.Option>
                ))}
              </Select>
            </Col>

            {/* Groupe */}
            <Col xs={24} md={13}>
              <div className="filter-label">
                <TeamOutlined /> Groupe
              </div>
              <Select
                className="iipea-select"
                showSearch
                style={{ width: '100%' }}
                placeholder={!selectedClasse ? "Choisissez d'abord une classe" : 'Choisir un groupe...'}
                onChange={handleGroupeChange}
                value={selectedGroupe}
                disabled={!selectedClasse}
                loading={loadingGroupes}
                allowClear
                filterOption={filterGroupe}
                optionFilterProp="children"
              >
                {groupes.map((g) => (
                  <Select.Option key={g.id} value={g.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 500 }}>{g.nom}</span>
                      <span style={{ color: '#aaa', fontSize: 11, marginLeft: 8 }}>
                        {g.effectif_actuel || 0}/{g.capacite_max || 0}
                      </span>
                    </div>
                  </Select.Option>
                ))}
              </Select>
            </Col>

            {/* Année */}
            <Col xs={24} md={4}>
              <div className="filter-label">
                <CalendarOutlined /> Année académique
              </div>
              <Select
                className="iipea-select"
                showSearch
                style={{ width: '100%' }}
                placeholder="Choisir une année..."
                value={selectedAnnee}
                onChange={setSelectedAnnee}
                filterOption={filterAnnee}
                optionFilterProp="children"
              >
                {anneesAcademiques.map((a) => (
                  <Select.Option key={a.id} value={a.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>{a.annee}</span>
                      {a.etat === 'en cours' && (
                        <span style={{
                          fontSize: 10, fontWeight: 600, padding: '2px 7px',
                          borderRadius: 10, background: '#E1F5EE', color: '#0F6E56', marginLeft: 8,
                        }}>
                          En cours
                        </span>
                      )}
                    </div>
                  </Select.Option>
                ))}
              </Select>
            </Col>
          </Row>
        </Card>

        {/* ── Stats (visible seulement si groupe sélectionné) ── */}
        {groupesInfo && (
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            {/* Effectif total */}
            <Col xs={12} sm={6}>
              <Card className="stat-card-iipea" style={{ background: '#E1F5EE', border: '0.5px solid #9FE1CB' }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8,
                  background: '#9FE1CB', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 8,
                }}>
                  <TeamOutlined style={{ fontSize: 18, color: '#085041' }} />
                </div>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 26, fontWeight: 700, color: '#0F6E56', lineHeight: 1 }}>
                  {groupesInfo.effectif_total || 0}
                </div>
                <div style={{ fontSize: 12, color: '#085041', marginTop: 4 }}>Étudiants dans le groupe</div>
              </Card>
            </Col>

            {/* Actifs */}
            <Col xs={12} sm={6}>
              <Card className="stat-card-iipea" style={{ background: '#fff' }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8,
                  background: '#F1EFE8', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 8,
                }}>
                  <CheckCircleOutlined style={{ fontSize: 18, color: '#5F5E5A' }} />
                </div>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 26, fontWeight: 700, color: '#1a1a1a', lineHeight: 1 }}>
                  {nbActifs}
                </div>
                <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>Statut actif</div>
              </Card>
            </Col>

            {/* Photos */}
            <Col xs={12} sm={6}>
              <Card className="stat-card-iipea" style={{ background: '#fff' }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8,
                  background: '#F1EFE8', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 8,
                }}>
                  <PictureOutlined style={{ fontSize: 18, color: '#5F5E5A' }} />
                </div>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 26, fontWeight: 700, color: '#1a1a1a', lineHeight: 1 }}>
                  {nbPhotos}
                </div>
                <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>Photos disponibles</div>
              </Card>
            </Col>

            {/* Classe */}
            <Col xs={12} sm={6}>
              <Card className="stat-card-iipea" style={{ background: '#fff' }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8,
                  background: '#F1EFE8', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 8,
                }}>
                  <BookOutlined style={{ fontSize: 18, color: '#5F5E5A' }} />
                </div>
                <div style={{
                  fontFamily: "'Syne', sans-serif", fontSize: 15, fontWeight: 700,
                  color: '#1a1a1a', lineHeight: 1.3,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {groupesInfo.classe_nom}
                </div>
                <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                  Groupe <strong>{groupesInfo.groupe_nom}</strong>
                </div>
              </Card>
            </Col>
          </Row>
        )}

        {/* ── Tableau ── */}
        <Card className="table-card-iipea">
          {/* Header tableau */}
          <div style={{
            padding: '16px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '0.5px solid rgba(0,0,0,0.07)',
            flexWrap: 'wrap',
            gap: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <SolutionOutlined style={{ fontSize: 16, color: '#888' }} />
              <span style={{ fontSize: 14, fontWeight: 500, color: '#333' }}>
                Liste des étudiants
              </span>
              {etudiants.length > 0 && (
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: '2px 9px',
                  borderRadius: 20, background: '#E1F5EE', color: '#0F6E56',
                }}>
                  {etudiants.length} étudiant{etudiants.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
            {etudiants.length > 0 && (
              <Button
                icon={<FileExcelOutlined />}
                onClick={exportToExcel}
                className="btn-export"
                size="small"
              >
                Exporter
              </Button>
            )}
          </div>

          <Spin spinning={loading}>
            {etudiants.length > 0 ? (
              <Table
                className="iipea-table"
                columns={columns}
                dataSource={etudiants}
                rowKey="id"
                pagination={{
                  defaultPageSize: 50,
                  pageSizeOptions: ['20', '50', '100', '200', '500'],
                  showSizeChanger: true,
                  showTotal: (total, range) =>
                    `${range[0]}–${range[1]} sur ${total} étudiants`,
                }}
                scroll={{ x: 1200 }}
              />
            ) : (
              !loading && (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    <span style={{ fontSize: 13, color: '#aaa' }}>
                      {selectedGroupe
                        ? "Aucun étudiant trouvé pour ce groupe et cette année"
                        : "Sélectionnez une classe et un groupe pour afficher les étudiants"}
                    </span>
                  }
                  style={{ padding: '60px 0' }}
                />
              )
            )}
          </Spin>
        </Card>

      </div>
    </div>
  );
};

export default Cartes;