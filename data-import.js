const BET_STATUSES = new Set(['won', 'lost', 'pending', 'void', 'partial']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createSafeId() {
  return globalThis.crypto?.randomUUID?.() ?? 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.floor(Math.random() * 16);
    return (c === 'x' ? r : (r & 3) | 8).toString(16);
  });
}

export function safeImportedId(value, createId = createSafeId) {
  return typeof value === 'string' && UUID.test(value) ? value : createId();
}

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

export function parseMoney(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  let text = String(value ?? '').trim().replace(/^R\$\s*/i, '').replace(/\s/g, '');
  if (!text) return NaN;
  if (text.includes(',') && text.includes('.')) {
    const decimal = text.lastIndexOf(',') > text.lastIndexOf('.') ? ',' : '.';
    const thousands = decimal === ',' ? /\./g : /,/g;
    text = text.replace(thousands, '').replace(decimal, '.');
  } else if (text.includes(',')) text = text.replace(',', '.');
  if (!/^-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(text)) return NaN;
  const number = Number(text);
  return Number.isFinite(number) ? number : NaN;
}

function validDate(value) {
  const text = String(value ?? '').trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:?\d{2})?)?$/.exec(text);
  if (!match) return false;
  const [, year, month, day, hour = '12', minute = '00', second = '00'] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  if (date.getFullYear() !== Number(year) || date.getMonth() !== Number(month) - 1 || date.getDate() !== Number(day)) return false;
  if (+hour > 23 || +minute > 59 || +second > 59) return false;
  return Number.isFinite(Date.parse(text.length === 10 ? `${text}T12:00:00` : text));
}

function cents(value) {
  const rounded = Math.round(value * 100);
  return Math.abs(value * 100 - rounded) < 1e-7 ? rounded : NaN;
}

export function validateBetRecord(input) {
  const stake = parseMoney(input?.stake);
  const returnAmount = input?.returnAmount === '' || input?.returnAmount == null ? 0 : parseMoney(input.returnAmount);
  const status = String(input?.status ?? '').trim().toLowerCase();
  const placedAt = String(input?.placedAt ?? '').trim();
  const category = String(input?.category ?? '').trim();
  const errors = [];
  if (!Number.isFinite(stake) || !Number.isFinite(cents(stake))) errors.push('stake deve ser um valor numérico válido com até 2 casas decimais');
  else if (stake <= 0) errors.push('stake deve ser maior que zero');
  if (!Number.isFinite(returnAmount) || !Number.isFinite(cents(returnAmount))) errors.push('retorno deve ser um valor numérico válido com até 2 casas decimais');
  else if (returnAmount < 0) errors.push('retorno não pode ser negativo');
  if (!validDate(placedAt)) errors.push('data inválida; use AAAA-MM-DD ou AAAA-MM-DDTHH:mm');
  if (!BET_STATUSES.has(status)) errors.push('status inválido');
  if (!category) errors.push('modalidade obrigatória');
  if (Number.isFinite(stake) && Number.isFinite(returnAmount)) {
    if (['pending', 'lost'].includes(status) && cents(returnAmount) !== 0) errors.push(`${status === 'pending' ? 'aposta pendente' : 'derrota'} deve ter retorno zero`);
    if (status === 'void' && cents(stake) !== cents(returnAmount)) errors.push('aposta anulada deve informar o valor integral devolvido');
    if (status === 'won' && cents(returnAmount) <= cents(stake)) errors.push('vitória deve ter retorno total maior que a stake');
    if (status === 'partial' && cents(returnAmount) <= 0) errors.push('liquidação parcial deve ter retorno positivo');
  }
  if (errors.length) return { valid: false, errors };
  const odds = input.odds == null || input.odds === '' ? null : parseMoney(input.odds);
  if (odds != null && (!Number.isFinite(odds) || !Number.isFinite(cents(odds)) || odds < 1)) return { valid: false, errors: ['cotação inválida'] };
  return { valid: true, errors: [], bet: { ...input, placedAt: placedAt.length === 10 ? `${placedAt}T12:00` : placedAt, category, stake, returnAmount, status, odds } };
}

function parseRows(text) {
  const source = String(text ?? '').replace(/^\ufeff/, '');
  let delimiter = ';';
  let quoted = false, firstLine = '';
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (ch === '"' && source[i + 1] === '"' && quoted) { i++; continue; }
    if (ch === '"') quoted = !quoted;
    else if (!quoted && (ch === ';' || ch === ',')) firstLine += ch;
    else if (!quoted && (ch === '\n' || ch === '\r')) break;
  }
  const commas = [...firstLine].filter(c => c === ',').length;
  const semicolons = [...firstLine].filter(c => c === ';').length;
  delimiter = commas > semicolons ? ',' : ';';

  const rows = [];
  let row = [], field = '', inQuotes = false, line = 1, startLine = 1;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (ch === '"' && inQuotes && source[i + 1] === '"') { field += '"'; i++; continue; }
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === delimiter && !inQuotes) { row.push(field.trim()); field = ''; continue; }
    if ((ch === '\n' || ch === '\r') && !inQuotes) {
      row.push(field.trim());
      if (row.some(cell => cell !== '')) rows.push({ line: startLine, cells: row });
      row = []; field = '';
      if (ch === '\r' && source[i + 1] === '\n') i++;
      line++; startLine = line;
      continue;
    }
    if (ch === '\n') line++;
    field += ch;
  }
  if (inQuotes) return { rows, error: `linha ${startLine}: campo entre aspas não foi fechado` };
  row.push(field.trim());
  if (row.some(cell => cell !== '')) rows.push({ line: startLine, cells: row });
  return { rows };
}

const aliases = {
  placedat: 'placedAt', data: 'placedAt', category: 'category', modalidade: 'category',
  event: 'event', evento: 'event', platform: 'platform', plataforma: 'platform',
  type: 'type', tipo: 'type', stake: 'stake', valor: 'stake', odds: 'odds', cotacao: 'odds',
  status: 'status', returnamount: 'returnAmount', retorno: 'returnAmount',
  emotion: 'emotion', emocao: 'emotion', notes: 'notes', observacoes: 'notes'
};
const statusAliases = { 'vitória': 'won', vitoria: 'won', derrota: 'lost', pendente: 'pending', anulada: 'void', parcial: 'partial' };

export function parseBetCsv(text) {
  const parsed = parseRows(text);
  if (parsed.error) return { valid: [], invalid: [{ line: 1, reason: parsed.error }] };
  if (!parsed.rows.length) return { valid: [], invalid: [{ line: 1, reason: 'arquivo vazio' }] };
  const [header, ...data] = parsed.rows;
  const keys = header.cells.map(cell => aliases[cell.trim().toLowerCase()]);
  const invalid = [], valid = [];
  if (!keys.includes('placedAt') || !keys.includes('category') || !keys.includes('stake') || !keys.includes('status')) {
    return { valid, invalid: [{ line: header.line, reason: 'cabeçalho precisa conter data, modalidade, valor e status' }] };
  }
  for (const { line, cells } of data) {
    if (cells.length !== keys.length) { invalid.push({ line, reason: 'quantidade de colunas diferente do cabeçalho' }); continue; }
    const raw = Object.fromEntries(cells.map((cell, index) => [keys[index], cell]));
    raw.status = statusAliases[raw.status?.trim().toLowerCase()] ?? raw.status?.trim().toLowerCase();
    raw.type ||= 'Simples';
    const result = validateBetRecord(raw);
    if (!result.valid) { invalid.push({ line, reason: result.errors.join('; ') }); continue; }
    result.bet.id = createSafeId();
    valid.push({ line, bet: result.bet });
  }
  return { valid, invalid };
}

function exactKey(bet) {
  return JSON.stringify(['placedAt', 'category', 'event', 'platform', 'type', 'stake', 'odds', 'status', 'returnAmount', 'emotion', 'notes'].map(key => String(bet[key] ?? '').trim().toLocaleLowerCase()));
}
function similarKey(bet) {
  return JSON.stringify([String(bet.placedAt ?? '').slice(0, 16), cents(parseMoney(bet.stake)), String(bet.event || bet.category || '').trim().toLocaleLowerCase()]);
}

export function classifyBetImports(records, existing) {
  const exact = new Set(existing.map(exactKey));
  const similar = new Set(existing.map(similarKey));
  const result = { newRecords: [], duplicates: [], similar: [] };
  for (const record of records) {
    const bet = record.bet ?? record;
    const exactId = exactKey(bet), similarId = similarKey(bet);
    if (exact.has(exactId)) { result.duplicates.push(record); continue; }
    if (similar.has(similarId)) { result.similar.push(record); exact.add(exactId); continue; }
    result.newRecords.push(record);
    exact.add(exactId); similar.add(similarId);
  }
  return result;
}

export function prepareCsvImport(text, existing) {
  const parsed = parseBetCsv(text);
  const groups = classifyBetImports(parsed.valid, existing);
  if (parsed.invalid.length) return { valid: false, invalid: parsed.invalid, groups };
  return { valid: true, invalid: [], groups };
}

function normalizeText(value, maxLength) {
  return String(value ?? '').slice(0, maxLength);
}

export function validateBackup(data, createId = createSafeId) {
  if (!data || typeof data !== 'object' || Array.isArray(data) || !Array.isArray(data.bets) || !Array.isArray(data.transactions) || !Array.isArray(data.goals)) {
    return { valid: false, errors: ['o arquivo não parece ser um backup Betbank'] };
  }
  const errors = [], normalized = { ...data, bets: [], transactions: [], goals: [] };
  data.bets.forEach((item, index) => {
    const checked = validateBetRecord(item);
    if (!item || typeof item !== 'object' || !checked.valid) { errors.push(`aposta ${index + 1}: ${checked.errors.join('; ') || 'registro inválido'}`); return; }
    normalized.bets.push({ ...checked.bet, id: safeImportedId(item.id, createId), event: normalizeText(item.event, 160), platform: normalizeText(item.platform, 100), type: normalizeText(item.type || 'Simples', 40), emotion: normalizeText(item.emotion, 80), notes: normalizeText(item.notes, 2000) });
  });
  data.transactions.forEach((item, index) => {
    const amount = parseMoney(item?.amount);
    if (!item || !['deposit', 'withdrawal'].includes(item.type) || !Number.isFinite(amount) || !Number.isFinite(cents(amount)) || amount <= 0 || !validDate(item.date)) { errors.push(`movimentação ${index + 1}: tipo, valor ou data inválidos`); return; }
    normalized.transactions.push({ ...item, id: safeImportedId(item.id, createId), amount, date: String(item.date), description: normalizeText(item.description, 120) });
  });
  data.goals.forEach((item, index) => {
    const target = parseMoney(item?.target);
    if (!item || !['count', 'exposure', 'loss'].includes(item.type) || !Number.isFinite(target) || target <= 0 || !validDate(item.start) || !validDate(item.end) || item.end < item.start || !String(item.name ?? '').trim()) { errors.push(`meta ${index + 1}: nome, tipo, alvo ou datas inválidos`); return; }
    normalized.goals.push({ ...item, id: safeImportedId(item.id, createId), name: normalizeText(item.name, 80), target });
  });
  let profile = null;
  if (data.profile != null && (typeof data.profile !== 'object' || Array.isArray(data.profile))) errors.push('perfil inválido');
  else if (data.profile) {
    profile = { name: normalizeText(data.profile.name, 60), adult: data.profile.adult === true };
    for (const key of ['initialBankroll', 'reserve', 'dailyLimit', 'weeklyLimit', 'monthlyLimit', 'maxStake']) {
      const amount = parseMoney(data.profile[key] ?? 0);
      if (!Number.isFinite(amount) || !Number.isFinite(cents(amount)) || amount < 0) errors.push(`perfil: ${key} inválido`);
      profile[key] = amount;
    }
  }
  if (data.pausedUntil != null && !validDate(data.pausedUntil)) errors.push('data de pausa inválida');
  if (errors.length) return { valid: false, errors };
  if (profile) normalized.profile = profile;
  if (data.pausedUntil) normalized.pausedUntil = data.pausedUntil;
  return { valid: true, errors: [], backup: normalized };
}

export function mergeBackup(current, backup, createId = createSafeId) {
  const next = structuredClone(current);
  const merge = (oldRows, newRows) => {
    const rows = [...oldRows], ids = new Set(oldRows.map(row => row.id));
    for (const item of newRows) {
      if (item.id && ids.has(item.id)) continue;
      const row = { ...item };
      if (!row.id || ids.has(row.id)) row.id = createId();
      ids.add(row.id); rows.push(row);
    }
    return rows;
  };
  next.bets = merge(next.bets, backup.bets);
  next.transactions = merge(next.transactions, backup.transactions);
  next.goals = merge(next.goals, backup.goals);
  if (!next.profile && backup.profile) next.profile = backup.profile;
  if (!next.pausedUntil && backup.pausedUntil) next.pausedUntil = backup.pausedUntil;
  return next;
}
