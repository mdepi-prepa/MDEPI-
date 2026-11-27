// Détail d'une séance : infos, Zoom, agenda, replay, supports.
import { html, urlSure } from '../lib/html.js';
import { icones } from '../lib/icones.js';
import { dateLongue, heure, plageHoraire, compteARebours, duree } from '../lib/dates.js';
import { telechargerIcs } from '../lib/ics.js';
import { enTete, etiquettes, boutonZoom } from './commun.js';
import { estEquipe } from '../lib/acces.js';

export async function vueSeance(app, { id }) {
  const s = await app.api.seance(id);
  if (!s) return { html: html`<div class="page">${enTete('Séance introuvable', null, '#/planning')}<p>Cette séance n'existe pas ou ne concerne pas votre promo.</p></div>` };
  const docs = await app.api.documents(id);
  const equipe = estEquipe(app.profil);
  const [infos, copie] = s.epreuve
    ? await Promise.all([app.api.infosQcm(id).catch(() => null), equipe ? null : app.api.maCopie(id).catch(() => null)])
    : [null, null];
  const enLigne = infos?.questions > 0;
  const passee = new Date(s.fin) <= new Date();
  const supports = docs.filter((d) => d.type === 'support');
  const corrections = docs.filter((d) => d.type === 'correction');
  const sujets = docs.filter((d) => d.type === 'sujet');

  const listeDocs = (titre, liste) =>
    liste.length
      ? html`<section class="pile-petite"><h2 class="titre-section">${titre}</h2>
          <div class="carte liste">${liste.map(
            (d) => html`<button class="ligne-doc" data-doc="${d.chemin}">${icones.fichier(18)}<span>${d.titre}</span>${icones.chevron(16)}</button>`
          )}</div></section>`
      : '';

  const vue = html`<div class="page">
    ${enTete(s.epreuve ? 'Épreuve' : s.matiere || 'Séance', null, s.epreuve ? '#/epreuves' : passee ? '#/planning/replays' : '#/planning')}
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
      ${passee && !s.replay_url && !s.annulee && !s.epreuve ? html`<p class="aide">Le replay sera ajouté ici dès qu'il sera disponible.</p>` : ''}
      ${passee && s.epreuve && !docs.length && !enLigne ? html`<p class="aide">Le sujet et la correction seront ajoutés ici après l'épreuve.</p>` : ''}
    </section>
    ${enLigne && !s.annulee ? blocEpreuve(s, infos, copie, equipe) : ''}
    ${listeDocs('Sujet', sujets)}
    ${listeDocs('Supports', supports)}
    ${listeDocs(s.epreuve ? 'Correction' : 'Diapos de correction', corrections)}
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

// Épreuve passée dans l'app (QCM importé de Théia).
function blocEpreuve(s, infos, copie, equipe) {
  const maintenant = new Date();
  const ouverte = new Date(s.debut) <= maintenant && maintenant < new Date(s.fin);
  const avant = maintenant < new Date(s.debut);
  let contenu;
  if (equipe) contenu = html`<a class="btn plein" href="#/admin/epreuves/${s.id}/qcm">QCM et résultats</a>`;
  else if (copie && !ouverte && !avant) contenu = html`<a class="btn plein" href="#/epreuve/${s.id}">Voir ma note et mon classement</a>`;
  else if (copie?.rendue_le) contenu = html`<p class="alerte vert">Copie envoyée. Votre note et votre rang apparaîtront ici à la fin de l'épreuve (${heure(s.fin)}).</p>`;
  else if (ouverte) contenu = html`<a class="btn plein grand" href="#/epreuve/${s.id}">${copie ? "Reprendre l'épreuve" : "Passer l'épreuve"}</a>`;
  else if (avant) contenu = html`<p class="aide">L'épreuve s'ouvrira ici le ${dateLongue(s.debut).toLowerCase()} à ${heure(s.debut)}.</p>`;
  else contenu = html`<p class="aide">Vous n'avez pas passé cette épreuve dans l'app.</p>`;
  if (!equipe && infos.correction_visible && !ouverte && !avant) {
    contenu = html`${contenu}<a class="btn contour" href="#/entrainement/${s.id}">Rejouer en entraînement</a>`;
  }
  return html`<section class="carte pile carte-qcm">
    <h2 class="titre-section">Épreuve en ligne</h2>
    <p>${infos.questions} question${infos.questions > 1 ? 's' : ''} en ${infos.dossiers} dossier${infos.dossiers > 1 ? 's' : ''} (DP, KFP), à cocher dans l'app.</p>
    ${contenu}
  </section>`;
}
