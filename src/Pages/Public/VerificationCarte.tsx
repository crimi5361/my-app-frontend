import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ShieldCheck, ShieldX, Loader2, AlertTriangle } from 'lucide-react';

/**
 * Vérification publique d'une carte étudiante — cible du QR code.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PAGE PUBLIQUE : AUCUNE AUTHENTIFICATION
 * ─────────────────────────────────────────────────────────────────────────────
 * Elle n'utilise donc PAS `apiFetch`, qui attache le jeton de session et
 * redirige vers /login sur un 401 — un visiteur extérieur n'a ni l'un ni l'autre.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE QUE CETTE PAGE AFFIRME, ET CE QU'ELLE N'AFFIRME PAS
 * ─────────────────────────────────────────────────────────────────────────────
 * Elle confirme que le code a été émis par l'IIPEA et correspond à une
 * inscription réelle. Elle NE PEUT PAS dire si l'exemplaire physique présenté a
 * été perdu, volé ou retiré : le registre des documents délivrés n'existe pas
 * encore. Cette limite est écrite sur la page, et non passée sous silence.
 */

const API = import.meta.env.VITE_API_URL_SERVER;

type Reponse = {
  success: boolean;
  message: string;
  data?: {
    titulaire: { nom: string | null; prenoms_initiales: string | null };
    inscription: {
      ecole: string;
      ecole_code: string;
      filiere: string | null;
      niveau: string | null;
      annee_academique: string | null;
    };
    validite: { valable_jusquau: string | null; expiree: boolean | null };
  };
};

const VerificationCarte = () => {
  const [parametres] = useSearchParams();
  const code = parametres.get('c');

  const [etat, setEtat] = useState<'chargement' | 'trouve' | 'inconnu' | 'erreur'>('chargement');
  const [reponse, setReponse] = useState<Reponse | null>(null);

  useEffect(() => {
    if (!code) {
      setEtat('inconnu');
      setReponse({ success: false, message: 'Aucun code de vérification fourni.' });
      return;
    }
    let actif = true;
    (async () => {
      try {
        const r = await fetch(`${API}/api/cartes-etudiantes/verifier?c=${encodeURIComponent(code)}`);
        const corps: Reponse = await r.json();
        if (!actif) return;
        setReponse(corps);
        // 429 et 500 ne sont pas des « carte inconnue » : les confondre
        // laisserait croire qu'une carte valide est fausse.
        if (r.ok && corps.success) setEtat('trouve');
        else if (r.status === 404) setEtat('inconnu');
        else setEtat('erreur');
      } catch {
        if (actif) {
          setEtat('erreur');
          setReponse({ success: false, message: 'Vérification momentanément indisponible.' });
        }
      }
    })();
    return () => {
      actif = false;
    };
  }, [code]);

  const titulaire = reponse?.data?.titulaire;
  const inscription = reponse?.data?.inscription;
  const validite = reponse?.data?.validite;
  const expiree = validite?.expiree === true;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex flex-col items-center gap-3">
          <img src="/logo.png" alt="IIPEA" className="h-16 w-16 object-contain" />
          <div className="text-center">
            <h1 className="text-lg font-bold text-slate-800">
              Vérification d'une carte étudiante
            </h1>
            <p className="text-sm text-slate-500">
              Institut International Polytechnique des Élites d'Abidjan
            </p>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          {etat === 'chargement' && (
            <div className="flex items-center justify-center gap-3 py-8 text-slate-500">
              <Loader2 className="animate-spin" size={20} />
              Vérification en cours…
            </div>
          )}

          {etat === 'trouve' && (
            <>
              <div
                className={`mb-5 flex items-start gap-3 rounded-xl border p-4 ${
                  expiree ? 'border-amber-200 bg-amber-50' : 'border-green-200 bg-green-50'
                }`}
              >
                <ShieldCheck
                  className={`mt-0.5 flex-shrink-0 ${expiree ? 'text-amber-600' : 'text-green-600'}`}
                  size={22}
                />
                <div>
                  <p className={`font-semibold ${expiree ? 'text-amber-800' : 'text-green-800'}`}>
                    {expiree
                      ? "Carte authentique, mais l'année académique est terminée"
                      : 'Carte émise par l’IIPEA'}
                  </p>
                  <p className={`mt-1 text-sm ${expiree ? 'text-amber-700' : 'text-green-700'}`}>
                    Ce code correspond à une inscription enregistrée.
                  </p>
                </div>
              </div>

              <dl className="space-y-3">
                {[
                  ['Titulaire', `${titulaire?.nom ?? ''} ${titulaire?.prenoms_initiales ?? ''}`.trim()],
                  ['École', `${inscription?.ecole ?? ''} (${inscription?.ecole_code ?? ''})`],
                  ['Filière', inscription?.filiere],
                  ['Niveau', inscription?.niveau],
                  ['Année académique', inscription?.annee_academique],
                  ['Valable jusqu’au', validite?.valable_jusquau],
                ].map(([libelle, valeur]) => (
                  <div
                    key={libelle as string}
                    className="flex justify-between gap-4 border-b border-slate-100 pb-2"
                  >
                    <dt className="text-sm text-slate-500">{libelle}</dt>
                    <dd className="text-right text-sm font-semibold text-slate-800">
                      {valeur || '—'}
                    </dd>
                  </div>
                ))}
              </dl>

              {/* Portée réelle, affichée et non dissimulée. */}
              <div className="mt-5 flex items-start gap-3 rounded-xl bg-slate-50 p-4">
                <AlertTriangle className="mt-0.5 flex-shrink-0 text-slate-400" size={18} />
                <p className="text-xs leading-relaxed text-slate-600">
                  Cette vérification porte sur l'inscription, pas sur l'exemplaire physique
                  présenté. Une carte déclarée perdue ou volée n'est pas encore signalée ici. En
                  cas de doute sur l'identité du porteur, contactez le service de la scolarité.
                </p>
              </div>
            </>
          )}

          {etat === 'inconnu' && (
            <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
              <ShieldX className="mt-0.5 flex-shrink-0 text-red-600" size={22} />
              <div>
                <p className="font-semibold text-red-800">Aucune carte ne correspond</p>
                <p className="mt-1 text-sm text-red-700">
                  {reponse?.message ||
                    "Ce code n'a pas été émis par l'IIPEA, ou la carte n'existe plus."}
                </p>
              </div>
            </div>
          )}

          {etat === 'erreur' && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <AlertTriangle className="mt-0.5 flex-shrink-0 text-amber-600" size={22} />
              <div>
                <p className="font-semibold text-amber-800">Vérification impossible pour l'instant</p>
                <p className="mt-1 text-sm text-amber-700">
                  {reponse?.message ||
                    'Le service est momentanément indisponible. Réessayez dans un instant.'}
                </p>
                <p className="mt-2 text-sm text-amber-700">
                  Ce message ne signifie pas que la carte est fausse.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VerificationCarte;
