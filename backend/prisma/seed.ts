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
    { key: 'storage_provider', value: 'cloudinary' },
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

  // 5. Seed default Prompts and PromptVersions
  const defaultPrompt = await prisma.prompt.upsert({
    where: { id: 'd3b07384-d113-495f-a558-9c5c8ee058c4' }, // deterministic UUID
    update: {},
    create: {
      id: 'd3b07384-d113-495f-a558-9c5c8ee058c4',
      workspaceId: workspace.id,
      name: 'Default Content Generation Prompt',
      status: 'Active',
      notes: 'Initial default prompt version',
    }
  });

  const promptBody = `You are an expert quote generator. Based on the Content Type: {{contentType}}, Language: {{language}}, and Tone: {{tone}}, generate a beautiful quote or Shayari.
Available background music catalog: {{musicCatalog}}
CRITICAL CONSTRAINT: Both "title" and "caption" MUST NOT exceed 100 characters in length.
If the music catalog contains a suitable track for this content's mood and theme, set "selectedMusicAssetId" to that track's exact "id". If none fit or the catalog is empty, omit "selectedMusicAssetId".
Response MUST be in structured JSON format matching this exact schema:
{
  "title": "A short descriptive title for the quote (maximum 100 characters)",
  "quote": "The quote or Shayari text itself, shaped in beautiful formatting",
  "caption": "A social media caption description (maximum 100 characters)",
  "hashtags": ["hashtag1", "hashtag2", "hashtag3"],
  "metadata": {},
  "language": "{{language}}",
  "contentType": "{{contentType}}",
  "selectedMusicAssetId": "optional-id-from-music-catalog"
}
Do NOT wrap in markdown formatting (like \`\`\`json). Return only pure JSON string.`;

  await prisma.promptVersion.upsert({
    where: {
      promptId_versionNumber: {
        promptId: defaultPrompt.id,
        versionNumber: 1,
      }
    },
    update: { body: promptBody },
    create: {
      promptId: defaultPrompt.id,
      versionNumber: 1,
      body: promptBody,
      status: 'Active',
      notes: 'Initial version',
    }
  });
  console.log('Default prompts seeded.');

  // 6. Seed default Templates and TemplateVersions
  const defaultTemplate = await prisma.template.upsert({
    where: { id: 'e3b07384-d113-495f-a558-9c5c8ee058c4' }, // deterministic UUID
    update: {},
    create: {
      id: 'e3b07384-d113-495f-a558-9c5c8ee058c4',
      workspaceId: workspace.id,
      name: 'Default Quote Template',
      status: 'Active',
      notes: 'Initial default template',
    }
  });

  await prisma.templateVersion.upsert({
    where: {
      templateId_versionNumber: {
        templateId: defaultTemplate.id,
        versionNumber: 1,
      }
    },
    update: {},
    create: {
      templateId: defaultTemplate.id,
      versionNumber: 1,
      componentPath: 'DefaultQuoteTemplate',
      status: 'Active',
      notes: 'Initial version',
    }
  });
  console.log('Default templates seeded.');

  // 7. Seed Cloudinary Music Assets (Trimmed to 15s max)
  const musicAssets = [
    {
      id: 'f3b07384-d113-495f-a558-9c5c8ee058c4',
      name: 'Default Inspiring Acoustic',
      filePath: 'https://res.cloudinary.com/rabbitcloud/video/upload/v1786362985/publishiq/music/default_inspiring_acoustic.mp3',
      metadata: { mood: 'Inspiring', genre: 'Acoustic', durationSeconds: 15 },
    },
    {
      id: 'fbc07384-d113-495f-a558-9c5c8ee058c1',
      name: 'Acoustic Bright Melody',
      filePath: 'https://res.cloudinary.com/rabbitcloud/video/upload/v1786362988/publishiq/music/acoustic_bright_melody.mp3',
      metadata: { mood: 'Bright', genre: 'Acoustic', durationSeconds: 15 },
    },
    {
      id: 'fbc07384-d113-495f-a558-9c5c8ee058c2',
      name: 'Ambient Chill Beats',
      filePath: 'https://res.cloudinary.com/rabbitcloud/video/upload/v1786362991/publishiq/music/ambient_chill_beats.mp3',
      metadata: { mood: 'Chill', genre: 'Ambient', durationSeconds: 15 },
    },
    {
      id: 'fbc07384-d113-495f-a558-9c5c8ee058c3',
      name: 'Upbeat Energetic Track',
      filePath: 'https://res.cloudinary.com/rabbitcloud/video/upload/v1786362993/publishiq/music/upbeat_energetic_track.mp3',
      metadata: { mood: 'Energetic', genre: 'Upbeat', durationSeconds: 15 },
    },
    {
      id: 'fbc07384-d113-495f-a558-9c5c8ee058c4',
      name: 'Lofi Focus Groove',
      filePath: 'https://res.cloudinary.com/rabbitcloud/video/upload/v1786362995/publishiq/music/lofi_focus_groove.mp3',
      metadata: { mood: 'Focus', genre: 'Lofi', durationSeconds: 15 },
    },
    {
      id: 'fbc07384-d113-495f-a558-9c5c8ee058c5',
      name: 'Cinematic Piano Inspiration',
      filePath: 'https://res.cloudinary.com/rabbitcloud/video/upload/v1786362997/publishiq/music/cinematic_piano_inspiration.mp3',
      metadata: { mood: 'Cinematic', genre: 'Piano', durationSeconds: 15 },
    },
    {
      id: 'fbc07384-d113-495f-a558-9c5c8ee058c6',
      name: 'Smooth Jazz Sunset',
      filePath: 'https://res.cloudinary.com/rabbitcloud/video/upload/v1786362999/publishiq/music/smooth_jazz_sunset.mp3',
      metadata: { mood: 'Smooth', genre: 'Jazz', durationSeconds: 15 },
    },
  ];

  for (const music of musicAssets) {
    await prisma.asset.upsert({
      where: { id: music.id },
      update: {
        filePath: music.filePath,
        status: 'Active',
      },
      create: {
        id: music.id,
        workspaceId: workspace.id,
        type: 'Music',
        name: music.name,
        status: 'Active',
        filePath: music.filePath,
        licenseStatus: 'Confirmed',
        metadata: music.metadata,
      },
    });
  }
  console.log('All Cloudinary music assets seeded.');

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
