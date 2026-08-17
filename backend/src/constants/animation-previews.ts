import { AnimationPreset } from '../services/video.service.js';

export const SAMPLE_PREVIEW_TEXT = 'Your quote appears here.';
export const SAMPLE_PREVIEW_BRANDING = 'PUBLISHIQ';
export const SAMPLE_PREVIEW_WATERMARK = '@publishiq';
export const SAMPLE_PREVIEW_DURATION_SECONDS = 5;
export const SAMPLE_PREVIEW_BACKGROUND_URL =
  'https://images.unsplash.com/photo-1518791841217-8f162f1e1131?auto=format&fit=crop&w=1080&h=1920&q=80';
export const SAMPLE_PREVIEW_AUDIO_URL =
  'https://res.cloudinary.com/rabbitcloud/video/upload/v1786362985/publishiq/music/default_inspiring_acoustic.mp3';

/**
 * Default/fallback Cloudinary URLs for animation presets if not yet seeded in SystemConfiguration.
 */
export const DEFAULT_ANIMATION_PREVIEW_URLS: Record<Exclude<AnimationPreset, 'None'>, string> = {
  SlowZoomIn: 'https://res.cloudinary.com/rabbitcloud/video/upload/v1786952994/publishiq/animation-previews/animation_preview_slowzoomin_1786952900121_render.mp4',
  SlowZoomOut: 'https://res.cloudinary.com/rabbitcloud/video/upload/v1786953080/publishiq/animation-previews/animation_preview_slowzoomout_1786952995878_render.mp4',
  PanLeft: 'https://res.cloudinary.com/rabbitcloud/video/upload/v1786953148/publishiq/animation-previews/animation_preview_panleft_1786953074419_render.mp4',
  PanRight: 'https://res.cloudinary.com/rabbitcloud/video/upload/v1786953209/publishiq/animation-previews/animation_preview_panright_1786953142302_render.mp4',
  PanUp: 'https://res.cloudinary.com/rabbitcloud/video/upload/v1786953272/publishiq/animation-previews/animation_preview_panup_1786953203136_render.mp4',
  PanDown: 'https://res.cloudinary.com/rabbitcloud/video/upload/v1786953332/publishiq/animation-previews/animation_preview_pandown_1786953267034_render.mp4',
};
