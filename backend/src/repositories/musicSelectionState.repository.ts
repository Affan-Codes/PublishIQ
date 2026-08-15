import { prisma } from '../database/db.js';
import { MusicSelectionState } from '@prisma/client';

export const musicSelectionStateRepository = {
  async getLastSelected(
    workspaceId: string,
    mood: string,
    genre: string
  ): Promise<MusicSelectionState | null> {
    return prisma.musicSelectionState.findUnique({
      where: {
        workspaceId_mood_genre: {
          workspaceId,
          mood,
          genre,
        },
      },
    });
  },

  async upsertLastSelected(
    workspaceId: string,
    mood: string,
    genre: string,
    lastSelectedAssetId: string
  ): Promise<MusicSelectionState> {
    return prisma.musicSelectionState.upsert({
      where: {
        workspaceId_mood_genre: {
          workspaceId,
          mood,
          genre,
        },
      },
      update: {
        lastSelectedAssetId,
      },
      create: {
        workspaceId,
        mood,
        genre,
        lastSelectedAssetId,
      },
    });
  },
};

export default musicSelectionStateRepository;
