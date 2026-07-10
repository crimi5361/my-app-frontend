import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, CreditCard, CheckCircle, AlertCircle, DollarSign, FileText, Receipt, TrendingUp, Calendar, UserCheck, ShieldCheck, Menu, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface StudentInfo {
  nom: string;
  prenoms: string;
  classe: string;
  filiere: string;
  photo_url: string;
}

interface ScolariteInfo {
  montant_total: string;
  montant_verse: string;
  montant_restant: string;
  statut: string;
  prise_en_charge_id: string | null;
}

interface StatutScolaire {
  statut_scolaire: string;
}

interface Paiement {
  id: number;
  montant: number;
  date_paiement: string;
  methode: string;
  effectue_par: string;
  etudiant_id: number;
  recu_id: number | null;
  numero_recu?: string;
  date_emission?: string;
  emetteur?: string;
}

interface Recu {
  id: number;
  numero_recu: string;
  date_emission: string;
  montant: number;
  emetteur: string;
  paiement_id?: number;
  date_paiement?: string;
  methode?: string;
}

const ScolariteEtudiant = () => {
  const [studentInfo, setStudentInfo] = useState<StudentInfo | null>(null);
  const [scolariteInfo, setScolariteInfo] = useState<ScolariteInfo | null>(null);
  const [statutScolaire, setStatutScolaire] = useState<StatutScolaire | null>(null);
  const [paiements, setPaiements] = useState<Paiement[]>([]);
  const [recus, setRecus] = useState<Recu[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('details');
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
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

          if (data.scolarite) {
            setScolariteInfo(data.scolarite);
          }

          if (data.statut) {
            setStatutScolaire(data.statut);
          }
        }

        const paiementsResponse = await fetch(`${API_URL}/api/etudiant-payement-espace/etudiant/${studentId}/paiements`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (paiementsResponse.ok) {
          const paiementsData = await paiementsResponse.json();
          if (paiementsData.success) {
            setPaiements(paiementsData.data);
          }
        }

        const recusResponse = await fetch(`${API_URL}/api/etudiant-payement-espace/etudiant/${studentId}/recus`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (recusResponse.ok) {
          const recusData = await recusResponse.json();
          if (recusData.success) {
            setRecus(recusData.data);
          }
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

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
    setIsMobileMenuOpen(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SOLDE':
        return 'from-green-500 to-emerald-600';
      case 'EN_RETARD':
        return 'from-red-500 to-rose-600';
      case 'EN_COURS':
        return 'from-blue-500 to-cyan-600';
      default:
        return 'from-gray-500 to-slate-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'SOLDE':
        return <CheckCircle size={24} className="text-white" />;
      case 'EN_RETARD':
        return <AlertCircle size={24} className="text-white" />;
      case 'EN_COURS':
        return <DollarSign size={24} className="text-white" />;
      default:
        return <FileText size={24} className="text-white" />;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF'
    }).format(amount);
  };

  const tabs = [
    { id: 'details', label: ' Détails Financiers', icon: TrendingUp },
    { id: 'paiements', label: ' Historique Paiements', icon: CreditCard },
    { id: 'recus', label: ' Reçus de Paiement', icon: Receipt }
  ];

  // Fonction helper pour obtenir l'icône de l'onglet actif
  const getActiveTabIcon = () => {
    const activeTabData = tabs.find(tab => tab.id === activeTab);
    const IconComponent = activeTabData?.icon;
    return IconComponent ? <IconComponent size={18} className="mr-2" /> : null;
  };

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
            Chargement de vos informations de scolarité...
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

  const activeTabData = tabs.find(tab => tab.id === activeTab);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 pb-10 font-sans relative overflow-hidden">
      {/* Fond animé avec particules */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -inset-10 opacity-20">
          {[...Array(15)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-blue-400 rounded-full"
              initial={{
                x: Math.random() * window.innerWidth,
                y: Math.random() * window.innerHeight,
              }}
              animate={{
                y: [0, -20, 0],
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

      {/* Header */}
      <motion.header 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-white/80 backdrop-blur-lg shadow-sm border-b border-white/20 p-4 sticky top-0 z-20"
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center">
            <motion.button
              whileHover={{ scale: 1.05, x: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleBack}
              className="flex items-center text-blue-600 hover:text-blue-800 font-medium mr-4 p-2 rounded-xl hover:bg-blue-50 transition-all duration-200"
            >
              <ArrowLeft size={20} className="mr-2" />
              Retour
            </motion.button>
            <h1 className="text-xl md:text-2xl font-bold text-gray-800 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Gestion de Scolarité
            </h1>
          </div>
          
          {/* Bouton menu mobile */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden p-2 rounded-lg bg-white/50 backdrop-blur-sm border border-white/30"
          >
            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </motion.button>
        </div>
      </motion.header>

      <div className="max-w-6xl mx-auto px-4 relative z-10">
        {/* En-tête étudiant */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-6"
        >
          <div className="bg-white/80 backdrop-blur-lg rounded-3xl shadow-2xl p-6 mb-6 border border-white/20">
            <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left">
              <motion.div
                whileHover={{ scale: 1.05 }}
                className="relative mb-4 sm:mb-0"
              >
                {studentInfo?.photo_url ? (
                  <img 
                    src={studentInfo.photo_url} 
                    alt="Photo de profil" 
                    className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-4 border-white shadow-lg"
                  />
                ) : (
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-blue-400 to-purple-600 flex items-center justify-center border-4 border-white shadow-lg">
                    <span className="text-lg sm:text-xl font-semibold text-white">
                      {studentInfo?.nom?.charAt(0)}{studentInfo?.prenoms?.charAt(0)}
                    </span>
                  </div>
                )}
              </motion.div>
              
              <div className="flex-1 min-w-0 sm:ml-6">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-800">
                  {studentInfo?.nom} {studentInfo?.prenoms}
                </h2>
                <p className="text-gray-600 text-sm sm:text-base">{studentInfo?.classe} • {studentInfo?.filiere}</p>
                
                {scolariteInfo?.statut && (
                  <motion.div 
                    initial={{ scale: 0.9 }}
                    animate={{ scale: 1 }}
                    className={`mt-3 inline-flex items-center px-3 py-1 sm:px-4 sm:py-2 rounded-2xl bg-gradient-to-r ${getStatusColor(scolariteInfo.statut)} text-white shadow-lg`}
                  >
                    {getStatusIcon(scolariteInfo.statut)}
                    <span className="ml-2 font-medium capitalize text-sm sm:text-base">
                      {scolariteInfo.statut.toLowerCase().replace('_', ' ')}
                    </span>
                  </motion.div>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Navigation par onglets responsive */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-8"
        >
          {/* Version desktop */}
          <div className="hidden lg:block bg-white/60 backdrop-blur-lg rounded-2xl p-2 shadow-lg border border-white/30">
            <nav className="flex space-x-1">
              {tabs.map((tab) => (
                <motion.button
                  key={tab.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleTabClick(tab.id)}
                  className={`flex items-center px-4 py-3 rounded-xl font-medium transition-all duration-300 flex-1 justify-center ${
                    activeTab === tab.id 
                      ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg' 
                      : 'text-gray-600 hover:text-gray-800 hover:bg-white/50'
                  }`}
                >
                  <tab.icon size={18} className="mr-2" />
                  <span className="text-sm">{tab.label}</span>
                </motion.button>
              ))}
            </nav>
          </div>

          {/* Version mobile - Menu déroulant */}
          <div className="lg:hidden relative">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="w-full bg-white/60 backdrop-blur-lg rounded-2xl p-4 shadow-lg border border-white/30 flex items-center justify-between font-medium text-gray-700"
            >
              <span className="flex items-center">
                {getActiveTabIcon()}
                {activeTabData?.label}
              </span>
              <motion.div
                animate={{ rotate: isMobileMenuOpen ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <Menu size={16} />
              </motion.div>
            </motion.button>

            <AnimatePresence>
              {isMobileMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  className="absolute top-full left-0 right-0 mt-2 bg-white/80 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/30 overflow-hidden z-30"
                >
                  {tabs.map((tab) => {
                    const IconComponent = tab.icon;
                    return (
                      <motion.button
                        key={tab.id}
                        whileHover={{ backgroundColor: 'rgba(59, 130, 246, 0.1)' }}
                        onClick={() => handleTabClick(tab.id)}
                        className={`w-full flex items-center px-4 py-3 text-left transition-colors duration-200 ${
                          activeTab === tab.id 
                            ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white' 
                            : 'text-gray-700 hover:text-blue-600'
                        }`}
                      >
                        <IconComponent size={18} className="mr-3" />
                        <span className="text-sm font-medium">{tab.label}</span>
                      </motion.button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Version tablette - Onglets compacts */}
          <div className="hidden md:block lg:hidden">
            <div className="bg-white/60 backdrop-blur-lg rounded-2xl p-1 shadow-lg border border-white/30">
              <nav className="flex space-x-1">
                {tabs.map((tab) => (
                  <motion.button
                    key={tab.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleTabClick(tab.id)}
                    className={`flex items-center px-3 py-2 rounded-xl font-medium transition-all duration-300 flex-1 justify-center ${
                      activeTab === tab.id 
                        ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg' 
                        : 'text-gray-600 hover:text-gray-800 hover:bg-white/50'
                    }`}
                  >
                    <tab.icon size={16} className="mr-1" />
                    <span className="text-xs whitespace-nowrap">
                      {tab.label.split(' ')[0]}
                    </span>
                  </motion.button>
                ))}
              </nav>
            </div>
          </div>
        </motion.div>

        {/* Contenu des onglets */}
        <AnimatePresence mode="wait">
          {activeTab === 'details' && (
            <motion.div 
              key="details"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Carte de statut premium */}
              <motion.div 
                whileHover={{ y: -5 }}
                className="bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-3xl shadow-2xl p-4 sm:p-6 text-white relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-black/10"></div>
                <div className="relative z-10">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4">
                    <h3 className="text-xl sm:text-2xl font-bold mb-2 sm:mb-0">Statut de Scolarité</h3>
                    <ShieldCheck size={28} className="text-white/80" />
                  </div>
                  
                  {statutScolaire && (
                    <div className="flex items-center mb-3">
                      <UserCheck size={18} className="mr-2" />
                      <span className="text-blue-100 text-sm sm:text-base">Statut scolaire: </span>
                      <span className="ml-2 font-semibold text-sm sm:text-base">{statutScolaire.statut_scolaire}</span>
                    </div>
                  )}

                  {scolariteInfo?.prise_en_charge_id && (
                    <motion.div 
                      initial={{ scale: 0.9 }}
                      animate={{ scale: 1 }}
                      className="bg-white/20 backdrop-blur-sm p-3 rounded-xl mb-2"
                    >
                      <div className="flex items-center">
                        <CheckCircle size={16} className="mr-2" />
                        <span className="font-medium text-sm sm:text-base">Prise en charge activée</span>
                      </div>
                      <p className="text-white/80 text-xs sm:text-sm mt-1">ID: {scolariteInfo.prise_en_charge_id}</p>
                    </motion.div>
                  )}
                </div>
              </motion.div>

              {/* Cartes financières avec effet 3D */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {[
                  {
                    id: 'total',
                    title: 'Total à payer',
                    amount: scolariteInfo?.montant_total ? parseFloat(scolariteInfo.montant_total) : 0,
                    icon: CreditCard,
                    gradient: 'from-blue-500 to-cyan-500',
                    bg: 'bg-gradient-to-br from-blue-50 to-cyan-50'
                  },
                  {
                    id: 'verse',
                    title: 'Déjà payé',
                    amount: scolariteInfo?.montant_verse ? parseFloat(scolariteInfo.montant_verse) : 0,
                    icon: CheckCircle,
                    gradient: 'from-green-500 to-emerald-500',
                    bg: 'bg-gradient-to-br from-green-50 to-emerald-50'
                  },
                  {
                    id: 'restant',
                    title: 'Reste à payer',
                    amount: scolariteInfo?.montant_restant ? parseFloat(scolariteInfo.montant_restant) : 0,
                    icon: DollarSign,
                    gradient: scolariteInfo?.montant_restant === '0.00' ? 'from-green-500 to-emerald-500' : 'from-amber-500 to-orange-500',
                    bg: scolariteInfo?.montant_restant === '0.00' ? 'bg-gradient-to-br from-green-50 to-emerald-50' : 'bg-gradient-to-br from-amber-50 to-orange-50'
                  }
                ].map((card) => {
                  const IconComponent = card.icon;
                  return (
                    <motion.div
                      key={card.id}
                      whileHover={{ 
                        y: -8,
                        scale: 1.02,
                        transition: { type: "spring", stiffness: 300 }
                      }}
                      onHoverStart={() => setHoveredCard(card.id)}
                      onHoverEnd={() => setHoveredCard(null)}
                      className={`${card.bg} rounded-2xl shadow-lg border border-white/50 p-4 sm:p-5 relative overflow-hidden group cursor-pointer`}
                    >
                      {/* Effet de brillance */}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                      
                      <div className="relative z-10">
                        <div className="flex items-center justify-between mb-3">
                          <IconComponent size={20} className={`text-${card.gradient.split(' ')[0].split('-')[1]}-600`} />
                          <motion.div
                            animate={{ rotate: hoveredCard === card.id ? 360 : 0 }}
                            transition={{ duration: 0.5 }}
                            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-r ${card.gradient} flex items-center justify-center`}
                          >
                            <span className="text-white text-xs sm:text-sm font-bold">₣</span>
                          </motion.div>
                        </div>
                        
                        <h4 className="text-gray-600 text-xs sm:text-sm font-medium mb-1">{card.title}</h4>
                        <p className={`text-lg sm:text-2xl font-bold bg-gradient-to-r ${card.gradient} bg-clip-text text-transparent`}>
                          {card.amount.toLocaleString('fr-FR')} FCFA
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Barre de progression avancée */}
              {scolariteInfo && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-lg p-4 sm:p-6 border border-white/20"
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4">
                    <h4 className="text-base sm:text-lg font-semibold text-gray-800 mb-2 sm:mb-0">Progression du paiement</h4>
                    <span className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                      {Math.round((parseFloat(scolariteInfo.montant_verse) / parseFloat(scolariteInfo.montant_total)) * 100)}%
                    </span>
                  </div>
                  
                  <div className="w-full bg-gray-200 rounded-full h-2 sm:h-3 mb-2 overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${(parseFloat(scolariteInfo.montant_verse) / parseFloat(scolariteInfo.montant_total)) * 100}%` }}
                      transition={{ duration: 1.5, ease: "easeOut" }}
                      className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 sm:h-3 rounded-full relative"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse"></div>
                    </motion.div>
                  </div>
                  
                  <div className="flex justify-between text-xs sm:text-sm text-gray-600">
                    <span>0%</span>
                    <span>100%</span>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {activeTab === 'paiements' && (
            <motion.div 
              key="paiements"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-white/80 backdrop-blur-lg rounded-3xl shadow-2xl p-4 sm:p-6 border border-white/20"
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6">
                <h3 className="text-xl sm:text-2xl font-bold text-gray-800 mb-2 sm:mb-0">Historique des Paiements</h3>
                <Calendar className="text-gray-400" size={24} />
              </div>
              
              {paiements.length === 0 ? (
                <motion.div 
                  initial={{ scale: 0.9 }}
                  animate={{ scale: 1 }}
                  className="text-center py-8 sm:py-12 text-gray-500"
                >
                  <CreditCard size={40} className="mx-auto mb-4 text-gray-300" />
                  <p className="text-base sm:text-lg font-medium mb-2">Aucun paiement enregistré</p>
                  <p className="text-sm">Vos paiements apparaîtront ici</p>
                </motion.div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-white/30">
                  <table className="w-full min-w-[500px]">
                    <thead>
                      <tr className="bg-gradient-to-r from-blue-50 to-purple-50">
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700">Date</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700">Méthode</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700">Montant</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {paiements.map((paiement, index) => (
                        <motion.tr 
                          key={paiement.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className="hover:bg-blue-50/50 transition-colors duration-200"
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center">
                              <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                              <span className="font-medium text-sm">{formatDate(paiement.date_paiement)}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center px-2 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-medium capitalize">
                              {paiement.methode.toLowerCase()}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-base font-bold text-green-600">
                              {formatCurrency(paiement.montant)}
                            </span>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'recus' && (
            <motion.div 
              key="recus"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-white/80 backdrop-blur-lg rounded-3xl shadow-2xl p-4 sm:p-6 border border-white/20"
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6">
                <h3 className="text-xl sm:text-2xl font-bold text-gray-800 mb-2 sm:mb-0">Reçus de Paiement</h3>
                <Receipt className="text-gray-400" size={24} />
              </div>
              
              {recus.length === 0 ? (
                <motion.div 
                  initial={{ scale: 0.9 }}
                  animate={{ scale: 1 }}
                  className="text-center py-8 sm:py-12 text-gray-500"
                >
                  <FileText size={40} className="mx-auto mb-4 text-gray-300" />
                  <p className="text-base sm:text-lg font-medium mb-2">Aucun reçu enregistré</p>
                  <p className="text-sm">Vos reçus apparaîtront ici après paiement</p>
                </motion.div>
              ) : (
                <div className="grid gap-3 sm:gap-4">
                  {recus.map((recu, index) => (
                    <motion.div
                      key={recu.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      whileHover={{ y: -5 }}
                      className="bg-gradient-to-r from-white to-gray-50 rounded-2xl p-4 sm:p-5 border border-gray-100 shadow-lg hover:shadow-xl transition-all duration-300"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center mb-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                            <span className="font-bold text-gray-800 text-sm sm:text-base">{recu.numero_recu}</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 text-xs sm:text-sm">
                            <div>
                              <span className="text-gray-600">Date: </span>
                              <span className="font-medium">{formatDate(recu.date_emission)}</span>
                            </div>
                            <div>
                              <span className="text-gray-600">Montant: </span>
                              <span className="font-bold text-green-600">{formatCurrency(recu.montant)}</span>
                            </div>
                            <div className="sm:col-span-2">
                              <span className="text-gray-600">Émetteur: </span>
                              <span className="font-medium">{recu.emetteur}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default ScolariteEtudiant;