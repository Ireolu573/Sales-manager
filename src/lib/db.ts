import { Pool, type QueryResult, type QueryResultRow } from 'pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('Missing DATABASE_URL in environment; set it via MCP or .env.local');
}

export const pgPool = new Pool({ connectionString, max: 5 });

export async function query<T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]): Promise<QueryResult<T>> {
  return pgPool.query<T>(text, params);
}

export default pgPool;
