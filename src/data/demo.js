// Mode démo : mêmes fonctions que supabase.js, avec des données fictives
// gardées dans le navigateur. Sert à essayer l'app sans base de données
// (préview, développement). Code de connexion : 123456.
import { peutVoirSeance, peutVoirAnnonce, estAdmin, estEquipe } from '../lib/acces.js';
import { serieDe, noterCopie, imagesUtilisees, renommerImages, qrocACorriger } from '../lib/qcm.js';
import { corrigerQroc } from '../lib/qroc.js';
import { QCM_DEMO } from './demo-qcm.js';

const CLE = 'mdepi-demo-v6';
export const CODE_DEMO = '123456';

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2));

// Date à J+n, à h:m heure de Paris (approximation UTC+1 en hiver suffisante pour la démo).
function jour(n, h, m = 0) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  d.setUTCHours(h - 1, m, 0, 0);
  return d.toISOString();
}

// Il y a / dans n minutes.
const minutes = (n) => new Date(Date.now() + n * 60000).toISOString();

// Générateur pseudo-aléatoire reproductible (copies fictives de la démo).
function hasard(graine) {
  let x = graine;
  return () => ((x = (x * 16807) % 2147483647) / 2147483647);
}

// Réponses variées des copies fictives (justes, fautes de frappe, fausses).
const REPONSES_QROC_DEMO = {
  DEMO_KFP2_Q1: ['TDM AP injecté', 'scanner abdomino-pelvien injecté', 'Scanner abdominopelvien avec injection', 'TDM abdomino-pelvienne', 'IRM abdominale', 'Échographie abdominale', 'tdm ap injecté', 'Scaner abdomino-pelvien injecté'],
  DEMO_KFP2_Q2: ['Diverticulite', 'diveticulite aigue', 'Sigmoïdite', 'diverticulose', 'Diverticulite sigmoïdienne aiguë', 'Colite', 'diverticulite', 'Diverticulites'],
};

function donneesInitiales() {
  const gA = 'grp-d2-a';
  const gB = 'grp-d2-b';
  const groupes = [
    { id: gA, promo: 'D2', nom: 'Groupe A' },
    { id: gB, promo: 'D2', nom: 'Groupe B' },
    { id: 'grp-d3-1', promo: 'D3', nom: 'Groupe 1' },
  ];
  const inscrits = [
    { email: 'camille.martin@exemple.fr', prenom: 'Camille', nom: 'Martin', role: 'etudiant', promo: 'D2', groupe_id: gA, actif: true },
    { email: 'leo.bernard@exemple.fr', prenom: 'Léo', nom: 'Bernard', role: 'etudiant', promo: 'D2', groupe_id: gB, actif: true },
    { email: 'ines.roux@exemple.fr', prenom: 'Inès', nom: 'Roux', role: 'etudiant', promo: 'D3', groupe_id: 'grp-d3-1', actif: true },
    ...[['Emma', 'Garcia', gA], ['Lucas', 'Moreau', gA], ['Chloé', 'Fournier', gB], ['Nathan', 'Girard', gB], ['Manon', 'Lambert', gA], ['Théo', 'Bonnet', gB]].map(
      ([prenom, nom, groupe_id]) => ({ email: `${prenom}.${nom}@exemple.fr`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''), prenom, nom, role: 'etudiant', promo: 'D2', groupe_id, actif: true })
    ),
    { email: 'hugo.petit@exemple.fr', prenom: 'Hugo', nom: 'Petit', role: 'etudiant', promo: 'D1', groupe_id: null, actif: true },
    { email: 'sarah.leroy@exemple.fr', prenom: 'Sarah', nom: 'Leroy', role: 'etudiant', promo: 'D4', groupe_id: null, actif: true },
    { email: 'dr.durand@exemple.fr', prenom: 'Paul', nom: 'Durand', role: 'enseignant', promo: null, groupe_id: null, actif: true },
    { email: 'equipe@exemple.fr', prenom: 'Julien', nom: 'MDEPi', role: 'admin', promo: null, groupe_id: null, actif: true },
  ];
  const s = (titre, matiere, debut, fin, lieu, extra = {}) => ({
    id: uid(),
    titre,
    matiere,
    debut,
    fin,
    lieu,
    presentiel: lieu !== 'En ligne',
    zoom_url: 'https://zoom.us/j/0000000000',
    epreuve: false,
    annulee: false,
    promos: ['D2'],
    groupes: [],
    replay_url: null,
    replay_duree_min: null,
    modifiee_le: null,
    serie: null,
    correction_publiee: false,
    publication: 'cloture',
    publication_le: null,
    ...extra,
  });
  const seances = [
    s('Cardiologie : syndromes coronariens aigus', 'Cardiologie', jour(4, 18, 30), jour(4, 21, 30), '94 rue Sainte-Cécile'),
    s('Pneumologie : BPCO et asthme', 'Pneumologie', jour(6, 18, 30), jour(6, 21, 30), 'En ligne'),
    s('Néphrologie : insuffisance rénale aiguë', 'Néphrologie', jour(8, 9), jour(8, 12), '90 rue Sainte-Cécile', {
      groupes: [gA],
      modifiee_le: jour(-1, 10),
    }),
    s('Gastro-entérologie : hémorragies digestives', 'Gastro-entérologie', jour(11, 18, 30), jour(11, 21, 30), '94 rue Sainte-Cécile', {
      groupes: [gB],
    }),
    s('CCB n°3 · examen blanc', 'Toutes matières', jour(15, 9), jour(15, 12), '106 rue Sainte-Cécile', { epreuve: true, zoom_url: null, groupes: [gA] }),
    s('CCB n°3 · examen blanc', 'Toutes matières', jour(16, 9), jour(16, 12), '106 rue Sainte-Cécile', { epreuve: true, zoom_url: null, groupes: [gB] }),
    s('CCB n°2 · hépato-gastro', 'Hépato-gastro-entérologie', jour(-10, 9), jour(-10, 12), '106 rue Sainte-Cécile', { epreuve: true, zoom_url: null }),
    s('Partiel blanc · hépato-biliaire', 'Hépato-gastro-entérologie', jour(-2, 9), jour(-2, 11), '106 rue Sainte-Cécile', { epreuve: true, zoom_url: null, groupes: [gA] }),
    s('Partiel blanc · hépato-biliaire', 'Hépato-gastro-entérologie', jour(2, 9), jour(2, 11), '106 rue Sainte-Cécile', { epreuve: true, zoom_url: null, groupes: [gB] }),
    s('Épreuve en ligne · HGE', 'Hépato-gastro-entérologie', minutes(-20), minutes(100), 'En ligne', { epreuve: true, zoom_url: null }),
    s('Hématologie : anémies', 'Hématologie', jour(18, 18, 30), jour(18, 21, 30), '94 rue Sainte-Cécile', { annulee: true, modifiee_le: jour(0, 8) }),
    s('Endocrinologie : diabète de type 2', 'Endocrinologie', jour(-3, 18, 30), jour(-3, 21, 22), '94 rue Sainte-Cécile', {
      replay_url: 'https://zoom.us/rec/share/demo',
      replay_duree_min: 172,
    }),
    s('Infectiologie : sepsis et choc septique', 'Infectiologie', jour(-8, 18, 30), jour(-8, 21, 10), 'En ligne', {
      replay_url: 'https://zoom.us/rec/share/demo',
      replay_duree_min: 160,
    }),
    s('Neurologie : AVC et AIT', 'Neurologie', jour(-13, 18, 30), jour(-13, 21, 35), '94 rue Sainte-Cécile', {
      replay_url: 'https://zoom.us/rec/share/demo',
      replay_duree_min: 185,
    }),
    s('Rhumatologie : polyarthrite rhumatoïde', 'Rhumatologie', jour(5, 18, 30), jour(5, 21, 30), '94 rue Sainte-Cécile', { promos: ['D3'] }),
    s('Pédiatrie : bronchiolite', 'Pédiatrie', jour(-6, 18, 30), jour(-6, 21, 0), 'En ligne', {
      promos: ['D3'],
      replay_url: 'https://zoom.us/rec/share/demo',
      replay_duree_min: 150,
    }),
    s('Sémiologie cardiaque', 'Cardiologie', jour(3, 18, 30), jour(3, 20, 30), '90 rue Sainte-Cécile', { promos: ['D1'] }),
    s('Gynécologie : grossesse extra-utérine', 'Gynécologie', jour(2, 18, 30), jour(2, 21, 30), '94 rue Sainte-Cécile', { promos: ['D4'] }),
  ];
  const par = (debutTitre) => seances.find((x) => x.titre.startsWith(debutTitre));
  // CCB n°3 : même épreuve pour les groupes A et B (une série, un classement).
  const [ccb3A, ccb3B] = seances.filter((x) => x.titre.startsWith('CCB n°3'));
  ccb3B.serie = ccb3A.id;
  // Partiel blanc : le groupe A l'a passé, le groupe B le passe dans deux jours.
  const [partielA, partielB] = seances.filter((x) => x.titre.startsWith('Partiel blanc'));
  partielB.serie = partielA.id;
  const documents = [
    { id: uid(), seance_id: par('Endocrino').id, type: 'support', titre: 'Diabète de type 2 – support', chemin: 'demo/support.pdf' },
    { id: uid(), seance_id: par('Endocrino').id, type: 'correction', titre: 'Diabète de type 2 – diapos de correction', chemin: 'demo/correction.pdf' },
    { id: uid(), seance_id: par('Infectio').id, type: 'support', titre: 'Sepsis – support', chemin: 'demo/support2.pdf' },
    { id: uid(), seance_id: par('CCB n°2').id, type: 'correction', titre: 'CCB n°2 – diapos de correction', chemin: 'demo/ccb2-correction.pdf' },
  ];
  const annonces = [
    { id: uid(), texte: 'CCB n°3 dans deux semaines, au 106 rue Sainte-Cécile. Arrivez 15 minutes en avance.', promos: ['D2'], publiee_le: jour(0, 8) },
    { id: uid(), texte: 'La conférence d’hématologie est annulée et sera reprogrammée.', promos: ['D2'], publiee_le: jour(0, 9) },
    { id: uid(), texte: 'Replay de la conférence d’endocrinologie en ligne.', promos: ['D2'], publiee_le: jour(-2, 10) },
    { id: uid(), texte: 'Bienvenue sur l’app MDEPi ! Ajoutez-la à votre écran d’accueil pour la retrouver facilement.', promos: ['D1', 'D2', 'D3', 'D4'], publiee_le: jour(-5, 9) },
  ];
  const qcm = { dossiers: [], questions: [], corrections: {}, copies: [], images: {} };
  const poser = (seance, dossiers) => importer(qcm, seance.id, dossiers);
  poser(par('CCB n°2'), [...QCM_DEMO.kfp1, ...QCM_DEMO.dp4, ...QCM_DEMO.kfp2]);
  poser(par('Épreuve en ligne'), [...QCM_DEMO.dp4, ...QCM_DEMO.kfp2]);
  poser(ccb3A, QCM_DEMO.dp4);

  poser(partielA, [...QCM_DEMO.dp4, ...QCM_DEMO.kfp2]);

  // Copies fictives (réponses plus ou moins justes) des étudiants concernés.
  const semer = (seance, j, graine) => {
    const questions = qcm.questions.filter((q) => q.serie_id === seance.id);
    inscrits
      .filter((i) => i.promo === 'D2' && (!seance.groupes.length || seance.groupes.includes(i.groupe_id)))
      .forEach((i, n) => {
        const alea = hasard(n + graine);
        const niveau = 0.8 + 0.18 * alea();
        const reponses = {};
        for (const q of questions) {
          const c = qcm.corrections[q.id];
          const choix = q.propositions.filter((p) => (alea() < niveau) === c.bonnes.includes(p.id)).map((p) => p.id);
          const variantes = REPONSES_QROC_DEMO[q.qti_id] || [];
          const texte = q.type === 'QROC' ? variantes[Math.floor(alea() * variantes.length)] || '' : '';
          reponses[q.id] = { question_id: q.id, choix: q.type === 'QRU' ? choix.slice(0, 1) : choix, texte, validee: true, modifiee_le: jour(j, 10) };
        }
        qcm.copies.push({ id: uid(), seance_id: seance.id, user_id: i.email, commencee_le: jour(j, 9, 2), rendue_le: jour(j, 10, 50 - n * 3), reponses });
      });
  };
  semer(par('CCB n°2'), -10, 7);
  semer(partielA, -2, 3);
  // CCB n°2 : QROC déjà corrigées par l'équipe (réponses proches confirmées,
  // les autres refusées). Le partiel blanc garde des réponses à corriger.
  for (const q of qcm.questions.filter((x) => x.serie_id === par('CCB n°2').id && x.type === 'QROC')) {
    const c = qcm.corrections[q.id];
    for (const cp of qcm.copies) {
      const t = cp.reponses[q.id]?.texte;
      const m = t && corrigerQroc(t, c.reponses_qroc, c.refusees_qroc, c.partielles_qroc).mode;
      if (m === 'approche') c.reponses_qroc.push(t);
      if (m === 'faux') c.refusees_qroc.push(t);
    }
  }

  return { groupes, inscrits, seances, documents, annonces, lues: {}, session: null, entrainements: [], ...qcm };
}

// Range un QCM (dossiers issus de l'import) dans la base de démo.
function importer(db, serie, dossiers) {
  const anciens = new Set(db.questions.filter((q) => q.serie_id === serie).map((q) => q.id));
  db.questions = db.questions.filter((q) => q.serie_id !== serie);
  db.dossiers = db.dossiers.filter((d) => d.serie_id !== serie);
  anciens.forEach((id) => delete db.corrections[id]);
  dossiers.forEach((d, di) => {
    const dossier = { id: uid(), serie_id: serie, titre: d.titre, matiere: d.matiere || '', contexte: d.contexte || '', ordre: di };
    db.dossiers.push(dossier);
    d.questions.forEach((q, qi) => {
      const id = uid();
      db.questions.push({ id, serie_id: serie, dossier_id: dossier.id, qti_id: q.qti_id, ordre: di * 1000 + qi, type: q.type, enonce: q.enonce, propositions: q.propositions, nb_reponses: q.nb_reponses || null, coefficient: q.coefficient || 1, statut: 'normale' });
      db.corrections[id] = { question_id: id, refusees_qroc: [], partielles_qroc: [], indispensables: [], inacceptables: [], ...q.correction };
    });
  });
}

function charger() {
  try {
    const brut = localStorage.getItem(CLE);
    if (brut) return JSON.parse(brut);
  } catch {
    /* stockage indisponible : on repart des données de démo */
  }
  return donneesInitiales();
}

export function creerBackendDemo() {
  let db = charger();
  const ecouteurs = [];
  const sauver = () => {
    try {
      localStorage.setItem(CLE, JSON.stringify(db));
    } catch {
      /* ignoré */
    }
  };
  const pause = () => new Promise((r) => setTimeout(r, 120));
  const profil = () => {
    if (!db.session) return null;
    const i = db.inscrits.find((x) => x.email === db.session);
    return i ? { id: i.email, ...i } : null;
  };
  const exiger = (test) => {
    if (!test(profil())) throw new Error("Vous n'avez pas les droits pour cette action.");
  };
  const notifier = (evt) => ecouteurs.forEach((cb) => cb(evt));
  const ouverte = (s) => s.epreuve && !s.annulee && new Date(s.debut) <= new Date() && new Date() <= new Date(new Date(s.fin).getTime() + 2 * 60000);
  const serieVisible = (serie, test) => estEquipe(profil()) || db.seances.some((x) => serieDe(x) === serie && peutVoirSeance(profil(), x) && test(x));
  const voirSujet = (serie) => serieVisible(serie, (x) => new Date(x.debut) <= new Date());
  // Même règle que peut_voir_correction (schema.sql) : dès la fin de sa propre séance, ou publication anticipée.
  const groupesRestants = (serie) => db.seances.filter((x) => serieDe(x) === serie && !x.annulee && new Date(x.fin) > new Date()).length;
  // Même règle que resultats_publies (schema.sql) : jamais, dès la fin, ou à partir d'une date.
  const finie = (x) => new Date() > new Date(new Date(x.fin).getTime() + 2 * 60000);
  const publies = (x) => finie(x) && ((x.publication || 'cloture') === 'cloture' || (x.publication === 'date' && !!x.publication_le && new Date() >= new Date(x.publication_le)));
  const voirCorrection = (serie) => serieVisible(serie, (x) => !x.annulee && (x.correction_publiee || publies(x)));
  const qrocEnAttente = (serie) => {
    const ids = new Set(db.seances.filter((x) => serieDe(x) === serie).map((x) => x.id));
    return qrocACorriger(db.questions.filter((q) => q.serie_id === serie), db.corrections, db.copies.filter((c) => ids.has(c.seance_id)).map((c) => ({ reponses: Object.values(c.reponses) })));
  };
  // Même règle que question_accessible (schema.sql) : dossier progressif.
  const questionAccessible = (q) => {
    if (estEquipe(profil()) || voirCorrection(q.serie_id)) return true;
    const prec = db.questions.filter((x) => x.dossier_id === q.dossier_id && x.ordre < q.ordre).sort((a, b) => b.ordre - a.ordre)[0];
    if (!prec) return true;
    const ids = new Set(db.seances.filter((x) => serieDe(x) === q.serie_id).map((x) => x.id));
    return db.copies.some((c) => ids.has(c.seance_id) && c.user_id === db.session && c.reponses[prec.id]?.validee);
  };
  const notesSerie = (serie, finies = false) => {
    const ids = new Set(db.seances.filter((x) => serieDe(x) === serie && (!finies || new Date(x.fin) <= new Date())).map((x) => x.id));
    const questions = db.questions.filter((q) => q.serie_id === serie);
    const lignes = db.copies
      .filter((c) => ids.has(c.seance_id))
      .map((c) => {
        const i = db.inscrits.find((x) => x.email === c.user_id) || {};
        const g = db.groupes.find((x) => x.id === i.groupe_id);
        return { seance_id: c.seance_id, user_id: c.user_id, email: i.email, prenom: i.prenom, nom: i.nom, groupe: g?.nom || null, commencee_le: c.commencee_le, rendue_le: c.rendue_le, ...noterCopie(questions, db.corrections, c.reponses) };
      })
      .sort((a, b) => b.note20 - a.note20 || (a.nom || '').localeCompare(b.nom || ''));
    lignes.forEach((l) => (l.rang = 1 + lignes.filter((o) => o.note20 > l.note20).length));
    return lignes;
  };

  return {
    mode: 'demo',
    reinitialiser() {
      db = donneesInitiales();
      sauver();
      notifier('SIGNED_OUT');
    },
    comptesDemo: () => db.inscrits.filter((i) => i.actif),

    async session() {
      const p = profil();
      return p && p.actif ? { user: { email: p.email }, profil: p } : null;
    },
    surChangement(cb) {
      ecouteurs.push(cb);
    },
    async envoyerCode(email) {
      await pause();
      const i = db.inscrits.find((x) => x.email === email.trim().toLowerCase() && x.actif);
      if (!i) throw new Error("Cette adresse n'est pas inscrite à la MDEPi. Vérifiez-la ou contactez l'équipe.");
    },
    async verifierCode(email, code) {
      await pause();
      if (String(code).replace(/\D/g, '') !== CODE_DEMO) throw new Error('Code incorrect ou expiré. Demandez un nouveau code.');
      db.session = email.trim().toLowerCase();
      sauver();
      notifier('SIGNED_IN');
    },
    async connexionMotDePasse(email) {
      await pause();
      const i = db.inscrits.find((x) => x.email === email.trim().toLowerCase() && x.actif);
      if (!i) throw new Error('E-mail ou mot de passe incorrect.');
      db.session = i.email;
      sauver();
      notifier('SIGNED_IN');
    },
    async definirMotDePasse(mdp) {
      if (mdp.length < 8) throw new Error('Mot de passe trop court (8 caractères minimum).');
    },
    async deconnexion() {
      db.session = null;
      sauver();
      notifier('SIGNED_OUT');
    },

    async seances() {
      const p = profil();
      return db.seances.filter((s) => peutVoirSeance(p, s)).sort((a, b) => a.debut.localeCompare(b.debut));
    },
    async seance(id) {
      const s = db.seances.find((x) => x.id === id);
      return s && peutVoirSeance(profil(), s) ? s : null;
    },
    async documents(seanceId) {
      const s = await this.seance(seanceId);
      return s ? db.documents.filter((d) => d.seance_id === seanceId) : [];
    },
    async urlDocument() {
      const pdf = '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 595 842]/Parent 2 0 R>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF';
      return URL.createObjectURL(new Blob([pdf], { type: 'application/pdf' }));
    },

    // ---------- QCM des épreuves (mêmes règles que supabase/schema.sql, section 6) ----------
    async qcm(seanceId) {
      const s = await this.seance(seanceId);
      if (!s || !voirSujet(serieDe(s))) return [];
      const serie = serieDe(s);
      const qs = db.questions
        .filter((q) => q.serie_id === serie)
        .sort((a, b) => a.ordre - b.ordre)
        .map((q) => (questionAccessible(q) ? q : { id: q.id, serie_id: q.serie_id, dossier_id: q.dossier_id, ordre: q.ordre, type: '', enonce: '', propositions: [], verrouillee: true }));
      return db.dossiers
        .filter((d) => d.serie_id === serie)
        .sort((a, b) => a.ordre - b.ordre)
        .map((d) => ({ ...d, questions: qs.filter((q) => q.dossier_id === d.id) }));
    },
    async question(seanceId, questionId) {
      const q = db.questions.find((x) => x.id === questionId);
      return q && (await this.seance(seanceId)) && voirSujet(q.serie_id) && questionAccessible(q) ? q : null;
    },
    async infosQcm(seanceId) {
      const s = await this.seance(seanceId);
      const serie = s && serieDe(s);
      if (!s) return { questions: 0, dossiers: 0, correction_visible: false, groupes_restants: 0 };
      return {
        questions: db.questions.filter((q) => q.serie_id === serie).length,
        dossiers: db.dossiers.filter((d) => d.serie_id === serie).length,
        correction_visible: voirCorrection(serie),
        groupes_restants: groupesRestants(serie),
        resultats_publies: publies(s),
        publication: s.publication || 'cloture',
        publication_le: s.publication_le || null,
        qroc_en_cours: finie(s) && qrocEnAttente(serie) > 0,
      };
    },
    async corrections(seanceId) {
      const s = await this.seance(seanceId);
      if (!s || !voirCorrection(serieDe(s))) return {};
      const serie = serieDe(s);
      return Object.fromEntries(db.questions.filter((q) => q.serie_id === serie).map((q) => [q.id, db.corrections[q.id]]));
    },
    async urlsImages(chemins) {
      return Object.fromEntries(chemins.filter((c) => db.images[c]).map((c) => [c, db.images[c]]));
    },
    async seancesSerie(seanceId) {
      const s = await this.seance(seanceId);
      return db.seances.filter((x) => serieDe(x) === serieDe(s)).sort((a, b) => a.debut.localeCompare(b.debut));
    },
    async importerQcm(seanceId, dossiers, images = {}) {
      exiger(estEquipe);
      await pause();
      const s = await this.seance(seanceId);
      const serie = serieDe(s);
      const ids = new Set(db.seances.filter((x) => serieDe(x) === serie).map((x) => x.id));
      if (db.copies.some((c) => ids.has(c.seance_id))) throw new Error('Des étudiants ont déjà commencé cette épreuve : le QCM ne peut plus être remplacé.');
      const renommage = {};
      for (const [i, chemin] of imagesUtilisees(dossiers, images).entries()) {
        const nom = `qcm/${serie}/${i}`;
        db.images[nom] = await new Promise((ok) => {
          const r = new FileReader();
          r.onload = () => ok(r.result);
          r.readAsDataURL(images[chemin]);
        });
        renommage[chemin] = nom;
      }
      importer(db, serie, renommerImages(dossiers, renommage));
      sauver();
    },
    async supprimerQcm(seanceId) {
      await this.importerQcm(seanceId, []);
    },
    async modifierCorrection(questionId, champs) {
      exiger(estEquipe);
      Object.assign(db.corrections[questionId], champs);
      sauver();
    },
    async modifierQuestion(questionId, champs) {
      exiger(estEquipe);
      Object.assign(db.questions.find((q) => q.id === questionId), champs);
      sauver();
    },
    async choisirPublication(seanceId, publication, publicationLe) {
      exiger(estEquipe);
      const s = await this.seance(seanceId);
      db.seances.filter((x) => serieDe(x) === serieDe(s)).forEach((x) => Object.assign(x, { publication, publication_le: publication === 'date' ? publicationLe : null }));
      sauver();
    },
    async publierCorrection(seanceId, publiee) {
      exiger(estEquipe);
      const s = await this.seance(seanceId);
      db.seances.filter((x) => serieDe(x) === serieDe(s)).forEach((x) => (x.correction_publiee = publiee));
      sauver();
    },
    async commencerEpreuve(seanceId) {
      await pause();
      const s = db.seances.find((x) => x.id === seanceId);
      if (!s || !peutVoirSeance(profil(), s) || !s.epreuve) throw new Error('Épreuve introuvable.');
      const c = db.copies.find((x) => x.seance_id === seanceId && x.user_id === db.session);
      if (c) return c.id;
      if (!ouverte(s)) throw new Error('Épreuve fermée.');
      const copie = { id: uid(), seance_id: seanceId, user_id: db.session, commencee_le: new Date().toISOString(), rendue_le: null, reponses: {} };
      db.copies.push(copie);
      sauver();
      return copie.id;
    },
    async maCopie(seanceId) {
      const c = db.copies.find((x) => x.seance_id === seanceId && x.user_id === db.session);
      return c ? structuredClone(c) : null;
    },
    async enregistrerReponse(seanceId, questionId, choix, texte, valider) {
      await new Promise((r) => setTimeout(r, 60));
      if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new Error('Pas de connexion internet.');
      const s = db.seances.find((x) => x.id === seanceId);
      const c = db.copies.find((x) => x.seance_id === seanceId && x.user_id === db.session);
      if (!c) throw new Error('Copie introuvable.');
      if (c.rendue_le) throw new Error('Copie déjà rendue.');
      if (!ouverte(s)) throw new Error('Épreuve fermée.');
      const q = db.questions.find((x) => x.id === questionId && x.serie_id === serieDe(s));
      if (!q) throw new Error('Question introuvable.');
      if ((choix || []).some((id) => !q.propositions.some((p) => p.id === id))) throw new Error('Proposition inconnue.');
      if (!questionAccessible(q)) throw new Error('Question pas encore accessible.');
      if (q.type === 'QRP' && (choix || []).length > (q.nb_reponses || 99)) throw new Error(`Trop de cases cochées : ${q.nb_reponses} réponses attendues.`);
      if (c.reponses[questionId]?.validee) throw new Error('Question déjà validée.');
      c.reponses[questionId] = { question_id: questionId, choix: choix || [], texte: (texte || '').slice(0, 500), validee: !!valider, modifiee_le: new Date().toISOString() };
      sauver();
    },
    async rendreCopie(seanceId) {
      const c = db.copies.find((x) => x.seance_id === seanceId && x.user_id === db.session);
      if (c && !c.rendue_le) c.rendue_le = new Date().toISOString();
      sauver();
    },
    async monResultat(seanceId) {
      const s = await this.seance(seanceId);
      if (!s || !publies(s) || qrocEnAttente(serieDe(s)) > 0) return null;
      const notes = notesSerie(serieDe(s), true);
      const moi = notes.find((n) => n.seance_id === seanceId && n.user_id === db.session);
      if (!moi) return null;
      const moyenne = Math.round((100 * notes.reduce((a, n) => a + n.note20, 0)) / notes.length) / 100;
      return { points: moi.points, total: moi.total, note20: moi.note20, moyenne, rang: moi.rang, effectif: notes.length, groupes_restants: groupesRestants(serieDe(s)) };
    },
    async mesEntrainements() {
      return db.entrainements.filter((e) => e.user_id === db.session).sort((a, b) => b.fait_le.localeCompare(a.fait_le));
    },
    async enregistrerEntrainement(seanceId, reponses, points, total) {
      const s = await this.seance(seanceId);
      if (!s || !voirCorrection(serieDe(s))) throw new Error("Vous n'avez pas les droits pour cette action.");
      const e = { id: uid(), user_id: db.session, serie_id: serieDe(s), reponses, points, total, fait_le: new Date().toISOString() };
      db.entrainements.push(e);
      sauver();
      return e;
    },
    async resultatsEpreuve(seanceId) {
      exiger(estEquipe);
      const s = db.seances.find((x) => x.id === seanceId);
      return notesSerie(serieDe(s));
    },
    async copiesEpreuve(seanceId) {
      exiger(estEquipe);
      const s = db.seances.find((x) => x.id === seanceId);
      const ids = new Set(db.seances.filter((x) => serieDe(x) === serieDe(s)).map((x) => x.id));
      return db.copies.filter((c) => ids.has(c.seance_id)).map((c) => ({ ...structuredClone(c), reponses: Object.values(c.reponses) }));
    },

    async annonces() {
      const p = profil();
      return db.annonces.filter((a) => peutVoirAnnonce(p, a)).sort((a, b) => b.publiee_le.localeCompare(a.publiee_le));
    },
    async annoncesLues() {
      return new Set(db.lues[db.session] || []);
    },
    async marquerLues(ids) {
      const deja = new Set(db.lues[db.session] || []);
      ids.forEach((i) => deja.add(i));
      db.lues[db.session] = [...deja];
      sauver();
    },

    async groupes() {
      exiger((p) => !!p);
      return [...db.groupes].sort((a, b) => (a.promo + a.nom).localeCompare(b.promo + b.nom));
    },
    async creerGroupe(promo, nom) {
      exiger(estAdmin);
      if (db.groupes.some((g) => g.promo === promo && g.nom === nom)) throw new Error('Ce groupe existe déjà.');
      const g = { id: uid(), promo, nom };
      db.groupes.push(g);
      sauver();
      return g;
    },
    async supprimerGroupe(id) {
      exiger(estAdmin);
      db.groupes = db.groupes.filter((g) => g.id !== id);
      db.inscrits.forEach((i) => i.groupe_id === id && (i.groupe_id = null));
      sauver();
    },
    async inscrits() {
      exiger(estAdmin);
      return [...db.inscrits].sort((a, b) => (a.nom + a.prenom).localeCompare(b.nom + b.prenom));
    },
    async enregistrerInscrits(lignes) {
      exiger(estAdmin);
      for (const l of lignes) {
        const i = db.inscrits.find((x) => x.email === l.email);
        if (i) Object.assign(i, l);
        else db.inscrits.push({ actif: true, groupe_id: null, ...l });
      }
      sauver();
    },
    async modifierInscrit(email, champs) {
      exiger(estAdmin);
      Object.assign(db.inscrits.find((x) => x.email === email), champs);
      sauver();
    },
    async passageAnnee() {
      exiger(estAdmin);
      let n = 0;
      const suivante = { D1: 'D2', D2: 'D3', D3: 'D4' };
      for (const i of db.inscrits) {
        if (i.role !== 'etudiant' || !i.actif) continue;
        if (i.promo === 'D4') i.actif = false;
        else if (suivante[i.promo]) {
          i.promo = suivante[i.promo];
          i.groupe_id = null;
          n++;
        }
      }
      sauver();
      return n;
    },
    async enregistrerSeance(seance) {
      exiger(estEquipe);
      if (seance.id) {
        const s = db.seances.find((x) => x.id === seance.id);
        Object.assign(s, seance);
        sauver();
        return s;
      }
      const s = { ...seance, id: uid() };
      db.seances.push(s);
      sauver();
      return s;
    },
    async supprimerSeance(id) {
      exiger(estEquipe);
      db.seances = db.seances.filter((s) => s.id !== id);
      db.documents = db.documents.filter((d) => d.seance_id !== id);
      db.copies = db.copies.filter((c) => c.seance_id !== id);
      db.seances.forEach((x) => x.serie === id && (x.serie = null));
      importer(db, id, []); // le QCM de la série part avec la séance d'origine
      sauver();
    },
    async ajouterDocument(seanceId, type, fichier) {
      exiger(estEquipe);
      const d = { id: uid(), seance_id: seanceId, type, titre: fichier.name.replace(/\.pdf$/i, ''), chemin: `demo/${fichier.name}` };
      db.documents.push(d);
      sauver();
      return d;
    },
    async supprimerDocument(doc) {
      exiger(estEquipe);
      db.documents = db.documents.filter((d) => d.id !== doc.id);
      sauver();
    },
    async publierAnnonce(texte, promos) {
      exiger(estAdmin);
      const a = { id: uid(), texte, promos, publiee_le: new Date().toISOString() };
      db.annonces.push(a);
      sauver();
      return a;
    },
    async supprimerAnnonce(id) {
      exiger(estAdmin);
      db.annonces = db.annonces.filter((a) => a.id !== id);
      sauver();
    },
  };
}
