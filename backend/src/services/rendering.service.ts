import { chromium, Browser } from 'playwright';
import { logger } from '../utils/logger.js';
import { templateRepository } from '../repositories/template.repository.js';
import { cloudinaryStorageProvider } from '../providers/storage/cloudinary.provider.js';
import { getTemplateRenderer } from '../templates/index.js';
import { StructuredContent } from '../schemas/content-block.schema.js';
import { TemplateDefinition } from '../schemas/template-definition.schema.js';
import { ContentOverflowError } from '../errors/custom-errors.js';

export interface RenderOptions {
  language: 'English' | 'Hindi' | 'Urdu' | 'HindiRoman' | 'UrduRoman';
  branding?: string | undefined;
  watermark?: string | undefined;
  brandingOpacity?: number | undefined;
  watermarkOpacity?: number | undefined;
  templateVersionId?: string | undefined;
  hasBackground?: boolean | undefined;
  content?: StructuredContent | undefined;
}

export interface RenderImageResult {
  imageUrl: string;
  foregroundImageUrl?: string;
}

let sharedBrowser: Browser | null = null;

export const renderingService = {
  /**
   * Retrieves or initializes the shared browser instance with crash-recovery listener.
   */
  async getBrowser(): Promise<Browser> {
    if (!sharedBrowser || !sharedBrowser.isConnected()) {
      logger.info('Initializing shared headless Playwright Chromium browser');
      sharedBrowser = await chromium.launch({
        headless: true,
      });
      sharedBrowser.on('disconnected', () => {
        logger.warn('Shared Playwright browser process disconnected. Resetting shared instance.');
        sharedBrowser = null;
      });
    }
    return sharedBrowser;
  },

  /**
   * Gracefully closes the shared browser instance (for worker shutdown).
   */
  async closeBrowser(): Promise<void> {
    if (sharedBrowser) {
      logger.info('Closing shared headless Playwright Chromium browser');
      await sharedBrowser.close();
      sharedBrowser = null;
    }
  },

  /**
   * Renders the vertical text plate using Playwright and uploads directly via CloudinaryStorageProvider.
   * If hasBackground is true, renders a transparent foreground plate with scrim (MQA-05 / MQA-11).
   * Implements bounded auto-shrink overflow protection with ContentOverflowError.
   */
  async renderImage(
    jobId: string,
    text: string,
    options: RenderOptions
  ): Promise<RenderImageResult> {
    let templateVersion: any = null;
    if (options.templateVersionId) {
      try {
        templateVersion = await templateRepository.getTemplateVersionById(options.templateVersionId);
      } catch (err) {
        logger.warn({ jobId, templateVersionId: options.templateVersionId, err }, 'Failed to load pinned TemplateVersion details');
      }
    }

    const hasBackground = !!options.hasBackground;
    const layer = hasBackground ? 'foreground' : 'full';

    // Step 5 / Fallback synthesis: if options.content is absent, synthesize a single-block body run
    const structuredContent: StructuredContent = options.content ?? {
      blocks: [
        {
          type: 'body',
          runs: [{ text, emphasis: 'normal' }],
        },
      ],
    };

    logger.info(
      {
        jobId,
        language: options.language,
        templateVersionId: options.templateVersionId,
        hasDefinition: !!templateVersion?.definition,
        hasBackground,
      },
      'Rendering image plate with Playwright template at 2x resolution'
    );

    const renderer = getTemplateRenderer(templateVersion ?? { componentPath: 'DefaultQuoteTemplate' });

    let context;
    try {
      const browser = await this.getBrowser();
      context = await browser.newContext({
        viewport: { width: 1080, height: 1920 },
        deviceScaleFactor: 2,
      });

      const page = await context.newPage();

      let htmlContent: string;
      if (templateVersion?.definition) {
        const baseDef = templateVersion.definition as TemplateDefinition;
        let currentDef = JSON.parse(JSON.stringify(baseDef)) as TemplateDefinition;
        const insets = currentDef.layout.safeAreaInsetsPx || { topPx: 140, bottomPx: 160, leftPx: 80, rightPx: 80 };
        const maxSafeHeight = 1920 - insets.topPx - insets.bottomPx;

        const MAX_SHRINK_ITERATIONS = 4;
        let fits = false;

        for (let iteration = 0; iteration <= MAX_SHRINK_ITERATIONS; iteration++) {
          htmlContent = (renderer as any)({
            content: structuredContent,
            definition: currentDef,
            language: options.language,
            branding: options.branding,
            watermark: options.watermark,
            brandingOpacity: options.brandingOpacity,
            watermarkOpacity: options.watermarkOpacity,
            layer,
          });

          await page.setContent(htmlContent);
          await page.evaluate(() => (globalThis as any).document?.fonts?.ready);

          const scrollHeight = await page.evaluate(() => {
            const doc = (globalThis as any).document;
            const el = doc ? doc.querySelector('.content-container') : null;
            return el ? el.scrollHeight : 0;
          });

          if (scrollHeight <= maxSafeHeight) {
            fits = true;
            break;
          }

          if (iteration < MAX_SHRINK_ITERATIONS) {
            logger.warn(
              { jobId, iteration, scrollHeight, maxSafeHeight },
              'Structured content exceeds safe canvas height; applying bounded auto-shrink'
            );
            // Reduce typography sizes by 10% with floor at 60% of base
            if (currentDef.typography.heading) {
              currentDef.typography.heading.sizePx = Math.max(
                Math.round(baseDef.typography.heading.sizePx * 0.6),
                Math.round(currentDef.typography.heading.sizePx * 0.9)
              );
            }
            if (currentDef.typography.body) {
              currentDef.typography.body.sizePx = Math.max(
                Math.round(baseDef.typography.body.sizePx * 0.6),
                Math.round(currentDef.typography.body.sizePx * 0.9)
              );
            }
            if (currentDef.typography.code) {
              currentDef.typography.code.sizePx = Math.max(
                Math.round(baseDef.typography.code.sizePx * 0.6),
                Math.round(currentDef.typography.code.sizePx * 0.9)
              );
            }
            if (currentDef.layout.blockGapPx) {
              currentDef.layout.blockGapPx = Math.max(8, Math.round(currentDef.layout.blockGapPx * 0.85));
            }
          }
        }

        if (!fits) {
          throw new ContentOverflowError(
            `Structured content exceeds template safe canvas height (${maxSafeHeight}px) even after maximum font reduction attempts.`
          );
        }
      } else {
        htmlContent = (renderer as any)({
          text,
          language: options.language,
          branding: options.branding,
          watermark: options.watermark,
          layer,
        });

        await page.setContent(htmlContent);
        // @ts-ignore
        await page.evaluate(() => document.fonts.ready);
      }

      if (hasBackground) {
        // Render Transparent Foreground Plate with Scrim Overlay (MQA-05 / MQA-11)
        const fgBuffer = await page.screenshot({ type: 'png', omitBackground: true });
        const fgRelativePath = `images/${jobId}_fg.png`;
        const { url: fgUrl } = await cloudinaryStorageProvider.save(fgBuffer, fgRelativePath);

        logger.info({ fgUrl }, 'Transparent foreground image plate rendered and uploaded successfully');
        return { imageUrl: fgUrl, foregroundImageUrl: fgUrl };
      } else {
        // Single flattened screenshot on solid background
        const imageBuffer = await page.screenshot({ type: 'png' });
        const relativePath = `images/${jobId}_render.png`;
        const { url: mediaUri } = await cloudinaryStorageProvider.save(imageBuffer, relativePath);

        logger.info({ mediaUri }, 'Composite image rendered and saved via StorageProvider successfully');
        return { imageUrl: mediaUri };
      }
    } catch (err: any) {
      logger.error({ jobId, err }, 'Playwright image rendering failed');
      throw err;
    } finally {
      if (context) {
        await context.close();
      }
    }
  },
};

export default renderingService;
