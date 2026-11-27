// Planning : séances à venir et replays.
import { html, urlSure } from '../lib/html.js';
import { icones } from '../lib/icones.js';
import { grouperParMois, dateCourte, duree } from '../lib/dates.js';
import { enTete, ligneSeance, vide } from './commun.js';
import { qcmLibre } from '../lib/qcm.js';

export async function vuePlanning(app, { onglet = 'avenir' } = {}) {
  const seances = (await app.api.seances()).filter((s) => !qcmLibre(s));
  const maintenant = new Date();
  // Une séance du jour (épreuve en cours ou juste finie comprise) reste dans
  // « À venir » jusqu'à minuit.
  const minuit = new Date(maintenant);
  minuit.setHours(0, 0, 0, 0);
  const aVenir = seances.filter((s) => new Date(s.fin) > minuit);
  const replays = seances.filter((s) => new Date(s.fin) <= maintenant && s.replay_url).reverse();

  const selecteur = html`<div class="segments" role="tablist">
    <a role="tab" href="#/planning" class="segment${onglet === 'avenir' ? ' actif' : ''}" aria-selected="${onglet === 'avenir'}">À venir</a>
    <a role="tab" href="#/planning/replays" class="segment${onglet === 'replays' ? ' actif' : ''}" aria-selected="${onglet === 'replays'}">Replays</a>
  </div>`;

  const contenuAVenir = aVenir.length
    ? grouperParMois(aVenir).map(
        (g) => html`<section class="pile-petite"><h2 class="surtitre">${g.mois}</h2>${g.elements.map(ligneSeance)}</section>`
      )
    : vide('Aucune séance à venir.');

  const contenuReplays = replays.length
    ? grouperParMois(replays).map(
        (g) => html`<section class="pile-petite"><h2 class="surtitre">${g.mois}</h2>
          ${g.elements.map(
            (s) => html`<div class="carte ligne-replay">
              <a class="btn-lecture" href="${urlSure(s.replay_url)}" target="_blank" rel="noopener" aria-label="Lire le replay : ${s.titre}">${icones.lecture(18)}</a>
              <a class="ligne-corps" href="#/seance/${s.id}">
                <span class="ligne-titre">${s.titre}</span>
                <span class="ligne-meta">${dateCourte(s.debut)}${s.replay_duree_min ? ` · ${duree(s.replay_duree_min)}` : ''}</span>
              </a>
              <a class="lien-accent" href="#/seance/${s.id}">Supports</a>
            </div>`
          )}</section>`
      )
    : vide('Aucun replay pour le moment.');

  return {
    titre: 'Planning',
    html: html`<div class="page">
      ${enTete('Planning', app.profil)}
      ${selecteur}
      ${onglet === 'replays' ? contenuReplays : contenuAVenir}
    </div>`,
  };
}
