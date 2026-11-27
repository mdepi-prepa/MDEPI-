// Icônes SVG (trait), reprises de la maquette.
import { brut } from './html.js';

const svg = (chemin, taille = 24, epaisseur = 1.8) =>
  brut(
    `<svg width="${taille}" height="${taille}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${epaisseur}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${chemin}</svg>`
  );

export const icones = {
  accueil: (t) => svg('<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>', t),
  planning: (t) => svg('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>', t),
  entrainement: (t) => svg('<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 3h6v3H9zM9 13l2 2 4-4"/>', t),
  cartes: (t) => svg('<rect x="3" y="7" width="14" height="14" rx="2"/><path d="M7 3h12a2 2 0 0 1 2 2v12"/>', t),
  progres: (t) => svg('<path d="M5 20V11M12 20V4M19 20v-6"/>', t),
  cloche: (t) => svg('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>', t),
  lieu: (t) => svg('<path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>', t),
  lecture: (t) => brut(`<svg width="${t || 18}" height="${t || 18}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>`),
  retour: (t) => svg('<path d="M15 6l-6 6 6 6"/>', t, 2),
  chevron: (t) => svg('<path d="M9 6l6 6-6 6"/>', t, 2),
  fichier: (t) => svg('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>', t),
  agenda: (t) => svg('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M12 13v5M9.5 15.5h5"/>', t),
  video: (t) => svg('<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3z"/>', t),
  reglages: (t) => svg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>', t),
  outils: (t) => svg('<path d="M4 6h16M4 12h16M4 18h10"/>', t),
  plus: (t) => svg('<path d="M12 5v14M5 12h14"/>', t, 2),
  fermer: (t) => svg('<path d="M6 6l12 12M18 6L6 18"/>', t, 2),
};
