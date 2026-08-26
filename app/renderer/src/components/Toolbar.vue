<template>
  <div id="toolbar" :class="{ 'is-mac': isMac && !uiStore.isFullscreen }">
    <div class="left-actions">
      <button @click="toggleFileBrowser" title="Toggle File Browser" class="toolbar-btn" :class="{ active: uiStore.showFileBrowser }">
        <span class="material-symbols-outlined">folder</span>
      </button>
      <button @click="toggleKnotBrowser" title="Toggle Knot Browser" class="toolbar-btn" :class="{ active: uiStore.showKnotBrowser }">
        <span class="material-symbols-outlined">account_tree</span>
      </button>
      <button @click="goBack" title="Go Back" class="toolbar-btn" :disabled="uiStore.jumpHistory.length === 0" :class="{ disabled: uiStore.jumpHistory.length === 0 }">
        <span class="material-symbols-outlined">arrow_back</span>
      </button>
    </div>
    
    <div class="center-actions">
      <span v-if="projectStore.compilerBusy" class="material-symbols-outlined busy-spinner">hourglass_empty</span>
    </div>

    <div class="right-actions">
      <button @click="compile" title="Compile" class="toolbar-btn">
        <span class="material-symbols-outlined">build</span>
      </button>
      <button @click="launchSimulator" title="Run in external simulator" class="toolbar-btn">
        <span class="material-symbols-outlined">document_scanner</span>
      </button>
      <button @click="exportJson" title="Export JSON" class="toolbar-btn">
        <span class="material-symbols-outlined">file_json</span>
      </button>
      <button @click="exportWeb" title="Export for Web" class="toolbar-btn">
        <span class="material-symbols-outlined">language</span>
      </button>
      <button @click="exportJS" title="Export story.js only" class="toolbar-btn">
        <span class="material-symbols-outlined">javascript</span>
      </button>
      <button @click="toggleTheme" title="Toggle Theme" class="toolbar-btn">
        <span class="material-symbols-outlined">
          {{ uiStore.theme === 'dark' ? 'dark_mode' : (uiStore.theme === 'light' ? 'light_mode' : 'light_mode_auto') }}
        </span>
      </button>
      <button @click="toggleSimulator" title="Toggle Preview Panel" class="toolbar-btn" :class="{ active: uiStore.showSimulator }">
        <span class="material-symbols-outlined">right_panel_close</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import { useUiStore } from '../stores/uiStore';
import { useProjectStore } from '../stores/projectStore';
import { LiveCompiler } from '../core/liveCompiler.js';
import { ProjectController } from '../core/projectController.js';

const uiStore = useUiStore();
const projectStore = useProjectStore();

const isMac = window.api && window.api.platform === 'darwin';

const saveAllFiles = async () => {
  return await ProjectController.saveAll();
};

const checkAndSave = async (actionName) => {
  if (projectStore.hasUnsavedChanges) {
    const confirmed = await uiStore.confirm({
      title: 'Unsaved Changes',
      message: `You have unsaved changes. Would you like to save them before ${actionName}?`,
      okText: 'Save & Continue',
      cancelText: 'Cancel'
    });
    if (confirmed) {
      const saved = await saveAllFiles();
      if (!saved) {
        await uiStore.alert({ title: 'Save Failed', message: 'Failed to save all files. Action aborted.', isError: true });
        return false;
      }
    } else {
      return false; // User cancelled
    }
  }
  return true;
};

const runCompilation = async () => {
  if (!await checkAndSave('compiling')) return;
  ProjectController.exportProject('eenk');
};

const runSimulation = async () => {
  if (!await checkAndSave('running the simulator')) return;
  
  if (!projectStore.mainInkFile) {
    await uiStore.alert({ title: 'No Project', message: 'No ink project loaded.' });
    return;
  }
  const inkPath = projectStore.mainInkFile.absolutePath;
  if (!inkPath) {
    await uiStore.alert({ title: 'Unsaved Project', message: 'Please save your project first.' });
    return;
  }
  try {
    projectStore.compilerBusy = true;
    const result = await window.api.invoke('eenk:compile', inkPath, { isTemp: true });
    if (result.warnings && result.warnings.length > 0) {
      await uiStore.alert({ title: 'Compilation Warnings', message: result.warnings.join('\n\n') });
    }
    const simResult = await window.api.invoke('eenk:sim-launch', result.binFile);
    if (!simResult.ok) {
      await uiStore.alert({ title: 'Simulator Error', message: simResult.error, isError: true });
    }
  } catch (e) {
    await uiStore.alert({ title: 'Simulation Failed', message: String(e), isError: true });
  } finally {
    projectStore.compilerBusy = false;
  }
};

onMounted(() => {
  if (window.api && window.api.receive) {
    window.api.receive('eenk:trigger-compile', runCompilation);
    window.api.receive('eenk:launch-simulator', runSimulation);
    window.api.receive('eenk:sim-exited', ({ code, signal, error } = {}) => {
      if (code !== 0 && code !== null && code !== undefined) {
        uiStore.alert({
          title: 'Simulator Error',
          message: error || `Simulator exited with error code ${code}${signal ? ` (${signal})` : ''}`,
          isError: true
        });
      }
    });
  }
});

const compile = runCompilation;
const launchSimulator = runSimulation;

const toggleSimulator = () => {
  const nextState = !uiStore.showSimulator;
  if (window.api && window.api.invoke) {
    window.api.invoke('set-view-setting', 'showPreview', nextState);
  }
  uiStore.showSimulator = nextState;
};

const toggleFileBrowser = () => {
  const nextState = !uiStore.showFileBrowser;
  if (window.api && window.api.invoke) {
    window.api.invoke('set-view-setting', 'showFileBrowser', nextState);
  }
  uiStore.showFileBrowser = nextState;
};

const toggleKnotBrowser = () => {
  const nextState = !uiStore.showKnotBrowser;
  if (window.api && window.api.invoke) {
    window.api.invoke('set-view-setting', 'showKnotBrowser', nextState);
  }
  uiStore.showKnotBrowser = nextState;
};

const goBack = () => {
  if (uiStore.jumpHistory.length > 0) {
    window.dispatchEvent(new CustomEvent('editor-go-back'));
  }
};

const toggleTheme = () => {
  // Cycle: light -> dark -> os (system) -> light
  const current = uiStore.theme;
  let nextTheme = 'light';
  if (current === 'light') nextTheme = 'dark';
  else if (current === 'dark') nextTheme = 'system';
  
  if (window.api && window.api.invoke) {
    window.api.invoke('change-theme', nextTheme);
  } else {
    uiStore.setTheme(nextTheme);
  }
};

const exportJson = () => ProjectController.exportProject('json');
const exportWeb = () => ProjectController.exportProject('web');
const exportJS = () => ProjectController.exportProject('js');
</script>

<style scoped>
#toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 48px;
  background-color: var(--toolbar-bg, #f5f5f5);
  border-bottom: 1px solid var(--border-color, #e0e0e0);
  padding: 0 16px;
  user-select: none;
  -webkit-app-region: drag;
}

#toolbar.is-mac {
  padding-left: 80px;
}

.left-actions, .center-actions, .right-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toolbar-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--text-color, #333);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  line-height: 28px;
  border: 2px solid transparent;
  -webkit-app-region: no-drag;
}

.toolbar-btn:hover {
  border: 2px solid var(--border-color);
  background-color: var(--hover-bg, rgba(0, 0, 0, 0.05));
}

.toolbar-btn.active {
  color: var(--primary-color, #1976d2);
}

.toolbar-btn.disabled {
  color: var(--text-muted, #888);
  cursor: default;
}

.toolbar-btn.disabled:hover {
  border: 2px solid transparent;
  background-color: transparent;
}

.material-symbols-outlined {
  font-size: 20px;
}

.busy-spinner {
  font-size: 18px;
  margin: 0px;
  color: var(--text-muted, #888);
  /* The hourglass doesn't necessarily need to spin, but we can add a pulse or spin if we want */
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% { opacity: 0.5; }
  50% { opacity: 1; }
  100% { opacity: 0.5; }
}

/* Dark mode specific overrides handled by CSS variables in style.css */
</style>
