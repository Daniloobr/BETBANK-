import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { hasUserData, readUserData, writeUserData } from './cloud-store.js';

test('detecta dados locais que precisam de migração explícita', () => {
  assert.equal(hasUserData({ profile: null, bets: [], transactions: [], goals: [] }), false);
  assert.equal(hasUserData({ profile: { name: 'Ana' }, bets: [] }), true);
  assert.equal(hasUserData({ bets: [{ id: 'a' }] }), true);
});

test('consulta estado pelo UID sob as políticas RLS do Supabase', async () => {
  const calls = [];
  const client = { from(table) { calls.push(['from', table]); return {
    select(columns) { calls.push(['select', columns]); return this; },
    eq(column, value) { calls.push(['eq', column, value]); return this; },
    async maybeSingle() { return { data: { payload: { bets: [] } }, error: null }; }
  }; } };
  assert.deepEqual(await readUserData(client, 'user-a'), { bets: [] });
  assert.deepEqual(calls, [['from', 'betbank_user_data'], ['select', 'payload'], ['eq', 'user_id', 'user-a']]);
});

test('envia somente a linha pertencente ao UID autenticado e propaga falhas', async () => {
  let saved;
  const client = { from(table) { assert.equal(table, 'betbank_user_data'); return {
    async upsert(row, options) { saved = { row, options }; return { error: null }; }
  }; } };
  const payload = { profile: { name: 'Teste' }, bets: [] };
  await writeUserData(client, 'user-a', payload);
  assert.deepEqual(saved, { row: { user_id: 'user-a', payload }, options: { onConflict: 'user_id' } });
  const failing = { from() { return {
    select() { return this; }, eq() { return this; },
    async maybeSingle() { return { data: null, error: new Error('RLS denied') }; },
    async upsert() { return { error: new Error('RLS denied') }; }
  }; } };
  await assert.rejects(writeUserData(failing, 'user-a', payload), /RLS denied/);
  await assert.rejects(readUserData(failing, 'user-a'), /RLS denied/);
});

test('não permite chamadas sem UID autenticado', async () => {
  await assert.rejects(readUserData({}, ''), /Autenticação necessária/);
  await assert.rejects(writeUserData({}, null, {}), /Autenticação necessária/);
});

test('migration define RLS e políticas CRUD vinculadas a auth.uid()', () => {
  const sql = readFileSync(fileURLToPath(new URL('./supabase/migrations/202610240001_betbank_user_data.sql', import.meta.url)), 'utf8');
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /force row level security/i);
  for (const operation of ['select', 'insert', 'update', 'delete']) assert.match(sql, new RegExp(`for ${operation}`, 'i'));
  assert.equal((sql.match(/auth\.uid\(\)/g) || []).length >= 4, true);
});
