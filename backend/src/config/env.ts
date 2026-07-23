import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string(),
  REDIS_URL: z.string(),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters long'),
  ENCRYPTION_KEY: z.string().min(32, 'ENCRYPTION_KEY must be at least 32 characters long'),
  ENCRYPTION_SALT: z.string().min(16, 'ENCRYPTION_SALT must be at least 16 characters long').default('publishiq_secure_static_salt_v1'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('debug'),
  MEDIA_ROOT: z.string().default('./media'),
  QUEUE_PREFIX: z.string().default('publishiq'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  OPERATOR_EMAIL: z.string().email().default('admin@publishiq.com'),
  OPERATOR_PASSWORD: z.string().min(12, 'OPERATOR_PASSWORD must be at least 12 characters long').default('admin1234_default_secret_passphrase'),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-2.5-flash'),
  FACEBOOK_APP_ID: z.string().optional(),
  FACEBOOK_APP_SECRET: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  META_GRAPH_API_VERSION: z.string().default('v20.0'),
  APP_BASE_URL: z.string().url().default('http://localhost:4000'),
}).refine(
  (data) => {
    if (data.NODE_ENV === 'production') {
      if (data.OPERATOR_PASSWORD === 'admin1234_default_secret_passphrase' || !process.env.OPERATOR_PASSWORD) return false;
      if (data.OPERATOR_EMAIL === 'admin@publishiq.com' || !process.env.OPERATOR_EMAIL) return false;
      if (data.ENCRYPTION_SALT === 'publishiq_secure_static_salt_v1' || !process.env.ENCRYPTION_SALT) return false;
      if (!data.GEMINI_API_KEY) return false;
      if (!data.FACEBOOK_APP_ID || !data.FACEBOOK_APP_SECRET) return false;
      if (!data.GOOGLE_CLIENT_ID || !data.GOOGLE_CLIENT_SECRET) return false;
    }
    return true;
  },
  {
    message: 'Required production environment variables (OPERATOR_EMAIL, OPERATOR_PASSWORD, ENCRYPTION_SALT, GEMINI_API_KEY, FACEBOOK_APP_ID/SECRET, GOOGLE_CLIENT_ID/SECRET) must be explicitly provided',
    path: ['ENCRYPTION_SALT'],
  }
);

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment configuration:');
  console.error(JSON.stringify(parsed.error.format(), null, 2));
  process.exit(1);
}

export const env = parsed.data;
export type Env = z.infer<typeof envSchema>;
