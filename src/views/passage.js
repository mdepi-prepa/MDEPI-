// Passage d'une épreuve QCM, sur le modèle de Théia :
// - page d'informations (ouverture, fermeture, temps restant, consignes) ;
// - questions numérotées, dossier par dossier ; dans un dossier progressif,
//   chaque question doit être validée avant de voir la suivante, et une
//   question validée n'est plus modifiable (elle reste consultable) ;
// - chaque clic est enregistré ; sans réseau, les réponses attendent sur
//   l'appareil et partent dès le retour de la connexion ;
// - « Tout envoyer et terminer » avec résumé, envoi automatique à l'heure de fin.
import { html, brut } from '../lib/html.js';
import { icones } from '../lib/icones.js';
import { dateLongue, heure } from '../lib/dates.js';
import { estEquipe } from '../lib/acces.js';
import { aPlat, lettre, htmlQcm, chargerImages, LIBELLES_TYPES } from '../lib/qcm.js';
import { ancrerQuestion, enTete } from './commun.js';
import { bandeauNote, qcmCorrige } from './qcm-rendu.js';
import { fileEnvoi, erreurReseau } from '../lib/envoi.js';

// Réponses en attente d'envoi : une sauvegarde par épreuve et par compte.
const PREFIXE_COPIE = 'mdepi-copie-';
function fileCopie(app, seanceId) {
  return fileEnvoi(`${PREFIXE_COPIE}${seanceId}-${app.profil.id}`, (qid, r) => app.api.enregistrerReponse(seanceId, qid, r.choix, r.texte, r.valider));
}

// Nombre d'écrans d'épreuve affichés (0 ou 1, 2 un court instant quand l'écran
// se redessine) : le mode « épreuve » de la page ne s'enlève qu'au dernier.
let ecransOuverts = 0;
const modeEpreuve = () => document.body.classList.toggle('mode-epreuve', ecransOuverts > 0);

// À l'ouverture de l'app : les réponses restées sur l'appareil (réseau coupé,
// app fermée pendant une épreuve) repartent sans attendre que l'étudiant
// rouvre l'écran de l'épreuve.
export function reprendreEnvois(app) {
  if (!app.profil) return;
  const fin = `-${app.profil.id}`;
  const cles = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const cle = localStorage.key(i);
      if (cle?.startsWith(PREFIXE_COPIE) && cle.endsWith(fin)) cles.push(cle);
    }
  } catch {
    return; // stockage indisponible
  }
  for (const cle of cles) fileCopie(app, cle.slice(PREFIXE_COPIE.length, -fin.length)).envoyer();
}

export function chrono(ms) {
  if (ms <= 0) return '0:00';
  const t = Math.floor(ms / 1000);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return h ? `${h} h ${String(m).padStart(2, '0')} min` : `${m}:${String(s).padStart(2, '0')}`;
}

export async function vuePassage(app, { id }) {
  const s = await app.api.seance(id);
  if (!s || !s.epreuve) {
    return { html: html`<div class="page">${enTete('Épreuve introuvable', null, '#/epreuves')}<p>Cette épreuve n'existe pas ou ne concerne pas votre groupe.</p></div>` };
  }
  const lu = Date.now();
  const [infos, copie, decalage] = await Promise.all([app.api.infosQcm(id), app.api.maCopie(id), app.api.decalageHorloge()]);
  // Heure du serveur : c'est lui qui ouvre et ferme l'épreuve. Une horloge
  // d'appareil mal réglée ne doit ni couper l'épreuve trop tôt, ni laisser
  // croire qu'il reste du temps.
  const horloge = () => Date.now() + decalage;
  const ouverte = !s.annulee && Date.parse(s.debut) <= horloge() && horloge() < Date.parse(s.fin);

  if (copie && !copie.rendue_le && ouverte) return passage(app, s, copie, horloge, lu);
  return accueilEpreuve(app, s, infos, copie, ouverte, horloge);
}

// Pourquoi la note n'est pas (encore) affichée.
function messageAttente(s, infos) {
  if (new Date() < new Date(s.fin)) {
    if (infos.publication === 'jamais') return "Les résultats de cette épreuve ne seront pas affichés dans l'app.";
    if (infos.publication === 'date' && infos.publication_le) return `Votre note et votre rang seront publiés le ${dateLongue(infos.publication_le).toLowerCase()} à ${heure(infos.publication_le)}.`;
    return `Votre note et votre rang apparaîtront ici à la fin de l'épreuve, le ${dateLongue(s.fin).toLowerCase()} à ${heure(s.fin)}.`;
  }
  if (infos.publication === 'jamais') return "Les résultats de cette épreuve ne sont pas affichés dans l'app.";
  if (infos.publication === 'date' && infos.publication_le && new Date() < new Date(infos.publication_le))
    return `Votre note et votre rang seront publiés le ${dateLongue(infos.publication_le).toLowerCase()} à ${heure(infos.publication_le)}.`;
  if (infos.qroc_en_cours) return "Correction en cours : l'équipe vérifie les réponses aux QROC. Votre note et votre rang apparaîtront ici dès qu'elle aura fini.";
  return 'Votre note et votre rang apparaîtront ici dans quelques minutes, le temps que les dernières copies arrivent.';
}

// ---------- Page d'informations (avant, ou après l'épreuve) ----------
async function accueilEpreuve(app, s, infos, copie, ouverte, horloge) {
  const equipe = estEquipe(app.profil);
  const avant = horloge() < Date.parse(s.debut);
  const resultat = copie ? await app.api.monResultat(s.id).catch(() => null) : null;

  let etat;
  if (copie?.rendue_le) etat = html`<p class="alerte vert">Copie envoyée le ${dateLongue(copie.rendue_le).toLowerCase()} à ${heure(copie.rendue_le)}.</p>`;
  else if (copie) etat = html`<p class="alerte">Épreuve terminée : vos réponses enregistrées ont été prises en compte.</p>`;
  else if (s.annulee) etat = html`<p class="alerte rouge">Épreuve annulée.</p>`;
  else if (avant) etat = html`<p class="alerte">L'épreuve s'ouvrira le ${dateLongue(s.debut).toLowerCase()} à ${heure(s.debut)}.</p>`;
  else if (!ouverte) etat = html`<p class="alerte">Épreuve fermée.</p>`;

  const vue = html`<div class="page">
    ${enTete('Épreuve', null, `#/seance/${s.id}`)}
    <section class="carte pile">
      <h2 class="titre-seance">${s.titre}</h2>
      <dl class="infos-epreuve">
        <div><dt>Ouverture</dt><dd>${dateLongue(s.debut)} à ${heure(s.debut)}</dd></div>
        <div><dt>Fermeture</dt><dd>${dateLongue(s.fin)} à ${heure(s.fin)}</dd></div>
        <div><dt>Durée</dt><dd>${chrono(new Date(s.fin) - new Date(s.debut))}</dd></div>
        <div><dt>Questions</dt><dd>${infos.questions} question${infos.questions > 1 ? 's' : ''}${infos.dossiers ? ` · ${infos.dossiers} dossier${infos.dossiers > 1 ? 's' : ''}` : ''}</dd></div>
        ${ouverte && !copie?.rendue_le ? html`<div><dt>Temps restant</dt><dd data-restant>${chrono(Date.parse(s.fin) - horloge())}</dd></div>` : ''}
      </dl>
      ${etat || ''}
      ${!copie && ouverte && !equipe
        ? html`<ul class="consignes">
            <li>Vos réponses sont enregistrées à chaque clic. Si la connexion coupe, elles restent sur votre appareil et partent dès son retour.</li>
            <li>Dans un dossier progressif, validez chaque question pour voir la suivante. Une question validée n'est plus modifiable.</li>
            <li>À l'heure de fin, vos réponses sont envoyées automatiquement.</li>
          </ul>
          <button class="btn plein grand" data-action="commencer">Commencer l'épreuve</button>`
        : ''}
      ${equipe ? html`<p class="aide">Vous êtes dans l'équipe : l'épreuve se gère depuis le back-office.</p><a class="btn contour" href="#/admin/epreuves/${s.id}/qcm">QCM et résultats</a>` : ''}
      <p class="erreur" role="alert" hidden></p>
    </section>
    ${copie
      ? resultat
        ? html`<section class="carte pile">
            <h2 class="titre-section">Mon résultat</h2>
            ${bandeauNote(resultat)}
            ${resultat.groupes_restants
              ? html`<p class="alerte">Classement provisoire : ${resultat.groupes_restants === 1 ? 'un autre groupe doit encore' : `${resultat.groupes_restants} autres groupes doivent encore`} passer cette épreuve. Leurs notes s'ajouteront au classement.</p>`
              : html`<p class="aide">Classement définitif : tous les groupes ont passé l'épreuve.</p>`}
            ${infos.correction_visible
              ? html`<a class="btn plein" href="#/epreuve/${s.id}/correction">Voir ma copie corrigée</a>`
              : html`<p class="aide">La copie corrigée n'est pas encore disponible.</p>`}
          </section>`
        : html`<section class="carte pile">
            <p class="aide">${messageAttente(s, infos)}</p>
            ${infos.correction_visible ? html`<a class="btn plein" href="#/epreuve/${s.id}/correction">Voir ma copie corrigée</a>` : ''}
          </section>`
      : ''}
    ${infos.correction_visible && !ouverte && !avant && !equipe
      ? html`<a class="btn contour" href="#/entrainement/${s.id}">Rejouer cette épreuve en entraînement</a>`
      : ''}
  </div>`;

  function monter(el) {
    // Page ouverte en avance : à l'heure d'ouverture, elle se met à jour toute
    // seule et le bouton « Commencer » apparaît.
    const dans = Date.parse(s.debut) - horloge();
    if (avant && !s.annulee && dans < 12 * 3600000) setTimeout(() => document.body.contains(el) && app.rafraichir(), dans + 1000);
    el.querySelector('[data-action=commencer]')?.addEventListener('click', async (e) => {
      e.target.disabled = true;
      try {
        await app.api.commencerEpreuve(s.id);
        app.rafraichir();
      } catch (err) {
        const p = el.querySelector('.erreur');
        p.textContent = err.message;
        p.hidden = false;
        e.target.disabled = false;
      }
    });
  }
  return { html: vue, monter, titre: s.titre };
}

// ---------- Passage ----------
async function passage(app, s, copie, horloge, lu) {
  const qcm = await app.api.qcm(s.id);
  const questions = aPlat(qcm);
  const fin = Date.parse(s.fin);
  const file = fileCopie(app, s.id);
  file.rouvrir();

  // Réponses : celles du serveur, puis celles arrivées chez lui pendant qu'on
  // lisait la copie, puis celles qui attendent encore sur l'appareil.
  const reponses = structuredClone(copie.reponses || {});
  for (const [qid, r] of Object.entries(file.envoyeesDepuis(lu))) {
    reponses[qid] = { ...reponses[qid], choix: r.choix, texte: r.texte, validee: !!r.valider || !!reponses[qid]?.validee };
  }
  for (const [qid, r] of Object.entries(file.enAttente())) {
    if (reponses[qid]?.validee) file.oublier(qid);
    else reponses[qid] = { ...reponses[qid], choix: r.choix, texte: r.texte, validee: !!r.valider };
  }

  const rep = (q) => reponses[q.id] || { choix: [], texte: '', validee: false };
  const aRepondu = (q) => (q.type === 'QROC' ? !!rep(q).texte?.trim() : rep(q).choix?.length > 0);
  // Question accessible : première du dossier, ou la précédente du dossier est validée.
  const accessible = (q) => q.qi === 0 || rep(q.dossier.questions[q.qi - 1]).validee;
  let courant = Math.max(0, questions.findIndex((q) => accessible(q) && !rep(q).validee));
  if (!questions.length) courant = -1;

  const vue = html`<div class="passage">
    <header class="passage-haut">
      <a class="btn-icone" href="#/epreuves" aria-label="Quitter (vos réponses sont gardées)">${icones.retour(20)}</a>
      <div class="pile-mini passage-titre"><strong>${s.titre}</strong><span class="aide" data-statut>Réponses enregistrées</span></div>
      <a class="btn-icone" href="#/" aria-label="Revenir à l'accueil (vos réponses sont gardées)" title="Revenir à l'accueil">${icones.accueil(20)}</a>
      <div class="chrono" data-chrono title="Temps restant">${chrono(fin - horloge())}</div>
    </header>
    <div class="passage-corps">
      <nav class="passage-nav" aria-label="Questions" data-nav></nav>
      <section class="passage-question" data-question aria-live="polite"></section>
    </div>
    <div class="resume" data-resume hidden></div>
  </div>`;

  function monter(el) {
    ecransOuverts++;
    modeEpreuve();
    const statut = el.querySelector('[data-statut]');
    const zoneQ = el.querySelector('[data-question]');
    const zoneNav = el.querySelector('[data-nav]');
    const resume = el.querySelector('[data-resume]');
    let actif = true; // cet écran est affiché
    let fini = false; // copie envoyée, ou épreuve fermée par le serveur
    let tempsEcoule = false;
    let confirmerVide = false;

    // --- Enregistrement (voir lib/envoi.js) ---
    const afficherStatut = (texte, classe = '') => {
      statut.textContent = texte;
      statut.className = 'aide ' + classe;
    };
    const desabonner = file.ecouter({
      statut(etat) {
        if (etat === 'envoi') afficherStatut('Enregistrement…');
        else if (etat === 'ok') afficherStatut(`Réponses enregistrées · ${heure(new Date().toISOString())}`, 'ok');
        else afficherStatut('Hors ligne : vos réponses sont gardées sur cet appareil', 'attention');
      },
      refus(message, qid) {
        if (/déjà validée/i.test(message)) {
          // Validée ici aussi : la même validation est partie deux fois, rien à dire.
          if (reponses[qid]?.validee) return;
          // Validée ailleurs (autre appareil) : on reprend l'état du serveur.
          app.message(message, 'erreur');
          if (actif) app.rafraichir();
          return;
        }
        app.message(message, 'erreur');
      },
      // Épreuve fermée ou copie déjà rendue : le serveur n'accepte plus rien.
      fermee(message) {
        conclure(message, 'erreur');
      },
    });
    function noter(q, valider = false) {
      if (fini) return;
      const r = rep(q);
      reponses[q.id] = { ...r, validee: r.validee || valider };
      file.noter(q.id, { choix: r.choix || [], texte: r.texte || '', valider: reponses[q.id].validee });
    }
    // Texte d'une QROC en cours de frappe : noté 0,6 s après la dernière
    // touche, ou tout de suite s'il faut partir (fin du temps, autre écran).
    let minuterie = null;
    let saisie = null;
    function noterSaisie() {
      clearTimeout(minuterie);
      if (!saisie) return;
      const q = saisie;
      saisie = null;
      noter(q);
    }
    // Question d'un dossier progressif pas encore reçue : la base ne l'envoie
    // qu'une fois la précédente validée chez elle, donc on envoie d'abord.
    async function charger(q) {
      if (!q.verrouillee) return true;
      if (!(await file.toutEnvoyer())) return false;
      // La validation vient d'arriver en base : on réessaie un peu avant
      // d'annoncer un problème de réseau.
      let c = null;
      for (let essai = 0; essai < 4 && !c; essai++) {
        if (essai) await new Promise((ok) => setTimeout(ok, 400 * essai));
        c = await app.api.question(s.id, q.id).catch(() => null);
      }
      if (!c) return false;
      Object.assign(q, c, { verrouillee: false });
      return true;
    }

    // --- Affichage ---
    function dessinerNav() {
      zoneNav.innerHTML = String(html`${qcm.map(
        (d, di) => html`<div class="nav-dossier">
          <span class="nav-dossier-titre">${d.titre}</span>
          <div class="nav-numeros">${questions
            .filter((q) => q.di === di)
            .map((q) => {
              const cls = [rep(q).validee ? 'validee' : aRepondu(q) ? 'repondue' : '', q.num - 1 === courant ? 'courante' : '', accessible(q) ? '' : 'verrouillee'].join(' ');
              return html`<button class="num ${cls}" data-aller="${q.num - 1}" ${accessible(q) && !tempsEcoule ? '' : 'disabled'}
                aria-label="Question ${q.num}${rep(q).validee ? ', validée' : aRepondu(q) ? ', répondue' : ''}">${q.num}</button>`;
            })}</div>
        </div>`
      )}
      <button class="btn contour terminer" data-action="resume" ${tempsEcoule ? 'disabled' : ''}>Tout envoyer et terminer</button>`);
    }

    function dessinerQuestion() {
      confirmerVide = false;
      if (courant < 0) {
        zoneQ.innerHTML = '<p class="aide">Aucune question dans cette épreuve.</p>';
        return;
      }
      const q = questions[courant];
      const r = rep(q);
      const fige = r.validee;
      const type = q.type === 'QRU' ? 'radio' : 'checkbox';
      const suivante = questions[courant + 1];
      // Questions précédentes du dossier, en lecture seule : on remonte en
      // défilant pour les relire (la question en cours est en dessous).
      const avant = questions.filter((x) => x.di === q.di && x.qi < q.qi && !x.verrouillee);
      zoneQ.innerHTML = String(html`
        ${avant.length
          ? html`<div class="q-precedentes">${avant.map((x) => {
              const rx = rep(x);
              return html`<article class="q-precedente">
                <header class="q-bandeau"><span>Question ${x.num}</span><span>${rx.validee ? 'Validée' : LIBELLES_TYPES[x.type]}</span></header>
                <div class="q-enonce">${brut(htmlQcm(x.enonce))}</div>
                ${x.type === 'QROC'
                  ? html`<p class="q-reponse-qroc"><span class="aide">Votre réponse : </span>${rx.texte || '(sans réponse)'}</p>`
                  : html`<fieldset class="propositions" disabled><legend class="sr">Propositions</legend>${x.propositions.map(
                      (p, i) => html`<label class="prop">
                        <input type="${x.type === 'QRU' ? 'radio' : 'checkbox'}" ${(rx.choix || []).includes(p.id) ? 'checked' : ''}>
                        <span class="lettre">${lettre(i)}</span><span class="prop-texte">${brut(htmlQcm(p.texte))}</span>
                      </label>`
                    )}</fieldset>`}
              </article>`;
            })}</div>`
          : ''}
        <p class="surtitre" data-q-courante>${q.dossier.titre} · question ${q.qi + 1} sur ${q.dossier.questions.length}</p>
        ${q.qi > 0 && avant.length < q.qi
          ? html`<details class="rappel"><summary>Relire l'énoncé du dossier</summary><div class="q-enonce">${brut(htmlQcm(q.dossier.questions[0].enonce))}</div></details>`
          : ''}
        <header class="q-bandeau"><span>Question ${q.num}</span><span>${LIBELLES_TYPES[q.type]}</span></header>
        <div class="q-enonce">${brut(htmlQcm(q.enonce))}</div>
        ${q.type === 'QRP' ? html`<p class="alerte" data-qrp>${q.nb_reponses} réponse${q.nb_reponses > 1 ? 's' : ''} attendue${q.nb_reponses > 1 ? 's' : ''} : vous ne pouvez pas cocher plus de ${q.nb_reponses} case${q.nb_reponses > 1 ? 's' : ''}.</p>` : ''}
        ${q.type === 'QROC'
          ? html`<label class="champ"><span>Votre réponse</span><input class="qroc" data-qroc maxlength="500" autocomplete="off" value="${r.texte || ''}" ${fige ? 'disabled' : ''}></label>`
          : html`<fieldset class="propositions" ${fige ? 'disabled' : ''}><legend class="sr">Propositions</legend>${q.propositions.map(
              (p, i) => html`<label class="prop">
                <input type="${type}" name="p" value="${p.id}" ${(r.choix || []).includes(p.id) ? 'checked' : ''}>
                <span class="lettre">${lettre(i)}</span><span class="prop-texte">${brut(htmlQcm(p.texte))}</span>
              </label>`
            )}</fieldset>`}
        ${fige ? html`<p class="alerte vert">Question validée : votre réponse est enregistrée et n'est plus modifiable.</p>` : ''}
        <p class="alerte attention" data-vide hidden>Vous n'avez rien répondu. Cliquez à nouveau pour valider sans réponse.</p>
        <div class="actions passage-actions">
          <button class="btn contour" data-aller="${courant - 1}" ${courant > 0 && accessible(questions[courant - 1]) ? '' : 'disabled'}>Précédente</button>
          ${fige
            ? suivante
              ? html`<button class="btn plein" data-aller="${courant + 1}" ${accessible(suivante) ? '' : 'disabled'}>Suivante</button>`
              : html`<button class="btn plein" data-action="resume">Terminer</button>`
            : html`<button class="btn plein" data-action="valider">${suivante && suivante.di === q.di ? 'Valider et passer à la suite' : 'Valider la question'}</button>`}
        </div>`);
      chargerImages(zoneQ, app.api);
      // QROC : prêt à taper, curseur à la fin de ce qui est déjà écrit.
      const champ = zoneQ.querySelector('[data-qroc]:not([disabled])');
      if (champ) {
        champ.focus({ preventScroll: true });
        champ.setSelectionRange(champ.value.length, champ.value.length);
      }
    }

    // discret : nouvel essai automatique, sans réafficher « Chargement ».
    let attenteQuestion = null;
    async function aller(i, discret = false) {
      if (!actif || tempsEcoule || i < 0 || i >= questions.length || !accessible(questions[i])) return;
      noterSaisie();
      clearTimeout(attenteQuestion);
      courant = i;
      dessinerNav();
      if (questions[i].verrouillee) {
        if (!discret) zoneQ.innerHTML = '<p class="aide">Chargement de la question…</p>';
        const ok = await charger(questions[i]);
        if (!actif || tempsEcoule || courant !== i) return;
        if (!ok) {
          zoneQ.innerHTML = String(html`<p class="alerte attention">La question suivante s'affichera dès le retour du réseau. Vos réponses sont gardées sur cet appareil.</p>`);
          // Nouvel essai toutes les 5 secondes, et dès le retour du réseau.
          clearTimeout(attenteQuestion);
          attenteQuestion = setTimeout(() => courant === i && aller(i, true), 5000);
          return;
        }
      }
      dessinerQuestion();
      // On amène la question elle-même en haut de l'écran (sur téléphone, le
      // sommaire est au-dessus : il ne faut pas y remonter).
      ancrerQuestion(zoneQ);
    }
    const auRetourDuReseau = () => questions[courant]?.verrouillee && aller(courant, true);
    window.addEventListener('online', auRetourDuReseau);

    // --- Résumé et envoi final ---
    function montrerResume() {
      noterSaisie();
      const n = (f) => questions.filter(f).length;
      const etat = (q) => (rep(q).validee ? 'Validée' : aRepondu(q) ? 'Réponse enregistrée (non validée)' : 'Sans réponse');
      resume.innerHTML = String(html`<div class="resume-boite carte pile" role="dialog" aria-modal="true" aria-labelledby="titre-resume">
        <h2 id="titre-resume" class="titre-section">Résumé de la tentative</h2>
        <p>${n((q) => rep(q).validee)} validée(s) · ${n((q) => !rep(q).validee && aRepondu(q))} répondue(s) sans validation · ${n((q) => !aRepondu(q))} sans réponse, sur ${questions.length}.</p>
        <div class="tableau-defile"><table class="tableau"><thead><tr><th>Question</th><th>Dossier</th><th>État</th></tr></thead>
          <tbody>${questions.map((q) => html`<tr class="${aRepondu(q) ? '' : 'sans-reponse'}"><td>${q.num}</td><td>${q.dossier.titre}</td><td>${etat(q)}</td></tr>`)}</tbody></table></div>
        <p class="aide">Les réponses non validées comptent telles quelles. Une fois envoyée, la copie n'est plus modifiable.</p>
        <p class="erreur" role="alert" hidden></p>
        <div class="actions">
          <button class="btn contour" data-action="retour">Retour à la tentative</button>
          <button class="btn plein" data-action="envoyer">Tout envoyer et terminer</button>
        </div>
      </div>`);
      resume.hidden = false;
      resume.querySelector('[data-action=retour]').focus();
    }

    // Fin de l'épreuve sur cet appareil : plus rien à envoyer, retour à la page d'informations.
    function conclure(texte, type) {
      if (fini) return;
      fini = true;
      file.fermer();
      const affiche = document.body.contains(el);
      nettoyer();
      app.message(texte, type);
      if (affiche) app.rafraichir();
    }

    let finEnCours = false;
    let reessai = null;
    let essais = 0;
    async function terminer(auto = false) {
      if (fini || finEnCours) return;
      finEnCours = true;
      clearTimeout(reessai);
      try {
        noterSaisie();
        // D'abord les dernières réponses, puis la remise de la copie.
        if (!(await file.toutEnvoyer())) throw new Error('Pas de connexion internet.');
        if (fini) return; // fermée par le serveur pendant l'envoi
        await app.api.rendreCopie(s.id);
        conclure(auto ? 'Temps écoulé : votre copie a été envoyée.' : 'Copie envoyée.');
      } catch (err) {
        if (fini) return;
        const horsLigne = erreurReseau(err) || (typeof navigator !== 'undefined' && navigator.onLine === false);
        const raison = horsLigne ? ' : pas de connexion' : '';
        if (auto || tempsEcoule) {
          // Pas de message à répétition : l'écran explique, et l'app réessaie seule.
          zoneQ.innerHTML = String(html`<p class="alerte attention">Temps écoulé. Envoi impossible pour l'instant${raison}. Vos réponses sont gardées sur cet appareil et l'app réessaie toute seule : laissez cette page ouverte.</p>`);
          if (actif) reessai = setTimeout(() => terminer(true), essais++ < 24 ? 5000 : 30000);
        } else {
          const texte = `Envoi impossible pour l'instant${raison}. Vos réponses sont gardées sur cet appareil ; réessayez dans un instant.`;
          const p = resume.querySelector('.erreur');
          if (p && !resume.hidden) {
            p.textContent = texte;
            p.hidden = false;
          } else app.message(texte, 'erreur');
        }
      } finally {
        finEnCours = false;
      }
    }

    // --- Événements ---
    el.addEventListener('change', (e) => {
      if (e.target.name !== 'p' || tempsEcoule) return;
      const q = questions[courant];
      // QRP : pas plus de n cases.
      if (q.type === 'QRP' && e.target.checked && zoneQ.querySelectorAll('input[name=p]:checked').length > (q.nb_reponses || 99)) {
        e.target.checked = false;
        app.message(`${q.nb_reponses} réponses attendues : décochez une case avant d'en cocher une autre.`, 'erreur');
        return;
      }
      reponses[q.id] = { ...rep(q), choix: [...zoneQ.querySelectorAll('input[name=p]:checked')].map((i) => i.value) };
      zoneQ.querySelector('[data-vide]').hidden = true;
      confirmerVide = false;
      noter(q);
      dessinerNav();
    });
    el.addEventListener('input', (e) => {
      if (!e.target.matches('[data-qroc]') || tempsEcoule) return;
      const q = questions[courant];
      reponses[q.id] = { ...rep(q), texte: e.target.value };
      saisie = q;
      clearTimeout(minuterie);
      minuterie = setTimeout(() => {
        noterSaisie();
        if (actif) dessinerNav();
      }, 600);
    });
    el.addEventListener('click', (e) => {
      const cible = e.target.closest('[data-aller],[data-action]');
      if (!cible || cible.disabled) return;
      if (cible.dataset.aller !== undefined) return aller(Number(cible.dataset.aller));
      const action = cible.dataset.action;
      if (action === 'valider' && !tempsEcoule) {
        const q = questions[courant];
        const champ = zoneQ.querySelector('[data-qroc]');
        if (champ) reponses[q.id] = { ...rep(q), texte: champ.value };
        if (!aRepondu(q) && !confirmerVide) {
          confirmerVide = true;
          zoneQ.querySelector('[data-vide]').hidden = false;
          return;
        }
        clearTimeout(minuterie);
        saisie = null;
        noter(q, true);
        const suivante = questions.findIndex((x, i) => i > courant && !rep(x).validee && accessible(x));
        if (suivante >= 0) aller(suivante);
        else {
          dessinerNav();
          dessinerQuestion();
          if (questions.every((x) => rep(x).validee)) montrerResume();
        }
      }
      if (action === 'resume') montrerResume();
      if (action === 'retour') resume.hidden = true;
      if (action === 'envoyer') {
        cible.disabled = true;
        terminer().finally(() => (cible.disabled = false));
      }
    });
    resume.addEventListener('click', (e) => e.target === resume && (resume.hidden = true));

    // --- Chronomètre ---
    const elChrono = el.querySelector('[data-chrono]');
    const tic = setInterval(() => {
      if (!document.body.contains(el)) return nettoyer();
      const reste = fin - horloge();
      elChrono.textContent = chrono(reste);
      elChrono.classList.toggle('urgent', reste < 5 * 60000);
      if (reste <= 0 && !tempsEcoule) {
        // Heure de fin : on garde ce qui est en cours de frappe, on fige
        // l'écran et la copie part toute seule (une seule fois).
        noterSaisie();
        tempsEcoule = true;
        resume.hidden = true;
        dessinerNav();
        zoneQ.innerHTML = '<p class="alerte">Temps écoulé : envoi de votre copie…</p>';
        terminer(true);
      }
    }, 1000);
    // L'étudiant quitte l'écran : les réponses déjà notées continuent de
    // partir (la file d'envoi vit en dehors de l'écran).
    function nettoyer() {
      if (!actif) return;
      noterSaisie();
      actif = false;
      clearInterval(tic);
      clearTimeout(reessai);
      clearTimeout(attenteQuestion);
      desabonner();
      window.removeEventListener('online', auRetourDuReseau);
      window.removeEventListener('hashchange', nettoyer);
      ecransOuverts--;
      modeEpreuve();
    }
    window.addEventListener('hashchange', nettoyer);

    if (courant >= 0) aller(courant);
    else {
      dessinerNav();
      dessinerQuestion();
    }
    if (!file.vide()) file.envoyer();
  }

  return { html: vue, monter, titre: s.titre };
}

// Copie corrigée de l'étudiant.
export async function vueMaCorrection(app, { id }) {
  const s = await app.api.seance(id);
  const [qcm, corrections, copie, resultat, infos] = await Promise.all([app.api.qcm(id), app.api.corrections(id), app.api.maCopie(id), app.api.monResultat(id), app.api.infosQcm(id)]);
  if (!s || !copie || !infos.correction_visible) {
    return { html: html`<div class="page">${enTete('Correction', null, `#/epreuve/${id}`)}<p>La copie corrigée n'est pas encore disponible.</p></div>` };
  }
  const vue = html`<div class="page">
    ${enTete('Ma copie corrigée', null, `#/epreuve/${id}`)}
    <section class="carte pile">
      <h2 class="titre-seance">${s.titre}</h2>
      <p class="aide">${dateLongue(s.debut)} · copie ${copie?.rendue_le ? `envoyée à ${heure(copie.rendue_le)}` : 'non envoyée'}</p>
      ${resultat ? bandeauNote(resultat) : html`<p class="aide">${messageAttente(s, infos)}</p>`}
      <button class="btn contour no-print" onclick="window.print()">${icones.fichier(16)} Imprimer ou enregistrer en PDF</button>
    </section>
    <div class="legende"><span class="v-juste">Juste</span><span class="v-fausse">Fausse (cochée à tort)</span><span class="v-oubliee">Oubliée</span></div>
    ${qcmCorrige(qcm, corrections, copie?.reponses || {})}
  </div>`;
  return { html: vue, monter: (el) => chargerImages(el, app.api), titre: 'Ma correction' };
}
