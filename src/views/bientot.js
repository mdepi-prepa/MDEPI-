// Onglet pas encore ouvert (Cartes).
import { html } from '../lib/html.js';
import { enTete } from './commun.js';

const TEXTES = {
  Cartes: "Vous pourrez bientôt réviser ici les flashcards de chaque conférence, en répétition espacée, et créer les vôtres.",
};

export async function vueBientot(app, titre) {
  return {
    titre,
    html: html`<div class="page">
      ${enTete(titre, app.profil)}
      <div class="carte pile centre">
        <span class="etiquette accent">Bientôt disponible</span>
        <p>${TEXTES[titre] || 'Cette page arrive bientôt.'}</p>
      </div>
    </div>`,
  };
}
