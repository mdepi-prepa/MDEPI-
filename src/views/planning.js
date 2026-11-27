// Planning : séances à venir et séances passées (replay Zoom et support mis en avant).
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
  const passees = seances.filter((s) => new Date(s.fin) <= maintenant && !s.annulee).reverse();
  // Supports PDF des séances passées (seulement si l'onglet est ouvert).
  const docs = onglet === 'replays'
    ? await Promise.all(passees.map((s) => app.api.documents(s.id).catch(() => [])))
    : [];
  // Support et diapos de correction : les deux servent de support après la séance.
  const supportsDe = new Map(passees.map((s, i) => [s.id, (docs[i] || []).filter((d) => d.type === 'support' || d.type === 'correction')]));

  const selecteur = html`<div class="segments" role="tablist">
    <a role="tab" href="#/planning" class="segment${onglet === 'avenir' ? ' actif' : ''}" aria-selected="${onglet === 'avenir'}">À venir</a>
    <a role="tab" href="#/planning/replays" class="segment${onglet === 'replays' ? ' actif' : ''}" aria-selected="${onglet === 'replays'}">Passées</a>
  </div>`;

  const contenuAVenir = aVenir.length
    ? grouperParMois(aVenir).map(
        (g) => html`<section class="pile-petite"><h2 class="surtitre">${g.mois}</h2>${g.elements.map(ligneSeance)}</section>`
      )
    : vide('Aucune séance à venir.');

  // « Support », « Correction », ou numérotés s'il y en a plusieurs du même type.
  const libelleDoc = (d, liste) => {
    const nom = d.type === 'correction' ? 'Correction' : 'Support';
    const memes = liste.filter((x) => x.type === d.type);
    return memes.length > 1 ? `${nom} ${memes.indexOf(d) + 1}` : nom;
  };

  const cartePassee = (s) => {
    const replay = urlSure(s.replay_url);
    const supports = supportsDe.get(s.id) || [];
    return html`<div class="carte carte-passee">
      <a class="ligne-corps" href="#/seance/${s.id}">
        <span class="ligne-titre">${s.titre}</span>
        <span class="ligne-meta">${dateCourte(s.debut)}${s.replay_duree_min ? ` · replay de ${duree(s.replay_duree_min)}` : ''}</span>
      </a>
      <div class="actions-passee">
        ${replay
          ? html`<a class="btn plein" href="${replay}" target="_blank" rel="noopener">${icones.lecture(16)} Replay Zoom</a>`
          : html`<span class="btn inactif">${icones.video(16)} Replay à venir</span>`}
        ${supports.map(
          (d) => html`<button class="btn contour" data-doc="${d.chemin}" title="${d.titre}">${icones.fichier(16)} ${libelleDoc(d, supports)}</button>`
        )}
        ${!supports.length ? html`<span class="btn inactif">${icones.fichier(16)} Support à venir</span>` : ''}
        ${s.epreuve ? html`<a class="btn contour" href="#/seance/${s.id}">${icones.epreuve(16)} Voir l'épreuve</a>` : ''}
      </div>
    </div>`;
  };

  const contenuPassees = passees.length
    ? grouperParMois(passees).map(
        (g) => html`<section class="pile-petite"><h2 class="surtitre">${g.mois}</h2>${g.elements.map(cartePassee)}</section>`
      )
    : vide('Aucune séance passée pour le moment.');

  function monter(el) {
    el.addEventListener('click', async (e) => {
      const doc = e.target.closest('[data-doc]');
      if (!doc) return;
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
    });
  }

  return {
    monter,
    titre: 'Planning',
    html: html`<div class="page">
      ${enTete('Planning', app.profil)}
      ${selecteur}
      ${onglet === 'replays' ? contenuPassees : contenuAVenir}
    </div>`,
  };
}
