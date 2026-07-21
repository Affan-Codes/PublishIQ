import { chromium, Browser } from 'playwright';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { templateRepository } from '../repositories/template.repository.js';
import { localDiskStorageProvider } from '../providers/storage/local-disk.provider.js';
import { getTemplateRenderer } from '../templates/index.js';

export interface RenderOptions {
  language: 'English' | 'Hindi' | 'Urdu';
  branding?: string;
  watermark?: string;
  fontFamily?: string;
  templateVersionId?: string;
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
   * Renders the generated text onto a vertical image (1080x1920) and returns the media URI path.
   */
  async renderImage(jobId: string, text: string, options: RenderOptions): Promise<string> {
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

    logger.info({ jobId, language: options.language, templatePath }, 'Rendering image with Playwright template');

    const renderer = getTemplateRenderer(templatePath);
    const htmlContent = renderer({
      text,
      language: options.language,
      branding: options.branding,
      watermark: options.watermark,
      fontFamily: options.fontFamily,
    });

    let context;
    try {
      const browser = await this.getBrowser();
      context = await browser.newContext({
        viewport: { width: 1080, height: 1920 },
        deviceScaleFactor: 1,
      });

      const page = await context.newPage();
      await page.setContent(htmlContent);
      
      // Wait for fonts to load
      // @ts-ignore
      await page.evaluate(() => document.fonts.ready);

      // Take screenshot of viewport to buffer
      const imageBuffer = await page.screenshot({
        type: 'png',
      });

      const relativePath = `images/${jobId}_render.png`;
      const mediaUri = await localDiskStorageProvider.save(imageBuffer, relativePath);

      logger.info({ mediaUri }, 'Image rendered and saved via StorageProvider successfully');
      
      return mediaUri;
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
