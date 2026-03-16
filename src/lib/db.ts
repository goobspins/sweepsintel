import {
  Client,
  neon,
  neonConfig,
  type QueryResultRow,
} from '@neondatabase/serverless';
import ws from 'ws';

export type QueryParams = unknown[];

export interface TransactionClient {
  query<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    params?: QueryParams,
  ): Promise<T[]>;
}

if (typeof WebSocket !== 'undefined') {
  neonConfig.webSocketConstructor = WebSocket;
} else {
  neonConfig.webSocketConstructor = ws;
}

function getDatabaseUrl() {
  const databaseUrl = import.meta.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set.');
  }

  return databaseUrl;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: QueryParams = [],
): Promise<T[]> {
  const db = neon(getDatabaseUrl());
  return db.query<T>(sql, params);
}

export async function transaction<T>(
  handler: (tx: TransactionClient) => Promise<T>,
): Promise<T> {
  const client = new Client(getDatabaseUrl());
  await client.connect();

  const tx: TransactionClient = {
    async query<R extends QueryResultRow = QueryResultRow>(
      sql: string,
      params: QueryParams = [],
    ) {
      const result = await client.query<R>(sql, params);
      return result.rows;
    },
  };

  try {
    await client.query('BEGIN');
    const result = await handler(tx);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

