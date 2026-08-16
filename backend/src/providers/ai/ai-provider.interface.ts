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
  selectBestBackgroundMatch?(
    catalog: Array<{ id: string; name: string; mood?: string; style?: string; theme?: string; orientation?: string; tags?: string[] }>,
    contentContext: { quote: string; language: string; tone: string; style: string }
  ): Promise<string | null>;
}
export default AIProviderAdapter;
