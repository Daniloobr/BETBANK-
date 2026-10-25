import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { authScreenFromHash } from './auth-utils.js';
import { downloadLegacyBackup, hasLegacyBackup, LEGACY_STORAGE_KEY, readLegacyBackup } from './legacy-backup.js';

const appSource = readFileSync(fileURLToPath(new URL('./index.html', import.meta.url)), 'utf8');

function storage(initial) {
  const values = new Map(initial ? [[LEGACY_STORAGE_KEY, initial]] : []);
  const calls = { writes: 0, removes: 0 };
  return {
    calls,
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { calls.writes++; values.set(key, value); },
    removeItem: key => { calls.removes++; values.delete(key); }
  };
}

test('detecção só oferece backup opcional quando a chave antiga existe', () => {
  assert.equal(hasLegacyBackup(storage('{"bets":[]}')), true);
  assert.equal(hasLegacyBackup(storage()), false);
});

test('detecção repetida é somente leitura e mantém intactos os dados legados', () => {
  const original = '{"bets":[{"stake":12.5}],"profile":{"name":"Antigo"}}';
  const store = storage(original);
  assert.equal(readLegacyBackup(store), original);
  assert.equal(readLegacyBackup(store), original);
  assert.equal(store.getItem(LEGACY_STORAGE_KEY), original);
  assert.deepEqual(store.calls, { writes: 0, removes: 0 });
});

test('backup legado é opcional e não interfere nas rotas públicas ou no acesso privado', () => {
  const store = storage('{"bets":[]}');
  assert.equal(authScreenFromHash('#signup'), 'signup');
  assert.equal(authScreenFromHash('#login'), 'login');
  assert.equal(authScreenFromHash('#forgot'), 'forgot');
  assert.match(appSource, /function render\(\).*#app/s);
  assert.match(appSource, /privateAreaAllowed\(\{verifiedUser:authUser,userStorageKey:activeStorageKey\}\)/);
  assert.equal(store.getItem(LEGACY_STORAGE_KEY), '{"bets":[]}');
  assert.deepEqual(store.calls, { writes: 0, removes: 0 });
});

test('clique opcional baixa o JSON original sem modificar a chave antiga', async () => {
  const raw = '{"bets":[{"event":"A & B","stake":1.25}]}';
  const store = storage(raw);
  let anchor, savedBlob, revoked = false;
  const urlApi = {
    createObjectURL: blob => { savedBlob = blob; return 'blob:qa-backup'; },
    revokeObjectURL: url => { revoked = url === 'blob:qa-backup'; }
  };
  const documentRef = { createElement: tag => { assert.equal(tag, 'a'); anchor = { click() { this.clicked = true; } }; return anchor; } };
  const schedule = callback => callback();

  assert.equal(downloadLegacyBackup(readLegacyBackup(store), { documentRef, urlApi, schedule }), true);
  assert.equal(anchor.download, 'betbank-backup-legado.json');
  assert.equal(anchor.href, 'blob:qa-backup');
  assert.equal(anchor.clicked, true);
  assert.equal(await savedBlob.text(), raw);
  assert.equal(revoked, true);
  assert.equal(store.getItem(LEGACY_STORAGE_KEY), raw);
  assert.deepEqual(store.calls, { writes: 0, removes: 0 });
});

test('sem dados legados o download não é criado e a navegação pública permanece normal', () => {
  let created = false;
  assert.equal(downloadLegacyBackup(null, { documentRef: { createElement: () => { created = true; } } }), false);
  assert.equal(created, false);
  assert.equal(authScreenFromHash('#'), 'home');
  assert.equal(authScreenFromHash('#'), 'home');
});

test('HTML não contém mais a tela bloqueadora e mantém o botão somente atrás da detecção', () => {
  assert.doesNotMatch(appSource, /Baixe sua cópia antiga antes de continuar/);
  assert.match(appSource, /hasLegacyBackup\(localStorage\)\s*\?/);
  assert.match(appSource, /button\.textContent='Baixar backup dos dados antigos'/);
  assert.match(appSource, /if\(legacy\)\{/);
});

test('autenticação carrega a nuvem sem sobrescrever dados locais antigos', () => {
  const session = appSource.match(/async function establishSession[^\r\n]*/)?.[0] ?? '';
  assert.match(session, /authClient\.auth\.getUser\(\)/);
  assert.match(session, /db=load\(\)/);
  assert.match(session, /activeStorageKey=`\$\{KEY\}:\$\{authUser\.id\}:cloud-cache`/);
  assert.match(session, /readUserData\(authClient,authUser\.id\)/);
  assert.doesNotMatch(session, /writeUserData|localStorage\.setItem|localStorage\.removeItem|cloudMigrationPending/);
  assert.match(appSource, /localStorage\.getItem\(`\$\{KEY\}:\$\{authUser\.id\}`\)/);
  assert.match(appSource, /Baixar dados locais anteriores/);
  assert.match(appSource, /authScreenFromHash\(window\.location\.hash\)/);
  assert.match(appSource, /#login/);
  assert.match(appSource, /#signup/);
  assert.match(appSource, /#forgot/);
});
