import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyBetImports, escapeHtml, mergeBackup, parseBetCsv, prepareCsvImport,
  safeImportedId, validateBackup, validateBetRecord
} from './data-import.js';

const uuid = suffix => `00000000-0000-4000-8000-${String(suffix).padStart(12, '0')}`;
let sequence = 1;
const nextId = () => uuid(sequence++);
const record = overrides => ({
  placedAt: '2026-10-24T12:30', category: 'Futebol', event: 'Time A x Time B',
  platform: '', type: 'Simples', stake: 10, odds: 2, status: 'won', returnAmount: 20,
  emotion: '', notes: '', ...overrides
});
const header = 'data;modalidade;evento;valor;status;retorno';

test('stake negativa, zero e positiva recebem validação correta', () => {
  for (const stake of [-1, 0]) {
    assert.deepEqual(validateBetRecord(record({ stake })).errors, ['stake deve ser maior que zero']);
  }
  assert.equal(validateBetRecord(record({ stake: 10 })).valid, true);
});

test('retorno inválido é rejeitado e retorno válido é normalizado', () => {
  assert.match(validateBetRecord(record({ returnAmount: -1 })).errors.join(), /retorno não pode ser negativo/);
  assert.match(validateBetRecord(record({ returnAmount: 'NaN' })).errors.join(), /retorno deve ser um valor numérico válido/);
  assert.equal(validateBetRecord(record({ returnAmount: 'R$ 20,00' })).bet.returnAmount, 20);
  assert.match(validateBetRecord(record({ status: 'pending', returnAmount: 1 })).errors.join(), /retorno zero/);
  assert.match(validateBetRecord(record({ status: 'won', returnAmount: 10 })).errors.join(), /maior que a stake/);
  assert.match(validateBetRecord(record({ status: 'partial', returnAmount: 0 })).errors.join(), /retorno positivo/);
});

test('datas inválidas e datas não existentes no calendário são rejeitadas', () => {
  assert.match(validateBetRecord(record({ placedAt: 'ontem' })).errors.join(), /data inválida/);
  assert.match(validateBetRecord(record({ placedAt: '2026-02-30T12:00' })).errors.join(), /data inválida/);
});

test('CSV importa valor positivo e aponta linhas com stake negativa ou zero', () => {
  const result = parseBetCsv(`${header}\n2026-10-24;Futebol;A;10,00;Vitória;20,00\n2026-10-24;Futebol;B;-1;Vitória;2\n2026-10-24;Futebol;C;0;Vitória;0`);
  assert.equal(result.valid.length, 1);
  assert.equal(result.valid[0].bet.stake, 10);
  assert.deepEqual(result.invalid.map(row => row.line), [3, 4]);
  assert.match(result.invalid[0].reason, /maior que zero/);
});

test('CSV indica linha e motivo para retorno, data, número e status incompatíveis', () => {
  const result = parseBetCsv(`${header}\n2026-10-24;Futebol;A;10;Derrota;1\n2026-02-30;Futebol;B;10;Vitória;20\n2026-10-24;Futebol;C;10;Vitória;Infinity\n2026-10-24;Futebol;D;10;Anulada;9`);
  assert.equal(result.valid.length, 0);
  assert.deepEqual(result.invalid.map(row => row.line), [2, 3, 4, 5]);
  assert.match(result.invalid[0].reason, /derrota deve ter retorno zero/);
  assert.match(result.invalid[1].reason, /data inválida/);
  assert.match(result.invalid[2].reason, /retorno deve ser um valor numérico válido/);
  assert.match(result.invalid[3].reason, /valor integral devolvido/);
});

test('CSV com qualquer linha inválida não gera conjunto parcial para confirmação', () => {
  const state = { bets: [record()], transactions: [], goals: [] };
  const before = structuredClone(state);
  const prepared = prepareCsvImport(`${header}\n2026-10-24;Futebol;Válida;10;Vitória;20\n2026-02-30;Futebol;Inválida;10;Vitória;20`, state.bets);
  assert.equal(prepared.valid, false);
  assert.equal(prepared.groups.newRecords.length, 1);
  assert.equal(prepared.invalid.length, 1);
  assert.deepEqual(state, before);
});

test('duas linhas CSV idênticas são classificadas como um novo e uma duplicata', () => {
  const parsed = parseBetCsv(`${header}\n2026-10-24;Futebol;A x B;10;Vitória;20\n2026-10-24;Futebol;A x B;10;Vitória;20`);
  const groups = classifyBetImports(parsed.valid, []);
  assert.equal(groups.newRecords.length, 1);
  assert.equal(groups.duplicates.length, 1);
  assert.equal(groups.duplicates[0].line, 3);
});

test('CSV parcialmente semelhante exige confirmação e não elimina registro legítimo', () => {
  const parsed = parseBetCsv(`${header}\n2026-10-24;Futebol;A x B;10;Vitória;20\n2026-10-24;Futebol;A x B;10;Vitória;19`);
  const groups = classifyBetImports(parsed.valid, []);
  assert.equal(groups.newRecords.length, 1);
  assert.equal(groups.similar.length, 1);
  assert.equal(groups.duplicates.length, 0);
});

test('duplicata exata de registro existente é separada da nova aposta', () => {
  const parsed = parseBetCsv(`${header}\n2026-10-24;Futebol;A x B;10;Vitória;20\n2026-10-24;Futebol;Outro;12;Vitória;24`);
  const groups = classifyBetImports(parsed.valid, [parsed.valid[0].bet]);
  assert.equal(groups.duplicates.length, 1);
  assert.equal(groups.newRecords.length, 1);
});

test('backup legado válido é importável e IDs inválidos são substituídos por UUID interno', () => {
  const backup = {
    profile: { name: 'Danilo', initialBankroll: 100, reserve: 0 },
    bets: [record({ id: 'id"><img src=x>', event: 'Jogo "A" & <B>' })],
    transactions: [{ id: 'bad id', type: 'deposit', amount: 5, date: '2026-10-24' }],
    goals: [{ id: 'bad', type: 'count', name: 'Meta "<segura>"', target: 5, start: '2026-10-24', end: '2026-11-24' }]
  };
  const result = validateBackup(backup, nextId);
  assert.equal(result.valid, true);
  for (const row of [...result.backup.bets, ...result.backup.transactions, ...result.backup.goals]) {
    assert.match(row.id, /^[0-9a-f-]{36}$/i);
    assert.doesNotMatch(row.id, /[<>"']/);
  }
  assert.equal(result.backup.bets[0].event, 'Jogo "A" & <B>');
});

test('aspas e marcação em texto ficam escapadas e não formam atributos HTML', () => {
  const text = `" autofocus onfocus="alert(1) <img src=x onerror='alert(2)'> &`;
  const escaped = escapeHtml(text);
  assert.equal(escaped, '&quot; autofocus onfocus=&quot;alert(1) &lt;img src=x onerror=&#39;alert(2)&#39;&gt; &amp;');
  assert.doesNotMatch(escaped, /<\s*(?:img|svg|script)\b/i);
  assert.doesNotMatch(escaped, /<[^>]*\b(?:onfocus|onerror)\s*=/i);
});

test('backup inválido não modifica o estado antes de uma mesclagem válida', () => {
  const current = { profile: null, bets: [record()], transactions: [], goals: [], pausedUntil: null };
  const before = structuredClone(current);
  const invalid = validateBackup({ bets: [{ ...record(), stake: -5 }], transactions: [], goals: [] }, nextId);
  assert.equal(invalid.valid, false);
  assert.deepEqual(current, before);
  const valid = validateBackup({ bets: [record()], transactions: [], goals: [] }, nextId);
  const merged = mergeBackup(current, valid.backup, nextId);
  assert.equal(current.bets.length, 1);
  assert.equal(merged.bets.length, 2);
});

test('backup com ID UUID existente permanece compatível com dados exportados anteriormente', () => {
  const backup = { bets: [record({ id: uuid(99) })], transactions: [], goals: [] };
  const result = validateBackup(backup, nextId);
  assert.equal(result.valid, true);
  assert.equal(result.backup.bets[0].id, uuid(99));
  assert.equal(safeImportedId(uuid(99), nextId), uuid(99));
});
