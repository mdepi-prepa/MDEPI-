// Mode démo : mêmes fonctions que supabase.js, avec des données fictives
// gardées dans le navigateur. Sert à essayer l'app sans base de données
// (préview, développement). Code de connexion : 123456.
import { peutVoirSeance, peutVoirAnnonce, estAdmin, estEquipe } from '../lib/acces.js';

const CLE = 'mdepi-demo-v2';
export const CODE_DEMO = '123456';

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2));

// Date à J+n, à h:m heure de Paris (approximation UTC+1 en hiver suffisante pour la démo).
function jour(n, h, m = 0) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  d.setUTCHours(h - 1, m, 0, 0);
  return d.toISOString();
}

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
    s('CCB n°2 · cardio-pneumo', 'Cardiologie, pneumologie', jour(-10, 9), jour(-10, 12), '106 rue Sainte-Cécile', { epreuve: true, zoom_url: null }),
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
  const documents = [
    { id: uid(), seance_id: par('Endocrino').id, type: 'support', titre: 'Diabète de type 2 – support', chemin: 'demo/support.pdf' },
    { id: uid(), seance_id: par('Endocrino').id, type: 'correction', titre: 'Diabète de type 2 – diapos de correction', chemin: 'demo/correction.pdf' },
    { id: uid(), seance_id: par('Infectio').id, type: 'support', titre: 'Sepsis – support', chemin: 'demo/support2.pdf' },
    { id: uid(), seance_id: par('CCB n°2').id, type: 'sujet', titre: 'CCB n°2 – sujet', chemin: 'demo/ccb2-sujet.pdf' },
    { id: uid(), seance_id: par('CCB n°2').id, type: 'correction', titre: 'CCB n°2 – correction', chemin: 'demo/ccb2-correction.pdf' },
  ];
  const annonces = [
    { id: uid(), texte: 'CCB n°3 dans deux semaines, au 106 rue Sainte-Cécile. Arrivez 15 minutes en avance.', promos: ['D2'], publiee_le: jour(0, 8) },
    { id: uid(), texte: 'La conférence d’hématologie est annulée et sera reprogrammée.', promos: ['D2'], publiee_le: jour(0, 9) },
    { id: uid(), texte: 'Replay de la conférence d’endocrinologie en ligne.', promos: ['D2'], publiee_le: jour(-2, 10) },
    { id: uid(), texte: 'Bienvenue sur l’app MDEPi ! Ajoutez-la à votre écran d’accueil pour la retrouver facilement.', promos: ['D1', 'D2', 'D3', 'D4'], publiee_le: jour(-5, 9) },
  ];
  return { groupes, inscrits, seances, documents, annonces, lues: {}, session: null };
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
      if (code.trim() !== CODE_DEMO) throw new Error('Code incorrect ou expiré. Demandez un nouveau code.');
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
