import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const financialCode = html.match(/function settled\(b\).*?(?=\nfunction limitAlerts)/s)?.[0];
assert.ok(financialCode, 'As funções financeiras inline devem continuar localizáveis para auditoria.');

function evaluate(bets, transactions = [], initialBankroll = 0) {
  const context = { db: { bets, transactions, profile: { initialBankroll } }, Date };
  vm.runInNewContext(`${financialCode}\nthis.api = { cashStats, net, eligible };`, context);
  return context.api.cashStats();
}

test('vitória, derrota e pendente: resultado, banca, ROI e saldo disponível', () => {
  const stats = evaluate([
    { status: 'won', stake: 10, returnAmount: 18 },
    { status: 'lost', stake: 5, returnAmount: 0 },
    { status: 'pending', stake: 20, returnAmount: 0 }
  ], [{ type: 'deposit', amount: 50 }, { type: 'withdrawal', amount: 12 }], 1000);

  assert.equal(stats.profit, 3);
  assert.equal(stats.roi, 20);
  assert.equal(stats.hit, 50);
  assert.equal(stats.bank, 1041);
  assert.equal(stats.committed, 20);
  assert.equal(stats.available, 1021);
});

test('aposta anulada com devolução integral não altera resultado ou banca', () => {
  const stats = evaluate([{ status: 'void', stake: 25, returnAmount: 25 }], [], 200);
  assert.equal(stats.profit, 0);
  assert.equal(stats.bank, 200);
  assert.equal(stats.hit, 0);
});

test('liquidação parcial usa o retorno total registrado uma única vez', () => {
  const stats = evaluate([{ status: 'partial', stake: 10, returnAmount: 6 }], [], 100);
  assert.equal(stats.profit, -4);
  assert.equal(stats.bank, 96);
  assert.equal(stats.roi, -40);
  assert.equal(stats.hit, 0);
});

test('sem registros liquidados, métricas percentuais não dividem por zero', () => {
  const stats = evaluate([{ status: 'pending', stake: 5, returnAmount: 0 }]);
  assert.equal(stats.roi, 0);
  assert.equal(stats.hit, 0);
  assert.equal(stats.profit, 0);
});

test('stake de centavos mantém os valores conhecidos dentro de um centavo', () => {
  const stats = evaluate([
    { status: 'won', stake: 0.1, returnAmount: 0.3 },
    { status: 'lost', stake: 0.2, returnAmount: 0 }
  ]);
  assert.ok(Math.abs(stats.profit) < 1e-9);
  assert.ok(Math.abs(stats.roi) < 1e-9);
});
