// Cartes : fiches de révision en PDF, en deux onglets (fiches synthétiques
// et fiches LiSA), rangées par matière. Déposées par l'équipe
// (back-office › Fiches), chaque promo ne voit que les siennes.
import { html } from '../lib/html.js';
import { icones } from '../lib/icones.js';
import { estEquipe } from '../lib/acces.js';
import { enTete, etiquettesPromo, vide } from './commun.js';

export const TYPES_FICHES = [
  ['synthese', 'Fiches synthétiques', '#/cartes'],
  ['lisa', 'Fiches LiSA', '#/cartes/lisa'],
];

// Fiches rangées par matière (ordre alphabétique, sans matière en dernier).
export function grouperParMatiere(fiches) {
  const groupes = new Map();
  for (const f of fiches) {
    const m = f.matiere || 'Autres';
    if (!groupes.has(m)) groupes.set(m, []);
    groupes.get(m).push(f);
  }
  return [...groupes].sort(([a], [b]) => (a === 'Autres') - (b === 'Autres') || a.localeCompare(b, 'fr'));
}

// Ouvre un PDF dans un nouvel onglet (fenêtre ouverte tout de suite, sinon Safari la bloque).
export async function ouvrirPdf(app, chemin) {
  const fen = window.open('', '_blank');
  try {
    const url = await app.api.urlDocument(chemin);
    if (fen) fen.location = url;
    else location.href = url;
  } catch (err) {
    fen?.close();
    app.message(err.message, 'erreur');
  }
}

const sansAccents = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export async function vueCartes(app, { onglet = 'synthese' } = {}) {
  const toutes = await app.api.fiches();
  const fiches = toutes.filter((f) => f.type === onglet);
  const equipe = estEquipe(app.profil);
  const nomOnglet = TYPES_FICHES.find(([t]) => t === onglet)[1];

  const selecteur = html`<div class="segments" role="tablist">
    ${TYPES_FICHES.map(
      ([t, libelle, href]) => html`<a role="tab" href="${href}" class="segment${onglet === t ? ' actif' : ''}" aria-selected="${onglet === t}">${libelle}</a>`
    )}
  </div>`;

  const ligne = (f) => html`<button class="ligne-doc ligne-fiche" data-fiche="${f.chemin}" data-cherche="${sansAccents(`${f.titre} ${f.matiere} ${f.item ?? ''}`)}">
      ${icones.fichier(18)}
      <span class="pile-mini"><span>${f.titre}</span>${f.item ? html`<span class="aide">Item ${f.item}</span>` : ''}</span>
      ${equipe ? html`<span class="etiquettes">${etiquettesPromo(f.promos)}</span>` : ''}
    </button>`;

  const contenu = fiches.length
    ? html`<label class="champ"><span class="sr">Rechercher une fiche</span>
        <input type="search" data-recherche placeholder="Rechercher (titre, matière, n° d'item)" autocomplete="off"></label>
      ${grouperParMatiere(fiches).map(
        ([matiere, liste]) => html`<section class="pile-petite" data-matiere>
          <h2 class="surtitre">${matiere}</h2>
          <div class="carte liste">${liste.map(ligne)}</div>
        </section>`
      )}
      <div data-aucune hidden>${vide('Aucune fiche ne correspond à cette recherche.')}</div>`
    : vide(onglet === 'lisa' ? 'Aucune fiche LiSA pour le moment.' : 'Aucune fiche synthétique pour le moment.');

  function monter(el) {
    el.addEventListener('click', (e) => {
      const f = e.target.closest('[data-fiche]');
      if (f) ouvrirPdf(app, f.dataset.fiche);
    });
    const recherche = el.querySelector('[data-recherche]');
    recherche?.addEventListener('input', () => {
      const mots = sansAccents(recherche.value).split(/\s+/).filter(Boolean);
      let total = 0;
      for (const section of el.querySelectorAll('[data-matiere]')) {
        let n = 0;
        for (const l of section.querySelectorAll('[data-fiche]')) {
          const ok = mots.every((m) => l.dataset.cherche.includes(m));
          l.hidden = !ok;
          if (ok) n++;
        }
        section.hidden = !n;
        total += n;
      }
      el.querySelector('[data-aucune]').hidden = total > 0;
    });
  }

  return {
    monter,
    titre: `Cartes – ${nomOnglet}`,
    html: html`<div class="page">
      ${enTete('Cartes', app.profil)}
      ${selecteur}
      ${equipe ? html`<a class="lien-petit" href="#/admin/fiches">${icones.outils(14)} Déposer ou retirer des fiches (back-office)</a>` : ''}
      ${contenu}
    </div>`,
  };
}
