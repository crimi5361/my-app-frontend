import { Dialog } from '@headlessui/react';
import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';

interface Role {
  id: number;
  nom: string;
}

interface Departement {
  id: number;
  nom: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function AddUserModal({ isOpen, onClose }: Props) {
  const [nom, setNom] = useState('');
  const [email, setEmail] = useState('');
  const [roleId, setRoleId] = useState<number | ''>('');
  const [departementId, setDepartementId] = useState<number | ''>('');

  const [roles, setRoles] = useState<Role[]>([]);
  const [departements, setDepartements] = useState<Departement[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchRolesAndDepartements = async () => {
      try {
        const [rolesData, depsData] = await Promise.all([
          apiFetch('/api/roles'),
          apiFetch('/api/departements'),
        ]);
        setRoles(rolesData);
        setDepartements(depsData);
      } catch (error) {
        console.error('Erreur lors du chargement des rôles ou départements:', error);
      }
    };

    if (isOpen) {
      fetchRolesAndDepartements();
      // Reset form when opening
      setNom('');
      setEmail('');
      setRoleId('');
      setDepartementId('');
      setErrors({});
    }
  }, [isOpen]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!nom.trim()) {
      newErrors.nom = 'Le nom est obligatoire';
    }
    
    if (!email.trim()) {
      newErrors.email = 'L\'email est obligatoire';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Veuillez entrer un email valide';
    }
    
    if (!roleId) {
      newErrors.roleId = 'Veuillez sélectionner un rôle';
    }
    
    if (!departementId) {
      newErrors.departementId = 'Veuillez sélectionner un département';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm() || isSubmitting) return;
    
    setIsSubmitting(true);

    const newUser = {
      nom,
      email,
      mot_de_passe: '@elites@',
      role_id: roleId,
      departement_id: departementId,
      statut: 'active',
    };

    try {
      await apiFetch('/api/utilisateurs/ajouter', {
        method: 'POST',
        body: JSON.stringify(newUser),
      });
      alert('Utilisateur ajouté avec succès !');
      onClose();
    } catch (error) {
      console.error('Erreur lors de l\'ajout de l\'utilisateur:', error);
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
            <Dialog.Title className="text-xl font-bold mb-4">Ajouter un utilisateur</Dialog.Title>
            
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
                  className={`w-full border ${errors.nom ? 'border-red-500' : 'border-gray-300'} p-2 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
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
                  className={`w-full border ${errors.email ? 'border-red-500' : 'border-gray-300'} p-2 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                />
                {errors.email && <p className="mt-1 text-sm text-red-500">{errors.email}</p>}
              </div>

              <div>
                <label htmlFor="departement" className="block text-sm font-medium text-gray-700 mb-1">
                  Département <span className="text-red-500">*</span>
                </label>
                <select
                  id="departement"
                  value={departementId}
                  onChange={e => setDepartementId(Number(e.target.value))}
                  className={`w-full border ${errors.departementId ? 'border-red-500' : 'border-gray-300'} p-2 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                >
                  <option value="">Sélectionner un département</option>
                  {departements.map(dep => (
                    <option key={dep.id} value={dep.id}>{dep.nom}</option>
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
                {isSubmitting ? 'En cours...' : 'Ajouter'}
              </button>
            </div>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}