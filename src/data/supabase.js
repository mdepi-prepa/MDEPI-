// Accès aux données via Supabase. La sécurité (qui voit quoi) est assurée
// par la base elle-même (règles RLS de supabase/schema.sql) : ce fichier
// ne fait que lire et écrire.
import { createClient } from '@supabase/supabase-js';

export function creerBackendSupabase(url, cleAnon) {
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
      verifier(await sb.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: 'email' }));
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
    async passageAnnee() {
      return verifier(await sb.rpc('passage_annee'));
    },
    async enregistrerSeance(seance) {
      const { id, ...champs } = seance;
      if (id) return verifier(await sb.from('seances').update(champs).eq('id', id).select().single());
      return verifier(await sb.from('seances').insert(champs).select().single());
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
      verifier(await sb.storage.from('documents').remove([doc.chemin]));
      verifier(await sb.from('documents').delete().eq('id', doc.id));
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
  if (/Failed to fetch|NetworkError/i.test(m)) return 'Pas de connexion internet.';
  return m;
}
