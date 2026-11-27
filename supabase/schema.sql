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
  type text not null check (type in ('support','correction')),
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
