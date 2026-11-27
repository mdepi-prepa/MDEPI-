// Entraînement : les épreuves terminées (correction visible) peuvent être
// rejouées, avec la correction après chaque question. Hors classement ;
// chaque tentative est gardée (score, réponses) pour l'onglet Progrès.
import { html, brut } from '../lib/html.js';
import { icones } from '../lib/icones.js';
import { dateCourte } from '../lib/dates.js';
import { points, formatNote, noteSur20 } from '../lib/bareme.js';
import { serieDe, aPlat, lettre, htmlQcm, chargerImages, LIBELLES_TYPES } from '../lib/qcm.js';
import { enTete, vide } from './commun.js';
import { questionCorrigee } from './qcm-rendu.js';

export async function vueEntrainement(app) {
  const [seances, tentatives] = await Promise.all([app.api.seances(), app.api.mesEntrainements().catch(() => [])]);
  const maintenant = new Date();
  // Une ligne par épreuve (série), une fois la copie corrigée visible.
  const vues = new Set();
  const candidates = seances
    .filter((s) => s.epreuve && !s.annulee && new Date(s.fin) <= maintenant)
    .reverse()
    .filter((s) => !vues.has(serieDe(s)) && vues.add(serieDe(s)));
  const infos = await Promise.all(candidates.map((s) => app.api.infosQcm(s.id).catch(() => null)));
  const liste = candidates.map((s, i) => ({ s, infos: infos[i] })).filter((x) => x.infos?.questions && x.infos.correction_visible);

  const ligne = ({ s, infos: inf }) => {
    const t = tentatives.filter((e) => e.serie_id === serieDe(s));
    const notes = t.map((e) => noteSur20(Number(e.points), e.total));
    return html`<a class="carte ligne-entrainement" href="#/entrainement/${s.id}">
      <div class="pile-mini">
        <strong>${s.titre}</strong>
        <span class="aide">${dateCourte(s.debut)} · ${inf.questions} questions · ${inf.dossiers} dossier${inf.dossiers > 1 ? 's' : ''}</span>
        ${t.length
          ? html`<span class="aide">${t.length} tentative${t.length > 1 ? 's' : ''} · meilleure ${formatNote(Math.max(...notes))}/20 · dernière ${formatNote(notes[0])}/20</span>`
          : html`<span class="aide">Pas encore rejouée</span>`}
      </div>
      <span class="btn-lecture" aria-hidden="true">${icones.lecture(18)}</span>
    </a>`;
  };

  return {
    titre: 'Entraînement',
    html: html`<div class="page">
      ${enTete('Entraînement', app.profil)}
      <p class="aide">Rejouez les épreuves terminées, avec la correction après chaque question. Ces tentatives ne comptent pas dans le classement.</p>
      <section class="pile-petite">
        <h2 class="titre-section">Épreuves à rejouer</h2>
        ${liste.length ? liste.map(ligne) : html`<div class="carte">${vide('Les épreuves apparaîtront ici dès la fin de votre épreuve.')}</div>`}
      </section>
    </div>`,
  };
}

export async function vueRejouer(app, { id }) {
  const s = await app.api.seance(id);
  const [qcm, corrections, copie, tentatives] = await Promise.all([
    app.api.qcm(id),
    app.api.corrections(id),
    app.api.maCopie(id).catch(() => null),
    app.api.mesEntrainements().catch(() => []),
  ]);
  const toutes = aPlat(qcm);
  if (!s || !toutes.length || !Object.keys(corrections).length) {
    return { html: html`<div class="page">${enTete('Entraînement', null, '#/entrainement')}<p>Cette épreuve n'est pas encore disponible en entraînement.</p></div>` };
  }
  // Questions ratées : dernière tentative d'entraînement, sinon la copie de l'épreuve.
  const derniere = tentatives.find((e) => e.serie_id === serieDe(s));
  const source = derniere?.reponses || copie?.reponses;
  const ratees = source ? toutes.filter((q) => points(q, corrections[q.id], source[q.id]) < 1) : [];

  const vue = html`<div class="page">
    ${enTete('Entraînement', null, '#/entrainement')}
    <div data-zone></div>
  </div>`;

  function monter(el) {
    const zone = el.querySelector('[data-zone]');
    let questions = [];
    let i = 0;
    let reponses = {};
    let verifiee = false;

    const accueil = () => {
      zone.innerHTML = String(html`<section class="carte pile">
        <h2 class="titre-seance">${s.titre}</h2>
        <p>${toutes.length} questions en ${qcm.length} dossier${qcm.length > 1 ? 's' : ''}. Correction après chaque question, sans limite de temps.</p>
        <div class="actions">
          <button class="btn plein" data-depart="tout">Rejouer toute l'épreuve</button>
          ${ratees.length ? html`<button class="btn contour" data-depart="ratees">Refaire mes ${ratees.length} question${ratees.length > 1 ? 's' : ''} ratée${ratees.length > 1 ? 's' : ''}</button>` : ''}
        </div>
        ${ratees.length ? html`<p class="aide">Questions ratées d'après ${derniere ? 'votre dernière tentative' : 'votre copie de l’épreuve'}.</p>` : ''}
      </section>`);
    };

    const dessiner = () => {
      const q = questions[i];
      const r = reponses[q.id] || { choix: [], texte: '' };
      verifiee = false;
      zone.innerHTML = String(html`<section class="passage-question">
        <div class="progression" role="progressbar" aria-valuemin="0" aria-valuemax="${questions.length}" aria-valuenow="${i}"><span style="width:${Math.round((100 * i) / questions.length)}%"></span></div>
        <p class="surtitre">${q.dossier.titre} · question ${q.qi + 1} sur ${q.dossier.questions.length} · ${i + 1}/${questions.length}</p>
        ${q.qi > 0 && questions[i - 1]?.di !== q.di
          ? html`<details class="rappel" open><summary>Énoncé du dossier</summary><div class="q-enonce">${brut(htmlQcm(q.dossier.questions[0].enonce))}</div></details>`
          : q.qi > 0
            ? html`<details class="rappel"><summary>Relire l'énoncé du dossier</summary><div class="q-enonce">${brut(htmlQcm(q.dossier.questions[0].enonce))}</div></details>`
            : ''}
        <div data-question>
          <header class="q-bandeau"><span>Question ${q.num}</span><span>${LIBELLES_TYPES[q.type]}</span></header>
          <div class="q-enonce">${brut(htmlQcm(q.enonce))}</div>
          ${q.type === 'QROC'
            ? html`<label class="champ"><span>Votre réponse</span><input class="qroc" data-qroc maxlength="500" autocomplete="off" value="${r.texte}"></label>`
            : html`<fieldset class="propositions"><legend class="sr">Propositions</legend>${q.propositions.map(
                (p, k) => html`<label class="prop"><input type="${q.type === 'QRU' ? 'radio' : 'checkbox'}" name="p" value="${p.id}" ${r.choix.includes(p.id) ? 'checked' : ''}>
                  <span class="lettre">${lettre(k)}</span><span class="prop-texte">${brut(htmlQcm(p.texte))}</span></label>`
              )}</fieldset>`}
        </div>
        <div class="actions passage-actions"><button class="btn plein" data-action="verifier">Vérifier ma réponse</button></div>
      </section>`);
      chargerImages(zone, app.api);
      window.scrollTo(0, 0);
    };

    const verifier = () => {
      const q = questions[i];
      const champ = zone.querySelector('[data-qroc]');
      reponses[q.id] = {
        question_id: q.id,
        choix: [...zone.querySelectorAll('input[name=p]:checked')].map((x) => x.value),
        texte: champ ? champ.value : '',
      };
      verifiee = true;
      zone.querySelector('[data-question]').innerHTML = String(questionCorrigee(q, q.num, corrections[q.id], reponses[q.id], true));
      zone.querySelector('.passage-actions').innerHTML = String(
        html`<button class="btn plein" data-action="suivante">${i + 1 < questions.length ? 'Question suivante' : 'Voir mon score'}</button>`
      );
      chargerImages(zone, app.api);
    };

    const fin = async () => {
      const pts = questions.reduce((a, q) => a + points(q, corrections[q.id], reponses[q.id]), 0);
      const total = questions.length;
      const note = noteSur20(pts, total);
      try {
        await app.api.enregistrerEntrainement(s.id, reponses, Math.round(pts * 100) / 100, total);
      } catch (err) {
        app.message("Score non enregistré : " + err.message, 'erreur');
      }
      zone.innerHTML = String(html`<section class="carte pile">
        <h2 class="titre-seance">Score</h2>
        <div class="note-grande"><strong>${formatNote(note)}</strong><span>/ 20</span></div>
        <p>${formatNote(Math.round(pts * 100) / 100)} point${pts > 1 ? 's' : ''} sur ${total}.</p>
        <ul class="liste-simple">${questions.map((q) => {
          const p = points(q, corrections[q.id], reponses[q.id]);
          return html`<li>${q.dossier.titre} · Q${q.qi + 1} : <strong class="${p === 1 ? 'c-ok' : p > 0 ? '' : 'c-ko'}">${formatNote(p)}</strong></li>`;
        })}</ul>
        <div class="actions">
          <button class="btn plein" data-depart="tout">Recommencer</button>
          <a class="btn contour" href="#/entrainement">Autres épreuves</a>
        </div>
      </section>`);
      window.scrollTo(0, 0);
    };

    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-depart],[data-action]');
      if (!b) return;
      if (b.dataset.depart) {
        questions = b.dataset.depart === 'ratees' ? ratees : toutes;
        i = 0;
        reponses = {};
        dessiner();
      } else if (b.dataset.action === 'verifier' && !verifiee) verifier();
      else if (b.dataset.action === 'suivante') {
        if (++i < questions.length) dessiner();
        else fin();
      }
    });
    accueil();
  }

  return { html: vue, monter, titre: 'Entraînement' };
}
