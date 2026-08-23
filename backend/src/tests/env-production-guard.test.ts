import test from 'node:test';
import assert from 'node:assert/strict';
import { envSchema } from '../config/env.js';

test('Production Environment Security Guard Tests (P0-05, P1-06)', async (t) => {
  const baseValidProductionEnv = {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://prod:pass@prod-db:5432/publishiq',
    VALKEY_URL: 'redis://prod-valkey:6379',
    SESSION_SECRET: 'production-session-secret-must-be-32-chars-long!!',
    ENCRYPTION_KEY: 'production-encryption-key-must-be-32-chars-long!!',
    ENCRYPTION_SALT: 'production-encryption-salt-must-be-16-chars',
    OPERATOR_EMAIL: 'owner@production.company.com',
    OPERATOR_PASSWORD: 'SuperSecureProdPassword123!',
    CLOUDINARY_CLOUD_NAME: 'prod-cloud',
    CLOUDINARY_API_KEY: '123456789',
    CLOUDINARY_API_SECRET: 'secret_abc_123',
    GEMINI_API_KEY: 'AIzaSyProdTestKey12345',
    FACEBOOK_APP_ID: 'fb_app_id_prod',
    FACEBOOK_APP_SECRET: 'fb_app_secret_prod',
    GOOGLE_CLIENT_ID: 'google_client_id_prod',
    GOOGLE_CLIENT_SECRET: 'google_client_secret_prod',
    APP_BASE_URL: 'https://api.publishiq.com',
    CORS_ORIGIN: 'https://app.publishiq.com',
  };

  await t.test('fails in production mode when APP_BASE_URL is localhost default', () => {
    const invalidEnv = {
      ...baseValidProductionEnv,
      APP_BASE_URL: 'http://localhost:4000',
    };
    const result = envSchema.safeParse(invalidEnv);
    assert.strictEqual(result.success, false, 'Production mode must fail when APP_BASE_URL is localhost default');
  });

  await t.test('fails in production mode when CORS_ORIGIN is localhost default', () => {
    const invalidEnv = {
      ...baseValidProductionEnv,
      CORS_ORIGIN: 'http://localhost:5173',
    };
    const result = envSchema.safeParse(invalidEnv);
    assert.strictEqual(result.success, false, 'Production mode must fail when CORS_ORIGIN is localhost default');
  });

  await t.test('fails in production mode when default dev secrets are used', () => {
    const invalidEnv = {
      ...baseValidProductionEnv,
      ENCRYPTION_KEY: 'dev-encryption-key-with-32-characters!!',
    };
    const result = envSchema.safeParse(invalidEnv);
    assert.strictEqual(result.success, false, 'Production mode must fail when dev ENCRYPTION_KEY is used');
  });

  await t.test('passes in development mode with defaults', () => {
    const devEnv = {
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://localhost:5432/publishiq',
      VALKEY_URL: 'redis://localhost:6379',
      SESSION_SECRET: 'dev-session-secret-with-32-characters!!',
      ENCRYPTION_KEY: 'dev-encryption-key-with-32-characters!!',
      CLOUDINARY_CLOUD_NAME: 'dev-cloud',
      CLOUDINARY_API_KEY: '123456789',
      CLOUDINARY_API_SECRET: 'secret_abc_123',
    };
    const result = envSchema.safeParse(devEnv);
    assert.ok(result.success, 'Development mode should allow default configuration');
  });
});
