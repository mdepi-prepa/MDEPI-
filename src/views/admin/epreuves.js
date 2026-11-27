// Back-office : épreuves (CCB, examens blancs), groupe par groupe.
// Une épreuve est une séance cochée « Épreuve notée » : elle apparaît aussi
// dans le planning. Pour la même épreuve passée par plusieurs groupes à des
// dates différentes, créer une épreuve par groupe (bouton « Dupliquer »).
import { html } from '../../lib/html.js';
import { CODES_PROMOS, libellePromo } from '../../lib/promos.js';
import { dateCourte, plageHoraire } from '../../lib/dates.js';
import { enteteAdmin } from './index.js';
import { vide } from '../commun.js';

export async function vueAdminEpreuves(app) {
  const [seances, groupes] = await Promise.all([app.api.seances(), app.api.groupes()]);
  const maintenant = new Date();
  const epreuves = seances.filter((s) => s.epreuve);
  const nomsGroupes = (s) => {
    const noms = s.groupes.map((id) => groupes.find((g) => g.id === id)?.nom).filter(Boolean);
    return noms.length ? noms.join(', ') : 'Toute la promo';
  };

  const parPromo = CODES_PROMOS.map((p) => ({ p, liste: epreuves.filter((s) => s.promos.includes(p)) })).filter((x) => x.liste.length);

  const tableau = (liste) => html`<div class="tableau-defile"><table class="tableau">
    <thead><tr><th>Date</th><th>Épreuve</th><th>Groupe</th><th>Documents</th><th></th></tr></thead>
    <tbody>${liste.map(
      (s) => html`<tr class="${new Date(s.fin) <= maintenant ? 'passee' : ''}">
        <td>${dateCourte(s.debut)}<br><span class="aide">${plageHoraire(s.debut, s.fin)}</span></td>
        <td><a href="#/admin/seances/${s.id}"><strong>${s.titre}</strong></a><br><span class="aide">${s.lieu}</span>
          ${s.annulee ? html`<div class="etiquettes"><span class="etiquette annulee">Annulée</span></div>` : ''}</td>
        <td>${nomsGroupes(s)}</td>
        <td>${s._docs}</td>
        <td><a class="lien-petit" href="#/admin/seances/copie/${s.id}">Dupliquer</a></td>
      </tr>`
    )}</tbody></table></div>`;

  // Nombre de documents (sujet, correction) par épreuve.
  await Promise.all(
    epreuves.map(async (s) => {
      const docs = await app.api.documents(s.id).catch(() => []);
      const n = (t) => docs.filter((d) => d.type === t).length;
      s._docs = [n('sujet') && 'Sujet', n('correction') && 'Correction'].filter(Boolean).join(' + ') || '–';
    })
  );

  return {
    titre: 'Épreuves',
    html: html`<div class="page">
      ${enteteAdmin('Épreuves')}
      <p class="aide">Une épreuve par groupe et par date. Pour faire passer la même épreuve à un autre groupe, utilisez « Dupliquer » puis changez la date et le groupe. Sans groupe coché, l'épreuve concerne toute la promo.</p>
      <a class="btn plein" href="#/admin/epreuves/nouvelle">+ Nouvelle épreuve</a>
      ${parPromo.length
        ? parPromo.map(({ p, liste }) => html`<section class="pile-petite"><h2 class="titre-section">${libellePromo(p)}</h2>${tableau(liste)}</section>`)
        : vide('Aucune épreuve programmée.')}
    </div>`,
  };
}
