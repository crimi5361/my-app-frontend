/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Select, DatePicker, Button, Drawer, Descriptions, Table, Avatar, message, Space } from "antd";
import type { TablePaginationConfig } from "antd";
import {
  EyeOutlined, PrinterOutlined, UserOutlined, FileExcelOutlined, FilePdfOutlined,
} from "@ant-design/icons";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import dayjs from "dayjs";
import PageHeader from "../../Components/PageHeader/PageHeader";
import PageContainer from "../../Components/ui/PageContainer";
import DataTable from "../../Components/ui/DataTable";
import StatusTag from "../../Components/ui/StatusTag";
import AccesRestreint from "../../Components/ui/AccesRestreint";
import { apiFetch, ApiError } from "../../lib/api";
import { hasPermission } from "../../lib/permissions";

const { Option } = Select;
const { RangePicker } = DatePicker;
const API_URL = import.meta.env.VITE_API_URL_SERVER;

interface LigneDistrib {
  accessoire_id: number;
  code: string;
  nom: string;
  quantite: number;
}

interface DistributionDetail {
  id: number;
  numero_recu: string;
  date_remise: string;
  etudiant_id: number;
  annee_academique_id: number;
  ecole_nom: string;
  filiere_nom: string;
  niveau_nom: string;
  classe_nom: string | null;
  site_nom: string;
  nom: string;
  prenoms: string;
  matricule: string;
  matricule_iipea: string;
  sexe: string;
  photo_url: string | null;
  agent_nom: string;
  annee_academique: string;
  lignes: LigneDistrib[];
}

interface HistoriqueLigne {
  id: number;
  numero_recu: string;
  date_remise: string;
  etudiant_id: number;
  annee_academique_id: number;
  ecole_nom: string;
  filiere_nom: string;
  niveau_nom: string;
  classe_nom: string | null;
  nom: string;
  prenoms: string;
  matricule: string;
  matricule_iipea: string;
  agent_nom: string;
  annee_academique: string;
  total_accessoires: number;
}

interface AcademicYear { id: number; annee: string; etat: string; }
interface Agent { id: number; nom: string; }
interface AccessoireOption { accessoire_id: number; code: string; nom: string; }

const getUserInfo = () => {
  try {
    const userStr = localStorage.getItem("user");
    if (!userStr) return null;
    const user = JSON.parse(userStr);
    if (!user.departement_id) {
      const deptId = localStorage.getItem("departement_id");
      if (deptId) user.departement_id = parseInt(deptId, 10);
    }
    return user;
  } catch {
    return null;
  }
};

const HistoriqueDistributions = () => {
  const navigate = useNavigate();
  const currentUser = getUserInfo();
  const departementId = currentUser?.departement_id;

  const [lignes, setLignes] = useState<HistoriqueLigne[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const [search, setSearch] = useState("");
  const [filtreAnnee, setFiltreAnnee] = useState<number | null>(null);
  const [filtreDates, setFiltreDates] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);
  const [filtreEcole, setFiltreEcole] = useState<string | null>(null);
  const [filtreFiliere, setFiltreFiliere] = useState<string | null>(null);
  const [filtreNiveau, setFiltreNiveau] = useState<string | null>(null);
  const [filtreAgent, setFiltreAgent] = useState<number | null>(null);
  const [filtreAccessoire, setFiltreAccessoire] = useState<number | null>(null);

  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [accessoires, setAccessoires] = useState<AccessoireOption[]>([]);
  const [ecoles, setEcoles] = useState<string[]>([]);
  const [filieres, setFilieres] = useState<string[]>([]);
  const [niveaux, setNiveaux] = useState<string[]>([]);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<DistributionDetail | null>(null);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  useEffect(() => {
    if (!departementId) return;
    apiFetch<AcademicYear[]>(`/api/annees?site_id=${departementId}`).then(setAcademicYears).catch(() => {});
    apiFetch<{ data: Agent[] }>("/api/moyens-generaux/stock/agents").then((r) => setAgents(r.data)).catch(() => {});
    apiFetch<{ data: AccessoireOption[] }>("/api/moyens-generaux/stock").then((r) => setAccessoires(r.data)).catch(() => {});
    apiFetch<{ data: { ecoles: string[]; filieres: string[]; niveaux: string[] } }>("/api/moyens-generaux/distribution/historique/filtres")
      .then((r) => { setEcoles(r.data.ecoles); setFilieres(r.data.filieres); setNiveaux(r.data.niveaux); })
      .catch(() => {});
  }, [departementId]);

  const buildParams = useCallback((pageOverride?: number, limitOverride?: number) => {
    const params = new URLSearchParams();
    params.set("page", String(pageOverride ?? page));
    params.set("limit", String(limitOverride ?? limit));
    if (search.trim().length >= 2) params.set("q", search.trim());
    if (filtreAnnee) params.set("annee_academique_id", String(filtreAnnee));
    if (filtreDates?.[0]) params.set("date_debut", filtreDates[0].format("YYYY-MM-DD"));
    if (filtreDates?.[1]) params.set("date_fin", filtreDates[1].format("YYYY-MM-DD"));
    if (filtreEcole) params.set("ecole", filtreEcole);
    if (filtreFiliere) params.set("filiere", filtreFiliere);
    if (filtreNiveau) params.set("niveau", filtreNiveau);
    if (filtreAgent) params.set("agent_id", String(filtreAgent));
    if (filtreAccessoire) params.set("accessoire_id", String(filtreAccessoire));
    return params;
  }, [page, limit, search, filtreAnnee, filtreDates, filtreEcole, filtreFiliere, filtreNiveau, filtreAgent, filtreAccessoire]);

  const fetchHistorique = useCallback(() => {
    setLoading(true);
    apiFetch<{ data: HistoriqueLigne[]; pagination: { page: number; limit: number; total: number } }>(`/api/moyens-generaux/distribution/historique?${buildParams().toString()}`)
      .then((res) => { setLignes(res.data); setTotal(res.pagination.total); })
      .catch((e) => { if (e instanceof ApiError && e.status === 401) return; message.error("Erreur lors du chargement de l'historique"); })
      .finally(() => setLoading(false));
  }, [buildParams]);

  useEffect(() => { fetchHistorique(); }, [fetchHistorique]);

  const handleTableChange = (pagination: TablePaginationConfig) => {
    setPage(pagination.current || 1);
    setLimit(pagination.pageSize || 20);
  };

  const openDetail = (id: number) => {
    apiFetch<{ data: DistributionDetail }>(`/api/moyens-generaux/distribution/${id}`)
      .then((res) => { setDetail(res.data); setDetailOpen(true); })
      .catch(() => message.error("Impossible de charger le détail de la remise"));
  };

  // Récupère l'ensemble des lignes correspondant aux filtres actifs (pas seulement la page
  // affichée) pour un export complet — même logique de filtre que l'écran, limite large.
  const fetchToutPourExport = async (): Promise<HistoriqueLigne[]> => {
    const params = buildParams(1, 5000);
    const res = await apiFetch<{ data: HistoriqueLigne[] }>(`/api/moyens-generaux/distribution/historique?${params.toString()}`);
    return res.data;
  };

  const handleExportExcel = async () => {
    setExportingExcel(true);
    try {
      const data = await fetchToutPourExport();
      if (data.length === 0) { message.warning("Aucune donnée à exporter"); return; }
      const headerRow = ["N° reçu", "Date", "Étudiant", "Matricule IIPEA", "École", "Filière", "Niveau", "Classe", "Agent", "Nb accessoires"];
      const dataRows = data.map((l) => [
        l.numero_recu, new Date(l.date_remise).toLocaleString("fr-FR"), `${l.nom} ${l.prenoms}`, l.matricule_iipea,
        l.ecole_nom, l.filiere_nom, l.niveau_nom, l.classe_nom ?? "", l.agent_nom, l.total_accessoires,
      ]);
      const ws = XLSX.utils.aoa_to_sheet([["HISTORIQUE DES DISTRIBUTIONS — MOYENS GÉNÉRAUX"], [], headerRow, ...dataRows]);
      ws["!cols"] = [{ wch: 26 }, { wch: 18 }, { wch: 24 }, { wch: 16 }, { wch: 22 }, { wch: 30 }, { wch: 14 }, { wch: 24 }, { wch: 20 }, { wch: 14 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Historique");
      XLSX.writeFile(wb, `historique_distributions_${new Date().toISOString().slice(0, 10)}.xlsx`);
      message.success(`${data.length} ligne(s) exportée(s) en Excel`);
    } catch {
      message.error("Erreur lors de l'export Excel");
    } finally {
      setExportingExcel(false);
    }
  };

  const handleExportPdf = async () => {
    setExportingPdf(true);
    try {
      const data = await fetchToutPourExport();
      if (data.length === 0) { message.warning("Aucune donnée à exporter"); return; }
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      doc.setFontSize(14);
      doc.text("Historique des distributions — Moyens Généraux", 14, 14);
      doc.setFontSize(9);
      doc.text(`Généré le ${new Date().toLocaleDateString("fr-FR")} — ${data.length} remise(s)`, 14, 20);
      autoTable(doc, {
        startY: 26,
        head: [["N° reçu", "Date", "Étudiant", "Matricule IIPEA", "École", "Filière", "Niveau", "Agent", "Qté"]],
        body: data.map((l) => [
          l.numero_recu, new Date(l.date_remise).toLocaleDateString("fr-FR"), `${l.nom} ${l.prenoms}`, l.matricule_iipea,
          l.ecole_nom, l.filiere_nom, l.niveau_nom, l.agent_nom, String(l.total_accessoires),
        ]),
        styles: { fontSize: 7 },
        headStyles: { fillColor: [24, 144, 255] },
      });
      doc.save(`historique_distributions_${new Date().toISOString().slice(0, 10)}.pdf`);
      message.success(`${data.length} ligne(s) exportée(s) en PDF`);
    } catch {
      message.error("Erreur lors de l'export PDF");
    } finally {
      setExportingPdf(false);
    }
  };

  const handleImprimerListe = async () => {
    const data = await fetchToutPourExport();
    if (data.length === 0) { message.warning("Aucune donnée à imprimer"); return; }
    const printWindow = window.open("", "_blank");
    if (!printWindow) { message.error("Veuillez autoriser les pop-ups pour imprimer"); return; }
    const rows = data.map((l) => `
      <tr>
        <td>${l.numero_recu}</td><td>${new Date(l.date_remise).toLocaleString("fr-FR")}</td>
        <td>${l.nom} ${l.prenoms}</td><td>${l.matricule_iipea}</td>
        <td>${l.ecole_nom}</td><td>${l.filiere_nom}</td><td>${l.niveau_nom}</td>
        <td>${l.agent_nom}</td><td style="text-align:right">${l.total_accessoires}</td>
      </tr>`).join("");
    printWindow.document.write(`
      <!DOCTYPE html><html><head><meta charset="utf-8"><title>Historique des distributions</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 11px; padding: 16px; }
        h2 { margin-bottom: 4px; } p { color: #666; margin-top: 0; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; }
        th, td { border: 1px solid #ddd; padding: 5px 7px; text-align: left; }
        th { background: #f0f0f0; }
      </style></head>
      <body onload="window.print(); window.onafterprint = function(){ window.close(); }">
        <h2>Historique des distributions — Moyens Généraux</h2>
        <p>Généré le ${new Date().toLocaleDateString("fr-FR")} — ${data.length} remise(s)</p>
        <table><thead><tr><th>N° reçu</th><th>Date</th><th>Étudiant</th><th>Matricule IIPEA</th><th>École</th><th>Filière</th><th>Niveau</th><th>Agent</th><th>Qté</th></tr></thead>
        <tbody>${rows}</tbody></table>
      </body></html>
    `);
    printWindow.document.close();
  };

  const columns = [
    { title: "N° reçu", dataIndex: "numero_recu", key: "numero_recu" },
    { title: "Date", dataIndex: "date_remise", key: "date_remise", render: (v: string) => new Date(v).toLocaleString("fr-FR") },
    { title: "Étudiant", key: "etudiant", render: (_: any, r: HistoriqueLigne) => `${r.nom} ${r.prenoms}` },
    { title: "Matricule IIPEA", dataIndex: "matricule_iipea", key: "matricule_iipea" },
    { title: "École", dataIndex: "ecole_nom", key: "ecole_nom" },
    { title: "Filière", dataIndex: "filiere_nom", key: "filiere_nom" },
    { title: "Niveau", dataIndex: "niveau_nom", key: "niveau_nom" },
    { title: "Classe", dataIndex: "classe_nom", key: "classe_nom", render: (v: string | null) => v ?? <span style={{ color: "var(--text-soft)" }}>—</span> },
    { title: "Agent", dataIndex: "agent_nom", key: "agent_nom" },
    { title: "Nb accessoires", dataIndex: "total_accessoires", key: "total_accessoires", align: "right" as const },
    { title: "Statut", key: "statut", render: () => <StatusTag tone="success" label="Remise effectuée" /> },
    {
      title: "Action", key: "action",
      render: (_: any, r: HistoriqueLigne) => (
        <Space>
          <Button icon={<EyeOutlined />} size="small" onClick={() => openDetail(r.id)} />
          {/* Chantier Moyens Généraux, Phase 2D — diagnostic reçu (2026-08-19) : reçu de remise
              CONSOLIDÉ (offerts + surplus), jamais l'ancien reçu par session — sinon un surplus déjà
              distribué n'apparaîtrait jamais depuis ce bouton. */}
          <Button
            icon={<PrinterOutlined />} size="small"
            onClick={() => navigate(`/moyens-generaux/recu-consolide/${r.etudiant_id}?anneeAcademiqueId=${r.annee_academique_id}`)}
          />
        </Space>
      ),
    },
  ];

  // Permission individuelle (Chantier Moyens Généraux, Phase 1) — le backend revalide de toute
  // façon chaque requête ; ce masquage n'est qu'une amélioration d'ergonomie.
  if (!hasPermission("distribution.voir")) {
    return (
      <div>
        <PageHeader />
        <AccesRestreint description="Vous n'avez pas la permission de consulter l'historique des distributions." />
      </div>
    );
  }

  return (
    <div>
      <PageHeader />
      <PageContainer title="Historique des distributions" description="Toutes les remises effectuées — Moyens Généraux">
        <DataTable<HistoriqueLigne>
          columns={columns}
          dataSource={lignes}
          rowKey="id"
          loading={loading}
          onChange={handleTableChange}
          pagination={{ current: page, pageSize: limit, total, showSizeChanger: true }}
          searchValue={search}
          searchPlaceholder="Reçu, matricule, matricule IIPEA, nom ou prénom"
          onSearchChange={(v) => { setSearch(v); setPage(1); }}
          filters={
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Select allowClear placeholder="Année académique" style={{ width: 160 }} value={filtreAnnee} onChange={(v) => { setFiltreAnnee(v); setPage(1); }}>
                {academicYears.map((a) => <Option key={a.id} value={a.id}>{a.annee}</Option>)}
              </Select>
              <RangePicker value={filtreDates} onChange={(d) => { setFiltreDates(d as any); setPage(1); }} />
              <Select allowClear placeholder="École" style={{ width: 160 }} value={filtreEcole} onChange={(v) => { setFiltreEcole(v); setPage(1); }}>
                {ecoles.map((e) => <Option key={e} value={e}>{e}</Option>)}
              </Select>
              <Select allowClear placeholder="Filière" style={{ width: 180 }} value={filtreFiliere} onChange={(v) => { setFiltreFiliere(v); setPage(1); }}>
                {filieres.map((f) => <Option key={f} value={f}>{f}</Option>)}
              </Select>
              <Select allowClear placeholder="Niveau" style={{ width: 140 }} value={filtreNiveau} onChange={(v) => { setFiltreNiveau(v); setPage(1); }}>
                {niveaux.map((n) => <Option key={n} value={n}>{n}</Option>)}
              </Select>
              <Select allowClear placeholder="Agent" style={{ width: 160 }} value={filtreAgent} onChange={(v) => { setFiltreAgent(v); setPage(1); }}>
                {agents.map((a) => <Option key={a.id} value={a.id}>{a.nom}</Option>)}
              </Select>
              <Select allowClear placeholder="Accessoire" style={{ width: 160 }} value={filtreAccessoire} onChange={(v) => { setFiltreAccessoire(v); setPage(1); }}>
                {accessoires.map((a) => <Option key={a.accessoire_id} value={a.accessoire_id}>{a.nom}</Option>)}
              </Select>
            </div>
          }
          toolbarExtra={
            <Space>
              <Button icon={<FileExcelOutlined />} loading={exportingExcel} onClick={handleExportExcel}>Export Excel</Button>
              <Button icon={<FilePdfOutlined />} loading={exportingPdf} onClick={handleExportPdf}>Export PDF</Button>
              <Button icon={<PrinterOutlined />} onClick={handleImprimerListe}>Impression</Button>
            </Space>
          }
          emptyTitle="Aucune distribution enregistrée"
        />
      </PageContainer>

      <Drawer title={detail ? `Remise ${detail.numero_recu}` : ""} open={detailOpen} onClose={() => setDetailOpen(false)} width={480}>
        {detail && (
          <>
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <Avatar size={100} src={detail.photo_url ? `${API_URL}${detail.photo_url}` : undefined} icon={<UserOutlined />} />
            </div>
            <div style={{ marginBottom: 8, fontWeight: 600 }}>Étudiant</div>
            <Descriptions column={1} size="small" bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Nom et prénoms">{detail.nom} {detail.prenoms}</Descriptions.Item>
              <Descriptions.Item label="Matricule">{detail.matricule}</Descriptions.Item>
              <Descriptions.Item label="Matricule IIPEA">{detail.matricule_iipea}</Descriptions.Item>
            </Descriptions>

            <div style={{ marginBottom: 8, fontWeight: 600 }}>Remise</div>
            <Descriptions column={1} size="small" bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Numéro de reçu">{detail.numero_recu}</Descriptions.Item>
              <Descriptions.Item label="Date">{new Date(detail.date_remise).toLocaleDateString("fr-FR")}</Descriptions.Item>
              <Descriptions.Item label="Heure">{new Date(detail.date_remise).toLocaleTimeString("fr-FR")}</Descriptions.Item>
              <Descriptions.Item label="Agent">{detail.agent_nom}</Descriptions.Item>
              <Descriptions.Item label="Site">{detail.site_nom}</Descriptions.Item>
            </Descriptions>

            <div style={{ marginBottom: 8, fontWeight: 600 }}>Accessoires remis</div>
            <Table
              dataSource={detail.lignes}
              rowKey="accessoire_id"
              size="small"
              pagination={false}
              columns={[{ title: "Accessoire", dataIndex: "nom" }, { title: "Quantité", dataIndex: "quantite", align: "right" as const }]}
            />

            <Button
              type="primary"
              icon={<PrinterOutlined />}
              style={{ marginTop: 16, width: "100%" }}
              onClick={() => navigate(`/moyens-generaux/recu-consolide/${detail.etudiant_id}?anneeAcademiqueId=${detail.annee_academique_id}`)}
            >
              Imprimer le reçu de remise consolidé
            </Button>
          </>
        )}
      </Drawer>
    </div>
  );
};

export default HistoriqueDistributions;
