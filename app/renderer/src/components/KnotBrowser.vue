<template>
  <div class="panel knot-panel">
    <div class="sidebar-header">
      <span class="title">Knots & Stitches</span>
    </div>
    
    <div class="knot-list">
      <div v-for="file in projectStore.files" :key="file.id" class="file-knots-group">
        <div class="file-name" v-if="Object.keys(getSymbols(file)).length > 0">{{ getFilename(file) }}</div>
        
        <div v-for="(knot, knotName) in getSymbols(file)" :key="knotName" class="knot-container">
          <div class="knot-item symbol-item" @click="jumpToSymbol(file, knot)">
            <span class="material-symbols-outlined knot-icon">flag</span>
            <span class="symbol-name">{{ knotName }}</span>
          </div>
          
          <div v-if="knot.innerSymbols" class="stitches">
            <div v-for="(stitch, stitchName) in knot.innerSymbols" :key="stitchName" class="stitch-item symbol-item" @click="jumpToSymbol(file, stitch)">
              <span class="material-symbols-outlined stitch-icon">commit</span>
              <span class="symbol-name">{{ stitchName }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useProjectStore } from '../stores/projectStore';

const projectStore = useProjectStore();

const getSymbols = (file) => {
  return file.symbols || {};
};

const getFilename = (file) => {
  if (!file || !file.relPath) return 'Untitled';
  const parts = file.relPath.split('/');
  return parts[parts.length - 1].split('\\').pop(); // handle both slash types
};

const jumpToSymbol = (file, symbol) => {
  if (symbol && file) {
    projectStore.setActiveFile(file);
    // Tell the editor to jump to this line
    window.dispatchEvent(new CustomEvent('editor-jump-to-line', { detail: { line: symbol.row } }));
  }
};
</script>

<style scoped>
.knot-panel {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
  border-top: 1px solid var(--border-color, #e0e0e0);
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

.knot-list {
  flex: 1;
  overflow-y: auto;
  padding-bottom: 16px;
}

.file-knots-group {
  margin-bottom: 8px;
}

.file-name {
  font-size: calc(11px * var(--zoom-factor, 1));
  text-transform: uppercase;
  color: var(--text-muted, #888);
  padding: 8px 12px 4px;
  font-weight: bold;
}

.symbol-item {
  display: flex;
  align-items: center;
  padding: 4px 12px;
  cursor: pointer;
  user-select: none;
  font-size: calc(13px * var(--zoom-factor, 1));
  color: var(--text-color, #333);
}

.symbol-item:hover {
  background-color: var(--hover-bg, rgba(0,0,0,0.05));
}

.knot-item {
  font-weight: 500;
}

.stitch-item {
  padding-left: 32px;
  font-size: calc(12px * var(--zoom-factor, 1));
  color: var(--text-muted, #555);
}

.knot-icon {
  font-size: calc(16px * var(--zoom-factor, 1));
  margin-right: 8px;
  color: var(--cm-knot-color, #1976d2);
}

.stitch-icon {
  font-size: calc(16px * var(--zoom-factor, 1));
  margin-right: 8px;
  color: var(--cm-stitch-color, #0d47a1);
  opacity: 0.7;
}

.symbol-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
