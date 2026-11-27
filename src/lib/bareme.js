// Barème MDEPi (type EDN). Même calcul que la fonction SQL public.points
// (supabase/schema.sql, section 6) : les garder identiques.
//   QRM  : 0 discordance = 1 pt, 1 = 0,5, 2 = 0,2, 3 ou plus = 0 ;
//          aucune case cochée = 0 (décision de l'équipe, 27/11/2026)
//   QRU et QRM : proposition indispensable non cochée ou inacceptable cochée
//          = 0 à la question (comme Théia)
//   QRU  : 1 pt si seule la bonne réponse est cochée
//   QRP  : n réponses attendues (n cases au plus) : bonnes cochées ÷ n
//          (2 sur 3 = 0,67) ; aucune case = 0 ; indispensable / inacceptable = 0
//   QROC : 1 pt si la réponse correspond à une réponse acceptée, avec la
//          correction automatique tolérante de qroc.js (fautes de frappe,
//          ordre des mots, synonymes…), sauf si l'équipe l'a refusée ;
//          0,5 pt si l'équipe l'a jugée « acceptable » (demi-point)
// Chaque question a un coefficient (pondération Théia, 1 par défaut). Une
// question neutralisée rapporte tous ses points à tout le monde ; une
// question annulée est retirée de la note (comme Théia).

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

// Nombre de réponses attendues d'une QRP (n).
export const nbAttendues = (question, correction) => question.nb_reponses || (correction?.bonnes || []).length || 1;

// Points d'une question, de 0 à 1 (avant coefficient).
export function points(question, correction, reponse) {
  const choix = reponse?.choix || [];
  if (question.type === 'QROC') return pointsQroc(reponse?.texte, correction);
  if (!choix.length) return 0;
  if (fatale(correction, choix)) return 0;
  if (question.type === 'QRP') {
    const n = nbAttendues(question, correction);
    if (choix.length > n) return 0;
    const b = new Set(correction.bonnes || []);
    return choix.filter((id) => b.has(id)).length / n;
  }
  const d = discordances(question.propositions, correction.bonnes, choix);
  if (question.type === 'QRU') return d === 0 ? 1 : 0;
  return [1, 0.5, 0.2][d] ?? 0;
}

export function pointsQroc(texte, correction) {
  const r = corrigerQroc(texte, correction?.reponses_qroc, correction?.refusees_qroc, correction?.partielles_qroc);
  return r.juste ? 1 : r.mode === 'partielle' ? 0.5 : 0;
}

export const coefficient = (q) => (q.statut === 'annulee' ? 0 : Number(q.coefficient) || 1);

// Points comptés dans la note : coefficient × points ; neutralisée = tous les
// points ; annulée = 0 sur 0.
export function pointsPonderes(question, correction, reponse) {
  if (question.statut === 'annulee') return 0;
  if (question.statut === 'neutralisee') return coefficient(question);
  return coefficient(question) * points(question, correction, reponse);
}

// Indispensable oubliée ou inacceptable cochée (0 à la question).
export function fatale(correction, choix) {
  const c = new Set(choix || []);
  return (correction?.indispensables || []).some((id) => !c.has(id)) || (correction?.inacceptables || []).some((id) => c.has(id));
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
