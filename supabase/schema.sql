-- =====================================================================
-- MDEPi – Lot 1 (socle V1.0) : schéma de la base Supabase
-- À coller tel quel dans Supabase > SQL Editor > New query > Run.
-- Le script peut être relancé : il ne recrée que ce qui manque.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------

-- Groupes de rotation (par promo). Ex. D2 « Groupe A ».
create table if not exists public.groupes (
  id uuid primary key default gen_random_uuid(),
  promo text not null check (promo in ('D1','D2','D3','D4')),
  nom text not null,
  unique (promo, nom)
);

-- Liste des inscrits, importée par l'équipe (CSV). Seule une adresse
-- présente ici, et active, peut créer un compte.
create table if not exists public.inscrits (
  email text primary key check (email = lower(email)),
  prenom text not null default '',
  nom text not null default '',
  role text not null default 'etudiant' check (role in ('etudiant','enseignant','admin')),
  promo text check (promo in ('D1','D2','D3','D4')),
  groupe_id uuid references public.groupes(id) on delete set null,
  actif boolean not null default true,
  created_at timestamptz not null default now()
);

-- Profil d'un compte connecté (une ligne par utilisateur Supabase Auth).
create table if not exists public.profils (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  prenom text not null default '',
  nom text not null default '',
  role text not null default 'etudiant' check (role in ('etudiant','enseignant','admin')),
  promo text check (promo in ('D1','D2','D3','D4')),
  groupe_id uuid references public.groupes(id) on delete set null,
  actif boolean not null default true,
  created_at timestamptz not null default now()
);

-- Séances du planning (conférences, CCB, examens blancs).
-- promos : promos concernées ; groupes : groupes concernés (vide = tous).
create table if not exists public.seances (
  id uuid primary key default gen_random_uuid(),
  titre text not null,
  matiere text not null default '',
  debut timestamptz not null,
  fin timestamptz not null,
  lieu text not null default '',            -- ex. « 94 rue Sainte-Cécile » ou « En ligne »
  presentiel boolean not null default true,
  zoom_url text,
  epreuve boolean not null default false,   -- CCB / examen blanc (étiquette « Noté »)
  annulee boolean not null default false,
  promos text[] not null default '{}',
  groupes uuid[] not null default '{}',
  replay_url text,                          -- lien de l'enregistrement Zoom
  replay_duree_min integer,
  modifiee_le timestamptz,                  -- dernière modif. de salle/horaire/annulation
  created_at timestamptz not null default now(),
  check (fin > debut)
);
create index if not exists seances_debut_idx on public.seances (debut);

-- Documents rattachés à une séance (supports PDF, diapos de correction).
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  seance_id uuid not null references public.seances(id) on delete cascade,
  type text not null check (type in ('support','correction','sujet')),  -- sujet : sujet d'épreuve
  titre text not null,
  chemin text not null unique,              -- chemin dans le bucket « documents »
  created_at timestamptz not null default now()
);

-- Annonces publiées par l'équipe.
create table if not exists public.annonces (
  id uuid primary key default gen_random_uuid(),
  texte text not null,
  promos text[] not null default '{D1,D2,D3,D4}',
  publiee_le timestamptz not null default now()
);

-- Annonces lues (pastille « non lu » et cloche).
create table if not exists public.annonces_lues (
  user_id uuid not null references auth.users(id) on delete cascade,
  annonce_id uuid not null references public.annonces(id) on delete cascade,
  lue_le timestamptz not null default now(),
  primary key (user_id, annonce_id)
);

-- ---------------------------------------------------------------------
-- 2. Fonctions d'aide pour les règles d'accès (RLS)
--    security definer : elles lisent profils sans repasser par la RLS.
-- ---------------------------------------------------------------------

create or replace function public.mon_profil()
returns public.profils
language sql stable security definer set search_path = public
as $$ select * from public.profils where id = auth.uid() and actif $$;

create or replace function public.est_actif()
returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profils where id = auth.uid() and actif) $$;

create or replace function public.est_admin()
returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce((select role = 'admin' from public.profils where id = auth.uid() and actif), false) $$;

create or replace function public.est_equipe()
returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce((select role in ('admin','enseignant') from public.profils where id = auth.uid() and actif), false) $$;

-- Un compte actif peut-il voir cette séance ?
create or replace function public.peut_voir_seance(s public.seances)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.est_equipe() or exists (
    select 1 from public.profils p
    where p.id = auth.uid() and p.actif
      and p.promo = any (s.promos)
      and (cardinality(s.groupes) = 0 or p.groupe_id = any (s.groupes))
  )
$$;

-- ---------------------------------------------------------------------
-- 3. Création du profil à l'inscription : refus si l'e-mail n'est pas
--    dans la liste des inscrits (ou si l'inscrit est désactivé).
-- ---------------------------------------------------------------------

create or replace function public.creer_profil()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  i public.inscrits;
begin
  select * into i from public.inscrits where email = lower(new.email) and actif;
  if not found then
    raise exception 'Adresse non inscrite à la MDEPi : %', new.email;
  end if;
  insert into public.profils (id, email, prenom, nom, role, promo, groupe_id)
  values (new.id, i.email, i.prenom, i.nom, i.role, i.promo, i.groupe_id);
  return new;
end;
$$;

drop trigger if exists creer_profil on auth.users;
create trigger creer_profil
  after insert on auth.users
  for each row execute function public.creer_profil();

-- Toute modification d'un inscrit (promo, groupe, désactivation) est
-- recopiée sur son profil s'il s'est déjà connecté.
create or replace function public.synchro_profil()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  update public.profils
     set prenom = new.prenom, nom = new.nom, role = new.role,
         promo = new.promo, groupe_id = new.groupe_id, actif = new.actif
   where email = new.email;
  return new;
end;
$$;

drop trigger if exists synchro_profil on public.inscrits;
create trigger synchro_profil
  after update on public.inscrits
  for each row execute function public.synchro_profil();

-- Passage à l'année suivante, en masse (admin seulement) :
-- D4 est désactivé, D3 → D4, D2 → D3, D1 → D2. Les groupes sont vidés.
create or replace function public.passage_annee()
returns integer
language plpgsql security definer set search_path = public
as $$
declare n integer;
begin
  if not public.est_admin() then
    raise exception 'Réservé aux administrateurs';
  end if;
  update public.inscrits set actif = false where role = 'etudiant' and promo = 'D4';
  update public.inscrits
     set promo = case promo when 'D3' then 'D4' when 'D2' then 'D3' when 'D1' then 'D2' end,
         groupe_id = null
   where role = 'etudiant' and actif and promo in ('D1','D2','D3');
  get diagnostics n = row_count;
  return n;
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Règles d'accès (Row Level Security)
-- ---------------------------------------------------------------------

alter table public.groupes       enable row level security;
alter table public.inscrits      enable row level security;
alter table public.profils       enable row level security;
alter table public.seances       enable row level security;
alter table public.documents     enable row level security;
alter table public.annonces      enable row level security;
alter table public.annonces_lues enable row level security;

-- groupes : lisibles par tout compte actif, modifiables par l'admin
drop policy if exists groupes_lecture on public.groupes;
create policy groupes_lecture on public.groupes for select to authenticated
  using (public.est_actif());
drop policy if exists groupes_admin on public.groupes;
create policy groupes_admin on public.groupes for all to authenticated
  using (public.est_admin()) with check (public.est_admin());

-- inscrits : admin seulement
drop policy if exists inscrits_admin on public.inscrits;
create policy inscrits_admin on public.inscrits for all to authenticated
  using (public.est_admin()) with check (public.est_admin());

-- profils : chacun lit le sien ; l'admin lit tout. Aucune écriture
-- directe (tout passe par inscrits + triggers).
drop policy if exists profils_lecture on public.profils;
create policy profils_lecture on public.profils for select to authenticated
  using (id = auth.uid() or public.est_admin());

-- séances : lecture filtrée par promo/groupe ; écriture par l'équipe
drop policy if exists seances_lecture on public.seances;
create policy seances_lecture on public.seances for select to authenticated
  using (public.peut_voir_seance(seances));
drop policy if exists seances_equipe on public.seances;
create policy seances_equipe on public.seances for all to authenticated
  using (public.est_equipe()) with check (public.est_equipe());

-- documents : visibles si la séance l'est ; écriture par l'équipe
drop policy if exists documents_lecture on public.documents;
create policy documents_lecture on public.documents for select to authenticated
  using (exists (select 1 from public.seances s where s.id = seance_id and public.peut_voir_seance(s)));
drop policy if exists documents_equipe on public.documents;
create policy documents_equipe on public.documents for all to authenticated
  using (public.est_equipe()) with check (public.est_equipe());

-- annonces : lecture par promo ; écriture par l'admin
drop policy if exists annonces_lecture on public.annonces;
create policy annonces_lecture on public.annonces for select to authenticated
  using (public.est_equipe() or (public.mon_profil()).promo = any (promos));
drop policy if exists annonces_admin on public.annonces;
create policy annonces_admin on public.annonces for all to authenticated
  using (public.est_admin()) with check (public.est_admin());

-- annonces lues : chacun gère les siennes
drop policy if exists lues_perso on public.annonces_lues;
create policy lues_perso on public.annonces_lues for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- 5. Fichiers (bucket privé « documents ») : lecture si le document est
--    visible, dépôt et suppression par l'équipe.
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

drop policy if exists documents_fichiers_lecture on storage.objects;
create policy documents_fichiers_lecture on storage.objects for select to authenticated
  using (bucket_id = 'documents' and exists (
    select 1 from public.documents d join public.seances s on s.id = d.seance_id
    where d.chemin = storage.objects.name and public.peut_voir_seance(s)));
drop policy if exists documents_fichiers_equipe on storage.objects;
create policy documents_fichiers_equipe on storage.objects for all to authenticated
  using (bucket_id = 'documents' and public.est_equipe())
  with check (bucket_id = 'documents' and public.est_equipe());

-- =====================================================================
-- 6. QCM des épreuves : dossiers progressifs importés de Théia, copies
--    des étudiants, correction automatique (barème EDN), classement.
-- =====================================================================

-- Une même épreuve posée à plusieurs groupes (bouton « Dupliquer ») forme
-- une série : les séances partagent le même QCM et le même classement.
-- serie = id de la séance d'origine (null pour la séance d'origine elle-même).
alter table public.seances add column if not exists serie uuid references public.seances(id) on delete set null;
alter table public.seances add column if not exists correction_publiee boolean not null default false;

create or replace function public.serie_de(s public.seances)
returns uuid language sql immutable as $$ select coalesce(s.serie, s.id) $$;

create table if not exists public.dossiers (
  id uuid primary key default gen_random_uuid(),
  serie_id uuid not null references public.seances(id) on delete cascade,
  titre text not null,
  matiere text not null default '',
  contexte text not null default '',        -- énoncé commun du cas clinique (texte)
  ordre integer not null default 0,
  unique (serie_id, titre)
);

-- Questions SANS les bonnes réponses (celles-ci sont dans « corrections »).
create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  serie_id uuid not null references public.seances(id) on delete cascade,
  dossier_id uuid not null references public.dossiers(id) on delete cascade,
  qti_id text not null,                     -- identifiant Théia : un nouvel import met à jour la question
  ordre integer not null,
  type text not null check (type in ('QRU','QRM','QROC')),
  enonce text not null default '',          -- HTML nettoyé à l'import
  propositions jsonb not null default '[]', -- [{ "id": "A1", "texte": "<p>…</p>" }]
  unique (serie_id, qti_id)
);

create table if not exists public.corrections (
  question_id uuid primary key references public.questions(id) on delete cascade,
  bonnes text[] not null default '{}',          -- id des propositions justes (QRU/QRM)
  reponses_qroc text[] not null default '{}',   -- réponses acceptées (QROC)
  refusees_qroc text[] not null default '{}',   -- réponses refusées par l'équipe (QROC), même si proches
  explications jsonb not null default '{}',     -- { "A1": "<p>…</p>" }
  commentaire text not null default ''
);

create table if not exists public.copies (
  id uuid primary key default gen_random_uuid(),
  seance_id uuid not null references public.seances(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  commencee_le timestamptz not null default now(),
  rendue_le timestamptz,
  unique (seance_id, user_id)
);

create table if not exists public.reponses (
  copie_id uuid not null references public.copies(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  choix text[] not null default '{}',
  texte text not null default '',
  validee boolean not null default false,   -- validée = plus modifiable (pas de retour en arrière)
  modifiee_le timestamptz not null default now(),
  primary key (copie_id, question_id)
);

-- Délai de grâce après l'heure de fin (réseau lent, envoi en attente).
create or replace function public.epreuve_ouverte(s public.seances)
returns boolean language sql stable as $$
  select s.epreuve and not s.annulee and now() >= s.debut and now() <= s.fin + interval '2 minutes'
$$;

-- Le sujet d'une série est-il visible pour moi ? (équipe : toujours ;
-- étudiant : une séance de la série le concerne et elle a commencé)
create or replace function public.peut_voir_sujet(p_serie uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.est_equipe() or exists (
    select 1 from public.seances s
    where public.serie_de(s) = p_serie and public.peut_voir_seance(s) and now() >= s.debut)
$$;

-- Série terminée : tous les groupes (séances non annulées) ont fini l'épreuve.
create or replace function public.serie_terminee(p_serie uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select not exists (select 1 from public.seances s where public.serie_de(s) = p_serie and not s.annulee and s.fin > now())
$$;

-- Correction détaillée (bonnes réponses) : visible quand tous les groupes ont
-- passé l'épreuve, ou plus tôt si l'équipe la publie. Elle ne doit pas fuiter
-- vers un groupe qui n'a pas encore composé.
create or replace function public.peut_voir_correction(p_serie uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.est_equipe() or exists (
    select 1 from public.seances s
    where public.serie_de(s) = p_serie and public.peut_voir_seance(s)
      and (s.correction_publiee or (now() >= s.debut and public.serie_terminee(p_serie))))
$$;

-- Barème MDEPi (type EDN). QRM : 0 discordance = 1, 1 = 0,5, 2 = 0,2, 3+ = 0.
-- QRU : 1 si la bonne réponse seule est cochée. QROC : 1 si la réponse correspond
-- à une réponse acceptée (correction automatique tolérante, voir qroc_juste) et
-- n'a pas été refusée par l'équipe.
-- Même calcul en JavaScript dans src/lib/bareme.js : les garder identiques.
create or replace function public.normaliser(t text)
returns text language sql immutable as $$
  select regexp_replace(lower(translate(coalesce(t, ''),
    'ÀÂÄÁÃÉÈÊËÍÌÎÏÓÒÔÖÕÚÙÛÜÇàâäáãéèêëíìîïóòôöõúùûüç',
    'AAAAAEEEEIIIIOOOOOUUUUCaaaaaeeeeiiiiooooouuuuc')), '\s+', ' ', 'g')
$$;

-- Correction automatique des QROC. Même calcul en JavaScript dans
-- src/lib/qroc.js (explications et listes de mots) : les garder identiques.
-- Les cas de tests/qroc-cas.json sont vérifiés des deux côtés.
create or replace function public.cle_qroc(t text)
returns text language plpgsql immutable as $$
declare
  s text; m text; res text[] := '{}';
  vides text[] := array['le', 'la', 'les', 'l', 'un', 'une', 'des', 'de', 'du', 'd', 'au', 'aux', 'a', 'en', 'et', 'par', 'pour', 'avec', 'sur'];
  syn jsonb := '{"tdm": "scanner", "tomodensitometrie": "scanner", "scanographie": "scanner", "ap": "abdominopelvien", "injecte": "injection", "injectee": "injection", "injectes": "injection", "injectees": "injection", "ecg": "electrocardiogramme", "echo": "echographie", "rx": "radiographie", "radio": "radiographie", "nfs": "hemogramme", "aigu": "aigue", "aigus": "aigue", "aigues": "aigue"}';
begin
  s := public.normaliser(t);
  s := replace(s, '%', ' pourcent ');
  s := regexp_replace(s, '(\d),(\d)', '\1.\2', 'g');
  s := regexp_replace(s, '[^a-z0-9.]+', ' ', 'g');
  s := regexp_replace(s, '\.(?!\d)|(?<!\d)\.', ' ', 'g');
  s := btrim(regexp_replace(s, '\s+', ' ', 'g'));
  s := btrim(replace(' ' || s || ' ', ' abdomino pelvien ', ' abdominopelvien '));
  s := btrim(replace(' ' || s || ' ', ' abdomino pelvienne ', ' abdominopelvien '));
  s := btrim(replace(' ' || s || ' ', ' abdominopelvienne ', ' abdominopelvien '));
  s := btrim(replace(' ' || s || ' ', ' abdo pelvien ', ' abdominopelvien '));
  foreach m in array string_to_array(s, ' ') loop
    continue when m = '';
    m := coalesce(syn->>m, m);
    continue when m = any(vides);
    if length(m) > 3 and m ~ '[sx]$' and m !~ '\d' then m := left(m, -1); end if;
    res := res || coalesce(syn->>m, m);
  end loop;
  return array_to_string(res, ' ');
end;
$$;

-- Distance d'édition (nombre de lettres à changer), limitée aux mots proches.
create or replace function public.distance_qroc(a text, b text)
returns integer language plpgsql immutable as $$
declare prec integer[]; cur integer[]; i integer; j integer;
begin
  if abs(length(a) - length(b)) > 2 then return 99; end if;
  prec := array(select generate_series(0, length(b)));
  for i in 1..length(a) loop
    cur := array[i];
    for j in 1..length(b) loop
      cur := cur || least(prec[j + 1] + 1, cur[j] + 1, prec[j] + case when substr(a, i, 1) = substr(b, j, 1) then 0 else 1 end);
    end loop;
    prec := cur;
  end loop;
  return prec[length(b) + 1];
end;
$$;

create or replace function public.qroc_juste(p_texte text, p_acceptees text[], p_refusees text[])
returns boolean language plpgsql immutable as $$
declare
  t text := public.cle_qroc(p_texte); k text; tol integer;
  unites text[] := array['g', 'gramme', 'mg', 'kg', 'ml', 'cl', 'l', 'litre', 'j', 'jour', 'h', 'heure', 'min', 'minute', 'an', 'ans', 'semaine', 'mois', 'cm', 'mm', 'mmhg', 'ui', 'pourcent', 'pct', 'verre', 'unite'];
  negs text[] := array['sans', 'non', 'pas', 'absence'];
  tri text; nt text[]; nk text[];
begin
  if t = '' then return false; end if;
  if exists (select 1 from unnest(coalesce(p_refusees, '{}')) r where public.cle_qroc(r) = t) then return false; end if;
  tri := array_to_string(array(select x from unnest(string_to_array(t, ' ')) x order by x collate "C"), ' ');
  nt := array(select x from unnest(string_to_array(t, ' ')) with ordinality u(x, n) where x ~ '^\d+(\.\d+)?$' order by n);
  for k in select public.cle_qroc(a) from unnest(coalesce(p_acceptees, '{}')) a loop
    continue when k = '';
    if k = t or array_to_string(array(select x from unnest(string_to_array(k, ' ')) x order by x collate "C"), ' ') = tri then return true; end if;
  end loop;
  for k in select public.cle_qroc(a) from unnest(coalesce(p_acceptees, '{}')) a loop
    continue when k = '';
    nk := array(select x from unnest(string_to_array(k, ' ')) with ordinality u(x, n) where x ~ '^\d+(\.\d+)?$' order by n);
    if cardinality(nk) > 0 and nk = nt and not exists (
      select 1 from unnest(string_to_array(t, ' ')) m
      where not (m = any(nt) or m = any(unites) or m = any(string_to_array(k, ' ')))) then return true; end if;
  end loop;
  if t ~ '\d' then return false; end if;
  for k in select public.cle_qroc(a) from unnest(coalesce(p_acceptees, '{}')) a loop
    continue when k = '' or k ~ '\d'
      or (string_to_array(k, ' ') && negs) <> (string_to_array(t, ' ') && negs)
      or left(k, 4) <> left(t, 4) or right(k, 3) <> right(t, 3);
    tol := case when length(k) >= 12 then 2 when length(k) >= 6 then 1 else 0 end;
    if tol > 0 and public.distance_qroc(t, k) <= tol then return true; end if;
  end loop;
  return false;
end;
$$;

create or replace function public.points(p_type text, p_propositions jsonb, p_bonnes text[], p_qroc text[], p_choix text[], p_texte text, p_refus text[] default '{}')
returns numeric language plpgsql immutable as $$
declare d integer;
begin
  if p_type = 'QROC' then
    return case when public.qroc_juste(p_texte, p_qroc, p_refus) then 1 else 0 end;
  end if;
  select count(*) into d from jsonb_array_elements(p_propositions) p
   where ((p->>'id') = any (coalesce(p_choix, '{}'))) <> ((p->>'id') = any (p_bonnes));
  if p_type = 'QRU' then return case when d = 0 then 1 else 0 end; end if;
  return case d when 0 then 1 when 1 then 0.5 when 2 then 0.2 else 0 end;
end;
$$;

-- Note d'une copie : points, total, note sur 20.
create or replace function public.note_copie(p_copie uuid)
returns table (points numeric, total integer, note20 numeric)
language sql stable security definer set search_path = public as $$
  with c as (select c.*, public.serie_de(s) as serie from public.copies c join public.seances s on s.id = c.seance_id where c.id = p_copie)
  select coalesce(sum(public.points(q.type, q.propositions, k.bonnes, k.reponses_qroc, r.choix, r.texte, k.refusees_qroc)), 0),
         count(q.id)::integer,
         case when count(q.id) = 0 then 0 else round(20 * coalesce(sum(public.points(q.type, q.propositions, k.bonnes, k.reponses_qroc, r.choix, r.texte, k.refusees_qroc)), 0) / count(q.id), 2) end
  from c join public.questions q on q.serie_id = c.serie
  join public.corrections k on k.question_id = q.id
  left join public.reponses r on r.copie_id = c.id and r.question_id = q.id
$$;

-- Nombre de questions et de dossiers d'une épreuve (visible avant l'ouverture,
-- sans dévoiler le sujet).
create or replace function public.infos_qcm(p_seance uuid)
returns table (questions integer, dossiers integer, correction_visible boolean, groupes_restants integer)
language sql stable security definer set search_path = public as $$
  select (select count(*)::integer from public.questions q where q.serie_id = public.serie_de(s)),
         (select count(*)::integer from public.dossiers d where d.serie_id = public.serie_de(s)),
         public.peut_voir_correction(public.serie_de(s)),
         (select count(*)::integer from public.seances x where public.serie_de(x) = public.serie_de(s) and not x.annulee and x.fin > now())
  from public.seances s where s.id = p_seance and public.peut_voir_seance(s)
$$;

-- Commencer (ou reprendre) l'épreuve : crée la copie de l'étudiant.
create or replace function public.commencer_epreuve(p_seance uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare s public.seances; v uuid;
begin
  select * into s from public.seances where id = p_seance;
  if not found or not public.peut_voir_seance(s) or not s.epreuve then raise exception 'Épreuve introuvable'; end if;
  select id into v from public.copies where seance_id = p_seance and user_id = auth.uid();
  if v is not null then return v; end if;
  if not public.epreuve_ouverte(s) then raise exception 'Épreuve fermée'; end if;
  insert into public.copies (seance_id, user_id) values (p_seance, auth.uid()) returning id into v;
  return v;
end;
$$;

-- Enregistrer une réponse (à chaque coche). p_valider = true verrouille la question.
create or replace function public.enregistrer_reponse(p_seance uuid, p_question uuid, p_choix text[], p_texte text, p_valider boolean)
returns void language plpgsql security definer set search_path = public as $$
declare s public.seances; c public.copies; q public.questions; deja boolean;
begin
  select * into s from public.seances where id = p_seance;
  select * into c from public.copies where seance_id = p_seance and user_id = auth.uid();
  if c.id is null then raise exception 'Copie introuvable'; end if;
  if c.rendue_le is not null then raise exception 'Copie déjà rendue'; end if;
  if not public.epreuve_ouverte(s) then raise exception 'Épreuve fermée'; end if;
  select * into q from public.questions where id = p_question and serie_id = public.serie_de(s);
  if q.id is null then raise exception 'Question introuvable'; end if;
  if exists (select 1 from unnest(coalesce(p_choix, '{}')) x where not exists (
      select 1 from jsonb_array_elements(q.propositions) p where p->>'id' = x)) then
    raise exception 'Proposition inconnue';
  end if;
  select validee into deja from public.reponses where copie_id = c.id and question_id = q.id;
  if deja then raise exception 'Question déjà validée'; end if;
  insert into public.reponses (copie_id, question_id, choix, texte, validee, modifiee_le)
  values (c.id, q.id, coalesce(p_choix, '{}'), left(coalesce(p_texte, ''), 500), coalesce(p_valider, false), now())
  on conflict (copie_id, question_id) do update
    set choix = excluded.choix, texte = excluded.texte, validee = excluded.validee, modifiee_le = now();
end;
$$;

create or replace function public.rendre_copie(p_seance uuid)
returns void language sql security definer set search_path = public as $$
  update public.copies set rendue_le = now() where seance_id = p_seance and user_id = auth.uid() and rendue_le is null
$$;

-- Mon résultat, dès la fin de mon épreuve : note, moyenne et rang parmi les
-- copies des groupes qui ont déjà fini. Quand un autre groupe passe l'épreuve,
-- ses copies s'ajoutent au classement (les premiers résultats restent).
create or replace function public.mon_resultat(p_seance uuid)
returns table (points numeric, total integer, note20 numeric, moyenne numeric, rang integer, effectif integer, groupes_restants integer)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare s public.seances; ma uuid;
begin
  select * into s from public.seances where id = p_seance;
  if not found or not public.peut_voir_seance(s) or now() < s.fin then return; end if;
  select id into ma from public.copies where seance_id = p_seance and user_id = auth.uid();
  if ma is null then return; end if;
  return query
  with toutes as (
    select c.id, n.points, n.total, n.note20 from public.copies c
    join public.seances x on x.id = c.seance_id and public.serie_de(x) = public.serie_de(s) and x.fin <= now()
    cross join lateral public.note_copie(c.id) n)
  select t.points, t.total, t.note20,
         (select round(avg(note20), 2) from toutes),
         (select count(*)::integer + 1 from toutes o where o.note20 > t.note20),
         (select count(*)::integer from toutes),
         (select count(*)::integer from public.seances x where public.serie_de(x) = public.serie_de(s) and not x.annulee and x.fin > now())
  from toutes t where t.id = ma;
end;
$$;

-- Résultats de toute la série (équipe).
create or replace function public.resultats_epreuve(p_seance uuid)
returns table (seance_id uuid, user_id uuid, email text, prenom text, nom text, groupe text,
               commencee_le timestamptz, rendue_le timestamptz, points numeric, total integer, note20 numeric, rang integer)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare s public.seances;
begin
  if not public.est_equipe() then raise exception 'Réservé à l''équipe'; end if;
  select * into s from public.seances where id = p_seance;
  return query
  with t as (
    select c.seance_id, c.user_id, p.email, p.prenom, p.nom, g.nom as groupe, c.commencee_le, c.rendue_le, n.points, n.total, n.note20
    from public.copies c
    join public.seances x on x.id = c.seance_id and public.serie_de(x) = public.serie_de(s)
    join public.profils p on p.id = c.user_id
    left join public.groupes g on g.id = p.groupe_id
    cross join lateral public.note_copie(c.id) n)
  select t.*, (rank() over (order by t.note20 desc))::integer from t order by t.note20 desc, t.nom;
end;
$$;

-- Règles d'accès
alter table public.dossiers    enable row level security;
alter table public.questions   enable row level security;
alter table public.corrections enable row level security;
alter table public.copies      enable row level security;
alter table public.reponses    enable row level security;

drop policy if exists dossiers_lecture on public.dossiers;
create policy dossiers_lecture on public.dossiers for select to authenticated using (public.peut_voir_sujet(serie_id));
drop policy if exists dossiers_equipe on public.dossiers;
create policy dossiers_equipe on public.dossiers for all to authenticated using (public.est_equipe()) with check (public.est_equipe());

drop policy if exists questions_lecture on public.questions;
create policy questions_lecture on public.questions for select to authenticated using (public.peut_voir_sujet(serie_id));
drop policy if exists questions_equipe on public.questions;
create policy questions_equipe on public.questions for all to authenticated using (public.est_equipe()) with check (public.est_equipe());

drop policy if exists corrections_lecture on public.corrections;
create policy corrections_lecture on public.corrections for select to authenticated
  using (exists (select 1 from public.questions q where q.id = question_id and public.peut_voir_correction(q.serie_id)));
drop policy if exists corrections_equipe on public.corrections;
create policy corrections_equipe on public.corrections for all to authenticated using (public.est_equipe()) with check (public.est_equipe());

-- Copies et réponses : lecture de les siennes (ou tout pour l'équipe) ;
-- écriture uniquement par les fonctions ci-dessus.
drop policy if exists copies_lecture on public.copies;
create policy copies_lecture on public.copies for select to authenticated using (user_id = auth.uid() or public.est_equipe());
drop policy if exists reponses_lecture on public.reponses;
create policy reponses_lecture on public.reponses for select to authenticated
  using (exists (select 1 from public.copies c where c.id = copie_id and (c.user_id = auth.uid() or public.est_equipe())));

-- Entraînement : une épreuve terminée peut être rejouée (sans compter dans le
-- classement). Chaque tentative est gardée pour l'onglet Progrès.
create table if not exists public.entrainements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  serie_id uuid not null references public.seances(id) on delete cascade,
  reponses jsonb not null default '{}',
  points numeric not null default 0,
  total integer not null default 0,
  fait_le timestamptz not null default now()
);
alter table public.entrainements enable row level security;
drop policy if exists entrainements_lecture on public.entrainements;
create policy entrainements_lecture on public.entrainements for select to authenticated using (user_id = auth.uid() or public.est_equipe());
drop policy if exists entrainements_ajout on public.entrainements;
create policy entrainements_ajout on public.entrainements for insert to authenticated
  with check (user_id = auth.uid() and public.peut_voir_correction(serie_id));

-- Images des QCM : bucket « documents », dossier qcm/<série>/…
drop policy if exists qcm_images_lecture on storage.objects;
create policy qcm_images_lecture on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = 'qcm'
         and public.peut_voir_sujet(((storage.foldername(name))[2])::uuid));
