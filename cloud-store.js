/** User-owned Betbank state stored in a single PostgreSQL row.
 * Ownership is enforced by the migration's RLS policies; the browser UID is
 * only used as a query key and is never treated as authorization by itself.
 */
export function hasUserData(value) {
  return Boolean(value && (
    value.profile ||
    (Array.isArray(value.bets) && value.bets.length) ||
    (Array.isArray(value.transactions) && value.transactions.length) ||
    (Array.isArray(value.goals) && value.goals.length) ||
    value.pausedUntil
  ));
}

export async function readUserData(client, userId) {
  if (!client || !userId) throw new Error('Autenticação necessária para ler os dados.');
  const { data, error } = await client
    .from('betbank_user_data')
    .select('payload')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data?.payload ?? null;
}

export async function writeUserData(client, userId, payload) {
  if (!client || !userId) throw new Error('Autenticação necessária para salvar os dados.');
  const { error } = await client
    .from('betbank_user_data')
    .upsert({ user_id: userId, payload }, { onConflict: 'user_id' });
  if (error) throw error;
}
