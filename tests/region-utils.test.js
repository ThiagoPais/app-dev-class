import { expect, test } from 'bun:test';

import { toTickUnits } from '../src/domains/region/utils/piecewise-scale.ts';
import { matchesSearch, slugify } from '../src/domains/region/utils/slugify.ts';

const ticks = [0, 10, 25, 50, 100, 150];

test('toTickUnits places values between uneven ticks', () => {
  expect(toTickUnits(0, ticks)).toBe(0);
  expect(toTickUnits(10, ticks)).toBe(1);
  expect(toTickUnits(17.5, ticks)).toBe(1.5);
  expect(toTickUnits(150, ticks)).toBe(5);
});

test('toTickUnits extends the last segment past the top tick', () => {
  expect(toTickUnits(200, ticks)).toBe(6);
});

test('slugify strips accents and separators', () => {
  expect(slugify('São Sebastião')).toBe('sao-sebastiao');
  expect(slugify('SCIA/Estrutural')).toBe('scia-estrutural');
  expect(slugify('Sol Nascente/Pôr do Sol')).toBe('sol-nascente-por-do-sol');
});

test('matchesSearch ignores case and accents', () => {
  expect(matchesSearch('Águas Claras', 'aguas')).toBe(true);
  expect(matchesSearch('Asa Norte', 'ASA N')).toBe(true);
  expect(matchesSearch('Gama', 'guará')).toBe(false);
  expect(matchesSearch('Gama', '  ')).toBe(true);
});
