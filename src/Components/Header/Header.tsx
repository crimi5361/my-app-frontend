 
import { useState, useRef, useEffect } from "react";
import { HiOutlineMenuAlt2 } from "react-icons/hi";
import { motion, AnimatePresence } from "framer-motion";
import { FaUserCircle } from "react-icons/fa";
import { FiLogOut, FiEye, FiEyeOff, FiX, FiCheck, FiAlertCircle } from "react-icons/fi";
import { RiLockPasswordLine } from "react-icons/ri";
import { apiFetch } from "../../lib/api";

// ─── Hook : appel API changement de mot de passe ─────────────────────────────
const useChangePassword = () => {
  const changePassword = async (oldPassword: string, newPassword: string): Promise<void> => {
    await apiFetch("/api/change_Password/changePassword", {
      method: "POST",
      body: JSON.stringify({ oldPassword, newPassword }),
    });
  };

  return { changePassword };
};

interface HeaderProps {
  darkMode: boolean;
  toggleSidemenu: () => void;
  userName: string;
  userRole: string;
  departementName: string;
  onLogout: () => void;
}

// ─── Règles de validation du mot de passe ────────────────────────────────────
const passwordRules = [
  { id: "length",  label: "Au moins 8 caractères",               test: (p: string) => p.length >= 8 },
  { id: "upper",   label: "Au moins une lettre majuscule (A-Z)", test: (p: string) => /[A-Z]/.test(p) },
  { id: "lower",   label: "Au moins une lettre minuscule (a-z)", test: (p: string) => /[a-z]/.test(p) },
  { id: "digit",   label: "Au moins un chiffre (0-9)",           test: (p: string) => /[0-9]/.test(p) },
  { id: "special", label: "Au moins un caractère spécial (!@#…)", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

// ─── Composant champ mot de passe avec toggle ─────────────────────────────────
const PasswordField: React.FC<{
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  error?: string;
  success?: boolean;
}> = ({ id, label, value, onChange, placeholder, error, success }) => {
  const [visible, setVisible] = useState(false);

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
        {label}
      </label>
      <div className={`flex items-center border rounded-lg overflow-hidden transition-colors
        ${error
          ? "border-red-400 dark:border-red-500"
          : success
          ? "border-green-400 dark:border-green-500"
          : "border-gray-300 dark:border-gray-600 focus-within:border-blue-500 dark:focus-within:border-blue-400"}`}>
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 px-3 py-2.5 text-sm bg-transparent outline-none text-gray-800 dark:text-white
            placeholder-gray-400 dark:placeholder-gray-500"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="px-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
        >
          {visible ? <FiEyeOff size={16} /> : <FiEye size={16} />}
        </button>
      </div>
      {error && (
        <p className="flex items-center gap-1 text-xs text-red-500">
          <FiAlertCircle size={12} /> {error}
        </p>
      )}
    </div>
  );
};

// ─── Modal changement de mot de passe ────────────────────────────────────────
const ChangePasswordModal: React.FC<{
  onClose: () => void;
  onSubmit: (oldPassword: string, newPassword: string) => Promise<void>;
}> = ({ onClose, onSubmit }) => {
  const [oldPassword,     setOldPassword]     = useState("");
  const [newPassword,     setNewPassword]     = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors,          setErrors]          = useState<Record<string, string>>({});
  const [loading,         setLoading]         = useState(false);
  const [successMsg,      setSuccessMsg]      = useState("");

  const ruleStatus   = passwordRules.map((r) => ({ ...r, passed: r.test(newPassword) }));
  const allRulesPassed = ruleStatus.every((r) => r.passed);
  const passwordsMatch = newPassword !== "" && newPassword === confirmPassword;

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!oldPassword) e.oldPassword = "Veuillez saisir votre ancien mot de passe.";
    if (!newPassword) e.newPassword = "Veuillez saisir un nouveau mot de passe.";
    else if (!allRulesPassed) e.newPassword = "Le mot de passe ne respecte pas les règles de sécurité.";
    if (!confirmPassword) e.confirmPassword = "Veuillez confirmer le nouveau mot de passe.";
    else if (newPassword !== confirmPassword) e.confirmPassword = "Les mots de passe ne correspondent pas.";
    if (oldPassword && newPassword && oldPassword === newPassword)
      e.newPassword = "Le nouveau mot de passe doit être différent de l'ancien.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await onSubmit(oldPassword, newPassword);
      setSuccessMsg("Mot de passe modifié avec succès !");
      setTimeout(onClose, 1800);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Une erreur est survenue.";
      setErrors({ api: message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        key="modal"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none"
      >
        <div
          className="pointer-events-auto w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl
            border border-gray-100 dark:border-gray-700 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* En-tête */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700
            bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-700 dark:to-gray-750">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/40">
                <RiLockPasswordLine className="text-blue-600 dark:text-blue-400 text-xl" />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-800 dark:text-white">
                  Changer le mot de passe
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Créez un mot de passe fort et unique
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600
                hover:text-gray-700 dark:hover:text-white transition-colors"
            >
              <FiX size={18} />
            </button>
          </div>

          {/* Corps */}
          <div className="px-6 py-5 flex flex-col gap-4">

            {/* Message succès */}
            {successMsg && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-900/30
                  border border-green-200 dark:border-green-700 text-green-700 dark:text-green-300 text-sm"
              >
                <FiCheck size={16} /> {successMsg}
              </motion.div>
            )}

            {/* Erreur API */}
            {errors.api && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/30
                  border border-red-200 dark:border-red-700 text-red-600 dark:text-red-400 text-sm"
              >
                <FiAlertCircle size={16} /> {errors.api}
              </motion.div>
            )}

            <PasswordField
              id="old-password"
              label="Ancien mot de passe"
              value={oldPassword}
              onChange={setOldPassword}
              placeholder="••••••••"
              error={errors.oldPassword}
            />

            <PasswordField
              id="new-password"
              label="Nouveau mot de passe"
              value={newPassword}
              onChange={setNewPassword}
              placeholder="••••••••"
              error={errors.newPassword}
            />

            {/* Indicateur des règles */}
            {newPassword && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50
                  dark:bg-gray-900/40 p-3 flex flex-col gap-1.5"
              >
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1">
                  Exigences
                </p>
                {ruleStatus.map((r) => (
                  <div key={r.id} className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 transition-colors
                      ${r.passed ? "bg-green-100 dark:bg-green-900/50" : "bg-gray-200 dark:bg-gray-700"}`}>
                      <FiCheck size={10} className={r.passed ? "text-green-600 dark:text-green-400" : "text-transparent"} />
                    </div>
                    <span className={`text-xs transition-colors
                      ${r.passed ? "text-green-600 dark:text-green-400" : "text-gray-400 dark:text-gray-500"}`}>
                      {r.label}
                    </span>
                  </div>
                ))}
              </motion.div>
            )}

            <PasswordField
              id="confirm-password"
              label="Confirmer le nouveau mot de passe"
              value={confirmPassword}
              onChange={setConfirmPassword}
              placeholder="••••••••"
              error={errors.confirmPassword}
              success={passwordsMatch}
            />

            {/* Indicateur de correspondance */}
            {confirmPassword && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`flex items-center gap-2 text-xs font-medium
                  ${passwordsMatch ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}`}
              >
                {passwordsMatch
                  ? <><FiCheck size={13} /> Les mots de passe correspondent</>
                  : <><FiAlertCircle size={13} /> Les mots de passe ne correspondent pas</>
                }
              </motion.div>
            )}
          </div>

          {/* Pied */}
          <div className="px-6 py-4 flex gap-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 text-sm
                font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || !!successMsg}
              className="flex-1 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60
                disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors
                flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Enregistrement…
                </>
              ) : (
                "Enregistrer"
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

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