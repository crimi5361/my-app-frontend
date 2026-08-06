import { Dialog } from '@headlessui/react';
import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import type { UtilisateurGere } from './UserTable';

interface Role {
  id: number;
  nom: string;
}

interface Site {
  id: number;
  nom: string;
}

interface Ecole {
  id: number;
  nom: string;
  statut: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  // Présent = mode modification (PUT /api/utilisateurs/:id) ; absent = mode création (POST
  // /api/utilisateurs/ajouter). Un seul formulaire pour les deux cas, comme demandé.
  editUser?: UtilisateurGere | null;
}

export default function AddUserModal({ isOpen, onClose, editUser }: Props) {
  const isEditMode = !!editUser;

  const [nom, setNom] = useState('');
  const [email, setEmail] = useState('');
  const [roleId, setRoleId] = useState<number | ''>('');
  const [departementId, setDepartementId] = useState<number | ''>('');
  const [ecoleId, setEcoleId] = useState<number | ''>('');

  const [roles, setRoles] = useState<Role[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [ecoles, setEcoles] = useState<Ecole[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchReferenceData = async () => {
      try {
        const [rolesData, sitesData, ecolesData] = await Promise.all([
          apiFetch<Role[]>('/api/roles'),
          apiFetch<Site[]>('/api/sites'),
          apiFetch<Ecole[]>('/api/ecoles'),
        ]);
        setRoles(rolesData);
        setSites(sitesData);
        setEcoles(ecolesData.filter((e) => e.statut === 'actif'));
      } catch (error) {
        console.error('Erreur lors du chargement des rôles, sites ou écoles:', error);
      }
    };

    if (isOpen) {
      fetchReferenceData();
      setErrors({});
      if (editUser) {
        setNom(editUser.nom);
        setEmail(editUser.email);
        setRoleId(editUser.role_id);
        setDepartementId(editUser.site_id);
        setEcoleId(editUser.ecole_id ?? '');
      } else {
        setNom('');
        setEmail('');
        setRoleId('');
        setDepartementId('');
        setEcoleId('');
      }
    }
  }, [isOpen, editUser]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!isEditMode) {
      if (!nom.trim()) {
        newErrors.nom = 'Le nom est obligatoire';
      }
      if (!email.trim()) {
        newErrors.email = "L'email est obligatoire";
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        newErrors.email = 'Veuillez entrer un email valide';
      }
    }

    if (!roleId) {
      newErrors.roleId = 'Veuillez sélectionner un rôle';
    }

    if (!departementId) {
      newErrors.departementId = 'Veuillez sélectionner un site';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm() || isSubmitting) return;

    setIsSubmitting(true);

    try {
      if (isEditMode && editUser) {
        await apiFetch(`/api/utilisateurs/${editUser.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            role_id: roleId,
            departement_id: departementId,
            ecole_id: ecoleId || null,
          }),
        });
        alert('Utilisateur mis à jour avec succès !');
      } else {
        await apiFetch('/api/utilisateurs/ajouter', {
          method: 'POST',
          body: JSON.stringify({
            nom,
            email,
            mot_de_passe: '@elites@',
            role_id: roleId,
            departement_id: departementId,
            ecole_id: ecoleId || null,
            statut: 'active',
          }),
        });
        alert('Utilisateur ajouté avec succès !');
      }
      onClose();
    } catch (error) {
      console.error("Erreur lors de l'enregistrement de l'utilisateur:", error);
      alert(`Erreur: ${error instanceof Error ? error.message : 'inconnue'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen bg-black bg-opacity-30 p-4">
        <Dialog.Panel className="bg-white rounded-xl w-full max-w-md shadow-lg">
          <div className="p-6">
            <Dialog.Title className="text-xl font-bold mb-4">
              {isEditMode ? "Modifier l'utilisateur" : 'Ajouter un utilisateur'}
            </Dialog.Title>

            <div className="space-y-4">
              <div>
                <label htmlFor="nom" className="block text-sm font-medium text-gray-700 mb-1">
                  Nom complet <span className="text-red-500">*</span>
                </label>
                <input
                  id="nom"
                  placeholder="Jean Dupont"
                  value={nom}
                  onChange={e => setNom(e.target.value)}
                  disabled={isEditMode}
                  className={`w-full border ${errors.nom ? 'border-red-500' : 'border-gray-300'} p-2 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500`}
                />
                {errors.nom && <p className="mt-1 text-sm text-red-500">{errors.nom}</p>}
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  id="email"
                  type="email"
                  placeholder="jean.dupont@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  disabled={isEditMode}
                  className={`w-full border ${errors.email ? 'border-red-500' : 'border-gray-300'} p-2 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500`}
                />
                {errors.email && <p className="mt-1 text-sm text-red-500">{errors.email}</p>}
              </div>

              <div>
                <label htmlFor="departement" className="block text-sm font-medium text-gray-700 mb-1">
                  Site <span className="text-red-500">*</span>
                </label>
                <select
                  id="departement"
                  value={departementId}
                  onChange={e => setDepartementId(Number(e.target.value))}
                  className={`w-full border ${errors.departementId ? 'border-red-500' : 'border-gray-300'} p-2 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                >
                  <option value="">Sélectionner un site</option>
                  {sites.map(site => (
                    <option key={site.id} value={site.id}>{site.nom}</option>
                  ))}
                </select>
                {errors.departementId && <p className="mt-1 text-sm text-red-500">{errors.departementId}</p>}
              </div>

              <div>
                <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
                  Rôle <span className="text-red-500">*</span>
                </label>
                <select
                  id="role"
                  value={roleId}
                  onChange={e => setRoleId(Number(e.target.value))}
                  className={`w-full border ${errors.roleId ? 'border-red-500' : 'border-gray-300'} p-2 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                >
                  <option value="">Sélectionner un rôle</option>
                  {roles.map(role => (
                    <option key={role.id} value={role.id}>{role.nom}</option>
                  ))}
                </select>
                {errors.roleId && <p className="mt-1 text-sm text-red-500">{errors.roleId}</p>}
              </div>

              <div>
                <label htmlFor="ecole" className="block text-sm font-medium text-gray-700 mb-1">
                  École (Chantier 3)
                </label>
                <select
                  id="ecole"
                  value={ecoleId}
                  onChange={e => setEcoleId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full border border-gray-300 p-2 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Aucune — vue globale (toutes les écoles)</option>
                  {ecoles.map(ecole => (
                    <option key={ecole.id} value={ecole.id}>{ecole.nom}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Laisser sur « Aucune » pour que cet agent voie les données de toutes les écoles.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                disabled={isSubmitting}
              >
                Annuler
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-blue-400"
              >
                {isSubmitting ? 'En cours...' : isEditMode ? 'Enregistrer' : 'Ajouter'}
              </button>
            </div>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
