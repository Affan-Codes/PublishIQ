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
  errorCode?: string | number;
}

export interface RefreshTokenResult {
  accessToken: string;
  expiresInSeconds: number;
  refreshToken?: string;
}

export interface GeneratedContentData {
  text: string;
  imageUrl?: string | null;
  videoUrl?: string | null;
  caption?: string | null;
  hashtags?: any;
  privacyStatus?: string;
}

export interface PlatformConnectionData {
  accessTokenEnc: Uint8Array;
  refreshTokenEnc: Uint8Array;
  expiresAt: Date;
  externalAccountId?: string | null;
  displayName?: string | null;
}

export interface PublishingAdapter {
  readonly platform: Platform;
  validate(content: GeneratedContentData): PlatformLimitViolation[];
  publish(content: GeneratedContentData, connection: PlatformConnectionData, options?: { privacyStatus?: string }): Promise<PublishResult>;
  checkHealth?(accessToken: string): Promise<boolean>;
  refreshToken?(refreshToken: string): Promise<RefreshTokenResult>;
}

export default PublishingAdapter;
