import { setActivePinia, createPinia } from 'pinia';
import { useProjectStore } from '../stores/projectStore';
import { ProjectController } from '../core/projectController';
import { LiveCompiler } from '../core/liveCompiler';
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../core/liveCompiler', () => ({
  LiveCompiler: {
    setProject: vi.fn(),
    needsRecompile: vi.fn(),
    setEdited: vi.fn(),
    reload: vi.fn()
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
    expect(window.api.send).toHaveBeenCalledWith('main-file-saved', '/path/to/main.ink');
  });

  it('saves all dirty files in the project including includes', async () => {
    const store = useProjectStore();
    await ProjectController.loadProject('/path/to/main.ink');

    const mainFile = store.mainInkFile;
    mainFile.content = 'Main modified';

    const includeFile = ProjectController.createFile('/path/to/chapter1.ink', false);
    includeFile.relPath = 'chapter1.ink';
    includeFile.content = 'Include modified';
    store.addFile(includeFile);

    expect(store.hasUnsavedChanges).toBe(true);

    window.api.send.mockClear();
    const result = await ProjectController.saveAll();

    expect(result).toBe(true);
    expect(window.api.fs.writeFile).toHaveBeenCalledWith(
      '/path/to/main.ink',
      'Main modified',
      'utf8'
    );
    expect(window.api.fs.writeFile).toHaveBeenCalledWith(
      '/path/to/chapter1.ink',
      'Include modified',
      'utf8'
    );

    expect(mainFile.hasUnsavedChanges).toBe(false);
    expect(includeFile.hasUnsavedChanges).toBe(false);
    expect(store.hasUnsavedChanges).toBe(false);

    // main-file-saved should be sent for main file but NOT for include file
    expect(window.api.send).toHaveBeenCalledWith('main-file-saved', '/path/to/main.ink');
    expect(window.api.send).not.toHaveBeenCalledWith('main-file-saved', '/path/to/chapter1.ink');
  });

  it('correctly resolves relative paths for newly added includes on save', async () => {
    const store = useProjectStore();
    await ProjectController.loadProject('/path/to/main.ink');

    const newInclude = ProjectController.addNewInclude(store.mainInkFile, 'subfolder/story.ink');
    newInclude.content = 'New include content';

    expect(newInclude.hasUnsavedChanges).toBe(true);

    await ProjectController.saveAll();

    expect(window.api.fs.writeFile).toHaveBeenCalledWith(
      '/path/to/subfolder/story.ink',
      'New include content',
      'utf8'
    );
    expect(newInclude.hasUnsavedChanges).toBe(false);
  });
});
