// Entraînement, en trois onglets :
// - Conférences annuelles : les épreuves terminées, rejouées dans les mêmes
//   conditions que l'épreuve (durée, questions validées une à une, correction
//   à la fin) ;
// - QCM d'entraînement et QCM coaching : QCM rangés là par l'équipe
//   (back-office, « Onglet dans Entraînement »), corrigés après chaque question.
// Hors classement ; chaque tentative est gardée (score, réponses) pour Progrès.
import { html, brut } from '../lib/html.js';
import { icones } from '../lib/icones.js';
import { dateCourte } from '../lib/dates.js';
import { points, formatNote, noteSur20, pointsPonderes, coefficient } from '../lib/bareme.js';
import { serieDe, aPlat, lettre, htmlQcm, chargerImages, LIBELLES_TYPES, noterCopie, CATEGORIES, categorieDe } from '../lib/qcm.js';
import { enTete, vide } from './commun.js';
import { questionCorrigee } from './qcm-rendu.js';
import { chrono } from './passage.js';

const CLE_ONGLET = 'mdepi-entrainement-onglet';
const lireOnglet = () => {
  try {
    return sessionStorage.getItem(CLE_ONGLET) || 'conference';
  } catch {
    return 'conference';
  }
};

export async function vueEntrainement(app) {
  const [seances, tentatives] = await Promise.all([app.api.seances(), app.api.mesEntrainements().catch(() => [])]);
  const maintenant = new Date();
  // Une ligne par épreuve (série) : conférence une fois finie, QCM d'entraînement
  // ou de coaching dès sa date ; et seulement si la correction est visible.
  const vues = new Set();
  const candidates = seances
    .filter((s) => s.epreuve && !s.annulee && new Date(categorieDe(s) === 'conference' ? s.fin : s.debut) <= maintenant)
    .reverse()
    .filter((s) => !vues.has(serieDe(s)) && vues.add(serieDe(s)));
  const infos = await Promise.all(candidates.map((s) => app.api.infosQcm(s.id).catch(() => null)));
  const liste = candidates.map((s, i) => ({ s, infos: infos[i] })).filter((x) => x.infos?.questions && x.infos.correction_visible);

  const ligne = ({ s, infos: inf }) => {
    const t = tentatives.filter((e) => e.serie_id === serieDe(s));
    const notes = t.map((e) => noteSur20(Number(e.points), e.total));
    return html`<a class="carte ligne-entrainement" href="#/entrainement/${s.id}" data-cat="${categorieDe(s)}" data-matiere="${s.matiere || ''}">
      <div class="pile-mini">
        <strong>${s.titre}</strong>
        <span class="aide">${s.matiere ? s.matiere + ' · ' : ''}${dateCourte(s.debut)} · ${inf.questions} questions · ${inf.dossiers} dossier${inf.dossiers > 1 ? 's' : ''}</span>
        ${t.length
          ? html`<span class="aide">${t.length} tentative${t.length > 1 ? 's' : ''} · meilleure ${formatNote(Math.max(...notes))}/20 · dernière ${formatNote(notes[0])}/20</span>`
          : html`<span class="aide">Pas encore fait</span>`}
      </div>
      <span class="btn-lecture" aria-hidden="true">${icones.lecture(18)}</span>
    </a>`;
  };
  const matieresDe = (cat) => [...new Set(liste.filter((x) => categorieDe(x.s) === cat).map((x) => x.s.matiere).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));
  const AIDES = {
    conference: "Rejouez les conférences terminées dans les mêmes conditions que l'épreuve : même durée, questions validées une à une, correction à la fin. Hors classement.",
    entrainement: 'QCM pour vous entraîner, avec la correction après chaque question. Hors classement.',
    coaching: 'QCM du coaching, avec la correction après chaque question. Hors classement.',
  };
  const VIDES = {
    conference: 'Les conférences apparaîtront ici dès la fin de votre épreuve.',
    entrainement: "Aucun QCM d'entraînement pour le moment.",
    coaching: 'Aucun QCM coaching pour le moment.',
  };

  const vue = html`<div class="page">
    ${enTete('Entraînement', app.profil)}
    <div class="segments segments-3" role="tablist">
      ${Object.entries(CATEGORIES).map(([cat, nom]) => html`<button type="button" role="tab" class="segment" data-onglet="${cat}">${nom}</button>`)}
    </div>
    <p class="aide" data-aide></p>
    <label class="champ" data-filtre><span>Matière</span><select data-matiere><option value="">Toutes les matières</option></select></label>
    <section class="pile-petite">
      ${liste.map(ligne)}
      <div class="carte" data-vide hidden><p class="aide" data-vide-texte></p></div>
    </section>
  </div>`;

  function monter(el) {
    const select = el.querySelector('[data-matiere]');
    let onglet = lireOnglet();
    if (!CATEGORIES[onglet]) onglet = 'conference';
    const filtrer = () => {
      const m = onglet === 'coaching' ? '' : select.value;
      let n = 0;
      el.querySelectorAll('[data-cat]').forEach((a) => {
        a.hidden = a.dataset.cat !== onglet || (!!m && a.dataset.matiere !== m);
        if (!a.hidden) n++;
      });
      el.querySelector('[data-vide]').hidden = n > 0;
      el.querySelector('[data-vide-texte]').textContent = m ? `Rien en ${m} pour le moment.` : VIDES[onglet];
    };
    const choisir = (cat) => {
      onglet = cat;
      try {
        sessionStorage.setItem(CLE_ONGLET, cat);
      } catch {
        /* ignoré */
      }
      el.querySelectorAll('[data-onglet]').forEach((b) => {
        b.classList.toggle('actif', b.dataset.onglet === cat);
        b.setAttribute('aria-selected', String(b.dataset.onglet === cat));
      });
      el.querySelector('[data-aide]').textContent = AIDES[cat];
      // Filtre par matière, sauf pour le coaching.
      el.querySelector('[data-filtre]').hidden = cat === 'coaching';
      const garde = select.value;
      const matieres = matieresDe(cat);
      select.innerHTML = String(html`<option value="">Toutes les matières</option>${matieres.map((m) => html`<option>${m}</option>`)}`);
      select.value = matieres.includes(garde) ? garde : '';
      filtrer();
    };
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-onglet]');
      if (b) choisir(b.dataset.onglet);
    });
    select.addEventListener('change', filtrer);
    choisir(onglet);
  }

  return { titre: 'Entraînement', html: vue, monter };
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
  // Conférence annuelle : mêmes conditions que l'épreuve (durée, questions
  // validées une à une sans correction, correction complète à la fin).
  const examen = categorieDe(s) === 'conference';
  const duree = new Date(s.fin) - new Date(s.debut);
  // Questions ratées : dernière tentative d'entraînement, sinon la copie de l'épreuve.
  const derniere = tentatives.find((e) => e.serie_id === serieDe(s));
  const source = derniere?.reponses || copie?.reponses;
  const ratees = source ? toutes.filter((q) => points(q, corrections[q.id], source[q.id]) < 1) : [];

  const vue = html`<div class="page">
    ${enTete('Entraînement', null, '#/entrainement')}
    <div class="chrono chrono-entrainement" data-chrono hidden title="Temps restant"></div>
    <div data-zone></div>
  </div>`;

  function monter(el) {
    const zone = el.querySelector('[data-zone]');
    let questions = [];
    let i = 0;
    let reponses = {};
    let verifiee = false;
    let confirmerVide = false;
    let minuteur = null;
    const chronoEl = el.querySelector('[data-chrono]');
    const arreterChrono = () => {
      clearInterval(minuteur);
      minuteur = null;
      chronoEl.hidden = true;
    };
    const lancerChrono = () => {
      arreterChrono();
      const limite = Date.now() + duree;
      const tic = () => {
        const reste = limite - Date.now();
        chronoEl.textContent = 'Temps restant ' + chrono(reste);
        chronoEl.classList.toggle('urgent', reste < 5 * 60000);
        if (reste <= 0) {
          app.message("Temps écoulé : l'épreuve est terminée.");
          fin();
        }
      };
      chronoEl.hidden = false;
      tic();
      minuteur = setInterval(tic, 1000);
    };
    // Quitter la page arrête le chrono.
    window.addEventListener('hashchange', arreterChrono, { once: true });

    const accueil = () => {
      zone.innerHTML = String(html`<section class="carte pile">
        <h2 class="titre-seance">${s.titre}</h2>
        <p>${toutes.length} questions en ${qcm.length} dossier${qcm.length > 1 ? 's' : ''}.
          ${examen
            ? `Mêmes conditions que l'épreuve : ${chrono(duree)}, chaque question validée avant de passer à la suite, correction complète à la fin.`
            : 'Correction après chaque question, sans limite de temps.'}</p>
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
      confirmerVide = false;
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
          ${q.type === 'QRP' ? html`<p class="alerte">${q.nb_reponses} réponses attendues : pas plus de ${q.nb_reponses} cases.</p>` : ''}
          ${q.type === 'QROC'
            ? html`<label class="champ"><span>Votre réponse</span><input class="qroc" data-qroc maxlength="500" autocomplete="off" value="${r.texte}"></label>`
            : html`<fieldset class="propositions"><legend class="sr">Propositions</legend>${q.propositions.map(
                (p, k) => html`<label class="prop"><input type="${q.type === 'QRU' ? 'radio' : 'checkbox'}" name="p" value="${p.id}" ${r.choix.includes(p.id) ? 'checked' : ''}>
                  <span class="lettre">${lettre(k)}</span><span class="prop-texte">${brut(htmlQcm(p.texte))}</span></label>`
              )}</fieldset>`}
        </div>
        <p class="alerte attention" data-vide hidden>Vous n'avez rien répondu. Cliquez à nouveau pour valider sans réponse.</p>
        <div class="actions passage-actions">${examen
          ? html`<button class="btn plein" data-action="valider">${i + 1 < questions.length ? (questions[i + 1].di === q.di ? 'Valider et passer à la suite' : 'Valider la question') : "Valider et terminer l'épreuve"}</button>`
          : html`<button class="btn plein" data-action="verifier">Vérifier ma réponse</button>`}</div>
      </section>`);
      chargerImages(zone, app.api);
      window.scrollTo(0, 0);
    };

    const lire = () => {
      const q = questions[i];
      const champ = zone.querySelector('[data-qroc]');
      reponses[q.id] = {
        question_id: q.id,
        choix: [...zone.querySelectorAll('input[name=p]:checked')].map((x) => x.value),
        texte: champ ? champ.value : '',
      };
      return reponses[q.id];
    };
    const valider = () => {
      const r = lire();
      if (!r.choix.length && !r.texte.trim() && !confirmerVide) {
        confirmerVide = true;
        zone.querySelector('[data-vide]').hidden = false;
        return;
      }
      if (++i < questions.length) dessiner();
      else fin();
    };
    const verifier = () => {
      const q = questions[i];
      lire();
      verifiee = true;
      zone.querySelector('[data-question]').innerHTML = String(questionCorrigee(q, q.num, corrections[q.id], reponses[q.id], true));
      zone.querySelector('.passage-actions').innerHTML = String(
        html`<button class="btn plein" data-action="suivante">${i + 1 < questions.length ? 'Question suivante' : 'Voir mon score'}</button>`
      );
      chargerImages(zone, app.api);
    };

    const fin = async () => {
      if (!questions.length) return;
      arreterChrono();
      const { points: pts, total, note20: note } = noterCopie(questions, corrections, reponses);
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
          const p = pointsPonderes(q, corrections[q.id], reponses[q.id]);
          const max = coefficient(q);
          return html`<li>${q.dossier.titre} · Q${q.qi + 1} : <strong class="${p === max ? 'c-ok' : p > 0 ? '' : 'c-ko'}">${formatNote(Math.round(p * 100) / 100)}</strong>${max !== 1 ? ` / ${max}` : ''}${q.statut === 'annulee' ? ' (annulée)' : ''}</li>`;
        })}</ul>
        <div class="actions">
          <button class="btn plein" data-depart="tout">Recommencer</button>
          <a class="btn contour" href="#/entrainement">Autres épreuves</a>
        </div>
      </section>
      ${examen
        ? html`<section class="pile-petite"><h2 class="titre-section">Correction</h2>${questions.map(
            (q) => html`<section class="passage-question"><p class="surtitre">${q.dossier.titre} · question ${q.qi + 1} sur ${q.dossier.questions.length}</p>
              ${questionCorrigee(q, q.num, corrections[q.id], reponses[q.id] || { question_id: q.id, choix: [], texte: '' }, true)}</section>`
          )}</section>`
        : ''}`);
      chargerImages(zone, app.api);
      questions = [];
      window.scrollTo(0, 0);
    };

    // QRP : pas plus de n cases.
    el.addEventListener('change', (e) => {
      const q = questions[i];
      if (e.target.name === 'p' && q?.type === 'QRP' && e.target.checked && zone.querySelectorAll('input[name=p]:checked').length > (q.nb_reponses || 99)) {
        e.target.checked = false;
        app.message(`${q.nb_reponses} réponses attendues : décochez une case avant d'en cocher une autre.`, 'erreur');
      }
    });
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-depart],[data-action]');
      if (!b) return;
      if (b.dataset.depart) {
        questions = b.dataset.depart === 'ratees' ? ratees : toutes;
        i = 0;
        reponses = {};
        if (examen && b.dataset.depart === 'tout') lancerChrono();
        else arreterChrono();
        dessiner();
      } else if (b.dataset.action === 'valider') valider();
      else if (b.dataset.action === 'verifier' && !verifiee) verifier();
      else if (b.dataset.action === 'suivante') {
        if (++i < questions.length) dessiner();
        else fin();
      }
    });
    accueil();
  }

  return { html: vue, monter, titre: 'Entraînement' };
}
