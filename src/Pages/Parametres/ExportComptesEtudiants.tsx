/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import { Button, Select, Space, message } from "antd";
import { FileExcelOutlined, EyeOutlined } from "@ant-design/icons";
import * as XLSX from "xlsx";
import PageHeader from "../../Components/PageHeader/PageHeader";
import PageContainer from "../../Components/ui/PageContainer";
import DataTable from "../../Components/ui/DataTable";
import StatusTag from "../../Components/ui/StatusTag";
import { apiFetch, ApiError } from "../../lib/api";
import { useEtudiantFilterOptions } from "../../lib/useEtudiantFilterOptions";

interface AnneeOption {
  id: number;
  annee: string;
  etat: string | null;
}

// Champs strictement identiques à ceux retournés par
// controllers/etudiant.controller.js::exportComptesEtudiants (vue_position_academique) — aucun
// champ inventé côté frontend.
interface CompteEtudiant {
  id: number;
  nom: string;
  prenoms: string;
  date_naissance: string | null;
  lieu_naissance: string | null;
  telephone: string | null;
  contact_parent: string | null;
  contact_parent_2: string | null;
  code_unique: string | null;
  matricule_iipea: string | null;
  statut_scolaire: string | null;
  date_inscription_annee: string | null;
  sexe: string | null;
  filiere: string;
  niveau: string;
  annee_academique: string;
  type_parcours: string | null;
  groupe_nom: string | null;
  groupe_est_primaire: boolean | null;
  montant_total_scolarite: string;
  montant_paye: string;
  montant_restant: string;
  statut_etudiant: string | null;
  pourcentage_paye: string;
  pourcentage_reduction: string | null;
  montant_reduction: string | null;
  statut_prise_en_charge: string | null;
}

const formatDate = (v: string | null): string => {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const afficherTexte = (v: string | null) => v || <span style={{ color: "var(--text-soft)" }}>—</span>;

const formatMontant = (v: string) => `${Number(v || 0).toLocaleString("fr-FR")} FCFA`;

// Chantier "Export des comptes étudiants par année académique" (2026-09-03) — audit validé.
// Source unique de la position académique : vue_position_academique, via
// controllers/etudiant.controller.js::exportComptesEtudiants (même filtre _construireFiltresEtudiants
// que Etudiant.tsx). Aperçu et export Excel utilisent la MÊME requête et la MÊME donnée déjà
// chargée en état — jamais un second appel divergent, pour garantir l'identité aperçu/Excel.
const ExportComptesEtudiants = () => {
  const [annees, setAnnees] = useState<AnneeOption[]>([]);
  const [selectedAnneeId, setSelectedAnneeId] = useState<number | null>(null);
  const [filiereId, setFiliereId] = useState<number | undefined>();
  const [niveau, setNiveau] = useState<string | undefined>();
  const [curcusId, setCurcusId] = useState<number | undefined>();
  const [groupeId, setGroupeId] = useState<number | undefined>();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<CompteEtudiant[]>([]);
  const [hasFetched, setHasFetched] = useState(false);

  const { filieres, niveauLibelles, groupes, loadingGroupes, curcusListe } = useEtudiantFilterOptions(selectedAnneeId);

  // ✅ Réutilise l'endpoint déjà scopé par site (req.user.departement_id côté backend) — aucune
  // nouvelle règle de scope, voir controllers/effectifs.controller.js::getAnneesAcademiques.
  useEffect(() => {
    apiFetch<{ data: AnneeOption[] }>("/api/effectifs/annees-academiques")
      .then((res) => setAnnees(res.data || []))
      .catch(() => setAnnees([]));
  }, []);

  const anneeLabel = useMemo(
    () => annees.find((a) => a.id === selectedAnneeId)?.annee ?? null,
    [annees, selectedAnneeId]
  );

  const chargerApercu = async () => {
    if (!selectedAnneeId) {
      message.warning("Sélectionnez une année académique.");
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({ anneeAcademiqueId: String(selectedAnneeId) });
      if (filiereId) params.set("filiere_id", String(filiereId));
      if (niveau) params.set("niveau", niveau);
      if (curcusId) params.set("curcus_id", String(curcusId));
      if (groupeId) params.set("groupe_id", String(groupeId));

      const res = await apiFetch<{ data: CompteEtudiant[]; total: number }>(
        `/api/etudiants/ExportComptesEtudiants?${params.toString()}`,
        { method: "POST" }
      );
      setRows(res.data || []);
      setHasFetched(true);
      if ((res.data || []).length === 0) {
        message.info("Aucun étudiant ne correspond à cette sélection.");
      }
    } catch (e) {
      if (e instanceof ApiError) { message.error(e.message); return; }
      message.error("Erreur lors du chargement de l'aperçu.");
    } finally {
      setLoading(false);
    }
  };

  // ✅ Opère uniquement sur `rows`, déjà chargé par chargerApercu — jamais un second appel API :
  // garantit que l'Excel correspond exactement à ce qui est affiché à l'écran.
  const exporterExcel = () => {
    if (rows.length === 0) {
      message.warning("Aucune donnée à exporter — lancez d'abord un aperçu.");
      return;
    }
    const lignes = rows.map((r) => ({
      "Nom": r.nom,
      "Prénoms": r.prenoms,
      "Date de naissance": formatDate(r.date_naissance),
      "Lieu de naissance": r.lieu_naissance || "",
      "Téléphone": r.telephone || "",
      "Contact parent": r.contact_parent || "",
      "Contact parent 2": r.contact_parent_2 || "",
      "Code unique": r.code_unique || "",
      "Matricule IIPEA": r.matricule_iipea || "",
      "Statut scolaire": r.statut_scolaire || "",
      "Date inscription": formatDate(r.date_inscription_annee),
      "Sexe": r.sexe || "",
      "Filière": r.filiere || "",
      "Niveau": r.niveau || "",
      "Année académique": r.annee_academique || "",
      "Type parcours": r.type_parcours || "",
      "Groupe": r.groupe_nom || "",
      "Groupe primaire": r.groupe_est_primaire ? "Oui" : "Non",
      "Montant total scolarité": Number(r.montant_total_scolarite || 0),
      "Montant payé": Number(r.montant_paye || 0),
      "Montant restant": Number(r.montant_restant || 0),
      "Statut étudiant": r.statut_etudiant || "",
      "Pourcentage payé": Number(r.pourcentage_paye || 0),
      // Distinct de 0 : une absence de prise en charge n'est pas "0% de réduction".
      "Pourcentage réduction": r.pourcentage_reduction !== null ? Number(r.pourcentage_reduction) : "",
      "Montant réduction": r.montant_reduction !== null ? Number(r.montant_reduction) : "",
      "Statut prise en charge": r.statut_prise_en_charge || "",
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(lignes);
    XLSX.utils.book_append_sheet(wb, ws, "Comptes étudiants");
    XLSX.writeFile(wb, `comptes_etudiants_${anneeLabel || "annee"}.xlsx`);
  };

  const columns = [
    { title: "Nom", key: "nom", render: (_: any, r: CompteEtudiant) => `${r.nom} ${r.prenoms}` },
    { title: "Matricule", dataIndex: "matricule_iipea", key: "matricule_iipea", render: afficherTexte },
    { title: "Téléphone", dataIndex: "telephone", key: "telephone", render: afficherTexte },
    { title: "Filière", dataIndex: "filiere", key: "filiere" },
    { title: "Niveau", dataIndex: "niveau", key: "niveau" },
    { title: "Parcours", dataIndex: "type_parcours", key: "type_parcours", render: afficherTexte },
    {
      title: "Groupe",
      key: "groupe_nom",
      render: (_: any, r: CompteEtudiant) =>
        r.groupe_est_primaire
          ? <StatusTag tone="neutral" label="Groupe primaire" />
          : afficherTexte(r.groupe_nom),
    },
    { title: "Montant scolarité", dataIndex: "montant_total_scolarite", key: "montant_total_scolarite", render: formatMontant },
    { title: "Payé", dataIndex: "montant_paye", key: "montant_paye", render: formatMontant },
    { title: "Restant", dataIndex: "montant_restant", key: "montant_restant", render: formatMontant },
    {
      title: "PEC",
      key: "statut_prise_en_charge",
      render: (_: any, r: CompteEtudiant) =>
        r.statut_prise_en_charge
          ? <StatusTag tone="success" label={`${r.pourcentage_reduction}%`} />
          : <span style={{ color: "var(--text-soft)" }}>—</span>,
    },
  ];

  return (
    <div>
      <PageHeader />
      <PageContainer
        title="Export des comptes étudiants"
        description="Sélectionnez une année académique pour prévisualiser puis exporter les comptes étudiants — la position (niveau, filière, scolarité, prise en charge) correspond toujours à l'année choisie, jamais à l'état actuel de l'étudiant."
      >
        <Space wrap size="middle" style={{ marginBottom: 20 }}>
          <Select
            placeholder="Année académique (obligatoire)"
            style={{ width: 220 }}
            value={selectedAnneeId ?? undefined}
            onChange={(v) => { setSelectedAnneeId(v); setHasFetched(false); setRows([]); }}
            options={annees.map((a) => ({ value: a.id, label: a.annee }))}
          />
          <Select
            placeholder="Filière (optionnel)"
            allowClear
            style={{ width: 220 }}
            value={filiereId}
            onChange={setFiliereId}
            options={filieres.map((f) => ({ value: f.id, label: f.nom }))}
          />
          <Select
            placeholder="Niveau (optionnel)"
            allowClear
            style={{ width: 160 }}
            value={niveau}
            onChange={setNiveau}
            options={niveauLibelles.map((n) => ({ value: n, label: n }))}
          />
          <Select
            placeholder="Parcours (optionnel)"
            allowClear
            style={{ width: 180 }}
            value={curcusId}
            onChange={setCurcusId}
            options={curcusListe.map((c) => ({ value: c.id, label: c.type_parcours }))}
          />
          <Select
            placeholder="Groupe (optionnel)"
            allowClear
            style={{ width: 240 }}
            loading={loadingGroupes}
            value={groupeId}
            onChange={setGroupeId}
            options={groupes.map((g) => ({ value: g.id, label: `${g.nom} (${g.classeNom})` }))}
          />
          <Button icon={<EyeOutlined />} onClick={chargerApercu} loading={loading} disabled={!selectedAnneeId}>
            Aperçu
          </Button>
          <Button type="primary" icon={<FileExcelOutlined />} onClick={exporterExcel} disabled={rows.length === 0}>
            Exporter Excel
          </Button>
        </Space>

        <DataTable<CompteEtudiant>
          columns={columns}
          dataSource={rows}
          rowKey="id"
          loading={loading}
          emptyTitle={hasFetched ? "Aucun étudiant" : "Sélectionnez une année puis cliquez sur Aperçu"}
          emptyDescription={
            hasFetched
              ? "Aucun étudiant ne correspond aux filtres choisis pour cette année."
              : "L'aperçu et l'export Excel utilisent exactement les mêmes données."
          }
        />
      </PageContainer>
    </div>
  );
};

export default ExportComptesEtudiants;
