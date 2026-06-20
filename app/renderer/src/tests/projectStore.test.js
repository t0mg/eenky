import { setActivePinia, createPinia } from 'pinia';
import { useProjectStore } from '../stores/projectStore';
import { useUiStore } from '../stores/uiStore';
import { describe, it, expect, beforeEach } from 'vitest';

describe('Project Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('initializes with empty state', () => {
    const store = useProjectStore();
    expect(store.files).toEqual([]);
    expect(store.mainInkFile).toBeNull();
    expect(store.activeInkFile).toBeNull();
  });

  it('sets project info and switches ui view', () => {
    const store = useProjectStore();
    const uiStore = useUiStore();
    
    store.setProjectInfo({
      files: [{ id: 1, relPath: 'main.ink' }],
      mainInkFile: { id: 1 },
      instructionPrefix: '//'
    });

    expect(store.files.length).toBe(1);
    expect(store.mainInkFile.id).toBe(1);
    expect(uiStore.activeView).toBe('editor');
  });

  it('sets active file correctly', () => {
    const store = useProjectStore();
    const file1 = { id: 1, isActive: false };
    const file2 = { id: 2, isActive: false };
    
    store.setActiveFile(file1);
    expect(store.activeInkFile).toEqual(file1);
    expect(file1.isActive).toBe(true);

    store.setActiveFile(file2);
    expect(store.activeInkFile).toEqual(file2);
    expect(file1.isActive).toBe(false);
    expect(file2.isActive).toBe(true);
  });
});
