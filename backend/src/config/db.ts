import { createClient } from '@supabase/supabase-js';
import { Pool } from 'pg';
import { config, isConfigReady } from './env';

// Initialize Supabase Client (Service Role Client for system operations)
export const supabase = createClient(
  config.SUPABASE_URL || 'https://placeholder.supabase.co',
  config.SUPABASE_SERVICE_ROLE_KEY || 'placeholder_key'
);

// Initialize PostgreSQL Pool for direct raw query access (e.g., pgvector similarity functions)
let pool: Pool | null = null;

if (isConfigReady()) {
  try {
    pool = new Pool({
      connectionString: config.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false // Supabase connections require SSL
      },
      connectionTimeoutMillis: 5000 // Timeout connection attempts after 5 seconds to prevent hanging
    });

    pool.on('error', (err) => {
      console.error('[DB Pool Error] Unexpected error on idle client:', err);
    });
  } catch (err) {
    console.error('[DB Pool Init Error] Failed to initialize DB Pool:', err);
  }
}

export function getDbPool(): Pool {
  if (!pool) {
    console.warn('[DB Pool Access] DATABASE_URL is not set. Database operations will fail.');
    return new Pool();
  }
  return pool;
}

export async function query(text: string, params?: any[]) {
  if (!pool) {
    console.warn('[Mock DB Query] SQL Executed (Offline Mode):', text, params);
    return { rows: [] };
  }
  const client = await pool.connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}
