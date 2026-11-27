// Toutes les annonces ; les ouvrir les marque comme lues.
import { html } from '../lib/html.js';
import { dateLongue, heure } from '../lib/dates.js';
import { enTete, vide } from './commun.js';

export async function vueAnnonces(app) {
  const [annonces, lues] = await Promise.all([app.api.annonces(), app.api.annoncesLues()]);
  const nonLues = annonces.filter((a) => !lues.has(a.id)).map((a) => a.id);
  if (nonLues.length) app.api.marquerLues(nonLues).catch(() => {});

  return {
    titre: 'Annonces',
    html: html`<div class="page">
      ${enTete('Annonces', app.profil, '#/accueil')}
      ${annonces.length
        ? html`<div class="carte liste">${annonces.map(
            (a) => html`<article class="annonce">
              <span class="point${lues.has(a.id) ? ' lu' : ''}" aria-hidden="true"></span>
              <div class="annonce-texte">${!lues.has(a.id) ? html`<span class="etiquette accent">Nouveau</span> ` : ''}${a.texte}
                <div class="annonce-date">${dateLongue(a.publiee_le)} à ${heure(a.publiee_le)}</div></div>
            </article>`
          )}</div>`
        : vide('Aucune annonce.')}
    </div>`,
  };
}
