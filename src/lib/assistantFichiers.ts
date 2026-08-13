// Assistant Fondateur — téléchargement des fichiers produits (2026-08-12).
//
// La route est protégée par JWT, donc un simple <a href> ne suffit pas : le
// navigateur n'y joindrait aucun en-tête Authorization et recevrait un 401. On
// récupère donc le fichier en mémoire puis on déclenche l'enregistrement.

export interface FichierAssistant {
  id: string;
  nom: string;
  extension: 'xlsx' | 'docx';
  nb_lignes?: number;
}

const API = import.meta.env.VITE_API_URL_SERVER as string;

export async function telechargerFichier(fichier: FichierAssistant): Promise<void> {
  const jeton = localStorage.getItem('token');
  const reponse = await fetch(`${API}/api/assistant/fichier/${fichier.id}`, {
    headers: jeton ? { Authorization: `Bearer ${jeton}` } : {},
  });

  if (!reponse.ok) {
    // Le serveur répond en JSON sur l'échec ; en cas de doute on reste générique.
    const detail = await reponse.json().catch(() => null);
    throw new Error(detail?.message || "Le fichier n'est plus disponible.");
  }

  const blob = await reponse.blob();
  const url = URL.createObjectURL(blob);
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = fichier.nom;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  // Sans révocation, le blob reste en mémoire jusqu'au rechargement de la page.
  URL.revokeObjectURL(url);
}
