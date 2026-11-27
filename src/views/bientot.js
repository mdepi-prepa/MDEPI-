// Onglets prévus au lot 1.1 (Entraînement, Cartes, Progrès).
import { html } from '../lib/html.js';
import { enTete } from './commun.js';

const TEXTES = {
  Entraînement: "Vous pourrez bientôt passer ici les dossiers progressifs et les examens blancs, importés de Théia par l'équipe.",
  Cartes: "Vous pourrez bientôt réviser ici les flashcards de chaque conférence, en répétition espacée, et créer les vôtres.",
  Progrès: 'Vous verrez bientôt ici vos notes, la moyenne de la promo, votre rang et vos points à retravailler.',
};

export async function vueBientot(app, titre) {
  return {
    titre,
    html: html`<div class="page">
      ${enTete(titre, app.profil)}
      <div class="carte pile centre">
        <span class="etiquette accent">Bientôt disponible</span>
        <p>${TEXTES[titre]}</p>
      </div>
    </div>`,
  };
}
