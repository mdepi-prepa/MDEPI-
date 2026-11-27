// Outils communs aux QCM des épreuves : séries, lettres, images, exports.
import { assainir } from './qti.js';
import { pointsPonderes, coefficient, noteSur20 } from './bareme.js';
import { corrigerQroc, cle } from './qroc.js';

// Une épreuve dupliquée pour un autre groupe garde le même QCM : la « série »
// est l'id de la séance d'origine.
export const serieDe = (s) => s.serie || s.id;

export const lettre = (i) => String.fromCharCode(65 + i);

export const LIBELLES_TYPES = {
  QRU: 'Question à réponse unique',
  QRM: 'Question à réponses multiples',
  QRP: 'Question à réponses précisées',
  QROC: 'Question à réponse ouverte et courte',
};

// Liste à plat des questions d'un QCM, avec leur numéro dans le dossier.
export function aPlat(qcm) {
  const liste = [];
  qcm.forEach((d, di) =>
    d.questions.forEach((q, qi) => liste.push({ ...q, dossier: d, di, qi, num: liste.length + 1 }))
  );
  return liste;
}

// HTML d'une question stockée : ré-assaini, images en attente de leur lien.
export function htmlQcm(texte) {
  return assainir(texte).replace(/src="qcm-img:([^"]*)"/g, 'data-qcm-img="$1" alt=""');
}

// Remplace les images en attente par leur lien (temporaire côté Supabase).
export async function chargerImages(el, api) {
  const imgs = [...el.querySelectorAll('img[data-qcm-img]')];
  if (!imgs.length) return;
  const chemins = [...new Set(imgs.map((i) => i.dataset.qcmImg))];
  const urls = await api.urlsImages(chemins).catch(() => ({}));
  for (const i of imgs) if (urls[i.dataset.qcmImg]) i.src = urls[i.dataset.qcmImg];
}

// Remplace dans tout le QCM « qcm-img:<ancien> » par « qcm-img:<nouveau> ».
export function renommerImages(dossiers, renommage) {
  let json = JSON.stringify(dossiers);
  for (const [avant, apres] of Object.entries(renommage)) json = json.split(`qcm-img:${avant}"`).join(`qcm-img:${apres}"`).split(`qcm-img:${avant}\\"`).join(`qcm-img:${apres}\\"`);
  return JSON.parse(json);
}

// Images réellement utilisées par le QCM (évite d'envoyer le reste du ZIP).
export function imagesUtilisees(dossiers, images) {
  const json = JSON.stringify(dossiers);
  return Object.keys(images).filter((k) => json.includes(`qcm-img:${k}`));
}

export function nomImageStockage(serie, chemin, i) {
  const propre = chemin.split('/').pop().normalize('NFD').replace(/[^\w.-]+/g, '_');
  return `qcm/${serie}/${i}-${propre}`;
}

// Note d'une copie calculée dans le navigateur (mode démo, aperçus).
export function noterCopie(questions, corrections, reponses) {
  let total = 0;
  let pts = 0;
  for (const q of questions) {
    const c = corrections[q.id];
    if (!c) continue;
    total += coefficient(q);
    pts += pointsPonderes(q, c, reponses?.[q.id]);
  }
  return { points: Math.round(pts * 100) / 100, total, note20: noteSur20(pts, total) };
}

// Réponses de QROC à corriger par l'équipe (même règle que qroc_a_corriger,
// schema.sql) : groupes de réponses ni reconnues exactement, ni refusées, ni
// jugées acceptables, sur les questions ni neutralisées ni annulées.
export function qrocACorriger(questions, corrections, copies) {
  const vus = new Set();
  for (const q of questions) {
    if (q.type !== 'QROC' || (q.statut && q.statut !== 'normale')) continue;
    const c = corrections[q.id] || {};
    for (const cp of copies) {
      const t = cp.reponses.find((x) => x.question_id === q.id)?.texte;
      const m = corrigerQroc(t, c.reponses_qroc, c.refusees_qroc, c.partielles_qroc).mode;
      if (m === 'approche' || m === 'faux') vus.add(q.id + '|' + cle(t));
    }
  }
  return vus.size;
}

// Texte brut d'un énoncé HTML (exports CSV).
export function texteBrut(h) {
  const d = new DOMParser().parseFromString(String(h ?? '').replace(/<(br|\/p|\/div|\/li)[^>]*>/gi, ' $&'), 'text/html');
  return (d.body.textContent || '').replace(/\s+/g, ' ').trim();
}

// ---------- Exports CSV (séparateur « ; », lisible par Excel) ----------
function cellule(v) {
  let s = String(v ?? '');
  // Texte saisi par un étudiant commençant par = + - @ : Excel le prendrait
  // pour une formule (lien piégé…). Une apostrophe le garde en texte.
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function versCsv(lignes) {
  return '﻿' + lignes.map((l) => l.map(cellule).join(';')).join('\r\n');
}

export function telecharger(nom, contenu, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([contenu], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: nom });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const virgule = (n) => String(n ?? '').replace('.', ',');
const dateHeure = (d) => (d ? new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Paris' }) : '');

export function csvResultats(resultats) {
  return versCsv([
    ['Rang', 'Nom', 'Prénom', 'E-mail', 'Groupe', 'Commencée le', 'Rendue le', 'Points', 'Sur', 'Note /20'],
    ...resultats.map((r) => [r.rang, r.nom, r.prenom, r.email, r.groupe, dateHeure(r.commencee_le), dateHeure(r.rendue_le), virgule(r.points), r.total, virgule(r.note20)]),
  ]);
}

// Sauvegarde des copies : une ligne par étudiant et par question, avec les cases cochées.
export function csvCopies(qcm, corrections, resultats, copies) {
  const questions = aPlat(qcm);
  const lignes = [['Nom', 'Prénom', 'E-mail', 'Groupe', 'Dossier', 'Question', 'Type', 'Cases cochées', 'Réponse écrite', 'Validée', 'Bonnes réponses', 'Points', 'Modifiée le']];
  for (const r of resultats) {
    const copie = copies.find((c) => c.user_id === r.user_id && c.seance_id === r.seance_id);
    const rep = Object.fromEntries((copie?.reponses || []).map((x) => [x.question_id, x]));
    for (const q of questions) {
      const x = rep[q.id];
      const c = corrections[q.id] || {};
      const lettres = (ids) => q.propositions.map((p, i) => (ids?.includes(p.id) ? lettre(i) : '')).filter(Boolean).join(', ');
      lignes.push([
        r.nom, r.prenom, r.email, r.groupe, q.dossier.titre, `Q${q.qi + 1}`, q.type,
        lettres(x?.choix), x?.texte || '', x?.validee ? 'oui' : 'non',
        q.type === 'QROC' ? (c.reponses_qroc || []).join(' | ') : lettres(c.bonnes),
        virgule(c.bonnes || c.reponses_qroc ? pointsPonderes(q, c, x) : ''),
        dateHeure(x?.modifiee_le),
      ]);
    }
  }
  return versCsv(lignes);
}

// La question elle-même (« Q3 : … ») plutôt que tout le cas clinique.
export function questionCourte(h, max = 220) {
  const t = texteBrut(h);
  const m = t.match(/Q\d+\s*:.*$/);
  const r = m ? m[0] : t;
  return r.length > max ? '… ' + r.slice(-max) : r;
}
