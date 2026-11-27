// Correction automatique des QROC.
// Même calcul en SQL (supabase/schema.sql, fonctions cle_qroc et qroc_juste) :
// les garder identiques. Les cas de tests/qroc-cas.json sont vérifiés des deux côtés.
//
// Une réponse est juste si, après mise en forme (minuscules, sans accents ni
// ponctuation, sans articles, au singulier, synonymes ramenés à un seul mot) :
//   1. elle est identique à une réponse acceptée, ou contient les mêmes mots dans un autre ordre ;
//   2. ou les nombres sont identiques et le reste n'est que des unités (« 142 g/j » pour « 142 ») ;
//   3. ou elle n'en diffère que d'une faute de frappe (1 lettre dès 6 lettres,
//      2 lettres dès 12), sans chiffres, avec les 4 premières et les 3 dernières
//      lettres identiques (évite hypo/hyper, -ite/-ose) et sans négation ajoutée ou retirée.
// Une réponse que l'équipe a refusée reste fausse, même si elle est proche.

export const MOTS_VIDES = ['le', 'la', 'les', 'l', 'un', 'une', 'des', 'de', 'du', 'd', 'au', 'aux', 'a', 'en', 'et', 'par', 'pour', 'avec', 'sur'];
// Expressions ramenées à un seul mot (avant le découpage en mots).
export const EXPRESSIONS = [
  ['abdomino pelvien', 'abdominopelvien'],
  ['abdomino pelvienne', 'abdominopelvien'],
  ['abdominopelvienne', 'abdominopelvien'],
  ['abdo pelvien', 'abdominopelvien'],
];
// Synonymes mot à mot (abréviations courantes).
export const SYNONYMES = {
  tdm: 'scanner',
  tomodensitometrie: 'scanner',
  scanographie: 'scanner',
  ap: 'abdominopelvien',
  injecte: 'injection',
  injectee: 'injection',
  injectes: 'injection',
  injectees: 'injection',
  ecg: 'electrocardiogramme',
  echo: 'echographie',
  rx: 'radiographie',
  radio: 'radiographie',
  nfs: 'hemogramme',
  aigu: 'aigue',
  aigus: 'aigue',
  aigues: 'aigue',
};
export const UNITES = ['g', 'gramme', 'mg', 'kg', 'ml', 'cl', 'l', 'litre', 'j', 'jour', 'h', 'heure', 'min', 'minute', 'an', 'ans', 'semaine', 'mois', 'cm', 'mm', 'mmhg', 'ui', 'pourcent', 'pct', 'verre', 'unite'];
const NEGATIONS = ['sans', 'non', 'pas', 'absence'];

export function cle(texte) {
  let s = String(texte ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/%/g, ' pourcent ')
    .replace(/(\d),(\d)/g, '$1.$2')
    .replace(/[^a-z0-9.]+/g, ' ')
    .replace(/\.(?!\d)|(?<!\d)\./g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  for (const [a, b] of EXPRESSIONS) s = ` ${s} `.split(` ${a} `).join(` ${b} `).trim();
  return s
    .split(' ')
    .filter(Boolean)
    .map((m) => SYNONYMES[m] || m)
    .filter((m) => !MOTS_VIDES.includes(m))
    .map((m) => (m.length > 3 && /[sx]$/.test(m) && !/\d/.test(m) ? m.slice(0, -1) : m))
    .map((m) => SYNONYMES[m] || m)
    .join(' ');
}

export function distance(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 99;
  let prec = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prec[j] + 1, cur[j - 1] + 1, prec[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prec = cur;
  }
  return prec[b.length];
}

const mots = (k) => k.split(' ').filter(Boolean);
const nombres = (k) => mots(k).filter((m) => /^\d+(\.\d+)?$/.test(m));
const memesMots = (a, b) => mots(a).sort().join(' ') === mots(b).sort().join(' ');
const negation = (k) => mots(k).some((m) => NEGATIONS.includes(m));

// → { juste, mode: 'exact' | 'approche' | 'faux' | 'refusee' | 'vide', acceptee }
export function corrigerQroc(texte, acceptees = [], refusees = []) {
  const t = cle(texte);
  if (!t) return { juste: false, mode: 'vide' };
  if ((refusees || []).some((r) => cle(r) === t)) return { juste: false, mode: 'refusee' };
  const cles = (acceptees || []).map((a) => [a, cle(a)]).filter(([, k]) => k);
  for (const [a, k] of cles) if (k === t || memesMots(k, t)) return { juste: true, mode: 'exact', acceptee: a };
  for (const [a, k] of cles) {
    const nk = nombres(k);
    const nt = nombres(t);
    if (nk.length && nk.join(' ') === nt.join(' ') && mots(t).every((m) => nt.includes(m) || UNITES.includes(m) || mots(k).includes(m))) {
      return { juste: true, mode: 'approche', acceptee: a };
    }
  }
  if (!/\d/.test(t)) {
    for (const [a, k] of cles) {
      if (/\d/.test(k) || negation(k) !== negation(t) || k.slice(0, 4) !== t.slice(0, 4) || k.slice(-3) !== t.slice(-3)) continue;
      const tol = k.length >= 12 ? 2 : k.length >= 6 ? 1 : 0;
      if (tol && distance(t, k) <= tol) return { juste: true, mode: 'approche', acceptee: a };
    }
  }
  return { juste: false, mode: 'faux' };
}
