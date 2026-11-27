// Détail d'une séance : infos, Zoom, agenda, replay, supports.
import { html, urlSure } from '../lib/html.js';
import { icones } from '../lib/icones.js';
import { dateLongue, plageHoraire, compteARebours, duree } from '../lib/dates.js';
import { telechargerIcs } from '../lib/ics.js';
import { enTete, etiquettes, boutonZoom } from './commun.js';

export async function vueSeance(app, { id }) {
  const s = await app.api.seance(id);
  if (!s) return { html: html`<div class="page">${enTete('Séance introuvable', null, '#/planning')}<p>Cette séance n'existe pas ou ne concerne pas votre promo.</p></div>` };
  const docs = await app.api.documents(id);
  const passee = new Date(s.fin) <= new Date();
  const supports = docs.filter((d) => d.type === 'support');
  const corrections = docs.filter((d) => d.type === 'correction');

  const listeDocs = (titre, liste) =>
    liste.length
      ? html`<section class="pile-petite"><h2 class="titre-section">${titre}</h2>
          <div class="carte liste">${liste.map(
            (d) => html`<button class="ligne-doc" data-doc="${d.chemin}">${icones.fichier(18)}<span>${d.titre}</span>${icones.chevron(16)}</button>`
          )}</div></section>`
      : '';

  const vue = html`<div class="page">
    ${enTete(s.matiere || 'Séance', null, passee ? '#/planning/replays' : '#/planning')}
    <section class="carte pile">
      ${s.annulee ? html`<p class="alerte rouge">Cette séance est annulée.</p>` : ''}
      <h2 class="titre-seance">${s.titre}</h2>
      <div class="infos">
        <div>${icones.planning(18)} ${dateLongue(s.debut)} · ${plageHoraire(s.debut, s.fin)}</div>
        <div>${icones.lieu(18)} ${s.lieu}</div>
      </div>
      <div class="etiquettes">${etiquettes(s)}${!passee && !s.annulee ? html`<span class="etiquette accent">${compteARebours(s.debut, s.fin)}</span>` : ''}</div>
      ${!passee && !s.annulee
        ? html`<div class="actions">${boutonZoom(s)}<button class="btn contour" data-action="ics">${icones.agenda(18)} Ajouter à mon agenda</button></div>`
        : ''}
      ${passee && urlSure(s.replay_url)
        ? html`<a class="btn plein" href="${urlSure(s.replay_url)}" target="_blank" rel="noopener">${icones.lecture(16)} Regarder le replay${s.replay_duree_min ? ` (${duree(s.replay_duree_min)})` : ''}</a>`
        : ''}
      ${passee && !s.replay_url && !s.annulee ? html`<p class="aide">Le replay sera ajouté ici dès qu'il sera disponible.</p>` : ''}
    </section>
    ${listeDocs('Supports', supports)}
    ${listeDocs('Diapos de correction', corrections)}
  </div>`;

  function monter(el) {
    el.addEventListener('click', async (e) => {
      if (e.target.closest('[data-action=ics]')) telechargerIcs(s);
      const doc = e.target.closest('[data-doc]');
      if (doc) {
        // Ouvre la fenêtre tout de suite (sinon bloquée par Safari), puis y charge le lien temporaire.
        const fen = window.open('', '_blank');
        try {
          const url = await app.api.urlDocument(doc.dataset.doc);
          if (fen) fen.location = url;
          else location.href = url;
        } catch (err) {
          fen?.close();
          app.message(err.message, 'erreur');
        }
      }
    });
  }

  return { html: vue, monter, titre: s.titre };
}
