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
import { questionCorrigee, sommaireCopie } from './qcm-rendu.js';

const CLE_ONGLET = 'mdepi-entrainement-onglet';
const lireOnglet = () => {
  try {
    return sessionStorage.getItem(CLE_ONGLET) || 'conference';
  } catch {
    return 'conference';
  }
};

// Scores d'entraînement pas encore envoyés (perte de connexion à la fin) :
// gardés sur l'appareil et renvoyés dès que possible.
const CLE_ATTENTE = 'mdepi-entrainements-attente';
const lireJson = (cle, defaut) => {
  try {
    return JSON.parse(localStorage.getItem(cle)) ?? defaut;
  } catch {
    return defaut;
  }
};
const ecrireJson = (cle, valeur) => {
  try {
    if (valeur == null) localStorage.removeItem(cle);
    else localStorage.setItem(cle, JSON.stringify(valeur));
  } catch {
    /* stockage indisponible */
  }
};
let envoiAttente = null;
let ecouteReseau = false;
function envoyerScoresEnAttente(app) {
  if (envoiAttente) return envoiAttente;
  envoiAttente = (async () => {
    let liste = lireJson(CLE_ATTENTE, []);
    while (liste.length) {
      const [t] = liste;
      try {
        await app.api.enregistrerEntrainement(t.seance, t.reponses, t.points, t.total);
      } catch (err) {
        if (/connexion|fetch|network/i.test(err.message)) break;
      }
      liste = lireJson(CLE_ATTENTE, []).filter((x) => x.le !== t.le);
      ecrireJson(CLE_ATTENTE, liste.length ? liste : null);
    }
  })().finally(() => (envoiAttente = null));
  return envoiAttente;
}

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
    envoyerScoresEnAttente(app);
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
  // Questions ratées : dernière tentative d'entraînement, sinon la copie de l'épreuve.
  const derniere = tentatives.find((e) => e.serie_id === serieDe(s));
  const source = derniere?.reponses || copie?.reponses;
  const ratees = source ? toutes.filter((q) => points(q, corrections[q.id], source[q.id]) < 1) : [];

  const vue = html`<div class="page">
    ${enTete('Entraînement', null, '#/entrainement')}
    <div data-zone></div>
  </div>`;

  function monter(el) {
    envoyerScoresEnAttente(app);
    if (!ecouteReseau) {
      ecouteReseau = true;
      window.addEventListener('online', () => envoyerScoresEnAttente(app));
    }
    const zone = el.querySelector('[data-zone]');
    let questions = [];
    let i = 0;
    let reponses = {};
    // Tentative en cours gardée sur l'appareil à chaque réponse : on peut la
    // reprendre après une coupure, une fermeture de l'app ou un rechargement.
    const cleTentative = `mdepi-entrainement-${s.id}-${app.profil?.id || ''}`;
    const sauver = () => questions.length && ecrireJson(cleTentative, { ids: questions.map((q) => q.id), reponses, i, courant, le: Date.now() });
    const enCours = lireJson(cleTentative, null);
    const reprise = enCours?.ids?.length && enCours.ids.every((id) => toutes.some((q) => q.id === id)) ? enCours : null;
    let verifiee = false;
    let confirmerVide = false;
    // Conférences : même écran que l'épreuve (sommaire des questions,
    // questions validées une à une, questions précédentes du dossier au-dessus),
    // sans limite de temps.
    let courant = 0;
    const repE = (q) => reponses[q.id] || { question_id: q.id, choix: [], texte: '', validee: false };
    const aRepondu = (q) => (q.type === 'QROC' ? !!repE(q).texte?.trim() : repE(q).choix?.length > 0);
    const accessible = (k) => {
      const q = questions[k];
      const prec = questions[k - 1];
      return !prec || prec.di !== q.di || repE(prec).validee;
    };
    const quitterPassage = () => {
      document.body.classList.remove('mode-epreuve');
      
    };
    window.addEventListener('hashchange', quitterPassage, { once: true });

    const demarrerPassage = (depuis = 0) => {
      document.body.classList.add('mode-epreuve');
      
      courant = 0;
      zone.innerHTML = String(html`<div class="passage">
        <header class="passage-haut">
          <a class="btn-icone" href="#/entrainement" aria-label="Quitter l'entraînement">${icones.retour(20)}</a>
          <div class="pile-mini passage-titre"><strong>${s.titre}</strong><span class="aide">Entraînement · sans limite de temps</span></div>
          <a class="btn-icone" href="#/" aria-label="Revenir à l'accueil" title="Revenir à l'accueil">${icones.accueil(20)}</a>
        </header>
        <div class="passage-corps">
          <nav class="passage-nav" aria-label="Questions" data-nav></nav>
          <section class="passage-question" data-zone-q aria-live="polite"></section>
        </div>
        <div class="resume" data-resume hidden></div>
      </div>`);
      allerA(0);
      // Reprise : on revient sur la question où l'on s'était arrêté.
      while (depuis > courant && accessible(courant + 1)) allerA(courant + 1);
      if (!depuis) window.scrollTo(0, 0);
    };

    const dessinerNavE = () => {
      const nav = zone.querySelector('[data-nav]');
      const dis = [...new Set(questions.map((q) => q.di))];
      nav.innerHTML = String(html`${dis.map((di) => {
        const items = questions.map((q, k) => ({ q, k })).filter((x) => x.q.di === di);
        return html`<div class="nav-dossier">
          <span class="nav-dossier-titre">${items[0].q.dossier.titre}</span>
          <div class="nav-numeros">${items.map(({ q, k }) => {
            const cls = [repE(q).validee ? 'validee' : aRepondu(q) ? 'repondue' : '', k === courant ? 'courante' : '', accessible(k) ? '' : 'verrouillee'].join(' ');
            return html`<button class="num ${cls}" data-aller="${k}" ${accessible(k) ? '' : 'disabled'}
              aria-label="Question ${q.num}${repE(q).validee ? ', validée' : aRepondu(q) ? ', répondue' : ''}">${q.num}</button>`;
          })}</div>
        </div>`;
      })}
      <button class="btn contour terminer" data-action="resume">Tout envoyer et terminer</button>`);
    };

    const dessinerQuestionE = () => {
      confirmerVide = false;
      const zq = zone.querySelector('[data-zone-q]');
      const q = questions[courant];
      const r = repE(q);
      const fige = r.validee;
      const suivante = questions[courant + 1];
      const avant = questions.filter((x, k) => k < courant && x.di === q.di);
      zq.innerHTML = String(html`
        ${avant.length
          ? html`<div class="q-precedentes">${avant.map((x) => {
              const rx = repE(x);
              return html`<article class="q-precedente">
                <header class="q-bandeau"><span>Question ${x.num}</span><span>${rx.validee ? 'Validée' : LIBELLES_TYPES[x.type]}</span></header>
                <div class="q-enonce">${brut(htmlQcm(x.enonce))}</div>
                ${x.type === 'QROC'
                  ? html`<p class="q-reponse-qroc"><span class="aide">Votre réponse : </span>${rx.texte || '(sans réponse)'}</p>`
                  : html`<fieldset class="propositions" disabled><legend class="sr">Propositions</legend>${x.propositions.map(
                      (p, k) => html`<label class="prop">
                        <input type="${x.type === 'QRU' ? 'radio' : 'checkbox'}" ${(rx.choix || []).includes(p.id) ? 'checked' : ''}>
                        <span class="lettre">${lettre(k)}</span><span class="prop-texte">${brut(htmlQcm(p.texte))}</span>
                      </label>`
                    )}</fieldset>`}
              </article>`;
            })}</div>`
          : ''}
        <p class="surtitre" data-q-courante>${q.dossier.titre} · question ${q.qi + 1} sur ${q.dossier.questions.length}</p>
        ${q.qi > 0 && !avant.some((x) => x.qi === 0)
          ? html`<details class="rappel"><summary>Relire l'énoncé du dossier</summary><div class="q-enonce">${brut(htmlQcm(q.dossier.questions[0].enonce))}</div></details>`
          : ''}
        <header class="q-bandeau"><span>Question ${q.num}</span><span>${LIBELLES_TYPES[q.type]}</span></header>
        <div class="q-enonce">${brut(htmlQcm(q.enonce))}</div>
        ${q.type === 'QRP' ? html`<p class="alerte">${q.nb_reponses} réponse${q.nb_reponses > 1 ? 's' : ''} attendue${q.nb_reponses > 1 ? 's' : ''} : vous ne pouvez pas cocher plus de ${q.nb_reponses} case${q.nb_reponses > 1 ? 's' : ''}.</p>` : ''}
        ${q.type === 'QROC'
          ? html`<label class="champ"><span>Votre réponse</span><input class="qroc" data-qroc maxlength="500" autocomplete="off" value="${r.texte || ''}" ${fige ? 'disabled' : ''}></label>`
          : html`<fieldset class="propositions" ${fige ? 'disabled' : ''}><legend class="sr">Propositions</legend>${q.propositions.map(
              (p, k) => html`<label class="prop">
                <input type="${q.type === 'QRU' ? 'radio' : 'checkbox'}" name="p" value="${p.id}" ${(r.choix || []).includes(p.id) ? 'checked' : ''}>
                <span class="lettre">${lettre(k)}</span><span class="prop-texte">${brut(htmlQcm(p.texte))}</span>
              </label>`
            )}</fieldset>`}
        ${fige ? html`<p class="alerte vert">Question validée : votre réponse n'est plus modifiable.</p>` : ''}
        <p class="alerte attention" data-vide hidden>Vous n'avez rien répondu. Cliquez à nouveau pour valider sans réponse.</p>
        <div class="actions passage-actions">
          <button class="btn contour" data-aller="${courant - 1}" ${courant > 0 && accessible(courant - 1) ? '' : 'disabled'}>Précédente</button>
          ${fige
            ? suivante
              ? html`<button class="btn plein" data-aller="${courant + 1}" ${accessible(courant + 1) ? '' : 'disabled'}>Suivante</button>`
              : html`<button class="btn plein" data-action="resume">Terminer</button>`
            : html`<button class="btn plein" data-action="valider">${suivante && suivante.di === q.di ? 'Valider et passer à la suite' : 'Valider la question'}</button>`}
        </div>`);
      chargerImages(zq, app.api);
    };

    const allerA = (k) => {
      if (k < 0 || k >= questions.length || !accessible(k)) return;
      courant = k;
      dessinerNavE();
      dessinerQuestionE();
      (zone.querySelector('[data-q-courante]') || zone).scrollIntoView({ block: 'start', behavior: 'smooth' });
    };

    // Garde les cases cochées (non validées) quand on change de question.
    const lireE = () => {
      const q = questions[courant];
      if (!q || repE(q).validee) return;
      const champ = zone.querySelector('[data-zone-q] [data-qroc]');
      reponses[q.id] = {
        ...repE(q),
        choix: [...zone.querySelectorAll('[data-zone-q] input[name=p]:checked')].map((x) => x.value),
        texte: champ ? champ.value : '',
      };
    };

    const validerE = () => {
      lireE();
      const q = questions[courant];
      if (!aRepondu(q) && !confirmerVide) {
        confirmerVide = true;
        zone.querySelector('[data-vide]').hidden = false;
        return;
      }
      reponses[q.id] = { ...repE(q), validee: true };
      sauver();
      const suivante = questions.findIndex((x, k) => k > courant && !repE(x).validee && accessible(k));
      if (suivante >= 0) allerA(suivante);
      else {
        dessinerNavE();
        dessinerQuestionE();
        if (questions.every((x) => repE(x).validee)) montrerResumeE();
      }
    };

    const montrerResumeE = () => {
      lireE();
      const resume = zone.querySelector('[data-resume]');
      const n = (f) => questions.filter(f).length;
      const etat = (q) => (repE(q).validee ? 'Validée' : aRepondu(q) ? 'Répondue (non validée)' : 'Sans réponse');
      resume.innerHTML = String(html`<div class="resume-boite carte pile" role="dialog" aria-modal="true" aria-labelledby="titre-resume">
        <h2 id="titre-resume" class="titre-section">Résumé de la tentative</h2>
        <p>${n((q) => repE(q).validee)} validée(s) · ${n((q) => !repE(q).validee && aRepondu(q))} répondue(s) sans validation · ${n((q) => !aRepondu(q))} sans réponse, sur ${questions.length}.</p>
        <div class="tableau-defile"><table class="tableau"><thead><tr><th>Question</th><th>Dossier</th><th>État</th></tr></thead>
          <tbody>${questions.map((q) => html`<tr class="${aRepondu(q) ? '' : 'sans-reponse'}"><td>${q.num}</td><td>${q.dossier.titre}</td><td>${etat(q)}</td></tr>`)}</tbody></table></div>
        <p class="aide">Les réponses non validées comptent telles quelles.</p>
        <div class="actions">
          <button class="btn contour" data-action="retour">Retour à la tentative</button>
          <button class="btn plein" data-action="envoyer">Terminer et voir ma correction</button>
        </div>
      </div>`);
      resume.hidden = false;
      resume.querySelector('[data-action=retour]').focus();
    };

    const accueil = () => {
      zone.innerHTML = String(html`<section class="carte pile">
        <h2 class="titre-seance">${s.titre}</h2>
        <p>${toutes.length} questions en ${qcm.length} dossier${qcm.length > 1 ? 's' : ''}.
          ${examen
            ? "Même écran que l'épreuve, sans limite de temps : chaque question validée avant de passer à la suite, correction complète à la fin."
            : 'Correction après chaque question, sans limite de temps.'}</p>
        ${reprise
          ? html`<p class="alerte">Tentative en cours gardée sur cet appareil : ${Object.keys(reprise.reponses || {}).length} question${Object.keys(reprise.reponses || {}).length > 1 ? 's' : ''} répondue${Object.keys(reprise.reponses || {}).length > 1 ? 's' : ''} sur ${reprise.ids.length}.</p>`
          : ''}
        <div class="actions">
          ${reprise ? html`<button class="btn plein" data-depart="reprendre">Reprendre où j'en étais</button>` : ''}
          <button class="btn ${reprise ? 'contour' : 'plein'}" data-depart="tout">Rejouer toute l'épreuve</button>
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
      quitterPassage();
      const { points: pts, total, note20: note } = noterCopie(questions, corrections, reponses);
      // Questions jouées regroupées par dossier (pour le sommaire).
      const dossiers = [];
      for (const q of questions) {
        const d = dossiers.find((x) => x.ref === q.dossier);
        if (d) d.questions.push(q);
        else dossiers.push({ ref: q.dossier, titre: q.dossier.titre, questions: [q] });
      }
      ecrireJson(cleTentative, null);
      const score = { seance: s.id, reponses, points: Math.round(pts * 100) / 100, total, le: Date.now() };
      try {
        await app.api.enregistrerEntrainement(score.seance, score.reponses, score.points, score.total);
      } catch (err) {
        if (/connexion|fetch|network/i.test(err.message) || !navigator.onLine) {
          ecrireJson(CLE_ATTENTE, [...lireJson(CLE_ATTENTE, []), score]);
          app.message("Pas de connexion : votre score est gardé sur cet appareil et sera enregistré dès le retour du réseau.");
        } else app.message('Score non enregistré : ' + err.message, 'erreur');
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
      ${sommaireCopie(dossiers, corrections, reponses, examen)}
      ${examen
        ? html`<section class="pile-petite"><h2 class="titre-section">Correction</h2>${dossiers.map(
            (d, n) => html`<div class="pile-petite dossier-corr" id="dossier-${n + 1}">${d.questions.map(
              (q) => html`<section class="passage-question"><p class="surtitre">${q.dossier.titre} · question ${q.qi + 1} sur ${q.dossier.questions.length}</p>
              ${questionCorrigee(q, q.num, corrections[q.id], reponses[q.id] || { question_id: q.id, choix: [], texte: '' }, true)}</section>`
            )}</div>`
          )}</section>`
        : ''}`);
      chargerImages(zone, app.api);
      questions = [];
      window.scrollTo(0, 0);
    };

    // Chaque case cochée ou réponse tapée est gardée sur l'appareil.
    el.addEventListener('change', () => {
      if (!questions.length) return;
      if (examen) lireE();
      else if (!verifiee) lire();
      sauver();
    });
    // QRP : pas plus de n cases.
    el.addEventListener('change', (e) => {
      const q = examen ? questions[courant] : questions[i];
      if (e.target.name === 'p' && q?.type === 'QRP' && e.target.checked && zone.querySelectorAll('input[name=p]:checked').length > (q.nb_reponses || 99)) {
        e.target.checked = false;
        app.message(`${q.nb_reponses} réponses attendues : décochez une case avant d'en cocher une autre.`, 'erreur');
      }
    });
    el.addEventListener('click', (e) => {
      if (e.target.matches('[data-resume]')) e.target.hidden = true;
      const b = e.target.closest('[data-depart],[data-action],[data-aller]');
      if (!b) return;
      if (b.dataset.depart) {
        if (b.dataset.depart === 'reprendre' && reprise) {
          questions = reprise.ids.map((id) => toutes.find((q) => q.id === id));
          reponses = reprise.reponses || {};
          i = Math.min(reprise.i || 0, questions.length - 1);
        } else {
          questions = b.dataset.depart === 'ratees' ? ratees : toutes;
          i = 0;
          reponses = {};
        }
        if (examen) demarrerPassage(b.dataset.depart === 'reprendre' ? reprise.courant || 0 : 0);
        else dessiner();
        sauver();
      } else if (b.dataset.aller !== undefined) {
        if (b.disabled) return;
        lireE();
        allerA(Number(b.dataset.aller));
        sauver();
      } else if (b.dataset.action === 'valider') validerE();
      else if (b.dataset.action === 'resume') montrerResumeE();
      else if (b.dataset.action === 'retour') zone.querySelector('[data-resume]').hidden = true;
      else if (b.dataset.action === 'envoyer') fin();
      else if (b.dataset.action === 'verifier' && !verifiee) verifier();
      else if (b.dataset.action === 'suivante') {
        sauver();
        if (++i < questions.length) dessiner();
        else fin();
      }
    });
    accueil();
  }

  return { html: vue, monter, titre: 'Entraînement' };
}
