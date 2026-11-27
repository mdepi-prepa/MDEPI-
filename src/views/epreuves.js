// Épreuves (CCB, examens blancs) de l'étudiant : celles de sa promo et de
// son groupe de rotation. Une épreuve est une séance cochée « Épreuve notée ».
import { html } from '../lib/html.js';
import { icones } from '../lib/icones.js';
import { dateLongue, dateCourte, plageHoraire, compteARebours } from '../lib/dates.js';
import { estEquipe } from '../lib/acces.js';
import { enTete, etiquettes, vide } from './commun.js';
import { qcmLibre } from '../lib/qcm.js';

export async function vueEpreuves(app) {
  const [seances, groupes] = await Promise.all([app.api.seances(), app.api.groupes().catch(() => [])]);
  const maintenant = new Date();
  const epreuves = seances.filter((s) => s.epreuve && !qcmLibre(s));
  const aVenir = epreuves.filter((s) => new Date(s.fin) > maintenant);
  const passees = epreuves.filter((s) => new Date(s.fin) <= maintenant).reverse();
  const nomsGroupes = (s) => s.groupes.map((id) => groupes.find((g) => g.id === id)?.nom).filter(Boolean);
  const monGroupe = groupes.find((g) => g.id === app.profil.groupe_id);
  const equipe = estEquipe(app.profil);

  const cible = (s) => {
    const noms = nomsGroupes(s);
    return `${s.promos.join(', ')}${noms.length ? ' · ' + noms.join(', ') : ' · toute la promo'}`;
  };

  const carteAVenir = (s) => html`<a class="carte carte-epreuve${s.annulee ? ' est-annulee' : ''}" href="#/seance/${s.id}">
    <div class="ligne-haut">
      <span class="surtitre">${dateLongue(s.debut).toUpperCase()}</span>
      ${s.annulee ? '' : html`<span class="etiquette accent">${compteARebours(s.debut, s.fin, maintenant)}</span>`}
    </div>
    <span class="titre-epreuve">${s.titre}</span>
    <div class="infos">
      <div>${icones.planning(16)} ${plageHoraire(s.debut, s.fin)}</div>
      <div>${icones.lieu(16)} ${s.lieu}</div>
      ${equipe ? html`<div>${icones.reglages(16)} ${cible(s)}</div>` : ''}
    </div>
    <div class="etiquettes">${etiquettes(s)}</div>
  </a>`;

  const lignePassee = (s) => html`<a class="ligne-info" href="#/seance/${s.id}">
    <span class="pile-mini"><strong>${s.titre}</strong><span class="aide">${dateCourte(s.debut)}${equipe ? ` · ${cible(s)}` : ''}</span></span>
    <span class="lien-accent">Note et classement ${icones.chevron(14)}</span>
  </a>`;

  return {
    titre: 'Épreuves',
    html: html`<div class="page">
      ${enTete('Épreuves', app.profil)}
      ${!equipe && monGroupe ? html`<p class="aide">Épreuves de votre promo et de votre groupe (${monGroupe.nom}).</p>` : ''}
      <section class="pile-petite">
        <h2 class="titre-section">À venir</h2>
        ${aVenir.length ? aVenir.map(carteAVenir) : html`<div class="carte">${vide('Aucune épreuve programmée.')}</div>`}
      </section>
      <section class="pile-petite">
        <h2 class="titre-section">Passées</h2>
        ${passees.length ? html`<div class="carte liste">${passees.map(lignePassee)}</div>` : html`<div class="carte">${vide('Aucune épreuve passée.')}</div>`}
      </section>
    </div>`,
  };
}
