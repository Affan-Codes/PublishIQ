import { ContentProfile } from '@prisma/client';

/**
 * Creates a comprehensive snapshot of all behavioral ContentProfile fields
 * for persistent pinning on Job.configSnapshot at creation time.
 */
export function createContentProfileSnapshot(
  profile: Partial<ContentProfile> & { promptVersionId: string; templateVersionId: string },
  extra?: Record<string, any>
): Record<string, any> {
  const templateDefinition =
    (profile as any).templateVersion?.definition !== undefined
      ? (profile as any).templateVersion?.definition
      : extra?.templateDefinition;

  const snapshot: Record<string, any> = {
    promptVersionId: profile.promptVersionId,
    templateVersionId: profile.templateVersionId,
    language: profile.language,
    tone: profile.tone,
    writingStyle: profile.writingStyle,
    promptVariables: profile.promptVariables ?? {},
    brandingRules: profile.brandingRules ?? {},
    watermarkRules: profile.watermarkRules ?? {},
    captionStrategy: profile.captionStrategy ?? {},
    hashtagStrategy: profile.hashtagStrategy ?? {},
    musicSelectionRules: profile.musicSelectionRules ?? {},
    backgroundSelectionRules: profile.backgroundSelectionRules ?? {},
    renderingConfiguration: profile.renderingConfiguration ?? {},
    validationRules: profile.validationRules ?? {},
    ...extra,
  };

  if (templateDefinition !== undefined) {
    snapshot.templateDefinition = templateDefinition;
  }

  return snapshot;
}
