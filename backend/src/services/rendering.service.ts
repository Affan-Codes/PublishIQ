import { chromium, Browser } from 'playwright';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { templateRepository } from '../repositories/template.repository.js';
import { cloudinaryStorageProvider } from '../providers/storage/cloudinary.provider.js';
import { getTemplateRenderer } from '../templates/index.js';

export interface RenderOptions {
  language: 'English' | 'Hindi' | 'Urdu' | 'HindiRoman' | 'UrduRoman';
  branding?: string;
  watermark?: string;
  fontFamily?: string;
  templateVersionId?: string;
  backgroundImageUrl?: string;
  animationPreset?: 'None' | 'SlowZoomIn' | 'SlowZoomOut' | 'PanLeft' | 'PanRight' | 'PanUp' | 'PanDown';
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
   * Renders the generated text onto vertical image(s) (2160x3840 physical at 2x DSF) and returns the media URI paths.
   * When a background is configured (AQL-06), renders two separate plates:
   * 1. Background plate (background + scrim with optional pan overscan)
   * 2. Foreground plate (transparent-background quote text and branding with alpha channel)
   * When no background is configured, renders a single full composite image.
   */
  async renderImage(jobId: string, text: string, options: RenderOptions): Promise<RenderImageResult> {
    let templatePath = 'DefaultQuoteTemplate';
    if (options.templateVersionId) {
      try {
        const tv = await templateRepository.getTemplateVersionById(options.templateVersionId);
        if (tv) {
          templatePath = tv.componentPath || 'DefaultQuoteTemplate';
        }
      } catch (err) {
        logger.warn({ jobId, templateVersionId: options.templateVersionId, err }, 'Failed to load pinned TemplateVersion details');
      }
    }

    const hasBackground = !!(options.backgroundImageUrl && options.backgroundImageUrl.trim().length > 0);
    logger.info({ jobId, language: options.language, templatePath, hasBackground, animationPreset: options.animationPreset }, 'Rendering image with Playwright template at 2x resolution');

    const renderer = getTemplateRenderer(templatePath);

    let context;
    try {
      const browser = await this.getBrowser();
      context = await browser.newContext({
        viewport: { width: 1080, height: 1920 },
        deviceScaleFactor: 2,
      });

      const page = await context.newPage();

      if (hasBackground) {
        // 1. Render Background Plate (Background + Overlay Scrim)
        const bgHtml = renderer({
          text,
          language: options.language,
          branding: options.branding,
          watermark: options.watermark,
          fontFamily: options.fontFamily,
          backgroundImageUrl: options.backgroundImageUrl,
          layer: 'background',
          animationPreset: options.animationPreset,
        });

        await page.setContent(bgHtml);
        // @ts-ignore
        await page.evaluate(() => document.fonts.ready);

        const bgBuffer = await page.screenshot({ type: 'png' });
        const bgRelativePath = `images/${jobId}_bg.png`;
        const { url: bgUrl } = await cloudinaryStorageProvider.save(bgBuffer, bgRelativePath);

        // 2. Render Foreground Plate (Text + Branding over Transparent background)
        const fgHtml = renderer({
          text,
          language: options.language,
          branding: options.branding,
          watermark: options.watermark,
          fontFamily: options.fontFamily,
          backgroundImageUrl: options.backgroundImageUrl,
          layer: 'foreground',
          animationPreset: options.animationPreset,
        });

        await page.setContent(fgHtml);
        // @ts-ignore
        await page.evaluate(() => document.fonts.ready);

        const fgBuffer = await page.screenshot({ type: 'png', omitBackground: true });
        const fgRelativePath = `images/${jobId}_fg.png`;
        const { url: fgUrl } = await cloudinaryStorageProvider.save(fgBuffer, fgRelativePath);

        logger.info({ bgUrl, fgUrl }, 'Layered background and foreground images rendered and uploaded successfully');
        return { imageUrl: bgUrl, foregroundImageUrl: fgUrl };
      } else {
        // Single flattened screenshot when no background is configured
        const htmlContent = renderer({
          text,
          language: options.language,
          branding: options.branding,
          watermark: options.watermark,
          fontFamily: options.fontFamily,
          layer: 'full',
        });

        await page.setContent(htmlContent);
        // @ts-ignore
        await page.evaluate(() => document.fonts.ready);

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
  }
};

export default renderingService;
