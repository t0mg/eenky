<template>
  <div v-if="uiStore.modalState.isOpen" class="modal-overlay" @click.self="closeModal" @keydown.esc="closeModal" tabindex="0" ref="overlay">
    <div class="modal-content" role="dialog" aria-modal="true">
      
      <!-- Issue Popup / Settings / About etc. -->
      <div v-if="uiStore.modalState.type === 'about'" class="modal-body">
        <h2>About EENKY</h2>
        <p>EENKY is a minimalist editor and player for ink, forked from Inky by inkle.</p>
        <button @click="closeModal" class="primary-btn">Close</button>
      </div>

      <div v-else-if="uiStore.modalState.type === 'shortcuts'" class="modal-body">
        <h2>Useful Keyboard Shortcuts</h2>
        <table class="shortcuts-table">
          <tr><td>New Project</td><td>{{ ctrlCmd }} + N</td></tr>
          <tr><td>Save Project</td><td>{{ ctrlCmd }} + S</td></tr>
          <tr><td>Compile to EENK</td><td>{{ ctrlCmd }} + B</td></tr>
          <tr><td>Undo</td><td>{{ ctrlCmd }} + Z</td></tr>
          <tr><td>Redo</td><td>{{ ctrlCmd }} + Shift + Z</td></tr>
          <tr><td>Find / Replace</td><td>{{ ctrlCmd }} + F</td></tr>
          <tr><td>Go to Anything</td><td>{{ ctrlCmd }} + P</td></tr>
          <tr><td>Next Issue</td><td>{{ ctrlCmd }} + .</td></tr>
          <tr><td>Rewind Story</td><td>{{ ctrlCmd }} + R</td></tr>
          <tr><td>Step Back Story</td><td>{{ ctrlCmd }} + [</td></tr>
          <tr><td>Zoom In / Out / Reset</td><td>{{ ctrlCmd }} + + / - / 0</td></tr>
        </table>
        <button @click="closeModal" class="primary-btn">Close</button>
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
        <button @click="closeModal" class="primary-btn">Close</button>
      </div>

      <div v-else class="modal-body">
        <h2>{{ uiStore.modalState.type }}</h2>
        <p>Not implemented yet.</p>
        <button @click="closeModal" class="primary-btn">Close</button>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue';
import { useUiStore } from '../stores/uiStore';
import { LiveCompiler } from '../core/liveCompiler';

const uiStore = useUiStore();
const overlay = ref(null);
const statsData = ref(null);

const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
const ctrlCmd = isMac ? '⌘' : 'Ctrl';

const closeModal = () => {
  uiStore.closeModal();
};

// Focus capture
watch(() => uiStore.modalState.isOpen, async (isOpen) => {
  if (isOpen) {
    if (uiStore.modalState.type === 'stats') {
      statsData.value = null;
      LiveCompiler.getStats((stats) => {
        statsData.value = stats;
      });
    }
    
    await nextTick();
    if (overlay.value) {
      overlay.value.focus();
    }
  }
});
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background-color: var(--bg-color, #ffffff);
  color: var(--text-color, #333);
  padding: 24px;
  border-radius: 8px;
  min-width: 300px;
  max-width: 500px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  border: 1px solid var(--border-color, #e0e0e0);
}

.modal-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.modal-body h2 {
  margin: 0;
  font-size: 1.25rem;
}

.primary-btn {
  align-self: flex-end;
}

.shortcuts-table {
  width: 100%;
  border-collapse: collapse;
}

.shortcuts-table td {
  padding: 4px 8px;
  border-bottom: 1px solid var(--border-color, #e0e0e0);
}

.shortcuts-table td:first-child {
  font-weight: bold;
}
</style>
