// Accueil : prochaine conférence, annonces, accès rapides.
import { html } from '../lib/html.js';
import { icones } from '../lib/icones.js';
import { dateLongue, plageHoraire, compteARebours, ilYA } from '../lib/dates.js';
import { estEquipe } from '../lib/acces.js';
import { badgePromo, boutonZoom, vide } from './commun.js';

export async function vueAccueil(app) {
  const p = app.profil;
  const [seances, annonces, lues] = await Promise.all([app.api.seances(), app.api.annonces(), app.api.annoncesLues()]);
  const maintenant = new Date();
  const prochaine = seances.find((s) => !s.annulee && new Date(s.fin) > maintenant);
  const nonLues = annonces.filter((a) => !lues.has(a.id));
  const epreuve = seances.find((s) => s.epreuve && !s.annulee && new Date(s.fin) > maintenant && s !== prochaine);
  const changements = seances.filter(
    (s) => s.modifiee_le && new Date(s.fin) > maintenant && maintenant - new Date(s.modifiee_le) < 7 * 86400000
  );

  const vue = html`<div class="page">
    <header class="entete-accueil">
      <a href="#/profil" class="logo" aria-label="Mon compte">MD</a>
      <div class="bonjour">
        <div class="titre-bonjour">Bonjour ${p.prenom || ''}</div>
        <div>${badgePromo(p)}</div>
      </div>
      <a href="#/annonces" class="btn-icone" aria-label="Annonces${nonLues.length ? ` (${nonLues.length} non lues)` : ''}">
        ${icones.cloche(20)}${nonLues.length ? html`<span class="pastille"></span>` : ''}
      </a>
    </header>

    ${changements.map(
      (s) => html`<a class="alerte" href="#/seance/${s.id}">
        <strong>${s.annulee ? 'Annulée' : 'Changement'}</strong> · ${s.titre} (${dateLongue(s.debut)})</a>`
    )}

    ${prochaine
      ? html`<section class="carte-noire" aria-label="Prochaine séance">
          <div class="ligne-haut">
            <span class="surtitre clair">${prochaine.epreuve ? 'PROCHAINE ÉPREUVE' : 'PROCHAINE CONFÉRENCE'}</span>
            <span class="pilule">${compteARebours(prochaine.debut, prochaine.fin, maintenant)}</span>
          </div>
          <a href="#/seance/${prochaine.id}" class="titre-noir">${prochaine.titre}</a>
          <div class="infos-noir">
            <div>${icones.planning(16)} ${dateLongue(prochaine.debut)} · ${plageHoraire(prochaine.debut, prochaine.fin)}</div>
            <div>${icones.lieu(16)} ${prochaine.lieu}${prochaine.presentiel && prochaine.zoom_url ? ' · aussi sur Zoom' : ''}</div>
          </div>
          <div class="actions-noir">
            <a href="#/planning" class="btn blanc">Voir le planning</a>
            ${boutonZoom(prochaine, 'btn contour-clair')}
          </div>
        </section>`
      : html`<section class="carte">${vide('Aucune séance à venir pour le moment.')}</section>`}

    ${epreuve
      ? html`<a class="carte lien-ligne" href="#/epreuves"><span class="tuile-icone">${icones.epreuve(18)}</span>
          <span class="pile-mini"><span class="surtitre">PROCHAINE ÉPREUVE · ${compteARebours(epreuve.debut, epreuve.fin, maintenant).toUpperCase()}</span>
          <strong>${epreuve.titre}</strong><span class="aide">${dateLongue(epreuve.debut)} · ${plageHoraire(epreuve.debut, epreuve.fin)} · ${epreuve.lieu}</span></span>
          ${icones.chevron(16)}</a>`
      : ''}

    <section class="pile-petite">
      <h2 class="titre-section">Bientôt dans l'app</h2>
      <div class="grille-2">
        <a href="#/entrainement" class="carte tuile"><span class="tuile-icone">${icones.entrainement(18)}</span>
          <span class="tuile-texte">Dossiers progressifs importés de Théia</span></a>
        <a href="#/cartes" class="carte tuile"><span class="tuile-icone">${icones.cartes(18)}</span>
          <span class="tuile-texte">Flashcards en répétition espacée</span></a>
      </div>
    </section>

    <section class="pile-petite">
      <div class="ligne-haut"><h2 class="titre-section">Annonces</h2><a href="#/annonces" class="lien-petit">Tout voir</a></div>
      ${annonces.length
        ? html`<div class="carte liste">
            ${annonces.slice(0, 4).map(
              (a) => html`<div class="annonce">
                <span class="point${lues.has(a.id) ? ' lu' : ''}" aria-hidden="true"></span>
                <div class="annonce-texte">${!lues.has(a.id) ? html`<span class="sr">Non lue : </span>` : ''}${a.texte}</div>
                <span class="annonce-date">${ilYA(a.publiee_le, maintenant)}</span>
              </div>`
            )}
          </div>`
        : html`<div class="carte">${vide('Aucune annonce.')}</div>`}
    </section>

    ${estEquipe(p) ? html`<a href="#/admin" class="carte lien-ligne">${icones.outils(18)}<span>Ouvrir le back-office</span>${icones.chevron(16)}</a>` : ''}
  </div>`;

  return { html: vue, titre: 'Accueil' };
}
