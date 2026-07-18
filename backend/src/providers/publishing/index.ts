import { Platform } from '@prisma/client';
import { PublishingAdapter } from './publishing.interface.js';
import youtubeAdapter from './youtube.provider.js';
import instagramAdapter from './instagram.provider.js';
import facebookAdapter from './facebook.provider.js';

export * from './publishing.interface.js';
export { youtubeAdapter, instagramAdapter, facebookAdapter };

export function getPublishingAdapter(platform: Platform): PublishingAdapter {
  switch (platform) {
    case Platform.YouTube:
      return youtubeAdapter;
    case Platform.Instagram:
      return instagramAdapter;
    case Platform.Facebook:
      return facebookAdapter;
    default:
      throw new Error(`Unsupported publishing platform: ${platform}`);
  }
}
