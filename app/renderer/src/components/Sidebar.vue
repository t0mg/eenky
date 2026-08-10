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
          v-for="file in usedFiles" 
          :key="file.id + '-' + getFilename(file)"
          class="file-item"
          :class="{ active: projectStore.activeInkFile === file, unsaved: file.hasUnsavedChanges }"
          @click="selectFile(file)"
          @dblclick="startRename(file)"
          @contextmenu.prevent="showFileContextMenu(file, $event)"
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
            @click.stop
          />
          <span v-else class="filename">{{ getFilename(file) }}</span>
          <span v-if="file.hasUnsavedChanges && renamingFile !== file" class="unsaved-indicator">•</span>
        </div>
      </div>
      
      <div v-if="unusedFiles.length > 0" class="sidebar-header unused-header">
        <span class="title">Unused Files</span>
      </div>
      <div v-if="unusedFiles.length > 0" class="file-list unused-list">
        <div 
          v-for="file in unusedFiles" 
          :key="file.id + '-' + getFilename(file)"
          class="file-item unused-item"
          :class="{ active: projectStore.activeInkFile === file, unsaved: file.hasUnsavedChanges }"
          @click="selectFile(file)"
          @dblclick="startRename(file)"
          @contextmenu.prevent="showFileContextMenu(file, $event)"
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
            @click.stop
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
    
    <!-- Custom Context Menu for Files -->
    <div 
      v-if="contextMenu.visible" 
      class="context-menu" 
      :style="{ top: contextMenu.y + 'px', left: contextMenu.x + 'px' }"
      @click.stop
    >
      <div class="context-menu-item" @click="contextMenuAction('rename')">Rename</div>
      <div class="context-menu-item delete" @click="contextMenuAction('delete')">Delete</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
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

const usedFiles = computed(() => projectStore.files.filter(f => !f.isUnused));
const unusedFiles = computed(() => projectStore.files.filter(f => f.isUnused));

const contextMenu = ref({ visible: false, x: 0, y: 0, file: null });

const hideContextMenu = () => {
  contextMenu.value.visible = false;
};

const showFileContextMenu = (file, event) => {
  contextMenu.value = {
    visible: true,
    x: event.clientX,
    y: event.clientY,
    file: file
  };
};

const contextMenuAction = async (action) => {
  const file = contextMenu.value.file;
  hideContextMenu();
  if (!file) return;
  
  if (action === 'rename') {
    startRename(file);
  } else if (action === 'delete') {
    if (file === projectStore.mainInkFile) {
      alert("Cannot delete the main ink file.");
      return;
    }
    if (confirm(`Are you sure you want to delete ${file.relPath}? This cannot be undone.`)) {
      try {
        await window.api.fs.unlink(file.absolutePath);
        projectStore.removeFile(file.id);
        // Also remove include statement if present
        const mainFile = projectStore.mainInkFile;
        if (mainFile) {
          const escapedPath = file.relPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(`^(\\s*INCLUDE\\s+)${escapedPath}(\\s*)$`, 'gm');
          if (regex.test(mainFile.content)) {
            const newContent = mainFile.content.replace(regex, '');
            ProjectController.updateFileContent(mainFile, newContent);
          }
        }
      } catch (err) {
        alert("Failed to delete file: " + err);
      }
    }
  }
};

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
  
  if (newName && newName !== file.relPath) {
    // Validate filename against common invalid characters (< > : " / \ | ? *)
    const invalidChars = /[<>:"/\\|?*]/;
    if (invalidChars.test(newName)) {
      alert('Invalid file name. Names cannot contain the following characters: < > : " / \\ | ? *');
      return; // Do not clear renamingFile so user can fix it
    }
    renamingFile.value = null; // Exit rename mode
    await ProjectController.renameFile(file, newName);
  } else {
    renamingFile.value = null;
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
  window.addEventListener('click', hideContextMenu);
  LiveCompiler.events.selectIssue = selectIssue;
});

onUnmounted(() => {
  window.removeEventListener('focus-new-include', addFile);
  window.removeEventListener('click', hideContextMenu);
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
  background-color: var(--hover-bg, rgba(0, 0, 0, 0.05));
}

/* Context Menu */
.context-menu {
  position: fixed;
  background: var(--bg-color, #ffffff);
  border: 1px solid var(--border-color, #d0d0d0);
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
  z-index: 1000;
  min-width: 120px;
  padding: 4px 0;
  font-size: calc(13px * var(--zoom-factor, 1));
}

.context-menu-item {
  padding: 8px 16px;
  cursor: pointer;
  color: var(--text-color, #333);
}

.context-menu-item:hover {
  background-color: var(--hover-bg, rgba(0, 0, 0, 0.05));
}

.context-menu-item.delete {
  color: var(--error-color, #d32f2f);
}

.context-menu-item.delete:hover {
  background-color: rgba(211, 47, 47, 0.1);
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
