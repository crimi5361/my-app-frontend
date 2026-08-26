import { useContext, useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { message } from 'antd';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { FaUserCircle } from 'react-icons/fa';
import { FiLogOut } from 'react-icons/fi';
import { RiLockPasswordLine } from 'react-icons/ri';
import { Lock } from 'lucide-react';
import { UserContext } from '../../context/UserContext';
import { useChangePassword, ChangePasswordModal } from '../../Components/ChangePasswordModal';
import { HUB_APPS, appsVisiblesPour } from '../../lib/access';
import './Hub.css';

const Hub = () => {
  const { user, setIsAuthenticated, setUser } = useContext(UserContext);
  const navigate = useNavigate();
  const [messageApi, contextHolder] = message.useMessage();
  const { changePassword } = useChangePassword();

  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.removeItem('departement_id');
    localStorage.removeItem('user_id');
    setIsAuthenticated(false);
    setUser(null);
    navigate('/login');
  };

  const handleOpenApp = (app: (typeof HUB_APPS)[number]) => {
    if (!app.roles.includes(user?.role || '')) {
      messageApi.warning(`Vous n'êtes pas autorisé à accéder à "${app.label}".`);
      return;
    }
    navigate(app.landingRoute);
  };

  return (
    <div className="hub-page">
      {contextHolder}

      {/* Identité minimale — pas la barre de navigation complète de l'application */}
      <div className="hub-topbar">
        <div className="hub-brand">
          <img src="/logo.png" alt="IIPEA" className="hub-brand-logo" />
          <span className="hub-brand-name">{user?.departementName || 'IIPEA'}</span>
        </div>

        <div className="hub-user" ref={userMenuRef}>
          <button className="hub-user-trigger" onClick={() => setShowUserMenu((v) => !v)}>
            <img src="/icons8-utilisateur-50.png" alt="" className="hub-user-avatar" />
          </button>
          <AnimatePresence>
            {showUserMenu && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.16 }}
                className="hub-user-dropdown"
              >
                <div className="hub-user-dropdown-head">
                  <FaUserCircle size={20} />
                  <div>
                    <div className="name">{user?.nom}</div>
                    <div className="role">{user?.role}</div>
                  </div>
                </div>
                <button
                  onClick={() => { setShowUserMenu(false); setShowPasswordModal(true); }}
                  className="hub-user-dropdown-item"
                >
                  <RiLockPasswordLine size={15} /> Changer le mot de passe
                </button>
                <button onClick={handleLogout} className="hub-user-dropdown-item danger">
                  <FiLogOut size={15} /> Se déconnecter
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="hub-body">
        <motion.span
          className="hub-eyebrow"
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          Espace de travail
        </motion.span>
        <motion.h1
          className="hub-title"
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: reduceMotion ? 0 : 0.05 }}
        >
          Bienvenue{user?.nom ? `, ${user.nom}` : ''}
        </motion.h1>
        <motion.p
          className="hub-sub"
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: reduceMotion ? 0 : 0.1 }}
        >
          Choisissez une application pour continuer.
        </motion.p>

        <div className="hub-tiles">
          {/* `appsVisiblesPour` et non `HUB_APPS` : un module masque ne parait
              jamais, et une tuile discrete ne parait qu'a qui y a droit. Les
              autres restent affichees cadenassees, comme avant — c'est voulu,
              cela dit ce que la plateforme sait faire. */}
          {appsVisiblesPour(user?.role).map((app, index) => {
            const Icon = app.icon;
            const authorized = app.roles.includes(user?.role || '');
            return (
              <motion.div
                key={app.slug}
                className={`hub-tile${authorized ? '' : ' restricted'}`}
                style={{ '--tile-color': `var(--mod-${app.slug})` } as React.CSSProperties}
                onClick={() => handleOpenApp(app)}
                initial={reduceMotion ? false : { opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.42,
                  delay: reduceMotion ? 0 : 0.16 + index * 0.06,
                  ease: [0.2, 0.8, 0.2, 1],
                }}
              >
                {!authorized && <Lock className="hub-tile-lock" strokeWidth={1.7} />}
                <div className="hub-tile-icon">
                  <Icon size={32} strokeWidth={1.5} />
                </div>
                <h3>{app.label}</h3>
                <p>{app.description}</p>
              </motion.div>
            );
          })}
        </div>
      </div>

      {showPasswordModal && (
        <ChangePasswordModal
          onClose={() => setShowPasswordModal(false)}
          onSubmit={changePassword}
        />
      )}
    </div>
  );
};

export default Hub;
