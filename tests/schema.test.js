// Vérifie le schéma SQL et le cloisonnement (RLS) dans un vrai Postgres
// (PGlite, Postgres compilé en WebAssembly), avec une imitation minimale
// des schémas « auth » et « storage » de Supabase.
import { describe, it, expect, beforeAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

const SUPABASE_MOCK = `
create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text);
create function auth.uid() returns uuid language sql stable
  as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
grant usage on schema public, auth, storage to authenticated;
`;

const GRANTS = `
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select, insert, update, delete on storage.objects to authenticated;
grant execute on all functions in schema public to authenticated;
`;

let db;
const ids = {};

async function en(uid, sql, params) {
  await db.exec(`set role postgres; select set_config('test.uid', '${uid ?? ''}', false); set role authenticated;`);
  try {
    return (await db.query(sql, params)).rows;
  } finally {
    await db.exec('reset role;');
  }
}

async function inscrire(email) {
  const r = await db.query('insert into auth.users (email) values ($1) returning id', [email]);
  return r.rows[0].id;
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_MOCK);
  const schema = readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8');
  await db.exec(schema);
  await db.exec(schema); // relançable sans erreur
  await db.exec(GRANTS);

  const g = await db.query(`insert into groupes (promo, nom) values ('D2','A'),('D2','B') returning id`);
  ids.gA = g.rows[0].id;
  ids.gB = g.rows[1].id;
  await db.query(
    `insert into inscrits (email, prenom, role, promo, groupe_id) values
     ('camille@ex.fr','Camille','etudiant','D2',$1),
     ('leo@ex.fr','Léo','etudiant','D2',$2),
     ('ines@ex.fr','Inès','etudiant','D3',null),
     ('admin@ex.fr','Julien','admin',null,null),
     ('prof@ex.fr','Prof','enseignant',null,null)`,
    [ids.gA, ids.gB]
  );
  ids.camille = await inscrire('Camille@ex.fr');
  ids.leo = await inscrire('leo@ex.fr');
  ids.ines = await inscrire('ines@ex.fr');
  ids.admin = await inscrire('admin@ex.fr');
  ids.prof = await inscrire('prof@ex.fr');

  const s = await db.query(
    `insert into seances (titre, debut, fin, promos, groupes) values
     ('Toute la D2', now(), now() + interval '3 hours', '{D2}', '{}'),
     ('D2 groupe A', now(), now() + interval '3 hours', '{D2}', array[$1]::uuid[]),
     ('D3 seule', now(), now() + interval '3 hours', '{D3}', '{}')
     returning id`,
    [ids.gA]
  );
  ids.seanceD3 = s.rows[2].id;
  await db.query(`insert into documents (seance_id, type, titre, chemin) values ($1,'support','PDF D3','d3/support.pdf')`, [ids.seanceD3]);
  await db.query(`insert into storage.objects (bucket_id, name) values ('documents','d3/support.pdf')`);
  await db.query(`insert into annonces (texte, promos) values ('Pour D2','{D2}'),('Pour tous','{D1,D2,D3,D4}')`);
});

describe('inscription', () => {
  it('refuse une adresse absente de la liste des inscrits', async () => {
    await expect(inscrire('inconnu@ex.fr')).rejects.toThrow(/non inscrite/);
  });

  it('crée le profil avec la promo et le groupe de l’inscrit (e-mail en minuscules)', async () => {
    const r = await db.query('select email, promo, groupe_id from profils where id = $1', [ids.camille]);
    expect(r.rows[0]).toEqual({ email: 'camille@ex.fr', promo: 'D2', groupe_id: ids.gA });
  });
});

describe('cloisonnement du planning', () => {
  const titres = async (uid) => (await en(uid, 'select titre from seances order by titre')).map((r) => r.titre);

  it('un étudiant du groupe A voit sa promo et son groupe', async () => {
    expect(await titres(ids.camille)).toEqual(['D2 groupe A', 'Toute la D2']);
  });
  it('un étudiant du groupe B ne voit pas les séances du groupe A', async () => {
    expect(await titres(ids.leo)).toEqual(['Toute la D2']);
  });
  it('un étudiant de D3 ne voit que la D3', async () => {
    expect(await titres(ids.ines)).toEqual(['D3 seule']);
  });
  it("l'équipe voit tout", async () => {
    expect((await titres(ids.prof)).length).toBe(3);
  });
  it('un visiteur non connecté ne voit rien', async () => {
    expect(await titres(null)).toEqual([]);
  });
  it('un étudiant ne peut pas créer de séance', async () => {
    await expect(
      en(ids.camille, `insert into seances (titre, debut, fin, promos) values ('x', now(), now() + interval '1 hour', '{D2}')`)
    ).rejects.toThrow(/row-level security/);
  });
  it('un enseignant peut créer une séance', async () => {
    const r = await en(ids.prof, `insert into seances (titre, debut, fin, promos) values ('Prof', now(), now() + interval '1 hour', '{D1}') returning titre`);
    expect(r[0].titre).toBe('Prof');
  });
});

describe('documents et fichiers', () => {
  it('un fichier de D3 est invisible pour la D2, visible pour la D3', async () => {
    expect(await en(ids.camille, 'select name from storage.objects')).toEqual([]);
    expect(await en(ids.ines, 'select name from storage.objects')).toEqual([{ name: 'd3/support.pdf' }]);
    expect((await en(ids.camille, 'select * from documents')).length).toBe(0);
  });
});

describe('annonces', () => {
  it('chaque promo ne voit que ses annonces', async () => {
    expect((await en(ids.camille, 'select texte from annonces order by texte')).map((r) => r.texte)).toEqual(['Pour D2', 'Pour tous']);
    expect((await en(ids.ines, 'select texte from annonces')).map((r) => r.texte)).toEqual(['Pour tous']);
  });
  it('un enseignant ne publie pas d’annonce, l’admin oui', async () => {
    await expect(en(ids.prof, `insert into annonces (texte) values ('x')`)).rejects.toThrow(/row-level security/);
    const r = await en(ids.admin, `insert into annonces (texte, promos) values ('Admin', '{D1}') returning texte`);
    expect(r[0].texte).toBe('Admin');
  });
  it('un étudiant marque une annonce lue pour lui seul', async () => {
    const [a] = await en(ids.camille, 'select id from annonces limit 1');
    await en(ids.camille, 'insert into annonces_lues (user_id, annonce_id) values ($1, $2)', [ids.camille, a.id]);
    await expect(en(ids.camille, 'insert into annonces_lues (user_id, annonce_id) values ($1, $2)', [ids.leo, a.id])).rejects.toThrow(
      /row-level security/
    );
  });
});

describe('comptes', () => {
  it('un étudiant ne lit que son profil et pas la liste des inscrits', async () => {
    expect((await en(ids.camille, 'select email from profils')).map((r) => r.email)).toEqual(['camille@ex.fr']);
    expect(await en(ids.camille, 'select * from inscrits')).toEqual([]);
  });
  it('désactiver un inscrit coupe son accès', async () => {
    await en(ids.admin, `update inscrits set actif = false where email = 'leo@ex.fr'`);
    expect(await en(ids.leo, 'select titre from seances')).toEqual([]);
    await en(ids.admin, `update inscrits set actif = true where email = 'leo@ex.fr'`);
    expect((await en(ids.leo, 'select titre from seances')).length).toBe(1);
  });
  it('changer le groupe d’un inscrit change ce qu’il voit', async () => {
    await en(ids.admin, `update inscrits set groupe_id = $1 where email = 'leo@ex.fr'`, [ids.gA]);
    expect((await en(ids.leo, 'select titre from seances')).length).toBe(2);
  });
  it('le passage d’année est réservé à l’admin et fait monter les promos', async () => {
    await expect(en(ids.camille, 'select passage_annee()')).rejects.toThrow(/administrateurs/);
    await en(ids.admin, 'select passage_annee()');
    const r = await db.query(`select email, promo, groupe_id from inscrits where role = 'etudiant' order by email`);
    expect(r.rows.map((x) => [x.email, x.promo, x.groupe_id])).toEqual([
      ['camille@ex.fr', 'D3', null],
      ['ines@ex.fr', 'D4', null],
      ['leo@ex.fr', 'D3', null],
    ]);
  });
});
