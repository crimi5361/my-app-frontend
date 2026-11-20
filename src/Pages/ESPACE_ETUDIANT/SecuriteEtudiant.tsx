import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ShieldCheck, KeyRound, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ChangePasswordModal, useChangePassword } from '../../Components/ChangePasswordModal';

/**
 * Sécurité / Modifier mon mot de passe — espace étudiant (Phase 0, 2026-11-11).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * AUCUN FORMULAIRE N'EST RÉÉCRIT ICI
 * ─────────────────────────────────────────────────────────────────────────────
 * La saisie, les règles de robustesse, la confirmation, le refus d'un mot de
 * passe identique à l'ancien, l'état de chargement et le message de succès sont
 * déjà implémentés par `ChangePasswordModal`, utilisé par le personnel depuis le
 * header et le Hub. Cette page se contente de l'ouvrir dans le vocabulaire de
 * l'espace étudiant : un seul formulaire à maintenir, un seul comportement.
 *
 * Côté serveur, c'est le même endpoint (/api/change_Password/changePassword) :
 * il distingue désormais un compte étudiant d'un compte agent et agit sur la
 * bonne table. Un étudiant ne peut changer que SON mot de passe — l'identifiant
 * vient du jeton, jamais de la requête.
 */
const SecuriteEtudiant = () => {
  const navigate = useNavigate();
  const { changePassword } = useChangePassword();
  const [modaleOuverte, setModaleOuverte] = useState(false);
  const [modifie, setModifie] = useState(false);

  const auSucces = async (ancien: string, nouveau: string) => {
    await changePassword(ancien, nouveau);
    // N'est atteint que si le serveur a réellement accepté : en cas d'échec,
    // `changePassword` lève et la modale affiche l'erreur.
    setModifie(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <button
          onClick={() => navigate('/acceuil/espace_etudiant')}
          className="mb-5 inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
        >
          <ArrowLeft size={16} />
          Retour
        </button>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="rounded-2xl bg-white p-6 shadow-sm sm:p-8"
        >
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800 sm:text-xl">Sécurité de mon compte</h1>
              <p className="text-sm text-slate-500">Modifier mon mot de passe</p>
            </div>
          </div>

          {modifie ? (
            <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4">
              <CheckCircle2 className="mt-0.5 flex-shrink-0 text-green-600" size={20} />
              <div>
                <p className="font-semibold text-green-800">Mot de passe modifié</p>
                <p className="mt-1 text-sm text-green-700">
                  Votre nouveau mot de passe est actif. Conservez-le : il vous sera demandé
                  à votre prochaine connexion.
                </p>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm leading-relaxed text-slate-600">
                Votre compte vous a été ouvert avec un mot de passe initial, identique
                pour tous les étudiants et indiqué sur votre reçu de scolarité. Le
                remplacer par un mot de passe personnel est le moyen le plus simple de
                protéger vos informations.
              </p>

              <ul className="mt-4 space-y-1.5 text-sm text-slate-600">
                <li>• Au moins 8 caractères</li>
                <li>• Une majuscule, une minuscule, un chiffre</li>
                <li>• Au moins un caractère spécial</li>
              </ul>

              <button
                onClick={() => setModaleOuverte(true)}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition-colors hover:bg-blue-700 sm:w-auto"
              >
                <KeyRound size={18} />
                Modifier mon mot de passe
              </button>
            </>
          )}
        </motion.div>
      </div>

      {modaleOuverte && (
        <ChangePasswordModal
          onClose={() => setModaleOuverte(false)}
          onSubmit={auSucces}
        />
      )}
    </div>
  );
};

export default SecuriteEtudiant;
