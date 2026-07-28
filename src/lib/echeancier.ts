// Aperçu (avant tout paiement) de l'échéancier — même règle que le moteur backend
// (services/echeancier.service.js) : le premier versement suit une règle fixe (150 000 F, ou le
// montant total si inférieur), le reste du solde se répartit également sur les versements
// suivants, espacés de 2 mois chacun et reportés au prochain jour ouvrable le cas échéant.
// Purement indicatif : le calcul définitif (avec recalcul après paiement réel) est fait côté
// serveur.
import { prochainJourOuvrable } from './joursFeries';

export const PREMIER_VERSEMENT_FIXE = 150000;
const ESPACEMENT_MOIS_ENTRE_VERSEMENTS = 2;

export interface LigneEcheancier {
  numero: number;
  montant: number;
  date: string;
}

export const calculerApercuEcheancier = (montant: number | null, nombreVersements: number): LigneEcheancier[] => {
  if (!montant || montant <= 0) return [];
  if (nombreVersements <= 1) {
    return [{ numero: 1, montant, date: new Date().toLocaleDateString('fr-FR') }];
  }
  const premier = Math.min(PREMIER_VERSEMENT_FIXE, montant);
  const reste = montant - premier;
  const nbSuivants = nombreVersements - 1;
  const montantSuivant = Math.round(reste / nbSuivants);
  const lignes: LigneEcheancier[] = [{ numero: 1, montant: premier, date: new Date().toLocaleDateString('fr-FR') }];
  let cumul = premier;
  for (let i = 1; i < nombreVersements; i++) {
    const isDernier = i === nombreVersements - 1;
    const montantVersement = isDernier ? montant - cumul : montantSuivant;
    cumul += montantVersement;
    const date = new Date();
    date.setMonth(date.getMonth() + i * ESPACEMENT_MOIS_ENTRE_VERSEMENTS);
    const dateAjustee = prochainJourOuvrable(date);
    lignes.push({ numero: i + 1, montant: montantVersement, date: dateAjustee.toLocaleDateString('fr-FR') });
  }
  return lignes;
};
