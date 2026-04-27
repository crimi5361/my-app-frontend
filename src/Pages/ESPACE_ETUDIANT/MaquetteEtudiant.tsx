 
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BookOpen,
  Users,
  ArrowLeft,
  GraduationCap,
  FileText,
  Award,
  ChevronDown,
  ChevronUp,
  Calendar
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface UE {
  id: number;
  libelle: string;
  semestre_id: number;
  semestre_libelle: string;
  categorie_id: number;
  categorie_nom: string;
  credit_total?: number;
  matieres?: Matiere[];
}

interface Matiere {
  id: number;
  nom: string;
  coefficient: number;
  ue_id: number;
  volume_horaire_cm: number;
  taux_horaire_cm: number;
  volume_horaire_td: number;
  taux_horaire_td: number;
}

interface SemestreData {
  id: number;
  libelle: string;
  ues: UE[];
}

interface MaquetteDetail {
  id: number;
  filiere_nom: string;
  filiere_sigle: string;
  niveau_libelle: string;
  annee_academique: string;
  parcour: string;
  date_creation: string;
  annee_id: number;
}

interface StudentData {
  informations_academiques: {
    filiere: string;
    niveau: string;
    classe: string;
    groupe: string;
    sigle_filiere: string;
  };
}

const MaquetteEtudiant = () => {
  const navigate = useNavigate();
  const [studentData, setStudentData] = useState<StudentData | null>(null);
  const [maquetteDetail, setMaquetteDetail] = useState<MaquetteDetail | null>(null);
  const [semestres, setSemestres] = useState<SemestreData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMaquette, setLoadingMaquette] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSemestres, setExpandedSemestres] = useState<number[]>([]);
  const [expandedUEs, setExpandedUEs] = useState<number[]>([]);
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');
  const API_URL = import.meta.env.VITE_API_URL_SERVER || "";

  useEffect(() => {
    fetchStudentData();
  }, []);

  const handleGoBack = () => {
    navigate(-1);
  };

  const toggleSemestre = (semestreId: number) => {
    setExpandedSemestres(prev =>
      prev.includes(semestreId)
        ? prev.filter(id => id !== semestreId)
        : [...prev, semestreId]
    );
  };

  const toggleUE = (ueId: number) => {
    setExpandedUEs(prev =>
      prev.includes(ueId)
        ? prev.filter(id => id !== ueId)
        : [...prev, ueId]
    );
  };

  const fetchStudentData = async () => {
    try {
      const token = localStorage.getItem('token');
      const studentId = localStorage.getItem('user_id');
      
      if (!token || !studentId) {
        setError('Token ou ID étudiant manquant');
        setLoading(false);
        return;
      }

      const response = await fetch(`${API_URL}/api/donneeespaceetudiant/profile/${studentId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Erreur lors du chargement des données étudiant');
      }

      const data = await response.json();
      setStudentData(data);
      
      if (data.informations_academiques) {
        fetchMaquetteForStudent(data.informations_academiques);
      }
    } catch (error) {
      console.error('Erreur:', error);
      setError('Erreur lors du chargement des données étudiant');
      setLoading(false);
    }
  };

  const normalizeName = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\b(scj|sic|adaf|lic|licence|master|doctorat)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const extractNiveau = (name: string): string => {
    const niveauMatch = name.match(/(licence|master|doctorat)\s*(\d+)/i);
    return niveauMatch ? `${niveauMatch[1]} ${niveauMatch[2]}`.toLowerCase() : '';
  };

  const extractFiliere = (name: string): string => {
    return name
      .replace(/(licence|master|doctorat)\s*\d+/gi, '')
      .replace(/\b(scj|sic|adaf)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  };

  const fetchMaquetteForStudent = async (academicInfo: any) => {
    setLoadingMaquette(true);
    try {
      const response = await fetch(`${API_URL}/api/maquettes`);
      const data = await response.json();
      
      if (Array.isArray(data)) {
        const maquettesFiltrees = data.filter(maquette => {
          const nomClasseNormalise = normalizeName(academicInfo.classe);
          const nomMaquetteNormalise = normalizeName(`${maquette.filiere_nom} ${maquette.niveau_libelle}`);
          
          const filiereClasse = extractFiliere(academicInfo.classe);
          const filiereMaquette = extractFiliere(maquette.filiere_nom);
          
          const niveauClasse = extractNiveau(academicInfo.classe);
          const niveauMaquette = extractNiveau(maquette.niveau_libelle);

          const correspondanceFiliere = filiereClasse.includes(filiereMaquette) || 
                                      filiereMaquette.includes(filiereClasse);
          const correspondanceNiveau = niveauClasse === niveauMaquette;
          const correspondanceExacte = correspondanceFiliere && correspondanceNiveau;
          const correspondancePartielle = nomClasseNormalise.includes(nomMaquetteNormalise) || 
                                        nomMaquetteNormalise.includes(nomClasseNormalise);

          return correspondanceExacte || correspondancePartielle;
        });
        
        if (maquettesFiltrees.length > 0) {
          fetchMaquetteDetail(maquettesFiltrees[0].id);
        } else {
          setError('Aucune maquette trouvée pour votre classe');
          setLoading(false);
          setLoadingMaquette(false);
        }
      } else {
        setError('Aucune maquette disponible');
        setLoading(false);
        setLoadingMaquette(false);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des maquettes:', error);
      setError('Erreur lors du chargement de la maquette');
      setLoading(false);
      setLoadingMaquette(false);
    }
  };

  const fetchMaquetteDetail = async (maquetteId: number) => {
    try {
      const response = await fetch(`${API_URL}/api/detailaffichageMaquette/maquettes/${maquetteId}/structured`);
      
      if (!response.ok) {
        throw new Error('Erreur de chargement des détails de la maquette');
      }

      const data = await response.json();
      setMaquetteDetail(data.maquette);
      setSemestres(data.semestres || []);
      // Développer le premier semestre par défaut
      if (data.semestres && data.semestres.length > 0) {
        setExpandedSemestres([data.semestres[0].id]);
      }
    } catch (error) {
      console.error('Erreur détaillée:', error);
      setError('Erreur lors du chargement des détails de la maquette');
    } finally {
      setLoading(false);
      setLoadingMaquette(false);
    }
  };

  // Composant pour l'affichage en tableau (Desktop)
  const TableView = ({ semestre }: { semestre: SemestreData }) => {
    const totalCM = semestre.ues.flatMap(ue => ue.matieres || []).reduce((total, m) => total + (m.volume_horaire_cm || 0), 0);
    const totalTD = semestre.ues.flatMap(ue => ue.matieres || []).reduce((total, m) => total + (m.volume_horaire_td || 0), 0);
    const totalCoeff = semestre.ues.flatMap(ue => ue.matieres || []).reduce((total, m) => {
      const coeff = typeof m.coefficient === 'string' ? parseFloat(m.coefficient) : m.coefficient;
      return total + (coeff || 0);
    }, 0);

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8"
      >
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {/* En-tête du semestre */}
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <FileText size={20} className="text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-800">SEMESTRE {semestre.libelle}</h3>
              </div>
              <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                {semestre.ues?.length || 0} UE(s)
              </span>
            </div>
          </div>

          {/* Tableau des matières */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                    UE / Matières
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                    Coefficient
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                    Volume Horaire CM
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Volume Horaire TD
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {semestre.ues?.map((ue) => (
                  <>
                    {/* Ligne UE */}
                    <tr key={`ue-${ue.id}`} className="bg-blue-50 hover:bg-blue-100 transition-colors">
                      <td colSpan={4} className="px-6 py-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <BookOpen size={16} className="text-blue-600" />
                            <span className="font-semibold text-blue-900">{ue.libelle}</span>
                          </div>
                          
                        </div>
                      </td>
                    </tr>
                    
                    {/* Matières de l'UE */}
                    {ue.matieres?.map((matiere, matiereIndex) => (
                      <tr 
                        key={`matiere-${matiere.id}`}
                        className={matiereIndex % 2 === 0 ? 'bg-gray-50 hover:bg-gray-100' : 'bg-white hover:bg-gray-50'}
                      >
                        <td className="px-8 py-3 text-sm text-gray-800 border-r border-gray-200">
                          {matiere.nom}
                        </td>
                        <td className="px-6 py-3 text-center text-sm text-gray-700 border-r border-gray-200">
                          <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs font-medium">
                            {typeof matiere.coefficient === 'string' ? parseFloat(matiere.coefficient) : matiere.coefficient}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-center text-sm text-gray-700 border-r border-gray-200">
                          {matiere.volume_horaire_cm}h
                        </td>
                        <td className="px-6 py-3 text-center text-sm text-gray-700">
                          {matiere.volume_horaire_td}h
                        </td>
                      </tr>
                    ))}
                  </>
                ))}
                
                {/* Ligne total */}
                <tr className="bg-gray-100 font-semibold">
                  <td className="px-6 py-3 text-sm text-gray-800 border-r border-gray-300">
                    TOTAL SEMESTRE {semestre.libelle}
                  </td>
                  <td className="px-6 py-3 text-center text-sm text-gray-700 border-r border-gray-300">
                    <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">
                      {totalCoeff}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-center text-sm text-gray-700 border-r border-gray-300">
                    {totalCM}h
                  </td>
                  <td className="px-6 py-3 text-center text-sm text-gray-700">
                    {totalTD}h
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>
    );
  };

  // Composant pour l'affichage en cartes (Mobile)
  const CardView = ({ semestre }: { semestre: SemestreData }) => {
    const isExpanded = expandedSemestres.includes(semestre.id);
    
    return (
      <motion.div layout className="mb-4">
        <motion.div
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={() => toggleSemestre(semestre.id)}
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <FileText size={20} className="text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-800">SEMESTRE {semestre.libelle}</h3>
            </div>
            <div className="flex items-center space-x-2">
              <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                {semestre.ues?.length || 0} UE(s)
              </span>
              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
          </div>
        </motion.div>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="mt-2 space-y-2"
            >
              {semestre.ues?.map((ue) => (
                <MobileUEView key={ue.id} ue={ue} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  };

  const MobileUEView = ({ ue }: { ue: UE }) => {
    const isExpanded = expandedUEs.includes(ue.id);
    
    return (
      <motion.div layout className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
        <div 
          className="flex items-center justify-between cursor-pointer"
          onClick={() => toggleUE(ue.id)}
        >
          <div className="flex items-center space-x-2">
            <BookOpen size={16} className="text-blue-600" />
            <h4 className="text-sm font-semibold text-gray-800 flex-1">{ue.libelle}</h4>
          </div>
          <div className="flex items-center space-x-2">
            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
              {ue.credit_total || 0} cr.
            </span>
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </div>
        </div>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="mt-2 space-y-2"
            >
              {ue.matieres?.map((matiere) => (
                <motion.div
                  key={matiere.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-gray-50 rounded-lg p-3 border border-gray-100"
                >
                  <div className="flex justify-between items-start mb-2">
                    <h5 className="font-medium text-gray-800 text-sm leading-tight flex-1">
                      {matiere.nom}
                    </h5>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex space-x-2">
                      <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs font-medium">
                        Coeff: {typeof matiere.coefficient === 'string' ? parseFloat(matiere.coefficient) : matiere.coefficient}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="flex space-x-2 text-xs text-gray-600">
                        <span>CM: {matiere.volume_horaire_cm}h</span>
                        <span>TD: {matiere.volume_horaire_td}h</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex justify-center items-center">
        <div className="text-center">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-600 mx-auto mb-4"
          ></motion.div>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-gray-700 font-medium"
          >
            Chargement de votre maquette pédagogique...
          </motion.p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex justify-center items-center p-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white rounded-lg p-6 max-w-md w-full shadow-sm border border-gray-200"
        >
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleGoBack}
            className="flex items-center text-blue-600 hover:text-blue-800 font-medium mb-4 p-2 rounded-lg hover:bg-blue-50 transition-colors"
          >
            <ArrowLeft size={20} className="mr-2" />
            Retour
          </motion.button>
          <div className="text-center text-red-600">
            <GraduationCap size={48} className="mx-auto mb-3 opacity-50" />
            <p className="font-semibold mb-2">{error}</p>
            <p className="text-sm text-gray-600">
              Impossible de charger la maquette pédagogique de votre classe.
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-10 font-sans">
      <div className="container mx-auto px-4">
        {/* Header */}
        <motion.header 
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-white shadow-sm border-b border-gray-200 p-4 sticky top-0 z-20"
        >
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <motion.button
                  whileHover={{ scale: 1.05, x: -2 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleGoBack}
                  className="flex items-center text-blue-600 hover:text-blue-800 font-medium mr-4 p-2 rounded-lg hover:bg-blue-50 transition-all duration-200"
                >
                  <ArrowLeft size={20} className="mr-2" />
                  Retour
                </motion.button>
                <h1 className="text-xl md:text-2xl font-bold text-gray-800">
                  Maquette Pédagogique
                </h1>
              </div>
              
              {/* Sélecteur de vue (Desktop seulement) */}
              <div className="hidden md:flex items-center space-x-2 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('table')}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'table' 
                      ? 'bg-white text-blue-600 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  Tableau
                </button>
                <button
                  onClick={() => setViewMode('card')}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'card' 
                      ? 'bg-white text-blue-600 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  Cartes
                </button>
              </div>
            </div>
          </div>
        </motion.header>

        {/* Contenu principal */}
        <div className="max-w-6xl mx-auto mt-6">
          {/* Titre principal */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-center mb-8"
          >
            <div className="bg-white rounded-lg p-2 shadow-sm border border-gray-200">
              <BookOpen size={32} className="mx-auto mb-3 text-blue-600" />
              <h2 className="text-xl md:text-xl font-bold text-gray-800">PROGRAMME DE FORMATION</h2>
            </div>
          </motion.div>

          {/* Informations étudiant */}
          {studentData && studentData.informations_academiques && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white rounded-lg p-2 mb-4 shadow-sm border border-gray-200"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4">
                  <Users size={24} className="mx-auto mb-2 text-blue-600" />
                  <p className="text-sm text-gray-600">Filière</p>
                  <p className="font-semibold text-gray-800 text-sm">{studentData.informations_academiques.filiere}</p>
                </div>
                <div className="text-center p-4">
                  <GraduationCap size={24} className="mx-auto mb-2 text-green-600" />
                  <p className="text-sm text-gray-600">Niveau</p>
                  <p className="font-semibold text-gray-800 text-sm">{studentData.informations_academiques.niveau}</p>
                </div>
                <div className="text-center p-4">
                  <Award size={24} className="mx-auto mb-2 text-purple-600" />
                  <p className="text-sm text-gray-600">Classe</p>
                  <p className="font-semibold text-gray-800 text-sm">{studentData.informations_academiques.classe}</p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Informations maquette */}
          {maquetteDetail && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-blue-50 rounded-lg p-6 mb-8 border border-blue-200"
            >
              <div className="flex items-center justify-center space-x-4">
                <Calendar size={20} className="text-blue-600" />
                <span className="text-sm text-gray-600">Année académique :</span>
                <span className="font-semibold text-blue-800">{maquetteDetail.annee_academique}</span>
              </div>
            </motion.div>
          )}

          {/* Affichage des semestres */}
          {loadingMaquette ? (
            <div className="text-center py-12">
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="rounded-full h-12 w-12 border-t-4 border-b-4 border-blue-600 mx-auto mb-4"
              ></motion.div>
              <p className="text-gray-700">Chargement du programme...</p>
            </div>
          ) : semestres && semestres.length > 0 ? (
            <>
              {/* Version Desktop avec choix de vue */}
              <div className="hidden md:block">
                {viewMode === 'table' ? (
                  semestres.map((semestre) => (
                    <TableView key={semestre.id} semestre={semestre} />
                  ))
                ) : (
                  <div className="space-y-4">
                    {semestres.map((semestre) => (
                      <CardView key={semestre.id} semestre={semestre} />
                    ))}
                  </div>
                )}
              </div>

              {/* Version Mobile (toujours en cartes) */}
              <div className="md:hidden">
                {semestres.map((semestre) => (
                  <CardView key={semestre.id} semestre={semestre} />
                ))}
              </div>
            </>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-12 bg-white rounded-lg shadow-sm border border-gray-200"
            >
              <BookOpen size={48} className="mx-auto mb-4 text-gray-400" />
              <p className="text-gray-600">Aucun semestre disponible pour cette maquette</p>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MaquetteEtudiant;