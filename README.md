# App MDEPi

Web app installable (PWA) des étudiants de la MDEPi, prépa EDN à Marseille.
Lot 1 (socle V1.0) : comptes, promos et groupes de rotation, Accueil, Planning (à venir et replays), Épreuves par groupe passées dans l'app (QCM importés de Théia, notation EDN, classement, sauvegarde des copies), annonces, back-office, installation sur le téléphone.

Services : **Supabase** (base de données, connexion, fichiers), **Brevo** (envoi des e-mails de connexion, service français) et **Cloudflare Pages** (hébergement).

## Budget conseillé (offres payantes, pour la fiabilité)

| Service | Offre | Prix indicatif | Ce que ça apporte |
|---|---|---|---|
| Supabase | **Pro** | environ 25 $ par mois | Jamais mis en pause, sauvegardes quotidiennes gardées 7 jours, 8 Go de base, 100 Go de fichiers (PDF), support par e-mail |
| Brevo (français) | **Starter** | environ 10 € par mois | Envoi fiable des codes de connexion, sans le logo Brevo, interface et support en français, serveurs dans l'UE |
| Cloudflare Pages | gratuit | 0 € | Déjà fiable et sans limite gênante à cette échelle : inutile de payer |
| Nom de domaine | ex. `app.mdepi.fr` | environ 10 € par an | Adresse propre, et e-mails moins souvent classés en spam |

Total : environ 35 € par mois plus le domaine. Supabase et Cloudflare n'existent qu'en anglais ; il n'y a pas d'équivalent français de Supabase aussi simple (base + connexion + règles d'accès), donc on le garde. Les prix sont à vérifier sur chaque site le jour de la souscription. Le code est le même avec ou sans offre payante : seuls les réglages changent.
Option : l'extension *Point-in-time recovery* de Supabase (environ 100 $ par mois) permet de revenir à n'importe quelle minute, utile seulement si les épreuves notées deviennent critiques.

- Cahier des charges : https://claude.ai/artifact/Pb26CT1jSt6js3fY768L5z
- Maquette : https://claude.ai/artifact/FF2dhfArb7M99TKQN4sLYR

---

## Essayer en 1 minute (mode démo)

Il faut [Node.js](https://nodejs.org) 20 ou plus.

```bash
npm install
npm run dev
```

Ouvrez l'adresse affichée (http://localhost:5173). Sans fichier `.env`, l'app tourne en **mode démo** : données fictives gardées dans le navigateur, connexion avec n'importe quel compte de démo et le code `123456`. Le compte « Julien · Admin » ouvre le back-office.

```bash
npm test        # tests (règles d'accès de la base, dates, CSV, agenda…)
npm run build   # version de production dans dist/
```

---

## Mise en production (une seule fois, environ 30 minutes)

### 1. Créer la base Supabase (offre Pro)

1. Créez un compte sur https://supabase.com, créez une organisation au nom de la MDEPi et passez-la en **Pro** (*Billing*), puis **New project**.
   - Région : **West EU (Paris)** ou **Central EU (Frankfurt)**, pour rester dans l'UE (RGPD).
   - Notez le mot de passe de la base dans un gestionnaire de mots de passe.
2. **SQL Editor › New query** : collez tout le fichier [`supabase/schema.sql`](supabase/schema.sql) et cliquez **Run**.
3. Déclarez-vous administrateur (remplacez l'adresse) puis **Run** :
   ```sql
   insert into public.inscrits (email, prenom, nom, role)
   values ('votre.adresse@exemple.fr', 'Julien', 'Nom', 'admin');
   ```

### 2. Régler la connexion par code

Dans **Authentication** :

1. **Sign In / Providers › Email** : laissez Email activé, mettez **Email OTP Length = 6** et **Minimum password length = 8**.
2. **Emails › Templates** : dans les modèles **Confirm signup** et **Magic Link**, remplacez le contenu par :
   ```html
   <h2>Votre code MDEPi</h2>
   <p>Votre code de connexion : <strong style="font-size:24px">{{ .Token }}</strong></p>
   <p>Il est valable une heure. Si vous n'avez rien demandé, ignorez cet e-mail.</p>
   ```
   Objet conseillé : « Votre code de connexion MDEPi ».
   On utilise un code et non un lien : sur iPhone, l'app installée sur l'écran d'accueil ne partage pas sa connexion avec Safari, un lien ouvrirait la mauvaise fenêtre.
3. **Emails › SMTP Settings** : **indispensable**. Le serveur d'e-mails fourni par Supabase n'envoie que quelques e-mails par heure, pas assez pour 400 étudiants. Créez un compte [Brevo](https://www.brevo.com/fr/) (offre Starter), authentifiez-y le domaine de la MDEPi (*Expéditeurs, domaines et IP dédiées › Domaines* : quelques lignes DNS à ajouter chez l'hébergeur du domaine), puis dans *SMTP & API* générez une clé SMTP. Renseignez ici : hôte `smtp-relay.brevo.com`, port `587`, utilisateur = l'identifiant SMTP affiché par Brevo, mot de passe = la clé SMTP, expéditeur par ex. `app@mdepi.fr`.
4. **URL Configuration › Site URL** : l'adresse finale de l'app (étape 4).

Seules les adresses présentes dans la liste des inscrits peuvent se connecter : la base refuse toutes les autres (voir `creer_profil` dans le schéma).

### 3. Brancher l'app sur la base

Dans **Project Settings › API**, copiez l'URL du projet et la clé **anon public**. Copiez `.env.example` en `.env` et collez-les. La clé « anon » peut être publique : la sécurité est assurée par les règles de la base (RLS). **Ne mettez jamais la clé `service_role` dans l'app.**

`npm run dev` : l'app se connecte maintenant à la vraie base. Connectez-vous avec votre adresse d'admin, puis ouvrez **Back-office › Comptes** pour importer les étudiants.

### 4. Mettre en ligne (Cloudflare Pages, gratuit)

1. Compte gratuit sur https://dash.cloudflare.com › **Workers & Pages › Create › Pages › Connect to Git**, choisissez le dépôt GitHub.
2. Réglages de build : *Framework preset* `Vite`, commande `npm run build`, dossier `dist`.
3. **Environment variables** : ajoutez `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` (mêmes valeurs que `.env`), puis **Save and Deploy**.
4. Chaque push sur `main` met l'app à jour automatiquement. Un nom de domaine (par ex. `app.mdepi.fr`) se branche dans **Custom domains**.

GitHub Pages n'est pas conseillé ici : pour un dépôt privé, il demande un abonnement payant.

---

## Utilisation par l'équipe

| Tâche | Où |
|---|---|
| Ajouter les inscrits | Back-office › Comptes › Importer (CSV avec l'en-tête `email;prenom;nom;promo;groupe`, colonne `role` facultative) |
| Changer un étudiant de promo ou de groupe, le désactiver | Back-office › Comptes, directement dans le tableau |
| Créer les groupes de rotation | Back-office › Comptes › Groupes (ou automatiquement à l'import) |
| Passage à l'année suivante | Back-office › Comptes, en bas (D4 désactivés, D1→D2, D2→D3, D3→D4) |
| Créer, déplacer, annuler une séance | Back-office › Planning. Un changement d'horaire, de lieu ou une annulation est signalé aux étudiants sur l'accueil |
| Replay Zoom | Dans la séance : coller le lien de partage de l'enregistrement Zoom (*Zoom › Enregistrements › Partager*) et sa durée |
| Supports, diapos de correction | Dans la séance : déposer le PDF (50 Mo maximum) |
| Annonce | Back-office › Annonces |
| Épreuves (CCB, examens blancs) | Back-office › Épreuves. Une épreuve par groupe et par date ; « Dupliquer » pour la reposer à un autre groupe (même QCM, classement commun). Sujet et correction en PDF possibles aussi. Les étudiants les voient dans l'onglet Épreuves |
| QCM d'une épreuve | Back-office › Épreuves › colonne QCM. Dans Théia, exporter les dossiers en QTI 2.1 et déposer le ZIP : DP, KFP, QRU/QRM/QROC, réponses attendues et commentaires sont repris. Remplaçable tant qu'aucun étudiant n'a commencé |
| Publier la correction et les notes | Page QCM de l'épreuve › « Publier la correction et les notes » (à faire quand tous les groupes ont composé) |
| Résultats, sauvegardes | Page QCM › Résultats : classement, réussite par question, notes (CSV), copies avec les cases cochées (CSV), sauvegarde complète (JSON), copies corrigées imprimables en PDF |

**Passage d'une épreuve** (côté étudiant, sur le modèle de Théia) : page d'informations (ouverture, fermeture, temps restant), puis questions numérotées par dossier. Dans un dossier progressif, il faut valider une question pour voir la suivante ; une question validée n'est plus modifiable. Chaque clic est enregistré ; sans réseau, les réponses attendent sur le téléphone et partent au retour de la connexion. « Tout envoyer et terminer » montre un résumé ; à l'heure de fin, la copie part toute seule. Barème : QRM 1 point sans erreur, 0,5 avec une, 0,2 avec deux, 0 au-delà ; QRU et QROC 1 point (QROC sans tenir compte des majuscules, accents et espaces). Note sur 20, moyenne et rang sont calculés par la base sur toute la série (tous les groupes).

Rôles : **admin** (tout), **enseignant** (planning, replays, documents), **étudiant**. Un étudiant ne voit que les séances de sa promo et de son groupe (une séance sans groupe coché concerne toute la promo), et les annonces de sa promo.

---

## Comment le code est organisé

```
index.html                 page unique de l'app
src/main.js                démarrage, navigation (#/accueil, #/planning…), menu
src/styles.css             toute la mise en forme (couleurs de la charte en haut)
src/views/                 un fichier par écran
  accueil.js planning.js epreuves.js seance.js annonces.js profil.js connexion.js bientot.js
  passage.js qcm-rendu.js  passage d'une épreuve, copie corrigée (affichage façon Théia)
  admin/                   back-office : comptes.js seances.js epreuves.js qcm.js annonces.js
src/data/supabase.js       lecture/écriture dans Supabase
src/data/demo.js           mêmes fonctions avec des données fictives (mode démo)
src/lib/                   outils : dates (heure de Paris), CSV, .ics, règles d'accès, icônes,
                           qti.js (import Théia), bareme.js (notation EDN), qcm.js (exports)
supabase/schema.sql        tables, règles d'accès (RLS), triggers
public/                    icônes, manifeste et service worker (installation, hors connexion)
tests/                     tests automatiques (npm test)
```

Pas de framework : chaque écran est une fonction qui renvoie du HTML (avec `html\`…\``, qui protège contre l'injection de code) et, si besoin, une fonction `monter` qui branche les clics. Pour ajouter un écran : créer `src/views/mon-ecran.js` et l'ajouter à la table `ROUTES` de `src/main.js`.

**Sécurité** : c'est la base qui décide qui voit quoi (fichier `schema.sql`, sections 4 et 6), pas l'app. Les bonnes réponses sont dans une table à part, invisible des étudiants avant publication ; les réponses ne s'écrivent que par des fonctions qui vérifient l'horaire de l'épreuve. Le barème existe en SQL (`points`) et en JavaScript (`bareme.js`) : les garder identiques. Les tests `tests/schema.test.js` le vérifient dans un vrai Postgres. Si vous modifiez une règle, modifiez aussi `src/lib/acces.js` (utilisé par le mode démo) et lancez `npm test`.

---

## Limites connues et suite

- **Notifications push** (changement de dernière minute, annonce) : pas encore. Pour l'instant, les changements s'affichent en haut de l'accueil et la cloche signale les annonces non lues. Le push web demande un petit service côté serveur (fonction Supabase gratuite), prévu ensuite.
- **Replays** : le lien Zoom est collé à la main. La récupération automatique depuis Zoom demande une application Zoom (API) et un compte Zoom payant avec enregistrement cloud, à confirmer.
- **Filigrane au nom de l'étudiant sur les PDF** : pas encore. Les liens vers les PDF expirent au bout d'une heure, ce qui limite leur partage.
- **Double authentification pour l'équipe** : Supabase la propose gratuitement (TOTP), l'écran d'activation reste à faire.
- **Hors connexion** : l'app s'ouvre sans réseau, mais les données ne sont pas encore gardées en cache (prévu avec les cartes et les dossiers au lot 1.1).
- **Si un jour on repasse en gratuit** : Supabase gratuit limite à 500 Mo de base et 1 Go de fichiers, sans sauvegarde, et met en pause un projet inutilisé 7 jours ; l'offre gratuite de Brevo (300 e-mails par jour, avec le logo Brevo) suffit aussi.
- **Épreuves** : pondération toujours à 1 (comme dans l'export Théia) ; les images des QCM sont stockées dans Supabase Storage (dossier `qcm/`). Pas de mode « surveillé » (plein écran forcé, détection de changement d'onglet).
- **Lot 1.1** : entraînement (avec les QCM importés), cartes, progrès.
