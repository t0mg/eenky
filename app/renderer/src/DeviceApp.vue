<template>
  <div class="device-app" :class="theme">
    <!-- Two-tab strip: Device Manager | Flash Firmware -->
    <div class="dm-tabs">
      <button
        class="dm-tab"
        :class="{ active: currentTab === 'device' }"
        @click="switchTab('device')"
        aria-label="Device Manager tab"
      >
        <span class="material-symbols-outlined">devices</span>
        Manage Stories
      </button>
      <button
        class="dm-tab"
        :class="{ active: currentTab === 'flash' }"
        @click="switchTab('flash')"
        aria-label="Flash Firmware tab"
      >
        <span class="material-symbols-outlined">memory</span>
        Flash Firmware
      </button>
    </div>

    <!-- Module frames -->
    <div class="module-area">
      <iframe
        v-if="deviceManagerUrl"
        ref="deviceManagerFrame"
        :src="deviceManagerUrl"
        class="module-frame"
        :class="{ visible: currentTab === 'device' }"
        allow="serial *"
        aria-label="Device Manager"
        title="Device Manager"
      />
      <iframe
        v-if="flasherUrl"
        ref="flasherFrame"
        :src="flasherUrl"
        class="module-frame"
        :class="{ visible: currentTab === 'flash' }"
        allow="serial *"
        aria-label="Flash Firmware"
        title="Flash Firmware"
      />

      <!-- Fallback if paths can't be resolved -->
      <div v-if="!deviceManagerUrl && !flasherUrl" class="load-error">
        <span class="material-symbols-outlined">error</span>
        <p>Could not resolve module paths. Run <code>npm run setup</code> and restart.</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';

const currentTab        = ref('device');
const deviceManagerFrame = ref(null);
const flasherFrame      = ref(null);
const theme = ref(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

// ── Resolve module paths via preload IPC bridge ───────────────────
const deviceManagerUrl = ref(null);
const flasherUrl       = ref(null);

onMounted(async () => {
  document.body.className = theme.value;

  if (import.meta.env?.DEV) {
    deviceManagerUrl.value = '/device-manager/index.html';
    flasherUrl.value       = '/flasher/index.html';
  } else {
    if (window.api?.getDeviceManagerPath) {
      deviceManagerUrl.value = await window.api.getDeviceManagerPath();
    }
    if (window.api?.getFlasherPath) {
      flasherUrl.value = await window.api.getFlasherPath();
    }
  }

  forwardThemeToAll(theme.value);

  // Listen for theme changes from main process
  if (window.api?.receive) {
    window.api.receive('change-theme', (newTheme) => {
      if (newTheme === 'system' || newTheme === 'os') {
        theme.value = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      } else {
        theme.value = newTheme;
      }
      document.body.className = theme.value;
      forwardThemeToAll(theme.value);
    });
  }

  // System dark-mode change
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    theme.value = e.matches ? 'dark' : 'light';
    document.body.className = theme.value;
    forwardThemeToAll(theme.value);
  });
});

// ── Tab switching ─────────────────────────────────────────────────
function switchTab(tab) {
  currentTab.value = tab;
  // Re-forward theme when switching to a tab — the iframe may have just loaded
  setTimeout(() => forwardThemeToAll(theme.value), 150);
}

// ── Theme sync into both iframes ──────────────────────────────────
function forwardThemeToAll(t) {
  [deviceManagerFrame.value, flasherFrame.value].forEach(frame => {
    try { frame?.contentWindow?.postMessage({ type: 'change-theme', theme: t }, '*'); } catch (_) {}
  });
}
</script>

<style scoped>
.device-app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  background-color: var(--bg-color, #fff);
  color: var(--text-color, #111);
  font-family: system-ui, sans-serif;
}

/* ── Tab strip ───────────────────────────────────────────────────── */
.dm-tabs {
  display: flex;
  border-bottom: 1px solid var(--border-color, #e0e0e0);
  flex-shrink: 0;
  background-color: var(--sidebar-bg, #f5f5f5);
}

.dm-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 18px;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  border: none;
  border-right: 1px solid var(--border-color, #e0e0e0);
  background: transparent;
  color: var(--text-color-muted, #888);
  transition: background 0.1s, color 0.1s;
}

.dm-tab:hover { background-color: var(--hover-color, #eee); color: var(--text-color, #111); }
.dm-tab.active { background-color: var(--bg-color, #fff); color: var(--text-color, #111); border-bottom: 2px solid var(--primary-color, #2196F3); margin-bottom: -1px; }

.dm-tab .material-symbols-outlined { font-size: 1.1rem; }

/* ── Module area ─────────────────────────────────────────────────── */
.module-area {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.module-frame {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: none;
  display: none;
}

.module-frame.visible { display: block; }

/* ── Fallback ────────────────────────────────────────────────────── */
.load-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 12px;
  color: var(--text-color-muted, #888);
  text-align: center;
  padding: 2rem;
}

.load-error .material-symbols-outlined { font-size: 3rem; opacity: 0.4; }
.load-error p { font-size: 0.9rem; }
.load-error code { background: var(--sidebar-bg, #f5f5f5); padding: 2px 6px; border-radius: 3px; font-size: 0.85rem; }
</style>
