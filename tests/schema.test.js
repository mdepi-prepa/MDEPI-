// Vérifie le schéma SQL et le cloisonnement (RLS) dans un vrai Postgres
// (PGlite, Postgres compilé en WebAssembly), avec une imitation minimale
// des schémas « auth » et « storage » de Supabase.
import { describe, it, expect, beforeAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

const SUPABASE_MOCK = `
create role authenticated nologin;
create role anon nologin;
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text);
create function auth.uid() returns uuid language sql stable
  as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
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
  await db.exec(GRANTS); // droits par défaut de Supabase…
  await db.exec(schema); // … puis le script relancé (sans erreur) les restreint

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

describe('épreuves', () => {
  it('une épreuve ciblée sur un groupe porte un sujet visible du seul groupe', async () => {
    const [e] = await en(ids.prof, `insert into seances (titre, debut, fin, promos, groupes, epreuve) values ('CCB groupe B', now(), now() + interval '3 hours', '{D2}', array[$1]::uuid[], true) returning id`, [ids.gB]);
    await en(ids.prof, `insert into documents (seance_id, type, titre, chemin) values ($1, 'sujet', 'Sujet', 'ccb/sujet.pdf')`, [e.id]);
    expect((await en(ids.leo, `select d.type from documents d join seances s on s.id = d.seance_id where s.epreuve`))).toEqual([{ type: 'sujet' }]);
    expect(await en(ids.camille, `select * from documents where seance_id = $1`, [e.id])).toEqual([]);
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

describe('correction automatique des QROC (même résultat qu’en JavaScript)', () => {
  const cas = JSON.parse(readFileSync(new URL('./qroc-cas.json', import.meta.url), 'utf8'));
  it.each(cas)('« $texte » → $juste', async ({ texte, acceptees, refusees, juste }) => {
    const r = await db.query('select qroc_juste($1, $2, $3) as j', [texte, acceptees, refusees || []]);
    expect(r.rows[0].j).toBe(juste);
  });
});

describe('barème', () => {
  it('QRM : discordances, et 0 si aucune case cochée ; QRU vide : 0', async () => {
    const props = '[{"id":"A"},{"id":"B"},{"id":"C"},{"id":"D"},{"id":"E"}]';
    const pts = async (type, bonnes, choix) =>
      Number((await db.query(`select points($1, $2::jsonb, $3, '{}', $4, '') as p`, [type, props, bonnes, choix])).rows[0].p);
    expect(await pts('QRM', ['A', 'B'], ['A', 'B'])).toBe(1);
    expect(await pts('QRM', ['A', 'B'], ['A'])).toBe(0.5);
    expect(await pts('QRM', ['A', 'B'], ['A', 'C'])).toBe(0.2);
    expect(await pts('QRM', ['A', 'B'], [])).toBe(0);
    expect(await pts('QRM', ['A'], null)).toBe(0);
    expect(await pts('QRU', ['C'], [])).toBe(0);
    // Indispensable (A) oubliée ou inacceptable (E) cochée : 0.
    const fat = async (choix) =>
      Number((await db.query(`select points('QRM', $1::jsonb, '{A,B}', '{}', $2, '', '{}', '{A}', '{E}') as p`, [props, choix])).rows[0].p);
    expect(await fat(['A', 'B'])).toBe(1);
    expect(await fat(['A'])).toBe(0.5);
    expect(await fat(['B'])).toBe(0);
    expect(await fat(['A', 'B', 'E'])).toBe(0);
  });
});

describe('QCM des épreuves', () => {
  const q = {};
  it('l’équipe importe un sujet dans une épreuve partagée par deux groupes', async () => {
    const [e] = await en(ids.prof, `insert into seances (titre, debut, fin, promos, groupes, epreuve) values ('CCB QCM A', now() - interval '30 minutes', now() + interval '1 hour', '{D2}', array[$1]::uuid[], true) returning id`, [ids.gA]);
    const [e2] = await en(ids.prof, `insert into seances (titre, debut, fin, promos, groupes, epreuve, serie) values ('CCB QCM B', now() + interval '1 day', now() + interval '1 day 2 hours', '{D2}', array[$1]::uuid[], true, $2) returning id`, [ids.gB, e.id]);
    q.e = e.id; q.e2 = e2.id;
    const [d] = await en(ids.prof, `insert into dossiers (serie_id, titre) values ($1, 'DP1') returning id`, [e.id]);
    const [q1] = await en(ids.prof, `insert into questions (serie_id, dossier_id, qti_id, ordre, type, propositions) values ($1, $2, 'Q1', 1, 'QRM', '[{"id":"A"},{"id":"B"},{"id":"C"},{"id":"D"},{"id":"E"}]') returning id`, [e.id, d.id]);
    const [q2] = await en(ids.prof, `insert into questions (serie_id, dossier_id, qti_id, ordre, type) values ($1, $2, 'Q2', 2, 'QROC') returning id`, [e.id, d.id]);
    q.q1 = q1.id; q.q2 = q2.id;
    await en(ids.prof, `insert into corrections (question_id, bonnes) values ($1, '{A,B}')`, [q1.id]);
    await en(ids.prof, `insert into corrections (question_id, reponses_qroc) values ($1, '{ECG,électrocardiogramme}')`, [q2.id]);
  });
  it('le sujet n’est visible que des groupes dont l’épreuve a commencé ; les corrections restent cachées', async () => {
    // Dossier progressif : seule la 1re question est lisible ; le plan donne le nombre total.
    expect((await en(ids.camille, 'select qti_id from questions order by ordre')).map((r) => r.qti_id)).toEqual(['Q1']);
    expect((await en(ids.camille, 'select id from plan_qcm($1)', [q.e])).map((r) => r.id)).toEqual([q.q1, q.q2]);
    expect(await en(ids.leo, 'select * from plan_qcm($1)', [q.e2])).toEqual([]);
    expect((await en(ids.prof, 'select qti_id from questions where serie_id = $1', [q.e])).length).toBe(2);
    expect(await en(ids.leo, 'select * from questions')).toEqual([]);
    expect(await en(ids.leo, 'select * from infos_qcm($1)', [q.e2])).toMatchObject([{ questions: 2, dossiers: 1, correction_visible: false, groupes_restants: 2, resultats_publies: false, publication: 'cloture', qroc_en_cours: false }]);
    expect(await en(ids.ines, 'select * from infos_qcm($1)', [q.e2])).toEqual([]);
    expect(await en(ids.camille, 'select * from corrections')).toEqual([]);
    expect(await en(ids.ines, 'select * from questions')).toEqual([]);
  });
  it('un étudiant d’un autre groupe ou hors horaire ne peut pas commencer', async () => {
    await expect(en(ids.leo, 'select commencer_epreuve($1)', [q.e])).rejects.toThrow(/introuvable/);
    await expect(en(ids.leo, 'select commencer_epreuve($1)', [q.e2])).rejects.toThrow(/fermée/);
  });
  it('l’étudiant commence, coche, valide ; une question validée ne bouge plus', async () => {
    const [{ commencer_epreuve: c1 }] = await en(ids.camille, 'select commencer_epreuve($1)', [q.e]);
    const [{ commencer_epreuve: c2 }] = await en(ids.camille, 'select commencer_epreuve($1)', [q.e]);
    expect(c1).toBe(c2); // reprise
    await expect(en(ids.camille, `select enregistrer_reponse($1, $2, '{Z}', '', false)`, [q.e, q.q1])).rejects.toThrow(/inconnue/);
    await en(ids.camille, `select enregistrer_reponse($1, $2, '{A}', '', false)`, [q.e, q.q1]);
    // Q2 ni lisible ni modifiable tant que Q1 n'est pas validée.
    await expect(en(ids.camille, `select enregistrer_reponse($1, $2, '{}', 'ECG', true)`, [q.e, q.q2])).rejects.toThrow(/pas encore accessible/);
    expect((await en(ids.camille, 'select qti_id from questions')).length).toBe(1);
    await en(ids.camille, `select enregistrer_reponse($1, $2, '{A,B,C}', '', true)`, [q.e, q.q1]);
    await expect(en(ids.camille, `select enregistrer_reponse($1, $2, '{A,B}', '', true)`, [q.e, q.q1])).rejects.toThrow(/déjà validée/);
    expect((await en(ids.camille, 'select qti_id from questions order by ordre')).map((r) => r.qti_id)).toEqual(['Q1', 'Q2']);
    await en(ids.camille, `select enregistrer_reponse($1, $2, '{}', ' Électrocardiogramme ', true)`, [q.e, q.q2]);
    await expect(en(ids.camille, `insert into reponses (copie_id, question_id) values ($1, $2)`, [c1, q.q1])).rejects.toThrow(/permission|row-level/);
    expect((await en(ids.camille, 'select choix, validee from reponses order by modifiee_le')).length).toBe(2);
  });
  it('note et rang dès la fin de son épreuve ; les groupes suivants s’ajoutent au classement', async () => {
    expect(await en(ids.camille, 'select * from mon_resultat($1)', [q.e])).toEqual([]);
    await expect(en(ids.camille, 'select * from resultats_epreuve($1)', [q.e])).rejects.toThrow(/équipe/);
    // Heure de fin du groupe A passée d'une minute : délai de grâce, des réponses peuvent encore
    // arriver, donc ni note ni correction (sinon on pourrait lire la correction puis répondre).
    await db.query(`update seances set debut = now() - interval '2 hours', fin = now() - interval '1 minute' where id = $1`, [q.e]);
    expect(await en(ids.camille, 'select * from mon_resultat($1)', [q.e])).toEqual([]);
    expect(await en(ids.camille, 'select * from corrections')).toEqual([]);
    expect((await en(ids.camille, 'select correction_visible from infos_qcm($1)', [q.e]))[0].correction_visible).toBe(false);
    // Fin de l'épreuve du groupe A, délai de grâce compris.
    await db.query(`update seances set fin = now() - interval '3 minutes' where id = $1`, [q.e]);
    let [r] = await en(ids.camille, 'select * from mon_resultat($1)', [q.e]);
    // Q1 : {A,B,C} contre {A,B} = 1 discordance = 0,5 ; Q2 : juste = 1 → 1,5 / 2 = 15/20
    expect([Number(r.points), Number(r.note20), r.rang, r.effectif, r.groupes_restants]).toEqual([1.5, 15, 1, 1, 1]);
    // Le groupe A a fini : sa copie corrigée est visible tout de suite ; pas pour le groupe B, qui n'a pas composé.
    expect((await en(ids.camille, 'select * from corrections')).length).toBe(2);
    expect(await en(ids.leo, 'select * from corrections')).toEqual([]);
    // Le groupe B compose : sa copie ne compte qu'à la fin de son épreuve.
    await db.query(`update seances set debut = now() - interval '10 minutes', fin = now() + interval '1 hour' where id = $1`, [q.e2]);
    await en(ids.leo, 'select commencer_epreuve($1)', [q.e2]);
    await en(ids.leo, `select enregistrer_reponse($1, $2, '{A,B}', '', true)`, [q.e2, q.q1]);
    await en(ids.leo, `select enregistrer_reponse($1, $2, '{}', 'ECG', true)`, [q.e2, q.q2]);
    expect((await en(ids.camille, 'select effectif from mon_resultat($1)', [q.e]))[0].effectif).toBe(1);
    await db.query(`update seances set fin = now() - interval '3 minutes' where id = $1`, [q.e2]);
    [r] = await en(ids.camille, 'select * from mon_resultat($1)', [q.e]);
    expect([Number(r.note20), r.rang, r.effectif, Number(r.moyenne), r.groupes_restants]).toEqual([15, 2, 2, 17.5, 0]);
    expect((await en(ids.leo, 'select rang from mon_resultat($1)', [q.e2]))[0].rang).toBe(1);
    // Le groupe B a fini : correction visible pour lui aussi, entraînement possible.
    expect((await en(ids.leo, 'select * from corrections')).length).toBe(2);
    expect((await en(ids.camille, 'select correction_visible from infos_qcm($1)', [q.e]))[0].correction_visible).toBe(true);
    await en(ids.camille, `insert into entrainements (serie_id, points, total) values ($1, 2, 2)`, [q.e]);
    expect((await en(ids.camille, 'select points from entrainements')).length).toBe(1);
    expect(await en(ids.leo, 'select * from entrainements')).toEqual([]);
    await expect(en(ids.ines, `insert into entrainements (serie_id) values ($1)`, [q.e])).rejects.toThrow(/row-level/);
    const res = await en(ids.prof, 'select email, note20, rang from resultats_epreuve($1)', [q.e2]);
    expect(res.map((x) => [x.email, Number(x.note20), x.rang])).toEqual([['leo@ex.fr', 20, 1], ['camille@ex.fr', 15, 2]]);
  });
  it('une copie rendue n’est plus modifiable', async () => {
    await en(ids.camille, 'select rendre_copie($1)', [q.e]);
    await expect(en(ids.camille, `select enregistrer_reponse($1, $2, '{}', 'x', false)`, [q.e, q.q2])).rejects.toThrow(/rendue/);
  });
  it('marquer une proposition inacceptable recalcule les notes de la série', async () => {
    expect(Number((await en(ids.camille, 'select points from mon_resultat($1)', [q.e]))[0].points)).toBe(1.5);
    await en(ids.camille, `update corrections set inacceptables = '{B}' where question_id = $1`, [q.q1]); // sans effet : réservé à l'équipe
    expect(Number((await en(ids.camille, 'select points from mon_resultat($1)', [q.e]))[0].points)).toBe(1.5);
    await en(ids.prof, `update corrections set inacceptables = '{C}' where question_id = $1`, [q.q1]);
    // Camille avait coché C (inacceptable) en Q1 : 0 au lieu de 0,5.
    expect(Number((await en(ids.camille, 'select points from mon_resultat($1)', [q.e]))[0].points)).toBe(1);
    await en(ids.prof, `update corrections set inacceptables = '{}' where question_id = $1`, [q.q1]);
  });
  it('QRP : bonnes cochées ÷ n ; QROC « acceptable » : 0,5', async () => {
    const props = '[{"id":"A"},{"id":"B"},{"id":"C"},{"id":"D"},{"id":"E"}]';
    const qrp = async (choix, inacc = []) =>
      Number((await db.query(`select points('QRP', $1::jsonb, '{A,B,C}', '{}', $2, '', '{}', '{}', $3, '{}', 3) as p`, [props, choix, inacc])).rows[0].p);
    expect(await qrp(['A', 'B', 'C'])).toBe(1);
    expect((await qrp(['A', 'B'])).toFixed(4)).toBe('0.6667');
    expect((await qrp(['A', 'D'])).toFixed(4)).toBe('0.3333');
    expect(await qrp(['A', 'B', 'C', 'D'])).toBe(0); // plus de n cases
    expect(await qrp([])).toBe(0);
    expect(await qrp(['A', 'B', 'E'], ['E'])).toBe(0);
    const qroc = async (texte) =>
      Number((await db.query(`select points('QROC', '[]', '{}', '{ECG}', '{}', $1, '{}', '{}', '{}', '{holter}') as p`, [texte])).rows[0].p);
    expect(await qroc('électrocardiogramme')).toBe(1);
    expect(await qroc('Holter')).toBe(0.5);
    expect(await qroc('scanner')).toBe(0);
  });
  it('une QRP ne prend pas plus de n cases', async () => {
    const [d] = await en(ids.prof, `select id from dossiers where serie_id = $1`, [q.e]);
    await db.query(`update seances set fin = now() + interval '1 hour' where id = $1`, [q.e]);
    const [x] = await en(ids.prof, `insert into questions (serie_id, dossier_id, qti_id, ordre, type, nb_reponses, propositions) values ($1, $2, 'Q0', 0, 'QRP', 2, '[{"id":"A"},{"id":"B"},{"id":"C"}]') returning id`, [q.e, d.id]);
    await db.query(`update copies set rendue_le = null where user_id = $1`, [ids.camille]);
    await expect(en(ids.camille, `select enregistrer_reponse($1, $2, '{A,B,C}', '', false)`, [q.e, x.id])).rejects.toThrow(/Trop de cases/);
    await en(ids.camille, `select enregistrer_reponse($1, $2, '{A,B}', '', false)`, [q.e, x.id]);
    await db.query(`delete from reponses where question_id = $1`, [x.id]);
    await db.query(`delete from questions where id = $1`, [x.id]);
    await db.query(`update copies set rendue_le = now() where user_id = $1`, [ids.camille]);
    await db.query(`update seances set fin = now() - interval '3 minutes' where id = $1`, [q.e]);
  });
  it('coefficients ; question neutralisée (points pour tous) ou annulée (retirée de la note)', async () => {
    const note = async () => {
      const [r] = await en(ids.camille, 'select points, total, note20 from mon_resultat($1)', [q.e]);
      return [Number(r.points), r.total, Number(r.note20)];
    };
    expect(await note()).toEqual([1.5, 2, 15]);
    await en(ids.prof, `update questions set coefficient = 3 where id = $1`, [q.q1]);
    expect(await note()).toEqual([2.5, 4, 12.5]); // 3 × 0,5 + 1
    await en(ids.prof, `update questions set statut = 'neutralisee' where id = $1`, [q.q1]);
    expect(await note()).toEqual([4, 4, 20]);
    await en(ids.prof, `update questions set statut = 'annulee' where id = $1`, [q.q1]);
    expect(await note()).toEqual([1, 1, 20]);
    await en(ids.camille, `update questions set statut = 'normale' where id = $1`, [q.q1]); // sans effet : réservé à l'équipe
    expect(await note()).toEqual([1, 1, 20]);
    await en(ids.prof, `update questions set statut = 'normale', coefficient = 1 where id = $1`, [q.q1]);
    expect(await note()).toEqual([1.5, 2, 15]);
  });
  it('note et rang cachés tant que des réponses de QROC restent à corriger', async () => {
    // Plus aucune réponse acceptée ne correspond : les deux réponses sont « à corriger ».
    await en(ids.prof, `update corrections set reponses_qroc = '{scanner}' where question_id = $1`, [q.q2]);
    expect(await en(ids.camille, 'select * from mon_resultat($1)', [q.e])).toEqual([]);
    expect((await en(ids.camille, 'select qroc_en_cours from infos_qcm($1)', [q.e]))[0].qroc_en_cours).toBe(true);
    // L'équipe tranche : « ECG » / « Électrocardiogramme » (même réponse une fois mise en forme) jugée acceptable (0,5).
    await en(ids.prof, `update corrections set partielles_qroc = '{ECG}' where question_id = $1`, [q.q2]);
    expect(Number((await en(ids.camille, 'select points from mon_resultat($1)', [q.e]))[0].points)).toBe(1); // 0,5 + 0,5
    await en(ids.prof, `update corrections set reponses_qroc = '{ECG,électrocardiogramme}', partielles_qroc = '{}', refusees_qroc = '{}' where question_id = $1`, [q.q2]);
    expect(Number((await en(ids.camille, 'select points from mon_resultat($1)', [q.e]))[0].points)).toBe(1.5);
  });
  it('publication des résultats : jamais, ou à partir d’une date', async () => {
    await en(ids.prof, `update seances set publication = 'jamais' where id = $1`, [q.e]);
    expect(await en(ids.camille, 'select * from mon_resultat($1)', [q.e])).toEqual([]);
    expect(await en(ids.camille, 'select * from corrections')).toEqual([]);
    expect((await en(ids.camille, 'select resultats_publies, correction_visible from infos_qcm($1)', [q.e]))[0]).toEqual({ resultats_publies: false, correction_visible: false });
    await en(ids.prof, `update seances set publication = 'date', publication_le = now() + interval '1 day' where id = $1`, [q.e]);
    expect(await en(ids.camille, 'select * from mon_resultat($1)', [q.e])).toEqual([]);
    await en(ids.prof, `update seances set publication_le = now() - interval '1 minute' where id = $1`, [q.e]);
    expect((await en(ids.camille, 'select * from mon_resultat($1)', [q.e])).length).toBe(1);
    expect((await en(ids.camille, 'select * from corrections')).length).toBe(2);
    await expect(en(ids.prof, `update seances set publication = 'demain' where id = $1`, [q.e])).rejects.toThrow(/check/);
    await en(ids.prof, `update seances set publication = 'cloture', publication_le = null where id = $1`, [q.e]);
  });
  it('la note d’une copie ne se lit pas directement (seulement via mon résultat)', async () => {
    const [c] = await db.query('select id from copies where user_id = $1', [ids.leo]).then((r) => r.rows);
    await expect(en(ids.camille, 'select * from note_copie($1)', [c.id])).rejects.toThrow(/permission/);
  });
  it('une épreuve avec des copies, ou d’origine d’une série, ne se supprime pas ; ses questions non plus', async () => {
    await expect(en(ids.prof, 'delete from seances where id = $1', [q.e2])).rejects.toThrow(/déjà composé/);
    await expect(en(ids.prof, 'delete from questions where id = $1', [q.q1])).rejects.toThrow(/déjà répondu/);
    const [o] = await en(ids.prof, `insert into seances (titre, debut, fin, promos, epreuve) values ('Origine', now() + interval '2 days', now() + interval '2 days 1 hour', '{D2}', true) returning id`);
    const [d] = await en(ids.prof, `insert into seances (titre, debut, fin, promos, epreuve, serie) values ('Copie', now() + interval '3 days', now() + interval '3 days 1 hour', '{D2}', true, $1) returning id`, [o.id]);
    await expect(en(ids.prof, 'delete from seances where id = $1', [o.id])).rejects.toThrow(/dupliquées/);
    await en(ids.prof, 'delete from seances where id = $1', [d.id]);
    await en(ids.prof, 'delete from seances where id = $1', [o.id]);
  });
  it('sujet PDF d’une épreuve visible dès son début, correction PDF seulement après sa fin', async () => {
    const [e] = await en(ids.prof, `insert into seances (titre, debut, fin, promos, epreuve) values ('Papier', now() + interval '1 hour', now() + interval '2 hours', '{D2}', true) returning id`);
    await en(ids.prof, `insert into documents (seance_id, type, titre, chemin) values ($1,'correction','Corr','p/corr.pdf'),($1,'sujet','Sujet','p/sujet.pdf'),($1,'support','Fiche','p/fiche.pdf')`, [e.id]);
    await db.query(`insert into storage.objects (bucket_id, name) values ('documents','p/corr.pdf'),('documents','p/fiche.pdf')`);
    expect((await en(ids.camille, 'select type from documents where seance_id = $1', [e.id])).map((r) => r.type)).toEqual(['support']);
    expect((await en(ids.camille, `select name from storage.objects where name like 'p/%'`)).map((r) => r.name)).toEqual(['p/fiche.pdf']);
    await db.query(`update seances set debut = now() - interval '1 hour' where id = $1`, [e.id]);
    expect((await en(ids.camille, 'select type from documents where seance_id = $1 order by type', [e.id])).map((r) => r.type)).toEqual(['sujet', 'support']);
    expect((await en(ids.camille, `select name from storage.objects where name like 'p/%'`)).map((r) => r.name)).toEqual(['p/fiche.pdf']);
    await db.query(`update seances set fin = now() - interval '3 minutes', debut = now() - interval '2 hours' where id = $1`, [e.id]);
    expect((await en(ids.camille, 'select type from documents where seance_id = $1 order by type', [e.id])).map((r) => r.type)).toEqual(['correction', 'sujet', 'support']);
    expect((await en(ids.camille, `select name from storage.objects where name like 'p/%' order by name`)).length).toBe(2);
    await en(ids.prof, 'delete from seances where id = $1', [e.id]);
  });
});

describe('comptes', () => {
  it('un étudiant ne lit que son profil et pas la liste des inscrits', async () => {
    expect((await en(ids.camille, 'select email from profils')).map((r) => r.email)).toEqual(['camille@ex.fr']);
    expect(await en(ids.camille, 'select * from inscrits')).toEqual([]);
  });
  it('seul un admin crée un compte à la main, y compris un autre admin', async () => {
    const ajout = `insert into inscrits (email, prenom, nom, role) values ('nouvel.admin@ex.fr', 'N', 'A', 'admin')`;
    await expect(en(ids.prof, ajout)).rejects.toThrow(/row-level security/);
    await expect(en(ids.camille, ajout)).rejects.toThrow(/row-level security/);
    await en(ids.admin, ajout);
    const nouveau = await inscrire('nouvel.admin@ex.fr');
    expect((await db.query('select role from profils where id = $1', [nouveau])).rows[0].role).toBe('admin');
    await en(ids.admin, `update inscrits set role = 'enseignant' where email = 'nouvel.admin@ex.fr'`);
    expect((await db.query('select role from profils where id = $1', [nouveau])).rows[0].role).toBe('enseignant');
    await en(ids.admin, `delete from inscrits where email = 'nouvel.admin@ex.fr'`);
  });
  it('désactiver un inscrit coupe son accès', async () => {
    await en(ids.admin, `update inscrits set actif = false where email = 'leo@ex.fr'`);
    expect(await en(ids.leo, 'select titre from seances')).toEqual([]);
    await en(ids.admin, `update inscrits set actif = true where email = 'leo@ex.fr'`);
    expect((await en(ids.leo, 'select titre from seances')).length).toBe(3); // « Toute la D2 », « CCB groupe B », « CCB QCM B »
  });
  it('changer le groupe d’un inscrit change ce qu’il voit', async () => {
    await en(ids.admin, `update inscrits set groupe_id = $1 where email = 'leo@ex.fr'`, [ids.gA]);
    expect((await en(ids.leo, 'select titre from seances')).length).toBe(3); // « Toute la D2 », « D2 groupe A », « CCB QCM A »
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
