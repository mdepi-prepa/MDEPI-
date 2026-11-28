// Cartes : fiches de révision en deux onglets (fiches synthétiques et fiches
// LiSA), rangées par matière. Une fiche est soit un PDF déposé par l'équipe,
// soit une fiche LiSA importée (lue dans l'app). Chaque promo ne voit que les siennes.
import { html, brut, urlSure } from '../lib/html.js';
import { icones } from '../lib/icones.js';
import { estEquipe } from '../lib/acces.js';
import { nettoyerHtml } from '../lib/html-sur.js';
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

  const ligne = (f) => {
    const cherche = sansAccents(`${f.titre} ${f.matiere} ${f.item ?? ''}`);
    const corps = html`${f.item ? html`<span class="num-item" aria-label="Item ${f.item}">${f.item}</span>` : icones.fichier(18)}
      <span class="titre-fiche-liste">${f.titre}</span>
      ${equipe ? html`<span class="etiquettes">${etiquettesPromo(f.promos)}</span>` : ''}
      ${f.chemin ? '' : icones.chevron(16)}`;
    // PDF : ouvert dans un nouvel onglet ; fiche LiSA : lue dans l'app.
    return f.chemin
      ? html`<button class="ligne-doc ligne-fiche" data-fiche="${f.chemin}" data-cherche="${cherche}">${corps}</button>`
      : html`<a class="ligne-doc ligne-fiche" href="#/fiche/${f.id}" data-cherche="${cherche}">${corps}</a>`;
  };

  const groupes = grouperParMatiere(fiches);
  const ancre = (i) => `matiere-${i}`;
  const contenu = fiches.length
    ? html`<label class="champ"><span class="sr">Rechercher une fiche</span>
        <input type="search" data-recherche placeholder="Rechercher (titre, matière, n° d'item)" autocomplete="off"></label>
      ${groupes.length > 3
        ? html`<nav class="puces-matieres" aria-label="Aller à une matière">${groupes.map(
            ([matiere, liste], i) => html`<a href="#${ancre(i)}" data-ancre="${ancre(i)}" class="puce">${matiere} <span>${liste.length}</span></a>`
          )}</nav>`
        : ''}
      ${groupes.map(
        ([matiere, liste], i) => html`<section class="pile-petite" data-matiere id="${ancre(i)}">
          <h2 class="surtitre">${matiere} · ${liste.length}</h2>
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
        for (const l of section.querySelectorAll('[data-cherche]')) {
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

// Lecture d'une fiche LiSA dans l'app, avec filtre par rang (A / B).
export async function vueFiche(app, { id }) {
  const f = await app.api.fiche(id);
  const retour = f?.type === 'synthese' ? '#/cartes' : '#/cartes/lisa';
  if (!f) {
    return {
      titre: 'Fiche',
      html: html`<div class="page">${enTete('Fiche', app.profil, '#/cartes/lisa')}${vide('Cette fiche est introuvable ou ne vous est pas destinée.')}</div>`,
    };
  }
  const lien = urlSure(f.lien);
  const aDesRangs = /class="[^"]*rang-[AB]/.test(f.contenu || '');
  const corps = f.contenu
    ? html`<article class="fiche-contenu" data-contenu>${brut(nettoyerHtml(f.contenu))}</article>`
    : f.chemin
      ? html`<button class="btn plein" data-fiche="${f.chemin}">${icones.fichier(16)} Ouvrir le PDF</button>`
      : vide("Le contenu de cette fiche n'est pas disponible ici (mode démo : réimportez le fichier LiSA dans le back-office).");

  function monter(el) {
    el.addEventListener('click', (e) => {
      const pdf = e.target.closest('[data-fiche]');
      if (pdf) return ouvrirPdf(app, pdf.dataset.fiche);
      const b = e.target.closest('[data-rang]');
      if (!b) return;
      el.querySelectorAll('[data-rang]').forEach((x) => {
        x.classList.toggle('actif', x === b);
        x.setAttribute('aria-selected', String(x === b));
      });
      const article = el.querySelector('[data-contenu]');
      article.classList.toggle('seul-A', b.dataset.rang === 'A');
      article.classList.toggle('seul-B', b.dataset.rang === 'B');
    });
    // Image restée sur LiSA (accès réservé) : on la remplace par un lien.
    el.querySelectorAll('.fiche-contenu img').forEach((img) =>
      img.addEventListener('error', () => {
        const a = document.createElement('a');
        a.href = lien || img.src;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.className = 'image-absente';
        a.textContent = `Image à voir sur LiSA${img.alt ? ` : ${img.alt}` : ''}`;
        img.replaceWith(a);
      }, { once: true })
    );
  }

  return {
    monter,
    titre: f.item ? `Item ${f.item}` : f.titre,
    html: html`<div class="page">
      ${enTete(f.item ? `Item ${f.item}` : 'Fiche', app.profil, retour)}
      <div class="pile-mini">
        <h2 class="titre-fiche">${f.titre}</h2>
        <div class="etiquettes">
          <span class="etiquette accent">${f.type === 'lisa' ? 'Fiche LiSA' : 'Fiche synthétique'}</span>
          ${f.matiere ? html`<span class="etiquette">${f.matiere}</span>` : ''}
        </div>
      </div>
      ${aDesRangs
        ? html`<div class="segments segments-3" role="tablist" aria-label="Rang des connaissances">
            <button role="tab" class="segment actif" aria-selected="true" data-rang="tous">Tous rangs</button>
            <button role="tab" class="segment" aria-selected="false" data-rang="A">Rang A</button>
            <button role="tab" class="segment" aria-selected="false" data-rang="B">Rang B</button>
          </div>`
        : ''}
      ${corps}
      ${lien ? html`<a class="btn contour" href="${lien}" target="_blank" rel="noopener">Ouvrir sur LiSA ↗</a>` : ''}
    </div>`,
  };
}
