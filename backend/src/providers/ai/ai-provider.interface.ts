export interface PromptVersionData {
  body: string;
  versionNumber: number;
}

export interface StructuredAIResponse {
  text: string;
  metadata?: Record<string, any>;
}

export interface AIProviderAdapter {
  generate(
    prompt: PromptVersionData,
    variables: Record<string, unknown>,
    responseSchema?: any
  ): Promise<StructuredAIResponse>;
}
export default AIProviderAdapter;
