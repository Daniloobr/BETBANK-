import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./index.html', import.meta.url)), 'utf8');
const session = source.match(/async function establishSession[^\r\n]*/)?.[0] ?? '';
const render = source.match(/function render\(\)[^\r\n]*/)?.[0] ?? '';

test('login renderiza o app após autenticar mesmo sem perfil', () => {
  assert.match(session, /authState='authenticated';authScreen='home';[\s\S]*?render\(\);return true/);
  assert.match(render, /privateAreaAllowed\([\s\S]*?\$\('#app'\)\.hidden=false/);
  assert.match(source, /Configure seu perfil/);
  assert.match(source, /data-view-link="settings"/);
});

test('a tela e a condição de migração obrigatória foram removidas do fluxo', () => {
  assert.doesNotMatch(source, /MIGRAÇÃO SEGURA PARA A NUVEM|Encontramos dados locais nesta conta|cloudMigrationPending|migrateCloudData|cloudBackupDone/);
  assert.doesNotMatch(source, /profile-setup|id="profileSetup"/);
  assert.doesNotMatch(render, /migration|profileSetup|cloudMigration/);
});

test('login não importa nem grava dados locais antigos; usa cache separado por usuário', () => {
  assert.match(session, /activeStorageKey=`\$\{KEY\}:\$\{authUser\.id\}:cloud-cache`/);
  assert.match(session, /const remoteState=await readUserData\(authClient,authUser\.id\)/);
  assert.doesNotMatch(session, /writeUserData|localStorage\.setItem|localStorage\.removeItem/);
  assert.match(source, /function save\([\s\S]*?writeUserData\(authClient,authUser\.id,payload\)/);
});

test('backup local anterior continua voluntário nas configurações e não é apagado', () => {
  assert.match(source, /Baixar dados locais anteriores/);
  assert.match(source, /function downloadPreviousAccountBackup\(\)[\s\S]*?localStorage\.getItem\(`\$\{KEY\}:\$\{authUser\.id\}`\)/);
  assert.match(source, /download\(raw,'betbank-dados-locais-anteriores\.json'/);
  assert.doesNotMatch(source, /localStorage\.removeItem\(`\$\{KEY\}:\$\{authUser\.id\}`\)/);
});

test('falhas do Supabase mantêm a sessão no dashboard em modo somente leitura', () => {
  assert.match(session, /O painel está em modo de leitura/);
  assert.match(render, /id="retryCloudLoad"/);
  assert.match(render, /if\(!cloudReady\)[\s\S]*?control\.disabled=true/);
});

test('perfil financeiro continua editável pelas configurações sem persistir sucesso falso', () => {
  assert.match(source, /id="profileForm"/);
  assert.match(source, /validateProfileDraft\(Object\.fromEntries\(new FormData\(pf\)\)\)/);
  assert.match(source, /await save\(\{deferRender:true\}\)/);
  assert.match(source, /button\.textContent='Tentar salvar novamente'/);
});


test('perfil sem confirmação 18+ mostra acesso às configurações no dashboard', () => {
  assert.match(source, /!p\|\|!p\.adult\?/);
  assert.match(source, /confirme que tem 18 anos ou mais nas configurações/);
  assert.match(source, /data-view-link=\"settings\">Configurar perfil/);
});

test('salvar aposta aguarda a nuvem e mantém o formulário aberto em caso de falha', () => {
  const handler = source.match(/#saveBet'\)\.onclick=async\(\)=>\{[\s\S]*?;if\(existing\)/)?.[0] ?? '';
  assert.match(handler, /await save\(\{deferRender:true\}\)/);
  assert.match(handler, /if\(!saved\)\{db=previousDb/);
  assert.match(handler, /Tentar salvar novamente/);
  assert.match(handler, /Registro salvo na nuvem/);
  assert.match(handler, /catch\(saveError\)/);
});


test('modal nativo ocupa o top layer e centraliza sem depender do scroll da página', () => {
  assert.match(source, /#modalRoot dialog\.modal\{position:fixed;inset:0;margin:auto;width:min\(680px,calc\(100vw - 32px\)\)/);
  assert.match(source, /#modalRoot dialog\.modal::backdrop\{background:#050907bb;backdrop-filter:blur\(3px\)\}/);
  assert.match(source, /dialog\.showModal\(\)/);
  assert.match(source, /function closeModal\(\)\{const root=\$\('#modalRoot'\),dialog=root\.querySelector\('dialog'\)/);
});


test('modal nativo limita altura, rola o conteúdo e adapta campos a telas estreitas', () => {
  assert.match(source, /#modalRoot dialog\.modal\{[^}]*max-height:calc\(100dvh - 32px\);[^}]*overflow:hidden/);
  assert.match(source, /\.modal-content\{flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain/);
  assert.match(source, /\.modal-content \.formgrid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\);align-items:start\}/);
  assert.match(source, /@media\(max-width:680px\)\{#modalRoot dialog\.modal\{width:calc\(100vw - 24px\)/);
  assert.match(source, /\.modal-content \.formgrid\{grid-template-columns:minmax\(0,1fr\)\}/);
  assert.match(source, /resetScroll\(\);requestAnimationFrame\(\(\)=>requestAnimationFrame\(resetScroll\)\)/);
});

test('modal bloqueia a rolagem do fundo e libera a página ao fechar por qualquer caminho', () => {
  assert.match(source, /html\.modal-open,body\.modal-open\{overflow:hidden\}/);
  assert.match(source, /document\.documentElement\.classList\.add\('modal-open'\);document\.body\.classList\.add\('modal-open'\)/);
  assert.match(source, /dialog\.addEventListener\('close',[\s\S]*?classList\.remove\('modal-open'\)/);
  assert.match(source, /\[data-close-modal\][\s\S]*?addEventListener\('click',closeModal\)/);
  assert.doesNotMatch(source, /onclick="document\.querySelector\('#modalRoot'\)\.innerHTML=''/);
});
