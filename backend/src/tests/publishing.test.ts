import test from 'node:test';
import assert from 'node:assert';
import { youtubeAdapter } from '../providers/publishing/youtube.provider.js';
import { instagramAdapter } from '../providers/publishing/instagram.provider.js';
import { facebookAdapter } from '../providers/publishing/facebook.provider.js';

test('Platform Publishing Adapter Validation Tests', async (t) => {
  await t.test('YouTube Adapter validation rules', () => {
    // Should fail if videoUrl is missing
    const missingVideo = youtubeAdapter.validate({
      text: 'Hello world',
      imageUrl: '/media/img.png',
      videoUrl: null,
      caption: 'Wisdom shorts',
      hashtags: [],
    });
    assert.strictEqual(missingVideo.length, 1);
    assert.strictEqual(missingVideo[0]?.field, 'videoUrl');

    // Should fail if title/caption is > 100 chars
    const longTitle = youtubeAdapter.validate({
      text: 'Hello world',
      imageUrl: null,
      videoUrl: '/media/video.mp4',
      caption: 'a'.repeat(101),
      hashtags: [],
    });
    assert.strictEqual(longTitle.length, 1);
    assert.strictEqual(longTitle[0]?.field, 'title');

    // Should pass valid video
    const valid = youtubeAdapter.validate({
      text: 'Hello world',
      imageUrl: null,
      videoUrl: '/media/video.mp4',
      caption: 'Valid Short Title',
      hashtags: ['shorts'],
    });
    assert.strictEqual(valid.length, 0);
  });

  await t.test('Instagram Adapter validation rules', () => {
    // Should fail if both images and videos are missing
    const noMedia = instagramAdapter.validate({
      text: 'Hello world',
      imageUrl: null,
      videoUrl: null,
      caption: 'Test post',
      hashtags: [],
    });
    assert.strictEqual(noMedia.length, 1);
    assert.strictEqual(noMedia[0]?.field, 'media');

    // Should fail if caption > 2200 chars
    const longCaption = instagramAdapter.validate({
      text: 'Hello world',
      imageUrl: '/media/img.png',
      videoUrl: null,
      caption: 'a'.repeat(2201),
      hashtags: [],
    });
    assert.strictEqual(longCaption.length, 1);
    assert.strictEqual(longCaption[0]?.field, 'caption');
  });

  await t.test('Facebook Adapter validation rules', () => {
    // Should pass valid post
    const valid = facebookAdapter.validate({
      text: 'Hello Facebook Page!',
      imageUrl: '/media/image.png',
      videoUrl: null,
      caption: 'Facebook Update',
      hashtags: [],
    });
    assert.strictEqual(valid.length, 0);
  });
});
