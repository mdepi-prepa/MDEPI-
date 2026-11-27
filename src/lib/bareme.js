// Barème MDEPi (type EDN). Même calcul que la fonction SQL public.points
// (supabase/schema.sql, section 6) : les garder identiques.
//   QRM  : 0 discordance = 1 pt, 1 = 0,5, 2 = 0,2, 3 ou plus = 0 ;
//          aucune case cochée = 0 (décision de l'équipe, 27/11/2026)
//   QRU  : 1 pt si seule la bonne réponse est cochée
//   QROC : 1 pt si la réponse correspond à une réponse acceptée, avec la
//          correction automatique tolérante de qroc.js (fautes de frappe,
//          ordre des mots, synonymes…), sauf si l'équipe l'a refusée

import { corrigerQroc } from './qroc.js';

export function normaliser(t) {
  return String(t ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function discordances(propositions, bonnes, choix) {
  const c = new Set(choix || []);
  const b = new Set(bonnes || []);
  return propositions.filter((p) => c.has(p.id) !== b.has(p.id)).length;
}

export function points(question, correction, reponse) {
  const choix = reponse?.choix || [];
  if (question.type === 'QROC') {
    return corrigerQroc(reponse?.texte, correction.reponses_qroc, correction.refusees_qroc).juste ? 1 : 0;
  }
  if (!choix.length) return 0;
  const d = discordances(question.propositions, correction.bonnes, choix);
  if (question.type === 'QRU') return d === 0 ? 1 : 0;
  return [1, 0.5, 0.2][d] ?? 0;
}

// Verdict par proposition, pour la correction : Juste, Fausse (cochée à tort), Oubliée.
export function verdict(proposition, correction, reponse) {
  const coche = (reponse?.choix || []).includes(proposition.id);
  const bonne = (correction.bonnes || []).includes(proposition.id);
  if (coche && bonne) return 'juste';
  if (coche && !bonne) return 'fausse';
  if (!coche && bonne) return 'oubliee';
  return '';
}

export function noteSur20(totalPoints, nbQuestions) {
  return nbQuestions ? Math.round((2000 * totalPoints) / nbQuestions) / 100 : 0;
}

// « 14,25 »
export function formatNote(n) {
  return Number(n ?? 0).toLocaleString('fr-FR', { maximumFractionDigits: 2 });
}
