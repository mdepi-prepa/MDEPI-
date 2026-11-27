// Choix de la source de données : Supabase si les clés sont renseignées
// (fichier .env), sinon le mode démo.
import { creerBackendDemo } from './demo.js';

// Tolère les erreurs de copier-coller courantes : espaces, guillemets,
// « https:// » oublié, barre finale, adresse du tableau de bord Supabase.
export function nettoyerUrl(brute) {
  let u = String(brute || '').trim().replace(/^["']|["']$/g, '').trim();
  if (!u) return '';
  const tableau = u.match(/supabase\.com\/dashboard\/project\/([a-z0-9]+)/i);
  if (tableau) return `https://${tableau[1]}.supabase.co`;
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  return u.replace(/\/(rest\/v1)?\/?$/, '');
}
const url = nettoyerUrl(import.meta.env.VITE_SUPABASE_URL);
const cle = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim().replace(/^["']|["']$/g, '');

export async function creerBackend() {
  if (url && cle) {
    const { creerBackendSupabase } = await import('./supabase.js');
    return creerBackendSupabase(url, cle);
  }
  return creerBackendDemo();
}
