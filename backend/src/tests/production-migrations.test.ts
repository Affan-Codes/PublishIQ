import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

test('Production Migrations Directory Tests (P0-01)', async (t) => {
  const migrationsDir = path.resolve('prisma/migrations');

  await t.test('prisma/migrations directory exists', () => {
    assert.ok(fs.existsSync(migrationsDir), 'prisma/migrations directory must exist');
    assert.ok(fs.statSync(migrationsDir).isDirectory(), 'prisma/migrations must be a directory');
  });

  await t.test('prisma/migrations/migration_lock.toml exists with postgresql provider', () => {
    const lockPath = path.join(migrationsDir, 'migration_lock.toml');
    assert.ok(fs.existsSync(lockPath), 'migration_lock.toml must exist');
    const content = fs.readFileSync(lockPath, 'utf8');
    assert.ok(content.includes('provider = "postgresql"'), 'migration_lock.toml must specify postgresql provider');
  });

  await t.test('initial migration folder exists with non-empty migration.sql', () => {
    const entries = fs.readdirSync(migrationsDir, { withFileTypes: true });
    const migrationDirs = entries.filter((e) => e.isDirectory() && e.name.includes('init'));
    assert.ok(migrationDirs.length >= 1, 'At least one init migration directory must exist');

    const initDir = path.join(migrationsDir, migrationDirs[0]!.name);
    const sqlPath = path.join(initDir, 'migration.sql');
    assert.ok(fs.existsSync(sqlPath), 'migration.sql must exist inside init migration folder');

    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    assert.ok(sqlContent.length > 500, 'migration.sql must not be empty');
    assert.ok(sqlContent.includes('CREATE TABLE "Template"'), 'migration.sql must create Template table');
    assert.ok(sqlContent.includes('CREATE TABLE "TemplateVersion"'), 'migration.sql must create TemplateVersion table');
    assert.ok(sqlContent.includes('CREATE TABLE "GeneratedContent"'), 'migration.sql must create GeneratedContent table');
  });
});
