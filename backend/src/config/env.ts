import dotenv from 'dotenv';
import path from 'path';

// Load env variables from backend/.env
dotenv.config({ path: path.join(__dirname, '../../.env') });

export const config = {
  PORT: process.env.PORT || '3001',
  JWT_SECRET: process.env.JWT_SECRET || 'fallback_secret_local_123',
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
  GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/auth/google/callback',
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  DATABASE_URL: process.env.DATABASE_URL || '',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  NVIDIA_API_KEY: process.env.NVIDIA_API_KEY || '',
};

// Validate critical configurations
const missingKeys: string[] = [];
const placeholders = ['placeholder_id', 'placeholder_secret', 'placeholder_supabase_url', 'placeholder_supabase_anon_key', 'placeholder_supabase_service_role_key', 'placeholder_db_url', 'placeholder_gemini_key', 'placeholder_nvidia_key'];

for (const [key, value] of Object.entries(config)) {
  if (!value || placeholders.includes(value)) {
    missingKeys.push(key);
  }
}

if (missingKeys.length > 0) {
  console.warn(`[Config Warning] The following keys are missing or using placeholder: ${missingKeys.join(', ')}. Server might run in degraded/mock mode.`);
}

export function isConfigReady(): boolean {
  // Check if credentials are set to something real
  return (
    config.GOOGLE_CLIENT_ID !== '' && config.GOOGLE_CLIENT_ID !== 'placeholder_id' &&
    config.SUPABASE_URL !== '' && config.SUPABASE_URL !== 'placeholder_supabase_url' &&
    config.DATABASE_URL !== '' && config.DATABASE_URL !== 'placeholder_db_url' &&
    config.GEMINI_API_KEY !== '' && config.GEMINI_API_KEY !== 'placeholder_gemini_key'
  );
}
