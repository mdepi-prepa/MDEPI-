// File d'envoi des réponses d'une épreuve (src/lib/envoi.js) : rien ne doit se
// perdre, rien ne doit partir deux fois ni avec une valeur périmée.
import { describe, it, expect, beforeEach } from 'vitest';
import { fileEnvoi, arreterFiles, erreurReseau } from '../src/lib/envoi.js';

// Stockage de l'appareil, en mémoire.
function memoire(depart = {}) {
  const m = new Map(Object.entries(depart));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m };
}
// Faux serveur : note ce qu'il reçoit ; « panne » simule une erreur.
function serveur() {
  const s = { recu: [], panne: null, attente: null };
  s.envoyer = async (qid, r) => {
    if (s.attente) await s.attente;
    if (s.panne) throw new Error(s.panne);
    s.recu.push([qid, r.choix.join('')]);
  };
  return s;
}
const rep = (choix, valider = false) => ({ choix: [...choix], texte: '', valider });
const pause = (ms = 0) => new Promise((ok) => setTimeout(ok, ms));

beforeEach(() => arreterFiles());

describe('file d’envoi des réponses', () => {
  it('envoie chaque réponse et vide la sauvegarde de l’appareil', async () => {
    const st = memoire();
    const sv = serveur();
    const f = fileEnvoi('k', sv.envoyer, { stockage: st });
    f.noter('q1', rep('A'));
    expect(JSON.parse(st.getItem('k'))).toEqual({ q1: rep('A') });
    expect(await f.toutEnvoyer()).toBe(true);
    expect(sv.recu).toEqual([['q1', 'A']]);
    expect(st.getItem('k')).toBe(null);
    expect(f.vide()).toBe(true);
  });

  it('une seule file par épreuve : deux écrans partagent la même, sans double envoi', async () => {
    const sv = serveur();
    const st = memoire();
    const a = fileEnvoi('k', sv.envoyer, { stockage: st });
    const b = fileEnvoi('k', sv.envoyer, { stockage: st });
    expect(b).toBe(a);
    a.noter('q1', rep('A'));
    b.noter('q1', rep('B'));
    await a.toutEnvoyer();
    // Jamais l'ancienne valeur après la nouvelle.
    expect(sv.recu.at(-1)).toEqual(['q1', 'B']);
    expect(sv.recu.filter(([, c]) => c === 'B').length).toBe(1);
  });

  it('réponse modifiée pendant son envoi : la dernière valeur repart ensuite', async () => {
    const sv = serveur();
    let liberer;
    sv.attente = new Promise((ok) => (liberer = ok));
    const f = fileEnvoi('k', sv.envoyer, { stockage: memoire() });
    f.noter('q1', rep('A'));
    await pause();
    f.noter('q1', rep('AB'));
    sv.attente = null;
    liberer();
    expect(await f.toutEnvoyer()).toBe(true);
    expect(sv.recu).toEqual([['q1', 'A'], ['q1', 'AB']]);
  });

  it('sans réseau : la réponse reste sur l’appareil, puis repart toute seule', async () => {
    const st = memoire();
    const sv = serveur();
    sv.panne = 'Pas de connexion internet.';
    const etats = [];
    const f = fileEnvoi('k', sv.envoyer, { stockage: st, delai: 5 });
    f.ecouter({ statut: (e) => etats.push(e) });
    f.noter('q1', rep('A'));
    expect(await f.envoyer()).toBe(false);
    expect(etats.at(-1)).toBe('horsligne');
    expect(JSON.parse(st.getItem('k'))).toEqual({ q1: rep('A') });
    sv.panne = null;
    await pause(40); // nouvel essai automatique
    expect(sv.recu).toEqual([['q1', 'A']]);
    expect(st.getItem('k')).toBe(null);
    expect(etats.at(-1)).toBe('ok');
  });

  it('erreur inconnue du serveur : la réponse n’est pas jetée', async () => {
    const st = memoire();
    const sv = serveur();
    sv.panne = 'JWT expired';
    const refus = [];
    const f = fileEnvoi('k', sv.envoyer, { stockage: st, delai: 1000 });
    f.ecouter({ refus: (m) => refus.push(m) });
    f.noter('q1', rep('A'));
    expect(await f.envoyer()).toBe(false);
    expect(refus).toEqual([]);
    expect(f.enAttente()).toEqual({ q1: rep('A') });
    sv.panne = null;
    expect(await f.toutEnvoyer()).toBe(true);
    expect(sv.recu).toEqual([['q1', 'A']]);
  });

  it('refus d’une réponse (question déjà validée) : elle est retirée, les autres partent', async () => {
    const sv = serveur();
    const refus = [];
    const f = fileEnvoi('k', async (qid, r) => {
      if (qid === 'q1') throw new Error('Question déjà validée.');
      return sv.envoyer(qid, r);
    }, { stockage: memoire() });
    f.ecouter({ refus: (m, qid) => refus.push([m, qid]) });
    f.noter('q1', rep('A'));
    f.noter('q2', rep('B'));
    expect(await f.toutEnvoyer()).toBe(true);
    expect(refus).toEqual([['Question déjà validée.', 'q1']]);
    expect(sv.recu).toEqual([['q2', 'B']]);
  });

  it('épreuve fermée : la file se ferme et prévient l’écran une seule fois', async () => {
    const st = memoire();
    const sv = serveur();
    sv.panne = 'Épreuve fermée.';
    const fermetures = [];
    const f = fileEnvoi('k', sv.envoyer, { stockage: st });
    f.ecouter({ fermee: (m) => fermetures.push(m) });
    f.noter('q1', rep('A'));
    f.noter('q2', rep('B'));
    expect(await f.toutEnvoyer()).toBe(true);
    expect(fermetures).toEqual(['Épreuve fermée.']);
    expect(f.fermee).toBe(true);
    expect(st.getItem('k')).toBe(null);
    f.noter('q3', rep('C')); // plus rien n'est accepté
    expect(f.vide()).toBe(true);
  });

  it('reprend les réponses gardées sur l’appareil (app fermée puis rouverte)', async () => {
    const st = memoire({ k: JSON.stringify({ q1: rep('A'), q2: rep('B', true) }), abime: '{pas du json' });
    const sv = serveur();
    const f = fileEnvoi('k', sv.envoyer, { stockage: st });
    expect(f.enAttente()).toEqual({ q1: rep('A'), q2: rep('B', true) });
    expect(await f.toutEnvoyer()).toBe(true);
    expect(sv.recu).toEqual([['q1', 'A'], ['q2', 'B']]);
    // Sauvegarde illisible : on repart de zéro, sans planter.
    expect(fileEnvoi('abime', sv.envoyer, { stockage: st }).vide()).toBe(true);
  });

  it('réponses parties depuis un instant donné (copie lue juste avant leur arrivée)', async () => {
    const sv = serveur();
    const f = fileEnvoi('k', sv.envoyer, { stockage: memoire() });
    f.noter('q1', rep('A'));
    await f.toutEnvoyer();
    await pause(5);
    const t = Date.now();
    f.noter('q2', rep('B', true));
    await f.toutEnvoyer();
    expect(f.envoyeesDepuis(t)).toEqual({ q2: rep('B', true) });
    expect(Object.keys(f.envoyeesDepuis(0)).sort()).toEqual(['q1', 'q2']);
  });

  it('changement de compte : la file s’arrête sans effacer la sauvegarde', async () => {
    const st = memoire();
    const sv = serveur();
    sv.panne = 'Pas de connexion internet.';
    const f = fileEnvoi('k', sv.envoyer, { stockage: st, delai: 5 });
    f.noter('q1', rep('A'));
    await f.envoyer();
    arreterFiles();
    sv.panne = null;
    await pause(30);
    expect(sv.recu).toEqual([]); // rien n'est parti sous l'autre compte
    expect(JSON.parse(st.getItem('k'))).toEqual({ q1: rep('A') });
    // Reconnexion du même compte : une file neuve reprend la sauvegarde.
    const g = fileEnvoi('k', sv.envoyer, { stockage: st });
    expect(g).not.toBe(f);
    expect(await g.toutEnvoyer()).toBe(true);
    expect(sv.recu).toEqual([['q1', 'A']]);
  });

  it('un écran qui plante ne bloque pas l’envoi', async () => {
    const sv = serveur();
    const f = fileEnvoi('k', sv.envoyer, { stockage: memoire() });
    f.ecouter({
      statut() {
        throw new Error('écran détruit');
      },
    });
    const journal = console.error;
    console.error = () => {};
    try {
      f.noter('q1', rep('A'));
      expect(await f.toutEnvoyer()).toBe(true);
    } finally {
      console.error = journal;
    }
    expect(sv.recu).toEqual([['q1', 'A']]);
  });

  it('reconnaît une panne de réseau', () => {
    expect(erreurReseau(new Error('Pas de connexion internet.'))).toBe(true);
    expect(erreurReseau(new Error('Serveur injoignable (https://x.supabase.co).'))).toBe(true);
    expect(erreurReseau(new Error('TypeError: Failed to fetch'))).toBe(true);
    expect(erreurReseau(new Error('Question déjà validée.'))).toBe(false);
    expect(erreurReseau(null)).toBe(false);
  });
});
