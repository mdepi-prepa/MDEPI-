// @vitest-environment jsdom
// Import des fiches LiSA : lecture du fichier exporté, rangement par matière,
// et nettoyage du HTML (rien d'exécutable ne doit passer).
import { describe, it, expect } from 'vitest';
import { nettoyerHtml } from '../src/lib/html-sur.js';
import { lireExportLisa } from '../src/lib/lisa.js';
import { MATIERE_ITEM } from '../src/lib/lisa-matieres.js';
import { MATIERES } from '../src/lib/matieres.js';

const exportLisa = (items) =>
  `<!DOCTYPE html><html><head><title>LiSA 2026 · Fiches items</title></head><body><article id="view"></article>
  <script type="application/json" id="data">${JSON.stringify(items).replace(/</g, '\\u003c')}</script></body></html>`;

const ficheItem = (n, titre) => ({
  n,
  t: titre,
  u: `https://livret.uness.fr/lisa/2026/Fiche_LiSA:Item_${n}`,
  h: `<div class="mw-parser-output"><h1 class="d-none"><span class="mw-headline">${titre} complet IC-${n}</span></h1>
    <ul><li>Objectif un</li></ul><hr><div id="print-lisa-content"><div class="lisa-crossfield"></div>
    <p class="d-print-none h6 text-right"><a href="https://livret.uness.fr/x">Objectif un OIC-${n}-01-A</a></p>
    <div class="rang-A" style="overflow:auto;"><h2 class="lisa-print-title d-none d-print-block"><span class="mw-headline" id="x">Objectif un OIC-${n}-01-A</span></h2>
    <div class="navbox modele-oic"><table class="wikitable"><tr><th>Identifiant</th><td>OIC-${n}-01-A</td></tr><tr><th>Contributeurs</th><td>Dr X</td></tr></table></div>
    <p>Texte <b>gras</b> <img src="https://livret.uness.fr/lisa/2026/images/a.png" alt="schéma" onerror="alert(1)"></p></div>
    <div class="rang-B"><h2 class="lisa-print-title d-none">Objectif deux OIC-${n}-02-B</h2><p>Détail</p></div>
    <!-- commentaire --></div></div>`,
});

describe('classement des items LiSA par matière', () => {
  it('chaque item de 1 à 367 a une matière de la liste de l’app', () => {
    for (let n = 1; n <= 367; n++) expect(MATIERES).toContain(MATIERE_ITEM.get(n));
  });
});

describe('lecture du fichier LiSA « Fiches items »', () => {
  it('une fiche par item, avec numéro, matière, titre complet et contenu allégé', () => {
    const f = lireExportLisa(exportLisa([ficheItem(222, 'Facteurs de risque'), ficheItem(1, 'Relation médecin-malade ...')]));
    expect(f.map((x) => [x.item, x.cle, x.matiere])).toEqual([
      [1, 'lisa-1', 'Transversale'],
      [222, 'lisa-222', 'Cardiologie'],
    ]);
    expect(f[1].titre).toBe('Facteurs de risque');
    expect(f[0].titre).toBe('Relation médecin-malade ... complet'); // titre coupé : repris du h1
    const c = f[1].contenu;
    expect(c).toContain('<div class="rang-A">');
    expect(c).toContain('<h2>Objectif un</h2>');
    expect(c).toContain('<div class="rang-B">');
    expect(c).not.toMatch(/Contributeurs|OIC-|navbox|commentaire|onerror|<h1/);
    expect(c).toContain('<img src="https://livret.uness.fr/lisa/2026/images/a.png" alt="schéma"');
  });

  it('refuse le fichier des situations de départ et un fichier quelconque', () => {
    expect(() => lireExportLisa(exportLisa([{ n: 1, t: 'Constipation SDD-001', h: '<p>x</p>' }]))).toThrow(/situations de départ/);
    expect(() => lireExportLisa('<html><body>rien</body></html>')).toThrow(/pas un export LiSA/);
  });
});

describe('nettoyage du HTML importé', () => {
  it('retire scripts, attributs on…, liens javascript: et styles dangereux', () => {
    const sortie = nettoyerHtml(`<p onclick="x()">a<script>alert(1)</script></p>
      <a href="javascript:alert(1)">lien</a><a href="https://ok.fr/p">ok</a>
      <iframe src="https://mal.fr"></iframe><img src="http://non-https.fr/a.png"><img src="data:image/png;base64,AAA">
      <td style="background-color:#fff; position:fixed; background:url(https://x)">c</td>
      <form><input value="x"></form><svg><script>1</script></svg><custom-el>garde le texte</custom-el>`);
    expect(sortie).not.toMatch(/script|onclick|javascript|iframe|<img|position|url\(|<form|<input|<svg|custom-el/);
    expect(sortie).toContain('<a href="https://ok.fr/p" target="_blank" rel="noopener noreferrer">ok</a>');
    expect(sortie).toContain('garde le texte');
  });
});
