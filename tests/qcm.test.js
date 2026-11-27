// @vitest-environment jsdom
// Import QTI sur le vrai export Théia (DP « CONF HGE D3 DP4 », 6 questions) et barème.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parsePackage, versDossiers, assainir } from '../src/lib/qti.js';
import { points, verdict, noteSur20, discordances } from '../src/lib/bareme.js';

const dossierFixture = join(__dirname, 'fixtures/theia-dp-hge');
const fichiers = Object.fromEntries(readdirSync(dossierFixture).map((n) => [n, readFileSync(join(dossierFixture, n), 'utf8')]));

describe('import du vrai export Théia', async () => {
  const res = await parsePackage(fichiers);
  const dossiers = versDossiers(res.questions);

  it('reconnaît un dossier progressif de 6 questions, dans l’ordre du pool', () => {
    expect(dossiers).toHaveLength(1);
    expect(dossiers[0].titre).toBe('CONF HGE D3 DP4 (2026-2027)');
    expect(dossiers[0].promo).toBe('D3');
    expect(dossiers[0].questions.map((q) => q.qti_id)).toEqual([
      'MULTIPLECHOICE_QUESTION_4302637',
      'MULTIPLECHOICE_QUESTION_4302645',
      'MULTIPLECHOICE_QUESTION_4302649',
      'MULTIPLECHOICE_QUESTION_4302653',
      'MULTIPLECHOICE_QUESTION_4302655',
      'MULTIPLECHOICE_QUESTION_4302666',
    ]);
    expect(res.msgs[0].m).toMatch(/6 questions importables sur 6/);
  });

  it('chaque question a ses propositions, au moins une bonne réponse et un énoncé sans HTML échappé', () => {
    for (const q of dossiers[0].questions) {
      expect(['QRU', 'QRM']).toContain(q.type);
      expect(q.propositions.length).toBeGreaterThanOrEqual(4);
      expect(q.correction.bonnes.length).toBeGreaterThanOrEqual(1);
      expect(q.enonce).not.toMatch(/&lt;|font-family|style=/);
      for (const p of q.propositions) expect(p.texte).not.toMatch(/^\s*(<[^>]+>\s*)*[A-J][.)]\s/); // lettre « A. » retirée
    }
    // QRM Théia avec une seule bonne réponse → QRU
    const q1 = dossiers[0].questions[0];
    expect(q1.correction.bonnes).toEqual(['CHOICE_9017981']);
    expect(q1.type).toBe('QRU');
  });

  it('les bonnes réponses ne sont pas dans les propositions envoyées aux étudiants', () => {
    for (const q of dossiers[0].questions) for (const p of q.propositions) expect(Object.keys(p).sort()).toEqual(['id', 'texte']);
  });

  it('garde la correction rédigée', () => {
    expect(dossiers[0].questions.some((q) => q.correction.commentaire || Object.keys(q.correction.explications).length)).toBe(true);
  });

  it('assainir retire scripts et attributs dangereux', () => {
    const h = assainir('<p onclick="x()">ok<script>alert(1)</script><img src="qcm-img:a/b.png" onerror="x()"></p>');
    expect(h).not.toMatch(/script|onclick|onerror/);
    expect(h).toContain('src="qcm-img:a/b.png"');
    expect(assainir('<span class="c-ok">Vrai</span><span class="x" onclick="y">z</span>')).toBe('<span class="c-ok">Vrai</span><span>z</span>');
  });
});

describe('barème EDN', () => {
  const props = ['A', 'B', 'C', 'D', 'E'].map((id) => ({ id }));
  const qrm = { type: 'QRM', propositions: props };
  const corr = { bonnes: ['A', 'B', 'D', 'E'] };
  it('QRM : 0, 1, 2, 3 discordances', () => {
    expect(points(qrm, corr, { choix: ['A', 'B', 'D', 'E'] })).toBe(1);
    expect(points(qrm, corr, { choix: ['A', 'B', 'D'] })).toBe(0.5);
    expect(points(qrm, corr, { choix: ['A', 'B', 'C', 'D'] })).toBe(0.2);
    expect(points(qrm, corr, { choix: ['A', 'C'] })).toBe(0);
    expect(points(qrm, corr, null)).toBe(0);
    expect(discordances(props, corr.bonnes, ['C'])).toBe(5);
  });
  it('QRU', () => {
    const qru = { type: 'QRU', propositions: props };
    expect(points(qru, { bonnes: ['C'] }, { choix: ['C'] })).toBe(1);
    expect(points(qru, { bonnes: ['C'] }, { choix: ['C', 'D'] })).toBe(0);
  });
  it('QROC : majuscules, accents et espaces ignorés', () => {
    const q = { type: 'QROC', propositions: [] };
    const c = { reponses_qroc: ['ECG', 'électrocardiogramme'] };
    expect(points(q, c, { texte: '  Electrocardiogramme ' })).toBe(1);
    expect(points(q, c, { texte: 'ecg' })).toBe(1);
    expect(points(q, c, { texte: 'radio' })).toBe(0);
    expect(points(q, c, { texte: '' })).toBe(0);
  });
  it('verdicts et note sur 20', () => {
    expect(verdict({ id: 'A' }, corr, { choix: ['A'] })).toBe('juste');
    expect(verdict({ id: 'C' }, corr, { choix: ['C'] })).toBe('fausse');
    expect(verdict({ id: 'B' }, corr, { choix: [] })).toBe('oubliee');
    expect(noteSur20(4.7, 6)).toBe(15.67);
  });
});

describe('outils QCM (exports, note)', async () => {
  const { aPlat, noterCopie, csvCopies, csvResultats } = await import('../src/lib/qcm.js');
  const qcm = [{ titre: 'DP1', questions: [
    { id: 'q1', type: 'QRM', enonce: '<p>Q1</p>', propositions: ['A', 'B', 'C'].map((id) => ({ id, texte: id })) },
    { id: 'q2', type: 'QROC', enonce: 'Q2', propositions: [] },
  ] }];
  const corr = { q1: { bonnes: ['A', 'B'] }, q2: { reponses_qroc: ['ECG'] } };
  const reps = { q1: { question_id: 'q1', choix: ['A'], validee: true }, q2: { question_id: 'q2', texte: 'ecg', validee: false } };
  it('numérote et note une copie', () => {
    expect(aPlat(qcm).map((q) => [q.num, q.qi])).toEqual([[1, 0], [2, 1]]);
    expect(noterCopie(aPlat(qcm), corr, reps)).toEqual({ points: 1.5, total: 2, note20: 15 });
  });
  it('exporte les cases cochées en lettres', () => {
    const r = [{ user_id: 'u', seance_id: 's', nom: 'Martin', prenom: 'Camille', email: 'c@ex.fr', groupe: 'A', rang: 1, points: 1.5, total: 2, note20: 15 }];
    const csv = csvCopies(qcm, corr, r, [{ user_id: 'u', seance_id: 's', reponses: Object.values(reps) }]).split('\r\n');
    expect(csv[1]).toBe('Martin;Camille;c@ex.fr;A;DP1;Q1;QRM;A;;oui;A, B;0,5;');
    expect(csv[2]).toBe('Martin;Camille;c@ex.fr;A;DP1;Q2;QROC;;ecg;non;ECG;1;');
    expect(csvResultats(r).split('\r\n')[1]).toBe('1;Martin;Camille;c@ex.fr;A;;;1,5;2;15');
  });
});

describe('correction automatique des QROC', async () => {
  const { corrigerQroc } = await import('../src/lib/qroc.js');
  const cas = JSON.parse(readFileSync(join(__dirname, 'qroc-cas.json'), 'utf8'));
  it.each(cas)('« $texte » → $mode', ({ texte, acceptees, refusees, juste, mode }) => {
    const r = corrigerQroc(texte, acceptees, refusees);
    expect([r.juste, r.mode]).toEqual([juste, mode]);
  });
});

describe('exports CSV', () => {
  it('neutralise les formules Excel saisies par un étudiant', async () => {
    const { versCsv } = await import('../src/lib/qcm.js');
    const csv = versCsv([['=HYPERLINK("http://x")', '+1', '@SUM(A1)', 'Scanner', '12,5']]);
    expect(csv.slice(1)).toBe(`"'=HYPERLINK(""http://x"")";'+1;'@SUM(A1);Scanner;12,5`);
  });
});
