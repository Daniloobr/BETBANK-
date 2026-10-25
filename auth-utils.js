export function validateSignup({ name, email, password, confirmation }) {
  const errors = {};
  const normalizedEmail = String(email ?? '').trim();
  if (String(name ?? '').trim().length < 2) errors.name = 'Informe seu nome ou apelido.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) errors.email = 'Digite um e-mail válido.';
  if (String(password ?? '').length < 10) errors.password = 'Use uma senha com pelo menos 10 caracteres.';
  if (password !== confirmation) errors.confirmation = 'As senhas não coincidem.';
  return errors;
}

export function friendlyAuthError(error) {
  const message = String(error?.message ?? '').toLowerCase();
  const code = String(error?.code ?? '').toLowerCase();
  if (['42p01', 'pgrst205'].includes(code) || (message.includes('betbank_user_data') && (message.includes('does not exist') || message.includes('schema cache')))) return 'O banco do Betbank ainda não foi configurado. Aplique a migration do Supabase e tente entrar novamente.';
  if (message.includes('invalid api key') || message.includes('invalid jwt')) return 'A URL ou a chave pública do Supabase está incorreta. Confira as variáveis de ambiente da aplicação.';
  if (message.includes('row-level security') || message.includes('rls')) return 'O acesso ao banco foi bloqueado pelas políticas de segurança. Confira a migration e as políticas RLS do Supabase.';
  if (message.includes('invalid login credentials')) return 'E-mail ou senha não conferem.';
  if (message.includes('email not confirmed') || message.includes('email_not_confirmed')) return 'Confirme seu e-mail pelo link enviado antes de entrar.';
  if (message.includes('already registered') || message.includes('user exists')) {
    return 'Não foi possível criar a conta com esses dados. Confira o e-mail ou tente entrar/recuperar a senha.';
  }
  if (message.includes('password') && (message.includes('weak') || message.includes('short') || message.includes('length'))) {
    return 'A senha não atende ao mínimo de segurança configurado.';
  }
  if (message.includes('rate limit') || message.includes('too many')) return 'Muitas tentativas. Aguarde um pouco e tente novamente.';
  if (message.includes('network') || message.includes('fetch')) return 'Não foi possível conectar ao serviço. Verifique sua internet e tente novamente.';
  if (message.includes('email') && message.includes('invalid')) return 'Digite um e-mail válido.';
  return 'Não foi possível concluir. Confira os dados e tente novamente.';
}

export function privateAreaAllowed({ verifiedUser, userStorageKey }) {
  return Boolean(verifiedUser?.id && userStorageKey);
}

export function authScreenFromHash(hash) {
  const screen = String(hash ?? '').replace(/^#/, '');
  return ['signup', 'login', 'forgot'].includes(screen) ? screen : 'home';
}

export function authScreenForState(authState, requestedScreen) {
  // Session checks and transient provider errors must not trap a signed-out
  // visitor on a blocking page. Keep the requested public route available.
  const screen = String(requestedScreen ?? 'home');
  return ['home', 'signup', 'login', 'forgot', 'recovery', 'verify-email'].includes(screen)
    ? screen
    : 'home';
}

export function hasSupabaseConfiguration(url, publicKey) {
  const urlValue = String(url ?? '').trim();
  const keyValue = String(publicKey ?? '').trim();
  if (!urlValue || !keyValue || /seu-projeto|sua-chave|placeholder/i.test(`${urlValue} ${keyValue}`)) return false;
  if (keyValue.length < 20) return false;
  try {
    const parsed = new URL(urlValue);
    return ['https:', 'http:'].includes(parsed.protocol) && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

export function supabasePublicKey(anonKey, publishableKey) {
  return String(publishableKey ?? '').trim() || String(anonKey ?? '').trim();
}
