<template>
  <div id="sidebar">
    <div class="panel file-panel" v-if="uiStore.showFileBrowser">
      <div class="sidebar-header">
        <span class="title">Project Files</span>
        <button @click="addFile" class="icon-btn" title="Add new include">
          <span class="material-symbols-outlined">add</span>
        </button>
      </div>
      
      <div class="file-list">
        <div 
          v-for="file in projectStore.files" 
          :key="file.id + '-' + getFilename(file)"
          class="file-item"
          :class="{ active: projectStore.activeInkFile === file, unsaved: file.hasUnsavedChanges }"
          @click="selectFile(file)"
          @dblclick="startRename(file)"
        >
          <span class="material-symbols-outlined file-icon">description</span>
          <input 
            v-if="renamingFile === file"
            v-model="renameInput"
            @blur="commitRename(file)"
            @keyup.enter="commitRename(file)"
            @keyup.esc="cancelRename"
            ref="renameInputRefs"
            class="rename-input"
            onClick="event.stopPropagation()"
          />
          <span v-else class="filename">{{ getFilename(file) }}</span>
          <span v-if="file.hasUnsavedChanges && renamingFile !== file" class="unsaved-indicator">•</span>
        </div>
      </div>
    </div>

    <KnotBrowser v-if="uiStore.showKnotBrowser" />

    <div class="issues-panel" v-if="projectStore.issues.length > 0">
      <div class="sidebar-header issues-header">
        <span class="title">Issues ({{ projectStore.issues.length }})</span>
      </div>
      <div class="issue-list">
        <div 
          v-for="(issue, index) in projectStore.issues" 
          :key="index"
          class="issue-item"
          :class="issue.type"
          @click="selectIssue(issue)"
        >
          <span class="material-symbols-outlined issue-icon">
            {{ issue.type === 'error' ? 'error' : 'warning' }}
          </span>
          <div class="issue-details">
            <span class="issue-file">{{ issue.filename }}:{{ issue.lineNumber }}</span>
            <span class="issue-message">{{ issue.message }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue';
import { useUiStore } from '../stores/uiStore';
import { useProjectStore } from '../stores/projectStore';
import KnotBrowser from './KnotBrowser.vue';
import { ProjectController } from '../core/projectController.js';
import { LiveCompiler } from '../core/liveCompiler';

const uiStore = useUiStore();
const projectStore = useProjectStore();

const renamingFile = ref(null);
const renameInput = ref("");
const renameInputRefs = ref([]);

const getFilename = (file) => {
  return file.relPath ? file.relPath.split(/[/\\]/).pop() : "Untitled.ink";
};

const selectFile = (file) => {
  if (renamingFile.value === file) return;
  projectStore.setActiveFile(file);
};

const startRename = async (file) => {
  if (file === projectStore.mainInkFile) return; // Cannot rename main ink file yet
  renamingFile.value = file;
  renameInput.value = file.relPath;
  await nextTick();
  if (renameInputRefs.value && renameInputRefs.value.length > 0) {
    const input = renameInputRefs.value.find(el => el && el.value === file.relPath);
    if (input) {
      input.focus();
      // Select filename without extension
      const lastDot = file.relPath.lastIndexOf('.');
      if (lastDot > 0) {
        input.setSelectionRange(0, lastDot);
      } else {
        input.select();
      }
    }
  }
};

const commitRename = async (file) => {
  if (!renamingFile.value) return; // Already committed/cancelled
  
  const newName = renameInput.value.trim();
  renamingFile.value = null; // Exit rename mode
  
  if (newName && newName !== file.relPath) {
    await ProjectController.renameFile(file, newName);
  }
};

const cancelRename = () => {
  renamingFile.value = null;
};

const addFile = async () => {
  let i = 1;
  let name = "new_file.ink";
  while (projectStore.files.find(f => getFilename(f) === name)) {
    i++;
    name = `new_file_${i}.ink`;
  }
  
  if (projectStore.mainInkFile) {
    const newFile = ProjectController.addNewInclude(projectStore.mainInkFile, name);
    if (newFile) {
      // Small timeout to allow DOM to render the new file
      setTimeout(() => {
        startRename(newFile);
      }, 50);
    }
  }
};

const selectIssue = (issue) => {
  const file = projectStore.files.find(f => getFilename(f) === issue.filename);
  if (file) {
    projectStore.setActiveFile(file);
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('editor-jump-to-line', { detail: { line: issue.lineNumber - 1 } }));
    }, 50);
  }
};

onMounted(() => {
  window.addEventListener('focus-new-include', addFile);
  LiveCompiler.events.selectIssue = selectIssue;
});

onUnmounted(() => {
  window.removeEventListener('focus-new-include', addFile);
  if (LiveCompiler.events.selectIssue === selectIssue) {
    LiveCompiler.events.selectIssue = null;
  }
});
</script>

<style scoped>
#sidebar {
  width: 250px;
  background-color: var(--sidebar-bg, #fafafa);
  border-right: 1px solid var(--border-color, #e0e0e0);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  font-weight: 600;
  font-size: calc(12px * var(--zoom-factor, 1));
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-muted, #777);
  border-bottom: 1px solid var(--border-color, #e0e0e0);
}

.icon-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: inherit;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2px;
  border-radius: 4px;
}

.icon-btn:hover {
  background-color: var(--hover-bg, rgba(0,0,0,0.05));
  color: var(--text-color, #333);
}

.file-list {
  flex: 1;
  overflow-y: auto;
}

.file-item {
  display: flex;
  align-items: center;
  padding: 6px 12px;
  cursor: pointer;
  user-select: none;
  font-size: calc(14px * var(--zoom-factor, 1));
  color: var(--text-color, #333);
}

.file-item:hover {
  background-color: var(--hover-bg, rgba(0,0,0,0.05));
}

.file-item.active {
  background-color: var(--active-bg, rgba(25, 118, 210, 0.1));
  color: var(--primary-color, #1976d2);
  font-weight: 500;
}

.file-item.active .file-icon {
  color: var(--primary-color, #1976d2);
}

.file-icon {
  font-size: calc(18px * var(--zoom-factor, 1));
  margin-right: 8px;
  color: var(--text-muted, #888);
}

.unsaved-indicator {
  margin-left: auto;
  font-size: calc(18px * var(--zoom-factor, 1));
  line-height: 10px;
  color: var(--warning-color, #f57c00);
}

.issues-panel {
  border-top: 1px solid var(--border-color, #e0e0e0);
  max-height: 40%;
  display: flex;
  flex-direction: column;
}

.issue-list {
  overflow-y: auto;
}

.issue-item {
  display: flex;
  padding: 8px 12px;
  cursor: pointer;
  border-bottom: 1px solid var(--border-color, #e0e0e0);
  font-size: calc(12px * var(--zoom-factor, 1));
}

.issue-item:hover {
  background-color: var(--hover-bg, rgba(0,0,0,0.05));
}

.issue-icon {
  font-size: calc(16px * var(--zoom-factor, 1));
  margin-right: 8px;
  margin-top: 2px;
}

.issue-item.error .issue-icon {
  color: var(--error-color, #d32f2f);
}

.issue-item.warning .issue-icon {
  color: var(--warning-color, #f57c00);
}

.issue-details {
  display: flex;
  flex-direction: column;
}

.issue-file {
  font-weight: 600;
  margin-bottom: 2px;
  color: var(--text-color, #333);
}

.issue-message {
  color: var(--text-muted, #666);
  word-break: break-word;
}
</style>
