<template>
  <div 
    v-if="uiStore.modalState.isOpen" 
    class="modal-overlay" 
    @click.self="closeModal(uiStore.modalState.type === 'close-confirm' ? 'cancel' : false)" 
    @keydown="handleKeyDown" 
    tabindex="-1" 
    ref="overlay"
  >
    <div class="modal-content" ref="modalContent" role="dialog" aria-modal="true">
      
      <!-- Alert Modal -->
      <div v-if="uiStore.modalState.type === 'alert'" class="modal-body">
        <h2>{{ modalData.title || 'Notification' }}</h2>
        <div class="modal-message">
          <p v-for="(line, idx) in messageLines" :key="idx">{{ line }}</p>
        </div>
        <div class="modal-actions">
          <button @click="closeModal(true)" class="primary-btn">{{ modalData.okText || 'OK' }}</button>
        </div>
      </div>

      <!-- Confirm Modal -->
      <div v-else-if="uiStore.modalState.type === 'confirm'" class="modal-body">
        <h2>{{ modalData.title || 'Confirm' }}</h2>
        <div class="modal-message">
          <p v-for="(line, idx) in messageLines" :key="idx">{{ line }}</p>
        </div>
        <div class="modal-actions">
          <button @click="closeModal(false)" class="secondary-btn">{{ modalData.cancelText || 'Cancel' }}</button>
          <button @click="closeModal(true)" class="primary-btn" :class="{ 'danger-btn': modalData.dangerous }">{{ modalData.okText || 'OK' }}</button>
        </div>
      </div>

      <!-- Close Confirm Modal -->
      <div v-else-if="uiStore.modalState.type === 'close-confirm'" class="modal-body">
        <h2>{{ modalData.title || 'Unsaved Changes' }}</h2>
        <div class="modal-message">
          <p>You have unsaved changes in your project. Would you like to save them before closing?</p>
        </div>
        <div class="modal-actions close-confirm-actions">
          <button @click="closeModal('cancel')" class="secondary-btn">Cancel</button>
          <button @click="closeModal('dontsave')" class="secondary-btn">Don't Save</button>
          <button @click="closeModal('save')" class="primary-btn">Save</button>
        </div>
      </div>

      <!-- Issue Popup / Settings / About etc. -->
      <div v-else-if="uiStore.modalState.type === 'about'" class="modal-body about-modal">
        <div class="about-header">
          <h2>
            <img :src="'/about/icon256.png'" class="about-icon" alt="eenky icon" draggable="false" />
            eenky
          </h2>
          <p>a child of inkle's Inky</p>
        </div>
        <div class="about-versions" v-if="aboutData">
          <p v-if="aboutData.eenkyVersion">eenky v{{ aboutData.eenkyVersion }}</p>
          <p v-if="aboutData.inkVersion">Inky Compiler v{{ aboutData.inkVersion }}</p>
          <p v-if="aboutData.inkjsVersion">InkJS v{{ aboutData.inkjsVersion }}</p>
          <p v-if="aboutData.eenkVersion">eenk Compiler v{{ aboutData.eenkVersion }}</p>
          <p v-if="aboutData.eenkVersion">eenk Simulator v{{ aboutData.eenkVersion }}</p>
        </div>
        <button @click="closeModal(false)" class="primary-btn">Close</button>
      </div>

      <!-- Update Available Modal -->
      <div v-else-if="uiStore.modalState.type === 'update'" class="modal-body update-modal">
        <h2>Update Available</h2>
        <div class="update-banner">
          <p class="update-headline">
            A new version of <strong>eenky</strong> is available: <span class="update-version-tag">v{{ modalData.latestVersion }}</span>
          </p>
          <p class="update-current-version">
            You are currently running <strong>v{{ modalData.currentVersion }}</strong>
          </p>
        </div>

        <div v-if="modalData.releaseNotes" class="update-notes-container">
          <div class="update-notes-title">Release Notes</div>
          <div class="update-notes-content">{{ modalData.releaseNotes }}</div>
        </div>

        <div class="modal-actions update-actions">
          <button @click="skipVersion(modalData.latestVersion)" class="secondary-btn">Skip This Version</button>
          <div class="update-actions-right">
            <button @click="closeModal(false)" class="secondary-btn">Later</button>
            <button @click="downloadUpdate(modalData.releaseUrl)" class="primary-btn">Download from GitHub</button>
          </div>
        </div>
      </div>

      <div v-else-if="uiStore.modalState.type === 'shortcuts'" class="modal-body">
        <h2>Useful Keyboard Shortcuts</h2>
        <table class="shortcuts-table">
          <tbody>
          <tr><td>New Project</td><td>{{ ctrlCmd }} + N</td></tr>
          <tr><td>Save Project</td><td>{{ ctrlCmd }} + S</td></tr>
          <tr><td>Compile to eenk</td><td>{{ ctrlCmd }} + B</td></tr>
          <tr><td>Undo</td><td>{{ ctrlCmd }} + Z</td></tr>
          <tr><td>Redo</td><td>{{ ctrlCmd }} + Shift + Z</td></tr>
          <tr><td>Find / Replace</td><td>{{ ctrlCmd }} + F / H</td></tr>
          <tr><td>Go to Anything</td><td>{{ ctrlCmd }} + P</td></tr>
          <tr><td>Next Issue</td><td>{{ ctrlCmd }} + .</td></tr>
          <tr><td>Add watch expression</td><td>{{ ctrlCmd }} + W</td></tr>
          <tr><td>Rewind Story</td><td>{{ ctrlCmd }} + R</td></tr>
          <tr><td>Step Back Story</td><td>{{ ctrlCmd }} + [</td></tr>
          <tr><td>Zoom In / Out / Reset</td><td>{{ ctrlCmd }} + + / - / 0</td></tr>
          <tr><td>Word count and more</td><td>{{ ctrlCmd }} + Shift + C</td></tr>
          <tr><td>Toggle Auto-Player</td><td>{{ ctrlCmd }} + Shift + A</td></tr>
          <tr><td>Open Device Manager</td><td>{{ ctrlCmd }} + D</td></tr>
          <tr><td>Open Documentation</td><td>F1</td></tr>
          <tr><td>Keyboard Shortcuts</td><td>{{ ctrlCmd }} + K</td></tr>
          </tbody>
        </table>
        <button @click="closeModal(false)" class="primary-btn">Close</button>
      </div>

      <div v-else-if="uiStore.modalState.type === 'stats'" class="modal-body stats-modal-body">
        <h2>Word Count and Story Stats</h2>
        <div v-if="statsData" class="stats-container">
          <div class="stats-columns">
            <div class="stats-col">
              <p><strong>Words:</strong> {{ statsData.words }}</p>
              <br>
              <p><strong>Knots:</strong> {{ statsData.knots }}</p>
              <p><strong>Stitches:</strong> {{ statsData.stitches }}</p>
              <p><strong>Functions:</strong> {{ statsData.functions }}</p>
              <br>
              <p><strong>Choices:</strong> {{ statsData.choices }}</p>
              <p><strong>Gathers:</strong> {{ statsData.gathers }}</p>
              <p><strong>Diverts:</strong> {{ statsData.diverts }}</p>
            </div>

            <div class="stats-col">
              <template v-if="eenkStats">
                <p><strong>eenk Binary Size:</strong> {{ (eenkStats.totalFileSize / 1024).toFixed(1) }} KB ({{ eenkStats.totalFileSize.toLocaleString() }} bytes)</p>
                <br>
                <p><strong>Containers:</strong> {{ eenkStats.numContainers }}</p>
                <br>
                <p><strong>State Data Heap Budget:</strong> ~{{ (eenkStats.heapRequirement / 1024).toFixed(1) }} KB</p>
              </template>
              <template v-else-if="eenkStatsLoading">
                <p><em>Calculating eenk budget...</em></p>
              </template>
            </div>
          </div>
          <br>
          <p class="stats-disclaimer">Notes: Words should be accurate. Knots include functions. Gathers and diverts may include some implicitly added ones by the compiler, for example in weave. Diverts include END and DONE.</p>
        </div>
        <div v-else>
          <p>Calculating stats...</p>
        </div>
        <button @click="closeModal(false)" class="primary-btn">Close</button>
      </div>

      <!-- Checkpoints & Chapters Modal -->
      <div v-else-if="uiStore.modalState.type === 'checkpoints'" class="modal-body checkpoints-modal">
        <h2>Checkpoints &amp; Chapters</h2>
        
        <div class="checkpoints-subtitle-bar">
          <span class="checkpoints-runs-info">
            Encountered across <strong>{{ checkpointStats.runsCompleted.toLocaleString() }}</strong> {{ checkpointStats.runsCompleted === 1 ? 'run' : 'runs' }}
          </span>
          <div class="checkpoints-subtitle-right">
            <span v-if="projectStore.autoPlayerStatus === 'running'" class="status-badge running">
              Running
            </span>
            <div class="checkpoints-grouping-toggle">
              <span class="toggle-mode-label" :class="{ active: isKnotMode }" @click="isKnotMode = true">Knot</span>
              <label class="neubrutalist-switch">
                <input 
                  type="checkbox" 
                  :checked="!isKnotMode" 
                  @change="isKnotMode = !$event.target.checked" 
                  class="switch-input"
                  aria-label="Toggle grouping by Knot or Name"
                >
                <span class="switch-track">
                  <span class="switch-thumb"></span>
                </span>
              </label>
              <span class="toggle-mode-label" :class="{ active: !isKnotMode }" @click="isKnotMode = false">Name</span>
            </div>
          </div>
        </div>

        <div v-if="(isKnotMode ? checkpointStats.knotList : checkpointStats.list).length === 0" class="checkpoints-empty">
          <p>No checkpoints or chapters discovered yet.</p>
        </div>

        <div v-else class="checkpoints-chart-container">
          <div class="checkpoints-chart-list">
            <!-- Name Mode: Grouped by chapter name -->
            <template v-if="!isKnotMode">
              <div 
                v-for="item in checkpointStats.list" 
                :key="item.name" 
                class="checkpoint-chart-row"
                :class="{ 'is-unnamed': item.isUnnamed }"
              >
                <div class="checkpoint-row-header">
                  <span class="checkpoint-name" :title="item.name">{{ item.name }}</span>
                  <span class="checkpoint-stats-val">
                    <strong>{{ item.percentage }}%</strong>
                    <span class="checkpoint-count"> ({{ item.count.toLocaleString() }} {{ item.count === 1 ? 'run' : 'runs' }})</span>
                  </span>
                </div>
                <div class="checkpoint-bar-track">
                  <div 
                    class="checkpoint-bar-fill" 
                    :class="{ 'unnamed-bar': item.isUnnamed }"
                    :style="{ width: Math.max(item.percentage, 0.75) + '%' }"
                  ></div>
                </div>
              </div>
            </template>

            <!-- Knot Mode: Grouped by knot address, folding dynamic titles -->
            <template v-else>
              <div 
                v-for="item in checkpointStats.knotList" 
                :key="item.knot" 
                class="checkpoint-chart-row"
                :class="{ 'is-unnamed': item.isUnnamed }"
              >
                <div class="checkpoint-row-header">
                  <span class="checkpoint-name" :title="item.knot + ' ' + formatKnotTitles(item.titles, item.isUnnamed)">
                    <span class="knot-address">{{ item.knot }}</span>
                    <span class="checkpoint-knot-meta">{{ formatKnotTitles(item.titles, item.isUnnamed) }}</span>
                  </span>
                  <span class="checkpoint-stats-val">
                    <strong>{{ item.percentage }}%</strong>
                    <span class="checkpoint-count"> ({{ item.count.toLocaleString() }} {{ item.count === 1 ? 'run' : 'runs' }})</span>
                  </span>
                </div>
                <div class="checkpoint-bar-track">
                  <div 
                    class="checkpoint-bar-fill" 
                    :class="{ 'unnamed-bar': item.isUnnamed }"
                    :style="{ width: Math.max(item.percentage, 0.75) + '%' }"
                  ></div>
                </div>
              </div>
            </template>
          </div>
        </div>

        <div class="modal-actions">
          <button @click="closeModal(false)" class="primary-btn">Close</button>
        </div>
      </div>

      <div v-else class="modal-body">
        <h2>{{ uiStore.modalState.type }}</h2>
        <p>Not implemented yet.</p>
        <button @click="closeModal(false)" class="primary-btn">Close</button>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue';
import { useUiStore } from '../stores/uiStore';
import { useProjectStore } from '../stores/projectStore';
import { LiveCompiler } from '../core/liveCompiler';

const uiStore = useUiStore();
const projectStore = useProjectStore();
const overlay = ref(null);
const modalContent = ref(null);
const statsData = ref(null);
const eenkStats = ref(null);
const eenkStatsLoading = ref(false);
const aboutData = ref(null);
let previousActiveElement = null;

const modalData = computed(() => uiStore.modalState.data || {});
const messageLines = computed(() => {
  const msg = modalData.value.message || '';
  return msg.split('\n');
});

const isKnotMode = ref(false);

const checkpointStats = computed(() => {
  const stats = projectStore.autoPlayerStats || {};
  return {
    runsCompleted: stats.runsCompleted || 0,
    totalCount: stats.checkpointsDiscoveredCount || 0,
    namedCount: stats.namedCheckpointsCount || 0,
    unnamedCount: stats.unnamedCheckpointsCount || 0,
    list: stats.checkpointsDetails || [],
    knotList: stats.checkpointsByKnotDetails || []
  };
});

function formatKnotTitles(titles, isUnnamed) {
  if (isUnnamed || !titles || titles.length === 0) {
    return '(unnamed)';
  }
  if (titles.length <= 2) {
    return `(${titles.join(' / ')})`;
  }
  return `(${titles.slice(0, 2).join(' / ')} / +${titles.length - 2} more)`;
}

if (window.api && window.api.receive) {
  window.api.receive('show-about', (data) => {
    aboutData.value = data;
    uiStore.openModal('about');
  });
}

if (window.api && window.api.onUpdateAvailable) {
  window.api.onUpdateAvailable((data) => {
    uiStore.openModal('update', data);
  });
} else if (window.api && window.api.receive) {
  window.api.receive('update-available', (data) => {
    uiStore.openModal('update', data);
  });
}

const downloadUpdate = (url) => {
  if (url && window.api && window.api.openExternal) {
    window.api.openExternal(url);
  }
  closeModal(true);
};

const skipVersion = (version) => {
  if (version && window.api && window.api.skipUpdateVersion) {
    window.api.skipUpdateVersion(version);
  } else if (version && window.api && window.api.invoke) {
    window.api.invoke('eenky:skip-update-version', version);
  }
  closeModal(false);
};

const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
const ctrlCmd = isMac ? '⌘' : 'Ctrl';

const closeModal = (result = false) => {
  uiStore.closeModal(result);
};

const handleKeyDown = (e) => {
  if (!uiStore.modalState.isOpen) return;

  if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    const type = uiStore.modalState.type;
    closeModal(type === 'close-confirm' ? 'cancel' : false);
    return;
  }

  if (e.key === 'Tab') {
    if (!modalContent.value) return;
    const focusables = Array.from(
      modalContent.value.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
    ).filter(el => !el.disabled && el.offsetWidth > 0 && el.offsetHeight > 0);

    if (focusables.length === 0) {
      e.preventDefault();
      return;
    }

    const firstEl = focusables[0];
    const lastEl = focusables[focusables.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === firstEl || document.activeElement === overlay.value) {
        e.preventDefault();
        lastEl.focus();
      }
    } else {
      if (document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    }
  }
};

// Calculate stats and manage focus capture when modal opens/closes
watch(
  () => uiStore.modalState.isOpen,
  (isOpen) => {
    if (isOpen) {
      previousActiveElement = document.activeElement;
      if (uiStore.modalState.type === 'checkpoints') {
        isKnotMode.value = false;
      }
      if (uiStore.modalState.type === 'stats') {
        statsData.value = null;
        eenkStats.value = null;
        eenkStatsLoading.value = false;
        LiveCompiler.getStats((stats) => {
          statsData.value = stats;
        });
        if (projectStore.mainInkFile && projectStore.mainInkFile.absolutePath && window.api && window.api.invoke) {
          eenkStatsLoading.value = true;
          window.api.invoke('eenk:compile', projectStore.mainInkFile.absolutePath, { isTemp: true })
            .then(res => {
              eenkStats.value = res;
            })
            .catch(err => {
              console.warn('Could not calculate eenk stats:', err);
            })
            .finally(() => {
              eenkStatsLoading.value = false;
            });
        }
      }
      nextTick(() => {
        if (modalContent.value) {
          const primaryBtn = modalContent.value.querySelector('.primary-btn');
          const firstFocusable = modalContent.value.querySelector(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          if (primaryBtn) {
            primaryBtn.focus();
          } else if (firstFocusable) {
            firstFocusable.focus();
          } else if (overlay.value) {
            overlay.value.focus();
          }
        }
      });
    } else {
      if (previousActiveElement && typeof previousActiveElement.focus === 'function') {
        previousActiveElement.focus();
        previousActiveElement = null;
      }
    }
  }
);
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-image: var(--dither-bg);
  background-color: rgba(0, 0, 0, 0.45);
  backdrop-filter: none;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  outline: none;
}

.modal-content {
  background-color: var(--bg-color);
  color: var(--text-color);
  padding: 24px;
  border-radius: 0px;
  min-width: 320px;
  max-width: 550px;
  border: var(--border);
  box-shadow: var(--shadow-hard);
  font-family: var(--font-body);
}

.modal-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.modal-body h2 {
  font-size: 1.25rem;
  margin: -24px -24px 0;
  padding: 24px;
  background: var(--color-fg);
  color: var(--color-bg);
  font-family: var(--font-heading);
  font-weight: 700;
  text-transform: uppercase;
}

.modal-body.about-modal h2 {
  display: flex;
  align-items: center;
  justify-content: space-around;
  flex-direction: column;
}

.modal-message {
  padding: 8px 0;
  font-size: 0.95rem;
  line-height: 1.5;
  color: var(--text-color);
  max-height: 300px;
  overflow-y: auto;
}

.modal-message p {
  margin: 0 0 8px 0;
}

.modal-message p:last-child {
  margin-bottom: 0;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 8px;
}

.close-confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.primary-btn {
  align-self: flex-end;
}

.danger-btn {
  background-color: var(--error-color, #CC0000) !important;
  color: #ffffff !important;
}

.danger-btn:hover {
  background-color: #aa0000 !important;
}

.shortcuts-table {
  width: 100%;
  border-collapse: collapse;
}

.shortcuts-table td {
  padding: 4px 8px;
  border-bottom: 1px solid var(--border-color, #e0e0e0);
  font-size: 0.9em;
}

.shortcuts-table td:first-child {
  font-weight: 500;
}

.about-header {
  text-align: center;
}
.about-icon {
  width: 80px;
  margin-bottom: 8px;
}
.about-versions {
  text-align: center;
  font-family: monospace;
  color: var(--text-muted);
  user-select: all;
  font-weight: bold;
}
.about-versions p {
  margin: 4px 0;
}

.stats-columns {
  display: flex;
  gap: 32px;
}

.stats-col {
  flex: 1;
}

.stats-col p {
  margin: 0;
  line-height: 1.5;
}

.stats-disclaimer {
  font-size: 0.85em;
  color: var(--text-muted, #888);
  line-height: 1.4;
}

.update-modal {
  max-width: 540px;
}

.update-banner {
  padding: 4px 0 8px 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.update-headline {
  font-size: 1.05rem;
  margin: 0;
  color: var(--text-color);
}

.update-version-tag {
  color: var(--primary-color);
  font-weight: 700;
}

.update-current-version {
  font-size: 0.85rem;
  color: var(--text-muted);
  margin: 0;
}

.update-notes-container {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 4px 0;
}

.update-notes-title {
  font-size: 0.85rem;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--text-muted);
  letter-spacing: 0.5px;
}

.update-notes-content {
  background: var(--color-light, rgba(0, 0, 0, 0.05));
  border: 1px solid var(--border-color, #ccc);
  padding: 12px;
  max-height: 180px;
  overflow-y: auto;
  font-size: 0.85rem;
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-word;
  user-select: text;
  color: var(--text-color);
}

.update-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  margin-top: 8px;
}

.update-actions-right {
  display: flex;
  gap: 8px;
}

/* Checkpoints & Chapters Modal */
.checkpoints-modal {
  width: 480px;
}

.checkpoints-subtitle-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.9rem;
  color: var(--text-muted, #666);
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-color, #e0e0e0);
}

.checkpoints-runs-info strong {
  color: var(--text-color, #333);
}

.status-badge {
  font-size: 10px;
  padding: 1px 6px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-radius: 2px;
  background-color: var(--hover-bg, rgba(0, 0, 0, 0.06));
  color: var(--text-muted, #777);
}

.status-badge.running {
  background-color: rgba(25, 118, 210, 0.12);
  color: #1976d2;
}

.checkpoints-empty {
  padding: 28px 0;
  text-align: center;
  color: var(--text-muted, #777);
}

.checkpoints-chart-container {
  max-height: 60vh;
  overflow-y: auto;
  padding-right: 6px;
  margin: 4px 0;
}

.checkpoints-chart-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.checkpoint-chart-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.checkpoint-row-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
  font-size: 0.88rem;
}

.checkpoints-subtitle-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.88rem;
  color: var(--text-muted, #777);
  padding-bottom: 8px;
  border-bottom: 1px solid var(--color-border-subtle, #e0e0e0);
  gap: 12px;
}

.checkpoints-runs-info strong {
  color: var(--text-color, #111);
}

.checkpoints-subtitle-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.checkpoints-grouping-toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-muted, #777);
}

.toggle-mode-label {
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-size: 0.75rem;
  color: var(--text-muted, #777);
  transition: color 0.15s ease;
  user-select: none;
  font-weight: 700;
  opacity: 0.8;
}

.toggle-mode-label.active {
  color: var(--text-color, #111);
  opacity: 1;
}

.neubrutalist-switch {
  position: relative;
  display: inline-flex;
  align-items: center;
  cursor: pointer;
}

.switch-input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.switch-track {
  width: 40px;
  height: 20px;
  background: var(--color-light, #f4f4f4);
  border: var(--border, 2px solid var(--color-border, #111111));
  box-shadow: 2px 2px 0px var(--color-border, #111111);
  border-radius: 0px;
  position: relative;
  transition: background-color 0.15s ease;
  display: flex;
  align-items: center;
}

.switch-thumb {
  width: 12px;
  height: 12px;
  background: var(--color-fg, #111111);
  border-radius: 0px;
  position: absolute;
  left: 2px;
  transition: transform 0.18s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.15s ease;
}

/* Checked = Name mode (On state, vibrant accent) */
.switch-input:checked + .switch-track {
  background: var(--color-accent, #FF4D00);
}

.switch-input:checked + .switch-track .switch-thumb {
  transform: translateX(20px);
  background: #FFFFFF;
}

body.dark .switch-thumb,
body.theme-dark .switch-thumb {
  background: var(--color-fg, #EEEEEE);
}

body.dark .switch-input:checked + .switch-track .switch-thumb,
body.theme-dark .switch-input:checked + .switch-track .switch-thumb {
  background: #FFFFFF;
}

.knot-address {
  font-weight: 700;
  flex-shrink: 0;
}

.checkpoint-knot-meta {
  font-size: 0.78rem;
  color: var(--text-color, #111111);
  opacity: 0.8;
  font-weight: normal;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  font-weight: 600;
}

.checkpoint-name {
  font-weight: 600;
  color: var(--text-color, #333);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.checkpoint-chart-row.is-unnamed .checkpoint-name {
  font-style: italic;
  color: var(--text-color, #333);
  font-weight: 600;
}

.checkpoint-stats-val {
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  font-size: 0.82rem;
  color: var(--text-color, #333);
}

.checkpoint-count {
  color: var(--text-muted, #777);
  font-size: 0.78rem;
}

.checkpoint-bar-track {
  height: 12px;
  background: var(--color-light, #f4f4f4);
  border: var(--border, 2px solid #111111);
  border-radius: 0px;
  overflow: hidden;
}

.checkpoint-bar-fill {
  height: 100%;
  background: var(--color-accent, var(--primary-color, #FF4D00));
  border-radius: 0px;
  transition: width 0.3s ease;
}

.checkpoint-bar-fill.unnamed-bar {
  background: var(--color-gray, #717171);
  opacity: 0.85;
}
</style>
