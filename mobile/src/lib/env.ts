import Constants from 'expo-constants';
import { z } from 'zod';

const envSchema = z.object({
  apiBaseUrl: z
    .string()
    .url('API_BASE_URL must be a valid URL')
    .refine((url) => url.endsWith('/api/v1'), {
      message: 'API_BASE_URL must end with /api/v1',
    })
    .refine(
      (url) => {
        if (__DEV__) return true;
        return url.startsWith('https://');
      },
      { message: 'API_BASE_URL must use HTTPS in release builds' }
    ),
  appIdentifier: z.string().min(1).optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;

let cachedEnv: EnvConfig | null = null;
let envError: string | null = null;

export function getEnv(): EnvConfig {
  if (cachedEnv) return cachedEnv;

  const rawUrl =
    Constants.expoConfig?.extra?.apiBaseUrl ||
    process.env.EXPO_PUBLIC_API_BASE_URL ||
    (__DEV__ ? 'http://localhost:4000/api/v1' : '');

  const rawIdentifier =
    Constants.expoConfig?.android?.package ||
    Constants.expoConfig?.ios?.bundleIdentifier ||
    process.env.APP_IDENTIFIER;

  const result = envSchema.safeParse({
    apiBaseUrl: rawUrl,
    appIdentifier: rawIdentifier,
  });

  if (!result.success) {
    const errorMsg = result.error.errors.map((e) => e.message).join(', ');
    envError = errorMsg;
    // Return a fallback in dev or throw
    if (__DEV__) {
      return {
        apiBaseUrl: 'http://localhost:4000/api/v1',
        appIdentifier: 'com.publishiq.mobile.dev',
      };
    }
    throw new Error(`[Configuration Error] ${errorMsg}`);
  }

  cachedEnv = result.data;
  return cachedEnv;
}

export function getEnvError(): string | null {
  return envError;
}

export const env = getEnv();
