// Morceaux d'interface partagés entre les écrans.
import { html, urlSure } from '../lib/html.js';
import { icones } from '../lib/icones.js';
import { libellePromo } from '../lib/promos.js';
import { jourSemaineCourt, numeroJour, plageHoraire, zoomActif, AVANCE_ZOOM_MIN } from '../lib/dates.js';

export function badgePromo(profil) {
  return html`<span class="badge-promo">${libellePromo(profil.promo)}</span>`;
}

export function enTete(titre, profil, retour) {
  return html`<header class="entete">
    ${retour ? html`<a class="btn-icone" href="${retour}" aria-label="Retour">${icones.retour(20)}</a>` : ''}
    <h1 class="titre-page">${titre}</h1>
    ${profil ? badgePromo(profil) : ''}
    ${retour && retour !== '#/' ? html`<a class="btn-icone btn-accueil" href="#/" aria-label="Revenir à l'accueil" title="Revenir à l'accueil">${icones.accueil(20)}</a>` : ''}
  </header>`;
}

export function etiquettes(s) {
  const t = [];
  if (s.annulee) t.push(html`<span class="etiquette annulee">Annulée</span>`);
  else if (s.modifiee_le) t.push(html`<span class="etiquette modifiee">Modifiée</span>`);
  if (s.presentiel) t.push(html`<span class="etiquette">Présentiel</span>`);
  if (s.zoom_url) t.push(html`<span class="etiquette">Zoom</span>`);
  if (s.epreuve) t.push(html`<span class="etiquette">Noté</span>`);
  return t;
}

// Ligne de séance du planning (bloc date à gauche).
export function ligneSeance(s) {
  return html`<a class="carte ligne-seance${s.annulee ? ' est-annulee' : ''}" href="#/seance/${s.id}">
    <div class="bloc-date${s.epreuve ? ' epreuve' : ''}">
      <span class="jsem">${jourSemaineCourt(s.debut)}</span><span class="jnum">${numeroJour(s.debut)}</span>
    </div>
    <div class="ligne-corps">
      <span class="ligne-titre">${s.titre}</span>
      <span class="ligne-meta">${plageHoraire(s.debut, s.fin)} · ${s.lieu || (s.presentiel ? '' : 'En ligne')}</span>
      <div class="etiquettes">${etiquettes(s)}</div>
    </div>
  </a>`;
}

// Bouton Zoom : actif 15 minutes avant le début jusqu'à la fin.
export function boutonZoom(s, classe = 'btn contour') {
  const url = urlSure(s.zoom_url);
  if (!url || s.annulee) return '';
  if (zoomActif(s.debut, s.fin)) {
    return html`<a class="${classe}" href="${url}" target="_blank" rel="noopener">${icones.video(18)} Rejoindre sur Zoom</a>`;
  }
  return html`<span class="${classe} inactif" aria-disabled="true" title="Le lien s'active ${AVANCE_ZOOM_MIN} minutes avant le début">
    ${icones.video(18)} Zoom actif ${AVANCE_ZOOM_MIN} min avant</span>`;
}

export function vide(texte) {
  return html`<div class="vide">${texte}</div>`;
}
