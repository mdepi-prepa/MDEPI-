// Mon compte : infos, mot de passe, déconnexion (dont tous les appareils).
import { html } from '../lib/html.js';
import { libellePromo } from '../lib/promos.js';
import { enTete } from './commun.js';

export async function vueProfil(app) {
  const p = app.profil;
  const groupes = p.groupe_id ? await app.api.groupes().catch(() => []) : [];
  const groupe = groupes.find((g) => g.id === p.groupe_id);
  const role = { etudiant: 'Étudiant', enseignant: 'Conférencier', admin: 'Administrateur' }[p.role];

  const vue = html`<div class="page">
    ${enTete('Mon compte', p)}
    <section class="carte liste">
      <div class="ligne-info"><span>Nom</span><strong>${p.prenom} ${p.nom}</strong></div>
      <div class="ligne-info"><span>E-mail</span><strong>${p.email}</strong></div>
      <div class="ligne-info"><span>Rôle</span><strong>${role}</strong></div>
      ${p.promo ? html`<div class="ligne-info"><span>Promo</span><strong>${libellePromo(p.promo)}</strong></div>` : ''}
      ${groupe ? html`<div class="ligne-info"><span>Groupe de rotation</span><strong>${groupe.nom}</strong></div>` : ''}
    </section>
    <p class="aide">Une erreur de promo ou de groupe ? Signalez-la à l'équipe MDEPi, c'est elle qui les attribue.</p>

    <form class="carte pile" id="f-mdp">
      <h2 class="titre-section">Mot de passe</h2>
      <p class="aide">Facultatif : pour vous connecter sans attendre de code par e-mail.</p>
      <label class="champ"><span>Nouveau mot de passe (8 caractères minimum)</span>
        <input type="password" name="mdp" minlength="8" autocomplete="new-password" required></label>
      <button class="btn contour" type="submit">Enregistrer le mot de passe</button>
    </form>

    <section class="carte pile">
      <button class="btn contour" data-action="sortir">Se déconnecter</button>
      <button class="btn lien rouge" data-action="sortir-partout">Se déconnecter de tous mes appareils</button>
    </section>

    <p class="aide centre">
      <a href="#/profil" data-action="installer">Installer l'app sur mon téléphone</a>
      ${app.api.mode === 'demo' ? html` · <a href="#/profil" data-action="reset">Réinitialiser la démo</a>` : ''}
    </p>
    <div class="carte pile" id="aide-installation" hidden>
      <h2 class="titre-section">Installer l'app</h2>
      <p><strong>iPhone</strong> : ouvrez ce site dans Safari, touchez le bouton Partager puis « Sur l'écran d'accueil ».</p>
      <p><strong>Android</strong> : dans Chrome, ouvrez le menu ⋮ puis « Installer l'application ».</p>
    </div>
  </div>`;

  function monter(el) {
    el.querySelector('#f-mdp').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await app.api.definirMotDePasse(new FormData(e.target).get('mdp'));
        e.target.reset();
        app.message('Mot de passe enregistré.');
      } catch (err) {
        app.message(err.message, 'erreur');
      }
    });
    el.addEventListener('click', async (e) => {
      const a = e.target.closest('[data-action]')?.dataset.action;
      if (!a) return;
      e.preventDefault();
      if (a === 'sortir') await app.api.deconnexion(false);
      if (a === 'sortir-partout' && confirm('Vous serez déconnecté sur tous vos appareils. Continuer ?')) await app.api.deconnexion(true);
      if (a === 'installer') el.querySelector('#aide-installation').hidden = false;
      if (a === 'reset') app.api.reinitialiser();
    });
  }

  return { html: vue, monter, titre: 'Mon compte' };
}
