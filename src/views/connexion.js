// Écran de connexion : code reçu par e-mail (6 à 8 chiffres selon le réglage
// Supabase « OTP Length »), ou mot de passe.
// Le code est préféré au lien magique : sur iPhone, l'app installée sur
// l'écran d'accueil ne partage pas sa session avec Safari.
import { html } from '../lib/html.js';
import { logoComplet } from '../lib/logo.js';
import { libellePromo } from '../lib/promos.js';
import { CODE_DEMO } from '../data/demo.js';

export async function vueConnexion(app) {
  const demo = app.api.mode === 'demo';
  const comptes = demo ? app.api.comptesDemo() : [];
  const etat = { email: '', etape: 'email' };

  const vue = html`<div class="connexion">
    <div class="connexion-carte">
      <div class="connexion-marque">${logoComplet()}</div>

      <form id="f-email" class="pile">
        <h1>Connexion</h1>
        <p class="aide">Entrez l'adresse e-mail donnée à l'inscription. Vous recevrez un code par e-mail.</p>
        <label class="champ"><span>Adresse e-mail</span>
          <input type="email" name="email" autocomplete="email" required inputmode="email" placeholder="prenom.nom@exemple.fr"></label>
        <button class="btn plein" type="submit">Recevoir un code</button>
        <button class="btn lien" type="button" data-action="mdp">J'ai un mot de passe</button>
      </form>

      <form id="f-code" class="pile" hidden>
        <h1>Code reçu par e-mail</h1>
        <p class="aide">Code envoyé à <strong data-email></strong>. Il est valable une heure.</p>
        <label class="champ"><span>Code reçu par e-mail</span>
          <input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9 ]{6,9}" maxlength="9" minlength="6" required placeholder="123456"></label>
        <button class="btn plein" type="submit">Se connecter</button>
        <button class="btn lien" type="button" data-action="retour">Changer d'adresse</button>
      </form>

      <form id="f-mdp" class="pile" hidden>
        <h1>Connexion par mot de passe</h1>
        <label class="champ"><span>Adresse e-mail</span>
          <input type="email" name="email" autocomplete="email" required></label>
        <label class="champ"><span>Mot de passe</span>
          <input type="password" name="mdp" autocomplete="current-password" required></label>
        <button class="btn plein" type="submit">Se connecter</button>
        <button class="btn lien" type="button" data-action="retour">Recevoir un code à la place</button>
      </form>

      <p class="erreur" role="alert" hidden></p>

      ${demo
        ? html`<div class="demo-encart">
            <strong>Mode démo</strong> : aucune base n'est branchée. Choisissez un compte fictif (code ${CODE_DEMO}).
            <div class="demo-comptes">
              ${comptes.map(
                (c) => html`<button type="button" class="puce" data-demo="${c.email}">${c.prenom} · ${c.role === 'etudiant' ? libellePromo(c.promo) : c.role === 'admin' ? 'Admin' : 'Conférencier'}</button>`
              )}
            </div>
          </div>`
        : ''}
    </div>
  </div>`;

  function monter(el) {
    const forms = { email: el.querySelector('#f-email'), code: el.querySelector('#f-code'), mdp: el.querySelector('#f-mdp') };
    const erreur = el.querySelector('.erreur');
    const montrer = (etape) => {
      etat.etape = etape;
      Object.entries(forms).forEach(([k, f]) => (f.hidden = k !== etape));
      erreur.hidden = true;
      forms[etape].querySelector('input')?.focus();
    };
    const occupe = async (form, fn) => {
      const btn = form.querySelector('button[type=submit]');
      btn.disabled = true;
      erreur.hidden = true;
      try {
        await fn();
      } catch (e) {
        erreur.textContent = e.message;
        erreur.hidden = false;
      } finally {
        btn.disabled = false;
      }
    };

    forms.email.addEventListener('submit', (e) => {
      e.preventDefault();
      etat.email = new FormData(forms.email).get('email');
      occupe(forms.email, async () => {
        await app.api.envoyerCode(etat.email);
        el.querySelector('[data-email]').textContent = etat.email;
        montrer('code');
      });
    });
    forms.code.addEventListener('submit', (e) => {
      e.preventDefault();
      occupe(forms.code, () => app.api.verifierCode(etat.email, new FormData(forms.code).get('code')));
    });
    forms.mdp.addEventListener('submit', (e) => {
      e.preventDefault();
      const d = new FormData(forms.mdp);
      occupe(forms.mdp, () => app.api.connexionMotDePasse(d.get('email'), d.get('mdp')));
    });
    el.addEventListener('click', (e) => {
      const a = e.target.closest('[data-action]')?.dataset.action;
      if (a === 'mdp') montrer('mdp');
      if (a === 'retour') montrer('email');
      const demoEmail = e.target.closest('[data-demo]')?.dataset.demo;
      if (demoEmail) {
        etat.email = demoEmail;
        app.api.verifierCode(demoEmail, CODE_DEMO);
      }
    });
  }

  return { html: vue, monter };
}
