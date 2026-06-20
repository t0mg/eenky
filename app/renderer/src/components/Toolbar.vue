<template>
  <div id="toolbar">
    <div class="left-actions">
      <button @click="toggleFileBrowser" title="Toggle File Browser" class="toolbar-btn" :class="{ active: uiStore.showFileBrowser }">
        <span class="material-symbols-outlined">folder</span>
      </button>
      <button @click="toggleKnotBrowser" title="Toggle Knot Browser" class="toolbar-btn" :class="{ active: uiStore.showKnotBrowser }">
        <span class="material-symbols-outlined">account_tree</span>
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

const runCompilation = async () => {
  ProjectController.exportProject('eenk');
};

const runSimulation = async () => {
  if (!projectStore.mainInkFile) {
    alert("No ink project loaded.");
    return;
  }
  const inkPath = projectStore.mainInkFile.absolutePath;
  if (!inkPath) {
    alert("Please save your project first.");
    return;
  }
  try {
    projectStore.compilerBusy = true;
    const result = await window.api.invoke('eenk:compile', inkPath);
    const simResult = await window.api.invoke('eenk:sim-launch', result.binFile);
    if (!simResult.ok) {
      alert('Simulator error: ' + simResult.error);
    }
  } catch (e) {
    alert('Simulation failed: ' + e);
  } finally {
    projectStore.compilerBusy = false;
  }
};

onMounted(() => {
  if (window.api && window.api.receive) {
    window.api.receive('eenk:trigger-compile', runCompilation);
    window.api.receive('eenk:launch-simulator', runSimulation);
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
  border-radius: 4px;
  transition: background-color 0.2s, color 0.2s;
  line-height: 28px;
}

.toolbar-btn:hover {
  background-color: var(--hover-bg, rgba(0, 0, 0, 0.05));
}

.toolbar-btn.active {
  background-color: var(--active-bg, rgba(0, 0, 0, 0.1));
  color: var(--primary-color, #1976d2);
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
