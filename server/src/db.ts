import postgres from 'postgres';

// Test mode gets its own database so it can never touch real results.
const TEST_MODE = process.env.GAMENIGHT_TEST === '1';
const url = TEST_MODE ? process.env.TEST_DATABASE_URL : process.env.DATABASE_URL;
if (!url) throw new Error(`Set ${TEST_MODE ? 'TEST_DATABASE_URL' : 'DATABASE_URL'} (see README).`);

// prepare: false because Neon's pooled connection doesn't keep prepared statements.
export const sql = postgres(url, { prepare: false, max: process.env.VERCEL ? 1 : 10, onnotice: () => {} });

type Sql = typeof sql | postgres.TransactionSql;

export async function expansionIdFor(gameId: number, name: string, tx: Sql = sql): Promise<number> {
  await tx`INSERT INTO expansions (game_id, name) VALUES (${gameId}, ${name}) ON CONFLICT DO NOTHING`;
  const [row] = await tx`SELECT id FROM expansions WHERE game_id = ${gameId} AND name = ${name}`;
  return row.id;
}

export async function idFor(table: 'players' | 'games', name: string, tx: Sql = sql): Promise<number> {
  await tx`INSERT INTO ${tx(table)} (name) VALUES (${name}) ON CONFLICT DO NOTHING`;
  const [row] = await tx`SELECT id FROM ${tx(table)} WHERE name = ${name}`;
  return row.id;
}

// After inserting rows with explicit ids, move each id counter past the highest id.
export async function resetSequences(tx: Sql = sql) {
  for (const t of ['players', 'games', 'sessions', 'plays', 'expansions']) {
    await tx`SELECT setval(pg_get_serial_sequence(${t}, 'id'), coalesce((SELECT max(id) FROM ${tx(t)}), 0) + 1, false)`;
  }
}
