export interface TemplateRenderData {
  text: string;
  language: 'English' | 'Hindi' | 'Urdu';
  branding?: string | undefined;
  watermark?: string | undefined;
  fontFamily?: string | undefined;
  theme?: 'dark' | 'light' | 'gradient' | undefined;
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

  const brandingText = data.branding || 'PUBLISHIQ';
  const watermarkText = data.watermark || '@publishiq';
  const fontFamily = data.fontFamily ? `'${data.fontFamily}', 'Poppins', sans-serif` : "'Poppins', sans-serif";

  return `
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
      font-family: ${fontFamily};
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
    <div class="quote-text ${langClass}">${escapeHtml(data.text)}</div>
  </div>
  
  <div class="watermark-container">${escapeHtml(watermarkText)}</div>
</body>
</html>
  `;
}
