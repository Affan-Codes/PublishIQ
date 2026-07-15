import { Platform } from '@prisma/client';

export interface PlatformLimitViolation {
  field: string;
  message: string;
  limit?: number;
  actual?: number;
}

export interface PublishResult {
  success: boolean;
  externalId?: string;
  platformResponse?: Record<string, any>;
  errorMessage?: string;
}

export interface GeneratedContentData {
  text: string;
  imageUrl?: string | null;
  videoUrl?: string | null;
  caption?: string | null;
  hashtags?: any;
}

export interface PlatformConnectionData {
  accessTokenEnc: Uint8Array;
  refreshTokenEnc: Uint8Array;
  expiresAt: Date;
}

export interface PublishingAdapter {
  readonly platform: Platform;
  validate(content: GeneratedContentData): PlatformLimitViolation[];
  publish(content: GeneratedContentData, connection: PlatformConnectionData): Promise<PublishResult>;
}
export default PublishingAdapter;
