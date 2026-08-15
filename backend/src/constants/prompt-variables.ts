export const SYSTEM_PROMPT_VARIABLES = ['contentType', 'language', 'tone', 'style'] as const;
export type SystemPromptVariable = typeof SYSTEM_PROMPT_VARIABLES[number];

/**
 * Extracts all unique {{placeholder}} token names from a prompt body.
 * Tokens are trimmed of inner whitespace and returned as a deduplicated array.
 */
export function extractPromptVariables(body: string): string[] {
  if (!body) return [];
  const matches = body.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g);
  const variables = new Set<string>();
  for (const match of matches) {
    if (match[1]) {
      variables.add(match[1].trim());
    }
  }
  return Array.from(variables);
}
