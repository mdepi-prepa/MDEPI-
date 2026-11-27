// Back-office : saisie manuelle d'un QCM, question par question.
// Chaque dossier est un DP, un KFP ou un groupe de questions isolées ; chaque
// question (QRU, QRM, QRP, QROC) est enregistrée dès que l'on clique sur
// « Enregistrer », avec sa correction (cases justes, indispensables,
// inacceptables, coefficient, images, commentaire). On peut s'arrêter et
// reprendre plus tard : tout ce qui est enregistré est gardé.
import { html, brut } from '../../lib/html.js';
import { MATIERES } from '../../lib/matieres.js';
import { aPlat, lettre, htmlQcm, chargerImages, LIBELLES_TYPES } from '../../lib/qcm.js';
import { heure } from '../../lib/dates.js';
import { enteteAdmin } from './index.js';

const FORMATS = {
  DP: { nom: 'DP', libelle: 'Dossier progressif (DP)', type: 'QRM' },
  KFP: { nom: 'KFP', libelle: 'KFP', type: 'QRM' },
  QI: { nom: 'Questions isolées', libelle: 'Questions isolées (QI)', type: 'QRU' },
};
const ETATS = {
  fausse: 'Fausse',
  juste: 'Juste',
  indispensable: 'Juste et indispensable',
  inacceptable: 'Fausse et inacceptable',
};

// ---------- Texte <-> HTML ----------
const echapper = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export function texteVersHtml(texte) {
  return String(texte || '')
    .replace(/\r/g, '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => '<p>' + p.split('\n').map(echapper).join('<br>') + '</p>')
    .join('');
}
// Renvoie le texte (paragraphes séparés par une ligne vide) et les images.
export function htmlVersTexte(source) {
  const doc = new DOMParser().parseFromString(String(source || ''), 'text/html');
  const images = [...doc.querySelectorAll('img')].map((i) => (i.getAttribute('src') || '').replace(/^qcm-img:/, '')).filter(Boolean);
  doc.querySelectorAll('img').forEach((i) => i.remove());
  doc.querySelectorAll('br').forEach((b) => b.replaceWith('\n'));
  doc.querySelectorAll('p,div,li,tr,h4,h5').forEach((b) => b.append('\n\n'));
  const texte = doc.body.textContent.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return { texte, images };
}
const avecImages = (texte, images) => texteVersHtml(texte) + images.map((c) => `<p><img src="qcm-img:${c}" alt=""></p>`).join('');

export async function vueAdminSaisie(app, { id }) {
  const s = await app.api.seance(id);
  if (!s) return { html: html`<div class="page">${enteteAdmin('Épreuve introuvable', '#/admin/epreuves')}</div>` };
  let qcm = [];
  let corrections = {};
  let commence = false;
  // Question ouverte dans l'éditeur : { dossierId, q (null = nouvelle) }.
  let ouverte = null;
  let modifie = false;

  const vue = html`<div class="page">
    ${enteteAdmin('Saisir le QCM', `#/admin/epreuves/${id}/qcm`)}
    <section class="carte pile">
      <h2 class="titre-seance">${s.titre}</h2>
      <p class="aide">Ajoutez un DP, un KFP ou des questions isolées, puis leurs questions une par une. Chaque question est enregistrée dès que vous cliquez sur « Enregistrer » : vous pouvez vous arrêter et reprendre plus tard.
        Dans un DP ou un KFP, écrivez l'énoncé du cas clinique au début de la question 1 : les étudiants peuvent le relire aux questions suivantes.</p>
      <p class="alerte attention" data-commence hidden>Des étudiants ont déjà commencé cette épreuve : vous pouvez corriger les questions, mais plus en ajouter ni en retirer.</p>
      <div class="actions" data-ajouts>
        ${Object.entries(FORMATS).map(([k, f]) => html`<button class="btn contour" data-ajouter-dossier="${k}">+ ${f.libelle}</button>`)}
      </div>
    </section>
    <div class="pile" data-dossiers><p class="aide">Chargement…</p></div>
    <section class="carte pile" data-editeur hidden></section>
  </div>`;

  function monter(el) {
    const zoneDossiers = el.querySelector('[data-dossiers]');
    const editeur = el.querySelector('[data-editeur]');

    async function recharger() {
      [qcm, corrections, commence] = await Promise.all([app.api.qcm(id), app.api.corrections(id), app.api.qcmCommence(id).catch(() => false)]);
      el.querySelector('[data-commence]').hidden = !commence;
      el.querySelectorAll('[data-ajouter-dossier]').forEach((b) => (b.disabled = commence));
      dessinerDossiers();
    }

    function dessinerDossiers() {
      const toutes = aPlat(qcm);
      zoneDossiers.innerHTML = String(html`${qcm.length
        ? qcm.map(
            (d) => html`<section class="carte pile-petite dossier-saisie" data-dossier="${d.id}">
              <div class="grille-2">
                <label class="champ"><span>Titre du dossier</span><input data-titre value="${d.titre}" maxlength="120"></label>
                <label class="champ"><span>Matière</span><input data-matiere-dossier list="matieres-saisie" value="${d.matiere || ''}" placeholder="${s.matiere || 'Ex. Cardiologie'}"></label>
              </div>
              <div class="actions">
                <button class="btn contour petit" data-enregistrer-dossier>Enregistrer le titre</button>
                ${commence ? '' : html`<button class="btn lien rouge" data-supprimer-dossier>Supprimer le dossier</button>`}
              </div>
              ${d.questions.length
                ? html`<ol class="liste-saisie">${d.questions.map((q) => {
                    const num = toutes.findIndex((x) => x.id === q.id) + 1;
                    const apercu = htmlVersTexte(q.enonce).texte.slice(0, 90);
                    return html`<li class="${ouverte?.q?.id === q.id ? 'courante' : ''}">
                      <button class="ligne-saisie" data-ouvrir="${q.id}">
                        <strong>Q${num}</strong> <span class="etiquette">${q.type}</span>${Number(q.coefficient) !== 1 ? html` <span class="etiquette">coef. ${q.coefficient}</span>` : ''}
                        <span class="aide">${apercu || '(énoncé vide)'}</span>
                      </button></li>`;
                  })}</ol>`
                : html`<p class="aide">Aucune question pour l'instant.</p>`}
              ${commence ? '' : html`<button class="btn plein" data-nouvelle="${d.id}">+ Ajouter une question</button>`}
            </section>`
          )
        : html`<div class="carte"><p class="aide">Aucun dossier. Commencez par « + Dossier progressif (DP) », « + KFP » ou « + Questions isolées ».</p></div>`}
        <datalist id="matieres-saisie">${MATIERES.map((m) => html`<option value="${m}"></option>`)}</datalist>`);
    }

    const quitterSiPossible = () => !modifie || confirm('La question en cours n’est pas enregistrée. La quitter quand même ?');

    // ---------- Éditeur de question ----------
    function ouvrir(dossierId, q) {
      const d = qcm.find((x) => x.id === dossierId);
      const c = (q && corrections[q.id]) || {};
      const { texte, images } = htmlVersTexte(q?.enonce || '');
      const formatDossier = /^QI|isol/i.test(d.titre) ? 'QI' : 'DP';
      const type = q?.type || FORMATS[formatDossier].type;
      const props = q?.propositions?.length
        ? q.propositions.map((p) => ({
            id: p.id,
            texte: htmlVersTexte(p.texte).texte,
            etat: (c.indispensables || []).includes(p.id) ? 'indispensable' : (c.inacceptables || []).includes(p.id) ? 'inacceptable' : (c.bonnes || []).includes(p.id) ? 'juste' : 'fausse',
            explication: htmlVersTexte((c.explications || {})[p.id] || '').texte,
          }))
        : 'ABCDE'.split('').map((l) => ({ id: l, texte: '', etat: 'fausse', explication: '' }));
      ouverte = { dossierId, q, images: [...images] };
      modifie = false;
      const toutes = aPlat(qcm);
      const num = q ? toutes.findIndex((x) => x.id === q.id) + 1 : null;
      editeur.hidden = false;
      editeur.innerHTML = String(html`
        <h2 class="titre-section">${q ? `Question ${num}` : 'Nouvelle question'} · ${d.titre}</h2>
        <form class="pile" id="f-question">
          <div class="grille-3">
            <label class="champ"><span>Type</span><select name="type">${Object.entries(LIBELLES_TYPES).map(
              ([k, v]) => html`<option value="${k}" ${type === k ? 'selected' : ''}>${k} · ${v.replace(/^Question à /, '')}</option>`
            )}</select></label>
            <label class="champ"><span>Coefficient</span><input type="number" name="coefficient" min="0" step="0.5" value="${q?.coefficient ?? 1}"></label>
            <label class="champ" data-nb><span>Réponses attendues (QRP)</span><input type="number" name="nb_reponses" min="1" step="1" value="${q?.nb_reponses ?? ''}"></label>
          </div>
          <label class="champ"><span>Énoncé</span><textarea name="enonce" rows="6" placeholder="Une ligne vide sépare deux paragraphes.">${texte}</textarea></label>
          <div class="pile-mini">
            <span class="aide">Images de l'énoncé</span>
            <div class="images-saisie" data-images></div>
            <label class="btn contour petit fichier-saisie">+ Ajouter une image<input type="file" accept="image/*" data-image hidden></label>
          </div>

          <fieldset class="pile-petite" data-propositions><legend class="titre-section">Propositions</legend>
            <div class="pile-petite" data-liste-props>${props.map((p, i) => ligneProposition(p, i))}</div>
            <button type="button" class="btn contour petit" data-ajouter-prop>+ Ajouter une proposition</button>
          </fieldset>

          <label class="champ" data-qroc><span>Réponses acceptées (une par ligne)</span><textarea name="reponses_qroc" rows="3" placeholder="Ex. ECG&#10;électrocardiogramme">${(c.reponses_qroc || []).join('\n')}</textarea></label>

          <label class="champ"><span>Commentaire de correction (facultatif)</span><textarea name="commentaire" rows="4">${htmlVersTexte(c.commentaire || '').texte}</textarea></label>
          <p class="erreur" role="alert" hidden></p>
          <div class="actions">
            <button class="btn plein" type="submit" data-suite="non">Enregistrer</button>
            ${commence ? '' : html`<button class="btn contour" type="submit" data-suite="oui">Enregistrer et question suivante</button>`}
            <button class="btn lien" type="button" data-fermer>Fermer</button>
            ${q && !commence ? html`<button class="btn lien rouge" type="button" data-supprimer-question>Supprimer la question</button>` : ''}
          </div>
          <p class="aide" data-etat-enreg></p>
        </form>`);
      dessinerImages();
      ajusterType();
      dessinerDossiers();
      editeur.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }

    function ligneProposition(p, i) {
      return html`<div class="prop-saisie" data-prop="${p.id}">
        <span class="lettre">${lettre(i)}</span>
        <div class="pile-mini">
          <textarea data-texte rows="2" placeholder="Texte de la proposition">${p.texte}</textarea>
          <div class="ligne-prop-saisie">
            <select data-etat aria-label="Correction de la proposition ${lettre(i)}">${Object.entries(ETATS).map(([k, v]) => html`<option value="${k}" ${p.etat === k ? 'selected' : ''}>${v}</option>`)}</select>
            <button type="button" class="btn lien rouge" data-retirer-prop aria-label="Retirer la proposition ${lettre(i)}">Retirer</button>
          </div>
          <details ${p.explication ? 'open' : ''}><summary class="aide">Explication (facultatif)</summary><textarea data-explication rows="2">${p.explication}</textarea></details>
        </div>
      </div>`;
    }

    function renumeroter() {
      editeur.querySelectorAll('[data-prop]').forEach((row, i) => (row.querySelector('.lettre').textContent = lettre(i)));
    }

    function dessinerImages() {
      const zone = editeur.querySelector('[data-images]');
      zone.innerHTML = String(html`${ouverte.images.map(
        (c) => html`<figure class="image-saisie">${brut(htmlQcm(`<img src="qcm-img:${c}" alt="">`))}<button type="button" class="btn lien rouge" data-retirer-image="${c}">Retirer</button></figure>`
      )}`);
      chargerImages(zone, app.api);
    }

    function ajusterType() {
      const f = editeur.querySelector('#f-question');
      const t = f.type.value;
      f.querySelector('[data-propositions]').hidden = t === 'QROC';
      f.querySelector('[data-qroc]').hidden = t !== 'QROC';
      f.querySelector('[data-nb]').hidden = t !== 'QRP';
    }

    // Lit le formulaire et vérifie la question ; renvoie { q, correction } ou un message.
    function lire() {
      const f = editeur.querySelector('#f-question');
      const type = f.type.value;
      const texte = f.enonce.value.trim();
      if (!texte && !ouverte.images.length) return "Écrivez l'énoncé de la question.";
      const coefficient = Number(f.coefficient.value);
      if (!(coefficient >= 0)) return 'Coefficient invalide.';
      const q = { type, enonce: avecImages(texte, ouverte.images), propositions: [], nb_reponses: null, coefficient: coefficient || 1 };
      const correction = { bonnes: [], indispensables: [], inacceptables: [], reponses_qroc: [], explications: {}, commentaire: texteVersHtml(f.commentaire.value) };
      if (type === 'QROC') {
        correction.reponses_qroc = [...new Set(f.reponses_qroc.value.split('\n').map((x) => x.trim()).filter(Boolean))];
        if (!correction.reponses_qroc.length) return 'Indiquez au moins une réponse acceptée.';
        return { q, correction };
      }
      const lignes = [...f.querySelectorAll('[data-prop]')].map((row) => ({
        id: row.dataset.prop,
        texte: row.querySelector('[data-texte]').value.trim(),
        etat: row.querySelector('[data-etat]').value,
        explication: row.querySelector('[data-explication]').value.trim(),
      }));
      const remplies = lignes.filter((p) => p.texte);
      if (remplies.length < 2) return 'Écrivez au moins deux propositions.';
      if (remplies.length !== lignes.length) return 'Une proposition est vide : remplissez-la ou retirez-la.';
      const justes = lignes.filter((p) => p.etat === 'juste' || p.etat === 'indispensable');
      if (type === 'QRU' && justes.length !== 1) return 'Une QRU a exactement une proposition juste.';
      if (type !== 'QRU' && !justes.length) return 'Marquez au moins une proposition juste.';
      if (type === 'QRP') {
        q.nb_reponses = Number(f.nb_reponses.value) || justes.length;
        if (q.nb_reponses !== justes.length) return `QRP : ${q.nb_reponses} réponses attendues, mais ${justes.length} proposition(s) marquée(s) juste(s).`;
      }
      q.propositions = lignes.map((p) => ({ id: p.id, texte: texteVersHtml(p.texte) }));
      correction.bonnes = justes.map((p) => p.id);
      correction.indispensables = lignes.filter((p) => p.etat === 'indispensable').map((p) => p.id);
      correction.inacceptables = lignes.filter((p) => p.etat === 'inacceptable').map((p) => p.id);
      for (const p of lignes) if (p.explication) correction.explications[p.id] = texteVersHtml(p.explication);
      return { q, correction };
    }

    async function enregistrer(suite) {
      const f = editeur.querySelector('#f-question');
      const erreur = f.querySelector('.erreur');
      const lu = lire();
      if (typeof lu === 'string') {
        erreur.textContent = lu;
        erreur.hidden = false;
        return;
      }
      erreur.hidden = true;
      f.querySelectorAll('button').forEach((b) => (b.disabled = true));
      try {
        const r = await app.api.enregistrerQuestionSaisie(id, ouverte.dossierId, ouverte.q?.id || null, lu.q, lu.correction);
        modifie = false;
        const dossierId = ouverte.dossierId;
        await recharger();
        app.message(`Question enregistrée à ${heure(new Date().toISOString())}.`);
        if (suite) ouvrir(dossierId, null);
        else ouvrir(dossierId, aPlat(qcm).find((x) => x.id === r.id));
      } catch (err) {
        erreur.textContent = err.message;
        erreur.hidden = false;
        f.querySelectorAll('button').forEach((b) => (b.disabled = false));
      }
    }

    function fermer() {
      ouverte = null;
      modifie = false;
      editeur.hidden = true;
      editeur.innerHTML = '';
      dessinerDossiers();
    }

    // ---------- Événements ----------
    el.addEventListener('input', (e) => {
      if (e.target.closest('#f-question')) modifie = true;
    });
    el.addEventListener('change', async (e) => {
      if (e.target.name === 'type') ajusterType();
      if (e.target.matches('[data-image]')) {
        const fichier = e.target.files[0];
        e.target.value = '';
        if (!fichier) return;
        try {
          const chemin = await app.api.ajouterImageQcm(id, fichier);
          ouverte.images.push(chemin);
          modifie = true;
          dessinerImages();
        } catch (err) {
          app.message('Image non ajoutée : ' + err.message, 'erreur');
        }
      }
    });
    el.addEventListener('submit', (e) => {
      if (e.target.id !== 'f-question') return;
      e.preventDefault();
      enregistrer(e.submitter?.dataset.suite === 'oui');
    });
    el.addEventListener('click', async (e) => {
      const b = e.target.closest('button');
      if (!b || b.disabled) return;
      const dossierEl = b.closest('[data-dossier]');
      try {
        if (b.dataset.ajouterDossier) {
          if (!quitterSiPossible()) return;
          const f = FORMATS[b.dataset.ajouterDossier];
          const pris = new Set(qcm.map((d) => d.titre));
          let n = qcm.filter((d) => d.titre.startsWith(f.nom)).length + 1;
          let titre = f.nom === 'Questions isolées' && !pris.has(f.nom) ? f.nom : `${f.nom} ${n}`;
          while (pris.has(titre)) titre = `${f.nom} ${++n}`;
          const d = await app.api.creerDossier(id, { titre, matiere: s.matiere && s.matiere !== 'Toutes matières' ? s.matiere : '' });
          await recharger();
          ouvrir(d.id, null);
        } else if (b.dataset.nouvelle) {
          if (quitterSiPossible()) ouvrir(b.dataset.nouvelle, null);
        } else if (b.dataset.ouvrir) {
          if (!quitterSiPossible()) return;
          const q = aPlat(qcm).find((x) => x.id === b.dataset.ouvrir);
          ouvrir(q.dossier_id, q);
        } else if (b.hasAttribute('data-enregistrer-dossier')) {
          const titre = dossierEl.querySelector('[data-titre]').value.trim();
          if (!titre) return app.message('Donnez un titre au dossier.', 'erreur');
          await app.api.modifierDossier(dossierEl.dataset.dossier, { titre, matiere: dossierEl.querySelector('[data-matiere-dossier]').value.trim() });
          app.message('Dossier enregistré.');
          await recharger();
        } else if (b.hasAttribute('data-supprimer-dossier')) {
          const d = qcm.find((x) => x.id === dossierEl.dataset.dossier);
          if (!confirm(`Supprimer « ${d.titre} » et ses ${d.questions.length} question(s) ?`)) return;
          await app.api.supprimerDossier(id, d.id);
          if (ouverte?.dossierId === d.id) fermer();
          await recharger();
        } else if (b.hasAttribute('data-ajouter-prop')) {
          const liste = editeur.querySelector('[data-liste-props]');
          const n = liste.children.length;
          liste.insertAdjacentHTML('beforeend', String(ligneProposition({ id: 'P' + Date.now().toString(36), texte: '', etat: 'fausse', explication: '' }, n)));
          liste.lastElementChild.querySelector('textarea').focus();
          modifie = true;
        } else if (b.hasAttribute('data-retirer-prop')) {
          b.closest('[data-prop]').remove();
          renumeroter();
          modifie = true;
        } else if (b.dataset.retirerImage) {
          ouverte.images = ouverte.images.filter((c) => c !== b.dataset.retirerImage);
          modifie = true;
          dessinerImages();
        } else if (b.hasAttribute('data-fermer')) {
          if (quitterSiPossible()) fermer();
        } else if (b.hasAttribute('data-supprimer-question')) {
          if (!confirm('Supprimer cette question ?')) return;
          await app.api.supprimerQuestionSaisie(id, ouverte.q.id);
          fermer();
          await recharger();
        }
      } catch (err) {
        app.message(err.message, 'erreur');
      }
    });
    window.addEventListener('beforeunload', (e) => {
      if (modifie && document.body.contains(editeur)) e.preventDefault();
    });

    recharger().catch((err) => (zoneDossiers.innerHTML = String(html`<p class="erreur">${err.message}</p>`)));
  }

  return { html: vue, monter, titre: 'Saisir le QCM' };
}
