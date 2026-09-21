import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, Button, Card, Space, Spin, Typography, message } from 'antd';
import { ArrowLeftOutlined, PrinterOutlined } from '@ant-design/icons';
import { useReactToPrint } from 'react-to-print';
import PageHeader from '../../Components/PageHeader/PageHeader';
import { RecuContent, type EtudiantDetails, type Paiement } from './RecuEtudiant';
import { CertificatFrequentationContent, type CertificatData as FrequentationData } from '../Etudiant/CertificatFrequentation';
import { CertificatScolariteContent, type CertificatData as ScolariteData } from '../Etudiant/CertidicatScolarite';

const { Text } = Typography;

interface AnneeOption {
  annee_academique_id: number;
  annee: string;
  is_current: boolean;
}

// Chantier "Impression reçu + certificats" (2026-09-21) — vue combinée, additive : n'existe que
// pour produire, en une seule impression, le reçu suivi des deux certificats déjà existants
// (année académique COURANTE uniquement, cf. audit — pas de sélecteur d'année ici). Réutilise
// intégralement les 3 endpoints existants (aucun nouvel endpoint), et les composants de contenu
// extraits de RecuEtudiant.tsx / CertificatFrequentation.tsx / CertidicatScolarite.tsx (mêmes
// données, même présentation, aucune donnée ni calcul modifiés). Les 3 pages autonomes restent
// intactes et inchangées.
const ImpressionCombinee = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const API_URL = import.meta.env.VITE_API_URL_SERVER || "";

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [etudiant, setEtudiant] = useState<EtudiantDetails | null>(null);
  const [paiements, setPaiements] = useState<Paiement[]>([]);
  const [certificatFrequentation, setCertificatFrequentation] = useState<FrequentationData | null>(null);
  const [certificatScolarite, setCertificatScolarite] = useState<ScolariteData | null>(null);

  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Recu_et_certificats_${etudiant?.matricule_iipea || id || ''}`,
    // Correction mise en page (2026-09-21) — cause du dépassement à 100% : les deux Cards de
    // certificat ont leur propre `maxWidth: 800` (≈211,7mm, design existant, non modifié) ; en y
    // ajoutant une marge @page (8mm de chaque côté), la largeur totale demandée dépassait la
    // largeur imprimable réelle (210mm ≈ 793,7px), d'où le besoin d'une échelle manuelle à ~90%.
    // Fix : @page margin: 0 (plus de double cumul marge navigateur + @page + padding interne des
    // documents, qui gèrent déjà leur propre respiration visuelle) + .print-document forcé à
    // width: 210mm — les documents (dont le max-width: 800px existant) se contentent alors
    // naturellement de cette largeur exacte, sans dépassement, donc sans scale nécessaire.
    pageStyle: `
      @page { size: A4 portrait; margin: 0; }

      .print-document {
        width: 210mm;
        min-height: 297mm;
        margin: 0 auto !important;
        box-sizing: border-box;
        background: white;
        break-inside: avoid;
        page-break-inside: avoid;
      }

      /* Ombre/bordure de prévisualisation (design des documents, non modifié) masquées
         uniquement à l'impression — ne touche que l'élément direct de .print-document, jamais
         les bordures internes légitimes (tableaux, etc.). */
      .print-document > * {
        box-shadow: none !important;
        border: none !important;
        background: white !important;
      }

      .print-page-break {
        break-before: page;
        page-break-before: always;
        height: 0;
        margin: 0;
        padding: 0;
      }

      /* Correction du débordement vertical résiduel (2026-09-21, autorisation explicite) — une
         fois la largeur et les marges corrigées ci-dessus, la hauteur réelle du contenu (mesurée
         dans l'iframe d'impression réelle de react-to-print) dépassait encore légèrement 297mm :
         reçu 300,11mm (+3,11mm) et certificat de scolarité 299,24mm (+2,24mm, après neutralisation
         du padding par défaut redondant d'Ant Design sur ce dernier), tous deux dus à du contenu
         réel et voulu (pas un doublon), donc non réductibles sans toucher au design. Le certificat
         de fréquentation tient déjà exactement (297mm) et n'est PAS concerné ci-dessous.
         transform: scale() est délibérément écarté ici : il ne modifie que le rendu peint, pas la
         boîte de mise en page utilisée par la pagination d'impression de Chromium, donc n'aurait
         aucun effet sur le nombre de pages. zoom, lui, affecte réellement la mise en page (comme
         le réglage "Échelle" du dialogue d'impression Chrome que ce chantier vise justement à
         rendre inutile), c'est donc le seul mécanisme CSS qui fonctionne ici. Valeurs calculées
         (pas 90% arbitraire) avec une marge de sécurité d'env. 1,5mm pour l'arrondi du moteur
         d'impression : reçu 296/300,11 ≈ 98,6% ; certificat de scolarité 296/299,24 ≈ 98,9%. */
      .print-document--recu {
        zoom: 0.986;
      }
      .print-document--scolarite {
        zoom: 0.989;
      }
    `,
  });

  useEffect(() => {
    chargerDonnees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const chargerDonnees = async () => {
    setLoading(true);
    setErrorMessage(null);
    setEtudiant(null);
    setPaiements([]);
    setCertificatFrequentation(null);
    setCertificatScolarite(null);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        message.error('Authentification requise');
        navigate('/login');
        return;
      }
      const headers = { 'Authorization': `Bearer ${token}` };

      // 1. Étape 4 — l'année académique COURANTE, via le mécanisme déjà utilisé par les deux
      // certificats (/api/caisse/etudiant/:id/annees, flag is_current). Aucun sélecteur d'année
      // dans cette vue : les trois documents utilisent systématiquement cette même année.
      const anneesRes = await fetch(`${API_URL}/api/caisse/etudiant/${id}/annees`, { headers });
      if (!anneesRes.ok) {
        throw new Error('ANNEE_INDISPONIBLE');
      }
      const anneesJson = await anneesRes.json();
      const liste: AnneeOption[] = anneesJson?.success ? (anneesJson.data?.annees || []) : [];
      const anneeCourante = liste.find((a) => a.is_current);

      if (!anneeCourante) {
        setErrorMessage("Impossible de générer les certificats : aucune inscription académique courante n'a été trouvée pour cet étudiant.");
        return;
      }
      const anneeAcademiqueId = anneeCourante.annee_academique_id;

      // 2. Étape 9 — les trois appels existants, en parallèle.
      const [recuRes, freqRes, scoRes] = await Promise.all([
        fetch(`${API_URL}/api/etudiants/recu-data/${id}?anneeAcademiqueId=${anneeAcademiqueId}`, { headers }),
        fetch(`${API_URL}/api/CertificaFrentation/CertificatFrequentation/etudiant/${id}?anneeAcademiqueId=${anneeAcademiqueId}`, { headers }),
        fetch(`${API_URL}/api/CertificatScolarite/certificat/etudiant/${id}?anneeAcademiqueId=${anneeAcademiqueId}`, { headers }),
      ]);

      if (recuRes.status === 401 || freqRes.status === 401 || scoRes.status === 401) {
        message.error('Session expirée');
        navigate('/login');
        return;
      }

      // Reçu — bloquant si indisponible (document principal du flux).
      if (!recuRes.ok) {
        throw new Error('RECU_INDISPONIBLE');
      }
      const recuJson = await recuRes.json();
      if (!recuJson?.data?.etudiant) {
        throw new Error('RECU_INDISPONIBLE');
      }

      // Certificats — 404 le plus probable = pas de position académique courante pour cette
      // année précise (cf. audit, Étape 10) : message dédié plutôt qu'une erreur générique.
      if (!freqRes.ok || !scoRes.ok) {
        setErrorMessage("Impossible de générer les certificats : aucune inscription académique courante n'a été trouvée pour cet étudiant.");
        return;
      }
      const freqJson = await freqRes.json();
      const scoJson = await scoRes.json();

      if (!freqJson?.success || !freqJson?.data?.informations_personnelles) {
        setErrorMessage("Impossible de générer les certificats : aucune inscription académique courante n'a été trouvée pour cet étudiant.");
        return;
      }

      // Même tolérance de forme que CertidicatScolarite.tsx (le backend peut renvoyer un objet
      // ou, historiquement, un tableau) — reprise à l'identique, aucune nouvelle règle.
      let scoData: ScolariteData | null = null;
      if (scoJson?.success) {
        if (Array.isArray(scoJson.data) && scoJson.data.length > 0) {
          scoData = scoJson.data[0];
        } else if (typeof scoJson.data === 'object' && scoJson.data !== null) {
          scoData = scoJson.data;
        }
      }
      if (!scoData || !scoData.informations_personnelles) {
        setErrorMessage("Impossible de générer les certificats : aucune inscription académique courante n'a été trouvée pour cet étudiant.");
        return;
      }

      setEtudiant(recuJson.data.etudiant);
      setPaiements(recuJson.data.paiements || []);
      setCertificatFrequentation(freqJson.data);
      setCertificatScolarite(scoData);
    } catch (err) {
      console.error('Erreur chargement impression combinée:', err);
      setErrorMessage("Une erreur est survenue lors du chargement du reçu et des certificats. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center', minHeight: '50vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <PageHeader />
        <Spin size="large">
          <div>Chargement du reçu et des certificats...</div>
        </Spin>
      </div>
    );
  }

  const pretAImprimer = !errorMessage && etudiant && certificatFrequentation && certificatScolarite;

  return (
    <div style={{ padding: 24 }}>
      <PageHeader />

      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div className="no-print">
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate(`/Etudiant/Recu_Payement/${id}`)}
            style={{ marginBottom: 16, marginRight: 8 }}
          >
            Retour au reçu
          </Button>

          {pretAImprimer && (
            <Button
              type="primary"
              icon={<PrinterOutlined />}
              onClick={() => handlePrint()}
            >
              Imprimer (reçu + certificats)
            </Button>
          )}
        </div>

        {errorMessage && (
          <Card>
            <Alert type="error" showIcon message="Impression combinée indisponible" description={errorMessage} />
            <div style={{ marginTop: 16, textAlign: 'center' }}>
              <Button onClick={chargerDonnees}>Réessayer</Button>
            </div>
          </Card>
        )}

        {pretAImprimer && (
          <>
            {/* Styles d'aperçu écran uniquement, sous @media screen. react-to-print copie TOUTES
                les feuilles de style de la page (dont celle-ci) dans son iframe d'impression, y
                compris cette balise <style> qui est physiquement hors de printRef ; sans la garde
                @media screen, sa règle .print-document (même sélecteur que pageStyle, même
                spécificité) s'appliquait aussi à l'impression et — étant injectée après pageStyle
                dans le head de l'iframe — l'écrasait en cascade : son "margin: 0 auto 24px"
                ajoutait 24px (~6,35mm) de marge basse parasite sur le reçu et le certificat de
                fréquentation (le 3e document y échappait via :last-child), au lieu du "margin: 0
                auto" attendu de pageStyle. Cette garde @media screen neutralise totalement la
                règle pendant l'impression réelle (window.print() bascule le media en 'print'). */}
            <style>{`
              @media screen {
                .print-document {
                  max-width: 800px;
                  margin: 0 auto 24px;
                  background: white;
                }
                .print-document:last-child { margin-bottom: 0; }
              }
            `}</style>
            <div ref={printRef}>
              <div className="print-document print-document--recu">
                <RecuContent etudiant={etudiant} paiements={paiements} apiUrl={API_URL} />
              </div>
              <div className="print-page-break" />
              <div className="print-document">
                <CertificatFrequentationContent certificatData={certificatFrequentation} apiUrl={API_URL} />
              </div>
              <div className="print-page-break" />
              <div className="print-document print-document--scolarite">
                <CertificatScolariteContent certificatData={certificatScolarite} apiUrl={API_URL} />
              </div>
            </div>
          </>
        )}

        {pretAImprimer && (
          <Text type="secondary" style={{ display: 'block', textAlign: 'center' }} className="no-print">
            Aperçu écran — l'impression produira 3 pages : reçu, certificat de fréquentation, certificat de scolarité (année académique courante).
          </Text>
        )}
      </Space>
    </div>
  );
};

export default ImpressionCombinee;
