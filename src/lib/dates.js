// Dates en français, heure de Paris.
const TZ = 'Europe/Paris';

const fmt = (options) => new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, ...options });
const fJourSemaineCourt = fmt({ weekday: 'short' });
const fJour = fmt({ day: 'numeric' });
const fMoisAnnee = fmt({ month: 'long', year: 'numeric' });
const fDateLongue = fmt({ weekday: 'long', day: 'numeric', month: 'long' });
const fDateCourte = fmt({ day: 'numeric', month: 'short' });
const fHeure = fmt({ hour: 'numeric', minute: '2-digit' });

const d = (x) => (x instanceof Date ? x : new Date(x));

// « 18h30 », « 9h »
export function heure(x) {
  const parts = fHeure.formatToParts(d(x));
  // « 09 » → « 9 », mais minuit reste « 0 » (et non une heure vide : « h25 »).
  const h = parts.find((p) => p.type === 'hour').value.replace(/^0(?=\d)/, '');
  const m = parts.find((p) => p.type === 'minute').value;
  return m === '00' ? `${h}h` : `${h}h${m}`;
}

export function plageHoraire(debut, fin) {
  return `${heure(debut)} – ${heure(fin)}`;
}

const capitaliser = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// « Mardi 1 décembre »
export function dateLongue(x) {
  return capitaliser(fDateLongue.format(d(x)));
}

// « 24 nov. »
export function dateCourte(x) {
  return fDateCourte.format(d(x));
}

// « Mar », « 1 »
export function jourSemaineCourt(x) {
  return capitaliser(fJourSemaineCourt.format(d(x)).replace('.', ''));
}
export function numeroJour(x) {
  return fJour.format(d(x));
}

// « DÉCEMBRE 2026 »
export function moisAnnee(x) {
  return fMoisAnnee.format(d(x)).toUpperCase();
}

// Clé AAAA-MM-JJ du jour à Paris (pour comparer des jours calendaires).
export function cleJour(x) {
  return fmt({ year: 'numeric', month: '2-digit', day: '2-digit' }).format(d(x)).split('/').reverse().join('-');
}

// « En cours », « Aujourd'hui », « Demain », « Dans 4 jours », « Terminée »
export function compteARebours(debut, fin, maintenant = new Date()) {
  const dd = d(debut);
  const df = d(fin);
  if (maintenant >= df) return 'Terminée';
  if (maintenant >= dd) return 'En cours';
  const jours = Math.round((Date.parse(cleJour(dd)) - Date.parse(cleJour(maintenant))) / 86400000);
  if (jours === 0) return "Aujourd'hui";
  if (jours === 1) return 'Demain';
  return `Dans ${jours} jours`;
}

// Le lien Zoom devient actif 15 minutes avant le début, jusqu'à la fin.
export const AVANCE_ZOOM_MIN = 15;
export function zoomActif(debut, fin, maintenant = new Date()) {
  return maintenant >= new Date(d(debut).getTime() - AVANCE_ZOOM_MIN * 60000) && maintenant < d(fin);
}

// Regroupe une liste déjà triée par mois : [{ mois, elements }]
export function grouperParMois(liste, cle = (x) => x.debut) {
  const groupes = [];
  for (const el of liste) {
    const mois = moisAnnee(cle(el));
    const dernier = groupes[groupes.length - 1];
    if (dernier && dernier.mois === mois) dernier.elements.push(el);
    else groupes.push({ mois, elements: [el] });
  }
  return groupes;
}

// « 2 h 52 »
export function duree(minutes) {
  if (!minutes) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
}

// « il y a 2 h », « 3 j »
export function ilYA(x, maintenant = new Date()) {
  const s = Math.max(0, (maintenant - d(x)) / 1000);
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min`;
  if (s < 86400) return `${Math.round(s / 3600)} h`;
  if (s < 86400 * 30) return `${Math.round(s / 86400)} j`;
  return dateCourte(x);
}

// Pour les champs <input type="date"> et <input type="time"> (heure de Paris).
export function versChampsDate(x) {
  const parts = fmt({ year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d(x));
  const v = (t) => parts.find((p) => p.type === t).value;
  return { date: `${v('year')}-${v('month')}-${v('day')}`, heure: `${v('hour')}:${v('minute')}` };
}

// Inverse : date « 2026-12-01 » + heure « 18:30 » à Paris → Date.
export function depuisChampsDate(date, heureTxt) {
  const [a, mo, j] = date.split('-').map(Number);
  const [h, mi] = heureTxt.split(':').map(Number);
  // On part de l'heure UTC puis on corrige du décalage de Paris à cet instant.
  const approx = Date.UTC(a, mo - 1, j, h, mi);
  const decalage = (t) => {
    const p = versChampsDate(new Date(t));
    const [pa, pmo, pj] = p.date.split('-').map(Number);
    const [ph, pmi] = p.heure.split(':').map(Number);
    return Date.UTC(pa, pmo - 1, pj, ph, pmi) - t;
  };
  let t = approx - decalage(approx);
  t = approx - decalage(t);
  return new Date(t);
}
