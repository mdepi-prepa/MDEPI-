// Accueil › Planning global : calendrier des épreuves de toutes les promos et
// de tous les groupes (intitulé, groupe, salle), pour voir les salles occupées.
import { html } from '../lib/html.js';
import { cleJour, plageHoraire, dateLongue } from '../lib/dates.js';
import { vide, etiquettesPromo, stylePromo } from './commun.js';
import { couleurPromo } from '../lib/promos.js';

const MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const JOURS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const cle = (a, m, j) => `${a}-${String(m + 1).padStart(2, '0')}-${String(j).padStart(2, '0')}`;

export function sectionPlanningGlobal() {
  return html`<section class="pile-petite" aria-label="Planning global des épreuves">
    <div class="ligne-haut"><h2 class="titre-section">Planning global</h2><span class="aide">Épreuves de tous les groupes</span></div>
    <div class="carte calendrier" data-calendrier><p class="aide">Chargement…</p></div>
  </section>`;
}

export function monterPlanningGlobal(el, app) {
  const zone = el.querySelector('[data-calendrier]');
  if (!zone) return;
  const [a0, m0] = cleJour(new Date()).split('-').map(Number);
  let annee = a0;
  let mois = m0 - 1;
  let choisi = cleJour(new Date());
  let parJour = new Map();
  const cache = new Map();

  async function charger() {
    const k = `${annee}-${mois}`;
    if (!cache.has(k)) {
      // Large d'un jour de chaque côté : les jours sont comptés à l'heure de Paris.
      const debut = new Date(Date.UTC(annee, mois, 1) - 86400000).toISOString();
      const fin = new Date(Date.UTC(annee, mois + 1, 1) + 86400000).toISOString();
      cache.set(k, await app.api.planningGlobal(debut, fin).catch(() => null));
    }
    const liste = cache.get(k);
    parJour = new Map();
    for (const e of liste || []) {
      const j = cleJour(e.debut);
      if (!parJour.has(j)) parJour.set(j, []);
      parJour.get(j).push(e);
    }
    return liste;
  }

  function dessiner(liste) {
    const premier = (new Date(Date.UTC(annee, mois, 1)).getUTCDay() + 6) % 7; // lundi = 0
    const nbJours = new Date(Date.UTC(annee, mois + 1, 0)).getUTCDate();
    const aujourdhui = cleJour(new Date());
    const cases = [];
    for (let i = 0; i < premier; i++) cases.push(null);
    for (let j = 1; j <= nbJours; j++) cases.push(j);
    const duJour = parJour.get(choisi) || [];
    zone.innerHTML = String(html`
      <div class="cal-haut">
        <button class="btn-icone" data-cal="prec" aria-label="Mois précédent">‹</button>
        <strong>${MOIS[mois]} ${annee}</strong>
        <button class="btn-icone" data-cal="suiv" aria-label="Mois suivant">›</button>
      </div>
      ${liste === null ? html`<p class="alerte attention">Planning indisponible pour le moment.</p>` : ''}
      <div class="cal-grille" role="grid">
        ${JOURS.map((j) => html`<span class="cal-entete" aria-hidden="true">${j}</span>`)}
        ${cases.map((j) => {
          if (!j) return html`<span></span>`;
          const k = cle(annee, mois, j);
          const n = (parJour.get(k) || []).length;
          return html`<button class="cal-jour${k === choisi ? ' choisi' : ''}${k === aujourdhui ? ' aujourdhui' : ''}${n ? ' occupe' : ''}" data-jour="${k}"
            aria-label="${j} ${MOIS[mois]}${n ? `, ${n} épreuve${n > 1 ? 's' : ''}` : ''}" aria-pressed="${k === choisi}">${j}${n ? html`<span class="cal-points">${[...new Set((parJour.get(k) || []).flatMap((e) => e.promos || []))].sort().map((p) => html`<i style="background: ${couleurPromo(p)}"></i>`)}</span>` : ''}</button>`;
        })}
      </div>
      <div class="cal-detail">
        <p class="surtitre">${dateLongue(choisi + 'T12:00:00Z')}</p>
        ${duJour.length
          ? html`<ul class="cal-liste">${duJour.map(
              (e) => html`<li class="teinte-promo" style="${stylePromo(e.promos || [])}">
                <span class="cal-heure">${plageHoraire(e.debut, e.fin)}</span>
                <span class="pile-mini"><strong>${e.titre}</strong>
                  <span class="etiquettes">${etiquettesPromo(e.promos || [], e.groupes || 'tous les groupes')}</span>
                  ${e.salle ? html`<span class="aide">${e.salle}</span>` : ''}</span>
              </li>`
            )}</ul>`
          : vide('Aucune épreuve ce jour-là.')}
      </div>`);
  }

  async function rafraichir() {
    dessiner(await charger());
  }

  zone.addEventListener('click', (e) => {
    const b = e.target.closest('[data-cal],[data-jour]');
    if (!b) return;
    if (b.dataset.jour) {
      choisi = b.dataset.jour;
      return dessiner(true);
    }
    mois += b.dataset.cal === 'suiv' ? 1 : -1;
    if (mois < 0) (mois = 11), annee--;
    if (mois > 11) (mois = 0), annee++;
    // Premier jour avec une épreuve du mois affiché, sinon le 1er.
    rafraichir().then(() => {
      const prefixe = cle(annee, mois, 1).slice(0, 8);
      const jours = [...parJour.keys()].filter((k) => k.startsWith(prefixe)).sort();
      choisi = prefixe === cleJour(new Date()).slice(0, 8) ? cleJour(new Date()) : jours[0] || cle(annee, mois, 1);
      dessiner(cache.get(`${annee}-${mois}`));
    });
  });
  rafraichir();
}
