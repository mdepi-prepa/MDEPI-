import { describe, it, expect } from 'vitest';
import { html, urlSure } from '../src/lib/html.js';
import { lireCsvInscrits } from '../src/lib/csv.js';
import { genererIcs } from '../src/lib/ics.js';
import { peutVoirSeance, peutVoirAnnonce } from '../src/lib/acces.js';
import {
  heure, plageHoraire, dateLongue, compteARebours, zoomActif, grouperParMois, duree, versChampsDate, depuisChampsDate,
} from '../src/lib/dates.js';

describe('gabarits HTML', () => {
  it('échappe les valeurs insérées', () => {
    expect(String(html`<p>${'<img src=x onerror=alert(1)>'}</p>`)).toBe('<p>&lt;img src=x onerror=alert(1)&gt;</p>');
  });
  it('garde les gabarits imbriqués et ignore null/false', () => {
    expect(String(html`<ul>${['a', 'b'].map((x) => html`<li>${x}</li>`)}${null}${false}</ul>`)).toBe('<ul><li>a</li><li>b</li></ul>');
  });
  it('refuse les liens javascript:', () => {
    expect(urlSure('javascript:alert(1)')).toBe('');
    expect(urlSure('https://zoom.us/j/1')).toBe('https://zoom.us/j/1');
    expect(urlSure('pas une url')).toBe('');
  });
});

describe('dates (heure de Paris)', () => {
  // 1er décembre 2026, 18h30 à Paris = 17h30 UTC (heure d'hiver)
  const debut = '2026-12-01T17:30:00Z';
  const fin = '2026-12-01T20:30:00Z';
  it('formate heures et dates', () => {
    expect(heure(debut)).toBe('18h30');
    expect(heure('2026-12-05T08:00:00Z')).toBe('9h');
    // Entre minuit et 1 h : « 0h25 », pas « h25 ».
    expect(heure('2026-12-04T23:25:00Z')).toBe('0h25');
    expect(heure('2026-12-04T23:00:00Z')).toBe('0h');
    expect(plageHoraire(debut, fin)).toBe('18h30 – 21h30');
    expect(dateLongue(debut)).toBe('Mardi 1 décembre');
  });
  it('compte à rebours en jours calendaires', () => {
    expect(compteARebours(debut, fin, new Date('2026-11-27T12:00:00Z'))).toBe('Dans 4 jours');
    expect(compteARebours(debut, fin, new Date('2026-11-30T22:30:00Z'))).toBe('Demain'); // 23h30 à Paris le 30
    expect(compteARebours(debut, fin, new Date('2026-12-01T08:00:00Z'))).toBe("Aujourd'hui");
    expect(compteARebours(debut, fin, new Date('2026-12-01T18:00:00Z'))).toBe('En cours');
    expect(compteARebours(debut, fin, new Date('2026-12-01T21:00:00Z'))).toBe('Terminée');
  });
  it('lien Zoom actif 15 min avant le début et jusqu’à la fin', () => {
    expect(zoomActif(debut, fin, new Date('2026-12-01T17:14:00Z'))).toBe(false);
    expect(zoomActif(debut, fin, new Date('2026-12-01T17:15:00Z'))).toBe(true);
    expect(zoomActif(debut, fin, new Date('2026-12-01T20:30:00Z'))).toBe(false);
  });
  it('regroupe par mois', () => {
    const g = grouperParMois([{ debut }, { debut: '2026-12-20T10:00:00Z' }, { debut: '2027-01-03T10:00:00Z' }]);
    expect(g.map((x) => [x.mois, x.elements.length])).toEqual([['DÉCEMBRE 2026', 2], ['JANVIER 2027', 1]]);
  });
  it('durée', () => {
    expect(duree(172)).toBe('2 h 52');
    expect(duree(180)).toBe('3 h');
    expect(duree(45)).toBe('45 min');
  });
  it('champs de formulaire ↔ date, en hiver comme en été', () => {
    expect(versChampsDate(debut)).toEqual({ date: '2026-12-01', heure: '18:30' });
    expect(depuisChampsDate('2026-12-01', '18:30').getTime()).toBe(Date.parse(debut));
    expect(depuisChampsDate('2027-06-15', '09:00').toISOString()).toBe('2027-06-15T07:00:00.000Z');
    expect(depuisChampsDate('2027-03-28', '10:00').toISOString()).toBe('2027-03-28T08:00:00.000Z'); // jour du passage à l'heure d'été
  });
});

describe('import CSV des inscrits', () => {
  it('lit un CSV Excel (point-virgule, accents, BOM)', () => {
    const r = lireCsvInscrits('﻿E-mail;Prénom;Nom;Promo;Groupe\nCamille.Martin@Ex.fr;Camille;Martin;d2;Groupe A\n');
    expect(r.erreurs).toEqual([]);
    expect(r.lignes).toEqual([{ email: 'camille.martin@ex.fr', prenom: 'Camille', nom: 'Martin', promo: 'D2', groupe: 'Groupe A', role: 'etudiant' }]);
  });
  it('lit un CSV Google Sheets (virgule, guillemets)', () => {
    const r = lireCsvInscrits('email,prenom,nom,promo,role\n"a@ex.fr","Anne-Sophie","Dupont, épouse X",D1,\nb@ex.fr,Bob,B,,Enseignant');
    expect(r.erreurs).toEqual([]);
    expect(r.lignes[0].nom).toBe('Dupont, épouse X');
    expect(r.lignes[1]).toMatchObject({ role: 'enseignant', promo: null });
  });
  it('accepte « conférencier » comme rôle enseignant', () => {
    const r = lireCsvInscrits('email;prenom;nom;promo;role\nc@ex.fr;Claire;C;;Conférencier');
    expect(r.erreurs).toEqual([]);
    expect(r.lignes[0]).toMatchObject({ role: 'enseignant', promo: null });
  });
  it('signale les lignes invalides sans bloquer les autres', () => {
    const r = lireCsvInscrits('email;promo\npas-un-mail;D1\nx@ex.fr;D7\ny@ex.fr;\nz@ex.fr;D3\nz@ex.fr;D3');
    expect(r.lignes.map((l) => l.email)).toEqual(['z@ex.fr']);
    expect(r.erreurs).toHaveLength(4);
  });
  it('exige une colonne email', () => {
    expect(lireCsvInscrits('nom;promo\nx;D1').erreurs[0]).toMatch(/email/);
  });
});

describe('fichier agenda .ics', () => {
  it('contient la séance avec heures UTC et texte échappé', () => {
    const ics = genererIcs(
      { id: 'abc', titre: 'Cardio; SCA, partie 1', matiere: 'Cardiologie', debut: '2026-12-01T17:30:00Z', fin: '2026-12-01T20:30:00Z', lieu: '94 rue Sainte-Cécile', zoom_url: 'https://zoom.us/j/1' },
      new Date('2026-11-27T12:00:00Z')
    );
    expect(ics).toContain('DTSTART:20261201T173000Z');
    expect(ics).toContain('DTEND:20261201T203000Z');
    expect(ics).toContain('SUMMARY:Cardio\\; SCA\\, partie 1');
    expect(ics).toContain('UID:abc@mdepi');
    expect(ics.split('\r\n').length).toBeGreaterThan(10);
  });
});

describe('règles de visibilité (mode démo, identiques au SQL)', () => {
  const s = { promos: ['D2'], groupes: ['A'] };
  it('promo et groupe', () => {
    expect(peutVoirSeance({ role: 'etudiant', promo: 'D2', groupe_id: 'A' }, s)).toBe(true);
    expect(peutVoirSeance({ role: 'etudiant', promo: 'D2', groupe_id: 'B' }, s)).toBe(false);
    expect(peutVoirSeance({ role: 'etudiant', promo: 'D3', groupe_id: 'A' }, s)).toBe(false);
    expect(peutVoirSeance({ role: 'etudiant', promo: 'D2', groupe_id: null }, { promos: ['D2'], groupes: [] })).toBe(true);
    expect(peutVoirSeance({ role: 'enseignant' }, s)).toBe(true);
    expect(peutVoirSeance({ role: 'etudiant', promo: 'D2', groupe_id: 'A', actif: false }, s)).toBe(false);
  });
  it('annonces par promo', () => {
    expect(peutVoirAnnonce({ role: 'etudiant', promo: 'D1' }, { promos: ['D2'] })).toBe(false);
    expect(peutVoirAnnonce({ role: 'admin' }, { promos: ['D2'] })).toBe(true);
  });
});
