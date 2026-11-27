// Accès aux données via Supabase. La sécurité (qui voit quoi) est assurée
// par la base elle-même (règles RLS de supabase/schema.sql) : ce fichier
// ne fait que lire et écrire.
import { createClient } from '@supabase/supabase-js';
import { serieDe, imagesUtilisees, nomImageStockage, renommerImages } from '../lib/qcm.js';

const DEJA_COMMENCE = 'Des étudiants ont déjà commencé cette épreuve : on ne peut plus ajouter ni retirer de question (les corrections restent modifiables).';

let urlServeur = '';

export function creerBackendSupabase(url, cleAnon) {
  urlServeur = url;
  const sb = createClient(url, cleAnon, { auth: { persistSession: true, autoRefreshToken: true } });

  const verifier = ({ data, error }) => {
    if (error) throw new Error(traduireErreur(error));
    return data;
  };

  return {
    mode: 'supabase',

    // ---------- Connexion ----------
    async session() {
      const { data } = await sb.auth.getSession();
      if (!data.session) return null;
      const profil = verifier(await sb.from('profils').select('*').eq('id', data.session.user.id).maybeSingle());
      return profil ? { user: data.session.user, profil } : null;
    },
    surChangement(cb) {
      sb.auth.onAuthStateChange((evt) => {
        if (evt === 'SIGNED_IN' || evt === 'SIGNED_OUT') cb(evt);
      });
    },
    async envoyerCode(email) {
      verifier(await sb.auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { shouldCreateUser: true } }));
    },
    async verifierCode(email, code) {
      verifier(await sb.auth.verifyOtp({ email: email.trim().toLowerCase(), token: String(code).replace(/\D/g, ''), type: 'email' }));
    },
    async connexionMotDePasse(email, motDePasse) {
      verifier(await sb.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: motDePasse }));
    },
    async definirMotDePasse(motDePasse) {
      verifier(await sb.auth.updateUser({ password: motDePasse }));
    },
    async deconnexion(partout = false) {
      verifier(await sb.auth.signOut({ scope: partout ? 'global' : 'local' }));
    },

    // ---------- Planning ----------
    async seances() {
      return verifier(await sb.from('seances').select('*').order('debut'));
    },
    // Épreuves de tous les groupes (intitulé, horaire, groupe, salle).
    async planningGlobal(debut, fin) {
      return verifier(await sb.rpc('planning_global', { p_debut: debut, p_fin: fin }));
    },
    async seance(id) {
      return verifier(await sb.from('seances').select('*').eq('id', id).maybeSingle());
    },
    async documents(seanceId) {
      return verifier(await sb.from('documents').select('*').eq('seance_id', seanceId).order('created_at'));
    },
    async urlDocument(chemin) {
      // Lien temporaire (1 h) : il ne sert à rien de le partager.
      const data = verifier(await sb.storage.from('documents').createSignedUrl(chemin, 3600));
      return data.signedUrl;
    },

    // ---------- QCM des épreuves ----------
    // Sujet de l'épreuve (sans les bonnes réponses), dossier par dossier.
    async qcm(seanceId) {
      const s = await this.seance(seanceId);
      if (!s) return [];
      const serie = serieDe(s);
      const [dossiers, plan, questions] = await Promise.all([
        sb.from('dossiers').select('*').eq('serie_id', serie).order('ordre'),
        sb.rpc('plan_qcm', { p_seance: seanceId }),
        sb.from('questions').select('*').eq('serie_id', serie).order('ordre'),
      ]).then((r) => r.map(verifier));
      // Dossier progressif : la base ne donne le contenu d'une question qu'une fois
      // la précédente validée. Les autres restent numérotées, « verrouillées ».
      const parId = new Map(questions.map((q) => [q.id, q]));
      const toutes = plan.map((p) => parId.get(p.id) || { ...p, serie_id: serie, type: '', enonce: '', propositions: [], verrouillee: true });
      return dossiers.map((d) => ({ ...d, questions: toutes.filter((q) => q.dossier_id === d.id) }));
    },
    // Une question d'une épreuve, dès qu'elle est accessible (null sinon).
    async question(seanceId, questionId) {
      return verifier(await sb.from('questions').select('*').eq('id', questionId).maybeSingle());
    },
    async infosQcm(seanceId) {
      const [r] = verifier(await sb.rpc('infos_qcm', { p_seance: seanceId }));
      return r || { questions: 0, dossiers: 0, correction_visible: false, groupes_restants: 0, resultats_publies: false, publication: 'cloture', publication_le: null, qroc_en_cours: false };
    },
    // Bonnes réponses : visibles par l'équipe, et par les étudiants une fois la correction publiée.
    async corrections(seanceId) {
      const ids = (await this.qcm(seanceId)).flatMap((d) => d.questions.map((q) => q.id));
      if (!ids.length) return {};
      const rows = verifier(await sb.from('corrections').select('*').in('question_id', ids));
      return Object.fromEntries(rows.map((c) => [c.question_id, c]));
    },
    async urlsImages(chemins) {
      const data = verifier(await sb.storage.from('documents').createSignedUrls(chemins, 3600));
      return Object.fromEntries(data.filter((x) => x.signedUrl).map((x) => [x.path, x.signedUrl]));
    },
    async seancesSerie(seanceId) {
      const s = await this.seance(seanceId);
      const serie = serieDe(s);
      return verifier(await sb.from('seances').select('*').or(`id.eq.${serie},serie.eq.${serie}`).order('debut'));
    },
    // Remplace le QCM de toute la série. Refusé dès qu'une copie existe.
    async importerQcm(seanceId, dossiers, images = {}) {
      const s = await this.seance(seanceId);
      const serie = serieDe(s);
      const ids = (await this.seancesSerie(seanceId)).map((x) => x.id);
      const { count } = await sb.from('copies').select('id', { count: 'exact', head: true }).in('seance_id', ids);
      if (count) throw new Error('Des étudiants ont déjà commencé cette épreuve : le QCM ne peut plus être remplacé.');
      const renommage = {};
      for (const [i, chemin] of imagesUtilisees(dossiers, images).entries()) {
        const nom = nomImageStockage(serie, chemin, i);
        verifier(await sb.storage.from('documents').upload(nom, images[chemin], { upsert: true, contentType: images[chemin].type || undefined }));
        renommage[chemin] = nom;
      }
      dossiers = renommerImages(dossiers, renommage);
      verifier(await sb.from('dossiers').delete().eq('serie_id', serie));
      for (const [di, d] of dossiers.entries()) {
        const enreg = verifier(
          await sb.from('dossiers').insert({ serie_id: serie, titre: d.titre, matiere: d.matiere || '', contexte: d.contexte || '', ordre: di }).select().single()
        );
        const qs = verifier(
          await sb.from('questions').insert(
            d.questions.map((q, qi) => ({ serie_id: serie, dossier_id: enreg.id, qti_id: q.qti_id, ordre: di * 1000 + qi, type: q.type, enonce: q.enonce, propositions: q.propositions, nb_reponses: q.nb_reponses || null, coefficient: q.coefficient || 1 }))
          ).select('id, qti_id')
        );
        verifier(
          await sb.from('corrections').insert(
            d.questions.map((q) => ({ question_id: qs.find((x) => x.qti_id === q.qti_id).id, ...q.correction }))
          )
        );
      }
    },
    async supprimerQcm(seanceId) {
      await this.importerQcm(seanceId, []);
    },

    // ---------- Saisie manuelle d'un QCM (question par question) ----------
    async qcmCommence(seanceId) {
      const ids = (await this.seancesSerie(seanceId)).map((x) => x.id);
      const { count } = await sb.from('copies').select('id', { count: 'exact', head: true }).in('seance_id', ids);
      return !!count;
    },
    async creerDossier(seanceId, { titre, matiere }) {
      if (await this.qcmCommence(seanceId)) throw new Error(DEJA_COMMENCE);
      const serie = serieDe(await this.seance(seanceId));
      const der = verifier(await sb.from('dossiers').select('ordre').eq('serie_id', serie).order('ordre', { ascending: false }).limit(1));
      return verifier(await sb.from('dossiers').insert({ serie_id: serie, titre, matiere: matiere || '', ordre: der.length ? der[0].ordre + 1 : 0 }).select().single());
    },
    async modifierDossier(dossierId, champs) {
      verifier(await sb.from('dossiers').update(champs).eq('id', dossierId));
    },
    async supprimerDossier(seanceId, dossierId) {
      if (await this.qcmCommence(seanceId)) throw new Error(DEJA_COMMENCE);
      verifier(await sb.from('dossiers').delete().eq('id', dossierId));
    },
    // Crée (questionId vide) ou met à jour une question et sa correction.
    async enregistrerQuestionSaisie(seanceId, dossierId, questionId, q, correction) {
      const champs = { type: q.type, enonce: q.enonce, propositions: q.propositions, nb_reponses: q.nb_reponses || null, coefficient: q.coefficient || 1 };
      if (questionId) {
        verifier(await sb.from('questions').update(champs).eq('id', questionId));
        verifier(await sb.from('corrections').upsert({ question_id: questionId, ...correction }));
        return { id: questionId };
      }
      if (await this.qcmCommence(seanceId)) throw new Error(DEJA_COMMENCE);
      const serie = serieDe(await this.seance(seanceId));
      const d = verifier(await sb.from('dossiers').select('ordre').eq('id', dossierId).single());
      const der = verifier(await sb.from('questions').select('ordre').eq('dossier_id', dossierId).order('ordre', { ascending: false }).limit(1));
      const ordre = der.length ? der[0].ordre + 1 : d.ordre * 1000;
      const cree = verifier(
        await sb.from('questions').insert({ ...champs, serie_id: serie, dossier_id: dossierId, qti_id: 'SAISIE-' + crypto.randomUUID(), ordre }).select().single()
      );
      verifier(await sb.from('corrections').insert({ question_id: cree.id, ...correction }));
      return cree;
    },
    async supprimerQuestionSaisie(seanceId, questionId) {
      if (await this.qcmCommence(seanceId)) throw new Error(DEJA_COMMENCE);
      verifier(await sb.from('questions').delete().eq('id', questionId));
    },
    async ajouterImageQcm(seanceId, fichier) {
      const serie = serieDe(await this.seance(seanceId));
      const nom = nomImageStockage(serie, fichier.name, 's' + Date.now());
      verifier(await sb.storage.from('documents').upload(nom, fichier, { upsert: true, contentType: fichier.type || undefined }));
      return nom;
    },
    async modifierCorrection(questionId, champs) {
      verifier(await sb.from('corrections').update(champs).eq('question_id', questionId));
    },
    // Type (QRM/QRP), nombre de réponses attendues, coefficient, statut (neutralisée, annulée).
    async modifierQuestion(questionId, champs) {
      verifier(await sb.from('questions').update(champs).eq('id', questionId));
    },
    // Publication des résultats pour toute la série : 'jamais' | 'cloture' | 'date'.
    async choisirPublication(seanceId, publication, publicationLe) {
      const ids = (await this.seancesSerie(seanceId)).map((x) => x.id);
      verifier(await sb.from('seances').update({ publication, publication_le: publication === 'date' ? publicationLe : null }).in('id', ids));
    },
    async publierCorrection(seanceId, publiee) {
      const ids = (await this.seancesSerie(seanceId)).map((x) => x.id);
      verifier(await sb.from('seances').update({ correction_publiee: publiee }).in('id', ids));
    },

    // Passage de l'épreuve (étudiant). Les écritures passent par des fonctions SQL qui vérifient l'horaire.
    async commencerEpreuve(seanceId) {
      return verifier(await sb.rpc('commencer_epreuve', { p_seance: seanceId }));
    },
    async maCopie(seanceId) {
      const { data: u } = await sb.auth.getUser();
      const copie = verifier(await sb.from('copies').select('*, reponses(*)').eq('seance_id', seanceId).eq('user_id', u.user.id).maybeSingle());
      if (!copie) return null;
      const { reponses, ...c } = copie;
      return { ...c, reponses: Object.fromEntries(reponses.map((r) => [r.question_id, r])) };
    },
    async enregistrerReponse(seanceId, questionId, choix, texte, valider) {
      verifier(await sb.rpc('enregistrer_reponse', { p_seance: seanceId, p_question: questionId, p_choix: choix, p_texte: texte || '', p_valider: !!valider }));
    },
    async rendreCopie(seanceId) {
      verifier(await sb.rpc('rendre_copie', { p_seance: seanceId }));
    },
    async monResultat(seanceId) {
      const [r] = verifier(await sb.rpc('mon_resultat', { p_seance: seanceId }));
      return r ? { ...r, points: Number(r.points), note20: Number(r.note20), moyenne: Number(r.moyenne) } : null;
    },

    // Résultats et copies de toute la série (équipe).
    // Entraînement (épreuves terminées rejouées, hors classement).
    async mesEntrainements() {
      return verifier(await sb.from('entrainements').select('*').order('fait_le', { ascending: false }));
    },
    async enregistrerEntrainement(seanceId, reponses, points, total) {
      const s = await this.seance(seanceId);
      return verifier(await sb.from('entrainements').insert({ serie_id: serieDe(s), reponses, points, total }).select().single());
    },
    async moyennesEpreuve(seanceId) {
      const rows = verifier(await sb.rpc('moyennes_epreuve', { p_seance: seanceId }));
      return rows.map((r) => ({ ...r, moyenne: Number(r.moyenne) }));
    },
    async resultatsEpreuve(seanceId) {
      const rows = verifier(await sb.rpc('resultats_epreuve', { p_seance: seanceId }));
      return rows.map((r) => ({ ...r, points: Number(r.points), note20: Number(r.note20) }));
    },
    async copiesEpreuve(seanceId) {
      const ids = (await this.seancesSerie(seanceId)).map((x) => x.id);
      return verifier(await sb.from('copies').select('*, reponses(*)').in('seance_id', ids));
    },

    // ---------- Annonces ----------
    async annonces() {
      return verifier(await sb.from('annonces').select('*').order('publiee_le', { ascending: false }));
    },
    async annoncesLues() {
      const rows = verifier(await sb.from('annonces_lues').select('annonce_id'));
      return new Set(rows.map((r) => r.annonce_id));
    },
    async marquerLues(ids) {
      const { data } = await sb.auth.getUser();
      if (!ids.length || !data.user) return;
      verifier(
        await sb.from('annonces_lues').upsert(
          ids.map((annonce_id) => ({ user_id: data.user.id, annonce_id })),
          { onConflict: 'user_id,annonce_id', ignoreDuplicates: true }
        )
      );
    },

    // ---------- Back-office ----------
    async groupes() {
      return verifier(await sb.from('groupes').select('*').order('promo').order('nom'));
    },
    async creerGroupe(promo, nom) {
      return verifier(await sb.from('groupes').insert({ promo, nom }).select().single());
    },
    async supprimerGroupe(id) {
      verifier(await sb.from('groupes').delete().eq('id', id));
    },
    async inscrits() {
      return verifier(await sb.from('inscrits').select('*').order('nom').order('prenom'));
    },
    async enregistrerInscrits(lignes) {
      verifier(await sb.from('inscrits').upsert(lignes, { onConflict: 'email' }));
    },
    async modifierInscrit(email, champs) {
      verifier(await sb.from('inscrits').update(champs).eq('email', email));
    },
    async supprimerCompte(email) {
      return verifier(await sb.rpc('supprimer_compte', { p_email: email }));
    },
    async passageAnnee() {
      return verifier(await sb.rpc('passage_annee'));
    },
    async enregistrerSeance(seance) {
      const { id, ...champs } = seance;
      const ecrire = (c) => (id ? sb.from('seances').update(c).eq('id', id) : sb.from('seances').insert(c)).select().single();
      let r = await ecrire(champs);
      // Base pas encore mise à jour (colonne « categorie » absente) : une
      // conférence s'enregistre quand même ; un QCM d'entraînement demande la mise à jour.
      if (r.error && /categorie/.test(r.error.message || '')) {
        if (champs.categorie && champs.categorie !== 'conference') throw new Error('Base à mettre à jour : relancez supabase/schema.sql dans Supabase (SQL Editor), puis réessayez.');
        const { categorie, ...sans } = champs;
        r = await ecrire(sans);
      }
      return verifier(r);
    },
    async supprimerSeance(id) {
      verifier(await sb.from('seances').delete().eq('id', id));
    },
    async ajouterDocument(seanceId, type, fichier) {
      const propre = fichier.name.normalize('NFD').replace(/[^\w.-]+/g, '_');
      const chemin = `${seanceId}/${Date.now()}-${propre}`;
      verifier(await sb.storage.from('documents').upload(chemin, fichier, { contentType: fichier.type || 'application/pdf' }));
      return verifier(
        await sb.from('documents').insert({ seance_id: seanceId, type, titre: fichier.name.replace(/\.pdf$/i, ''), chemin }).select().single()
      );
    },
    async supprimerDocument(doc) {
      if (!doc) throw new Error('Document introuvable : rechargez la page.');
      // La ligne d'abord (c'est elle que l'app affiche), puis le fichier.
      const r = await sb.from('documents').delete().eq('id', doc.id).select('id');
      verifier(r);
      if (!r.data?.length) throw new Error("Le document n'a pas pu être retiré (droits insuffisants ?).");
      const { error } = await sb.storage.from('documents').remove([doc.chemin]);
      if (error) console.warn('Fichier non supprimé du stockage :', error.message);
    },
    async publierAnnonce(texte, promos) {
      return verifier(await sb.from('annonces').insert({ texte, promos }).select().single());
    },
    async supprimerAnnonce(id) {
      verifier(await sb.from('annonces').delete().eq('id', id));
    },
  };
}

function traduireErreur(e) {
  const m = e.message || String(e);
  if (/Database error saving new user|non inscrite/i.test(m)) return "Cette adresse n'est pas inscrite à la MDEPi. Vérifiez-la ou contactez l'équipe.";
  if (/Signups not allowed/i.test(m)) return "Cette adresse n'est pas inscrite à la MDEPi.";
  if (/Token has expired|invalid/i.test(m) && /otp|token/i.test(m)) return 'Code incorrect ou expiré. Demandez un nouveau code.';
  if (/Invalid login credentials/i.test(m)) return 'E-mail ou mot de passe incorrect.';
  if (/rate limit|too many/i.test(m)) return 'Trop de tentatives. Réessayez dans quelques minutes.';
  if (/Password should be/i.test(m)) return 'Mot de passe trop court (8 caractères minimum).';
  if (/row-level security/i.test(m)) return "Vous n'avez pas les droits pour cette action.";
  for (const t of ['Question pas encore accessible', 'Épreuve fermée', 'Copie déjà rendue', 'Question déjà validée', 'Copie introuvable', 'Épreuve introuvable', "Réservé à l'équipe"]) if (m.includes(t)) return t + '.';
  if (/Failed to fetch|NetworkError|Load failed|fetch failed/i.test(m)) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'Pas de connexion internet.';
    return `Serveur injoignable (${urlServeur}). Vérifiez l'adresse VITE_SUPABASE_URL et que le projet Supabase est actif. Détail : ${m}`;
  }
  if (/Invalid API key|No API key|JWT|apikey/i.test(m)) return `Clé Supabase refusée : vérifiez VITE_SUPABASE_ANON_KEY (clé « anon public »). Détail : ${m}`;
  return m;
}
