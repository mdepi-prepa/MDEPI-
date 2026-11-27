// Point d'entrée de l'app : connexion, navigation entre les écrans.
import './styles.css';
import { creerBackend } from './data/index.js';
import { html } from './lib/html.js';
import { icones } from './lib/icones.js';
import { couleurPromo } from './lib/promos.js';
import { estEquipe } from './lib/acces.js';
import { vueConnexion } from './views/connexion.js';
import { vueAccueil } from './views/accueil.js';
import { vuePlanning } from './views/planning.js';
import { vueEpreuves } from './views/epreuves.js';
import { vueSeance } from './views/seance.js';
import { vueAnnonces } from './views/annonces.js';
import { vueBientot } from './views/bientot.js';
import { vueProfil } from './views/profil.js';
import { vueAdmin } from './views/admin/index.js';
import { vueAdminComptes } from './views/admin/comptes.js';
import { vueAdminSeances, vueAdminSeance } from './views/admin/seances.js';
import { vueAdminAnnonces } from './views/admin/annonces.js';
import { vueAdminEpreuves } from './views/admin/epreuves.js';
import { vuePassage, vueMaCorrection } from './views/passage.js';
import { vueAdminQcm, vueAdminCorrige, vueAdminResultats, vueAdminCopie } from './views/admin/qcm.js';

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
  ['entrainement', (app) => vueBientot(app, 'Entraînement')],
  ['cartes', (app) => vueBientot(app, 'Cartes')],
  ['progres', (app) => vueBientot(app, 'Progrès')],
  ['profil', vueProfil],
  ['admin', vueAdmin, 'equipe'],
  ['admin/comptes', vueAdminComptes, 'admin'],
  ['admin/seances', vueAdminSeances, 'equipe'],
  ['admin/seances/:id', vueAdminSeance, 'equipe'],
  ['admin/seances/copie/:copie', (app, p) => vueAdminSeance(app, { id: 'nouvelle', ...p }), 'equipe'],
  ['admin/epreuves', vueAdminEpreuves, 'equipe'],
  ['admin/epreuves/nouvelle', (app) => vueAdminSeance(app, { id: 'nouvelle', epreuve: true }), 'equipe'],
  ['admin/epreuves/:id/qcm', vueAdminQcm, 'equipe'],
  ['admin/epreuves/:id/corrige', vueAdminCorrige, 'equipe'],
  ['admin/epreuves/:id/resultats', vueAdminResultats, 'equipe'],
  ['admin/epreuves/:id/copie/:user', vueAdminCopie, 'equipe'],
  ['admin/annonces', vueAdminAnnonces, 'admin'],
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
    <div class="nav-marque"><span class="logo">MD</span><span>MDEPi</span></div>
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
    racine.innerHTML = String(vue.html);
    vue.monter?.(racine);
    return;
  }

  const route = trouverRoute(chemin) || trouverRoute('accueil');
  const refuse = (route.acces === 'equipe' && !estEquipe(app.profil)) || (route.acces === 'admin' && app.profil.role !== 'admin');
  const onglet = route.motif.startsWith('admin') ? 'admin' : route.motif.split('/')[0].replace(/^seance$/, 'planning').replace(/^epreuve$/, 'epreuves');

  document.documentElement.style.setProperty('--accent', couleurPromo(app.profil.promo));
  if (!racine.querySelector('.coquille')) {
    racine.innerHTML = '<div class="coquille"><div class="nav-place"></div><main id="contenu" tabindex="-1"></main></div>';
  }
  racine.querySelector('.nav-place').innerHTML = String(navigation(app, onglet));
  const contenu = racine.querySelector('#contenu');
  contenu.classList.toggle('large', route.motif.startsWith('admin'));

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
  contenu.innerHTML = String(vue.html);
  vue.monter?.(contenu);
  if (vue.titre) document.title = `${vue.titre} – MDEPi`;
  window.scrollTo(0, 0);
}

async function demarrer() {
  app.api = await creerBackend();
  const s = await app.api.session().catch(() => null);
  app.profil = s?.profil ?? null;
  app.api.surChangement(async () => {
    const avant = app.profil?.id ?? null;
    const s2 = await app.api.session().catch(() => null);
    app.profil = s2?.profil ?? null;
    // Supabase signale aussi des « reconnexions » silencieuses : on ne
    // redessine que si la personne connectée a vraiment changé.
    if ((app.profil?.id ?? null) === avant) return;
    racine.innerHTML = '';
    if (app.profil && location.hash !== '#/accueil') location.hash = '#/accueil';
    else afficher();
  });
  window.addEventListener('hashchange', afficher);
  afficher();

  // Fonctionnement hors connexion et installation (voir public/sw.js).
  if ('serviceWorker' in navigator && import.meta.env.PROD && location.protocol === 'https:') {
    navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js').catch(() => {});
  }
}

demarrer();
