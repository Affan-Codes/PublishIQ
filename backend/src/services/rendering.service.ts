import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export interface RenderOptions {
  language: 'English' | 'Hindi' | 'Urdu';
  branding?: string;
  watermark?: string;
  fontFamily?: string;
}

export const renderingService = {
  /**
   * Renders the generated text onto a vertical image (1080x1920) and returns the file path.
   */
  async renderImage(jobId: string, text: string, options: RenderOptions): Promise<string> {
    logger.info({ jobId, language: options.language }, 'Rendering image with Playwright');

    let langClass = '';
    if (options.language === 'Urdu') {
      langClass = 'lang-urdu';
    } else if (options.language === 'Hindi') {
      langClass = 'lang-hindi';
    }

    const brandingText = options.branding || 'PUBLISHIQ';
    const watermarkText = options.watermark || '@publishiq';

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&family=Noto+Sans+Devanagari:wght@400;700&family=Noto+Nastaliq+Urdu:wght@400;700&display=swap" rel="stylesheet">
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #000000;
      color: #ffffff;
      font-family: 'Poppins', sans-serif;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      align-items: center;
      width: 1080px;
      height: 1920px;
      box-sizing: border-box;
      padding: 150px 80px;
      text-align: center;
    }
    
    .content-container {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      width: 100%;
    }

    .quote-text {
      font-size: 64px;
      line-height: 1.6;
      font-weight: 600;
      max-width: 900px;
      word-wrap: break-word;
      color: #ffffff;
      text-shadow: 0px 4px 20px rgba(255, 255, 255, 0.2);
    }

    .lang-urdu {
      font-family: 'Noto Nastaliq Urdu', serif;
      font-size: 56px;
      line-height: 2.3;
      direction: rtl;
    }

    .lang-hindi {
      font-family: 'Noto Sans Devanagari', sans-serif;
      font-size: 60px;
      line-height: 1.7;
    }

    .branding-container {
      font-size: 32px;
      color: #9c9cb0;
      font-weight: 500;
      letter-spacing: 2px;
      text-transform: uppercase;
    }

    .watermark-container {
      font-size: 28px;
      color: rgba(255, 255, 255, 0.4);
      font-weight: 400;
      letter-spacing: 1px;
    }
  </style>
</head>
<body>
  <div class="branding-container">${escapeHtml(brandingText)}</div>
  
  <div class="content-container">
    <div class="quote-text ${langClass}">${escapeHtml(text)}</div>
  </div>
  
  <div class="watermark-container">${escapeHtml(watermarkText)}</div>
</body>
</html>
    `;

    let browser;
    try {
      // Launch headless Chromium via Playwright
      browser = await chromium.launch({
        headless: true,
      });

      const context = await browser.newContext({
        viewport: { width: 1080, height: 1920 },
        deviceScaleFactor: 1,
      });

      const page = await context.newPage();
      await page.setContent(htmlContent);
      
      // Wait for fonts to load
      // @ts-ignore
      await page.evaluate(() => document.fonts.ready);

      // Create target directory if it doesn't exist
      const outputDir = path.join(env.MEDIA_ROOT, 'images');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const relativePath = `images/${jobId}_render.png`;
      const outputPath = path.join(env.MEDIA_ROOT, relativePath);

      // Take screenshot of viewport
      await page.screenshot({
        path: outputPath,
        type: 'png',
      });

      logger.info({ outputPath }, 'Image rendered and saved successfully');
      
      // Return absolute or relative URL path for static file serving.
      // The media endpoint resolves `/media/*` to `env.MEDIA_ROOT`.
      return `/media/images/${jobId}_render.png`;
    } catch (err: any) {
      logger.error({ jobId, err }, 'Playwright image rendering failed');
      throw err;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }
};

function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export default renderingService;
