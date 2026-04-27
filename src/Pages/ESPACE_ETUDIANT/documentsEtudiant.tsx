import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  FileText, 
  CheckCircle, 
  XCircle, 
  ArrowLeft,
  User,
  Calendar,
  CreditCard,
  GraduationCap,
  Navigation,
  AlertCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Documents {
  extrait_naissance: string;
  justificatif_identite: string;
  dernier_diplome: string;
  fiche_orientation: string;
  statut_documents: {
    complet: boolean;
  };
}

interface StudentInfo {
  nom: string;
  prenoms: string;
  classe: string;
  filiere: string;
  photo_url: string;
}

const DocumentsEtudiant = () => {
  const [documents, setDocuments] = useState<Documents | null>(null);
  const [studentInfo, setStudentInfo] = useState<StudentInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const API_URL = import.meta.env.VITE_API_URL_SERVER || '';
  const navigate = useNavigate();

  useEffect(() => {
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
          throw new Error(`Erreur HTTP: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        
        if (data.informations_personnelles && data.informations_academiques) {
          let photoUrl = data.informations_personnelles.photo_url || '';
          
          if (photoUrl.startsWith('/uploads/')) {
            photoUrl = `${API_URL}${photoUrl}`;
          }
          
          setStudentInfo({
            nom: data.informations_personnelles.nom,
            prenoms: data.informations_personnelles.prenoms,
            classe: data.informations_academiques.classe,
            filiere: data.informations_academiques.filiere,
            photo_url: photoUrl,
          });
        }

        if (data.documents) {
          setDocuments(data.documents);
        }

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Une erreur inconnue est survenue');
      } finally {
        setLoading(false);
      }
    };

    fetchStudentData();
  }, [API_URL]);

  const handleBack = () => {
    navigate('/espace-etudiant');
  };

  const getDocumentIcon = (documentType: string) => {
    switch (documentType) {
      case 'extrait_naissance':
        return <Calendar size={20} className="text-blue-500" />;
      case 'justificatif_identite':
        return <CreditCard size={20} className="text-green-500" />;
      case 'dernier_diplome':
        return <GraduationCap size={20} className="text-purple-500" />;
      case 'fiche_orientation':
        return <Navigation size={20} className="text-orange-500" />;
      default:
        return <FileText size={20} className="text-gray-500" />;
    }
  };

  const getDocumentLabel = (documentType: string) => {
    switch (documentType) {
      case 'extrait_naissance':
        return 'Extrait de naissance';
      case 'justificatif_identite':
        return 'Justificatif d\'identité';
      case 'dernier_diplome':
        return 'Dernier diplôme';
      case 'fiche_orientation':
        return 'Fiche d\'orientation';
      default:
        return documentType;
    }
  };

  const getStatusIcon = (status: string) => {
    return status === 'oui' ? 
      <CheckCircle size={20} className="text-green-500" /> : 
      <XCircle size={20} className="text-red-500" />;
  };

  // Fonction pour obtenir la liste des documents manquants
  const getMissingDocuments = () => {
    if (!documents) return [];
    
    return Object.entries(documents)
      .filter(([key, value]) => key !== 'statut_documents' && value === 'non')
      .map(([key]) => getDocumentLabel(key));
  };

  const missingDocuments = getMissingDocuments();

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50">
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
            Chargement de vos documents...
          </motion.p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white border border-red-200 text-red-700 px-6 py-6 rounded-lg max-w-md shadow-sm"
        >
          <p className="font-semibold text-center mb-2">Erreur de chargement</p>
          <p className="text-center text-sm mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="w-full bg-red-600 hover:bg-red-700 text-white py-2 rounded transition-colors"
          >
            Réessayer
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-10 font-sans">
      {/* Header */}
      <motion.header 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-white shadow-sm border-b border-gray-200 p-4 sticky top-0 z-10"
      >
        <div className="flex items-center">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleBack}
            className="flex items-center text-blue-600 hover:text-blue-800 font-medium mr-4 p-2 rounded-lg hover:bg-blue-50 transition-colors"
          >
            <ArrowLeft size={20} className="mr-2" />
            Retour
          </motion.button>
          <h1 className="text-xl font-bold text-gray-800">Mes Documents</h1>
        </div>
      </motion.header>

      <div className="max-w-4xl mx-auto px-4">
        {/* En-tête étudiant */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-6"
        >
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-gray-100">
            <div className="flex items-center">
              {studentInfo?.photo_url ? (
                <img 
                  src={studentInfo.photo_url} 
                  alt="Photo de profil" 
                  className="w-16 h-16 rounded-full object-cover border-2 border-gray-200 mr-4"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mr-4 border-2 border-gray-200">
                  <User size={24} className="text-gray-600" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold text-gray-800 truncate">
                  {studentInfo?.nom} {studentInfo?.prenoms}
                </h2>
                <p className="text-sm text-gray-600 truncate">{studentInfo?.classe} • {studentInfo?.filiere}</p>
                
                {documents?.statut_documents && (
                  <div className={`mt-2 inline-flex items-center px-3 py-1 rounded-full border text-sm font-medium ${
                    documents.statut_documents.complet 
                      ? 'text-green-800 bg-green-100 border-green-200' 
                      : 'text-red-800 bg-red-100 border-red-200'
                  }`}>
                    {documents.statut_documents.complet ? (
                      <CheckCircle size={16} className="mr-1" />
                    ) : (
                      <AlertCircle size={16} className="mr-1" />
                    )}
                    <span>
                      {documents.statut_documents.complet ? 'Dossier complet' : 'Dossier incomplet'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Message si dossier incomplet */}
        {documents && !documents.statut_documents.complet && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mb-6"
          >
            <div className="bg-red-50 border border-red-200 rounded-lg p-5">
              <div className="flex items-start">
                <AlertCircle size={24} className="text-red-600 mr-3 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-medium text-red-800 text-lg mb-2">Dossier incomplet</h3>
                  <p className="text-red-700 mb-3">
                    Votre dossier de documents n'est pas complet. Veuillez vous rendre à l'école pour déposer les documents manquants.
                  </p>
                  
                  <div className="bg-red-100 p-3 rounded-lg">
                    <h4 className="font-medium text-red-800 mb-2">Documents manquants :</h4>
                    <ul className="text-red-700 list-disc pl-5">
                      {missingDocuments.map((doc, index) => (
                        <li key={index}>{doc}</li>
                      ))}
                    </ul>
                  </div>
                  
                  <p className="text-red-700 mt-3 text-sm">
                    <strong>Contact :</strong> Service administratif - Bureau de la scolarité<br/>
                    <strong>Horaires :</strong> Lundi au Vendredi, 8h-12h et 14h-17h
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Liste des documents */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-xl shadow-sm p-5 border border-gray-100"
        >
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Documents requis</h2>
          <p className="text-sm text-gray-600 mb-6">
            Voici la liste des documents requis pour votre dossier étudiant.
          </p>

          <div className="space-y-4">
            {documents && Object.entries(documents)
              .filter(([key]) => key !== 'statut_documents')
              .map(([documentType, status]) => (
                <div key={documentType} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center">
                    <div className="p-2 rounded-lg bg-gray-100 mr-4">
                      {getDocumentIcon(documentType)}
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-800">{getDocumentLabel(documentType)}</h3>
                      <p className="text-sm text-gray-600">
                        {status === 'oui' ? 'Document déposé' : 'Document manquant'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center">
                    <span className="flex items-center">
                      {getStatusIcon(status)}
                      <span className="ml-2 text-sm font-medium">
                        {status === 'oui' ? 'Disponible' : 'Manquant'}
                      </span>
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </motion.div>

        {/* Message si dossier complet */}
        {documents && documents.statut_documents.complet && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-6 bg-green-50 border border-green-200 rounded-lg p-5"
          >
            <div className="flex items-start">
              <CheckCircle size={24} className="text-green-600 mr-3 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-medium text-green-800 text-lg mb-2">Dossier complet</h3>
                <p className="text-green-700">
                  Félicitations ! Votre dossier de documents est complet. Aucune action n'est requise de votre part.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default DocumentsEtudiant;