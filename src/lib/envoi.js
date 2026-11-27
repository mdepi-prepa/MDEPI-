// File d'envoi des réponses d'une épreuve.
//
// Chaque réponse cochée est d'abord notée ici (et gardée sur l'appareil), puis
// envoyée au serveur. Sans réseau, elle attend et repart toute seule.
//
// Il n'existe qu'UNE file par épreuve et par compte, quel que soit le nombre de
// fois où l'écran de l'épreuve est affiché : si l'on quitte l'épreuve puis que
// l'on y revient, les réponses en attente continuent de partir, une seule
// fois, et toujours avec leur dernière valeur. (Avec une file par affichage,
// un ancien écran pouvait renvoyer une vieille réponse par-dessus la nouvelle.)

const DELAI_REESSAI = 5000;
const DELAI_MAX = 60000;
const files = new Map();

// Panne de réseau, par opposition à un refus de la base.
export const erreurReseau = (err) => /Pas de connexion|fetch|network|injoignable/i.test(err?.message || '');
// Refus qui ferme la copie : plus aucune réponse ne sera acceptée.
const copieFermee = (err) => /fermée|rendue/i.test(err?.message || '');
// Refus de cette réponse seulement : la renvoyer ne servirait à rien.
const refusReponse = (err) => /déjà validée|pas encore accessible|Question introuvable|Proposition inconnue|Trop de cases/i.test(err?.message || '');
// Toute autre erreur (réseau coupé, serveur en panne, session à renouveler…)
// est passagère : la réponse reste en attente et repart plus tard. On ne jette
// jamais une réponse pour une raison que l'on ne connaît pas.

function stockageParDefaut() {
  try {
    return globalThis.localStorage || null;
  } catch {
    return null; // navigation privée, stockage bloqué
  }
}

// cle : nom de la sauvegarde sur l'appareil (une par épreuve et par compte).
// envoyerUne(questionId, { choix, texte, valider }) : envoi au serveur, renvoie une promesse.
export function fileEnvoi(cle, envoyerUne, { stockage = stockageParDefaut(), delai = DELAI_REESSAI } = {}) {
  if (files.has(cle)) return files.get(cle);

  let attente = {}; // questionId → réponse pas encore reçue par le serveur
  try {
    const lu = JSON.parse(stockage?.getItem(cle) || '{}');
    if (lu && typeof lu === 'object' && !Array.isArray(lu)) attente = lu;
  } catch {
    /* sauvegarde illisible : on repart de zéro */
  }
  const envoyees = {}; // questionId → { r, le } : dernière réponse reçue par le serveur
  let envoi = null; // envoi en cours (un seul à la fois)
  let minuteur = null; // prochain essai après un échec
  let echecs = 0; // échecs de suite : les essais s'espacent (5 s, 10 s… 1 min au plus)
  let arretee = false; // compte déconnecté : plus rien ne part
  let ecran = null; // écran affiché : { statut(etat), refus(message, questionId), fermee(message) }

  const garder = () => {
    try {
      if (Object.keys(attente).length) stockage?.setItem(cle, JSON.stringify(attente));
      else stockage?.removeItem(cle);
    } catch {
      /* stockage plein ou indisponible */
    }
  };
  // Un écran qui plante ne doit pas bloquer l'envoi des réponses.
  const prevenir = (quoi, ...args) => {
    try {
      ecran?.[quoi]?.(...args);
    } catch (e) {
      console.error(e);
    }
  };
  const vider = () => {
    for (const k of Object.keys(attente)) delete attente[k];
    garder();
  };
  const reessayerPlusTard = () => {
    if (minuteur || arretee) return;
    minuteur = setTimeout(
      () => {
        minuteur = null;
        f.envoyer();
      },
      Math.min(delai * 2 ** echecs, DELAI_MAX)
    );
    echecs++;
  };

  // Envoie les réponses en attente, dans l'ordre. Renvoie true si tout est
  // parti (ou refusé pour de bon), false si l'envoi n'a pas pu se faire.
  async function envoyerTout() {
    while (!f.fermee && !arretee && Object.keys(attente).length) {
      const [qid, r] = Object.entries(attente)[0];
      prevenir('statut', 'envoi');
      try {
        await envoyerUne(qid, r);
        envoyees[qid] = { r, le: Date.now() };
        echecs = 0;
      } catch (err) {
        if (f.fermee || arretee) return true;
        if (copieFermee(err)) {
          // Épreuve fermée ou copie rendue : le reste ne sera jamais accepté.
          f.fermee = true;
          vider();
          prevenir('fermee', err.message);
          return true;
        }
        if (!refusReponse(err)) {
          prevenir('statut', 'horsligne');
          reessayerPlusTard();
          return false;
        }
        prevenir('refus', err.message, qid);
      }
      // Modifiée pendant l'envoi : elle reste en attente et repart au tour suivant.
      if (attente[qid] === r) delete attente[qid];
      garder();
    }
    if (!f.fermee && !arretee) prevenir('statut', 'ok');
    return true;
  }

  const f = {
    fermee: false,
    enAttente: () => ({ ...attente }),
    vide: () => !Object.keys(attente).length,
    // Réponses reçues par le serveur depuis l'instant t : à superposer à une
    // copie dont la lecture a commencé à cet instant (elle a pu les manquer).
    envoyeesDepuis(t) {
      return Object.fromEntries(Object.entries(envoyees).filter(([, e]) => e.le >= t).map(([qid, e]) => [qid, e.r]));
    },
    // Note une réponse (remplace la précédente de la même question) et l'envoie.
    noter(qid, r) {
      if (f.fermee || arretee) return;
      attente[qid] = r;
      garder();
      f.envoyer();
    },
    // Retire une réponse devenue inutile (le serveur a déjà la question validée).
    oublier(qid) {
      delete attente[qid];
      garder();
    },
    envoyer() {
      if (f.fermee || arretee) return Promise.resolve(true);
      if (!envoi) envoi = envoyerTout().finally(() => (envoi = null));
      return envoi;
    },
    // Attend que tout soit parti, y compris une réponse modifiée pendant son
    // envoi. Renvoie false s'il en reste (réseau coupé…).
    async toutEnvoyer() {
      for (let tour = 0; tour < 3; tour++) {
        if (!(await f.envoyer())) return false;
        if (f.vide()) return true;
      }
      return f.vide();
    },
    // L'écran d'épreuve s'abonne (statut d'enregistrement, refus). Renvoie de quoi se désabonner.
    ecouter(e) {
      ecran = e;
      return () => {
        if (ecran === e) ecran = null;
      };
    },
    // Copie rendue : plus rien à envoyer, sauvegarde locale effacée.
    fermer() {
      f.fermee = true;
      vider();
    },
    // L'épreuve est (de nouveau) ouverte pour ce compte.
    rouvrir() {
      f.fermee = false;
    },
    // Changement de compte : la file s'arrête sans rien effacer. Les réponses
    // en attente restent sur l'appareil et repartiront à la reconnexion.
    arreter() {
      arretee = true;
      ecran = null;
      clearTimeout(minuteur);
      minuteur = null;
    },
  };
  files.set(cle, f);
  return f;
}

// Au retour du réseau, toutes les files repartent.
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => files.forEach((f) => f.envoyer()));
}

// Déconnexion ou changement de compte : aucune réponse ne doit partir sous un
// autre compte que celui qui l'a donnée.
export function arreterFiles() {
  files.forEach((f) => f.arreter());
  files.clear();
}
