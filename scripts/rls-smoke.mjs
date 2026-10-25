import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

if (process.env.BETBANK_TEST_ENV !== 'staging') {
  throw new Error('Recusado: defina BETBANK_TEST_ENV=staging e use duas contas descartáveis, nunca dados reais.');
}

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const required = ['BETBANK_RLS_TEST_USER_A_EMAIL', 'BETBANK_RLS_TEST_USER_A_PASSWORD', 'BETBANK_RLS_TEST_USER_B_EMAIL', 'BETBANK_RLS_TEST_USER_B_PASSWORD'];
if (!url || !key || required.some(name => !process.env[name])) {
  throw new Error('Configure URL/chave pública e credenciais de duas contas descartáveis de staging no ambiente do processo.');
}

const makeClient = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const a = makeClient(), b = makeClient();
const [loginA, loginB] = await Promise.all([
  a.auth.signInWithPassword({ email: process.env.BETBANK_RLS_TEST_USER_A_EMAIL, password: process.env.BETBANK_RLS_TEST_USER_A_PASSWORD }),
  b.auth.signInWithPassword({ email: process.env.BETBANK_RLS_TEST_USER_B_EMAIL, password: process.env.BETBANK_RLS_TEST_USER_B_PASSWORD })
]);
if (loginA.error || loginB.error) throw new Error('Login de uma ou ambas as contas de staging falhou.');

const userA = loginA.data.user.id, userB = loginB.data.user.id;
assert.notEqual(userA, userB, 'As contas A e B precisam ser usuários independentes.');
const marker = `rls-smoke-${randomUUID()}`;
const rowA = { user_id: userA, payload: { profile: { name: marker }, bets: [], transactions: [], goals: [] } };
try {
  const inserted = await a.from('betbank_user_data').upsert(rowA, { onConflict: 'user_id' });
  assert.equal(inserted.error, null, 'A deve criar/atualizar sua própria linha.');
  const visibleToB = await b.from('betbank_user_data').select('user_id,payload').eq('user_id', userA);
  assert.equal(visibleToB.error, null);
  assert.equal(visibleToB.data.length, 0, 'B não pode ler a linha de A.');
  const insertAsB = await b.from('betbank_user_data').insert({ ...rowA, payload: { bets: [], transactions: [], goals: [] } });
  assert.ok(insertAsB.error, 'B não pode criar linha pertencente a A.');
  const updateAsB = await b.from('betbank_user_data').update({ payload: { bets: [], transactions: [], goals: [], profile: { name: 'hijack' } } }).eq('user_id', userA).select('user_id');
  assert.equal(updateAsB.error, null);
  assert.equal(updateAsB.data.length, 0, 'B não pode atualizar a linha de A.');
  const deleteAsB = await b.from('betbank_user_data').delete().eq('user_id', userA).select('user_id');
  assert.equal(deleteAsB.error, null);
  assert.equal(deleteAsB.data.length, 0, 'B não pode excluir a linha de A.');
  const verifyA = await a.from('betbank_user_data').select('payload').eq('user_id', userA).single();
  assert.equal(verifyA.error, null);
  assert.equal(verifyA.data.payload.profile.name, marker, 'As tentativas de B não alteraram a linha de A.');
  console.log('RLS staging OK: A CRUD próprio; B sem leitura/criação/alteração/exclusão cruzada.');
} finally {
  const cleanup = await a.from('betbank_user_data').delete().eq('user_id', userA);
  if (cleanup.error) console.error('Aviso: limpeza da linha de teste falhou; remova-a manualmente no staging.');
  await Promise.all([a.auth.signOut(), b.auth.signOut()]);
}
