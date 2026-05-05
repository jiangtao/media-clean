import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
  },
}));

import {
  loadHasEnteredWorkspace,
  saveHasEnteredWorkspace,
} from './workspace-entry-storage';

describe('workspace-entry-storage', () => {
  beforeEach(() => {
    vi.mocked(AsyncStorage.getItem).mockReset();
    vi.mocked(AsyncStorage.setItem).mockReset();
  });

  it('loads false when the workspace entry flag is missing', async () => {
    vi.mocked(AsyncStorage.getItem).mockResolvedValueOnce(null);

    await expect(loadHasEnteredWorkspace()).resolves.toBe(false);
  });

  it('loads true when the workspace entry flag is persisted', async () => {
    vi.mocked(AsyncStorage.getItem).mockResolvedValueOnce('true');

    await expect(loadHasEnteredWorkspace()).resolves.toBe(true);
  });

  it('persists the workspace entry flag as a stable boolean string', async () => {
    await saveHasEnteredWorkspace(true);
    await saveHasEnteredWorkspace(false);

    expect(AsyncStorage.setItem).toHaveBeenNthCalledWith(
      1,
      'app-cleaner/has-entered-workspace',
      'true',
    );
    expect(AsyncStorage.setItem).toHaveBeenNthCalledWith(
      2,
      'app-cleaner/has-entered-workspace',
      'false',
    );
  });
});
