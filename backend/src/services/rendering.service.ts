import { chromium, Browser } from 'playwright';
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
  hasBackground?: boolean;
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
   * Renders the quote text onto vertical image plates (2160x3840 physical at 2x DSF) and returns Cloudinary media URIs.
   * 
   * Architecture (MQA-01, MQA-05):
   * When a background asset is configured, Chromium renders ONLY the transparent foreground plate
   * (containing quote text, branding, watermark, and dark gradient scrim for readability).
   * The original background photographic asset is fed directly to FFmpeg without browser rasterization.
   * 
   * When no background is configured, renders a single full composite image on solid black.
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

    const hasBackground = !!options.hasBackground;
    logger.info(
      { jobId, language: options.language, templatePath, hasBackground },
      'Rendering image plate with Playwright template at 2x resolution'
    );

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
        // Render Transparent Foreground Plate with Scrim Overlay (MQA-05 / MQA-11)
        const fgHtml = renderer({
          text,
          language: options.language,
          branding: options.branding,
          watermark: options.watermark,
          fontFamily: options.fontFamily,
          layer: 'foreground',
        });

        await page.setContent(fgHtml);
        // @ts-ignore
        await page.evaluate(() => document.fonts.ready);

        const fgBuffer = await page.screenshot({ type: 'png', omitBackground: true });
        const fgRelativePath = `images/${jobId}_fg.png`;
        const { url: fgUrl } = await cloudinaryStorageProvider.save(fgBuffer, fgRelativePath);

        logger.info({ fgUrl }, 'Transparent foreground image plate rendered and uploaded successfully');
        return { imageUrl: fgUrl, foregroundImageUrl: fgUrl };
      } else {
        // Single flattened screenshot on black background when no background asset is configured
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
