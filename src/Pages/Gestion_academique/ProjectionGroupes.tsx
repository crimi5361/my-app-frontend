import { useEffect, useState } from "react";
import { Button, Select, Space, message, Card, Row, Col, Modal, Typography, Empty, Alert } from "antd";
import { ThunderboltOutlined, ReloadOutlined, TeamOutlined, FileExcelOutlined, FilePdfOutlined } from "@ant-design/icons";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import PageHeader from "../../Components/PageHeader/PageHeader";
import PageContainer from "../../Components/ui/PageContainer";
import DataTable from "../../Components/ui/DataTable";
import StatusTag, { type StatusTone } from "../../Components/ui/StatusTag";
import { apiFetch, ApiError } from "../../lib/api";

const { Text } = Typography;

// Nom de fichier explicite dérivé du libellé réel filière/niveau/année (jamais un nom générique)
// — remplace tout caractère non alphanumérique par "_", évite les accents/espaces dans le nom de
// fichier tout en restant lisible.
const slugifierPourFichier = (texte: string) =>
  texte
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

// Chantier "Projection des listes de classes prévisionnelles" (2026-09-05) — page ISOLÉE, ne
// touche jamais aux groupes/classes réels. Voir migrations/sql/043_projection_groupes.sql,
// services/projectionGroupes.service.js. La projection est une aide administrative : elle
// n'affecte jamais etudiant.groupe_id ni aucune donnée réelle. "Gestion des groupes"
// (GestionGroupes.tsx) reste l'unique écran de création des VRAIS groupes.

interface AnneeAcademique {
  id: number;
  annee: string;
}

interface FiliereOption {
  id: number;
  nom: string;
  sigle: string;
}

interface NiveauCible {
  id: number;
  libelle: string;
}

interface ProjectionMeta {
  id: number;
  genere_le: string;
  nombre_admis_source: number;
  filiere: string;
  filiere_sigle: string;
  niveau_cible: string;
  annee_cible: string;
  niveau_source: string;
  annee_source: string;
  depassement_capacite: boolean;
}

interface EtudiantProjete {
  id: number;
  matricule_iipea: string;
  nom: string;
  prenoms: string;
  statut: "reinscrit" | "en_attente" | "non_reinscrit";
}

interface GroupeProjete {
  id: number;
  nom: string;
  ordre: number;
  capaciteReference: number;
  etudiants: EtudiantProjete[];
}

const statutInfo: Record<EtudiantProjete["statut"], { label: string; tone: StatusTone }> = {
  reinscrit: { label: "Réinscrit", tone: "success" },
  en_attente: { label: "En attente", tone: "warning" },
  non_reinscrit: { label: "Non réinscrit", tone: "danger" },
};

const ProjectionGroupes = () => {
  const [annees, setAnnees] = useState<AnneeAcademique[]>([]);
  const [filieres, setFilieres] = useState<FiliereOption[]>([]);
  const [niveauxCibles, setNiveauxCibles] = useState<NiveauCible[]>([]);

  const [anneeCibleId, setAnneeCibleId] = useState<number | undefined>();
  const [filiereId, setFiliereId] = useState<number | undefined>();
  const [niveauCibleId, setNiveauCibleId] = useState<number | undefined>();

  const [loadingNiveaux, setLoadingNiveaux] = useState(false);
  const [generation, setGeneration] = useState(false);
  const [chargement, setChargement] = useState(false);

  const [projection, setProjection] = useState<ProjectionMeta | null>(null);
  const [groupes, setGroupes] = useState<GroupeProjete[]>([]);
  const [groupeOuvert, setGroupeOuvert] = useState<GroupeProjete | null>(null);

  useEffect(() => {
    apiFetch<AnneeAcademique[]>("/api/annees").then(setAnnees).catch(() => setAnnees([]));
    apiFetch<FiliereOption[]>("/api/filieres/table/Filiere").then(setFilieres).catch(() => setFilieres([]));
  }, []);

  // Niveaux cibles proposables — dépend du couple (filière, année cible), déterminé dynamiquement
  // côté backend via niveau_suivant_id (jamais une liste de libellés codée en dur ici).
  useEffect(() => {
    setNiveauCibleId(undefined);
    setProjection(null);
    setGroupes([]);
    if (!filiereId || !anneeCibleId) {
      setNiveauxCibles([]);
      return;
    }
    setLoadingNiveaux(true);
    apiFetch<{ success: boolean; data: NiveauCible[] }>(
      `/api/projections-groupes/niveaux-cibles?filiereId=${filiereId}&anneeCibleId=${anneeCibleId}`
    )
      .then((res) => setNiveauxCibles(res.data || []))
      .catch(() => setNiveauxCibles([]))
      .finally(() => setLoadingNiveaux(false));
  }, [filiereId, anneeCibleId]);

  // Charge une projection déjà générée pour la sélection courante, si elle existe — ne
  // recalcule jamais les décisions ADMIS/AJOURNÉ (déjà figées à la génération), uniquement le
  // statut de réinscription, recalculé à chaque consultation.
  const chargerProjection = async () => {
    if (!filiereId || !niveauCibleId || !anneeCibleId) return;
    setChargement(true);
    try {
      const res = await apiFetch<{ success: boolean; data: { projection: ProjectionMeta; groupes: GroupeProjete[] } }>(
        `/api/projections-groupes?filiereId=${filiereId}&niveauCibleId=${niveauCibleId}&anneeCibleId=${anneeCibleId}`
      );
      setProjection(res.data.projection);
      setGroupes(res.data.groupes);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        setProjection(null);
        setGroupes([]);
        return;
      }
      if (e instanceof ApiError && e.status === 401) return;
      message.error("Erreur lors du chargement de la projection.");
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => {
    if (filiereId && niveauCibleId && anneeCibleId) chargerProjection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filiereId, niveauCibleId, anneeCibleId]);

  const genererProjection = async () => {
    if (!filiereId || !niveauCibleId || !anneeCibleId) {
      message.warning("Sélectionnez une année cible, une filière et un niveau.");
      return;
    }
    setGeneration(true);
    try {
      await apiFetch("/api/projections-groupes/generer", {
        method: "POST",
        body: JSON.stringify({ filiereId, niveauCibleId, anneeCibleId }),
      });
      message.success(projection ? "Projection régénérée." : "Projection générée.");
      await chargerProjection();
    } catch (e) {
      if (e instanceof ApiError) {
        message.error(e.message);
        return;
      }
      message.error("Erreur lors de la génération de la projection.");
    } finally {
      setGeneration(false);
    }
  };

  const colonnesEtudiants = [
    { title: "Matricule", dataIndex: "matricule_iipea", key: "matricule_iipea" },
    { title: "Nom", dataIndex: "nom", key: "nom" },
    { title: "Prénoms", dataIndex: "prenoms", key: "prenoms" },
    {
      title: "Statut de réinscription",
      key: "statut",
      render: (_: unknown, r: EtudiantProjete) => {
        const info = statutInfo[r.statut];
        return <StatusTag tone={info.tone} label={info.label} />;
      },
    },
  ];

  // ✅ Exporte TOUJOURS la totalité de groupeOuvert.etudiants (déjà en mémoire, jamais paginée
  // côté état — seule la DataTable affichée pagine à l'écran) : la pagination visuelle du modal
  // n'a donc aucune incidence sur le contenu exporté.
  // ✅ Format aligné sur la vraie "liste de présence" du projet (patron repris de
  // Pages/Gestion_academique/DetailGroupe.tsx::generateListeAppelPDF) — colonnes L/M/M/J/V/S/TOTAL
  // conservées telles quelles et VOLONTAIREMENT vides (ne servent qu'à ce que le document puisse
  // aussi servir de support de présence papier), Statut de réinscription ajoutée entre "Nom &
  // Prénoms" et ces colonnes. Le Matricule n'apparaît plus dans ce tableau (remplacé par Nom &
  // Prénoms unique, comme sur la vraie liste d'appel) — il reste bien sûr en base, simplement pas
  // affiché ici.
  const nomFichierExport = (extension: string) =>
    `projection_${slugifierPourFichier(projection?.filiere_sigle ?? "")}_${slugifierPourFichier(projection?.niveau_cible ?? "")}_${slugifierPourFichier(projection?.annee_cible ?? "")}_${slugifierPourFichier(groupeOuvert?.nom ?? "")}.${extension}`;

  const ENTETES_TABLEAU = ["N°", "Nom & Prénoms", "Statut de réinscription", "L", "M", "M", "J", "V", "S", "TOTAL"];

  // En-têtes propres à l'export Excel uniquement (Matricule IIPEA inséré entre N° et Nom &
  // Prénoms) — le PDF continue d'utiliser ENTETES_TABLEAU tel quel, format liste d'appel non
  // modifié à la demande explicite de l'utilisateur.
  const ENTETES_TABLEAU_EXCEL = ["N°", "Matricule IIPEA", "Nom & Prénoms", "Statut de réinscription", "L", "M", "M", "J", "V", "S", "TOTAL"];

  const exporterExcel = () => {
    if (!groupeOuvert || !projection) return;

    const entete = [
      ["LISTE DE CLASSE PRÉVISIONNELLE"],
      [`Année académique : ${projection.annee_cible}`],
      [`Filière : ${projection.filiere}`],
      [`Niveau : ${projection.niveau_cible}`],
      [`Groupe : Projection — ${groupeOuvert.nom}`],
      [`Effectif : ${groupeOuvert.etudiants.length} étudiant(s)`],
      ["DOCUMENT PRÉVISIONNEL — NE CONSTITUE PAS UNE AFFECTATION DÉFINITIVE"],
      [],
      ENTETES_TABLEAU_EXCEL,
    ];
    const lignesEtudiants = groupeOuvert.etudiants.map((e, index) => [
      index + 1,
      e.matricule_iipea,
      `${e.nom} ${e.prenoms}`,
      statutInfo[e.statut].label,
      "", "", "", "", "", "", // L, M, M, J, V, S — volontairement vides
      "", // TOTAL — volontairement vide
    ]);

    const ws = XLSX.utils.aoa_to_sheet([...entete, ...lignesEtudiants]);

    // Fusion des lignes de titre/informations sur toute la largeur du tableau (11 colonnes) —
    // fonctionnalité de structure (merges), supportée par la version gratuite de la librairie
    // xlsx déjà utilisée dans le projet, contrairement aux couleurs/bordures de cellules (réservées
    // à sa version payante — non disponibles ici sans changer de librairie).
    const derniereColonne = ENTETES_TABLEAU_EXCEL.length - 1;
    ws["!merges"] = [0, 1, 2, 3, 4, 5, 6].map((r) => ({ s: { r, c: 0 }, e: { r, c: derniereColonne } }));

    ws["!cols"] = [
      { wch: 5 },   // N°
      { wch: 18 },  // Matricule IIPEA
      { wch: 35 },  // Nom & Prénoms
      { wch: 20 },  // Statut de réinscription
      { wch: 5 }, { wch: 5 }, { wch: 5 }, { wch: 5 }, { wch: 5 }, { wch: 5 }, // L M M J V S
      { wch: 8 },   // TOTAL
    ];
    // Lignes plus hautes pour les noms longs / la lisibilité à l'impression — ligne d'en-tête du
    // tableau (index 8) et lignes étudiants (9+) un peu plus hautes que les lignes de titre.
    ws["!rows"] = entete.map((_, i) => (i === 8 ? { hpt: 22 } : { hpt: 16 }));
    lignesEtudiants.forEach(() => ws["!rows"]!.push({ hpt: 20 }));

    // Marges d'impression resserrées (10 colonnes, dont la large "Nom & Prénoms", tiennent mieux
    // avec des marges réduites). L'orientation paysage et l'ajustement à la page ("Page Setup")
    // ne sont pas exposés par la version gratuite de la librairie xlsx déjà utilisée dans le
    // projet (fonctionnalité réservée à sa version payante, vérifié en inspectant le fichier
    // généré) — à défaut, l'agent choisit l'orientation paysage à l'impression, comme pour tout
    // tableau large dans un tableur (bouton Excel/LibreOffice standard "Mise en page").
    ws["!margins"] = { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 };

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, groupeOuvert.nom.slice(0, 31));
    XLSX.writeFile(wb, nomFichierExport("xlsx"));
  };

  const exporterPdf = () => {
    if (!groupeOuvert || !projection) return;
    // Paysage : nécessaire pour loger confortablement les 10 colonnes (dont une large "Nom &
    // Prénoms" et les 7 colonnes de présence conservées) sans les tasser — la vraie liste d'appel
    // (DetailGroupe.tsx) n'a que 9 colonnes et moins de texte par cellule, le portrait suffisait.
    const doc = new jsPDF({ orientation: "landscape" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text("Institut International Polytechnique des Elites d'Abidjan (IIPEA)", pageWidth / 2, 15, { align: "center" });

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("LISTE DE CLASSE PRÉVISIONNELLE", pageWidth / 2, 24, { align: "center" });

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(180, 0, 0);
    doc.text("DOCUMENT PRÉVISIONNEL — NE CONSTITUE PAS UNE AFFECTATION DÉFINITIVE", pageWidth / 2, 31, { align: "center" });
    doc.setTextColor(0, 0, 0);

    doc.setFontSize(10);
    doc.text(`Année académique : ${projection.annee_cible}`, margin, 40);
    doc.text(`Filière : ${projection.filiere}`, margin, 46);
    doc.text(`Niveau : ${projection.niveau_cible}`, margin, 52);
    doc.text(`Groupe : Projection — ${groupeOuvert.nom}`, pageWidth - margin - 90, 40);
    doc.text(`Effectif : ${groupeOuvert.etudiants.length} étudiant(s)`, pageWidth - margin - 90, 46);
    doc.text(`Généré le : ${new Date(projection.genere_le).toLocaleString("fr-FR")}`, pageWidth - margin - 90, 52);

    autoTable(doc, {
      head: [ENTETES_TABLEAU],
      body: groupeOuvert.etudiants.map((e, index) => [
        (index + 1).toString(),
        `${e.nom} ${e.prenoms}`,
        statutInfo[e.statut].label,
        "", "", "", "", "", "", "", // L M M J V S TOTAL — volontairement vides
      ]),
      startY: 60,
      theme: "grid",
      showHead: "everyPage", // en-tête répété sur chaque page (comportement natif d'autoTable)
      headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: "bold", fontSize: 9, halign: "center" },
      bodyStyles: { fontSize: 9, cellPadding: 3, minCellHeight: 9 },
      styles: { lineColor: [100, 100, 100], lineWidth: 0.1 },
      columnStyles: {
        0: { cellWidth: 14, halign: "center" }, // assez large pour "100", "101"... sans retour à la ligne (bug constaté et corrigé)
        1: { cellWidth: 85, halign: "left" },
        2: { cellWidth: 38, halign: "center" },
        3: { cellWidth: 15, halign: "center" },
        4: { cellWidth: 15, halign: "center" },
        5: { cellWidth: 15, halign: "center" },
        6: { cellWidth: 15, halign: "center" },
        7: { cellWidth: 15, halign: "center" },
        8: { cellWidth: 15, halign: "center" },
        9: { cellWidth: 22, halign: "center", fontStyle: "bold" },
      },
      margin: { left: margin, right: margin },
    });

    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text(`Page ${i}/${pageCount}`, pageWidth / 2, doc.internal.pageSize.height - 10, { align: "center" });
    }

    doc.save(nomFichierExport("pdf"));
  };

  return (
    <div>
      <PageHeader />
      <PageContainer
        title="Projections des groupes"
        description="Aide administrative pour anticiper les futures listes de classes à partir des étudiants admis de l'année précédente — n'affecte jamais les groupes réels des étudiants ; les vrais groupes se créent toujours depuis « Gestion des groupes »."
      >
        <Space wrap size="middle" style={{ marginBottom: 20 }}>
          <Select
            placeholder="Année cible"
            style={{ width: 160 }}
            value={anneeCibleId}
            onChange={(v) => setAnneeCibleId(v)}
            options={annees.map((a) => ({ value: a.id, label: a.annee }))}
          />
          <Select
            placeholder="Filière"
            showSearch
            optionFilterProp="label"
            style={{ width: 280 }}
            value={filiereId}
            onChange={(v) => setFiliereId(v)}
            options={filieres.map((f) => ({ value: f.id, label: `${f.nom} (${f.sigle})` }))}
          />
          <Select
            placeholder="Niveau (poursuite uniquement)"
            style={{ width: 220 }}
            loading={loadingNiveaux}
            disabled={!filiereId || !anneeCibleId}
            value={niveauCibleId}
            onChange={(v) => setNiveauCibleId(v)}
            options={niveauxCibles.map((n) => ({ value: n.id, label: n.libelle }))}
            notFoundContent={
              filiereId && anneeCibleId && !loadingNiveaux
                ? "Aucun niveau de poursuite pour cette filière (niveaux d'entrée exclus)"
                : undefined
            }
          />
          <Button
            type="primary"
            icon={projection ? <ReloadOutlined /> : <ThunderboltOutlined />}
            loading={generation}
            disabled={!filiereId || !niveauCibleId || !anneeCibleId}
            onClick={genererProjection}
          >
            {projection ? "Régénérer la projection" : "Générer la projection"}
          </Button>
        </Space>

        {chargement ? (
          <Card loading />
        ) : projection ? (
          <>
            <Card size="small" style={{ marginBottom: 20 }}>
              <Text strong style={{ fontSize: 16, display: "block", marginBottom: 8 }}>
                PROJECTION — {projection.filiere_sigle} {projection.niveau_cible} — {projection.annee_cible}
              </Text>
              <Text type="secondary" style={{ display: "block", marginBottom: 4 }}>
                Source : {projection.filiere_sigle} {projection.niveau_source} — {projection.annee_source}
              </Text>
              <Space size="large" style={{ marginTop: 8 }}>
                <Text>Admis projetés : <Text strong>{projection.nombre_admis_source}</Text></Text>
                <Text>Nombre de groupes : <Text strong>{groupes.length}</Text></Text>
                <Text type="secondary">Générée le {new Date(projection.genere_le).toLocaleString("fr-FR")}</Text>
              </Space>
            </Card>

            {projection.depassement_capacite && (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 20 }}
                message="La population projetée dépasse la capacité totale des groupes de l'année précédente"
                description="Tous les groupes réellement utilisés l'année source ont été retenus et le surplus a été réparti proportionnellement entre eux — aucun groupe supplémentaire n'a été créé automatiquement."
              />
            )}

            <Row gutter={[16, 16]}>
              {groupes.map((g) => (
                <Col xs={24} sm={12} md={8} key={g.id}>
                  <Card
                    hoverable
                    size="small"
                    title={`Projection — ${g.nom}`}
                    onClick={() => setGroupeOuvert(g)}
                    extra={<TeamOutlined />}
                  >
                    <Text type="secondary" style={{ display: "block" }}>Capacité de référence : {g.capaciteReference}</Text>
                    <Text strong style={{ fontSize: 18 }}>{g.etudiants.length}</Text> étudiant{g.etudiants.length > 1 ? "s" : ""} projeté{g.etudiants.length > 1 ? "s" : ""}
                  </Card>
                </Col>
              ))}
            </Row>
          </>
        ) : (
          filiereId && niveauCibleId && anneeCibleId && (
            <Empty description="Aucune projection générée pour cette sélection — cliquez sur « Générer la projection »." />
          )
        )}

        <Modal
          title={groupeOuvert ? `Projection — ${groupeOuvert.nom} — ${groupeOuvert.etudiants.length} étudiant(s)` : ""}
          open={!!groupeOuvert}
          onCancel={() => setGroupeOuvert(null)}
          footer={<Button onClick={() => setGroupeOuvert(null)}>Fermer</Button>}
          width={800}
        >
          {groupeOuvert && (
            <>
              <Space style={{ marginBottom: 12 }}>
                <Button icon={<FileExcelOutlined />} onClick={exporterExcel}>Exporter Excel</Button>
                <Button icon={<FilePdfOutlined />} onClick={exporterPdf}>Exporter PDF</Button>
              </Space>
              <DataTable<EtudiantProjete>
                columns={colonnesEtudiants}
                dataSource={groupeOuvert.etudiants}
                rowKey="id"
                pagination={{ pageSize: 20 }}
              />
            </>
          )}
        </Modal>
      </PageContainer>
    </div>
  );
};

export default ProjectionGroupes;
