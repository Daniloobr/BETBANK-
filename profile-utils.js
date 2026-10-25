const amountFields = ['initialBankroll', 'reserve', 'dailyLimit', 'weeklyLimit', 'monthlyLimit', 'maxStake'];

export function validateProfileDraft(input = {}) {
  const errors = {};
  const name = String(input.name ?? '').trim();
  if (!name || name.length > 60) errors.name = 'Informe um nome ou apelido de até 60 caracteres.';
  if (!['yes', 'no'].includes(input.adult)) errors.adult = 'Selecione a confirmação de maioridade.';

  const profile = { name, adult: input.adult === 'yes' };
  for (const key of amountFields) {
    const raw = input[key];
    const value = raw === '' || raw == null ? 0 : Number(raw);
    const cents = value * 100;
    // Allow harmless IEEE-754 representation error (for example, 0.29 * 100).
    if (!Number.isFinite(value) || value < 0 || Math.abs(cents - Math.round(cents)) > 1e-8) {
      errors[key] = 'Informe um valor não negativo com até duas casas decimais.';
      continue;
    }
    profile[key] = Math.round(cents) / 100;
  }
  return { valid: Object.keys(errors).length === 0, errors, profile };
}
