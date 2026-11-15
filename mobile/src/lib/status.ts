import { tokens } from '../design/tokens';
import {
  PipelineStage,
  PublishRecordStatus,
  HealthStatus,
  ConnectionStatus,
  ChannelStatus,
  AssetStatus,
  LicenseStatus,
} from '../types/domain';

export interface StatusStyle {
  label: string;
  bg: string;
  border: string;
  text: string;
}

/**
 * Returns badge styling and descriptive state for pipeline stages.
 */
export function getPipelineStageStatus(stage?: PipelineStage | string | null): StatusStyle & {
  isTerminal: boolean;
  isFailed: boolean;
  isRunning: boolean;
} {
  const s = stage || 'Draft';
  switch (s) {
    case 'Completed':
      return {
        label: 'Completed',
        bg: tokens.colors.successBgSubtle,
        border: tokens.colors.successBorderSubtle,
        text: tokens.colors.successLight,
        isTerminal: true,
        isFailed: false,
        isRunning: false,
      };
    case 'Queued':
      return {
        label: 'Ready (Queued)',
        bg: tokens.colors.successBgSubtle,
        border: tokens.colors.successBorderSubtle,
        text: tokens.colors.successLight,
        isTerminal: false,
        isFailed: false,
        isRunning: false,
      };
    case 'Failed':
      return {
        label: 'Failed',
        bg: tokens.colors.destructiveBgSubtle,
        border: tokens.colors.destructiveBorderSubtle,
        text: tokens.colors.destructiveText,
        isTerminal: true,
        isFailed: true,
        isRunning: false,
      };
    case 'Archived':
      return {
        label: 'Archived',
        bg: 'rgba(255, 255, 255, 0.05)',
        border: tokens.colors.border,
        text: tokens.colors.textMuted,
        isTerminal: true,
        isFailed: false,
        isRunning: false,
      };
    case 'Draft':
      return {
        label: 'Draft',
        bg: 'rgba(255, 255, 255, 0.05)',
        border: tokens.colors.border,
        text: tokens.colors.textSubtle,
        isTerminal: false,
        isFailed: false,
        isRunning: false,
      };
    default:
      // Active pipeline execution stages
      return {
        label: s,
        bg: tokens.colors.warningBgSubtle,
        border: tokens.colors.warningBorderSubtle,
        text: tokens.colors.warningLight,
        isTerminal: false,
        isFailed: false,
        isRunning: true,
      };
  }
}

/**
 * Publishing history status badge styling
 */
export function getPublishRecordStatus(status?: PublishRecordStatus | string | null): StatusStyle {
  if (status === 'Success') {
    return {
      label: 'Success',
      bg: tokens.colors.successBgSubtle,
      border: tokens.colors.successBorderSubtle,
      text: tokens.colors.successLight,
    };
  }
  return {
    label: 'Failed',
    bg: tokens.colors.destructiveBgSubtle,
    border: tokens.colors.destructiveBorderSubtle,
    text: tokens.colors.destructiveText,
  };
}

/**
 * Platform connection health status styling
 */
export function getConnectionHealthStatus(health?: HealthStatus | string | null): StatusStyle {
  switch (health) {
    case 'Healthy':
      return {
        label: 'Healthy',
        bg: tokens.colors.successBgSubtle,
        border: tokens.colors.successBorderSubtle,
        text: tokens.colors.successLight,
      };
    case 'Expired':
      return {
        label: 'Token Expired',
        bg: tokens.colors.destructiveBgSubtle,
        border: tokens.colors.destructiveBorderSubtle,
        text: tokens.colors.destructiveText,
      };
    case 'Unhealthy':
      return {
        label: 'Unhealthy',
        bg: tokens.colors.destructiveBgSubtle,
        border: tokens.colors.destructiveBorderSubtle,
        text: tokens.colors.destructiveText,
      };
    default:
      return {
        label: health || 'Unknown',
        bg: 'rgba(255, 255, 255, 0.05)',
        border: tokens.colors.border,
        text: tokens.colors.textSubtle,
      };
  }
}

/**
 * Platform connection enabled / disabled status styling
 */
export function getConnectionStatus(status?: ConnectionStatus | string | null): StatusStyle {
  if (status === 'Active') {
    return {
      label: 'Active',
      bg: tokens.colors.successBgSubtle,
      border: tokens.colors.successBorderSubtle,
      text: tokens.colors.successLight,
    };
  }
  return {
    label: 'Disabled',
    bg: 'rgba(255, 255, 255, 0.05)',
    border: tokens.colors.border,
    text: tokens.colors.textMuted,
  };
}

/**
 * Notification event severity derivation matching web NotificationsView
 */
export function getNotificationSeverity(eventType?: string | null): 'Error' | 'Warning' | 'Info' {
  const type = eventType || 'Notification';
  if (type.includes('Failed') || type.includes('Error')) {
    return 'Error';
  }
  if (type.includes('Approval') || type.includes('Warning')) {
    return 'Warning';
  }
  return 'Info';
}

/**
 * Notification severity styling
 */
export function getNotificationSeverityStyle(severity: 'Error' | 'Warning' | 'Info'): StatusStyle {
  switch (severity) {
    case 'Error':
      return {
        label: 'Error',
        bg: tokens.colors.destructiveBgSubtle,
        border: tokens.colors.destructiveBorderSubtle,
        text: tokens.colors.destructiveText,
      };
    case 'Warning':
      return {
        label: 'Warning',
        bg: tokens.colors.warningBgSubtle,
        border: tokens.colors.warningBorderSubtle,
        text: tokens.colors.warningLight,
      };
    case 'Info':
      return {
        label: 'Info',
        bg: tokens.colors.primaryBgSubtle,
        border: tokens.colors.primaryBorderSubtle,
        text: tokens.colors.primaryLighter,
      };
  }
}

/**
 * Channel status styling
 */
export function getChannelStatus(status?: ChannelStatus | string | null): StatusStyle {
  if (status === 'Active') {
    return {
      label: 'Active',
      bg: tokens.colors.successBgSubtle,
      border: tokens.colors.successBorderSubtle,
      text: tokens.colors.successLight,
    };
  }
  return {
    label: 'Disabled',
    bg: 'rgba(255, 255, 255, 0.05)',
    border: tokens.colors.border,
    text: tokens.colors.textMuted,
  };
}

/**
 * Asset status styling
 */
export function getAssetStatus(status?: AssetStatus | string | null): StatusStyle {
  if (status === 'Active') {
    return {
      label: 'Active',
      bg: tokens.colors.successBgSubtle,
      border: tokens.colors.successBorderSubtle,
      text: tokens.colors.successLight,
    };
  }
  return {
    label: 'Disabled',
    bg: 'rgba(255, 255, 255, 0.05)',
    border: tokens.colors.border,
    text: tokens.colors.textMuted,
  };
}

/**
 * Asset license confirmation status styling
 */
export function getLicenseStatus(status?: LicenseStatus | string | null): StatusStyle {
  if (status === 'Confirmed') {
    return {
      label: 'Confirmed',
      bg: tokens.colors.successBgSubtle,
      border: tokens.colors.successBorderSubtle,
      text: tokens.colors.successLight,
    };
  }
  return {
    label: 'Unconfirmed',
    bg: tokens.colors.warningBgSubtle,
    border: tokens.colors.warningBorderSubtle,
    text: tokens.colors.warningLight,
  };
}

/**
 * Check action eligibility for queue review items
 */
export function getQueueEligibility(stage?: PipelineStage | string | null) {
  const s = stage || '';
  return {
    canReview: s === 'Queued',
    canRetry: s === 'Failed',
    canCancel: s !== 'Completed' && s !== 'Published' && s !== 'Failed' && s !== 'Archived',
  };
}

/**
 * Channel automation mode badge styling
 */
export function getAutomationModeStatus(mode?: string | null): StatusStyle {
  switch (mode) {
    case 'Automatic':
      return {
        label: 'Automatic',
        bg: tokens.colors.primaryBgSubtle,
        border: tokens.colors.primaryBorderSubtle,
        text: tokens.colors.primaryLight,
      };
    case 'Hybrid':
      return {
        label: 'Hybrid',
        bg: tokens.colors.warningBgSubtle,
        border: tokens.colors.warningBorderSubtle,
        text: tokens.colors.warningLight,
      };
    default:
      return {
        label: 'Manual',
        bg: 'rgba(255, 255, 255, 0.05)',
        border: tokens.colors.border,
        text: tokens.colors.textSubtle,
      };
  }
}

/**
 * Generic status badge variant resolver
 */
export function getStatusBadge(status?: string | null): { label: string; variant: 'success' | 'neutral' } {
  if (status === 'Active') {
    return { label: 'Active', variant: 'success' };
  }
  return { label: status || 'Disabled', variant: 'neutral' };
}
