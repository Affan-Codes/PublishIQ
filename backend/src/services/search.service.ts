import { searchRepository } from '../repositories/search.repository.js';

export const searchService = {
  async searchAll(workspaceId: string, query: string) {
    if (!query || !query.trim()) {
      return {
        channels: [],
        generatedContents: [],
        jobs: [],
        publishingRecords: [],
        assets: [],
        templates: [],
        prompts: [],
        contentProfiles: [],
      };
    }

    return searchRepository.searchAll(workspaceId, query.trim());
  },
};

export default searchService;
