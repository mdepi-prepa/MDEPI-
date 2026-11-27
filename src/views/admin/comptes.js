// Back-office : inscrits, promos, groupes de rotation, passage d'année.
import { html } from '../../lib/html.js';
import { CODES_PROMOS, libellePromo } from '../../lib/promos.js';
import { lireCsvInscrits } from '../../lib/csv.js';
import { enteteAdmin } from './index.js';
import { vide } from '../commun.js';

// Le rôle « enseignant » (valeur en base) s'affiche « Conférencier » : mêmes
// droits (planning, replays, épreuves, documents), pas d'accès aux comptes.
const ROLES = { etudiant: 'Étudiant', enseignant: 'Conférencier', admin: 'Admin' };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function vueAdminComptes(app) {
  const [inscrits, groupes] = await Promise.all([app.api.inscrits(), app.api.groupes()]);
  const filtre = sessionStorageGet('filtre-promo') || 'tous';
  const liste = inscrits.filter((i) => filtre === 'tous' || (filtre === 'equipe' ? i.role !== 'etudiant' : i.promo === filtre));
  const nomGroupe = (id) => groupes.find((g) => g.id === id)?.nom ?? '';
  const compte = (code) => inscrits.filter((i) => i.promo === code && i.actif && i.role === 'etudiant').length;

  const vue = html`<div class="page">
    ${enteteAdmin('Comptes')}

    <section class="carte pile">
      <h2 class="titre-section">Ajouter un compte</h2>
      <p class="aide">La personne se connecte ensuite avec cette adresse : elle reçoit un code par e-mail, sans mot de passe à créer.
        Un conférencier gère le planning, les replays et les épreuves ; un admin a en plus accès aux comptes.</p>
      <form id="f-compte" class="pile">
        <div class="grille-3">
          <label class="champ"><span>Adresse e-mail</span><input name="email" type="email" required autocomplete="off" placeholder="prenom.nom@exemple.fr"></label>
          <label class="champ"><span>Prénom</span><input name="prenom" required autocomplete="off"></label>
          <label class="champ"><span>Nom</span><input name="nom" required autocomplete="off"></label>
        </div>
        <div class="grille-3">
          <label class="champ"><span>Rôle</span><select name="role">${Object.entries(ROLES).map(([k, v]) => html`<option value="${k}">${v}</option>`)}</select></label>
          <label class="champ" data-etudiant><span>Promo</span><select name="promo">${CODES_PROMOS.map((p) => html`<option>${p}</option>`)}</select></label>
          <label class="champ" data-etudiant><span>Groupe</span><select name="groupe_id"></select></label>
        </div>
        <div class="actions"><button class="btn plein" type="submit">Créer le compte</button></div>
      </form>
    </section>

    <section class="carte pile">
      <h2 class="titre-section">Importer des inscrits (CSV)</h2>
      <p class="aide">Une ligne par personne, avec l'en-tête <code>email;prenom;nom;promo;groupe</code> (colonne <code>role</code> facultative : etudiant, conferencier ou admin).
        Une adresse déjà connue est mise à jour. Un groupe inconnu est créé automatiquement.</p>
      <input type="file" accept=".csv,text/csv" id="csv-fichier" aria-label="Fichier CSV">
      <textarea id="csv-texte" rows="4" placeholder="email;prenom;nom;promo;groupe&#10;camille.martin@exemple.fr;Camille;Martin;D2;Groupe A"></textarea>
      <button class="btn contour" data-action="analyser">Vérifier le fichier</button>
      <div id="csv-resultat"></div>
    </section>

    <section class="carte pile">
      <h2 class="titre-section">Groupes de rotation</h2>
      <div class="grille-4">${CODES_PROMOS.map(
        (p) => html`<div class="pile-mini"><strong>${libellePromo(p)}</strong> <span class="aide">${compte(p)} étudiant(s) actif(s)</span>
          ${groupes.filter((g) => g.promo === p).map(
            (g) => html`<span class="puce">${g.nom} <button class="croix" data-suppr-groupe="${g.id}" aria-label="Supprimer ${g.nom}">×</button></span>`
          )}
        </div>`
      )}</div>
      <form id="f-groupe" class="grille-3">
        <label class="champ"><span>Promo</span><select name="promo">${CODES_PROMOS.map((p) => html`<option>${p}</option>`)}</select></label>
        <label class="champ"><span>Nom du groupe</span><input name="nom" required placeholder="Groupe A"></label>
        <button class="btn contour" type="submit">Ajouter le groupe</button>
      </form>
    </section>

    <section class="pile-petite">
      <div class="ligne-haut">
        <h2 class="titre-section">Inscrits (${liste.length})</h2>
        <select id="filtre" aria-label="Filtrer">
          <option value="tous">Tous</option>
          ${CODES_PROMOS.map((p) => html`<option value="${p}" ${filtre === p ? 'selected' : ''}>${p}</option>`)}
          <option value="equipe" ${filtre === 'equipe' ? 'selected' : ''}>Équipe</option>
        </select>
      </div>
      ${liste.length
        ? html`<div class="tableau-defile"><table class="tableau">
            <thead><tr><th>Nom</th><th>E-mail</th><th>Rôle</th><th>Promo</th><th>Groupe</th><th>Actif</th></tr></thead>
            <tbody>${liste.map(
              (i) => {
              // Pas de retrait de ses propres droits : on ne peut pas s'enfermer dehors.
              const moi = i.email === app.profil?.email;
              return html`<tr class="${i.actif ? '' : 'inactif'}" data-email="${i.email}">
                <td>${i.prenom} ${i.nom}</td>
                <td>${i.email}</td>
                <td><select data-champ="role" aria-label="Rôle" ${moi ? 'disabled title="Votre propre rôle"' : ''}>${Object.entries(ROLES).map(([k, v]) => html`<option value="${k}" ${i.role === k ? 'selected' : ''}>${v}</option>`)}</select></td>
                <td><select data-champ="promo" aria-label="Promo"><option value="">–</option>${CODES_PROMOS.map((p) => html`<option ${i.promo === p ? 'selected' : ''}>${p}</option>`)}</select></td>
                <td><select data-champ="groupe_id" aria-label="Groupe"><option value="">Aucun</option>${groupes
                  .filter((g) => g.promo === i.promo)
                  .map((g) => html`<option value="${g.id}" ${i.groupe_id === g.id ? 'selected' : ''}>${g.nom}</option>`)}</select></td>
                <td><input type="checkbox" data-champ="actif" ${i.actif ? 'checked' : ''} ${moi ? 'disabled' : ''} aria-label="Compte actif"></td>
              </tr>`;
            }
            )}</tbody></table></div>`
        : vide('Aucun inscrit.')}
      <p class="aide">Changer le rôle ou décocher « Actif » s'applique immédiatement (décocher coupe l'accès sans rien effacer). Changer la promo ou le groupe change ce que l'étudiant voit.</p>
    </section>

    <section class="carte pile zone-danger">
      <h2 class="titre-section">Passage à l'année suivante</h2>
      <p class="aide">À faire une fois en début d'année : D1 passe en D2, D2 en D3, D3 en D4 ; les D4 sont désactivés. Les groupes de rotation sont remis à zéro.</p>
      <button class="btn contour rouge" data-action="passage">Lancer le passage d'année</button>
    </section>
  </div>`;

  let analyse = null;

  function monter(el) {
    const resultat = el.querySelector('#csv-resultat');
    const fc = el.querySelector('#f-compte');
    const majFormulaire = () => {
      const etudiant = fc.role.value === 'etudiant';
      fc.querySelectorAll('[data-etudiant]').forEach((x) => (x.hidden = !etudiant));
      fc.groupe_id.innerHTML = String(html`<option value="">Aucun</option>${groupes
        .filter((g) => g.promo === fc.promo.value)
        .map((g) => html`<option value="${g.id}">${g.nom}</option>`)}`);
    };
    fc.role.addEventListener('change', majFormulaire);
    fc.promo.addEventListener('change', majFormulaire);
    majFormulaire();
    fc.addEventListener('submit', async (e) => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(fc));
      const email = String(d.email).trim().toLowerCase();
      if (!EMAIL.test(email)) return app.message('Adresse e-mail invalide.', 'erreur');
      if (inscrits.some((i) => i.email === email)) return app.message('Cette adresse a déjà un compte : modifiez-le dans la liste.', 'erreur');
      const etudiant = d.role === 'etudiant';
      const ligne = {
        email,
        prenom: String(d.prenom).trim(),
        nom: String(d.nom).trim(),
        role: d.role,
        promo: etudiant ? d.promo : null,
        groupe_id: etudiant ? d.groupe_id || null : null,
        actif: true,
      };
      try {
        await app.api.enregistrerInscrits([ligne]);
        app.message(`Compte créé pour ${ligne.prenom} ${ligne.nom} (${ROLES[d.role].toLowerCase()}).`);
        app.rafraichir();
      } catch (err) {
        app.message(err.message, 'erreur');
      }
    });
    el.querySelector('#csv-fichier').addEventListener('change', async (e) => {
      const f = e.target.files[0];
      if (f) el.querySelector('#csv-texte').value = await f.text();
    });
    el.querySelector('#filtre').addEventListener('change', (e) => {
      sessionStorageSet('filtre-promo', e.target.value);
      app.rafraichir();
    });

    el.addEventListener('click', async (e) => {
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (action === 'analyser') {
        analyse = lireCsvInscrits(el.querySelector('#csv-texte').value);
        const nouveaux = analyse.lignes.filter((l) => !inscrits.some((i) => i.email === l.email)).length;
        resultat.innerHTML = String(html`
          ${analyse.erreurs.length ? html`<div class="alerte rouge"><strong>${analyse.erreurs.length} ligne(s) ignorée(s)</strong><ul>${analyse.erreurs.map((x) => html`<li>${x}</li>`)}</ul></div>` : ''}
          ${analyse.lignes.length
            ? html`<p><strong>${analyse.lignes.length}</strong> ligne(s) valide(s) : ${nouveaux} nouvelle(s), ${analyse.lignes.length - nouveaux} mise(s) à jour.</p>
                <button class="btn plein" data-action="importer">Importer ${analyse.lignes.length} inscrit(s)</button>`
            : ''}`);
      }
      if (action === 'importer' && analyse) {
        try {
          const tous = [...groupes];
          const lignes = [];
          for (const l of analyse.lignes) {
            let groupe_id = null;
            if (l.groupe && l.promo) {
              let g = tous.find((x) => x.promo === l.promo && x.nom.toLowerCase() === l.groupe.toLowerCase());
              if (!g) {
                g = await app.api.creerGroupe(l.promo, l.groupe);
                tous.push(g);
              }
              groupe_id = g.id;
            }
            lignes.push({ email: l.email, prenom: l.prenom, nom: l.nom, promo: l.promo, role: l.role, groupe_id, actif: true });
          }
          await app.api.enregistrerInscrits(lignes);
          app.message(`${lignes.length} inscrit(s) importé(s).`);
          app.rafraichir();
        } catch (err) {
          app.message(err.message, 'erreur');
        }
      }
      if (action === 'passage') {
        const mot = prompt("Tapez PASSAGE pour confirmer le passage de toutes les promos à l'année suivante.");
        if (mot === 'PASSAGE') {
          const n = await app.api.passageAnnee();
          app.message(`${n} étudiant(s) passé(s) à l'année suivante.`);
          app.rafraichir();
        }
      }
      const idGroupe = e.target.closest('[data-suppr-groupe]')?.dataset.supprGroupe;
      if (idGroupe && confirm('Supprimer ce groupe ? Ses membres resteront dans la promo, sans groupe.')) {
        await app.api.supprimerGroupe(idGroupe);
        app.rafraichir();
      }
    });

    el.querySelector('#f-groupe').addEventListener('submit', async (e) => {
      e.preventDefault();
      const d = new FormData(e.target);
      try {
        await app.api.creerGroupe(d.get('promo'), String(d.get('nom')).trim());
        app.rafraichir();
      } catch (err) {
        app.message(err.message, 'erreur');
      }
    });

    el.querySelector('tbody')?.addEventListener('change', async (e) => {
      const champ = e.target.dataset.champ;
      const email = e.target.closest('tr').dataset.email;
      let valeur = e.target.type === 'checkbox' ? e.target.checked : e.target.value || null;
      const champs = { [champ]: valeur };
      if (champ === 'promo') champs.groupe_id = null; // le groupe dépend de la promo
      try {
        await app.api.modifierInscrit(email, champs);
        app.message('Modifié.');
        if (champ === 'promo' || champ === 'actif') app.rafraichir();
      } catch (err) {
        app.message(err.message, 'erreur');
        app.rafraichir();
      }
    });
  }

  return { html: vue, monter, titre: 'Comptes' };
}

function sessionStorageGet(k) {
  try {
    return sessionStorage.getItem(k);
  } catch {
    return null;
  }
}
function sessionStorageSet(k, v) {
  try {
    sessionStorage.setItem(k, v);
  } catch {
    /* ignoré */
  }
}
