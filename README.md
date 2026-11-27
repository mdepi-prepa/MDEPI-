# App MDEPi

Web app installable (PWA) des étudiants de la MDEPi, prépa EDN à Marseille.
Lot 1 (socle V1.0) : comptes, promos et groupes de rotation, Accueil, Planning (à venir et replays), Épreuves par groupe passées dans l'app (QCM importés de Théia, notation EDN, classement, sauvegarde des copies), annonces, back-office, installation sur le téléphone.

Services : **Supabase** (base de données, connexion, fichiers), **Brevo** (envoi des e-mails de connexion, service français) et **Cloudflare** (hébergement).

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

### Mettre à jour la base après une nouvelle version

Quand `supabase/schema.sql` change (nouvelle fonctionnalité, correctif), recollez le fichier entier dans **SQL Editor › New query** et cliquez **Run**. Le script se relance sans rien perdre : il ajoute seulement ce qui manque (tables, colonnes, règles d'accès) et remplace les fonctions. Aucune donnée (inscrits, séances, copies, notes) n'est effacée.

### 4. Mettre en ligne (Cloudflare Pages, gratuit)

1. Compte gratuit sur https://dash.cloudflare.com › **Workers & Pages › Create › Pages › Connect to Git**, choisissez le dépôt GitHub. Nom du projet : `mdepi`.
2. Réglages de build : *Framework preset* `Vite`, commande `npm run build`, dossier `dist`.
3. **Environment variables** : ajoutez `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` (mêmes valeurs que `.env`), puis **Save and Deploy**. Elles sont lues au moment du build : après tout changement, relancez un déploiement. Sans elles, l'app s'ouvre en mode démo.
4. Chaque push sur `main` met l'app à jour automatiquement. Un nom de domaine (par ex. `app.mdepi.fr`) se branche dans **Custom domains**.

Pages ignore le fichier `wrangler.jsonc` (il ne contient pas `pages_build_output_dir`). Ce fichier sert seulement si l'on choisit un projet **Workers** à la place : commande de déploiement `npx wrangler deploy`, et les deux variables dans **Settings › Build › Variables and secrets** (variables de build, pas celles du Worker).

GitHub Pages n'est pas conseillé ici : pour un dépôt privé, il demande un abonnement payant.

---

## Utilisation par l'équipe

| Tâche | Où |
|---|---|
| Ajouter les inscrits | Back-office › Comptes › Importer (CSV avec l'en-tête `email;prenom;nom;promo;groupe`, colonne `role` facultative) |
| Créer un compte à la main (étudiant, conférencier, admin) | Back-office › Comptes › Ajouter un compte ; le rôle et l'accès se changent ensuite dans la liste |
| Supprimer un compte | Back-office › Comptes, bouton « Supprimer » sur la ligne : efface définitivement le compte (connexion comprise), ses copies, notes et entraînements ; les classements sont recalculés. Pour garder ses résultats, décochez plutôt « Actif ». On ne peut pas supprimer son propre compte. |
| Changer un étudiant de promo ou de groupe, le désactiver | Back-office › Comptes, directement dans le tableau |
| Créer les groupes de rotation | Back-office › Comptes › Groupes (ou automatiquement à l'import) |
| Passage à l'année suivante | Back-office › Comptes, en bas (D4 désactivés, D1→D2, D2→D3, D3→D4) |
| Créer, déplacer, annuler une séance | Back-office › Planning. Un changement d'horaire, de lieu ou une annulation est signalé aux étudiants sur l'accueil |
| Replay Zoom | Dans la séance : coller le lien de partage de l'enregistrement Zoom (*Zoom › Enregistrements › Partager*) et sa durée |
| Supports, diapos de correction | Dans la séance : déposer le PDF (50 Mo maximum) |
| Annonce | Back-office › Annonces |
| Épreuves (CCB, examens blancs) | Back-office › Épreuves. Une épreuve par groupe et par date ; « Dupliquer » pour la reposer à un autre groupe (même QCM, classement commun). Sujet et correction en PDF possibles aussi. Les étudiants les voient dans l'onglet Épreuves |
| QCM d'une épreuve | Back-office › Épreuves › colonne QCM. Dans Théia, exporter les dossiers en QTI 2.1 et déposer le ZIP : DP, KFP, QRU/QRM/QRP/QROC, réponses attendues et commentaires sont repris. Une alerte s'affiche si la promo du titre Théia diffère de celle de l'épreuve. Remplaçable tant qu'aucun étudiant n'a répondu |
| Indispensable, inacceptable, coefficient, neutraliser, annuler | Page QCM › « Sujet corrigé » : pour chaque proposition, « Indispensable » (juste ; l'oublier = 0 à la question) ou « Inacceptable » (fausse ; la cocher = 0) ; pour chaque question, son coefficient et son statut (neutralisée = points pour tous, annulée = retirée de la note). Les notes de toute la série sont recalculées |
| Vérifier les QROC | Page QCM › « Vérifier les QROC » : réponses des étudiants regroupées, celles acceptées « car proches » en premier ; Confirmer, Accepter ou Refuser d'un clic, ou ajouter une réponse acceptée. Les notes de toute la série suivent |
| Notes, classement, correction | Page QCM › « Publication des résultats » : ne pas afficher, dès la clôture (par défaut) ou à partir d'une date. À la clôture, chaque étudiant voit sa note, la moyenne et son rang 2 minutes après la fin de son épreuve (le temps que les dernières copies arrivent) ; les groupes suivants s'ajoutent au classement à la fin de leur épreuve. La copie corrigée s'affiche en même temps ; un groupe qui n'a pas encore composé ne la voit pas. Le PDF « Correction » d'une épreuve suit la même règle, le PDF « Sujet » s'ouvre au début de l'épreuve |
| Entraînement | Automatique : une épreuve apparaît dans l'onglet Entraînement dès la fin de l'épreuve de l'étudiant (rejouer tout ou seulement ses questions ratées, correction après chaque question, hors classement, scores gardés) |
| Résultats, sauvegardes | Page QCM › Résultats : classement, réussite par question, notes (CSV), copies avec les cases cochées (CSV), sauvegarde complète (JSON), copies corrigées imprimables en PDF |

**Passage d'une épreuve** (côté étudiant, sur le modèle de Théia) : page d'informations (ouverture, fermeture, temps restant), puis questions numérotées par dossier. Dans un dossier progressif, il faut valider une question pour voir la suivante : la base n'envoie la question suivante qu'après validation de la précédente (on ne peut pas la lire en avance), et une question validée n'est plus modifiable. Chaque clic est enregistré ; sans réseau, les réponses attendent sur le téléphone et partent au retour de la connexion. « Tout envoyer et terminer » montre un résumé ; à l'heure de fin, la copie part toute seule. Barème (comme Théia et l'EDN, détail en tête de `src/lib/bareme.js`) : QRM 1 point sans erreur, 0,5 avec une, 0,2 avec deux, 0 au-delà, 0 si aucune case cochée ; QRU 1 point ; QRP bonnes cochées ÷ n ; QROC 1 point (0,5 si l'équipe la juge « acceptable ») ; proposition indispensable oubliée ou inacceptable cochée = 0 à la question ; chaque question compte pour son coefficient. Les QROC sont corrigées automatiquement (`src/lib/qroc.js` et `qroc_juste` en SQL) : majuscules, accents, articles, pluriels et ordre des mots ignorés, abréviations courantes reconnues (TDM, AP, ECG, écho…), une faute de frappe tolérée sur les mots longs mais jamais sur un chiffre, une négation, le début ou la fin du mot (hypo/hyper, -ite/-ose). Note sur 20, moyenne et rang sont calculés par la base sur toute la série (tous les groupes).

Rôles : **admin** (tout, dont les comptes), **conférencier** (planning, replays, épreuves, documents ; valeur `enseignant` en base et `conferencier` ou `enseignant` accepté dans le CSV), **étudiant**. Un admin peut créer un compte à la main (Back-office › Comptes › Ajouter un compte), changer un rôle ou désactiver un compte ; lui seul peut nommer un autre admin. Un étudiant ne voit que les séances de sa promo et de son groupe (une séance sans groupe coché concerne toute la promo), et les annonces de sa promo.

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

**Sécurité** : c'est la base qui décide qui voit quoi (fichier `schema.sql`, sections 4 et 6), pas l'app. Les bonnes réponses sont dans une table à part, invisible des étudiants avant publication ; les réponses ne s'écrivent que par des fonctions qui vérifient l'horaire de l'épreuve et l'ordre des questions d'un dossier. Une épreuve qui a des copies ne peut pas être supprimée (l'annuler à la place). Le barème existe en SQL (`points`) et en JavaScript (`bareme.js`) : les garder identiques. Les tests `tests/schema.test.js` le vérifient dans un vrai Postgres. Si vous modifiez une règle, modifiez aussi `src/lib/acces.js` (utilisé par le mode démo) et lancez `npm test`.

---

## Limites connues et suite

- **Notifications push** (changement de dernière minute, annonce) : pas encore. Pour l'instant, les changements s'affichent en haut de l'accueil et la cloche signale les annonces non lues. Le push web demande un petit service côté serveur (fonction Supabase gratuite), prévu ensuite.
- **Replays** : le lien Zoom est collé à la main. La récupération automatique depuis Zoom demande une application Zoom (API) et un compte Zoom payant avec enregistrement cloud, à confirmer.
- **Filigrane au nom de l'étudiant sur les PDF** : pas encore. Les liens vers les PDF expirent au bout d'une heure, ce qui limite leur partage.
- **Double authentification pour l'équipe** : Supabase la propose gratuitement (TOTP), l'écran d'activation reste à faire.
- **Hors connexion** : l'app s'ouvre sans réseau, mais les données ne sont pas encore gardées en cache (prévu avec les cartes et les dossiers au lot 1.1).
- **Si un jour on repasse en gratuit** : Supabase gratuit limite à 500 Mo de base et 1 Go de fichiers, sans sauvegarde, et met en pause un projet inutilisé 7 jours ; l'offre gratuite de Brevo (300 e-mails par jour, avec le logo Brevo) suffit aussi.
- **Épreuves** : l'export QTI de Théia ne contient ni les coefficients ni les propositions indispensables / inacceptables : ils se règlent dans le back-office (Sujet corrigé). Les images des QCM sont stockées dans Supabase Storage (dossier `qcm/`). Pas de mode « surveillé » (plein écran forcé, détection de changement d'onglet).
- **Lot 1.1** : banque de questions d'entraînement hors épreuves, cartes, progrès (les tentatives d'entraînement sont déjà enregistrées).
