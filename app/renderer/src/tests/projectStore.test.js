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

  describe('RNG Seed Management', () => {
    it('detects when in-script SEED_RANDOM is present in files', () => {
      const store = useProjectStore();
      expect(store.isScriptRngSeedLocked).toBe(false);

      // Commented out SEED_RANDOM should not lock
      store.files = [
        { id: 1, content: '// ~ SEED_RANDOM(42)\n* [Choice] -> END' },
        { id: 2, content: '/*\n  ~ SEED_RANDOM(99)\n*/\nHello' }
      ];
      expect(store.isScriptRngSeedLocked).toBe(false);

      // Active SEED_RANDOM in any file locks it
      store.files = [
        { id: 1, content: '// comment\n~ SEED_RANDOM(123)\nHello' }
      ];
      expect(store.isScriptRngSeedLocked).toBe(true);
    });

    it('detects when in-script SEED_RANDOM opcode srnd is in compiledStoryJson', () => {
      const store = useProjectStore();
      expect(store.isScriptRngSeedLocked).toBe(false);

      store.setCompiledStoryJson({ root: ['ev', 42, 'srnd', 'pop', '/ev'] });
      expect(store.isScriptRngSeedLocked).toBe(true);
    });

    it('manages currentRngSeed and rolls new random seed', () => {
      const store = useProjectStore();
      expect(store.currentRngSeed).toBeNull();

      store.setCurrentRngSeed(12345);
      expect(store.currentRngSeed).toBe(12345);

      const newSeed = store.rollNewRngSeed();
      expect(typeof newSeed).toBe('number');
      expect(newSeed).toBeGreaterThan(0);
      expect(store.currentRngSeed).toBe(newSeed);

      store.closeProject();
      expect(store.currentRngSeed).toBeNull();
    });
  });
});
