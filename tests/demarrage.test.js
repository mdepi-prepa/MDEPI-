// @vitest-environment jsdom
// Démarrage de l'app (src/main.js) quand le serveur ne répond pas : on ne doit
// ni montrer l'écran de connexion à quelqu'un qui est connecté, ni déconnecter
// un étudiant en pleine épreuve parce que le réseau a sauté.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const profil = { id: 'u1', prenom: 'Camille', role: 'etudiant', promo: 'D2', groupe_id: null, actif: true };
const attendre = (ms = 30) => new Promise((ok) => setTimeout(ok, ms));

// Faux serveur : « session » est rejouée à chaque appel.
function faux(session) {
  const api = {
    mode: 'supabase',
    changement: null,
    session,
    surChangement: (cb) => (api.changement = cb),
    seances: async () => [],
    annonces: async () => [],
    annoncesLues: async () => new Set(),
    planningGlobal: async () => [],
    marquerLues: async () => {},
  };
  return api;
}
async function demarrer(api) {
  vi.resetModules();
  vi.doMock('../src/data/index.js', () => ({ creerBackend: async () => api }));
  await import('../src/main.js');
  await attendre();
}
const app = () => document.getElementById('app');

beforeEach(() => {
  document.body.innerHTML = '<div id="app"></div>';
  localStorage.clear();
  location.hash = '';
  window.scrollTo = () => {};
});

describe('démarrage de l’app', () => {
  it('pas de session : écran de connexion', async () => {
    await demarrer(faux(async () => null));
    expect(app().querySelector('#f-email')).not.toBeNull();
  });

  it('connecté : accueil', async () => {
    await demarrer(faux(async () => ({ profil })));
    expect(app().querySelector('.coquille')).not.toBeNull();
    expect(app().textContent).toMatch(/Bonjour Camille/);
  });

  it('connecté mais serveur injoignable : écran d’attente, pas l’écran de connexion', async () => {
    await demarrer(faux(async () => {
      throw new Error('Pas de connexion internet.');
    }));
    expect(app().textContent).toMatch(/Pas de connexion/);
    expect(app().textContent).toMatch(/Réessayer/);
    expect(app().querySelector('#f-email')).toBeNull();
  });

  it('réseau coupé pendant une « reconnexion » silencieuse : on reste connecté', async () => {
    let coupe = false;
    const api = faux(async () => {
      if (coupe) throw new Error('Serveur injoignable (https://x.supabase.co). Détail : Failed to fetch');
      return { profil };
    });
    await demarrer(api);
    coupe = true;
    await api.changement('SIGNED_IN');
    await attendre();
    expect(app().querySelector('.coquille')).not.toBeNull();
    expect(app().querySelector('#f-email')).toBeNull();
  });

  it('vraie déconnexion : retour à l’écran de connexion', async () => {
    let connecte = true;
    const api = faux(async () => (connecte ? { profil } : null));
    await demarrer(api);
    connecte = false;
    await api.changement('SIGNED_OUT');
    await attendre();
    expect(app().querySelector('#f-email')).not.toBeNull();
  });
});
