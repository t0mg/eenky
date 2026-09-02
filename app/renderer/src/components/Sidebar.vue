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

    <!-- Auto-Player Issues Panel -->
    <div class="auto-player-panel" v-if="projectStore.autoPlayerEnabled">
      <div class="sidebar-header auto-player-header">
        <div class="header-left">
          <span class="title">Auto-Player</span>
          <span class="status-badge" :class="projectStore.autoPlayerStatus">
            {{ autoPlayerStatusText }}
          </span>
        </div>
        <div class="header-actions">
          <button 
            class="icon-btn" 
            title="Restart Fuzzer"
            @click="restartAutoPlayer"
          >
            <span class="material-symbols-outlined">restart_alt</span>
          </button>
        </div>
      </div>

      <div class="auto-player-body">
        <div v-if="projectStore.autoPlayerIssues.length === 0" class="auto-player-msg">
          <span v-if="projectStore.autoPlayerStatus === 'running'">Fuzzing story paths ({{ projectStore.autoPlayerStats.runsCompleted.toLocaleString() }} runs)...</span>
          <span v-else-if="projectStore.autoPlayerStats.runsCompleted > 0">No issues found across {{ projectStore.autoPlayerStats.runsCompleted.toLocaleString() }} runs.</span>
          <span v-else class="muted">Waiting for story compilation...</span>
        </div>
        <div v-else class="issue-list auto-player-issue-list">
          <div 
            v-for="issue in projectStore.autoPlayerIssues" 
            :key="issue.id"
            class="issue-item auto-player-issue-item"
            :class="issue.type"
            @click="selectAutoPlayerIssue(issue)"
            title="Click to replay this run in JS Preview"
          >
            <span class="material-symbols-outlined issue-icon" :class="issue.type">
              {{ getIssueIcon(issue.type) }}
            </span>
            <div class="issue-details">
              <div class="issue-top-row">
                <span class="issue-type-tag" :class="issue.type">{{ getIssueLabel(issue.type) }}</span>
                <span class="occurrence-badge">{{ issue.turnCount }} turns &bull; {{ issue.occurrenceCount || 1 }}x</span>
              </div>
              <span class="issue-file">{{ issue.knotOrPath }}</span>
              <span class="issue-message">{{ issue.message }}</span>
            </div>
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
import { AutoPlayer } from '../core/autoPlayer.js';

const uiStore = useUiStore();
const projectStore = useProjectStore();

const restartAutoPlayer = () => {
  AutoPlayer.restart();
};

const selectAutoPlayerIssue = (issue) => {
  AutoPlayer.replayIssue(issue);
};

const autoPlayerStatusText = computed(() => {
  if (!projectStore.autoPlayerEnabled) return 'Paused';
  const status = projectStore.autoPlayerStatus;
  const runs = projectStore.autoPlayerStats?.runsCompleted || 0;
  const issues = projectStore.autoPlayerIssues?.length || 0;

  if (status === 'running') {
    return runs > 0 ? `Running (${runs.toLocaleString()})` : 'Running';
  }
  if (status === 'complete') {
    return issues > 0 ? `${issues} Found` : 'Clean';
  }
  if (status === 'paused') return 'Paused';
  return runs > 0 ? `${runs.toLocaleString()} runs` : 'Idle';
});

const getIssueIcon = (type) => {
  switch (type) {
    case 'runtime_error': return 'error';
    case 'loose_end': return 'call_split';
    case 'infinite_loop': return 'sync_problem';
    case 'outlier': return 'query_stats';
    case 'checkpoint_budget': return 'sd_card_alert';
    default: return 'report_problem';
  }
};

const getIssueLabel = (type) => {
  switch (type) {
    case 'runtime_error': return 'Runtime Error';
    case 'loose_end': return 'Loose End';
    case 'infinite_loop': return 'Infinite Loop';
    case 'outlier': return 'Statistical Outlier';
    case 'checkpoint_budget': return 'Memory Warning';
    default: return 'Anomaly';
  }
};

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
      await uiStore.alert({ title: 'Cannot Delete', message: 'Cannot delete the main ink file.', isError: true });
      return;
    }
    const confirmed = await uiStore.confirm({
      title: 'Delete File',
      message: `Are you sure you want to delete ${file.relPath}? This cannot be undone.`,
      okText: 'Delete',
      dangerous: true
    });
    if (confirmed) {
      try {
        if (file.absolutePath) {
          const exists = await window.api.fs.exists(file.absolutePath).catch(() => false);
          if (exists) {
            await window.api.fs.unlink(file.absolutePath).catch((err) => {
              if (err && (err.code === 'ENOENT' || String(err).includes('ENOENT'))) {
                return;
              }
              throw err;
            });
          }
        }
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
        await uiStore.alert({ title: 'Delete Failed', message: 'Failed to delete file: ' + err, isError: true });
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
      await uiStore.alert({
        title: 'Invalid Filename',
        message: 'Invalid file name. Names cannot contain the following characters: < > : " / \\ | ? *',
        isError: true
      });
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

/* Auto-Player Panel */
.auto-player-panel {
  border-top: 1px solid var(--border-color, #e0e0e0);
  max-height: 45%;
  display: flex;
  flex-direction: column;
}

.auto-player-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.status-badge {
  font-size: calc(10px * var(--zoom-factor, 1));
  padding: 1px 6px;
  font-weight: 500;
  text-transform: none;
  background-color: var(--hover-bg, rgba(0, 0, 0, 0.06));
  color: var(--text-muted, #777);
}

.status-badge.running {
  background-color: rgba(25, 118, 210, 0.12);
  color: #1976d2;
}

.status-badge.complete {
  background-color: rgba(76, 175, 80, 0.12);
  color: #388e3c;
}

.status-badge.paused {
  background-color: rgba(158, 158, 158, 0.12);
  color: #757575;
}

.auto-player-body {
  overflow-y: auto;
  flex: 1;
}

.auto-player-msg {
  padding: 12px;
  font-size: calc(12px * var(--zoom-factor, 1));
  color: var(--text-muted, #777);
  text-align: center;
  font-style: italic;
}

.auto-player-msg.muted {
  opacity: 0.7;
}

.auto-player-issue-item {
  position: relative;
}

.issue-top-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2px;
  gap: 6px;
}

.issue-type-tag {
  font-weight: 700;
  font-size: calc(11px * var(--zoom-factor, 1));
  text-transform: uppercase;
}

.issue-type-tag.runtime_error {
  color: var(--error-color, #d32f2f);
}

.issue-type-tag.loose_end {
  color: var(--warning-color, #f57c00);
}

.issue-type-tag.infinite_loop {
  color: #9c27b0;
}

.issue-type-tag.outlier {
  color: #0288d1;
}

.issue-type-tag.checkpoint_budget {
  color: #e65100;
}

.occurrence-badge {
  font-size: calc(10px * var(--zoom-factor, 1));
  color: var(--text-muted, #888);
  white-space: nowrap;
}

.issue-item .issue-icon.runtime_error {
  color: var(--error-color, #d32f2f);
}

.issue-item .issue-icon.loose_end {
  color: var(--warning-color, #f57c00);
}

.issue-item .issue-icon.infinite_loop {
  color: #9c27b0;
}

.issue-item .issue-icon.outlier {
  color: #0288d1;
}

.issue-item .issue-icon.checkpoint_budget {
  color: #e65100;
}
</style>
