// Back-office : annonces.
import { html } from '../../lib/html.js';
import { CODES_PROMOS } from '../../lib/promos.js';
import { dateLongue, heure } from '../../lib/dates.js';
import { enteteAdmin } from './index.js';
import { vide } from '../commun.js';

export function casesPromos(nom, cochees = []) {
  return html`<fieldset class="cases"><legend>Promos concernées</legend>
    ${CODES_PROMOS.map(
      (c) => html`<label class="case"><input type="checkbox" name="${nom}" value="${c}" ${cochees.includes(c) ? 'checked' : ''}> ${c}</label>`
    )}</fieldset>`;
}

export async function vueAdminAnnonces(app) {
  const annonces = await app.api.annonces();
  const vue = html`<div class="page">
    ${enteteAdmin('Annonces')}
    <form class="carte pile" id="f-annonce">
      <h2 class="titre-section">Nouvelle annonce</h2>
      <label class="champ"><span>Texte</span><textarea name="texte" rows="3" maxlength="500" required></textarea></label>
      ${casesPromos('promos', CODES_PROMOS)}
      <button class="btn plein" type="submit">Publier</button>
    </form>
    <h2 class="titre-section">Publiées</h2>
    ${annonces.length
      ? html`<div class="carte liste">${annonces.map(
          (a) => html`<div class="annonce">
            <div class="annonce-texte">${a.texte}
              <div class="annonce-date">${a.promos.join(', ')} · ${dateLongue(a.publiee_le)} à ${heure(a.publiee_le)}</div></div>
            <button class="btn lien rouge" data-suppr="${a.id}">Supprimer</button>
          </div>`
        )}</div>`
      : vide('Aucune annonce.')}
  </div>`;

  function monter(el) {
    el.querySelector('#f-annonce').addEventListener('submit', async (e) => {
      e.preventDefault();
      const d = new FormData(e.target);
      const promos = d.getAll('promos');
      if (!promos.length) return app.message('Cochez au moins une promo.', 'erreur');
      try {
        await app.api.publierAnnonce(String(d.get('texte')).trim(), promos);
        app.message('Annonce publiée.');
        app.rafraichir();
      } catch (err) {
        app.message(err.message, 'erreur');
      }
    });
    el.addEventListener('click', async (e) => {
      const id = e.target.closest('[data-suppr]')?.dataset.suppr;
      if (id && confirm('Supprimer cette annonce ?')) {
        try {
          await app.api.supprimerAnnonce(id);
          app.rafraichir();
        } catch (err) {
          app.message(err.message, 'erreur');
        }
      }
    });
  }
  return { html: vue, monter, titre: 'Annonces' };
}
