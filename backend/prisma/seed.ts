import { ContentTypeStatus, Role } from '@prisma/client';
import bcrypt from 'bcrypt';
import { env } from '../src/config/env.js';
import { prisma } from '../src/database/db.js';

const WORKSPACE_ID = 'd3b07384-d113-495f-a558-9c5c8ee058c4';

async function main() {
  console.log('Seeding database...');

  // 1. Upsert Workspace
  const workspace = await prisma.workspace.upsert({
    where: { id: WORKSPACE_ID },
    update: { name: 'Default Workspace' },
    create: {
      id: WORKSPACE_ID,
      name: 'Default Workspace',
    },
  });
  console.log(`Workspace seeded: ${workspace.name} (${workspace.id})`);

  // 1.5 Seed Initial Owner User
  const passwordHash = bcrypt.hashSync(env.OPERATOR_PASSWORD, 10);
  const user = await prisma.user.upsert({
    where: { email: env.OPERATOR_EMAIL.toLowerCase() },
    update: {
      passwordHash,
      role: Role.Owner,
      workspaceId: workspace.id,
    },
    create: {
      email: env.OPERATOR_EMAIL.toLowerCase(),
      passwordHash,
      role: Role.Owner,
      workspaceId: workspace.id,
    },
  });
  console.log(`Initial Owner user seeded: ${user.email} with role ${user.role}`);

  // 2. Seed System Configurations
  const systemConfigs = [
    { key: 'retry_limit.generation', value: 3 },
    { key: 'retry_limit.duplicate_regeneration', value: 5 },
    { key: 'retry_limit.publish', value: 3 },
    { key: 'render_concurrency', value: 2 },
    { key: 'default_video_duration_seconds', value: 15 },
    { key: 'log_retention_days', value: 30 },
    { key: 'default_fonts', value: ['Inter', 'Roboto'] },
    { key: 'storage_provider', value: 'local' },
  ];

  for (const config of systemConfigs) {
    await prisma.systemConfiguration.upsert({
      where: {
        workspaceId_key: {
          workspaceId: workspace.id,
          key: config.key,
        },
      },
      update: { value: config.value },
      create: {
        workspaceId: workspace.id,
        key: config.key,
        value: config.value,
      },
    });
  }
  console.log('System configurations seeded.');

  // 3. Seed Feature Flags
  const featureFlags = [
    { key: 'enable_ai_provider', enabled: true, description: 'Allows AI content generation' },
    { key: 'enable_platform', enabled: true, description: 'Allows publishing integration' },
    { key: 'enable_approval_mode', enabled: false, description: 'Enables human-in-the-loop hybrid approval' },
    { key: 'enable_auto_publish', enabled: false, description: 'Enables automatic publish pipelines' },
    { key: 'enable_experimental_features', enabled: false, description: 'Enables experimental UI/rendering' },
  ];

  for (const flag of featureFlags) {
    await prisma.featureFlag.upsert({
      where: {
        workspaceId_key: {
          workspaceId: workspace.id,
          key: flag.key,
        },
      },
      update: { enabled: flag.enabled, description: flag.description },
      create: {
        workspaceId: workspace.id,
        key: flag.key,
        enabled: flag.enabled,
        description: flag.description,
      },
    });
  }
  console.log('Feature flags seeded.');

  // 4. Seed Content Types
  const contentTypes = [
    'Shayari',
    'Motivational Quote',
    'Business Quote',
    'Festival Wish',
    'Poetry',
  ];

  for (const typeName of contentTypes) {
    const existing = await prisma.contentType.findFirst({
      where: {
        workspaceId: workspace.id,
        name: typeName,
      },
    });

    if (!existing) {
      await prisma.contentType.create({
        data: {
          workspaceId: workspace.id,
          name: typeName,
          status: ContentTypeStatus.Active,
        },
      });
    }
  }
  console.log('Content types seeded.');

  console.log('Database seeding complete!');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
