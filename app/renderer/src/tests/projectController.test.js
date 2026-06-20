import { setActivePinia, createPinia } from 'pinia';
import { useProjectStore } from '../stores/projectStore';
import { ProjectController } from '../core/projectController';
import { LiveCompiler } from '../core/liveCompiler';
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../core/liveCompiler', () => ({
  LiveCompiler: {
    setProject: vi.fn(),
    needsRecompile: vi.fn()
  }
}));

describe('Project Controller', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('loads a project from a file path', async () => {
    const store = useProjectStore();
    
    await ProjectController.loadProject('/path/to/main.ink');

    // Store should be populated
    expect(store.files.length).toBe(1);
    expect(store.mainInkFile).toBeTruthy();
    expect(store.activeInkFile).toBeTruthy();
    expect(store.mainInkFile.absolutePath).toBe('/path/to/main.ink');
    
    // File content should be loaded using mocked window.api
    expect(store.mainInkFile.content).toBe('Once upon a time...');
    expect(store.mainInkFile.isLoading).toBe(false);

    // LiveCompiler should be notified
    expect(LiveCompiler.setProject).toHaveBeenCalled();
  });

  it('saves a file to disk', async () => {
    const store = useProjectStore();
    await ProjectController.loadProject('/path/to/main.ink');

    const file = store.mainInkFile;
    file.content = 'New Content!';

    await ProjectController.saveFile(file.id);

    expect(window.api.fs.writeFile).toHaveBeenCalledWith(
      '/path/to/main.ink',
      'New Content!',
      'utf8'
    );
    expect(file.hasUnsavedChanges).toBe(false);
  });
});
