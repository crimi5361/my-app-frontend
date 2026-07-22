
import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { HiOutlineMenuAlt2 } from "react-icons/hi";
import { motion, AnimatePresence } from "framer-motion";
import { FaUserCircle } from "react-icons/fa";
import { FiLogOut } from "react-icons/fi";
import { RiLockPasswordLine } from "react-icons/ri";
import { LayoutGrid } from "lucide-react";
import { useChangePassword, ChangePasswordModal } from "../ChangePasswordModal";

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
      <nav className="fixed top-0 z-50 w-full bg-white border-b border-gray-200 dark:bg-gray-800 dark:border-gray-700">
        <div className="px-3 py-4 lg:px-5 lg:pl-3">
          <div className="flex items-center justify-between">

            {/* Section gauche */}
            <div className="flex items-center">
              <button
                className="p-2 text-gray-500 rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2
                  focus:ring-gray-200 dark:text-gray-400 dark:hover:bg-gray-700 dark:focus:ring-gray-600"
                onClick={toggleSidemenu}
              >
                <HiOutlineMenuAlt2 className="text-2xl" />
              </button>

              <a href="/dashboard" className="flex items-center ms-4 space-x-3">
                <img src="/logo.png" alt="Logo" className="w-14 h-14 object-contain" />
                <span
                  className="text-xl font-bold italic text-gray-800 dark:text-white"
                  style={{ fontFamily: "'Playfair Display', serif" }}
                >
                  {departementName}
                </span>
              </a>
            </div>

            {/* Section droite */}
            <div className="flex items-center space-x-4 relative">
              <button
                onClick={() => navigate("/hub")}
                title="Retour au Hub"
                className="flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium
                  text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
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
                      className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-md
                        shadow-lg dark:bg-gray-700 dark:border-gray-600 z-50"
                    >
                      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-600">
                        <FaUserCircle className="text-xl text-gray-500 dark:text-gray-300" />
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">{userName}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">{userRole}</span>
                        </div>
                      </div>

                      <ul className="py-1">
                        <li>
                          <button
                            onClick={handleChangePassword}
                            className="flex items-center gap-2 w-full text-left px-4 py-2 text-sm text-gray-700
                              hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-600 transition-colors"
                          >
                            <RiLockPasswordLine className="text-base" />
                            Changer le mot de passe
                          </button>
                        </li>
                        <li className="border-t border-gray-100 dark:border-gray-600 my-1" />
                        <li>
                          <button
                            onClick={onLogout}
                            className="flex items-center gap-2 w-full text-left px-4 py-2 text-sm text-red-600
                              hover:bg-gray-100 dark:text-red-400 dark:hover:bg-gray-600 transition-colors"
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