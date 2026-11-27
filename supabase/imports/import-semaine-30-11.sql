-- =====================================================================
-- MDEPi : planning de la semaine du 30/11/2026, repris de Notion
-- (page « Semaine du 30/11 » et base « Conférences »).
-- À coller dans Supabase > SQL Editor > New query, puis Run.
-- Sans risque : peut être relancé, rien n'est ajouté en double.
-- Horaires : compo 18h45 - 20h15 (heure de Paris). Zoom : pas encore de lien.
-- =====================================================================

-- 1. Groupes nécessaires (créés seulement s'ils n'existent pas encore).
--    Si vos groupes portent un autre nom dans l'app, changez-le ici ET plus bas.
insert into public.groupes (promo, nom) values
  ('D3', 'Groupe 1'),
  ('D3', 'Groupe 2'),
  ('D2', 'Rota Card/Pneu')
on conflict (promo, nom) do nothing;

-- 2. Les 6 conférences notées de la semaine.
with semaine (titre, matiere, jour, lieu, promo, groupe) as (
  select * from (values
    ('Conf Uro',     'Urologie',         date '2026-11-30', '90 rue Sainte-Cécile', 'D3', 'Groupe 1'),
    ('Conf Neuro 2', 'Neurologie',       date '2026-11-30', '94 rue Sainte-Cécile', 'D1', null),
    ('Conf Réa',     'Anesthésie - Réa', date '2026-12-01', '90 rue Sainte-Cécile', 'D3', 'Groupe 2'),
    ('Conf Réa',     'Anesthésie - Réa', date '2026-12-02', '94 rue Sainte-Cécile', 'D3', 'Groupe 1'),
    ('Conf Uro',     'Urologie',         date '2026-12-02', '90 rue Sainte-Cécile', 'D3', 'Groupe 2'),
    ('Conf Réa',     'Anesthésie - Réa', date '2026-12-03', '94 rue Sainte-Cécile', 'D2', 'Rota Card/Pneu')
  ) as v
)
insert into public.seances (titre, matiere, debut, fin, lieu, presentiel, zoom_url, epreuve, categorie, promos, groupes)
select s.titre, s.matiere,
       (s.jour + time '18:45') at time zone 'Europe/Paris',
       (s.jour + time '20:15') at time zone 'Europe/Paris',
       s.lieu, true, null, true, 'conference',
       array[s.promo],
       case when s.groupe is null then '{}'::uuid[]
            else array[(select g.id from public.groupes g where g.promo = s.promo and g.nom = s.groupe)] end
from semaine s
where not exists (
  select 1 from public.seances x
  where x.titre = s.titre and x.promos = array[s.promo]
    and x.debut = (s.jour + time '18:45') at time zone 'Europe/Paris'
);

-- 3. G1 et G2 passent la même épreuve D3 : un seul QCM et un seul classement
--    (le Groupe 2 suit la série du premier groupe qui passe).
update public.seances b set serie = a.id
from public.seances a
where a.titre = b.titre and a.promos = array['D3'] and b.promos = array['D3']
  and a.titre in ('Conf Uro', 'Conf Réa')
  and a.debut::date between date '2026-11-30' and date '2026-12-06'
  and b.debut::date between date '2026-11-30' and date '2026-12-06'
  and a.debut < b.debut and b.serie is null;

-- 4. Vérification : doit afficher les 6 lignes.
select titre, promos, to_char(debut at time zone 'Europe/Paris', 'Dy DD/MM HH24:MI') as quand, lieu
from public.seances
where debut >= '2026-11-30' and debut < '2026-12-07' and titre like 'Conf %'
order by debut, titre;
