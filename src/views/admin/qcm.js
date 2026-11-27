// Back-office : QCM d'une épreuve (import Théia, sujet corrigé, publication),
// résultats (notes, rangs, réussite par question) et sauvegardes (CSV, JSON, PDF).
import { html } from '../../lib/html.js';
import { dateCourte, dateLongue, plageHoraire, heure } from '../../lib/dates.js';
import { formatNote, points } from '../../lib/bareme.js';
import { parsePackage, lireFichiers, versDossiers } from '../../lib/qti.js';
import { aPlat, chargerImages, csvResultats, csvCopies, telecharger, questionCourte, qrocACorriger } from '../../lib/qcm.js';
import { corrigerQroc, cle } from '../../lib/qroc.js';
import { enteteAdmin } from './index.js';
import { qcmCorrige, bandeauNote } from '../qcm-rendu.js';
import { vide } from '../commun.js';

const nomFichier = (s, suffixe) => `${s.titre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '')}-${suffixe}`;

async function chargerSerie(app, id) {
  const s = await app.api.seance(id);
  if (!s) return {};
  const [serie, groupes] = await Promise.all([app.api.seancesSerie(id), app.api.groupes()]);
  const nomG = (x) => x.groupes.map((g) => groupes.find((y) => y.id === g)?.nom).filter(Boolean).join(', ') || 'Toute la promo';
  return { s, serie, nomG };
}

// ---------- QCM de l'épreuve ----------
export async function vueAdminQcm(app, { id }) {
  const { s, serie, nomG } = await chargerSerie(app, id);
  if (!s) return { html: html`<div class="page">${enteteAdmin('Épreuve introuvable', '#/admin/epreuves')}</div>` };
  const qcm = await app.api.qcm(id);
  const nbQ = qcm.reduce((n, d) => n + d.questions.length, 0);
  const restants = serie.filter((x) => !x.annulee && new Date(x.fin) > new Date()).length;
  const aCorriger = nbQ && qcm.some((d) => d.questions.some((q) => q.type === 'QROC'))
    ? qrocACorriger(aPlat(qcm), await app.api.corrections(id), await app.api.copiesEpreuve(id))
    : 0;
  const publication = s.publication || 'cloture';
  const versLocal = (d) => (d ? new Date(new Date(d).getTime() - new Date(d).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');
  let importe = null; // { dossiers, images, msgs }

  const vue = html`<div class="page">
    ${enteteAdmin('QCM de l’épreuve', `#/admin/seances/${id}`)}
    <section class="carte pile">
      <h2 class="titre-seance">${s.titre}</h2>
      <p class="aide">Même QCM et même classement pour :</p>
      <ul class="liste-simple">${serie.map((x) => html`<li><strong>${nomG(x)}</strong> · ${dateCourte(x.debut)}, ${plageHoraire(x.debut, x.fin)}${x.id === id ? ' (cette épreuve)' : ''}</li>`)}</ul>
      <p>${nbQ ? html`<strong>${nbQ} question${nbQ > 1 ? 's' : ''}</strong> en ${qcm.length} dossier${qcm.length > 1 ? 's' : ''} : ${qcm.map((d) => d.titre).join(', ')}.` : 'Aucun QCM importé : l’épreuve se passe alors sur papier.'}</p>
      ${nbQ
        ? html`<div class="actions">
            <a class="btn plein" href="#/admin/epreuves/${id}/resultats">Résultats et copies</a>
            ${qcm.some((d) => d.questions.some((q) => q.type === 'QROC')) ? html`<a class="btn contour" href="#/admin/epreuves/${id}/qroc">Corriger les QROC${aCorriger ? ` (${aCorriger} à corriger)` : ''}</a>` : ''}
            <a class="btn contour" href="#/admin/epreuves/${id}/corrige">Sujet corrigé (aperçu, PDF)</a>
            ${restants ? html`<button class="btn contour" data-action="publier">${s.correction_publiee ? 'Masquer la copie corrigée' : 'Publier la copie corrigée dès maintenant'}</button>` : ''}
          </div>
          ${aCorriger ? html`<p class="alerte attention">${aCorriger} réponse${aCorriger > 1 ? 's' : ''} de QROC à corriger : tant qu'il en reste, les étudiants ne voient ni leur note ni leur rang.</p>` : ''}
          <p class="aide">Une fois les résultats publiés (voir ci-dessous), chaque étudiant voit sa note, la moyenne, son rang et sa copie corrigée ; les groupes suivants s'ajoutent au classement.
            ${restants
              ? s.correction_publiee
                ? 'Copie corrigée publiée en avance : attention, les groupes qui n’ont pas encore composé peuvent la voir.'
                : `Chaque groupe voit sa copie corrigée et peut rejouer l'épreuve en entraînement dès la fin de sa propre épreuve (${restants} groupe${restants > 1 ? 's' : ''} ${restants > 1 ? "n'ont" : "n'a"} pas encore fini).`
              : publication === 'cloture' ? 'Tous les groupes ont fini : copie corrigée visible, épreuve disponible en entraînement.' : 'Tous les groupes ont fini.'}</p>`
        : ''}
    </section>

    ${nbQ
      ? html`<section class="carte pile">
          <h2 class="titre-section">Publication des résultats</h2>
          <p class="aide">Comme dans Théia : quand les étudiants voient-ils leur note, leur rang et leur copie corrigée ? Le réglage vaut pour tous les groupes de l'épreuve. Les QROC doivent aussi être corrigées.</p>
          <form class="pile-mini" data-publication>
            <label class="radio"><input type="radio" name="publication" value="cloture" ${publication === 'cloture' ? 'checked' : ''}> Dès la fin de l'épreuve de chaque groupe</label>
            <label class="radio"><input type="radio" name="publication" value="date" ${publication === 'date' ? 'checked' : ''}> À partir d'une date
              <input type="datetime-local" name="publication_le" value="${versLocal(s.publication_le)}" aria-label="Date de publication"></label>
            <label class="radio"><input type="radio" name="publication" value="jamais" ${publication === 'jamais' ? 'checked' : ''}> Ne pas afficher dans l'app</label>
            <div class="actions"><button class="btn contour">Enregistrer</button></div>
            ${publication === 'date' && s.publication_le ? html`<p class="aide">Publication prévue le ${dateLongue(s.publication_le).toLowerCase()} à ${heure(s.publication_le)}.</p>` : ''}
          </form>
        </section>`
      : ''}

    <section class="carte pile">
      <h2 class="titre-section">Saisir les questions à la main</h2>
      <p class="aide">Créez les DP, KFP et questions isolées, puis chaque question (QRU, QRM, QRP, QROC) avec sa correction. Chaque question est enregistrée une à une : vous pouvez reprendre plus tard. Sert aussi à corriger une question importée.</p>
      <div class="actions"><a class="btn ${nbQ ? 'contour' : 'plein'}" href="#/admin/epreuves/${id}/saisie">${nbQ ? 'Modifier ou compléter les questions' : 'Saisir le QCM à la main'}</a></div>
    </section>

    <section class="carte pile">
      <h2 class="titre-section">${nbQ ? 'Remplacer le QCM' : 'Importer le QCM depuis Théia'}</h2>
      <p class="aide">Dans Théia, exportez les dossiers au format QTI 2.1, puis déposez ici le fichier ZIP (ou les fichiers XML). Les DP et KFP gardent leur ordre, les cases attendues, les QROC et les commentaires de correction.
        Le remplacement n'est plus possible dès qu'un étudiant a commencé.</p>
      <label class="champ"><span>Export Théia (ZIP ou XML)</span><input type="file" data-fichiers accept=".zip,.xml,.qti,application/zip,text/xml" multiple></label>
      <div data-rapport></div>
    </section>

    ${nbQ ? html`<button class="btn lien rouge" data-action="supprimer">Supprimer le QCM de l’épreuve</button>` : ''}
  </div>`;

  function monter(el) {
    const rapport = el.querySelector('[data-rapport]');
    el.querySelector('[data-fichiers]').addEventListener('change', async (e) => {
      const liste = [...e.target.files];
      if (!liste.length) return;
      rapport.innerHTML = '<p class="aide">Lecture…</p>';
      try {
        const fichiers = await lireFichiers(liste);
        const res = await parsePackage(fichiers);
        const dossiers = versDossiers(res.questions);
        importe = { dossiers, images: res.images };
        const n = dossiers.reduce((a, d) => a + d.questions.length, 0);
        // Promo lue dans le titre Théia (« CONF HGE D3 … ») différente de celle de l'épreuve.
        const autrePromo = dossiers.filter((d) => d.promo && !s.promos.includes(d.promo));
        if (autrePromo.length)
          res.msgs.unshift({ k: 'w', m: `Attention : ${autrePromo.map((d) => `« ${d.titre} » (${d.promo})`).join(', ')} ne correspond pas à la promo de l’épreuve (${s.promos.join(', ')}). Vérifiez que c'est le bon export.` });
        rapport.innerHTML = String(html`
          <ul class="rapport">${res.msgs.map((m) => html`<li class="r-${m.k}">${m.m}</li>`)}</ul>
          ${n
            ? html`<div class="tableau-defile"><table class="tableau"><thead><tr><th>Dossier</th><th>Questions</th><th>Types</th></tr></thead>
                <tbody>${dossiers.map((d) => html`<tr><td>${d.titre}</td><td>${d.questions.length}</td><td>${[...new Set(d.questions.map((q) => q.type))].join(', ')}</td></tr>`)}</tbody></table></div>
              <button class="btn plein" data-action="enregistrer">Enregistrer ces ${n} questions pour l'épreuve</button>`
            : html`<p class="erreur">Aucune question importable dans ces fichiers.</p>`}`);
      } catch (err) {
        rapport.innerHTML = String(html`<p class="erreur">Lecture impossible : ${err.message}</p>`);
      }
    });

    el.querySelector('[data-publication]')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const d = new FormData(e.target);
      const choix = d.get('publication');
      const date = d.get('publication_le');
      if (choix === 'date' && !date) return app.message('Indiquez la date de publication.', 'erreur');
      try {
        await app.api.choisirPublication(id, choix, choix === 'date' ? new Date(date).toISOString() : null);
        app.message('Publication des résultats enregistrée.');
        app.rafraichir();
      } catch (err) {
        app.message(err.message, 'erreur');
      }
    });

    el.addEventListener('click', async (e) => {
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (!action) return;
      try {
        if (action === 'enregistrer' && importe) {
          if (nbQ && !confirm('Remplacer le QCM actuel de l’épreuve (tous les groupes de la série) ?')) return;
          e.target.disabled = true;
          e.target.textContent = 'Enregistrement…';
          await app.api.importerQcm(id, importe.dossiers, importe.images);
          app.message('QCM enregistré.');
          app.rafraichir();
        }
        if (action === 'publier') {
          await app.api.publierCorrection(id, !s.correction_publiee);
          app.message(s.correction_publiee ? 'Copie corrigée masquée.' : 'Copie corrigée publiée.');
          app.rafraichir();
        }
        if (action === 'supprimer' && confirm('Supprimer le QCM de cette épreuve (tous les groupes de la série) ?')) {
          await app.api.supprimerQcm(id);
          app.rafraichir();
        }
      } catch (err) {
        app.message(err.message, 'erreur');
        e.target.disabled = false;
      }
    });
  }
  return { html: vue, monter, titre: 'QCM' };
}

// ---------- Sujet corrigé (sans copie) ----------
export async function vueAdminCorrige(app, { id }) {
  const s = await app.api.seance(id);
  const [qcm, corrections] = await Promise.all([app.api.qcm(id), app.api.corrections(id)]);
  const vue = html`<div class="page impression">
    ${enteteAdmin('Sujet corrigé', `#/admin/epreuves/${id}/qcm`)}
    <section class="carte pile">
      <h2 class="titre-seance">${s?.titre}</h2>
      <p class="aide no-print">Comme dans Théia, marquez une proposition juste « indispensable » (l'oublier met 0 à la question) ou une proposition fausse « inacceptable » (la cocher met 0). Réglez aussi, question par question, le type (QRM ou QRP), la pondération, et après l'épreuve la neutralisation (tous les candidats ont les points) ou l'annulation (question retirée de la note). Les notes de toute la série sont recalculées.</p>
      <button class="btn contour no-print" onclick="window.print()">Imprimer ou enregistrer en PDF</button>
    </section>
    ${qcm.length ? qcmCorrige(qcm, corrections, null, true) : vide('Aucun QCM.')}
  </div>`;
  function monter(el) {
    chargerImages(el, app.api);
    el.addEventListener('change', async (e) => {
      const champ = e.target.closest('[data-champ]');
      if (champ) {
        const qid = champ.closest('[data-reglages]').dataset.reglages;
        const q = qcm.flatMap((d) => d.questions).find((x) => x.id === qid);
        const nom = champ.dataset.champ;
        let valeur = champ.value;
        if (nom === 'coefficient' || nom === 'nb_reponses') {
          valeur = Math.round(Number(valeur));
          if (!(valeur >= 1)) return app.message('Nombre entier, au moins 1.', 'erreur');
        }
        const champs = { [nom]: valeur };
        if (nom === 'type') champs.nb_reponses = valeur === 'QRP' ? Math.max(1, (corrections[qid]?.bonnes || []).length) : null;
        if (nom === 'statut' && valeur === 'annulee' && !confirm('Annuler cette question ? Elle sera retirée de la note de tous les étudiants.')) return app.rafraichir();
        champ.disabled = true;
        try {
          await app.api.modifierQuestion(qid, champs);
          Object.assign(q, champs);
          app.message('Question modifiée : notes recalculées.');
          app.rafraichir();
        } catch (err) {
          app.message(err.message, 'erreur');
          champ.disabled = false;
        }
        return;
      }
      const sel = e.target.closest('[data-marque]');
      if (!sel) return;
      const qid = sel.dataset.marque;
      const pid = sel.dataset.prop;
      const c = corrections[qid];
      const indispensables = (c.indispensables || []).filter((x) => x !== pid);
      const inacceptables = (c.inacceptables || []).filter((x) => x !== pid);
      if (sel.value === 'indispensable') indispensables.push(pid);
      if (sel.value === 'inacceptable') inacceptables.push(pid);
      sel.disabled = true;
      try {
        await app.api.modifierCorrection(qid, { indispensables, inacceptables });
        Object.assign(c, { indispensables, inacceptables });
        app.message('Correction enregistrée : notes recalculées.');
        app.rafraichir();
      } catch (err) {
        app.message(err.message, 'erreur');
        sel.disabled = false;
      }
    });
  }
  return { html: vue, monter, titre: 'Sujet corrigé' };
}

// ---------- Résultats ----------
export async function vueAdminResultats(app, { id }) {
  const { s, serie, nomG } = await chargerSerie(app, id);
  if (!s) return { html: html`<div class="page">${enteteAdmin('Épreuve introuvable', '#/admin/epreuves')}</div>` };
  const [qcm, corrections, resultats, copies] = await Promise.all([app.api.qcm(id), app.api.corrections(id), app.api.resultatsEpreuve(id), app.api.copiesEpreuve(id)]);
  const questions = aPlat(qcm);
  const aCorriger = qrocACorriger(questions, corrections, copies);
  const notes = resultats.map((r) => r.note20).sort((a, b) => a - b);
  const moyenne = notes.length ? notes.reduce((a, b) => a + b, 0) / notes.length : 0;
  const mediane = notes.length ? (notes[Math.floor((notes.length - 1) / 2)] + notes[Math.ceil((notes.length - 1) / 2)]) / 2 : 0;
  const enCours = resultats.filter((r) => !r.rendue_le).length;
  const groupeDe = (r) => nomG(serie.find((x) => x.id === r.seance_id) || { groupes: [] });

  // Réussite par question (points moyens).
  const reussite = questions.map((q) => {
    const c = corrections[q.id];
    const pts = copies.map((cp) => points(q, c, cp.reponses.find((x) => x.question_id === q.id)));
    return { q, moy: pts.length ? pts.reduce((a, b) => a + b, 0) / pts.length : 0 };
  });

  const vue = html`<div class="page">
    ${enteteAdmin('Résultats', `#/admin/epreuves/${id}/qcm`)}
    <section class="carte pile">
      <h2 class="titre-seance">${s.titre}</h2>
      <dl class="chiffres">
        <div><dt>Copies</dt><dd>${resultats.length}${enCours ? html` <span class="aide">(${enCours} non envoyée${enCours > 1 ? 's' : ''})</span>` : ''}</dd></div>
        <div><dt>Moyenne</dt><dd>${formatNote(moyenne)} / 20</dd></div>
        <div><dt>Médiane</dt><dd>${formatNote(mediane)}</dd></div>
        <div><dt>Min – max</dt><dd>${notes.length ? `${formatNote(notes[0])} – ${formatNote(notes.at(-1))}` : '–'}</dd></div>
      </dl>
      <p class="aide">${{ cloture: 'Les étudiants voient leur note et leur rang dès la fin de leur épreuve.', date: s.publication_le ? `Notes et rangs publiés le ${dateLongue(s.publication_le).toLowerCase()} à ${heure(s.publication_le)}.` : 'Date de publication à choisir.', jamais: "Notes et rangs non affichés dans l'app." }[s.publication || 'cloture']}${serie.some((x) => !x.annulee && new Date(x.fin) > new Date()) ? ' Classement provisoire : un groupe au moins doit encore composer.' : ''}</p>
      ${aCorriger ? html`<p class="alerte attention">${aCorriger} réponse${aCorriger > 1 ? 's' : ''} de QROC à corriger : notes provisoires, cachées aux étudiants tant qu'il en reste.</p>` : ''}
      ${questions.some((q) => q.type === 'QROC') ? html`<a class="btn contour" href="#/admin/epreuves/${id}/qroc">Corriger les QROC</a>` : ''}
      <h3 class="titre-section">Sauvegardes</h3>
      <div class="actions">
        <button class="btn plein" data-export="resultats">Notes et rangs (CSV)</button>
        <button class="btn contour" data-export="copies">Copies avec les cases cochées (CSV)</button>
        <button class="btn contour" data-export="json">Sauvegarde complète (JSON)</button>
        <a class="btn contour" href="#/admin/epreuves/${id}/copie/toutes">Toutes les copies corrigées (PDF)</a>
      </div>
      <p class="aide">Les CSV s'ouvrent dans Excel. La sauvegarde complète contient le sujet, les bonnes réponses et toutes les copies.</p>
    </section>

    <section class="pile-petite">
      <h2 class="titre-section">Classement</h2>
      ${resultats.length
        ? html`<div class="tableau-defile"><table class="tableau">
            <thead><tr><th>Rang</th><th>Étudiant</th><th>Groupe</th><th>Envoyée</th><th>Note /20</th><th></th></tr></thead>
            <tbody>${resultats.map(
              (r) => html`<tr>
                <td>${r.rang}</td>
                <td><strong>${r.nom} ${r.prenom}</strong><br><span class="aide">${r.email}</span></td>
                <td>${r.groupe || groupeDe(r)}</td>
                <td>${r.rendue_le ? `${dateCourte(r.rendue_le)} ${heure(r.rendue_le)}` : html`<span class="etiquette modifiee">En cours</span>`}</td>
                <td><strong>${formatNote(r.note20)}</strong><br><span class="aide">${formatNote(r.points)} / ${r.total} pts</span></td>
                <td><a class="lien-petit" href="#/admin/epreuves/${id}/copie/${encodeURIComponent(r.user_id)}">Copie</a></td>
              </tr>`
            )}</tbody></table></div>`
        : vide('Aucune copie pour le moment.')}
    </section>

    ${questions.length && copies.length
      ? html`<section class="pile-petite">
          <h2 class="titre-section">Réussite par question</h2>
          <div class="tableau-defile"><table class="tableau">
            <thead><tr><th>Question</th><th>Type</th><th>Points moyens</th><th></th></tr></thead>
            <tbody>${reussite.map(
              ({ q, moy }) => html`<tr>
                <td><strong>${q.dossier.titre} · Q${q.qi + 1}</strong><br><span class="aide">${questionCourte(q.enonce, 110)}</span></td>
                <td>${q.type}${q.statut === 'annulee' ? ' · annulée' : q.statut === 'neutralisee' ? ' · neutralisée' : ''}</td>
                <td>${formatNote(Math.round(moy * 100) / 100)}</td>
                <td><span class="barre" style="--p:${Math.round(moy * 100)}%" title="${Math.round(moy * 100)} %"></span></td>
              </tr>`
            )}</tbody></table></div>
        </section>`
      : ''}
  </div>`;

  function monter(el) {
    el.addEventListener('click', (e) => {
      const t = e.target.closest('[data-export]')?.dataset.export;
      if (t === 'resultats') telecharger(nomFichier(s, 'notes.csv'), csvResultats(resultats.map((r) => ({ ...r, groupe: r.groupe || groupeDe(r) }))));
      if (t === 'copies') telecharger(nomFichier(s, 'copies.csv'), csvCopies(qcm, corrections, resultats, copies));
      if (t === 'json')
        telecharger(
          nomFichier(s, 'sauvegarde.json'),
          JSON.stringify({ epreuve: s, serie, qcm, corrections, resultats, copies, exportee_le: new Date().toISOString() }, null, 1),
          'application/json'
        );
    });
  }
  return { html: vue, monter, titre: 'Résultats' };
}

// ---------- Copie d'un étudiant (ou toutes), corrigée et imprimable ----------
export async function vueAdminCopie(app, { id, user }) {
  const s = await app.api.seance(id);
  const [qcm, corrections, resultats, copies] = await Promise.all([app.api.qcm(id), app.api.corrections(id), app.api.resultatsEpreuve(id), app.api.copiesEpreuve(id)]);
  const choisis = user === 'toutes' ? resultats : resultats.filter((r) => String(r.user_id) === user);
  const moyenne = resultats.length ? resultats.reduce((a, r) => a + r.note20, 0) / resultats.length : null;

  const vue = html`<div class="page impression">
    ${enteteAdmin(user === 'toutes' ? 'Toutes les copies' : 'Copie', `#/admin/epreuves/${id}/resultats`)}
    <div class="no-print actions"><button class="btn plein" onclick="window.print()">Imprimer ou enregistrer en PDF</button></div>
    ${choisis.length
      ? choisis.map((r) => {
          const copie = copies.find((c) => c.user_id === r.user_id && c.seance_id === r.seance_id);
          const reponses = Object.fromEntries((copie?.reponses || []).map((x) => [x.question_id, x]));
          return html`<article class="copie-imprimable">
            <section class="carte pile">
              <h2 class="titre-seance">${r.nom} ${r.prenom}</h2>
              <p class="aide">${s.titre} · ${r.groupe || ''} · ${r.rendue_le ? `envoyée le ${dateCourte(r.rendue_le)} à ${heure(r.rendue_le)}` : 'non envoyée'}</p>
              ${bandeauNote({ ...r, moyenne, effectif: resultats.length })}
            </section>
            ${qcmCorrige(qcm, corrections, reponses)}
          </article>`;
        })
      : vide('Copie introuvable.')}
  </div>`;
  return { html: vue, monter: (el) => chargerImages(el, app.api), titre: 'Copie' };
}

// ---------- Vérification de la correction automatique des QROC ----------
// Les réponses des étudiants sont regroupées (même réponse à la mise en forme
// près) ; l'équipe accepte ou refuse d'un clic, et toutes les notes suivent.
// « À corriger » (proche ou non reconnue) : tant qu'il en reste, les étudiants
// ne voient ni leur note ni leur rang (comme Théia, correction « en cours »).
const ETATS = {
  approche: ['À confirmer', 'Acceptée car proche'],
  faux: ['À corriger', 'Aucune réponse acceptée ne correspond'],
  partielle: ['0,5 point', "Jugée acceptable par l'équipe"],
  refusee: ['Fausse', "Refusée par l'équipe"],
  exact: ['Juste', 'Correspond à une réponse acceptée'],
};
const ORDRE = { faux: 0, approche: 1, partielle: 2, refusee: 3, exact: 4 };

export async function vueAdminQroc(app, { id }) {
  const s = await app.api.seance(id);
  const [qcm, corrections, copies] = await Promise.all([app.api.qcm(id), app.api.corrections(id), app.api.copiesEpreuve(id)]);
  const questions = aPlat(qcm).filter((q) => q.type === 'QROC');

  const groupes = (q) => {
    const c = corrections[q.id] || {};
    const par = new Map();
    for (const cp of copies) {
      const texte = cp.reponses.find((x) => x.question_id === q.id)?.texte?.trim();
      if (!texte) continue;
      const k = cle(texte);
      const g = par.get(k) || { textes: new Map(), n: 0 };
      g.n++;
      g.textes.set(texte, (g.textes.get(texte) || 0) + 1);
      par.set(k, g);
    }
    return [...par.values()]
      .map((g) => {
        const textes = [...g.textes.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
        return { textes, n: g.n, ...corrigerQroc(textes[0], c.reponses_qroc, c.refusees_qroc, c.partielles_qroc) };
      })
      .sort((a, b) => ORDRE[a.mode] - ORDRE[b.mode] || b.n - a.n);
  };
  const listes = questions.map((q) => ({ q, g: groupes(q) }));
  const aVerifier = listes.reduce((n, l) => n + l.g.filter((x) => x.mode === 'approche' || x.mode === 'faux').length, 0);

  const vue = html`<div class="page">
    ${enteteAdmin('Correction des QROC', `#/admin/epreuves/${id}/resultats`)}
    <section class="carte pile">
      <h2 class="titre-seance">${s.titre}</h2>
      <p>Les QROC sont corrigées automatiquement : majuscules, accents, articles, pluriels et ordre des mots ne comptent pas ; les abréviations courantes (TDM, AP, ECG, écho…) sont reconnues ; une faute de frappe est tolérée sur les mots longs, jamais sur un chiffre, une négation, le début ou la fin du mot (hypo/hyper, -ite/-ose).</p>
      <p class="${aVerifier ? 'alerte attention' : 'aide'}">${aVerifier ? `${aVerifier} réponse${aVerifier > 1 ? 's' : ''} à corriger (non reconnue${aVerifier > 1 ? 's' : ''}, ou acceptée${aVerifier > 1 ? 's' : ''} car proche${aVerifier > 1 ? 's' : ''}). Tant qu'il en reste, les étudiants ne voient ni leur note ni leur rang.` : 'Toutes les réponses sont corrigées : notes et rangs peuvent être publiés.'}</p>
      <p class="aide">Pour chaque réponse : Accepter (1 point), Acceptable (0,5 point) ou Refuser (0). Les notes de toute la série sont recalculées.</p>
    </section>
    ${listes.length
      ? listes.map(
          ({ q, g }) => html`<section class="carte pile" data-question="${q.id}">
            <p class="surtitre">${q.dossier.titre} · Q${q.qi + 1}</p>
            <p class="aide">${questionCourte(q.enonce)}</p>
            <div class="pile-mini">
              <span class="aide">Réponses acceptées</span>
              <div class="etiquettes">${(corrections[q.id]?.reponses_qroc || []).map((r) => html`<span class="etiquette">${r}</span>`)}</div>
              ${(corrections[q.id]?.partielles_qroc || []).length
                ? html`<span class="aide">Réponses acceptables (0,5 point)</span><div class="etiquettes">${corrections[q.id].partielles_qroc.map((r) => html`<span class="etiquette">${r}</span>`)}</div>`
                : ''}
              ${(corrections[q.id]?.refusees_qroc || []).length
                ? html`<span class="aide">Réponses refusées</span><div class="etiquettes">${corrections[q.id].refusees_qroc.map((r) => html`<span class="etiquette annulee">${r}</span>`)}</div>`
                : ''}
            </div>
            <form class="ligne-ajout" data-ajout="${q.id}"><input name="r" placeholder="Ajouter une réponse acceptée" aria-label="Ajouter une réponse acceptée"><button class="btn contour">Ajouter</button></form>
            ${g.length
              ? html`<div class="tableau-defile"><table class="tableau">
                  <thead><tr><th>Réponse des étudiants</th><th>Copies</th><th>Correction</th><th></th></tr></thead>
                  <tbody>${g.map(
                    (x) => html`<tr class="qroc-${x.mode}">
                      <td><strong>${x.textes[0]}</strong>${x.textes.length > 1 ? html`<br><span class="aide">aussi : ${x.textes.slice(1, 4).join(' · ')}</span>` : ''}</td>
                      <td>${x.n}</td>
                      <td><span class="etiquette ${x.juste ? 'ok' : x.mode === 'partielle' ? '' : 'annulee'}">${ETATS[x.mode][0]}</span>${x.mode === 'approche' ? html`<br><span class="aide">proche de « ${x.acceptee} »</span>` : ''}</td>
                      <td class="actions-ligne">
                        ${x.mode !== 'exact' ? html`<button class="btn lien" data-accepter="${x.textes[0]}">${x.mode === 'approche' ? 'Confirmer' : 'Accepter'}</button>` : ''}
                        ${x.mode !== 'partielle' ? html`<button class="btn lien" data-partielle="${x.textes[0]}">Acceptable (0,5)</button>` : ''}
                        ${x.mode !== 'refusee' ? html`<button class="btn lien rouge" data-refuser="${x.textes[0]}">Refuser</button>` : ''}
                      </td>
                    </tr>`
                  )}</tbody></table></div>
                ${g.some((x) => x.mode === 'faux') ? html`<button class="btn contour" data-refuser-reste="${g.filter((x) => x.mode === 'faux').map((x) => x.textes[0]).join('\n')}">Refuser toutes les réponses non reconnues de cette question</button>` : ''}`
              : html`<p class="aide">Aucune réponse pour le moment.</p>`}
          </section>`
        )
      : vide('Cette épreuve n’a pas de QROC.')}
  </div>`;

  function monter(el) {
    const modifier = async (qid, f) => {
      const c = corrections[qid];
      const champs = f({ reponses_qroc: [...(c.reponses_qroc || [])], refusees_qroc: [...(c.refusees_qroc || [])], partielles_qroc: [...(c.partielles_qroc || [])] });
      try {
        await app.api.modifierCorrection(qid, champs);
        app.message('Correction mise à jour, notes recalculées.');
        app.rafraichir();
      } catch (err) {
        app.message(err.message, 'erreur');
      }
    };
    const sans = (liste, texte) => liste.filter((r) => cle(r) !== cle(texte));
    // Une réponse va dans une seule liste : acceptées, acceptables (0,5) ou refusées.
    const ranger = (c, t, liste) => {
      const r = { reponses_qroc: sans(c.reponses_qroc, t), partielles_qroc: sans(c.partielles_qroc, t), refusees_qroc: sans(c.refusees_qroc, t) };
      r[liste].push(t);
      return r;
    };
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-accepter],[data-refuser],[data-partielle],[data-refuser-reste]');
      if (!b) return;
      const qid = b.closest('[data-question]').dataset.question;
      if (b.dataset.accepter !== undefined) modifier(qid, (c) => ranger(c, b.dataset.accepter, 'reponses_qroc'));
      else if (b.dataset.partielle !== undefined) modifier(qid, (c) => ranger(c, b.dataset.partielle, 'partielles_qroc'));
      else if (b.dataset.refuser !== undefined) modifier(qid, (c) => ranger(c, b.dataset.refuser, 'refusees_qroc'));
      else modifier(qid, (c) => b.dataset.refuserReste.split('\n').reduce((acc, t) => ({ ...acc, ...ranger(acc, t, 'refusees_qroc') }), c));
    });
    el.addEventListener('submit', (e) => {
      e.preventDefault();
      const t = String(new FormData(e.target).get('r') || '').trim();
      if (!t) return;
      modifier(e.target.dataset.ajout, (c) => ranger(c, t, 'reponses_qroc'));
    });
  }
  return { html: vue, monter, titre: 'QROC' };
}
