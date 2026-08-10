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
          <!-- <img src="/about/icon256.png" class="about-icon" alt="eenky icon" draggable="false" /> -->
          <h2>eenky</h2>
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
          <tr><td>Open Device Manager</td><td>{{ ctrlCmd }} + D</td></tr>
          <tr><td>Open Documentation</td><td>F1</td></tr>
          <tr><td>Keyboard Shortcuts</td><td>{{ ctrlCmd }} + /</td></tr>
          </tbody>
        </table>
        <button @click="closeModal(false)" class="primary-btn">Close</button>
      </div>

      <div v-else-if="uiStore.modalState.type === 'stats'" class="modal-body">
        <h2>Word Count and More</h2>
        <div v-if="statsData">
          <p><strong>Words:</strong> {{ statsData.words }}</p>
          <br>
          <p><strong>Knots:</strong> {{ statsData.knots }}</p>
          <p><strong>Stitches:</strong> {{ statsData.stitches }}</p>
          <p><strong>Functions:</strong> {{ statsData.functions }}</p>
          <br>
          <p><strong>Choices:</strong> {{ statsData.choices }}</p>
          <p><strong>Gathers:</strong> {{ statsData.gathers }}</p>
          <p><strong>Diverts:</strong> {{ statsData.diverts }}</p>
          <br>
          <p class="stats-disclaimer">Notes: Words should be accurate. Knots include functions. Gathers and diverts may include some implicitly added ones by the compiler, for example in weave. Diverts include END and DONE.</p>
        </div>
        <div v-else>
          <p>Calculating stats...</p>
        </div>
        <button @click="closeModal(false)" class="primary-btn">Close</button>
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
import { LiveCompiler } from '../core/liveCompiler';

const uiStore = useUiStore();
const overlay = ref(null);
const modalContent = ref(null);
const statsData = ref(null);
const aboutData = ref(null);
let previousActiveElement = null;

const modalData = computed(() => uiStore.modalState.data || {});
const messageLines = computed(() => {
  const msg = modalData.value.message || '';
  return msg.split('\n');
});

if (window.api && window.api.receive) {
  window.api.receive('show-about', (data) => {
    aboutData.value = data;
    uiStore.openModal('about');
  });
}

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
      if (uiStore.modalState.type === 'stats') {
        statsData.value = null;
        LiveCompiler.getStats((stats) => {
          statsData.value = stats;
        });
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
  width: 100px;
  height: 100px;
  margin-top: 10px;
}
.about-versions {
  text-align: center;
  font-family: monospace;
  font-size: 0.9em;
  color: var(--text-muted, #777);
  margin: 10px 0;
}
.about-versions p {
  margin: 4px 0;
}
</style>
