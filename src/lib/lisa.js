// Import du livret LiSA exporté en un seul fichier HTML (« LiSA 2026 ·
// Fiches items ») : une fiche par item du programme (1 à 367), rangée dans
// une matière de l'app (lisa-matieres.js) et étiquetée avec son numéro.
import { nettoyerHtml } from './html-sur.js';
import { matiereItem } from './lisa-matieres.js';

// Morceaux de la page LiSA qui n'ont pas d'intérêt pour l'étudiant :
// tableaux d'identification de chaque objectif (identifiant, contributeurs…),
// liens vers la page de l'objectif, éléments cachés à l'écran.
function alleger(html) {
  const doc = new DOMParser().parseFromString(`<!doctype html><body>${html}`, 'text/html');
  const corps = doc.body;
  corps.querySelector('h1')?.remove(); // titre de l'item (affiché par l'app)
  corps.querySelectorAll('.navbox, p.d-print-none, .magnify, .lisa-crossfield, .mw-cite-backlink').forEach((e) => e.remove());
  corps.querySelectorAll('.d-none:not(.lisa-print-title)').forEach((e) => e.remove());
  // Le titre d'un objectif garde son niveau (h2) mais perd ses ancres.
  corps.querySelectorAll('.mw-headline').forEach((e) => e.replaceWith(...e.childNodes));
  // Fin de titre « OIC-222-01-A » : identifiant technique, inutile ici.
  corps.querySelectorAll('h2, h3').forEach((h) => {
    const t = h.lastChild;
    if (t?.nodeType === 3) t.textContent = t.textContent.replace(/\s*OIC-\d+-\d+-[AB]\s*$/, '');
  });
  return corps.innerHTML;
}

// Titre complet : la liste du fichier coupe les plus longs (« ... »).
function titreComplet(item) {
  let t = String(item.t || '').trim();
  if (t.endsWith('...')) {
    const doc = new DOMParser().parseFromString(`<!doctype html><body>${item.h || ''}`, 'text/html');
    const h1 = doc.querySelector('h1')?.textContent.replace(/\s+/g, ' ').trim();
    if (h1) t = h1.replace(/\s*IC-\d+\s*$/, '');
  }
  return t.replace(/\s+/g, ' ');
}

// Lit le fichier exporté. Renvoie une fiche par item, ou lève une erreur
// claire si le fichier n'est pas le bon.
export function lireExportLisa(texte) {
  const doc = new DOMParser().parseFromString(String(texte || ''), 'text/html');
  const brut = doc.getElementById('data')?.textContent;
  if (!brut) throw new Error("Ce fichier n'est pas un export LiSA « Fiches items » (données introuvables).");
  let items;
  try {
    items = JSON.parse(brut);
  } catch {
    throw new Error('Le fichier LiSA est abîmé (données illisibles).');
  }
  if (!Array.isArray(items) || !items.length) throw new Error('Aucune fiche dans ce fichier LiSA.');
  if (items.some((it) => /\bSDD-\d+\s*$/.test(it.t || ''))) {
    throw new Error("Ce fichier contient les situations de départ (SDD) de LiSA, pas les fiches items : choisissez l'export « Fiches items ».");
  }
  const fiches = [];
  for (const it of items) {
    const n = Number(it.n);
    if (!Number.isInteger(n) || n < 1 || n > 999 || !it.h) continue;
    fiches.push({
      cle: `lisa-${n}`,
      type: 'lisa',
      item: n,
      titre: titreComplet(it),
      matiere: matiereItem(n),
      lien: /^https:\/\/livret\.uness\.fr\//.test(it.u || '') ? it.u : null,
      contenu: nettoyerHtml(alleger(it.h)),
    });
  }
  if (!fiches.length) throw new Error('Aucune fiche item reconnue dans ce fichier.');
  return fiches.sort((a, b) => a.item - b.item);
}
