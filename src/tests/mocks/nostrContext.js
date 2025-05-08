import { vi } from 'vitest';

// Define the mock function *before* the mock factory uses it.
export const mockFetchEvent = vi.fn();

vi.mock('../contexts/NostrContext.jsx', async (importOriginal) => {
  const original = await importOriginal();
  return {
    ...original,
    ndk: {
      ...(original.ndk || {}),
      fetchEvent: mockFetchEvent, // Override with the mock function
    }
  };
}); 