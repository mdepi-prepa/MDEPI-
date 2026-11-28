// Règles de visibilité, identiques à celles de la base (supabase/schema.sql).
// Côté Supabase, c'est la base qui filtre ; ce fichier sert au mode démo
// et aux tests. Si vous changez une règle ici, changez-la aussi en SQL.

export function estEquipe(profil) {
  return !!profil && profil.actif !== false && (profil.role === 'admin' || profil.role === 'enseignant');
}

export function estAdmin(profil) {
  return !!profil && profil.actif !== false && profil.role === 'admin';
}

export function peutVoirSeance(profil, seance) {
  if (!profil || profil.actif === false) return false;
  if (estEquipe(profil)) return true;
  if (!seance.promos.includes(profil.promo)) return false;
  return seance.groupes.length === 0 || seance.groupes.includes(profil.groupe_id);
}

export function peutVoirAnnonce(profil, annonce) {
  if (!profil || profil.actif === false) return false;
  return estEquipe(profil) || annonce.promos.includes(profil.promo);
}

// Fiches de révision (onglet Cartes) : même règle que peut_voir_fiche.
export function peutVoirFiche(profil, fiche) {
  if (!profil || profil.actif === false) return false;
  return estEquipe(profil) || fiche.promos.includes(profil.promo);
}
