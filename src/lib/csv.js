// Lecture de la liste des inscrits (CSV exporté d'Excel ou de Google Sheets).
// Colonnes reconnues (ordre libre, en-tête obligatoire) :
//   email ; prenom ; nom ; promo ; groupe ; role
// Séparateur « ; » ou « , » (détecté automatiquement).

import { CODES_PROMOS } from './promos.js';

function sansAccents(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function decouperLigne(ligne, sep) {
  const cellules = [];
  let cur = '';
  let guillemets = false;
  for (let i = 0; i < ligne.length; i++) {
    const c = ligne[i];
    if (guillemets) {
      if (c === '"' && ligne[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') guillemets = false;
      else cur += c;
    } else if (c === '"') guillemets = true;
    else if (c === sep) {
      cellules.push(cur);
      cur = '';
    } else cur += c;
  }
  cellules.push(cur);
  return cellules.map((x) => x.trim());
}

const ALIAS = {
  email: ['email', 'e-mail', 'mail', 'adresse', 'courriel'],
  prenom: ['prenom', 'first name', 'firstname'],
  nom: ['nom', 'last name', 'lastname', 'nom de famille'],
  promo: ['promo', 'promotion', 'annee'],
  groupe: ['groupe', 'groupe de rotation', 'rotation'],
  role: ['role', 'statut'],
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Renvoie { lignes: [{email, prenom, nom, promo, groupe, role}], erreurs: [texte] }
export function lireCsvInscrits(texte) {
  const lignesBrutes = texte.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  if (!lignesBrutes.length) return { lignes: [], erreurs: ['Fichier vide.'] };
  const sep = (lignesBrutes[0].match(/;/g) || []).length >= (lignesBrutes[0].match(/,/g) || []).length ? ';' : ',';
  const entetes = decouperLigne(lignesBrutes[0], sep).map((h) => sansAccents(h.toLowerCase()));
  const index = {};
  for (const [champ, noms] of Object.entries(ALIAS)) {
    const i = entetes.findIndex((h) => noms.includes(h));
    if (i >= 0) index[champ] = i;
  }
  if (index.email === undefined) return { lignes: [], erreurs: ['Colonne « email » introuvable dans la première ligne.'] };

  const lignes = [];
  const erreurs = [];
  const vus = new Set();
  lignesBrutes.slice(1).forEach((l, n) => {
    const c = decouperLigne(l, sep);
    const get = (k) => (index[k] === undefined ? '' : c[index[k]] ?? '');
    const num = n + 2;
    const email = get('email').toLowerCase();
    if (!EMAIL.test(email)) return erreurs.push(`Ligne ${num} : adresse e-mail invalide (« ${get('email')} »).`);
    if (vus.has(email)) return erreurs.push(`Ligne ${num} : ${email} apparaît deux fois.`);
    vus.add(email);
    let promo = get('promo').toUpperCase().replace(/\s/g, '');
    if (promo && !CODES_PROMOS.includes(promo)) return erreurs.push(`Ligne ${num} : promo « ${get('promo')} » inconnue (D1, D2, D3 ou D4).`);
    let role = sansAccents(get('role').toLowerCase()) || 'etudiant';
    if (!['etudiant', 'enseignant', 'admin'].includes(role)) return erreurs.push(`Ligne ${num} : rôle « ${get('role')} » inconnu.`);
    if (role === 'etudiant' && !promo) return erreurs.push(`Ligne ${num} : promo manquante pour ${email}.`);
    lignes.push({ email, prenom: get('prenom'), nom: get('nom'), promo: promo || null, groupe: get('groupe'), role });
  });
  return { lignes, erreurs };
}
