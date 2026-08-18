export interface TemplateRenderData {
  text: string;
  language: 'English' | 'Hindi' | 'Urdu' | 'HindiRoman' | 'UrduRoman';
  branding?: string | undefined;
  watermark?: string | undefined;
  fontFamily?: string | undefined;
  theme?: 'dark' | 'light' | 'gradient' | undefined;
  layer?: 'full' | 'foreground' | undefined;
}

function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function renderDefaultQuoteTemplate(data: TemplateRenderData): string {
  let langClass = '';
  if (data.language === 'Urdu') {
    langClass = 'lang-urdu';
  } else if (data.language === 'Hindi') {
    langClass = 'lang-hindi';
  }
  // HindiRoman and UrduRoman leave langClass empty, falling through to default Poppins and LTR

  const layer = data.layer || 'full';
  const brandingText = data.branding || 'PUBLISHIQ';
  const watermarkText = data.watermark || '@publishiq';
  const fontFamily = data.fontFamily ? `'${data.fontFamily}', 'Poppins', sans-serif` : "'Poppins', sans-serif";

  const isForegroundOnly = layer === 'foreground';
  const bodyBg = isForegroundOnly ? 'transparent' : '#000000';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&family=Noto+Sans+Devanagari:wght@400;700&family=Noto+Nastaliq+Urdu:wght@400;700&display=swap" rel="stylesheet">
  <style>
    * {
      box-sizing: border-box;
    }
    
    html, body {
      margin: 0;
      padding: 0;
      width: 1080px;
      height: 1920px;
      overflow: hidden;
      background-color: ${bodyBg};
    }

    .canvas-container {
      position: relative;
      width: 1080px;
      height: 1920px;
      overflow: hidden;
    }

    ${isForegroundOnly ? `
    /* Layer 1: Scrim Overlay for Readability over Background */
    .overlay-layer {
      position: absolute;
      top: 0;
      left: 0;
      width: 1080px;
      height: 1920px;
      background: linear-gradient(180deg, rgba(0, 0, 0, 0.65) 0%, rgba(0, 0, 0, 0.45) 50%, rgba(0, 0, 0, 0.75) 100%);
      z-index: 2;
    }
    ` : ''}

    /* Layer 2: Foreground Content (Text + Branding) */
    .content-layer {
      position: relative;
      z-index: 3;
      width: 1080px;
      height: 1920px;
      color: #ffffff;
      font-family: ${fontFamily};
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      align-items: center;
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
      text-shadow: 0px 4px 24px rgba(0, 0, 0, 0.8), 0px 2px 8px rgba(0, 0, 0, 0.6);
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
      color: #e2e8f0;
      font-weight: 600;
      letter-spacing: 2px;
      text-transform: uppercase;
      text-shadow: 0px 2px 10px rgba(0, 0, 0, 0.7);
    }

    .watermark-container {
      font-size: 28px;
      color: rgba(255, 255, 255, 0.65);
      font-weight: 400;
      letter-spacing: 1px;
      text-shadow: 0px 2px 10px rgba(0, 0, 0, 0.7);
    }
  </style>
</head>
<body>
  <div class="canvas-container">
    ${isForegroundOnly ? `<div class="overlay-layer"></div>` : ''}
    <div class="content-layer">
      <div class="branding-container">${escapeHtml(brandingText)}</div>
      
      <div class="content-container">
        <div class="quote-text ${langClass}">${escapeHtml(data.text)}</div>
      </div>
      
      <div class="watermark-container">${escapeHtml(watermarkText)}</div>
    </div>
  </div>
</body>
</html>
  `;
}
