/* eslint-disable @typescript-eslint/no-explicit-any */
// Fiche complète d'un candidat — « Consultation du profil complet (CV, spécialité,
// diplômes, filières potentielles) » (§3.2).
//
// Partagée par la bannette du Chargé Pédagogique et l'écran de traitement RH : les deux
// consultent exactement le même dossier, seules les actions proposées diffèrent (d'où le
// slot `actions` plutôt qu'une duplication du composant).
import { useEffect, useState } from 'react';
import { Drawer, Descriptions, Tag, Divider, Spin, Empty, Button, message } from 'antd';
import { FilePdfOutlined, DownloadOutlined } from '@ant-design/icons';
import { apiFetch, ApiError } from '../../lib/api';
import StatusTag from '../ui/StatusTag';
import {
  CandidatureDetail, STATUT_CANDIDATURE, formatDate, nomComplet,
} from '../../lib/enseignants';

const API_URL = import.meta.env.VITE_API_URL_SERVER;

interface Props {
  /** id de la candidature à afficher, null = tiroir fermé */
  candidatureId: number | null;
  /** Base d'API selon l'espace appelant : les deux exposent la même ressource. */
  baseUrl: '/api/charge-pedagogique' | '/api/rh';
  onClose: () => void;
  actions?: (candidature: CandidatureDetail) => React.ReactNode;
}

const LienFichier = ({ chemin, libelle }: { chemin: string | null; libelle: string }) => {
  if (!chemin) return <span style={{ color: 'var(--text-soft)' }}>Non fourni</span>;
  return (
    <Button
      type="link"
      size="small"
      icon={<DownloadOutlined />}
      href={`${API_URL}${chemin}`}
      target="_blank"
      rel="noopener noreferrer"
      style={{ padding: 0 }}
    >
      {libelle}
    </Button>
  );
};

const FicheCandidature = ({ candidatureId, baseUrl, onClose, actions }: Props) => {
  const [candidature, setCandidature] = useState<CandidatureDetail | null>(null);
  const [chargement, setChargement] = useState(false);

  useEffect(() => {
    if (!candidatureId) {
      setCandidature(null);
      return;
    }
    setChargement(true);
    apiFetch<{ data: CandidatureDetail }>(`${baseUrl}/candidatures/${candidatureId}`)
      .then((res) => setCandidature(res.data))
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) return;
        message.error('Impossible de charger le dossier du candidat.');
      })
      .finally(() => setChargement(false));
  }, [candidatureId, baseUrl]);

  const statut = candidature ? STATUT_CANDIDATURE[candidature.statut] : null;

  return (
    <Drawer
      title={candidature ? `${nomComplet(candidature.nom, candidature.prenoms)} — ${candidature.reference}` : 'Dossier de candidature'}
      open={candidatureId !== null}
      onClose={onClose}
      width={640}
      extra={statut && <StatusTag tone={statut.tone} label={statut.label} />}
      footer={candidature && actions ? <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>{actions(candidature)}</div> : null}
    >
      {chargement && <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>}

      {!chargement && !candidature && <Empty description="Dossier introuvable" />}

      {!chargement && candidature && (
        <>
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="Email">{candidature.email}</Descriptions.Item>
            <Descriptions.Item label="Téléphone">{candidature.telephone || '—'}</Descriptions.Item>
            <Descriptions.Item label="Date de naissance">{formatDate(candidature.date_naissance)}</Descriptions.Item>
            <Descriptions.Item label="Genre">{candidature.genre || '—'}</Descriptions.Item>
            <Descriptions.Item label="Nationalité">{candidature.nationalite || '—'}</Descriptions.Item>
            <Descriptions.Item label="Grade">{candidature.grade || '—'}</Descriptions.Item>
            <Descriptions.Item label="Spécialité">{candidature.specialite || '—'}</Descriptions.Item>
            <Descriptions.Item label="Expérience">
              {candidature.annees_experience != null ? `${candidature.annees_experience} an(s)` : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Origine">
              {candidature.source === 'portail_public' ? 'Site institutionnel' : 'Saisie interne'}
            </Descriptions.Item>
            <Descriptions.Item label="Offre visée">
              {candidature.offre_titre
                ? `${candidature.offre_titre}${candidature.offre_reference ? ` (${candidature.offre_reference})` : ''}`
                : 'Candidature spontanée'}
            </Descriptions.Item>
            <Descriptions.Item label="Déposée le">{formatDate(candidature.created_at)}</Descriptions.Item>
            <Descriptions.Item label="CV">
              <LienFichier chemin={candidature.cv_path} libelle={candidature.cv_original_name || 'Télécharger le CV'} />
            </Descriptions.Item>
          </Descriptions>

          <Divider orientation="left" style={{ marginTop: 24 }}>Filières visées</Divider>
          {candidature.filieres.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {candidature.filieres.map((f) => (
                <Tag key={f.id}>{f.sigle || f.nom}</Tag>
              ))}
            </div>
          ) : (
            <span style={{ color: 'var(--text-soft)' }}>Aucune filière précisée par le candidat.</span>
          )}

          <Divider orientation="left" style={{ marginTop: 24 }}>Diplômes</Divider>
          {candidature.diplomes.length > 0 ? (
            <ul style={{ paddingLeft: 18, margin: 0 }}>
              {candidature.diplomes.map((d) => (
                <li key={d.id} style={{ marginBottom: 8 }}>
                  <strong>{d.intitule}</strong>
                  {d.etablissement && <span style={{ color: 'var(--text-soft)' }}> — {d.etablissement}</span>}
                  {d.annee_obtention && <span style={{ color: 'var(--text-soft)' }}> ({d.annee_obtention})</span>}
                  {d.fichier_path && (
                    <div><LienFichier chemin={d.fichier_path} libelle="Voir le justificatif" /></div>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <span style={{ color: 'var(--text-soft)' }}>Aucun diplôme renseigné.</span>
          )}

          {candidature.lettre_motivation && (
            <>
              <Divider orientation="left" style={{ marginTop: 24 }}>
                <FilePdfOutlined /> Lettre de motivation
              </Divider>
              <p style={{ whiteSpace: 'pre-wrap', color: 'var(--text-soft)' }}>{candidature.lettre_motivation}</p>
            </>
          )}

          {(candidature.commentaire_cp || candidature.commentaire_rh || candidature.motif_refus) && (
            <>
              <Divider orientation="left" style={{ marginTop: 24 }}>Suivi interne</Divider>
              <Descriptions column={1} size="small">
                {candidature.commentaire_cp && (
                  <Descriptions.Item label={`Chargé Pédagogique${candidature.cp_evaluateur_nom ? ` (${candidature.cp_evaluateur_nom})` : ''}`}>
                    {candidature.commentaire_cp}
                  </Descriptions.Item>
                )}
                {candidature.commentaire_rh && (
                  <Descriptions.Item label={`RH${candidature.rh_valideur_nom ? ` (${candidature.rh_valideur_nom})` : ''}`}>
                    {candidature.commentaire_rh}
                  </Descriptions.Item>
                )}
                {candidature.motif_refus && (
                  <Descriptions.Item label="Motif du refus">{candidature.motif_refus}</Descriptions.Item>
                )}
              </Descriptions>
            </>
          )}
        </>
      )}
    </Drawer>
  );
};

export default FicheCandidature;
