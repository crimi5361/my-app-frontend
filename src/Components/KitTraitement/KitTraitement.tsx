import { useEffect, useRef, useState } from "react";
import { Card, Radio, Button, Select, Alert, Descriptions, Tag, Spin, message } from "antd";
import { GiftOutlined, CheckCircleOutlined } from "@ant-design/icons";
import { apiFetch, ApiError } from "../../lib/api";
import { METHODES_PAIEMENT } from "../../lib/methodesPaiement";

const { Option } = Select;

interface EtatKit {
  concerne: boolean;
  suspendu: boolean;
  statut: "NON_TRAITE" | "KIT_APPORTE" | "KIT_PAYE" | null;
  annee_academique_id: number | null;
  kit: { id: number; statut: string; montant: number; date_enregistrement: string } | null;
}

interface KitTraitementProps {
  etudiantId: number;
  // Optionnel — appelé une fois le traitement confirmé avec succès (ex. GestionKits.tsx s'en sert
  // pour fermer sa modale et rafraîchir sa liste de résultats). EffectuerPayement.tsx/Encaisser.tsx
  // ne le fournissent pas : ce composant y reste affiché en place, comportement inchangé pour eux.
  onTraite?: () => void;
}

// Chantier Kit étudiant (rames + marqueurs) — Phase 1 (2026-08-21). Composant PARTAGÉ entre
// Scolarite/EffectuerPayement.tsx et CAISSE/Encaisser.tsx (admission + réinscription) — un seul
// endroit pour ce comportement, jamais dupliqué entre les parcours (cf. architecture validée §5).
// Indépendant du module Moyens Généraux : n'importe rien de ce module.
//
// Masque entièrement la section si l'étudiant n'est pas concerné (LICENCE 1 / BTS 1 / LICENCE 1
// PRO) ou si le module est suspendu pour son année académique (KIT_ANNEES_SUSPENDUES) — jamais un
// appel à /traiter dans ces cas. Le backend revalide de toute façon systématiquement.
const KitTraitement = ({ etudiantId, onTraite }: KitTraitementProps) => {
  const [etat, setEtat] = useState<EtatKit | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"APPORTE" | "PAYE" | null>(null);
  const [methode, setMethode] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const [resultat, setResultat] = useState<{ statut: string; numero_recu?: string } | null>(null);
  // Verrou SYNCHRONE anti double-clic/double-soumission : `submitting` (state React) ne se
  // reflète qu'au rendu suivant — un second clic survenant avant ce rendu (ex. double-clic rapide)
  // peut donc partir alors que le bouton semble encore actif, produisant deux POST /api/kit/traiter
  // quasi simultanés (confirmé par reproduction : le premier réussit en 201, le second échoue en
  // 409 "déjà traité" — sans risque de double écriture grâce à la contrainte UNIQUE, mais avec un
  // succès immédiatement suivi d'un message d'erreur qui donne l'impression que "rien ne se passe").
  // useRef change de valeur immédiatement, sans attendre de rendu — seule garantie fiable ici.
  const submittingRef = useRef(false);

  const fetchEtat = () => {
    setLoading(true);
    apiFetch<{ data: EtatKit }>(`/api/kit/etudiant/${etudiantId}/etat`)
      .then((res) => setEtat(res.data))
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) return;
        message.error("Erreur lors du chargement de l'état du Kit");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (etudiantId) fetchEtat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etudiantId]);

  const confirmer = async () => {
    if (submittingRef.current) return; // second clic dans le même tick : ignoré, pas de 2e requête
    if (!mode) {
      message.warning("Sélectionnez une option.");
      return;
    }
    if (mode === "PAYE" && !methode) {
      message.warning("Sélectionnez une méthode de paiement.");
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const res = await apiFetch<{ data: { statut: string; numero_recu?: string } }>("/api/kit/traiter", {
        method: "POST",
        body: JSON.stringify({ etudiant_id: etudiantId, mode, ...(mode === "PAYE" ? { methode } : {}) }),
      });
      message.success(mode === "PAYE" ? "Kit encaissé — reçu généré" : "Kit apporté enregistré");
      setResultat(res.data);
      fetchEtat();
      onTraite?.();
    } catch (e) {
      if (e instanceof ApiError) {
        message.error(e.message);
        return;
      }
      message.error("Erreur lors du traitement du Kit");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Card size="small" style={{ marginTop: 16 }}>
        <div style={{ textAlign: "center", padding: 8 }}><Spin size="small" /></div>
      </Card>
    );
  }

  if (!etat || !etat.concerne) {
    return (
      <Card size="small" title={<span><GiftOutlined /> Kit (rames + marqueurs)</span>} style={{ marginTop: 16 }}>
        <Tag>Non concerné (première année)</Tag>
      </Card>
    );
  }

  if (etat.suspendu) {
    return (
      <Card size="small" title={<span><GiftOutlined /> Kit (rames + marqueurs)</span>} style={{ marginTop: 16 }}>
        <Alert type="warning" showIcon message="Module Kit suspendu pour cette année académique" />
      </Card>
    );
  }

  const dejaTraite = etat.statut === "KIT_APPORTE" || etat.statut === "KIT_PAYE";

  return (
    <Card size="small" title={<span><GiftOutlined /> Kit (rames + marqueurs)</span>} style={{ marginTop: 16 }}>
      {dejaTraite ? (
        <Descriptions column={1} size="small">
          <Descriptions.Item label="Statut">
            <Tag color={etat.statut === "KIT_PAYE" ? "success" : "blue"} icon={<CheckCircleOutlined />}>
              {etat.statut === "KIT_PAYE" ? "Acheté à l'école (5 000 FCFA)" : "Apporté par l'étudiant"}
            </Tag>
          </Descriptions.Item>
        </Descriptions>
      ) : resultat ? (
        <Alert
          type="success"
          showIcon
          message={resultat.statut === "KIT_PAYE" ? "Kit encaissé" : "Kit apporté enregistré"}
          description={resultat.numero_recu ? `Reçu N° ${resultat.numero_recu}` : undefined}
        />
      ) : (
        <>
          <Radio.Group onChange={(e) => setMode(e.target.value)} value={mode} style={{ marginBottom: 12, display: "block" }}>
            <Radio value="APPORTE">Kit apporté par l'étudiant</Radio>
            <br />
            <Radio value="PAYE">Kit acheté à l'école — 5 000 FCFA</Radio>
          </Radio.Group>
          {mode === "PAYE" && (
            <Select
              placeholder="Méthode de paiement"
              style={{ width: 220, display: "block", marginBottom: 12 }}
              value={methode}
              onChange={setMethode}
            >
              {METHODES_PAIEMENT.map((m) => <Option key={m.value} value={m.value}>{m.label}</Option>)}
            </Select>
          )}
          <Button type="primary" onClick={confirmer} loading={submitting} disabled={!mode || submitting}>
            {mode === "PAYE" ? "Encaisser le Kit" : "Valider"}
          </Button>
        </>
      )}
    </Card>
  );
};

export default KitTraitement;
