export const BET_CATEGORIES = [
  'Futebol', 'Basquete', 'Tênis', 'Vôlei', 'MMA / Boxe', 'E-sports',
  'Corrida', 'Beisebol', 'Hóquei', 'Futebol americano', 'Slots',
  'Aviator / Crash', 'Cassino ao vivo', 'Outros'
];

export const BET_PLATFORMS = [
  'ZZ3', '63C', 'PG765', 'Q82', 'PG668'
];

export const BET_TYPES = [
  'Simples', 'Múltipla', 'Sistema', 'Ao vivo', 'Pré-jogo', 'Outra'
];

export function optionsWithCurrent(options, current) {
  const value = String(current ?? '').trim();
  return value && !options.includes(value) ? [...options, value] : [...options];
}
