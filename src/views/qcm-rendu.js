// Affichage des QCM corrigés, sur le modèle de la relecture Théia :
// bandeau « Question N · Pondération », colonne « Réponse attendue »,
// commentaire de correction. Sert à l'étudiant (sa copie), à l'équipe
// (sujet corrigé, copie d'un étudiant) et à l'impression (sauvegarde PDF).
import { html, brut } from '../lib/html.js';
import { points, verdict, formatNote } from '../lib/bareme.js';
import { lettre, htmlQcm, LIBELLES_TYPES } from '../lib/qcm.js';
import { corrigerQroc } from '../lib/qroc.js';

const VERDICTS = { juste: 'Juste', fausse: 'Fausse', oubliee: 'Oubliée' };

export const coche = (on, titre) => html`<span class="coche${on ? ' on' : ''}" role="img" aria-label="${titre}: ${on ? 'cochée' : 'non cochée'}"></span>`;

// Une question corrigée. reponse : réponse de l'étudiant, ou undefined pour le sujet corrigé seul.
export function questionCorrigee(q, num, correction, reponse, avecCopie) {
  const c = correction || { bonnes: [], reponses_qroc: [], explications: {}, commentaire: '' };
  const pts = avecCopie ? points(q, c, reponse) : null;
  const qroc = avecCopie && q.type === 'QROC' ? corrigerQroc(reponse?.texte, c.reponses_qroc, c.refusees_qroc) : null;
  const corps =
    q.type === 'QROC'
      ? html`<div class="qroc-corr">
          ${avecCopie
            ? html`<div class="qroc-votre ${pts ? 'v-juste' : 'v-fausse'}"><span class="aide">Votre réponse</span><strong>${reponse?.texte || '(pas de réponse)'}</strong>
                ${qroc?.mode === 'approche' ? html`<span class="aide">Acceptée : proche de « ${qroc.acceptee} »</span>` : ''}
                ${qroc?.mode === 'refusee' ? html`<span class="aide">Réponse refusée par l'équipe</span>` : ''}</div>`
            : ''}
          <div><span class="aide">Réponses acceptées</span><ul class="liste-acceptees">${(c.reponses_qroc || []).map((r) => html`<li>${r}</li>`)}</ul></div>
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
              <td>${brut(htmlQcm(p.texte))}${exp ? html`<div class="explication">${brut(htmlQcm(exp))}</div>` : ''}</td>
              ${avecCopie ? html`<td class="verdict">${VERDICTS[v] || ''}</td>` : ''}
            </tr>`;
          })}</tbody></table></div>`;

  return html`<article class="q-corr">
    <header class="q-bandeau">
      <span>Question ${num} · Pondération 1</span>
      <span>${LIBELLES_TYPES[q.type]}</span>
    </header>
    <div class="q-corps">
      ${avecCopie ? html`<p class="q-points ${pts === 1 ? 'plein' : pts > 0 ? 'partiel' : 'nul'}">${formatNote(pts)} / 1 point${reponse?.validee === false ? ' · réponse non validée' : ''}</p>` : ''}
      <div class="q-enonce">${brut(htmlQcm(q.enonce))}</div>
      ${corps}
      ${c.commentaire ? html`<div class="q-commentaire"><strong>Commentaire de correction de la question</strong>${brut(htmlQcm(c.commentaire))}</div>` : ''}
    </div>
  </article>`;
}

// Tout le QCM corrigé, dossier par dossier.
export function qcmCorrige(qcm, corrections, reponses) {
  const avecCopie = !!reponses;
  return qcm.map(
    (d) => html`<section class="dossier-corr">
      <h2 class="titre-dossier">${d.titre}</h2>
      ${d.questions.map((q, i) => questionCorrigee(q, i + 1, corrections[q.id], reponses?.[q.id], avecCopie))}
    </section>`
  );
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
