import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { renderDefaultQuoteTemplate } from '../templates/DefaultQuoteTemplate.js';

describe('Background Rendering & 3-Layer DefaultQuoteTemplate Tests', () => {
  it('renders classic solid black layout when backgroundImageUrl is undefined (backward compatibility)', () => {
    const html = renderDefaultQuoteTemplate({
      text: 'Do what you can, with what you have, where you are.',
      language: 'English',
      branding: 'PUBLISHIQ',
      watermark: '@quotes',
    });

    assert.match(html, /background-color:\s*#000000/);
    assert.match(html, /class="quote-text\s*"/);
    assert.match(html, /PUBLISHIQ/);
    assert.match(html, /@quotes/);
    assert.doesNotMatch(html, /class="background-layer"/);
    assert.doesNotMatch(html, /class="overlay-layer"/);
  });

  it('renders 3-layer composition when backgroundImageUrl is provided', () => {
    const bgUrl = 'https://res.cloudinary.com/demo/image/upload/v12345/nature_bg.jpg';
    const html = renderDefaultQuoteTemplate({
      text: 'Simplicity is the soul of efficiency.',
      language: 'English',
      branding: 'PUBLISHIQ',
      watermark: '@quotes',
      backgroundImageUrl: bgUrl,
    });

    // Verify 3 distinct structural layers
    assert.match(html, /<div class="canvas-container">/);
    assert.match(html, /<div class="background-layer"><\/div>/);
    assert.match(html, /<div class="overlay-layer"><\/div>/);
    assert.match(html, /<div class="content-layer">/);

    // Verify CSS styles for background cover and overlay gradient
    assert.match(html, /background-image:\s*url\('https:\/\/res\.cloudinary\.com\/demo\/image\/upload\/v12345\/nature_bg\.jpg'\)/);
    assert.match(html, /background-size:\s*cover/);
    assert.match(html, /background-position:\s*center/);
    assert.match(html, /linear-gradient\(180deg/);

    // Verify foreground text is inside content layer
    assert.match(html, /Simplicity is the soul of efficiency/);
    assert.match(html, /PUBLISHIQ/);
    assert.match(html, /@quotes/);
  });

  it('escapes quotes and special characters in backgroundImageUrl to prevent CSS breakout', () => {
    const maliciousUrl = "https://res.cloudinary.com/demo/image/upload/v1/test'); background-color: red; (";
    const html = renderDefaultQuoteTemplate({
      text: 'Security first.',
      language: 'English',
      backgroundImageUrl: maliciousUrl,
    });

    // Ensure single quotes and parentheses are escaped with backslashes
    assert.ok(html.includes("test\\'\\); background-color: red; \\("));
  });

  it('handles Hindi and Urdu typography classes in 3-layer mode', () => {
    const hindiHtml = renderDefaultQuoteTemplate({
      text: 'कर्म ही पूजा है।',
      language: 'Hindi',
      backgroundImageUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
    });
    assert.match(hindiHtml, /class="quote-text\s+lang-hindi"/);

    const urduHtml = renderDefaultQuoteTemplate({
      text: 'علم بڑی دولت ہے۔',
      language: 'Urdu',
      backgroundImageUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
    });
    assert.match(urduHtml, /class="quote-text\s+lang-urdu"/);
    assert.match(urduHtml, /direction:\s*rtl/);
  });
});
