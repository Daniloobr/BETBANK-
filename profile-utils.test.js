import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProfileDraft } from './profile-utils.js';

const draft = (overrides = {}) => ({
  name: 'Danilo', adult: 'yes', initialBankroll: '100.29', reserve: '10.10',
  dailyLimit: '0', weeklyLimit: '0', monthlyLimit: '0', maxStake: '5.29',
  ...overrides
});

test('perfil inicial valida e preserva valores monetários legítimos com centavos', () => {
  const result = validateProfileDraft(draft());
  assert.equal(result.valid, true);
  assert.equal(result.profile.initialBankroll, 100.29);
  assert.equal(result.profile.maxStake, 5.29);
  assert.equal(result.profile.adult, true);
});

test('perfil rejeita valores negativos, não numéricos, infinitos e mais de duas casas', () => {
  for (const value of ['-1', 'abc', 'Infinity', '1.234']) {
    const result = validateProfileDraft(draft({ reserve: value }));
    assert.equal(result.valid, false, `deveria rejeitar ${value}`);
    assert.match(result.errors.reserve, /valor não negativo/);
  }
});

test('perfil aceita zero e confirmação explícita de não maioridade sem ativar apostas', () => {
  const result = validateProfileDraft(draft({ adult: 'no', initialBankroll: '0', maxStake: '' }));
  assert.equal(result.valid, true);
  assert.equal(result.profile.adult, false);
  assert.equal(result.profile.initialBankroll, 0);
  assert.equal(result.profile.maxStake, 0);
});

test('perfil requer nome e opção de maioridade reconhecida', () => {
  const result = validateProfileDraft(draft({ name: '  ', adult: 'unknown' }));
  assert.equal(result.valid, false);
  assert.ok(result.errors.name);
  assert.ok(result.errors.adult);
});
