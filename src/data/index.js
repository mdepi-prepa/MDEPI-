// Choix de la source de données : Supabase si les clés sont renseignées
// (fichier .env), sinon le mode démo.
import { creerBackendDemo } from './demo.js';

const url = import.meta.env.VITE_SUPABASE_URL;
const cle = import.meta.env.VITE_SUPABASE_ANON_KEY;

export async function creerBackend() {
  if (url && cle) {
    const { creerBackendSupabase } = await import('./supabase.js');
    return creerBackendSupabase(url, cle);
  }
  return creerBackendDemo();
}
