// Back-office : séances du planning, replays et documents.
import { html } from '../../lib/html.js';
import { LIEUX, CODES_PROMOS } from '../../lib/promos.js';
import { dateCourte, plageHoraire, versChampsDate, depuisChampsDate } from '../../lib/dates.js';
import { enteteAdmin } from './index.js';
import { casesPromos } from './annonces.js';
import { etiquettes, vide } from '../commun.js';

export async function vueAdminSeances(app) {
  const seances = await app.api.seances();
  const maintenant = new Date();
  const aVenir = seances.filter((s) => new Date(s.fin) > maintenant);
  const passees = seances.filter((s) => new Date(s.fin) <= maintenant).reverse();
  const tableau = (liste) =>
    liste.length
      ? html`<div class="tableau-defile"><table class="tableau">
          <thead><tr><th>Date</th><th>Séance</th><th>Promos</th><th>État</th></tr></thead>
          <tbody>${liste.map(
            (s) => html`<tr>
              <td>${dateCourte(s.debut)}<br><span class="aide">${plageHoraire(s.debut, s.fin)}</span></td>
              <td><a href="#/admin/seances/${s.id}"><strong>${s.titre}</strong></a><br><span class="aide">${s.lieu}</span></td>
              <td>${s.promos.join(', ')}${s.groupes.length ? html`<br><span class="aide">${s.groupes.length} groupe(s)</span>` : ''}</td>
              <td><div class="etiquettes">${etiquettes(s)}${new Date(s.fin) <= maintenant ? (s.replay_url ? html`<span class="etiquette">Replay</span>` : html`<span class="etiquette modifiee">Sans replay</span>`) : ''}</div></td>
            </tr>`
          )}</tbody></table></div>`
      : vide('Aucune séance.');

  return {
    titre: 'Planning',
    html: html`<div class="page">
      ${enteteAdmin('Planning et replays')}
      <a class="btn plein" href="#/admin/seances/nouvelle">+ Nouvelle séance</a>
      <h2 class="titre-section">À venir (${aVenir.length})</h2>
      ${tableau(aVenir)}
      <h2 class="titre-section">Passées (${passees.length})</h2>
      ${tableau(passees)}
    </div>`,
  };
}

const VIDE = {
  titre: '',
  matiere: '',
  debut: null,
  fin: null,
  lieu: LIEUX[0],
  presentiel: true,
  zoom_url: '',
  epreuve: false,
  annulee: false,
  promos: [],
  groupes: [],
  replay_url: '',
  replay_duree_min: null,
  modifiee_le: null,
};

export async function vueAdminSeance(app, { id }) {
  const nouvelle = id === 'nouvelle';
  const s = nouvelle ? { ...VIDE } : await app.api.seance(id);
  if (!s) return { html: html`<div class="page">${enteteAdmin('Séance introuvable', '#/admin/seances')}</div>` };
  const [groupes, docs] = await Promise.all([app.api.groupes(), nouvelle ? [] : app.api.documents(id)]);
  const deb = s.debut ? versChampsDate(s.debut) : { date: '', heure: '18:30' };
  const fin = s.fin ? versChampsDate(s.fin) : { heure: '21:30' };
  const lieuAutre = s.lieu && !LIEUX.includes(s.lieu);

  const vue = html`<div class="page">
    ${enteteAdmin(nouvelle ? 'Nouvelle séance' : 'Modifier la séance', '#/admin/seances')}
    <form class="carte pile" id="f-seance">
      <label class="champ"><span>Titre</span><input name="titre" required value="${s.titre}" placeholder="Cardiologie : syndromes coronariens aigus"></label>
      <label class="champ"><span>Matière</span><input name="matiere" value="${s.matiere}" placeholder="Cardiologie"></label>
      <div class="grille-3">
        <label class="champ"><span>Date</span><input type="date" name="date" required value="${deb.date}"></label>
        <label class="champ"><span>Début</span><input type="time" name="h_debut" required value="${deb.heure}"></label>
        <label class="champ"><span>Fin</span><input type="time" name="h_fin" required value="${fin.heure}"></label>
      </div>
      <label class="champ"><span>Lieu</span>
        <select name="lieu">
          ${LIEUX.map((l) => html`<option ${s.lieu === l ? 'selected' : ''}>${l}</option>`)}
          <option value="__autre" ${lieuAutre ? 'selected' : ''}>Autre adresse…</option>
        </select></label>
      <label class="champ" data-autre ${lieuAutre ? '' : 'hidden'}><span>Autre adresse</span><input name="lieu_autre" value="${lieuAutre ? s.lieu : ''}"></label>
      <label class="champ"><span>Lien Zoom (laisser vide si pas de Zoom)</span><input type="url" name="zoom_url" value="${s.zoom_url || ''}" placeholder="https://zoom.us/j/…"></label>
      <div class="cases">
        <label class="case"><input type="checkbox" name="epreuve" ${s.epreuve ? 'checked' : ''}> Épreuve notée (CCB, examen blanc)</label>
        ${nouvelle ? '' : html`<label class="case"><input type="checkbox" name="annulee" ${s.annulee ? 'checked' : ''}> Séance annulée</label>`}
      </div>
      ${casesPromos('promos', s.promos)}
      <fieldset class="cases"><legend>Groupes de rotation (aucun coché = toute la promo)</legend>
        ${groupes.length
          ? groupes.map(
              (g) => html`<label class="case" data-promo-groupe="${g.promo}"><input type="checkbox" name="groupes" value="${g.id}" ${s.groupes.includes(g.id) ? 'checked' : ''}> ${g.promo} · ${g.nom}</label>`
            )
          : html`<span class="aide">Aucun groupe créé (voir Comptes).</span>`}
      </fieldset>
      <h2 class="titre-section">Replay</h2>
      <div class="grille-2">
        <label class="champ"><span>Lien de l'enregistrement Zoom</span><input type="url" name="replay_url" value="${s.replay_url || ''}" placeholder="https://zoom.us/rec/share/…"></label>
        <label class="champ"><span>Durée (minutes)</span><input type="number" min="1" name="replay_duree_min" value="${s.replay_duree_min ?? ''}"></label>
      </div>
      <p class="erreur" role="alert" hidden></p>
      <div class="actions">
        <button class="btn plein" type="submit">Enregistrer</button>
        ${nouvelle ? '' : html`<button class="btn lien rouge" type="button" data-action="supprimer">Supprimer la séance</button>`}
      </div>
    </form>

    ${nouvelle
      ? html`<p class="aide">Enregistrez la séance pour pouvoir y déposer les supports et les diapos de correction.</p>`
      : html`<section class="carte pile">
          <h2 class="titre-section">Supports et diapos de correction (PDF)</h2>
          ${docs.length
            ? html`<div class="liste">${docs.map(
                (d) => html`<div class="ligne-info"><span>${d.type === 'support' ? 'Support' : 'Correction'} · ${d.titre}</span>
                  <button class="btn lien rouge" data-suppr-doc="${d.id}">Retirer</button></div>`
              )}</div>`
            : html`<p class="aide">Aucun document.</p>`}
          <form id="f-doc" class="grille-2">
            <label class="champ"><span>Type</span><select name="type"><option value="support">Support</option><option value="correction">Diapos de correction</option></select></label>
            <label class="champ"><span>Fichier PDF</span><input type="file" name="fichier" accept="application/pdf" required></label>
            <button class="btn contour" type="submit">Déposer</button>
          </form>
        </section>`}
  </div>`;

  function monter(el) {
    const form = el.querySelector('#f-seance');
    const erreur = form.querySelector('.erreur');
    const champAutre = form.querySelector('[data-autre]');
    form.lieu.addEventListener('change', () => (champAutre.hidden = form.lieu.value !== '__autre'));

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const d = new FormData(form);
      const debut = depuisChampsDate(d.get('date'), d.get('h_debut'));
      const finD = depuisChampsDate(d.get('date'), d.get('h_fin'));
      const lieu = d.get('lieu') === '__autre' ? String(d.get('lieu_autre')).trim() : d.get('lieu');
      const promos = d.getAll('promos').filter((p) => CODES_PROMOS.includes(p));
      erreur.hidden = true;
      const probleme = !promos.length ? 'Cochez au moins une promo.' : finD <= debut ? "L'heure de fin doit être après l'heure de début." : '';
      if (probleme) {
        erreur.textContent = probleme;
        erreur.hidden = false;
        return;
      }
      const donnees = {
        titre: String(d.get('titre')).trim(),
        matiere: String(d.get('matiere')).trim(),
        debut: debut.toISOString(),
        fin: finD.toISOString(),
        lieu,
        presentiel: lieu !== 'En ligne',
        zoom_url: String(d.get('zoom_url')).trim() || null,
        epreuve: d.has('epreuve'),
        annulee: d.has('annulee'),
        promos,
        // Un groupe n'est gardé que si sa promo est cochée.
        groupes: d.getAll('groupes').filter((gid) => promos.includes(groupes.find((g) => g.id === gid)?.promo)),
        replay_url: String(d.get('replay_url')).trim() || null,
        replay_duree_min: d.get('replay_duree_min') ? Number(d.get('replay_duree_min')) : null,
      };
      // Changement de salle, d'horaire ou annulation : signalé aux étudiants.
      if (!nouvelle) {
        const change =
          new Date(s.debut).getTime() !== debut.getTime() || new Date(s.fin).getTime() !== finD.getTime() || s.lieu !== lieu || s.annulee !== donnees.annulee;
        donnees.modifiee_le = change ? new Date().toISOString() : s.modifiee_le;
        donnees.id = s.id;
      }
      try {
        const enreg = await app.api.enregistrerSeance(donnees);
        app.message('Séance enregistrée.');
        app.naviguer(nouvelle ? `admin/seances/${enreg.id}` : 'admin/seances');
      } catch (err) {
        erreur.textContent = err.message;
        erreur.hidden = false;
      }
    });

    el.addEventListener('click', async (e) => {
      if (e.target.closest('[data-action=supprimer]') && confirm('Supprimer définitivement cette séance et ses documents ?')) {
        for (const doc of docs) await app.api.supprimerDocument(doc);
        await app.api.supprimerSeance(s.id);
        app.naviguer('admin/seances');
      }
      const idDoc = e.target.closest('[data-suppr-doc]')?.dataset.supprDoc;
      if (idDoc && confirm('Retirer ce document ?')) {
        await app.api.supprimerDocument(docs.find((x) => x.id === idDoc));
        app.rafraichir();
      }
    });

    el.querySelector('#f-doc')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const d = new FormData(e.target);
      const fichier = d.get('fichier');
      if (!fichier?.size) return;
      if (fichier.size > 50 * 1024 * 1024) return app.message('Fichier trop lourd (50 Mo maximum).', 'erreur');
      try {
        await app.api.ajouterDocument(s.id, d.get('type'), fichier);
        app.message('Document déposé.');
        app.rafraichir();
      } catch (err) {
        app.message(err.message, 'erreur');
      }
    });
  }

  return { html: vue, monter, titre: 'Séance' };
}
