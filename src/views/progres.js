// Progrès.
// Étudiant : ses notes d'épreuve (conférences annuelles), avec la moyenne de
// sa promo, de son groupe et son rang ; l'évolution d'une épreuve à l'autre ;
// les matières à retravailler (d'après ses copies) ; ses entraînements.
// Équipe : moyennes de chaque épreuve par promo et par groupe de rotation.
import { html } from '../lib/html.js';
import { dateCourte } from '../lib/dates.js';
import { formatNote, noteSur20, pointsPonderes, coefficient } from '../lib/bareme.js';
import { estEquipe } from '../lib/acces.js';
import { aPlat, qcmLibre, serieDe, CATEGORIES, categorieDe } from '../lib/qcm.js';
import { enTete, vide } from './commun.js';

const moyenne = (l) => (l.length ? Math.round((100 * l.reduce((a, x) => a + x, 0)) / l.length) / 100 : null);
const signe = (n) => (n > 0 ? '+' : n < 0 ? '−' : '') + formatNote(Math.abs(Math.round(n * 100) / 100));

export async function vueProgres(app) {
  const seances = await app.api.seances();
  const maintenant = new Date();
  // Épreuves notées terminées, une par série (la sienne pour un étudiant).
  const finies = seances.filter((s) => s.epreuve && !qcmLibre(s) && !s.annulee && new Date(s.fin) <= maintenant);
  return estEquipe(app.profil) ? progresEquipe(app, finies) : progresEtudiant(app, finies, seances);
}

// ---------- Équipe ----------
async function progresEquipe(app, finies) {
  const vues = new Set();
  const series = finies.reverse().filter((s) => !vues.has(serieDe(s)) && vues.add(serieDe(s)));
  const moyennes = await Promise.all(series.map((s) => app.api.moyennesEpreuve(s.id).catch(() => [])));
  const lignes = series.map((s, i) => ({ s, m: moyennes[i] })).filter((x) => x.m.length);
  const promos = [...new Set(lignes.flatMap((x) => x.m.map((m) => m.promo)))].sort();

  const tableau = ({ s, m }) => html`<section class="carte pile-petite">
    <div class="pile-mini"><strong>${s.titre}</strong><span class="aide">${s.matiere ? s.matiere + ' · ' : ''}${dateCourte(s.debut)}</span></div>
    <div class="tableau-defile"><table class="tableau">
      <thead><tr><th>Promo / groupe</th><th>Moyenne</th><th>Copies</th></tr></thead>
      <tbody>${m.map(
        (r) => html`<tr class="${r.groupe_id ? '' : 'ligne-promo'}"><td>${r.groupe_id ? html`<span class="retrait">${r.groupe}</span>` : html`<strong>${r.promo}</strong>`}</td>
          <td><strong>${formatNote(r.moyenne)}</strong>/20</td><td>${r.effectif}</td></tr>`
      )}</tbody></table></div>
  </section>`;

  // Synthèse : moyenne des moyennes de chaque promo et de chaque groupe, toutes épreuves confondues.
  const synthese = promos.map((promo) => {
    const parPromo = lignes.map((x) => x.m.find((r) => r.promo === promo && !r.groupe_id)).filter(Boolean);
    const groupes = new Map();
    for (const x of lignes) for (const r of x.m) if (r.promo === promo && r.groupe_id) groupes.set(r.groupe_id, [...(groupes.get(r.groupe_id) || []), r]);
    return {
      promo,
      moy: moyenne(parPromo.map((r) => r.moyenne)),
      n: parPromo.length,
      groupes: [...groupes.values()].map((l) => ({ nom: l[0].groupe, moy: moyenne(l.map((r) => r.moyenne)), n: l.length })).sort((a, b) => a.nom.localeCompare(b.nom, 'fr')),
    };
  });

  return {
    titre: 'Progrès',
    html: html`<div class="page">
      ${enTete('Progrès', app.profil)}
      <p class="aide">Moyennes des épreuves notées terminées, par promo et par groupe de rotation (copies des étudiants actuellement rattachés à ce groupe).</p>
      ${lignes.length
        ? html`<section class="carte pile-petite">
              <h2 class="titre-section">Synthèse</h2>
              <div class="tableau-defile"><table class="tableau">
                <thead><tr><th>Promo / groupe</th><th>Moyenne</th><th>Épreuves</th></tr></thead>
                <tbody>${synthese.map(
                  (p) => html`<tr class="ligne-promo"><td><strong>${p.promo}</strong></td><td><strong>${formatNote(p.moy)}</strong>/20</td><td>${p.n}</td></tr>
                    ${p.groupes.map((g) => html`<tr><td><span class="retrait">${g.nom}</span></td><td>${formatNote(g.moy)}/20</td><td>${g.n}</td></tr>`)}`
                )}</tbody></table></div>
            </section>
            <h2 class="titre-section">Par épreuve</h2>
            ${lignes.map(tableau)}`
        : html`<div class="carte">${vide('Les moyennes apparaîtront ici dès la fin de la première épreuve notée.')}</div>`}
    </div>`,
  };
}

// ---------- Étudiant ----------
async function progresEtudiant(app, finies, seances) {
  const p = app.profil;
  const resultats = await Promise.all(finies.map((s) => app.api.monResultat(s.id).catch(() => null)));
  const notees = finies.map((s, i) => ({ s, r: resultats[i] })).filter((x) => x.r);
  const [moyennes, details, tentatives] = await Promise.all([
    Promise.all(notees.map((x) => app.api.moyennesEpreuve(x.s.id).catch(() => []))),
    Promise.all(notees.map((x) => Promise.all([app.api.qcm(x.s.id), app.api.corrections(x.s.id), app.api.maCopie(x.s.id)]).catch(() => null))),
    app.api.mesEntrainements().catch(() => []),
  ]);
  notees.forEach((x, i) => {
    x.promo = moyennes[i].find((m) => m.promo === p.promo && !m.groupe_id);
    x.groupe = p.groupe_id ? moyennes[i].find((m) => m.groupe_id === p.groupe_id) : null;
  });

  // Réussite par matière, d'après les copies d'épreuve (dossier, sinon matière de l'épreuve).
  const parMatiere = new Map();
  notees.forEach((x, i) => {
    const d = details[i];
    if (!d) return;
    const [qcm, corrections, copie] = d;
    for (const q of aPlat(qcm)) {
      const max = coefficient(q);
      if (!max || !corrections[q.id]) continue;
      const m = q.dossier.matiere || x.s.matiere || 'Autre';
      const e = parMatiere.get(m) || { pts: 0, max: 0, n: 0 };
      e.pts += pointsPonderes(q, corrections[q.id], copie?.reponses?.[q.id]);
      e.max += max;
      e.n += 1;
      parMatiere.set(m, e);
    }
  });
  const matieres = [...parMatiere.entries()]
    .map(([nom, e]) => ({ nom, taux: Math.round((100 * e.pts) / e.max), n: e.n }))
    .filter((m) => m.nom !== 'Toutes matières')
    .sort((a, b) => a.taux - b.taux);

  const notes = notees.map((x) => x.r.note20);
  const ecarts = notees.filter((x) => x.promo).map((x) => x.r.note20 - x.promo.moyenne);
  const meilleurRang = notees.length ? notees.reduce((a, x) => (x.r.rang < a.r.rang ? x : a)) : null;
  const chrono = [...notees].sort((a, b) => a.s.debut.localeCompare(b.s.debut));

  // Entraînement : par onglet.
  const parSerie = new Map(seances.map((s) => [serieDe(s), s]));
  const entr = Object.keys(CATEGORIES).map((cat) => {
    const t = tentatives.filter((e) => categorieDe(parSerie.get(e.serie_id) || {}) === cat);
    return { cat, n: t.length, moy: moyenne(t.map((e) => noteSur20(Number(e.points), e.total))) };
  });

  return {
    titre: 'Progrès',
    html: html`<div class="page">
      ${enTete('Progrès', p)}
      ${notees.length
        ? html`<section class="carte pile-petite">
              <h2 class="titre-section">En résumé</h2>
              <dl class="chiffres">
                <div><dt>Ma moyenne</dt><dd>${formatNote(moyenne(notes))}/20</dd></div>
                <div><dt>Épreuves notées</dt><dd>${notees.length}</dd></div>
                ${ecarts.length ? html`<div><dt>Écart à la promo</dt><dd class="${moyenne(ecarts) >= 0 ? 'c-ok' : 'c-ko'}">${signe(moyenne(ecarts))} pt</dd></div>` : ''}
                <div><dt>Meilleur rang</dt><dd>${meilleurRang.r.rang}<span class="aide"> / ${meilleurRang.r.effectif}</span></dd></div>
              </dl>
            </section>

            <section class="pile-petite">
              <h2 class="titre-section">Mes notes</h2>
              ${[...chrono].reverse().map((x) => {
                const i = chrono.indexOf(x);
                const avant = i > 0 ? chrono[i - 1].r.note20 : null;
                return html`<a class="carte pile-mini ligne-progres" href="#/epreuve/${x.s.id}">
                  <div class="ligne-progres-haut">
                    <span class="pile-mini"><strong>${x.s.titre}</strong><span class="aide">${x.s.matiere ? x.s.matiere + ' · ' : ''}${dateCourte(x.s.debut)}</span></span>
                    <span class="note-progres"><strong>${formatNote(x.r.note20)}</strong><span class="aide">/20</span>
                      ${avant !== null ? html`<span class="aide ${x.r.note20 >= avant ? 'c-ok' : 'c-ko'}">${x.r.note20 >= avant ? '▲' : '▼'} ${signe(x.r.note20 - avant)}</span>` : ''}</span>
                  </div>
                  <dl class="chiffres petits">
                    <div><dt>Promo ${p.promo}</dt><dd>${x.promo ? formatNote(x.promo.moyenne) : formatNote(x.r.moyenne)}/20</dd></div>
                    ${x.groupe ? html`<div><dt>${x.groupe.groupe}</dt><dd>${formatNote(x.groupe.moyenne)}/20</dd></div>` : ''}
                    <div><dt>Rang</dt><dd>${x.r.rang} / ${x.r.effectif}</dd></div>
                  </dl>
                </a>`;
              })}
            </section>

            ${matieres.length
              ? html`<section class="carte pile-petite">
                  <h2 class="titre-section">Matières à retravailler</h2>
                  <p class="aide">Points obtenus sur les points possibles, par matière, dans vos copies d'épreuve.</p>
                  <ul class="liste-matieres">${matieres.map(
                    (m) => html`<li><span>${m.nom} <span class="aide">· ${m.n} question${m.n > 1 ? 's' : ''}</span></span><strong class="${m.taux < 50 ? 'c-ko' : m.taux >= 75 ? 'c-ok' : ''}">${m.taux} %</strong></li>`
                  )}</ul>
                </section>`
              : ''}`
        : html`<div class="carte">${vide('Vos notes apparaîtront ici dès que les résultats de votre première épreuve seront publiés.')}</div>`}

      <section class="carte pile-petite">
        <h2 class="titre-section">Entraînement</h2>
        <dl class="chiffres">${entr.map(
          (e) => html`<div><dt>${CATEGORIES[e.cat]}</dt><dd>${e.n ? html`${e.n} tentative${e.n > 1 ? 's' : ''}<span class="aide"> · moy. ${formatNote(e.moy)}/20</span>` : html`<span class="aide">Aucune tentative</span>`}</dd></div>`
        )}</dl>
        <a class="lien-accent" href="#/entrainement">S'entraîner</a>
      </section>
    </div>`,
  };
}
