import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { authScreenForState, friendlyAuthError, hasSupabaseConfiguration, privateAreaAllowed, supabasePublicKey, validateSignup } from './auth-utils.js';

const appSource = readFileSync(fileURLToPath(new URL('./index.html', import.meta.url)), 'utf8');

test('cadastro aceita nome, e-mail válido e senha mínima', () => {
  assert.deepEqual(validateSignup({ name: 'Ana', email: 'ana@example.com', password: 'senha12345', confirmation: 'senha12345' }), {});
});

test('cadastro valida e-mail, senha e confirmação', () => {
  assert.deepEqual(validateSignup({ name: 'A', email: 'ana@', password: 'curta', confirmation: 'diferente' }), {
    name: 'Informe seu nome ou apelido.',
    email: 'Digite um e-mail válido.',
    password: 'Use uma senha com pelo menos 10 caracteres.',
    confirmation: 'As senhas não coincidem.'
  });
});

test('erros de login não revelam se o endereço está cadastrado', () => {
  assert.equal(friendlyAuthError({ message: 'Invalid login credentials' }), 'E-mail ou senha não conferem.');
  assert.match(friendlyAuthError({ message: 'User already registered' }), /Confira o e-mail/);
  assert.match(friendlyAuthError({ message: 'Email not confirmed' }), /Confirme seu e-mail/);
});

test('erros de rede e limite de tentativas recebem mensagens seguras', () => {
  assert.match(friendlyAuthError({ message: 'Failed to fetch' }), /conectar ao serviço/);
  assert.match(friendlyAuthError({ message: 'rate limit exceeded' }), /Muitas tentativas/);
});

test('erros de banco ausente, chave e políticas recebem instruções operacionais', () => {
  assert.match(friendlyAuthError({ code: '42P01', message: 'relation missing' }), /Aplique a migration/);
  assert.match(friendlyAuthError({ message: 'Invalid API key' }), /chave pública/);
  assert.match(friendlyAuthError({ message: 'new row violates row-level security policy' }), /políticas RLS/);
});

test('a área privada exige usuário verificado e chave de armazenamento da conta', () => {
  assert.equal(privateAreaAllowed({ verifiedUser: null, userStorageKey: 'betbank:u1' }), false);
  assert.equal(privateAreaAllowed({ verifiedUser: { id: 'u1' }, userStorageKey: null }), false);
  assert.equal(privateAreaAllowed({ verifiedUser: { id: 'u1' }, userStorageKey: 'betbank:u1' }), true);
});

test('login, cadastro e recuperação permanecem acessíveis durante verificação ou erro transitório', () => {
  for (const state of ['checking', 'error', 'ready']) {
    assert.equal(authScreenForState(state, 'login'), 'login');
    assert.equal(authScreenForState(state, 'signup'), 'signup');
    assert.equal(authScreenForState(state, 'forgot'), 'forgot');
  }
});

test('rotas de autenticação desconhecidas retornam à tela inicial', () => {
  assert.equal(authScreenForState('error', 'dashboard'), 'home');
});

test('configuração Supabase rejeita variáveis ausentes e os placeholders do exemplo', () => {
  assert.equal(hasSupabaseConfiguration('', ''), false);
  assert.equal(hasSupabaseConfiguration('https://SEU-PROJETO.supabase.co', 'sua-chave-publica-anon-ou-publishable'), false);
  assert.equal(hasSupabaseConfiguration('not-a-url', 'x'.repeat(40)), false);
  assert.equal(hasSupabaseConfiguration('https://project.supabase.co', 'eyJhbGciOiJIUzI1NiJ9.valid-public-anon-key'), true);
});

test('seleciona uma chave publishable pública e preserva compatibilidade com anon', () => {
  assert.equal(supabasePublicKey('anon-legada', 'sb_publishable_publica'), 'sb_publishable_publica');
  assert.equal(supabasePublicKey('anon-legada', ''), 'anon-legada');
});

test('handlers dos formulários previnem reload e restauram a tela após resposta do Supabase', () => {
  for (const [formId, handler] of [['signupForm', 'submitSignup'], ['loginForm', 'submitLogin'], ['forgotForm', 'submitForgot'], ['recoveryForm', 'submitRecovery']]) {
    assert.match(appSource, new RegExp(`id="${formId}"`));
    assert.match(appSource, new RegExp(`if\\(${formId.replace('Form', '')}\\)${handler === 'submitSignup' ? 'signup' : handler === 'submitLogin' ? 'login' : handler === 'submitForgot' ? 'forgot' : 'recovery'}\\.onsubmit=${handler}`));
    const body = appSource.match(new RegExp(`async function ${handler}\\(e\\)\\{([^\\n]*)`))?.[1] ?? '';
    assert.match(body, /e\.preventDefault\(\)/);
    assert.match(body, /setAuthBusy\(f,true\)/);
    assert.match(body, /catch\(err\)/);
  }
});

test('renderização pública não substitui as rotas por spinner ou tela bloqueadora de erro', () => {
  const start = appSource.indexOf('function authMarkup(){');
  const end = appSource.indexOf('function appendLegacyBackupPanel', start);
  const markup = start >= 0 && end > start ? appSource.slice(start, end) : '';
  assert.match(markup, /authScreenForState\(authState,authScreen\)/);
  assert.doesNotMatch(markup, /if\(authState==='checking'\)return/);
  assert.doesNotMatch(markup, /if\(authState==='error'\)return/);
  assert.match(markup, /data-auth-screen="signup"/);
  assert.match(markup, /data-auth-screen="login"/);
  assert.match(markup, /data-auth-screen="forgot"/);
});

test('recuperação usa retorno da origem atual e permite definir nova senha', () => {
  assert.match(appSource, /resetPasswordForEmail\(email,\{redirectTo\}\)/);
  assert.match(appSource, /window\.location\.origin\+window\.location\.pathname/);
  assert.match(appSource, /authClient\.auth\.updateUser\(\{password:data\.password\}\)/);
  assert.match(appSource, /window\.location\.hash\.includes\('type=recovery'\)/);
});

test('configuração ausente não simula cadastro e mantém o envio desabilitado', () => {
  assert.match(appSource, /if\(!configured\)\{authState='not-configured'/);
  assert.match(appSource, /authState='not-configured'/);
  assert.match(appSource, /id="recoveryForm"/);
  assert.match(appSource, /<button class="btn primary" type="submit">Criar minha conta<\/button>/);
  for (const [handler, message] of [['submitSignup', 'Cadastro indisponível'], ['submitLogin', 'Login indisponível'], ['submitForgot', 'Recuperação indisponível'], ['submitRecovery', 'Redefinição indisponível']]) {
    const body = appSource.match(new RegExp(`async function ${handler}\\(e\\)\\{([^\\n]*)`))?.[1] ?? '';
    assert.match(body, /if\(!configured\|\|!authClient\)/);
    assert.ok(body.includes(message));
  }
});

test('rotas diretas são processadas antes do retorno por falta de configuração', () => {
  const boot = appSource.match(/async function bootAuth\(\)\{([^\n]*)/)?.[1] ?? '';
  assert.ok(boot.indexOf('authScreenFromHash(window.location.hash)') >= 0);
  assert.ok(boot.indexOf('authScreenFromHash(window.location.hash)') < boot.indexOf("if(!configured)"));
  assert.match(boot, /type=recovery/);
  assert.match(appSource, /history\.replaceState\(null,'',window\.location\.pathname\+window\.location\.search\+'#'\+authScreen\)/);
});
