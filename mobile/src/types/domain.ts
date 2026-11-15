/**
 * Domain types mirrored exactly from backend contracts and Prisma schema.
 * Case-sensitive enums and DTO shapes.
 */

// ================= Enums =================

export type Role = 'Owner' | 'Administrator' | 'User';

export type Language = 'English' | 'Hindi' | 'Urdu' | 'HindiRoman' | 'UrduRoman';

export type AutomationMode = 'Manual' | 'Automatic' | 'Hybrid';

export type ChannelStatus = 'Active' | 'Disabled';

export type Platform = 'YouTube' | 'Instagram' | 'Facebook';

export type HealthStatus = 'Healthy' | 'Unhealthy' | 'Expired' | 'Unknown';

export type ConnectionStatus = 'Active' | 'Disabled';

export type JobType =
  | 'ContentPipeline'
  | 'Cleanup'
  | 'Archive'
  | 'RetryPublish'
  | 'TokenRefresh'
  | 'HealthCheck';

export type PipelineStage =
  | 'Draft'
  | 'Queued'
  | 'Running'
  | 'GeneratingContent'
  | 'Validating'
  | 'ResolvingBackground'
  | 'RenderingImage'
  | 'AttachingMusic'
  | 'RenderingVideo'
  | 'GeneratingCaption'
  | 'GeneratingHashtags'
  | 'Publishing'
  | 'Completed'
  | 'Failed'
  | 'Archived';

export type PublishStatus = 'Unpublished' | 'Published' | 'PublishFailed';

export type PublishRecordStatus = 'Success' | 'Failure';

export type AssetType = 'Background' | 'Font' | 'Music' | 'Logo' | 'Watermark' | 'Icon';

export type AssetStatus = 'Active' | 'Disabled';

export type LicenseStatus = 'Confirmed' | 'Unconfirmed';

export type PromptStatus = 'Draft' | 'Active' | 'Deprecated';

export type ContentTypeStatus = 'Active' | 'Disabled';

export type ContentProfileStatus = 'Active' | 'Disabled';

export type TemplateCategory =
  | 'CodeAnalogy'
  | 'MinimalQuote'
  | 'SplitStatement'
  | 'Terminal'
  | 'CodeBlock';

// ================= API Envelope Types =================

export interface ApiSuccess<T, M = Record<string, unknown>> {
  success: true;
  data: T;
  meta?: M;
}

export interface ApiFailure {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export type ApiResponse<T, M = Record<string, unknown>> = ApiSuccess<T, M> | ApiFailure;

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages?: number;
  unreadCount?: number;
}

// ================= Operator & Auth =================

export interface Operator {
  id: string;
  email: string;
  role: Role;
  workspaceId: string | null;
}

// ================= Core Models =================

export interface Workspace {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContentType {
  id: string;
  workspaceId: string;
  name: string;
  status: ContentTypeStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformConnection {
  id: string;
  workspaceId: string;
  platform: Platform;
  externalAccountId: string | null;
  displayName: string | null;
  expiresAt: string;
  scopes: string[];
  healthStatus: HealthStatus;
  status: ConnectionStatus;
  lastValidatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Channel {
  id: string;
  workspaceId: string;
  name: string;
  contentProfileId: string;
  automationMode: AutomationMode;
  status: ChannelStatus;
  scheduleCron: string;
  scheduleTimezone: string | null;
  scheduleType: string | null;
  scheduleConfig?: Record<string, unknown> | null;
  publishingConfiguration: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  contentProfile?: {
    id: string;
    name: string;
  };
  platformConnections?: Array<{
    platformConnectionId: string;
    platformConnection?: PlatformConnection;
  }>;
}

export interface PromptVersion {
  id: string;
  promptId: string;
  versionNumber: number;
  body: string;
  status: PromptStatus;
  notes: string | null;
  createdAt: string;
}

export interface Prompt {
  id: string;
  workspaceId: string;
  name: string;
  status: PromptStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  versions?: PromptVersion[];
}

export interface TemplateVersion {
  id: string;
  templateId: string;
  versionNumber: number;
  componentPath?: string | null;
  componentSource?: string | null;
  category?: TemplateCategory | null;
  definition?: Record<string, unknown> | null;
  sampleContent?: Record<string, unknown> | null;
  previewImageUrl?: string | null;
  status: PromptStatus;
  notes?: string | null;
  createdAt: string;
}

export interface Template {
  id: string;
  workspaceId: string;
  name: string;
  status: PromptStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  versions?: TemplateVersion[];
}

export interface Asset {
  id: string;
  workspaceId: string;
  type: AssetType;
  name: string;
  status: AssetStatus;
  filePath: string;
  metadata: Record<string, unknown>;
  licenseStatus: LicenseStatus | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContentProfile {
  id: string;
  workspaceId: string;
  name: string;
  notes: string | null;
  status: ContentProfileStatus;
  contentTypeId: string;
  promptVersionId: string;
  templateVersionId: string;
  language: Language;
  tone: string;
  writingStyle: string;
  promptVariables: Record<string, string | number | boolean>;
  brandingRules: {
    text?: string;
    position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
    color?: string;
    opacity?: number;
  };
  watermarkRules: {
    text?: string;
    position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
    opacity?: number;
  };
  captionStrategy: {
    template?: string;
    prefix?: string;
    suffix?: string;
  };
  hashtagStrategy: {
    tags?: string[];
    mode?: 'append' | 'prepend' | 'replace' | 'none';
  };
  musicSelectionRules: {
    mood?: string;
    genre?: string;
    tempo?: string;
    minDurationSeconds?: number;
    maxDurationSeconds?: number;
  };
  backgroundSelectionRules: {
    selectionMode?: 'Manual' | 'AI';
    manualAssetId?: string;
    mood?: string;
    style?: string;
    theme?: string;
    tags?: string[];
    orientation?: 'portrait' | 'landscape' | 'square';
  };
  renderingConfiguration: {
    animation?: {
      preset?:
        | 'None'
        | 'SlowZoomIn'
        | 'SlowZoomOut'
        | 'PanLeft'
        | 'PanRight'
        | 'PanUp'
        | 'PanDown';
    };
  };
  validationRules: {
    bannedWords?: string[];
    minLength?: number;
    maxLength?: number;
    strictProfanity?: boolean;
  };
  createdAt: string;
  updatedAt: string;
  contentType?: { id: string; name: string };
  promptVersion?: { id: string; versionNumber: number; prompt?: { name: string } };
  templateVersion?: { id: string; versionNumber: number; template?: { name: string } };
}

export interface Job {
  id: string;
  workspaceId: string;
  jobType: JobType;
  channelId: string | null;
  channel?: { id: string; name: string } | null;
  contentProfileId: string | null;
  contentProfile?: { id: string; name: string } | null;
  configSnapshot?: Record<string, unknown> | null;
  pipelineStage: PipelineStage | null;
  maintenanceState?: string | null;
  failureStage: string | null;
  failureReason: string | null;
  retryCount: number;
  failedAt: string | null;
  generatedText: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  caption: string | null;
  hashtags: string[] | Record<string, unknown> | null;
  isDryRun: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GeneratedContent {
  id: string;
  workspaceId: string;
  jobId: string;
  job?: Job;
  sourceGeneratedContentId: string | null;
  contentProfileId: string;
  contentProfile?: ContentProfile;
  promptVersionId: string;
  templateVersionId: string;
  language: Language;
  contentTypeId: string;
  text: string;
  blocks?: Record<string, unknown> | null;
  textHash?: string | null;
  metadata?: Record<string, unknown> | null;
  imageUrl: string | null;
  videoUrl: string | null;
  mediaDeletedAt: string | null;
  caption: string | null;
  hashtags: string[] | Record<string, unknown> | null;
  publishStatus: PublishStatus;
  createdAt: string;
  updatedAt: string;
}

export interface DomainEvent {
  id: string;
  workspaceId: string;
  jobId: string | null;
  type: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface Notification {
  id: string;
  workspaceId: string;
  domainEventId: string;
  domainEvent?: DomainEvent;
  message: string;
  readAt: string | null;
  createdAt: string;
}

export interface PublishingRecord {
  id: string;
  workspaceId: string;
  jobId: string;
  job?: Job;
  channelId: string;
  channel?: Channel;
  platformConnectionId: string;
  platformConnection?: PlatformConnection;
  contentTypeSnapshot: string;
  status: PublishRecordStatus;
  platformResponse?: Record<string, unknown> | null;
  publishedAt: string;
  platform: Platform;
  generatedContentId: string | null;
  generatedContent?: GeneratedContent | null;
  publishedUrl: string | null;
  platformPostId: string | null;
  duration?: number | null;
  retries: number;
  providerMetadata?: Record<string, unknown> | null;
  errorDetails: string | null;
}

export interface DashboardStats {
  counters: {
    totalChannels: number;
    totalGenerations: number;
    totalPublishSuccess: number;
    totalPublishFailure: number;
    successRate: number;
  };
  queues: {
    active: number;
    waiting: number;
    delayed: number;
    failed: number;
    completed: number;
  };
  connections: Array<{
    platform: Platform;
    healthStatus: HealthStatus;
    status: ConnectionStatus;
    displayName?: string;
  }>;
  failedJobs: Array<{
    id: string;
    failedAt: string | null;
    failureReason: string | null;
    failureStage: string | null;
    retryCount: number;
    channel?: { name: string } | null;
  }>;
  recentPublications: Array<{
    id: string;
    platform: Platform;
    status: PublishRecordStatus;
    publishedAt: string;
    channel?: { name: string } | null;
    generatedContent?: { text: string } | null;
  }>;
  health: {
    database: string;
    valkey: string;
    worker: {
      status: string;
      count: number;
    };
  };
}

export interface QueueStats {
  total: number;
  waiting: number;
  active: number;
  delayed: number;
  failed: number;
  archived: number;
  byType: Record<string, number>;
}

export interface UpcomingSchedulerRun {
  key: string;
  name: string;
  cron: string;
  next: string | null;
  tz?: string;
  channelId: string;
  channelName: string;
}

export interface SearchResults {
  channels?: Channel[];
  generatedContents?: GeneratedContent[];
  jobs?: Job[];
  publishingRecords?: PublishingRecord[];
  assets?: Asset[];
  templates?: Template[];
  prompts?: Prompt[];
  contentProfiles?: ContentProfile[];
}
