import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFrom, mockStorageFrom } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockStorageFrom: vi.fn(),
}));

vi.mock('../../lib/supabaseClient', () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: mockFrom,
    storage: {
      from: mockStorageFrom,
    },
  },
}));

import { deleteGalleryImage } from '../galleries';

describe('deleteGalleryImage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not throw when gallery image id is missing from the current record', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table !== 'galleries') {
        throw new Error(`Unexpected table: ${table}`);
      }

      return {
        select: () => ({
          eq: () => ({
            single: async () => ({
              data: {
                id: 'gallery-1',
                images: [
                  { id: 'real-image-id', url: 'https://cdn.example.com/gallery/real-image.jpg', uploadedAt: '2024-01-01T00:00:00.000Z' },
                ],
              },
              error: null as null,
            }),
          }),
        }),
      };
    });

    await expect(deleteGalleryImage('gallery-1', 'missing-image-id')).resolves.toBeUndefined();
  });
});
