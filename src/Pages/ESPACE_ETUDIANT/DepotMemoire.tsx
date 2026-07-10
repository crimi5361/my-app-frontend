import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Upload,
  FileText,
  CheckCircle2,
  XCircle,
  Loader2,
  BookOpen,
  User,
  BadgeCheck,
  AlertTriangle,
  Clock,
  RefreshCw,
  ShieldAlert,
  CalendarClock,
  FilePlus2,
  Info,
  PlayCircle,
  MessageSquare,
  Download as DownloadIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { FilePdfOutlined } from '@ant-design/icons';

interface StudentInfo {
  nom: string;
  prenoms: string;
  classe: string;
  filiere: string;
  annee_academique: string;
  email: string;
}

interface ScolariteInfo {
  success: boolean;
  is_solde: boolean;
  scolarite_restante: number;
  statut_etudiant: string;
  montant_total: number;
  montant_verse: number;
  message: string;
}

interface DernierMemoire {
  id: number;
  theme: string;
  fichier_pdf: string;
  statut: 'en_attente' | 'encours' | 'valide' | 'rejete';
  date_depot: string;
  motif_refus: string | null;
  rapport_analyse: string | null;
}

// Vérifie si la modification est encore possible (moins de 2h depuis le dépôt)
const peutEncoreModifier = (dateDepot: string): boolean => {
  const depot = new Date(dateDepot).getTime();
  const now = Date.now();
  const deuxHeuresMs = 2 * 60 * 60 * 1000;
  return now - depot < deuxHeuresMs;
};

const formatDateDepot = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
};

const DepotMemoire = () => {
  const navigate = useNavigate();
  const API_URL = import.meta.env.VITE_API_URL_SERVER || '';

  const [studentInfo, setStudentInfo] = useState<StudentInfo | null>(null);
  const [scolariteInfo, setScolariteInfo] = useState<ScolariteInfo | null>(null);
  const [dernierMemoire, setDernierMemoire] = useState<DernierMemoire | null>(null);
  const [modifPossible, setModifPossible] = useState(false);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [theme, setTheme] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isUpdateMode, setIsUpdateMode] = useState(false);
  const [memoireId, setMemoireId] = useState<number | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');
        const studentId = localStorage.getItem('user_id');
        if (!token || !studentId) { navigate('/login'); return; }

        const [profileRes, scolariteRes, memoireRes] = await Promise.all([
          fetch(`${API_URL}/api/donneeespaceetudiant/profile/${studentId}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_URL}/api/etudiant-payement-espace/etudiant/${studentId}/scolarite`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_URL}/api/memoire/etudiant/${studentId}/dernier`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (profileRes.ok) {
          const d = await profileRes.json();
          if (d.informations_personnelles && d.informations_academiques) {
            setStudentInfo({
              nom: d.informations_personnelles.nom,
              prenoms: d.informations_personnelles.prenoms,
              classe: d.informations_academiques.classe,
              filiere: d.informations_academiques.filiere,
              annee_academique: d.informations_academiques.annee_academique,
              email: d.informations_personnelles.email || '',
            });
          }
        }

        if (scolariteRes.ok) {
          setScolariteInfo(await scolariteRes.json());
        }

        if (memoireRes.ok) {
          const d = await memoireRes.json();
          if (d.a_un_memoire) {
            const m: DernierMemoire = {
              ...d.memoire,
              motif_refus: d.memoire.motif_refus || null,
              rapport_analyse: d.memoire.rapport_analyse || null
            };
            setDernierMemoire(m);

            const modif =
              m.statut === 'en_attente' && peutEncoreModifier(m.date_depot);
            setModifPossible(modif);

            if (modif) {
              setIsUpdateMode(true);
              setMemoireId(m.id);
              setTheme(m.theme);
            }
          }
        }
      } catch (err) {
        console.error('Erreur:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [API_URL, navigate]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.type !== 'application/pdf') {
      setError('Seuls les fichiers PDF sont acceptés.');
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setError('Le fichier ne doit pas dépasser 10 Mo.');
      return;
    }
    setFile(f);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!theme.trim()) { setError('Le thème est requis.'); return; }
    if (!file) { setError('Veuillez sélectionner un fichier PDF.'); return; }
    if (!scolariteInfo?.is_solde) {
      setError('Votre scolarité doit être soldée pour déposer un mémoire.');
      return;
    }

    setSubmitting(true);
    setUploadProgress(0);
    setError(null);
    setSuccess(null);

    try {
      const token = localStorage.getItem('token');
      const studentId = localStorage.getItem('user_id');

      const formData = new FormData();
      formData.append('etudiant_id', studentId || '');
      formData.append('theme', theme);
      formData.append('fichier', file);

      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => (prev >= 90 ? 90 : prev + 10));
      }, 200);

      const url =
        isUpdateMode && memoireId && modifPossible
          ? `${API_URL}/api/memoire/${memoireId}/update`
          : `${API_URL}/api/memoire/deposer`;

      const response = await fetch(url, {
        method: isUpdateMode && memoireId && modifPossible ? 'PUT' : 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Erreur lors du dépôt');

      setSuccess(data.message || 'Opération réussie.');
      setTheme('');
      setFile(null);
      const input = document.getElementById('file-upload') as HTMLInputElement;
      if (input) input.value = '';

      setTimeout(() => window.location.reload(), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inattendue.');
    } finally {
      setSubmitting(false);
      setUploadProgress(0);
    }
  };

  // Télécharger le rapport d'analyse
  const handleDownloadRapport = async () => {
    if (!dernierMemoire?.rapport_analyse) return;
    
    try {
      const token = localStorage.getItem('token');
      const rapportUrl = `${API_URL}${dernierMemoire.rapport_analyse}`;
      
      const response = await fetch(rapportUrl, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Erreur lors du téléchargement');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      
      const fileName = dernierMemoire.rapport_analyse.split('/').pop() || 'rapport_analyse.pdf';
      link.href = url;
      link.download = fileName;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      // Notification de succès
      setSuccess('Rapport d\'analyse téléchargé avec succès');
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      console.error('Erreur de téléchargement:', error);
      setError('Erreur lors du téléchargement du rapport');
      setTimeout(() => setError(null), 3000);
    }
  };

  // Le formulaire est verrouillé si :
  // - mémoire en_attente et délai de 2h dépassé
  // - mémoire validé
  // - mémoire rejeté
  // - mémoire en cours de traitement
  const formBloque =
    !!dernierMemoire &&
    (dernierMemoire.statut === 'valide' ||
      dernierMemoire.statut === 'rejete' ||
      dernierMemoire.statut === 'encours' ||
      (dernierMemoire.statut === 'en_attente' && !modifPossible));

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Retour */}
        <button
          onClick={() => navigate('/espace-etudiant')}
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft size={16} />
          Retour à l'espace étudiant
        </button>

        {/* En-tête */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-gradient-to-br from-blue-700 to-indigo-700 p-6 text-white shadow-lg"
        >
          <div className="flex items-center gap-3 mb-1">
            <BookOpen size={24} />
            <h1 className="text-xl font-semibold tracking-tight">Dépôt de mémoire</h1>
          </div>
          <p className="text-blue-200 text-sm">
            Déposez votre mémoire au format PDF. La scolarité vous fera un retour sous 72 h.
          </p>
        </motion.div>

        {/* Infos étudiant */}
        {studentInfo && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5"
          >
            <div className="flex items-center gap-2 mb-4 text-slate-500 text-sm font-medium">
              <User size={15} />
              Informations de l'étudiant
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-400 text-xs mb-0.5">Nom complet</p>
                <p className="font-medium text-slate-800">{studentInfo.nom} {studentInfo.prenoms}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs mb-0.5">Classe</p>
                <p className="font-medium text-slate-800">{studentInfo.classe}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs mb-0.5">Filière</p>
                <p className="font-medium text-slate-800">{studentInfo.filiere}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs mb-0.5">Année académique</p>
                <p className="font-medium text-slate-800">{studentInfo.annee_academique}</p>
              </div>
            </div>

            {/* Statut scolarité */}
            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-2 text-sm">
              {scolariteInfo?.is_solde ? (
                <>
                  <BadgeCheck size={16} className="text-emerald-500 shrink-0" />
                  <span className="text-emerald-700 font-medium">Scolarité soldée</span>
                </>
              ) : (
                <>
                  <ShieldAlert size={16} className="text-red-500 shrink-0" />
                  <span className="text-red-700 font-medium">Scolarité non soldée — dépôt impossible</span>
                </>
              )}
            </div>
          </motion.div>
        )}

        {/* Bandeau mémoire existant */}
        {dernierMemoire && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            {/* En attente + modification possible */}
            {dernierMemoire.statut === 'en_attente' && modifPossible && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                <div className="flex items-start gap-3">
                  <RefreshCw size={18} className="text-amber-600 mt-0.5 shrink-0" />
                  <div className="text-sm">
                    <p className="font-semibold text-amber-800 mb-1">Modification possible</p>
                    <p className="text-amber-700">
                      Thème actuel : <span className="font-medium">{dernierMemoire.theme}</span>
                    </p>
                    <div className="flex items-center gap-1.5 mt-2 text-amber-600">
                      <CalendarClock size={14} />
                      <span>Déposé le {formatDateDepot(dernierMemoire.date_depot)}</span>
                    </div>
                    <div className="mt-3 flex items-start gap-2 bg-amber-100 rounded-xl px-3 py-2">
                      <Info size={14} className="text-amber-700 mt-0.5 shrink-0" />
                      <p className="text-xs text-amber-800">
                        Vous pouvez remplacer votre fichier et modifier le thème jusqu'à <strong>2 heures</strong> après le dépôt initial.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* En attente + délai dépassé */}
            {dernierMemoire.statut === 'en_attente' && !modifPossible && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex items-start gap-3">
                  <Clock size={18} className="text-slate-500 mt-0.5 shrink-0" />
                  <div className="text-sm">
                    <p className="font-semibold text-slate-700 mb-1">Mémoire en cours d'examen</p>
                    <p className="text-slate-600">
                      Thème : <span className="font-medium">{dernierMemoire.theme}</span>
                    </p>
                    <div className="flex items-center gap-1.5 mt-1 text-slate-500">
                      <CalendarClock size={14} />
                      <span>Déposé le {formatDateDepot(dernierMemoire.date_depot)}</span>
                    </div>
                    <div className="mt-3 flex items-start gap-2 bg-slate-100 rounded-xl px-3 py-2">
                      <Info size={14} className="text-slate-600 mt-0.5 shrink-0" />
                      <p className="text-xs text-slate-600">
                        Le délai de modification de 2 heures est dépassé. La scolarité vous fera un retour sous 72 h.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* En cours de traitement */}
            {dernierMemoire.statut === 'encours' && (
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
                <div className="flex items-start gap-3">
                  <PlayCircle size={18} className="text-blue-600 mt-0.5 shrink-0" />
                  <div className="text-sm">
                    <p className="font-semibold text-blue-800 mb-1">Mémoire en cours de traitement</p>
                    <p className="text-blue-700">
                      Thème : <span className="font-medium">{dernierMemoire.theme}</span>
                    </p>
                    <div className="flex items-center gap-1.5 mt-1 text-blue-600">
                      <CalendarClock size={14} />
                      <span>Déposé le {formatDateDepot(dernierMemoire.date_depot)}</span>
                    </div>
                    <div className="mt-3 flex items-start gap-2 bg-blue-100 rounded-xl px-3 py-2">
                      <Info size={14} className="text-blue-700 mt-0.5 shrink-0" />
                      <p className="text-xs text-blue-800">
                        Votre mémoire est en cours d'analyse par la scolarité. Un retour vous sera donné sous 72h.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Validé */}
            {dernierMemoire.statut === 'valide' && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                <div className="flex items-start gap-3">
                  <CheckCircle2 size={18} className="text-emerald-600 mt-0.5 shrink-0" />
                  <div className="text-sm">
                    <p className="font-semibold text-emerald-800 mb-1">Mémoire validé</p>
                    <p className="text-emerald-700">
                      Thème : <span className="font-medium">{dernierMemoire.theme}</span>
                    </p>
                    <div className="flex items-center gap-1.5 mt-1 text-emerald-600">
                      <CalendarClock size={14} />
                      <span>Déposé le {formatDateDepot(dernierMemoire.date_depot)}</span>
                    </div>
                    <div className="mt-3 flex items-start gap-2 bg-emerald-100 rounded-xl px-3 py-2">
                      <Info size={14} className="text-emerald-700 mt-0.5 shrink-0" />
                      <p className="text-xs text-emerald-800">
                        Votre mémoire est validé. Procédez au paiement des frais de soutenance et au dépôt de la version papier.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 🔥 Rejeté - AVEC AFFICHAGE DU MOTIF ET DU RAPPORT */}
            {dernierMemoire.statut === 'rejete' && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
                <div className="flex items-start gap-3">
                  <XCircle size={18} className="text-red-600 mt-0.5 shrink-0" />
                  <div className="text-sm flex-1">
                    <p className="font-semibold text-red-800 mb-1">Mémoire rejeté</p>
                    <p className="text-red-700">
                      Thème : <span className="font-medium">{dernierMemoire.theme}</span>
                    </p>
                    <div className="flex items-center gap-1.5 mt-1 text-red-600">
                      <CalendarClock size={14} />
                      <span>Déposé le {formatDateDepot(dernierMemoire.date_depot)}</span>
                    </div>
                    
                    {/* 🔥 Affichage du motif de rejet */}
                    {dernierMemoire.motif_refus && (
                      <div className="mt-3 flex items-start gap-2 bg-red-100 rounded-xl px-3 py-2 border border-red-200">
                        <MessageSquare size={14} className="text-red-700 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs font-medium text-red-800">Motif du rejet :</p>
                          <p className="text-xs text-red-700 mt-0.5">{dernierMemoire.motif_refus}</p>
                        </div>
                      </div>
                    )}

                    {/* 🔥 Affichage du rapport d'analyse si disponible */}
                    {dernierMemoire.rapport_analyse && (
                      <div className="mt-3 flex items-center gap-3 bg-blue-50 rounded-xl px-3 py-2 border border-blue-200">
                        <FilePdfOutlined size={16} className="text-blue-600 shrink-0" />
                        <span className="text-xs text-blue-700 font-medium">Rapport d'analyse disponible</span>
                        <button
                          onClick={handleDownloadRapport}
                          className="ml-auto flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition-colors"
                        >
                          <DownloadIcon size={14} />
                          Télécharger
                        </button>
                      </div>
                    )}
                    
                    <div className="mt-3 flex items-start gap-2 bg-red-100 rounded-xl px-3 py-2">
                      <AlertTriangle size={14} className="text-red-700 mt-0.5 shrink-0" />
                      <p className="text-xs text-red-800">
                        Consultez le motif de rejet ci-dessus et le rapport d'analyse pour les corrections à apporter. Vous pouvez soumettre une nouvelle version corrigée.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Formulaire de dépôt */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6"
        >
          <div className="flex items-center gap-2 mb-5 text-slate-600 text-sm font-medium">
            {isUpdateMode && modifPossible
              ? <><RefreshCw size={15} className="text-amber-500" /> Remplacer mon mémoire</>
              : <><FilePlus2 size={15} className="text-blue-600" /> Nouveau dépôt</>
            }
          </div>

          {/* Scolarité non soldée */}
          {!scolariteInfo?.is_solde && (
            <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <ShieldAlert size={16} className="mt-0.5 shrink-0" />
              Réglez votre scolarité avant de pouvoir déposer un mémoire.
            </div>
          )}

          {/* Formulaire bloqué */}
          {formBloque && scolariteInfo?.is_solde && (
            <div className="mb-5 flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <Info size={16} className="mt-0.5 shrink-0 text-slate-400" />
              {dernierMemoire?.statut === 'encours' && 'Votre mémoire est en cours de traitement. Aucune modification n\'est possible.'}
              {dernierMemoire?.statut === 'valide' && 'Votre mémoire est validé. Aucune modification n\'est possible.'}
              {dernierMemoire?.statut === 'rejete' && 'Votre mémoire a été rejeté. Veuillez consulter le motif ci-dessus et soumettre une nouvelle version corrigée.'}
              {dernierMemoire?.statut === 'en_attente' && !modifPossible && 'Le délai de modification est dépassé. La scolarité traite votre dossier.'}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Champ thème */}
            <div>
              <label htmlFor="theme" className="block text-sm font-medium text-slate-700 mb-1.5">
                Thème du mémoire <span className="text-red-500">*</span>
              </label>
              <input
                id="theme"
                type="text"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                disabled={submitting || !scolariteInfo?.is_solde || formBloque}
                placeholder="Ex : L'intelligence artificielle dans la gestion d'entreprise"
                className={`w-full px-4 py-2.5 text-sm rounded-xl border outline-none transition-all
                  ${!scolariteInfo?.is_solde || formBloque
                    ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                    : 'border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-slate-800'
                  }`}
              />
            </div>

            {/* Zone fichier */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Fichier PDF <span className="text-red-500">*</span>
              </label>
              <div
                className={`relative border-2 border-dashed rounded-xl transition-all
                  ${!scolariteInfo?.is_solde || formBloque
                    ? 'border-slate-200 bg-slate-50'
                    : file
                      ? 'border-emerald-400 bg-emerald-50'
                      : 'border-slate-300 hover:border-blue-400 hover:bg-blue-50/40'
                  }`}
              >
                <input
                  id="file-upload"
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange}
                  disabled={submitting || !scolariteInfo?.is_solde || formBloque}
                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer disabled:cursor-not-allowed"
                />
                <div className="flex flex-col items-center gap-2 py-8 px-4 pointer-events-none">
                  {file ? (
                    <>
                      <FileText size={36} className="text-emerald-500" />
                      <p className="text-sm font-medium text-slate-700">{file.name}</p>
                      <p className="text-xs text-slate-400">{(file.size / 1024 / 1024).toFixed(2)} Mo</p>
                    </>
                  ) : (
                    <>
                      <Upload
                        size={36}
                        className={!scolariteInfo?.is_solde || formBloque ? 'text-slate-300' : 'text-slate-400'}
                      />
                      <p className={`text-sm ${!scolariteInfo?.is_solde || formBloque ? 'text-slate-400' : 'text-slate-500'}`}>
                        {formBloque
                          ? 'Dépôt désactivé'
                          : isUpdateMode && modifPossible
                            ? 'Cliquez pour remplacer le fichier PDF actuel'
                            : 'Cliquez pour sélectionner votre PDF'}
                      </p>
                      <p className="text-xs text-slate-400">PDF uniquement — 10 Mo maximum</p>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Barre de progression */}
            <AnimatePresence>
              {submitting && uploadProgress > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${uploadProgress}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                  <p className="text-xs text-slate-400 mt-1 text-center">Envoi en cours… {uploadProgress}%</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Messages d'erreur / succès */}
            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                >
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  {error}
                </motion.div>
              )}
              {success && (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
                >
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                  {success}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Bouton soumettre */}
            <button
              type="submit"
              disabled={submitting || !scolariteInfo?.is_solde || formBloque || !theme.trim() || !file}
              className={`w-full py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2
                ${submitting || !scolariteInfo?.is_solde || formBloque || !theme.trim() || !file
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : isUpdateMode && modifPossible
                    ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm'
                    : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
                }`}
            >
              {submitting
                ? <><Loader2 size={16} className="animate-spin" /> Traitement en cours…</>
                : isUpdateMode && modifPossible
                  ? <><RefreshCw size={16} /> Remplacer mon mémoire</>
                  : <><Upload size={16} /> Déposer mon mémoire</>
              }
            </button>
          </form>

          {/* Note informative bas de formulaire */}
          {scolariteInfo?.is_solde && !formBloque && (
            <div className="mt-5 flex items-start gap-2 rounded-xl bg-blue-50 border border-blue-100 px-4 py-3">
              <Clock size={14} className="text-blue-500 mt-0.5 shrink-0" />
              <p className="text-xs text-blue-700">
                Après le dépôt, vous disposez de <strong>2 heures</strong> pour remplacer votre fichier ou corriger le thème.
                Passé ce délai, plus aucune modification n'est possible jusqu'au retour de la scolarité.
              </p>
            </div>
          )}
        </motion.div>

        {/* Pied de page informatif */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5"
        >
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
            Processus après dépôt
          </p>
          <div className="space-y-3">
            {[
              {
                icon: <Clock size={15} className="text-blue-500" />,
                text: 'La scolarité examine votre mémoire dans un délai de 72 heures.',
              },
              {
                icon: <CheckCircle2 size={15} className="text-emerald-500" />,
                text: 'Si validé : procédez au paiement des frais de soutenance et au dépôt de la version papier.',
              },
              {
                icon: <AlertTriangle size={15} className="text-amber-500" />,
                text: 'Si rejeté : le motif vous est communiqué avec un rapport d\'analyse détaillé. Vous pourrez soumettre une version corrigée.',
              },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3 text-sm text-slate-600">
                <span className="mt-0.5 shrink-0">{item.icon}</span>
                {item.text}
              </div>
            ))}
          </div>
        </motion.div>

      </div>
    </div>
  );
};

export default DepotMemoire;