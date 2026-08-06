
import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { HiOutlineMenuAlt2 } from "react-icons/hi";
import { motion, AnimatePresence } from "framer-motion";
import { FaUserCircle } from "react-icons/fa";
import { FiLogOut } from "react-icons/fi";
import { RiLockPasswordLine } from "react-icons/ri";
import { LayoutGrid } from "lucide-react";
import { useChangePassword, ChangePasswordModal } from "../ChangePasswordModal";
import { getDashboardRouteForRole } from "../../lib/access";

interface HeaderProps {
  darkMode: boolean;
  toggleSidemenu: () => void;
  userName: string;
  userRole: string;
  departementName: string;
  onLogout: () => void;
}

// ─── Header principal ─────────────────────────────────────────────────────────
const Header: React.FC<HeaderProps> = ({
  toggleSidemenu,
  userName,
  userRole,
  departementName,
  onLogout,
}) => {
  const [showUserDropdown,  setShowUserDropdown]  = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const navigate = useNavigate();

  const { changePassword } = useChangePassword();
  const userDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
        setShowUserDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleChangePassword = () => {
    setShowUserDropdown(false);
    setShowPasswordModal(true);
  };

  const handlePasswordSubmit = async (oldPassword: string, newPassword: string) => {
    await changePassword(oldPassword, newPassword);
  };

  return (
    <>
      <nav className="fixed top-0 z-50 w-full bg-[var(--surface)] border-b border-[var(--border)] dark:bg-gray-800 dark:border-gray-700">
        <div className="px-3 py-4 lg:px-5 lg:pl-3">
          <div className="flex items-center justify-between">

            {/* Section gauche */}
            <div className="flex items-center">
              <button
                className="p-2 text-[var(--text-soft)] rounded-lg hover:bg-[var(--paper)] focus:outline-none focus:ring-2
                  focus:ring-[var(--mist)] dark:text-gray-400 dark:hover:bg-gray-700 dark:focus:ring-gray-600"
                onClick={toggleSidemenu}
              >
                <HiOutlineMenuAlt2 className="text-2xl" />
              </button>

              <button
                onClick={() => navigate(getDashboardRouteForRole(userRole))}
                className="flex items-center ms-4 space-x-3 bg-transparent border-none cursor-pointer p-0"
              >
                <img src="/logo.png" alt="Logo" className="w-14 h-14 object-contain" />
                <span className="font-display text-xl font-bold text-[var(--text)] dark:text-white">
                  {departementName}
                </span>
              </button>
            </div>

            {/* Section droite */}
            <div className="flex items-center space-x-4 relative">
              <button
                onClick={() => navigate("/hub")}
                title="Retour au Hub"
                className="flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium
                  text-[var(--text-soft)] hover:bg-[var(--paper)] dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
              >
                <LayoutGrid size={16} />
                <span className="hidden sm:inline">Hub</span>
              </button>

              <div className="relative" ref={userDropdownRef}>
                <button
                  onClick={() => setShowUserDropdown((prev) => !prev)}
                  className="rounded-full overflow-hidden focus:outline-none"
                >
                  <img src="/icons8-utilisateur-50.png" alt="User Icon" className="w-10 h-10" />
                </button>

                <AnimatePresence>
                  {showUserDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="absolute right-0 mt-2 w-56 bg-[var(--surface)] border border-[var(--border)] rounded-md
                        shadow-[var(--shadow-lift)] dark:bg-gray-700 dark:border-gray-600 z-50"
                    >
                      <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border)] dark:border-gray-600">
                        <FaUserCircle className="text-xl text-[var(--text-soft)] dark:text-gray-300" />
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-[var(--text)] dark:text-white">{userName}</span>
                          <span className="text-xs text-[var(--text-soft)] dark:text-gray-400">{userRole}</span>
                        </div>
                      </div>

                      <ul className="py-1">
                        <li>
                          <button
                            onClick={handleChangePassword}
                            className="flex items-center gap-2 w-full text-left px-4 py-2 text-sm text-[var(--text)]
                              hover:bg-[var(--paper)] dark:text-gray-300 dark:hover:bg-gray-600 transition-colors"
                          >
                            <RiLockPasswordLine className="text-base" />
                            Changer le mot de passe
                          </button>
                        </li>
                        <li className="border-t border-[var(--border)] dark:border-gray-600 my-1" />
                        <li>
                          <button
                            onClick={onLogout}
                            className="flex items-center gap-2 w-full text-left px-4 py-2 text-sm text-[var(--danger)]
                              hover:bg-[var(--paper)] dark:text-red-400 dark:hover:bg-gray-600 transition-colors"
                          >
                            <FiLogOut className="text-base" />
                            Se déconnecter
                          </button>
                        </li>
                      </ul>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

          </div>
        </div>
      </nav>

      {/* Modal changement de mot de passe */}
      {showPasswordModal && (
        <ChangePasswordModal
          onClose={() => setShowPasswordModal(false)}
          onSubmit={handlePasswordSubmit}
        />
      )}
    </>
  );
};

export default Header;