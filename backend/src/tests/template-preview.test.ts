import test from 'node:test';
import assert from 'node:assert/strict';
import { templateService } from '../services/template.service.js';
import { templateRepository } from '../repositories/template.repository.js';
import { renderingService } from '../services/rendering.service.js';
import { V1_TEMPLATE_DEFINITIONS, V1_SAMPLE_CONTENTS } from '../schemas/template-definition.schema.js';
import { PromptStatus } from '@prisma/client';

test('Template Preview Generation and Caching Tests', async (t) => {
  const origGetVersion = templateRepository.getVersion;
  const origUpdatePreview = templateRepository.updatePreviewImageUrl;
  const origRenderImage = renderingService.renderImage;

  t.afterEach(() => {
    templateRepository.getVersion = origGetVersion;
    templateRepository.updatePreviewImageUrl = origUpdatePreview;
    renderingService.renderImage = origRenderImage;
  });

  await t.test('returns cached previewImageUrl directly without re-rendering if already present', async () => {
    let renderCalled = false;
    renderingService.renderImage = async () => {
      renderCalled = true;
      return { imageUrl: 'https://cdn.example.com/new_render.png' };
    };

    templateRepository.getVersion = async () => {
      return {
        id: 'tv-123',
        templateId: 't-123',
        versionNumber: 1,
        componentPath: null,
        componentSource: null,
        category: 'MinimalQuote',
        definition: V1_TEMPLATE_DEFINITIONS.MinimalQuote as any,
        sampleContent: V1_SAMPLE_CONTENTS.MinimalQuote as any,
        previewImageUrl: 'https://cdn.example.com/cached_preview.png',
        status: PromptStatus.Active,
        notes: null,
        createdAt: new Date(),
      };
    };

    const url = await templateService.getOrGeneratePreview('t-123', 1);

    assert.equal(url, 'https://cdn.example.com/cached_preview.png');
    assert.equal(renderCalled, false, 'Should not trigger renderImage when previewImageUrl is already cached');
  });

  await t.test('generates, persists, and returns preview when previewImageUrl is null', async () => {
    let renderCalledWith: any = null;
    renderingService.renderImage = async (jobId, text, options) => {
      renderCalledWith = { jobId, text, options };
      return { imageUrl: 'https://cdn.example.com/newly_generated_preview.png' };
    };

    let persistedUrl: string | null = null;
    templateRepository.updatePreviewImageUrl = async (tvId, url) => {
      persistedUrl = url;
      return {} as any;
    };

    templateRepository.getVersion = async () => {
      return {
        id: 'tv-456',
        templateId: 't-456',
        versionNumber: 1,
        componentPath: null,
        componentSource: null,
        category: 'Terminal',
        definition: V1_TEMPLATE_DEFINITIONS.Terminal as any,
        sampleContent: V1_SAMPLE_CONTENTS.Terminal as any,
        previewImageUrl: null,
        status: PromptStatus.Active,
        notes: null,
        createdAt: new Date(),
      };
    };

    const url = await templateService.getOrGeneratePreview('t-456', 1);

    assert.equal(url, 'https://cdn.example.com/newly_generated_preview.png');
    assert.ok(renderCalledWith, 'renderImage should have been called');
    assert.equal(renderCalledWith.options.templateVersionId, 'tv-456');
    assert.equal(persistedUrl, 'https://cdn.example.com/newly_generated_preview.png', 'Should persist new URL to DB');
  });
});
