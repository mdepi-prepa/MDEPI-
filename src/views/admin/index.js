// Back-office : page d'accueil de l'équipe.
import { html } from '../../lib/html.js';
import { icones } from '../../lib/icones.js';
import { estAdmin } from '../../lib/acces.js';

export function enteteAdmin(titre, retour = '#/admin') {
  return html`<header class="entete">
    <a class="btn-icone" href="${retour}" aria-label="Retour">${icones.retour(20)}</a>
    <h1 class="titre-page">${titre}</h1>
    <span class="badge-promo noir">Back-office</span>
  </header>`;
}

export async function vueAdmin(app) {
  const admin = estAdmin(app.profil);
  const tuile = (href, icone, titre, texte) =>
    html`<a href="${href}" class="carte tuile-admin"><span class="tuile-icone">${icone}</span>
      <span class="pile-mini"><strong>${titre}</strong><span class="aide">${texte}</span></span>${icones.chevron(16)}</a>`;
  return {
    titre: 'Back-office',
    html: html`<div class="page">
      ${enteteAdmin('Back-office', '#/accueil')}
      <div class="grille-admin">
        ${tuile('#/admin/seances', icones.planning(18), 'Planning et replays', 'Créer, modifier ou annuler une séance, rattacher le replay Zoom, déposer les PDF.')}
        ${tuile('#/admin/epreuves', icones.epreuve(18), 'Épreuves', 'CCB et examens blancs, groupe par groupe : dates, lieux, sujets et corrections.')}
        ${admin ? tuile('#/admin/comptes', icones.reglages(18), 'Comptes', 'Importer les inscrits (CSV), promos, groupes de rotation, passage d’année.') : ''}
        ${admin ? tuile('#/admin/annonces', icones.cloche(18), 'Annonces', 'Publier une annonce pour une ou plusieurs promos.') : ''}
      </div>
      <p class="aide">Import des QCM Théia, cartes, passage et correction des épreuves dans l'app : lot 1.1.</p>
    </div>`,
  };
}
