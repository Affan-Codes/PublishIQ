import test from 'node:test';
import assert from 'node:assert';
import { z } from 'zod';

test('Authentication Schema and Middlewares Unit Tests', async (t) => {
  const userCreateSchema = z.object({
    email: z.string().email('Invalid email address format'),
    password: z.string().min(12, 'Password must be at least 12 characters long'),
  });

  await t.test('User validation schemas - correct inputs', () => {
    const valid = userCreateSchema.safeParse({
      email: 'admin@publishiq.com',
      password: 'adminpassword123',
    });
    assert.strictEqual(valid.success, true);
  });

  await t.test('User validation schemas - invalid email format rejected', () => {
    const invalid = userCreateSchema.safeParse({
      email: 'invalid-email-address',
      password: 'validpassword123',
    });
    assert.strictEqual(invalid.success, false);
    if (!invalid.success) {
      assert.strictEqual(invalid.error?.issues[0]?.message, 'Invalid email address format');
    }
  });

  await t.test('User validation schemas - short passwords rejected', () => {
    const invalid = userCreateSchema.safeParse({
      email: 'admin@publishiq.com',
      password: '1234567890',
    });
    assert.strictEqual(invalid.success, false);
    if (!invalid.success) {
      assert.strictEqual(invalid.error?.issues[0]?.message, 'Password must be at least 12 characters long');
    }
  });
});
