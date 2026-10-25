import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { BET_CATEGORIES, BET_PLATFORMS, BET_TYPES, optionsWithCurrent } from './bet-options.js';

const source = readFileSync(fileURLToPath(new URL('./index.html', import.meta.url)), 'utf8');

test('modalidade oferece esportes, slots e Aviator, sem impedir texto livre', () => {
  assert.ok(BET_CATEGORIES.includes('Futebol'));
  assert.ok(BET_CATEGORIES.includes('Slots'));
  assert.ok(BET_CATEGORIES.includes('Aviator / Crash'));
  assert.match(source, /name="category" list="betCategoryOptions"/);
  assert.match(source, /<datalist id="betCategoryOptions"/);
});

test('tipo e plataforma têm sugestões rápidas e preservam valores antigos', () => {
  assert.deepEqual(BET_TYPES, ['Simples', 'Múltipla', 'Sistema', 'Ao vivo', 'Pré-jogo', 'Outra']);
  assert.ok(!BET_TYPES.includes('Slot'));
  assert.ok(!BET_TYPES.includes('Crash (Aviator)'));
  assert.ok(optionsWithCurrent(BET_TYPES, 'Slot').includes('Slot'));
  assert.ok(optionsWithCurrent(BET_TYPES, 'Crash (Aviator)').includes('Crash (Aviator)'));
  assert.deepEqual(BET_PLATFORMS, ['ZZ3', '63C', 'PG765', 'Q82', 'PG668']);
  assert.deepEqual(optionsWithCurrent(BET_PLATFORMS, 'Plataforma antiga'), [...BET_PLATFORMS, 'Plataforma antiga']);
  assert.deepEqual(optionsWithCurrent(BET_TYPES, 'Tipo antigo'), [...BET_TYPES, 'Tipo antigo']);
  assert.match(source, /optionsWithCurrent\(BET_TYPES,b\.type\)/);
  assert.match(source, /name="platform" list="betPlatformOptions"/);
});

test('modalidade descreve o esporte ou jogo e tipo descreve formato ou momento', () => {
  assert.match(source, /Modalidade \(esporte ou jogo\)/);
  assert.match(source, /Categoria geral — por exemplo, futebol, slots ou Aviator/);
  assert.match(source, /Tipo de aposta/);
  assert.match(source, /Formato ou momento — simples, múltipla, sistema, ao vivo ou pré-jogo/);
});
