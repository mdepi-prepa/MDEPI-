// Cartes : fiches de révision en deux onglets (fiches synthétiques et fiches
// LiSA), rangées par matière. Une fiche est soit un PDF déposé par l'équipe,
// soit une fiche LiSA importée (lue dans l'app). Chaque promo ne voit que les siennes.
import { html, brut, urlSure, echapper } from '../lib/html.js';
import { icones } from '../lib/icones.js';
import { estEquipe } from '../lib/acces.js';
import { nettoyerHtml } from '../lib/html-sur.js';
import { enTete, etiquettesPromo, vide } from './commun.js';
import { matiereItem } from '../lib/lisa-matieres.js';

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
  // Fiches synthétiques MDEPi écrites dans l'app (une par item).
  if (onglet === 'synthese') {
    const { SYNTHESES } = await import('../data/syntheses.js');
    for (const sy of SYNTHESES) {
      fiches.push({ id: `s-${sy.item}`, titre: sy.titre, matiere: matiereItem(sy.item), item: sy.item, href: `#/synthese/${sy.item}`, promos: [] });
    }
  }
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
      ${equipe && f.promos.length ? html`<span class="etiquettes">${etiquettesPromo(f.promos)}</span>` : ''}
      ${f.chemin ? '' : icones.chevron(16)}`;
    // PDF : ouvert dans un nouvel onglet ; fiche LiSA : lue dans l'app.
    return f.chemin
      ? html`<button class="ligne-doc ligne-fiche" data-fiche="${f.chemin}" data-cherche="${cherche}">${corps}</button>`
      : html`<a class="ligne-doc ligne-fiche" href="${f.href || `#/fiche/${f.id}`}" data-cherche="${cherche}">${corps}</a>`;
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

// ---------- Fiche synthétique MDEPi : une fiche = un écran ----------

const BLOCS = {
  def: ['Définition', '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5M8 7h7"/>'],
  clinique: ['Diagnostic clinique', '<path d="M6 3v5a4 4 0 0 0 8 0V3"/><path d="M10 12v3a5 5 0 0 0 10 0v-2"/><circle cx="20" cy="11" r="2"/>'],
  examens: ['Examens complémentaires', '<path d="M9 3h6M10 3v6L5 19a1.5 1.5 0 0 0 1.3 2h11.4a1.5 1.5 0 0 0 1.3-2L14 9V3"/><path d="M7.5 15h9"/>'],
  urgence: ['Gravité · urgence', '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17v.5"/>'],
  traitement: ['Traitement', '<rect x="3" y="8" width="18" height="8" rx="4"/><path d="M12 8v8"/>'],
  retenir: ['À retenir', '<path d="M12 3a6 6 0 0 0-4 10.5V17h8v-3.5A6 6 0 0 0 12 3zM9 21h6"/>'],
};

// Texte d'une ligne : échappé, **gras** autorisé.
const enrichir = (t) => brut(echapper(t).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>'));

function ligneSynthese(t) {
  const b = t.startsWith('B:');
  return html`<li class="${b ? 'rang-b' : ''}">${b ? html`<span class="badge-b" title="Rang B">B</span>` : ''}${enrichir(b ? t.slice(2) : t)}</li>`;
}

export async function vueSynthese(app, { item }) {
  const { SYNTHESES } = await import('../data/syntheses.js');
  const n = Number(item);
  const i = SYNTHESES.findIndex((x) => x.item === n);
  const sy = SYNTHESES[i];
  if (!sy) {
    return { titre: 'Fiche', html: html`<div class="page">${enTete('Fiche', app.profil, '#/cartes')}${vide('Cette fiche synthétique n\'existe pas encore.')}</div>` };
  }
  // Fiche LiSA du même item (pour aller plus loin), si elle est importée.
  const lisa = (await app.api.fiches().catch(() => [])).find((f) => f.type === 'lisa' && f.item === n);
  const ordre = [...SYNTHESES].sort((a, b) => a.item - b.item);
  const pos = ordre.indexOf(sy);
  const prec = ordre[pos - 1];
  const suiv = ordre[pos + 1];

  const bloc = (b) => {
    const [titre, icone] = BLOCS[b.type] || BLOCS.def;
    return html`<section class="syn-bloc syn-${b.type}">
      <h3>${brut(`<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icone}</svg>`)}${b.titre || titre}</h3>
      <ul>${b.lignes.map(ligneSynthese)}</ul>
    </section>`;
  };

  // Ajuste la taille du texte pour que la fiche tienne dans l'écran.
  function ajuster(el) {
    const fiche = el.querySelector('[data-synthese]');
    if (!fiche) return;
    const nav = document.querySelector('.nav');
    const r = nav?.getBoundingClientRect();
    const basNav = r && r.top > innerHeight / 2 ? innerHeight - r.top : 0;
    const dispo = innerHeight - fiche.getBoundingClientRect().top - basNav - 10;
    // Plus grande taille (entre 11 et 17 px) pour laquelle tout tient.
    const tient = (t) => {
      fiche.style.setProperty('--t', `${t}px`);
      return fiche.getBoundingClientRect().height <= dispo;
    };
    let bas = 11;
    let haut = innerWidth >= 900 ? 20 : 17;
    if (tient(haut)) return;
    while (haut - bas > 0.25) {
      const m = (bas + haut) / 2;
      if (tient(m)) bas = m;
      else haut = m;
    }
    tient(bas);
  }

  function monter(el) {
    const fn = () => ajuster(el);
    requestAnimationFrame(fn);
    document.fonts?.ready.then(fn);
    addEventListener('resize', fn);
    const fin = new MutationObserver(() => {
      if (!el.isConnected) { removeEventListener('resize', fn); fin.disconnect(); }
    });
    fin.observe(document.body, { childList: true, subtree: true });
  }

  const nav = (s, sens) => s
    ? html`<a class="btn-icone" href="#/synthese/${s.item}" aria-label="${sens === 'prec' ? 'Fiche précédente' : 'Fiche suivante'} : item ${s.item}" title="Item ${s.item}">${sens === 'prec' ? icones.retour(18) : icones.chevron(18)}</a>`
    : html`<span class="btn-icone inactif" aria-hidden="true"></span>`;

  return {
    monter,
    titre: `Item ${sy.item} – fiche synthétique`,
    html: html`<div class="page page-synthese">
      <article class="synthese" data-synthese>
        <header class="syn-tete">
          <a class="btn-icone" href="#/cartes" aria-label="Retour aux fiches">${icones.retour(18)}</a>
          <span class="num-item">${sy.item}</span>
          <div class="syn-titre">
            <h1>${sy.titre}</h1>
            <p>${matiereItem(sy.item)}${lisa ? html` · <a href="#/fiche/${lisa.id}">Fiche LiSA complète ›</a>` : ''}</p>
          </div>
          <span class="syn-nav">${nav(prec, 'prec')}${nav(suiv, 'suiv')}</span>
        </header>
        ${sy.accroche ? html`<p class="syn-accroche">${enrichir(sy.accroche)}</p>` : ''}
        <div class="syn-blocs">${sy.blocs.map(bloc)}</div>
      </article>
    </div>`,
  };
}
