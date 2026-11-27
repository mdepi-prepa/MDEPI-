// Petit moteur de gabarits : html`...` échappe automatiquement les valeurs
// insérées (protection contre l'injection de code). Pour insérer du HTML
// déjà sûr (un autre gabarit html`...`), il est conservé tel quel.

class SafeHtml {
  constructor(s) {
    this.s = s;
  }
  toString() {
    return this.s;
  }
}

export function echapper(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function valeur(v) {
  if (v == null || v === false) return '';
  if (v instanceof SafeHtml) return v.s;
  if (Array.isArray(v)) return v.map(valeur).join('');
  return echapper(v);
}

export function html(parties, ...valeurs) {
  let s = parties[0];
  valeurs.forEach((v, i) => {
    s += valeur(v) + parties[i + 1];
  });
  return new SafeHtml(s);
}

// HTML de confiance écrit dans le code (icônes SVG).
export function brut(s) {
  return new SafeHtml(s);
}

// N'accepte que les liens http(s) : évite les liens « javascript: ».
export function urlSure(u) {
  try {
    const url = new URL(u);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
  } catch {
    return '';
  }
}
