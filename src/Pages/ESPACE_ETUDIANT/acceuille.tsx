import { useState, useEffect } from 'react';
import { 
  CreditCard, 
  FileText, 
  User, 
  BarChart3, 
  Key, 
  Car, 
  CreditCard as CardIcon,
  LogOut,
  School,
  Calendar,
  BookOpen,
  ClipboardList,
  QrCode,
  Sparkles} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';

interface StudentInfo {
  nom: string;
  prenoms: string;
  classe: string;
  annee_academique: string;
  filiere: string;
  type_parcours: string;
  photo_url: string;
  groupe: string;
}

const Acceuille = () => {
  const [studentInfo, setStudentInfo] = useState<StudentInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, setIsMobileMenuOpen] = useState(false);
  const [hasPlayedConfetti, setHasPlayedConfetti] = useState(false);
  const API_URL = import.meta.env.VITE_API_URL_SERVER || '';
  const navigate = useNavigate();

  useEffect(() => {

    const fetchStudentData = async () => {
      try {
        const token = localStorage.getItem('token');
        const studentId = localStorage.getItem('user_id');
        
        if (!token || !studentId) {
          navigate('/login');
          return;
        }

        const response = await fetch(`${API_URL}/api/donneeespaceetudiant/profile/${studentId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          if (response.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user_id');
            navigate('/login');
            return;
          }
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
            annee_academique: data.informations_academiques.annee_academique,
            filiere: data.informations_academiques.filiere,
            type_parcours: data.informations_academiques.type_parcours,
            photo_url: photoUrl,
            groupe: data.informations_academiques.groupe
          });

          if (!hasPlayedConfetti) {
            setTimeout(() => {
              confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#667eea', '#764ba2', '#f093fb', '#f5576c']
              });
              setHasPlayedConfetti(true);
            }, 1000);
          }
        }
      } catch (err) {
        if (err instanceof Error && err.message.includes('401')) {
          localStorage.removeItem('token');
          localStorage.removeItem('user_id');
          navigate('/login');
          return;
        }
        setError(err instanceof Error ? err.message : 'Une erreur inconnue est survenue');
      } finally {
        setLoading(false);
      }
    };

    fetchStudentData();
  }, [API_URL, hasPlayedConfetti, navigate]);

  const handleNavigation = (path: string) => {
    navigate(path);
    setIsMobileMenuOpen(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user_id');
    navigate('/login');
  };

  /**
   * Vérifie si l'étudiant peut voir le bouton "Dépot de mon memoire"
   * Condition: la classe doit contenir "LICENCE 3" ou "MASTER 2"
   * (car la classe peut être comme: "SCIENCES JURIDIQUES ... LICENCE 3")
   */
  const canSeeMemoireButton = (): boolean => {
    if (!studentInfo?.classe) return false;
    const classe = studentInfo.classe.toUpperCase();
    return classe.includes('LICENCE 3') || classe.includes('MASTER 2');
  };

  // Couleurs pastel pour les cartes
  const pastelColors = [
    'bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-100',
    'bg-gradient-to-br from-purple-50 to-pink-50 border-purple-100',
    'bg-gradient-to-br from-green-50 to-emerald-50 border-green-100',
    'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-100',
    'bg-gradient-to-br from-red-50 to-rose-50 border-red-100',
    'bg-gradient-to-br from-indigo-50 to-violet-50 border-indigo-100',
    'bg-gradient-to-br from-teal-50 to-cyan-50 border-teal-100',
    'bg-gradient-to-br from-rose-50 to-pink-50 border-rose-100',
    'bg-gradient-to-br from-lime-50 to-green-50 border-lime-100',
    'bg-gradient-to-br from-sky-50 to-blue-50 border-sky-100',
    'bg-gradient-to-br from-gray-50 to-slate-50 border-gray-100'
  ];

  // Couleurs vives pour les icônes
  const iconColors = [
    'text-blue-600',
    'text-purple-600',
    'text-green-600',
    'text-amber-600',
    'text-red-600',
    'text-indigo-600',
    'text-teal-600',
    'text-pink-600',
    'text-lime-600',
    'text-sky-600',
    'text-gray-600'
  ];

  // Construction du tableau des cartes avec condition pour le bouton mémoire
  const allCards = [
    {
      id: 'scolarite',
      title: 'Scolarités',
      icon: CreditCard,
      colorIndex: 0,
      path: '/espace-etudiant/scolarite',
    },
    {
      id: 'documents',
      title: 'Documents',
      icon: FileText,
      colorIndex: 1,
      path: '/espace-etudiant/documents',
    },
    {
      id: 'acces',
      title: 'Mes Accès',
      icon: Key,
      colorIndex: 2,
      path: '#',
    },
    {
      id: 'carte',
      title: 'Ma Carte',
      icon: CardIcon,
      colorIndex: 3,
      path: '#',
    },
    {
      id: 'notes',
      title: 'Mes Notes',
      icon: BarChart3,
      colorIndex: 4,
      path: '#',
    },
    {
      id: 'profil',
      title: 'Mettre à jour Profil',
      icon: User,
      colorIndex: 5,
      path: '/espace-etudiant/profil',
    },
    {
      id: 'cours',
      title: 'Cours',
      icon: BookOpen,
      colorIndex: 6,
      path: '#',
    },
    {
      id: 'emploi-du-temps',
      title: 'Emploi du temps',
      icon: Calendar,
      colorIndex: 7,
      path: '/espace-etudiant/emploi-du-temps',
    },
    {
      id: 'maquette',
      title: 'Maquette Pédagogique',
      icon: ClipboardList,
      colorIndex: 8,
      path: '/espace-etudiant/maquette-pedagogique',
    },
    {
      id: 'transports',
      title: 'Cars & Transports',
      icon: Car,
      colorIndex: 9,
      path: '#',
    },
    // BOUTON MEMOIRE : s'affiche uniquement si la classe contient LICENCE 3 ou MASTER 2
    ...(canSeeMemoireButton() ? [{
      id: 'memoire',
      title: 'Depot de mon memoire',
      icon: BookOpen,
      colorIndex: 9,
      path: '/espace-etudiant/depot-memoire',
    }] : []),
    {
      id: 'deconnexion',
      title: 'Déconnexion',
      icon: LogOut,
      colorIndex: 10,
      action: handleLogout,
    }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 flex justify-center items-center">
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
            Chargement de vos informations...
          </motion.p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 flex justify-center items-center">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white/80 backdrop-blur-lg border border-red-200 text-red-700 px-6 py-6 rounded-2xl max-w-md shadow-lg"
        >
          <p className="font-semibold text-center mb-2">Erreur de chargement</p>
          <p className="text-center text-sm mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="w-full bg-red-600 hover:bg-red-700 text-white py-2 rounded-xl transition-all duration-300 hover:scale-105"
          >
            Réessayer
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 pb-10 font-sans relative overflow-hidden">
      {/* Fond animé avec particules */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -inset-10 opacity-30">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 bg-blue-400 rounded-full"
              initial={{
                x: Math.random() * window.innerWidth,
                y: Math.random() * window.innerHeight,
              }}
              animate={{
                y: [0, -30, 0],
                opacity: [0, 1, 0],
              }}
              transition={{
                duration: 3 + Math.random() * 2,
                repeat: Infinity,
                delay: Math.random() * 2,
              }}
            />
          ))}
        </div>
      </div>

      {/* Citation inspirante */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="container mx-auto px-4 pt-6"
      >
        <div className="max-w-2xl mx-auto text-center mb-6">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 rounded-2xl shadow-lg">
            <motion.blockquote 
              className="text-lg font-medium italic"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              "Le succès n'est pas final, l'échec n'est pas fatal : c'est le courage de continuer qui compte."
            </motion.blockquote>
            <motion.p 
              className="text-blue-100 text-sm mt-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              - Winston Churchill
            </motion.p>
          </div>
        </div>
      </motion.div>

      {/* Carte étudiante virtuelle centrale */}
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 50 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ duration: 0.8, type: "spring" }}
          className="max-w-2xl mx-auto mb-8"
        >
          <div className="bg-white/80 backdrop-blur-lg rounded-3xl shadow-2xl border border-white/20 p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              {/* Photo de profil */}
              <motion.div
                whileHover={{ scale: 1.05 }}
                className="relative"
              >
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border-4 border-white shadow-lg">
                  {studentInfo?.photo_url ? (
                    <img 
                      src={studentInfo.photo_url} 
                      alt={`${studentInfo.nom} ${studentInfo.prenoms}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-blue-400 to-purple-600 flex items-center justify-center">
                      <User className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                    </div>
                  )}
                </div>
                {/* Badge online */}
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute -bottom-1 -right-1 w-5 h-5 sm:w-6 sm:h-6 bg-green-500 rounded-full border-2 border-white flex items-center justify-center"
                >
                  <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                </motion.div>
              </motion.div>

              {/* Informations étudiantes */}
              <div className="flex-1 text-center sm:text-left">
                <motion.h1 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="text-xl sm:text-2xl font-bold text-gray-800 mb-2"
                >
                  {studentInfo?.nom} {studentInfo?.prenoms}
                </motion.h1>
                
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="space-y-1 text-xs sm:text-sm text-gray-600"
                >
                  <p className="flex items-center justify-center sm:justify-start gap-2">
                    <School size={14} className="sm:w-4 sm:h-4" />
                    <span>{studentInfo?.filiere}</span>
                  </p>
                  <p>Classe: {studentInfo?.classe}</p>
                  <p>Année: {studentInfo?.annee_academique}</p>
                  {studentInfo?.groupe && <p>Groupe: {studentInfo.groupe}</p>}
                </motion.div>
              </div>

              {/* QR Code stylé */}
              <motion.div
                whileHover={{ rotate: 5 }}
                className="hidden md:block"
              >
                <div className="bg-white p-2 sm:p-3 rounded-2xl shadow-lg border-2 border-gray-100">
                  <QrCode size={60} className="sm:w-16 sm:h-16 text-gray-700" />
                </div>
              </motion.div>
            </div>
          </div>
        </motion.div>

        {/* Grille des services */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="max-w-6xl mx-auto"
        >
          <motion.h2 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="text-xl sm:text-2xl font-bold text-gray-800 mb-6 sm:mb-8 text-center"
          >
            Mes services étudiants
          </motion.h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
            <AnimatePresence>
              {allCards.map((card, index) => {
                const IconComponent = card.icon;
                return (
                  <motion.div
                    key={card.id}
                    initial={{ y: 30, opacity: 0, scale: 0.9 }}
                    animate={{ y: 0, opacity: 1, scale: 1 }}
                    transition={{ delay: 0.8 + index * 0.1 }}
                    whileHover={{ 
                      y: -4,
                      scale: 1.02,
                      transition: { type: "spring", stiffness: 300 }
                    }}
                    whileTap={{ scale: 0.98 }}
                    className="group cursor-pointer"
                    onClick={card.action || (() => handleNavigation(card.path))}
                  >
                    <div className={`h-20 sm:h-24 rounded-xl sm:rounded-2xl ${pastelColors[card.colorIndex]} border-2 border-white/50 shadow-lg hover:shadow-xl transition-all duration-300 group-hover:border-white/80 relative overflow-hidden`}>
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                      <div className="p-2 sm:p-4 h-full flex items-center justify-between">
                        <motion.div
                          whileHover={{ scale: 1.1 }}
                          className={`p-2 sm:p-3 rounded-lg sm:rounded-xl bg-white/50 backdrop-blur-sm shadow-lg ${iconColors[card.colorIndex]} flex items-center justify-center`}
                        >
                          <IconComponent size={18} className="sm:w-5 sm:h-5" />
                        </motion.div>
                        <div className="flex-1 text-center">
                          <h3 className="font-semibold text-gray-800 text-xs sm:text-sm group-hover:text-gray-900 transition-colors leading-tight">
                            {card.title}
                          </h3>
                          <motion.div
                            initial={{ width: 0 }}
                            whileHover={{ width: '100%' }}
                            className="h-0.5 bg-gradient-to-r from-transparent via-current to-transparent mt-1 mx-auto"
                            style={{ maxWidth: '80px' }}
                          />
                        </div>
                      </div>
                      <div className={`absolute left-2 sm:left-4 top-1/2 transform -translate-y-1/2 w-8 h-8 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-current opacity-0 group-hover:opacity-20 blur-md transition-opacity duration-300 ${iconColors[card.colorIndex].replace('text-', 'bg-')}`}></div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>

      {/* Footer */}
      <motion.footer 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
        className="container mx-auto px-4 mt-8 sm:mt-12 text-center"
      >
        <div className="bg-white/60 backdrop-blur-lg rounded-2xl p-4 sm:p-6 max-w-md mx-auto shadow-lg border border-white/30">
          <motion.p
            animate={{ y: [0, -2, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="text-gray-700 font-medium text-xs sm:text-sm"
          >
            Bon courage pour ce semestre 💪
          </motion.p>
          <p className="text-gray-500 text-xs mt-2">
            © {new Date().getFullYear()} IIPEA - Tous droits réservés
          </p>
        </div>
      </motion.footer>

      <AnimatePresence>
        {!hasPlayedConfetti && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 pointer-events-none"
          >
            {[...Array(5)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute text-yellow-400"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                }}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5, delay: i * 0.2 }}
              >
                <Sparkles size={12} className="sm:w-4 sm:h-4" />
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Acceuille;