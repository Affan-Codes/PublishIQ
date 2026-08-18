import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { renderDefaultQuoteTemplate } from '../templates/DefaultQuoteTemplate.js';

describe('Background Rendering & Foreground Plate Template Tests (MQA-01, MQA-02)', () => {
  it('renders classic solid black layout when layer is full (no background asset configured)', () => {
    const html = renderDefaultQuoteTemplate({
      text: 'Do what you can, with what you have, where you are.',
      language: 'English',
      branding: 'PUBLISHIQ',
      watermark: '@quotes',
      layer: 'full',
    });

    assert.match(html, /background-color:\s*#000000/);
    assert.match(html, /class="quote-text\s*"/);
    assert.match(html, /PUBLISHIQ/);
    assert.match(html, /@quotes/);
    assert.doesNotMatch(html, /class="background-layer"/);
    assert.doesNotMatch(html, /class="overlay-layer"/);
  });

  it('renders transparent foreground plate with scrim overlay when layer is foreground', () => {
    const html = renderDefaultQuoteTemplate({
      text: 'Simplicity is the soul of efficiency.',
      language: 'English',
      branding: 'PUBLISHIQ',
      watermark: '@quotes',
      layer: 'foreground',
    });

    // Verify transparent body and structural layers
    assert.match(html, /background-color:\s*transparent/);
    assert.match(html, /<div class="canvas-container">/);
    assert.match(html, /<div class="overlay-layer"><\/div>/);
    assert.match(html, /<div class="content-layer">/);
    assert.doesNotMatch(html, /class="background-layer"/);

    // Verify foreground text is inside content layer
    assert.match(html, /Simplicity is the soul of efficiency/);
    assert.match(html, /PUBLISHIQ/);
    assert.match(html, /@quotes/);
  });

  it('handles Hindi and Urdu typography classes in foreground plate mode', () => {
    const hindiHtml = renderDefaultQuoteTemplate({
      text: 'कर्म ही पूजा है।',
      language: 'Hindi',
      layer: 'foreground',
    });
    assert.match(hindiHtml, /class="quote-text\s+lang-hindi"/);

    const urduHtml = renderDefaultQuoteTemplate({
      text: 'علم بڑی دولت ہے۔',
      language: 'Urdu',
      layer: 'foreground',
    });
    assert.match(urduHtml, /class="quote-text\s+lang-urdu"/);
    assert.match(urduHtml, /direction:\s*rtl/);
  });
});
