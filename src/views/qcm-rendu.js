// Affichage des QCM corrigés, sur le modèle de la relecture Théia :
// bandeau « Question N · Pondération », colonne « Réponse attendue »,
// commentaire de correction. Sert à l'étudiant (sa copie), à l'équipe
// (sujet corrigé, copie d'un étudiant) et à l'impression (sauvegarde PDF).
import { html, brut } from '../lib/html.js';
import { points, verdict, formatNote, fatale, pointsPonderes, nbAttendues, coefficient } from '../lib/bareme.js';
import { lettre, htmlQcm, LIBELLES_TYPES } from '../lib/qcm.js';
import { corrigerQroc } from '../lib/qroc.js';

const VERDICTS = { juste: 'Juste', fausse: 'Fausse', oubliee: 'Oubliée' };

export const coche = (on, titre) => html`<span class="coche${on ? ' on' : ''}" role="img" aria-label="${titre}: ${on ? 'cochée' : 'non cochée'}"></span>`;

// Marque « fatale » d'une proposition (comme Théia).
function marque(c, id) {
  if ((c.indispensables || []).includes(id)) return html`<span class="marque-fatale indisp">Indispensable</span>`;
  if ((c.inacceptables || []).includes(id)) return html`<span class="marque-fatale inacc">Inacceptable</span>`;
  return '';
}

// Choix de la marque dans le back-office (sujet corrigé) : indispensable sur
// une proposition juste, inacceptable sur une fausse.
function choixMarque(q, c, p) {
  const bonne = c.bonnes.includes(p.id);
  const val = (c.indispensables || []).includes(p.id) ? 'indispensable' : (c.inacceptables || []).includes(p.id) ? 'inacceptable' : '';
  return html`<label class="choix-marque no-print"><span class="sr">Marque de la proposition</span>
    <select data-marque="${q.id}" data-prop="${p.id}">
      <option value="">Sans marque</option>
      ${bonne
        ? html`<option value="indispensable" ${val === 'indispensable' ? 'selected' : ''}>Indispensable (oubliée = 0)</option>`
        : html`<option value="inacceptable" ${val === 'inacceptable' ? 'selected' : ''}>Inacceptable (cochée = 0)</option>`}
    </select></label>`;
}

// Une question corrigée. reponse : réponse de l'étudiant, ou undefined pour le sujet corrigé seul.
// editable : sujet corrigé du back-office, où l'on marque les propositions.
export function questionCorrigee(q, num, correction, reponse, avecCopie, editable = false) {
  const c = correction || { bonnes: [], reponses_qroc: [], explications: {}, commentaire: '' };
  const brutes = avecCopie ? points(q, c, reponse) : null;
  const coef = Number(q.coefficient) || 1;
  const pts = avecCopie ? pointsPonderes(q, c, reponse) : null;
  const qroc = avecCopie && q.type === 'QROC' ? corrigerQroc(reponse?.texte, c.reponses_qroc, c.refusees_qroc, c.partielles_qroc) : null;
  const corps =
    q.type === 'QROC'
      ? html`<div class="qroc-corr">
          ${avecCopie
            ? html`<div class="qroc-votre ${brutes === 1 ? 'v-juste' : brutes > 0 ? 'v-partielle' : 'v-fausse'}"><span class="aide">Votre réponse</span><strong>${reponse?.texte || '(pas de réponse)'}</strong>
                ${qroc?.mode === 'approche' ? html`<span class="aide">Acceptée : proche de « ${qroc.acceptee} »</span>` : ''}
                ${qroc?.mode === 'partielle' ? html`<span class="aide">Réponse jugée acceptable par l'équipe : 0,5 point</span>` : ''}
                ${qroc?.mode === 'refusee' ? html`<span class="aide">Réponse refusée par l'équipe</span>` : ''}</div>`
            : ''}
          <div><span class="aide">Réponses acceptées</span><ul class="liste-acceptees">${(c.reponses_qroc || []).map((r) => html`<li>${r}</li>`)}</ul>
            ${(c.partielles_qroc || []).length ? html`<span class="aide">Acceptables (0,5 point)</span><ul class="liste-acceptees">${c.partielles_qroc.map((r) => html`<li>${r}</li>`)}</ul>` : ''}</div>
        </div>`
      : html`<div class="tableau-defile"><table class="table-corr">
          <thead><tr><th></th><th>Réponse attendue</th>${avecCopie ? html`<th>Votre réponse</th>` : ''}<th class="sr">Proposition</th>${avecCopie ? html`<th class="sr">Verdict</th>` : ''}</tr></thead>
          <tbody>${q.propositions.map((p, i) => {
            const v = avecCopie ? verdict(p, c, reponse) : '';
            const exp = c.explications?.[p.id];
            return html`<tr class="${v ? 'v-' + v : ''}">
              <td class="lettre">${lettre(i)}</td>
              <td class="centre">${coche(c.bonnes.includes(p.id), 'Réponse attendue')}</td>
              ${avecCopie ? html`<td class="centre">${coche((reponse?.choix || []).includes(p.id), 'Votre réponse')}</td>` : ''}
              <td>${brut(htmlQcm(p.texte))} ${marque(c, p.id)}${v ? html`<span class="verdict-court">${VERDICTS[v]}</span>` : ''}${exp ? html`<div class="explication">${brut(htmlQcm(exp))}</div>` : ''}${editable ? choixMarque(q, c, p) : ''}</td>
              ${avecCopie ? html`<td class="verdict">${VERDICTS[v] || ''}</td>` : ''}
            </tr>`;
          })}</tbody></table></div>`;

  return html`<article class="q-corr">
    <header class="q-bandeau">
      <span>Question ${num} · Pondération ${coef}</span>
      <span>${LIBELLES_TYPES[q.type]}${q.type === 'QRP' ? ` · ${nbAttendues(q, c)} réponses attendues` : ''}</span>
    </header>
    <div class="q-corps">
      ${q.statut === 'annulee' ? html`<p class="alerte rouge">Question annulée : elle ne compte pas dans la note.</p>` : ''}
      ${q.statut === 'neutralisee' ? html`<p class="alerte">Question neutralisée : tous les candidats ont les points.</p>` : ''}
      ${avecCopie && q.statut !== 'annulee'
        ? html`<p class="q-points ${pts === coef ? 'plein' : pts > 0 ? 'partiel' : 'nul'}">${formatNote(Math.round(pts * 100) / 100)} / ${coef} point${coef > 1 ? 's' : ''}${reponse?.validee === false ? ' · réponse non validée' : ''}${q.type !== 'QROC' && reponse?.choix?.length && fatale(c, reponse.choix) ? ' · proposition indispensable oubliée ou inacceptable cochée' : ''}${q.type === 'QRP' && (reponse?.choix?.length || 0) > nbAttendues(q, c) ? ' · plus de cases cochées que de réponses attendues' : ''}</p>`
        : ''}
      <div class="q-enonce">${brut(htmlQcm(q.enonce))}</div>
      ${corps}
      ${c.commentaire ? html`<div class="q-commentaire"><strong>Commentaire de correction de la question</strong>${brut(htmlQcm(c.commentaire))}</div>` : ''}
    </div>
  </article>`;
}

// Sommaire d'une copie corrigée : un lien par dossier, avec la note du dossier.
function sommaireCopie(qcm, corrections, reponses) {
  return html`<nav class="carte sommaire no-print" aria-label="Sommaire des dossiers">
    <h2 class="titre-section">Sommaire</h2>
    <ol class="sommaire-liste">${qcm.map((d, i) => {
      const max = d.questions.reduce((t, q) => t + coefficient(q), 0);
      const obtenus = d.questions.reduce((t, q) => t + pointsPonderes(q, corrections[q.id], reponses[q.id]), 0);
      const ratio = max ? obtenus / max : 0;
      return html`<li><a href="#dossier-${i + 1}" data-ancre="dossier-${i + 1}">
        <span class="sommaire-titre">${d.titre}</span>
        <span class="sommaire-note ${ratio >= 0.7 ? 'bien' : ratio >= 0.4 ? 'moyen' : 'faible'}">${formatNote(Math.round(obtenus * 100) / 100)} / ${formatNote(max)}</span>
      </a></li>`;
    })}</ol>
  </nav>`;
}

// Tout le QCM corrigé, dossier par dossier (avec un sommaire pour une copie).
export function qcmCorrige(qcm, corrections, reponses, editable = false) {
  const avecCopie = !!reponses;
  return html`${avecCopie && qcm.length ? sommaireCopie(qcm, corrections, reponses) : ''}${qcm.map(
    (d, n) => html`<section class="dossier-corr" id="dossier-${n + 1}">
      <h2 class="titre-dossier">${d.titre}</h2>
      ${d.questions.map((q, i) => html`${editable ? reglagesQuestion(q, corrections[q.id]) : ''}${questionCorrigee(q, i + 1, corrections[q.id], reponses?.[q.id], avecCopie, editable)}`)}
    </section>`
  )}`;
}

// Back-office : type (QRM / QRP), réponses attendues, pondération, statut.
function reglagesQuestion(q, c) {
  const choix = q.type === 'QRM' || q.type === 'QRP';
  return html`<div class="reglages-question no-print" data-reglages="${q.id}">
    ${choix
      ? html`<label class="champ-mini"><span>Type</span><select data-champ="type">
          <option value="QRM" ${q.type === 'QRM' ? 'selected' : ''}>QRM</option>
          <option value="QRP" ${q.type === 'QRP' ? 'selected' : ''}>QRP (réponses précisées)</option>
        </select></label>
        ${q.type === 'QRP' ? html`<label class="champ-mini"><span>Réponses attendues</span><input type="number" min="1" max="${q.propositions.length}" data-champ="nb_reponses" value="${nbAttendues(q, c)}"></label>` : ''}`
      : ''}
    <label class="champ-mini"><span>Pondération</span><input type="number" min="1" max="20" step="1" data-champ="coefficient" value="${Number(q.coefficient) || 1}"></label>
    <label class="champ-mini"><span>Après l'épreuve</span><select data-champ="statut">
      <option value="normale" ${!q.statut || q.statut === 'normale' ? 'selected' : ''}>Comptée normalement</option>
      <option value="neutralisee" ${q.statut === 'neutralisee' ? 'selected' : ''}>Neutralisée (points pour tous)</option>
      <option value="annulee" ${q.statut === 'annulee' ? 'selected' : ''}>Annulée (retirée de la note)</option>
    </select></label>
  </div>`;
}

// Bandeau de note : note /20, points, moyenne, rang.
export function bandeauNote(r) {
  if (!r) return '';
  return html`<div class="bandeau-note">
    <div class="note-grande"><strong>${formatNote(r.note20)}</strong><span>/ 20</span></div>
    <dl class="note-details">
      <div><dt>Points</dt><dd>${formatNote(r.points)} / ${r.total}</dd></div>
      ${r.moyenne != null ? html`<div><dt>Moyenne</dt><dd>${formatNote(r.moyenne)} / 20</dd></div>` : ''}
      ${r.rang ? html`<div><dt>Rang</dt><dd>${r.rang}${r.rang === 1 ? 'er' : 'e'} sur ${r.effectif}</dd></div>` : ''}
    </dl>
  </div>`;
}
