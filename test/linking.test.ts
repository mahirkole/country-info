import { describe, expect, it } from 'vitest';
import { normalizeName, planLinks } from '../src/linking.js';

const R = (id: string, cc: string, kind: string, ...names: string[]) => ({ id, country_code: cc, kind, names });

describe('normalizeName', () => {
  it('folds accents, case, punctuation and special letters', () => {
    expect(normalizeName('İstanbul')).toBe('istanbul');
    expect(normalizeName('Baden-Württemberg')).toBe('baden wurttemberg');
    expect(normalizeName('Łódzkie')).toBe('lodzkie');
    expect(normalizeName('Île-de-France')).toBe('ile de france');
    expect(normalizeName('Straße')).toBe('strasse');
    expect(normalizeName(null)).toBe('');
  });
});

describe('planLinks', () => {
  it('picks the best NUTS level per country and links one-to-one', () => {
    const plan = planLinks(
      [R('gn:1', 'DE', 'admin1', 'Bavaria', 'Bayern'), R('gn:2', 'DE', 'admin1', 'Baden-Württemberg'), R('gn:3', 'DE', 'admin1', 'Nowhere')],
      [R('nuts:DE2', 'DE', 'nuts1', 'Bayern'), R('nuts:DE1', 'DE', 'nuts1', 'Baden-Württemberg'), R('nuts:DE21', 'DE', 'nuts2', 'Oberbayern')],
    );
    expect(plan.levelByCountry['DE']).toBe('nuts1');
    expect(plan.links).toEqual([{ a: 'gn:1', b: 'nuts:DE2', method: 'name_exact' }, { a: 'gn:2', b: 'nuts:DE1', method: 'name_exact' }]);
    expect(plan.unmatched).toEqual(['gn:3']);
  });
  it('never guesses: duplicate names and double claims are ambiguous', () => {
    const plan = planLinks(
      [R('gn:1', 'XX', 'admin1', 'Alpha'), R('gn:2', 'XX', 'admin1', 'Beta'), R('gn:3', 'XX', 'admin1', 'beta')],
      [R('nuts:XX1', 'XX', 'nuts2', 'Alpha'), R('nuts:XX2', 'XX', 'nuts2', 'Alpha'), R('nuts:XX3', 'XX', 'nuts2', 'Beta')],
    );
    expect(plan.links).toEqual([]);
    expect(plan.ambiguous.map((a) => a.entity).sort()).toEqual(['gn:1', 'gn:2', 'gn:3']);
    expect(plan.ambiguous.find((a) => a.entity === 'gn:1')!.candidates).toEqual(['nuts:XX1', 'nuts:XX2']);
  });
  it('keeps countries independent', () => {
    const plan = planLinks([R('gn:1', 'TR', 'admin1', 'Istanbul'), R('gn:2', 'DE', 'admin1', 'Istanbul')], [R('nuts:TR1', 'TR', 'nuts1', 'İstanbul')]);
    expect(plan.links).toEqual([{ a: 'gn:1', b: 'nuts:TR1', method: 'name_exact' }]);
    expect(plan.unmatched).toEqual(['gn:2']);
  });
});

import { planDivisionLinks } from '../src/linking.js';
describe('planDivisionLinks (admin1 that is no NUTS level)', () => {
  const a = (id: string, name: string, cc = 'SI') => ({ id, country_code: cc, kind: 'admin1', names: [name] });
  const d = (id: string, name: string, kind = 'nat-si:1', cc = 'SI') => ({ id, country_code: cc, kind, names: [name] });
  it('matches through the generic English type word, unique 1:1 only, best level per country', () => {
    const links = planDivisionLinks(
      [a('gn:1', 'Municipality of Žalec'), a('gn:2', 'Bled Municipality'), a('gn:3', 'Kranj'), a('gn:4', 'Dup')],
      [d('div:SI:1', 'Žalec'), d('div:SI:2', 'Bled'), d('div:SI:3', 'Kranj'), d('div:SI:4', 'Dup'), d('div:SI:5', 'Dup'), d('div:SI:99', 'Žalec', 'nat-si:2')],
    );
    expect(links).toEqual(expect.arrayContaining([
      { a: 'gn:1', b: 'div:SI:1', method: 'name_exact_div' },
      { a: 'gn:2', b: 'div:SI:2', method: 'name_exact_div' },
      { a: 'gn:3', b: 'div:SI:3', method: 'name_exact_div' },
    ]));
    expect(links.find((l) => l.a === 'gn:4')).toBeUndefined(); // two candidates: ambiguous
    expect(links.some((l) => l.b === 'div:SI:99')).toBe(false); // lower-scoring level is not used
  });
});
