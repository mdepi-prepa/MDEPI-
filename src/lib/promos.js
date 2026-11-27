// Promos et couleurs d'accent (charte du cahier des charges).
export const PROMOS = {
  D1: { code: 'D1', annee: 'DFGSM3', couleur: '#1E8A4C' },
  D2: { code: 'D2', annee: 'DFASM1', couleur: '#1F5FD1' },
  D3: { code: 'D3', annee: 'DFASM2', couleur: '#C62B2B' },
  D4: { code: 'D4', annee: 'DFASM3', couleur: '#7A3FC4' },
};
export const CODES_PROMOS = Object.keys(PROMOS);

export function libellePromo(code) {
  const p = PROMOS[code];
  return p ? `${p.code} · ${p.annee}` : 'Équipe MDEPi';
}

// Style d'une séance aux couleurs de sa promo (bordure, étiquettes) :
// une seule promo → sa couleur ; plusieurs → noir.
export function stylePromo(promos) {
  const liste = Array.isArray(promos) ? promos : [promos];
  return `--c: ${liste.length === 1 ? couleurPromo(liste[0]) : '#141414'}`;
}

export function couleurPromo(code) {
  return PROMOS[code]?.couleur ?? '#141414';
}

// Adresses proposées dans le formulaire de séance.
export const LIEUX = ['94 rue Sainte-Cécile', '90 rue Sainte-Cécile', '106 rue Sainte-Cécile', 'En ligne'];
