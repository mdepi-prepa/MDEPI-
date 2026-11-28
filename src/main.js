// Point d'entrée de l'app : connexion, navigation entre les écrans.
import './styles.css';
import { creerBackend } from './data/index.js';
import { html } from './lib/html.js';
import { icones } from './lib/icones.js';
import { logoComplet } from './lib/logo.js';
import { couleurPromo } from './lib/promos.js';
import { estEquipe } from './lib/acces.js';
import { vueConnexion } from './views/connexion.js';
import { vueAccueil } from './views/accueil.js';
import { vuePlanning } from './views/planning.js';
import { vueEpreuves } from './views/epreuves.js';
import { vueSeance } from './views/seance.js';
import { vueAnnonces } from './views/annonces.js';
import { vueCartes, vueFiche, vueSynthese } from './views/cartes.js';
import { vueProfil } from './views/profil.js';
import { vueAdmin } from './views/admin/index.js';
import { vueAdminComptes } from './views/admin/comptes.js';
import { vueAdminSeances, vueAdminSeance } from './views/admin/seances.js';
import { vueAdminAnnonces } from './views/admin/annonces.js';
import { vueAdminFiches } from './views/admin/fiches.js';
import { vueAdminEpreuves } from './views/admin/epreuves.js';
import { vuePassage, vueMaCorrection, reprendreEnvois } from './views/passage.js';
import { vueEntrainement, vueRejouer, envoyerScoresEnAttente } from './views/entrainement.js';
import { arreterFiles, erreurReseau } from './lib/envoi.js';
import { vueAdminQcm, vueAdminCorrige, vueAdminResultats, vueAdminCopie, vueAdminQroc } from './views/admin/qcm.js';
import { vueAdminSaisie } from './views/admin/saisie.js';
import { vueProgres } from './views/progres.js';

// Table des écrans : #/chemin → fonction d'affichage.
const ROUTES = [
  ['accueil', vueAccueil],
  ['planning', vuePlanning],
  ['planning/replays', (app) => vuePlanning(app, { onglet: 'replays' })],
  ['seance/:id', vueSeance],
  ['epreuves', vueEpreuves],
  ['epreuve/:id', vuePassage],
  ['epreuve/:id/correction', vueMaCorrection],
  ['annonces', vueAnnonces],
  ['entrainement', vueEntrainement],
  ['entrainement/:id', vueRejouer],
  ['cartes', vueCartes],
  ['cartes/lisa', (app) => vueCartes(app, { onglet: 'lisa' })],
  ['fiche/:id', vueFiche],
  ['synthese/:item', vueSynthese],
  ['progres', vueProgres],
  ['profil', vueProfil],
  ['admin', vueAdmin, 'equipe'],
  ['admin/comptes', vueAdminComptes, 'admin'],
  ['admin/seances', vueAdminSeances, 'equipe'],
  ['admin/seances/:id', vueAdminSeance, 'equipe'],
  ['admin/seances/copie/:copie', (app, p) => vueAdminSeance(app, { id: 'nouvelle', ...p }), 'equipe'],
  ['admin/epreuves', vueAdminEpreuves, 'equipe'],
  ['admin/epreuves/nouvelle', (app) => vueAdminSeance(app, { id: 'nouvelle', epreuve: true }), 'equipe'],
  ['admin/epreuves/:id/qcm', vueAdminQcm, 'equipe'],
  ['admin/epreuves/:id/saisie', vueAdminSaisie, 'equipe'],
  ['admin/epreuves/:id/corrige', vueAdminCorrige, 'equipe'],
  ['admin/epreuves/:id/resultats', vueAdminResultats, 'equipe'],
  ['admin/epreuves/:id/qroc', vueAdminQroc, 'equipe'],
  ['admin/epreuves/:id/copie/:user', vueAdminCopie, 'equipe'],
  ['admin/annonces', vueAdminAnnonces, 'admin'],
  ['admin/fiches', vueAdminFiches, 'equipe'],
];

function trouverRoute(chemin) {
  for (const [motif, vue, acces] of ROUTES) {
    const a = motif.split('/');
    const b = chemin.split('/');
    if (a.length !== b.length) continue;
    const params = {};
    if (a.every((p, i) => (p.startsWith(':') ? ((params[p.slice(1)] = decodeURIComponent(b[i])), true) : p === b[i]))) {
      return { vue, params, acces, motif };
    }
  }
  return null;
}

const ONGLETS = [
  ['accueil', 'Accueil', icones.accueil],
  ['planning', 'Planning', icones.planning],
  ['epreuves', 'Épreuves', icones.epreuve],
  ['entrainement', 'Entraînement', icones.entrainement],
  ['cartes', 'Cartes', icones.cartes],
  ['progres', 'Progrès', icones.progres],
];

function navigation(app, actif) {
  const equipe = estEquipe(app.profil);
  const lien = (cle, libelle, icone) => html`<a href="#/${cle}" class="nav-lien${actif === cle ? ' actif' : ''}" ${actif === cle ? html`aria-current="page"` : ''}>
      ${icone(22)}<span>${libelle}</span></a>`;
  return html`<nav class="nav" aria-label="Navigation principale">
    <div class="nav-marque">${logoComplet()}</div>
    ${ONGLETS.map(([c, l, i]) => lien(c, l, i))}
    <div class="nav-bas">
      ${equipe ? lien('admin', 'Back-office', icones.outils) : ''}
      ${lien('profil', 'Mon compte', icones.reglages)}
    </div>
  </nav>`;
}

const racine = document.getElementById('app');

const app = {
  api: null,
  profil: null,
  naviguer(chemin) {
    if (location.hash === '#/' + chemin) afficher();
    else location.hash = '#/' + chemin;
  },
  rafraichir: () => afficher(),
  message(texte, type = 'info') {
    const t = document.createElement('div');
    t.className = 'toast ' + type;
    t.setAttribute('role', 'status');
    t.textContent = texte;
    document.body.appendChild(t);
    setTimeout(() => t.classList.add('visible'), 10);
    setTimeout(() => {
      t.classList.remove('visible');
      setTimeout(() => t.remove(), 300);
    }, 3200);
  },
};

let numeroAffichage = 0;

async function afficher() {
  const n = ++numeroAffichage;
  const chemin = location.hash.replace(/^#\/?/, '') || 'accueil';

  if (!app.profil) {
    const vue = await vueConnexion(app);
    if (n !== numeroAffichage) return;
    // Conteneur neuf à chaque affichage : les clics branchés par l'écran
    // précédent disparaissent avec lui (voir plus bas).
    const hote = document.createElement('div');
    hote.style.display = 'contents';
    hote.innerHTML = String(vue.html);
    racine.replaceChildren(hote);
    vue.monter?.(hote);
    return;
  }

  const route = trouverRoute(chemin) || trouverRoute('accueil');
  const refuse = (route.acces === 'equipe' && !estEquipe(app.profil)) || (route.acces === 'admin' && app.profil.role !== 'admin');
  const onglet = route.motif.startsWith('admin') ? 'admin' : route.motif.split('/')[0].replace(/^seance$/, 'planning').replace(/^epreuve$/, 'epreuves').replace(/^(fiche|synthese)$/, 'cartes');

  document.documentElement.style.setProperty('--accent', couleurPromo(app.profil.promo));
  if (!racine.querySelector('.coquille')) {
    racine.innerHTML = '<div class="coquille"><div class="nav-place"></div><main id="contenu" tabindex="-1"></main></div>';
  }
  racine.querySelector('.nav-place').innerHTML = String(navigation(app, onglet));

  let vue;
  try {
    vue = refuse
      ? { html: html`<div class="page"><h1>Accès réservé</h1><p>Cette page est réservée à l'équipe MDEPi.</p></div>` }
      : await route.vue(app, route.params);
  } catch (e) {
    console.error(e);
    vue = { html: html`<div class="page"><h1>Oups</h1><p class="erreur">${e.message}</p><button class="btn" onclick="location.reload()">Réessayer</button></div>` };
  }
  if (n !== numeroAffichage) return;
  // Chaque écran reçoit une zone <main> neuve. Sa fonction « monter » y branche
  // ses clics : si l'on gardait la même zone d'un écran à l'autre, ces
  // branchements s'accumuleraient et un clic serait traité plusieurs fois, par
  // d'anciens écrans aussi (double confirmation, réponse d'épreuve renvoyée
  // avec une valeur périmée…).
  const ancien = racine.querySelector('#contenu');
  const contenu = ancien.cloneNode(false);
  contenu.classList.toggle('large', route.motif.startsWith('admin') || route.motif.startsWith('synthese'));
  contenu.innerHTML = String(vue.html);
  ancien.replaceWith(contenu);
  vue.monter?.(contenu);
  if (vue.titre) document.title = `${vue.titre} – MDEPi`;
  window.scrollTo(0, 0);
}

// Ce qui attend sur l'appareil (réponses d'épreuve, scores d'entraînement
// donnés sans réseau) repart dès que l'on sait qui est connecté.
function reprendreEnAttente() {
  if (!app.profil) return;
  reprendreEnvois(app);
  envoyerScoresEnAttente(app);
}

async function demarrer() {
  app.api = await creerBackend();
  let s = null;
  try {
    s = await app.api.session();
  } catch (e) {
    // Connecté sur cet appareil, mais serveur injoignable : on attend le
    // réseau au lieu d'afficher l'écran de connexion (qui laisserait croire
    // que l'on a été déconnecté).
    if (erreurReseau(e)) {
      racine.innerHTML = String(html`<div class="page"><h1>Pas de connexion</h1>
        <p>L'app n'arrive pas à joindre le serveur. Vérifiez votre connexion internet : l'app se relancera toute seule dès son retour.</p>
        <p class="aide">Si vous étiez en pleine épreuve, vos réponses déjà cochées sont gardées sur cet appareil.</p>
        <button class="btn" onclick="location.reload()">Réessayer</button></div>`);
      window.addEventListener('online', () => location.reload(), { once: true });
      return;
    }
  }
  app.profil = s?.profil ?? null;
  app.api.surChangement(async (evt) => {
    const avant = app.profil?.id ?? null;
    let s2 = null;
    try {
      s2 = await app.api.session();
    } catch (e) {
      // Réseau coupé pendant une « reconnexion » silencieuse : on ne sait pas
      // qui est connecté, donc on ne déconnecte personne (surtout pas en
      // pleine épreuve).
      if (evt !== 'SIGNED_OUT' && erreurReseau(e)) {
        if (!avant) app.message('Pas de connexion internet : réessayez dans un instant.', 'erreur');
        return;
      }
    }
    app.profil = s2?.profil ?? null;
    // Supabase signale aussi des « reconnexions » silencieuses : on ne
    // redessine que si la personne connectée a vraiment changé.
    if ((app.profil?.id ?? null) === avant) return;
    // Les réponses en attente de l'ancien compte ne partent pas sous le nouveau.
    arreterFiles();
    reprendreEnAttente();
    racine.innerHTML = '';
    if (app.profil && location.hash !== '#/accueil') location.hash = '#/accueil';
    else afficher();
  });
  reprendreEnAttente();
  window.addEventListener('online', () => envoyerScoresEnAttente(app));
  window.addEventListener('hashchange', afficher);
  // Liens internes à une page (sommaire d'une copie) : défilement sans changer d'écran.
  document.addEventListener('click', (e) => {
    const lien = e.target.closest('[data-ancre]');
    if (!lien) return;
    e.preventDefault();
    document.getElementById(lien.dataset.ancre)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  afficher();

  // Fonctionnement hors connexion et installation (voir public/sw.js).
  if ('serviceWorker' in navigator && import.meta.env.PROD && location.protocol === 'https:') {
    navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js').catch(() => {});
  }
}

// Après une mise en ligne, un onglet resté ouvert réclame d'anciens fichiers
// (ex. jszip-ANCIEN.js) qui n'existent plus : on recharge une fois la page
// pour prendre la nouvelle version, au lieu d'afficher une erreur.
window.addEventListener('vite:preloadError', (e) => {
  let dernier = 0;
  try {
    dernier = Number(sessionStorage.getItem('mdepi-recharge') || 0);
  } catch {
    /* ignoré */
  }
  if (Date.now() - dernier < 30000) return; // déjà rechargé : on laisse l'erreur s'afficher
  e.preventDefault();
  try {
    sessionStorage.setItem('mdepi-recharge', String(Date.now()));
  } catch {
    /* ignoré */
  }
  location.reload();
});

demarrer().catch((e) => {
  // Sans ce filet, une erreur au démarrage (clé ou adresse Supabase invalide…)
  // laisse une page blanche.
  console.error(e);
  racine.innerHTML = String(html`<div class="page"><h1>L'app ne peut pas démarrer</h1>
    <p class="erreur">${e.message}</p>
    <p class="aide">Vérifiez VITE_SUPABASE_URL (de la forme https://xxxx.supabase.co) et VITE_SUPABASE_ANON_KEY dans les réglages de l'hébergement, puis relancez un déploiement.</p>
    <button class="btn" onclick="location.reload()">Réessayer</button></div>`);
});
