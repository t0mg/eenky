<template>
  <div id="app-container">
    <Toolbar v-if="projectStore.mainInkFile && uiStore.showToolbar" />
    <div id="main-content" v-if="projectStore.mainInkFile" @mousemove="onMouseMove" @mouseup="onMouseUp" @mouseleave="onMouseUp">
      <Sidebar :style="{ width: uiStore.sidebarWidth + 'px' }" v-if="uiStore.showFileBrowser || uiStore.showKnotBrowser" />
      <div class="resizer" v-if="uiStore.showFileBrowser || uiStore.showKnotBrowser" @mousedown="startResizeSidebar"></div>
      
      <Editor style="flex: 1" />
      
      <div class="resizer" v-show="uiStore.showSimulator" @mousedown="startResizeSimulator"></div>
      <Simulator v-show="uiStore.showSimulator" :style="{ width: uiStore.simulatorWidth + 'px' }" />
    </div>
    <div id="home-view" v-else>
      <div class="home-hero">
        <!-- <img src="/about/icon256.png" alt="Inky Logo" class="logo" /> -->
        <h1>Welcome to eenky</h1>
        <p><em>A work in progress child of inkle's Inky</em></p>
        <div class="actions">
          <button @click="createNewProject" class="primary-btn">New Project</button>
          <button @click="openProject" class="secondary-btn">Open Project...</button>
          <button @click="openDeviceManager" class="secondary-btn">
            <span class="material-symbols-outlined">usb</span>
            Device Manager
          </button>
        </div>
      </div>
    </div>
    <GotoAnything />
    <Modals />
  </div>
</template>

<script setup>
import { onMounted, watch, ref } from 'vue';
import { useUiStore } from './stores/uiStore';
import { useProjectStore } from './stores/projectStore';
import Toolbar from './components/Toolbar.vue';
import Sidebar from './components/Sidebar.vue';
import Editor from './components/Editor.vue';
import Simulator from './components/Simulator.vue';
import Modals from './components/Modals.vue';
import GotoAnything from './components/GotoAnything.vue';
import { ProjectController } from './core/projectController.js';
import { LiveCompiler } from './core/liveCompiler.js';

const uiStore = useUiStore();
const projectStore = useProjectStore();

// Panel resizing state
const isResizingSidebar = ref(false);
const isResizingSimulator = ref(false);

const startResizeSidebar = () => { isResizingSidebar.value = true; };
const startResizeSimulator = () => { isResizingSimulator.value = true; };

const onMouseMove = (e) => {
  if (isResizingSidebar.value) {
    const newWidth = Math.max(150, Math.min(e.clientX, window.innerWidth - 300));
    uiStore.setSidebarWidth(newWidth);
  } else if (isResizingSimulator.value) {
    const newWidth = Math.max(200, Math.min(window.innerWidth - e.clientX, window.innerWidth - 300));
    uiStore.setSimulatorWidth(newWidth);
  }
};

const onMouseUp = () => {
  isResizingSidebar.value = false;
  isResizingSimulator.value = false;
};

watch([() => projectStore.mainInkFile, () => projectStore.hasUnsavedChanges], async ([newFile, hasUnsaved]) => {
  if (newFile) {
    const bn = newFile.relPath ? await window.api.path.basename(newFile.relPath) : 'Untitled';
    const star = hasUnsaved ? '*' : '';
    document.title = `${bn}${star} - eenky`;
  } else {
    document.title = 'eenky';
  }
}, { immediate: true });

const updateAppMenuState = () => {
  if (window.api && window.api.send) {
    window.api.send('app-state-changed', { 
      isHome: !projectStore.mainInkFile,
      hasUnsavedChanges: projectStore.hasUnsavedChanges
    });
  }
};

const createNewProject = () => {
  ProjectController.loadProject();
};

const openProject = async () => {
  if (window.api && window.api.invoke) {
    const result = await window.api.invoke("eenk:open-file-dialog", {
      properties: ['openFile'],
      filters: [
          { name: 'Ink files', extensions: ['ink'] }
      ]
    });
    if (result && result.filePaths && result.filePaths.length > 0) {
      ProjectController.loadProject(result.filePaths[0]);
    }
  }
};

const openDeviceManager = () => {
  if (window.api && window.api.invoke) {
    window.api.invoke('eenk:open-device-management');
  }
};

onMounted(() => {
  ProjectController.init();

  document.body.className = uiStore.theme;

  if (window.api && window.api.onShowModal) {
    window.api.onShowModal((type, data) => {
      uiStore.openModal(type, data);
    });
  }

  if (window.api && window.api.receive) {
    window.api.receive('change-theme', (theme) => {
      uiStore.setTheme(theme);
    });
    window.api.receive('set-autocomplete-disabled', (disabled) => {
      uiStore.setAutoCompleteDisabled(disabled);
    });
    window.api.receive('toggle-toolbar', (show) => {
      uiStore.setShowToolbar(show);
    });
    window.api.receive('toggle-file-browser', (show) => {
      uiStore.setShowFileBrowser(show);
    });
    window.api.receive('toggle-knot-browser', (show) => {
      uiStore.setShowKnotBrowser(show);
    });
    window.api.receive('toggle-preview', (show) => {
      uiStore.showSimulator = show;
    });
    window.api.receive('toggle-line-wrap', (wrap) => {
      uiStore.setLineWrap(wrap);
    });
    window.api.receive('zoom', (zoom) => {
      uiStore.setZoom(zoom);
    });
    window.api.receive('keyboard-shortcuts', () => {
      uiStore.openModal('shortcuts');
    });
    window.api.receive('project-stats', () => {
      uiStore.openModal('stats');
    });
    window.api.receive('project-new-include', () => {
      uiStore.setShowFileBrowser(true);
      setTimeout(() => {
        const customEvent = new Event('focus-new-include');
        window.dispatchEvent(customEvent);
      }, 50);
    });
    window.api.receive('eenk:open-device-management', () => {
      // Handled by main process directly opening window
    });
  }

  // Initial menu state
  updateAppMenuState();
});

watch([() => projectStore.mainInkFile, () => projectStore.hasUnsavedChanges], () => {
  updateAppMenuState();
});
</script>

<style>
/* Base global styles handled in style.css */
#app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
}

#main-content {
  display: flex;
  flex: 1;
  overflow: hidden;
}

#home-view {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  background-color: var(--bg-color);
  color: var(--text-color);
}

.home-hero {
  text-align: center;
}

.home-hero .logo {
  width: 120px;
  margin-bottom: 20px;
}

.actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  margin-top: 24px;
}

.resizer {
  width: 6px;
  cursor: col-resize;
  background-color: transparent;
  transition: background-color 0.2s;
  z-index: 10;
}

.resizer:hover, .resizer:active {
  background-color: var(--border-color);
}
</style>
