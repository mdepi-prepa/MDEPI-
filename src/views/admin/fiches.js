// Back-office : fiches de révision (onglet Cartes de l'app).
import { html } from '../../lib/html.js';
import { CODES_PROMOS } from '../../lib/promos.js';
import { MATIERES } from '../../lib/matieres.js';
import { enteteAdmin } from './index.js';
import { casesPromos } from './annonces.js';
import { vide, etiquettesPromo } from '../commun.js';
import { TYPES_FICHES, grouperParMatiere, ouvrirPdf } from '../cartes.js';

export async function vueAdminFiches(app) {
  const fiches = await app.api.fiches();

  const ligne = (f) => html`<div class="ligne-info">
      <span class="pile-mini">
        <button class="btn lien" type="button" data-ouvrir="${f.chemin}">${f.titre}</button>
        ${f.item ? html`<span class="aide">Item ${f.item}</span>` : ''}
        <span class="etiquettes">${etiquettesPromo(f.promos)}</span>
      </span>
      <button class="btn lien rouge" data-suppr="${f.id}">Retirer</button>
    </div>`;

  const liste = (type, libelle) => {
    const d = fiches.filter((f) => f.type === type);
    return html`<section class="pile-petite">
      <h2 class="titre-section">${libelle} (${d.length})</h2>
      ${d.length
        ? grouperParMatiere(d).map(
            ([m, l]) => html`<h3 class="surtitre">${m}</h3><div class="carte liste">${l.map(ligne)}</div>`
          )
        : vide('Aucune fiche déposée.')}
    </section>`;
  };

  const vue = html`<div class="page">
    ${enteteAdmin('Fiches')}
    <form class="carte pile" id="f-fiche">
      <h2 class="titre-section">Déposer des fiches</h2>
      <fieldset class="cases"><legend>Onglet</legend>
        ${TYPES_FICHES.map(
          ([t, libelle], i) => html`<label class="case"><input type="radio" name="type" value="${t}" ${i === 0 ? 'checked' : ''}> ${libelle}</label>`
        )}
      </fieldset>
      <div class="grille-2">
        <label class="champ"><span>Matière</span>
          <select name="matiere" required>
            <option value="">Choisir…</option>
            ${MATIERES.map((m) => html`<option>${m}</option>`)}
          </select></label>
        <label class="champ"><span>N° d'item (facultatif)</span><input name="item" type="number" min="1" max="999" inputmode="numeric" placeholder="Ex. 247"></label>
      </div>
      <label class="champ"><span>Titre (facultatif : sinon, le nom du fichier)</span><input name="titre" maxlength="200" placeholder="Ex. Diabète de type 2"></label>
      ${casesPromos('promos', CODES_PROMOS)}
      <label class="champ"><span>Fichier(s) PDF</span><input type="file" name="fichiers" accept="application/pdf" multiple required></label>
      <p class="aide">Vous pouvez choisir plusieurs PDF d'un coup : ils prennent tous la même matière, le même item et les mêmes promos, et chacun garde le nom de son fichier comme titre.</p>
      <button class="btn plein" type="submit">Déposer</button>
    </form>
    ${TYPES_FICHES.map(([t, libelle]) => liste(t, libelle))}
  </div>`;

  function monter(el) {
    const form = el.querySelector('#f-fiche');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const d = new FormData(form);
      const promos = d.getAll('promos');
      if (!promos.length) return app.message('Cochez au moins une promo.', 'erreur');
      const fichiers = d.getAll('fichiers').filter((f) => f && f.size);
      if (!fichiers.length) return app.message('Choisissez au moins un fichier PDF.', 'erreur');
      const titre = String(d.get('titre') || '').trim();
      const item = Number(d.get('item')) || null;
      const bouton = form.querySelector('[type=submit]');
      bouton.disabled = true;
      let deposees = 0;
      try {
        for (const fichier of fichiers) {
          bouton.textContent = `Envoi ${deposees + 1}/${fichiers.length}…`;
          await app.api.ajouterFiche(
            {
              type: d.get('type'),
              titre: (fichiers.length === 1 && titre) || fichier.name.replace(/\.pdf$/i, ''),
              matiere: d.get('matiere'),
              item,
              promos,
            },
            fichier
          );
          deposees++;
        }
        app.message(deposees > 1 ? `${deposees} fiches déposées.` : 'Fiche déposée.');
        app.rafraichir();
      } catch (err) {
        app.message(deposees ? `${deposees} fiche(s) déposée(s), puis erreur : ${err.message}` : err.message, 'erreur');
        if (deposees) app.rafraichir();
        else {
          bouton.disabled = false;
          bouton.textContent = 'Déposer';
        }
      }
    });
    el.addEventListener('click', async (e) => {
      const ouvrir = e.target.closest('[data-ouvrir]');
      if (ouvrir) return ouvrirPdf(app, ouvrir.dataset.ouvrir);
      const id = e.target.closest('[data-suppr]')?.dataset.suppr;
      if (!id) return;
      const f = fiches.find((x) => x.id === id);
      if (!confirm(`Retirer la fiche « ${f?.titre} » ? Les étudiants ne la verront plus.`)) return;
      try {
        await app.api.supprimerFiche(f);
        app.message('Fiche retirée.');
        app.rafraichir();
      } catch (err) {
        app.message(err.message, 'erreur');
      }
    });
  }
  return { html: vue, monter, titre: 'Fiches' };
}
