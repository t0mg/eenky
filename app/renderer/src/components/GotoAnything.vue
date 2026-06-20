<template>
  <div v-if="isVisible" id="goto-anything-container" @click="hide">
    <div id="goto-anything" @click.stop>
      <input
        ref="searchInput"
        type="text"
        v-model="searchQuery"
        placeholder="Go to file, symbol, or line..."
        @input="refreshResults"
        @keydown.down.prevent="selectNext"
        @keydown.up.prevent="selectPrev"
        @keydown.tab.prevent="selectNext"
        @keydown.shift.tab.prevent="selectPrev"
        @keydown.enter.prevent="confirmSelection"
        @keydown.esc.prevent="hide"
      />
      <ul class="results" ref="resultsContainer">
        <li
          v-for="(result, index) in results"
          :key="index"
          :class="[result.type, { selected: index === selectedIndex }]"
          @click="chooseResult(result)"
          @mousemove="onMouseMove(index, $event)"
        >
          <template v-if="result.type === 'file'">
            <p class="main-text">📄 <span v-if="result.dirName" class="ancestor">{{ result.dirName }}/</span><span v-html="result.highlightedName"></span></p>
          </template>
          
          <template v-else-if="result.type === 'gotoLine'">
            <p class="main-text">➡︎ Go to line {{ result.line + 1 }}</p>
            <p class="meta">{{ result.lineContent }}</p>
          </template>
          
          <template v-else-if="result.type === 'symbol'">
            <p class="main-text">✎ <span v-if="result.ancestorStr" class="ancestor" v-html="result.ancestorStr"></span><span v-html="result.highlightedName"></span></p>
            <p class="meta">{{ result.filePath }} - line {{ result.row + 1 }}</p>
          </template>
          
          <template v-else-if="result.type === 'content'">
            <p class="main-text" v-html="result.highlightedName"></p>
            <p class="meta">{{ result.filePath }} - line {{ result.row + 1 }}</p>
          </template>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { useProjectStore } from '../stores/projectStore';
import fuzzaldrin from 'fuzzaldrin-plus';

const projectStore = useProjectStore();
const isVisible = ref(false);
const searchQuery = ref('');
const results = ref([]);
const selectedIndex = ref(0);
const searchInput = ref(null);
const resultsContainer = ref(null);

let cachedFiles = [];
let cachedSymbols = [];
let cachedActiveFileSymbols = [];
let cachedLines = [];
let lastMousePos = { x: 0, y: 0 };
let resultsBuildInterval = null;

onMounted(() => {
  window.api.receive("goto-anything", () => {
    toggle();
  });
});

function toggle() {
  if (isVisible.value) hide();
  else show();
}

function show() {
  isVisible.value = true;
  searchQuery.value = '';
  results.value = [];
  selectedIndex.value = 0;
  
  // Cache data
  const files = projectStore.files;
  
  cachedFiles = files.map(file => ({
    name: file.relPath,
    file: file
  }));
  
  cachedSymbols = [];
  cachedActiveFileSymbols = [];
  
  files.forEach(file => {
    if (file._symbolsObj) {
      const fileSymbols = file._symbolsObj.getSymbols();
      const targetArray = (file === projectStore.activeInkFile) ? cachedActiveFileSymbols : cachedSymbols;
      collectSymbols(targetArray, fileSymbols, true, file);
    }
  });
  
  cachedLines = [];
  // Prioritize active file
  const sortedFiles = [projectStore.activeInkFile, ...files.filter(f => f !== projectStore.activeInkFile)].filter(Boolean);
  
  sortedFiles.forEach(file => {
    if (!file.content) return;
    const lines = file.content.split('\n');
    lines.forEach((line, row) => {
      cachedLines.push({
        line: line,
        lineLower: line.toLowerCase(),
        row: row,
        file: file
      });
    });
  });
  
  nextTick(() => {
    if (searchInput.value) searchInput.value.focus();
  });
}

function hide() {
  isVisible.value = false;
  if (resultsBuildInterval) clearInterval(resultsBuildInterval);
  resultsBuildInterval = null;
}

function collectSymbols(allSymbols, symbolsObj, recurse, inkFile) {
  if (!symbolsObj) return;
  const symbols = Object.values(symbolsObj);
  symbols.forEach(sym => {
    sym.inkFile = inkFile;
    allSymbols.push(sym);
    if (recurse && sym.innerSymbols) {
      collectSymbols(allSymbols, sym.innerSymbols, recurse, inkFile);
    }
  });
}

function wrapHighlight(text, query) {
  return fuzzaldrin.wrap(text, query, {
    wrap: { tagOpen: "<span class='goto-highlight'>", tagClose: "</span>" }
  });
}

function refreshResults() {
  if (resultsBuildInterval) {
    clearInterval(resultsBuildInterval);
    resultsBuildInterval = null;
  }
  
  const query = searchQuery.value;
  results.value = [];
  selectedIndex.value = 0;
  
  if (!query) return;
  
  const newResults = [];
  
  // Line numbers
  const lineMatch = query.match(/^\s*(\d+)\s*$/);
  if (lineMatch && projectStore.activeInkFile) {
    const lineNum = parseInt(lineMatch[1], 10);
    const lines = projectStore.activeInkFile.content ? projectStore.activeInkFile.content.split('\n') : [];
    newResults.push({
      type: 'gotoLine',
      line: lineNum - 1,
      lineContent: lines[lineNum - 1] || "",
      file: projectStore.activeInkFile
    });
  }
  
  // Fuzz matches
  const addScored = (sourceArray, typeMapper) => {
    const filtered = fuzzaldrin.filter(sourceArray, query, { key: "name" });
    filtered.forEach(item => {
      const score = fuzzaldrin.score(item.name, query);
      if (score > 6000) {
        newResults.push({ ...typeMapper(item), _score: score });
      }
    });
  };
  
  addScored(cachedFiles, item => {
    const absPath = item.file.absolutePath || item.name || "";
    // Basic path splitting for frontend use since preload.js api.path returns promises
    const normalizedPath = absPath.replace(/\\/g, '/');
    const pathParts = normalizedPath.split('/');
    const baseName = pathParts.pop();
    const dirName = pathParts.join('/');
    return {
      type: 'file',
      file: item.file,
      dirName: dirName !== '.' ? dirName : '',
      highlightedName: wrapHighlight(baseName, query)
    };
  });
  
  addScored(cachedActiveFileSymbols, item => {
    let ancestorStr = "";
    let ancestor = item.parent;
    while (ancestor && ancestor.name) {
      ancestorStr = ancestor.name + "." + ancestorStr;
      ancestor = ancestor.parent;
    }
    return {
      type: 'symbol',
      row: item.row,
      inkFile: item.inkFile,
      filePath: item.inkFile.relPath,
      ancestorStr: ancestorStr ? ancestorStr : "",
      highlightedName: wrapHighlight(item.name, query)
    };
  });
  
  addScored(cachedSymbols, item => {
    let ancestorStr = "";
    let ancestor = item.parent;
    while (ancestor && ancestor.name) {
      ancestorStr = ancestor.name + "." + ancestorStr;
      ancestor = ancestor.parent;
    }
    return {
      type: 'symbol',
      row: item.row,
      inkFile: item.inkFile,
      filePath: item.inkFile.relPath,
      ancestorStr: ancestorStr ? ancestorStr : "",
      highlightedName: wrapHighlight(item.name, query)
    };
  });
  
  // Sort fuzz matches by score
  newResults.sort((a, b) => (b._score || 0) - (a._score || 0));
  
  results.value = newResults;
  
  // Async line content searching
  let currentLineIdx = 0;
  const queryLower = query.toLowerCase();
  
  resultsBuildInterval = setInterval(() => {
    const linesToProcess = Math.min(cachedLines.length - currentLineIdx, 10000);
    const endLineIdx = currentLineIdx + linesToProcess;
    
    for (; currentLineIdx < endLineIdx; currentLineIdx++) {
      const line = cachedLines[currentLineIdx];
      if (line.lineLower.includes(queryLower)) {
        results.value.push({
          type: 'content',
          file: line.file,
          row: line.row,
          filePath: line.file.relPath,
          highlightedName: wrapHighlight(line.line, query)
        });
      }
    }
    
    if (currentLineIdx >= cachedLines.length) {
      clearInterval(resultsBuildInterval);
      resultsBuildInterval = null;
    }
  }, 35);
}

function selectNext() {
  if (results.value.length === 0) return;
  selectedIndex.value = (selectedIndex.value + 1) % results.value.length;
  scrollToSelection();
}

function selectPrev() {
  if (results.value.length === 0) return;
  selectedIndex.value = (selectedIndex.value - 1 + results.value.length) % results.value.length;
  scrollToSelection();
}

function scrollToSelection() {
  nextTick(() => {
    if (!resultsContainer.value) return;
    const items = resultsContainer.value.children;
    const selectedItem = items[selectedIndex.value];
    if (selectedItem) {
      selectedItem.scrollIntoView({ block: 'nearest' });
    }
  });
}

function onMouseMove(index, event) {
  if (lastMousePos.x !== event.clientX || lastMousePos.y !== event.clientY) {
    lastMousePos = { x: event.clientX, y: event.clientY };
    selectedIndex.value = index;
  }
}

function confirmSelection() {
  if (results.value.length > 0 && selectedIndex.value >= 0 && selectedIndex.value < results.value.length) {
    chooseResult(results.value[selectedIndex.value]);
  }
}

function chooseResult(result) {
  let targetFile = result.file || result.inkFile;
  let targetRow = result.row !== undefined ? result.row : result.line;

  if (targetFile) {
    projectStore.setActiveFile(targetFile);
  }
  
  if (targetRow !== undefined) {
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('editor-jump-to-line', { detail: { line: targetRow } }));
    }, 50);
  }
  
  hide();
}
</script>

<style scoped>
#goto-anything-container {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.2);
  z-index: 60;
}

#goto-anything {
  position: absolute;
  top: 15%;
  left: 100px;
  right: 100px;
  background: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  box-shadow: 0 5px 6px rgba(0,0,0,0.2);
  z-index: 80;
  padding: 10px;
  font-family: monospace;
}

#goto-anything input {
  width: 100%;
  padding: 5px;
  font-size: 16pt;
  border-radius: 3px;
  border: 1px solid var(--border-color);
  background: var(--bg-color);
  color: var(--text-color);
  outline: none;
}

#goto-anything ul.results {
  max-height: 400px;
  overflow-y: scroll;
  list-style: none;
  padding-left: 0;
  margin-left: 10px;
  margin-bottom: 0;
}

#goto-anything ul.results li {
  border-bottom: 1px solid var(--border-color);
  font-size: 12pt;
  position: relative;
  height: 48px;
  color: var(--text-color);
  cursor: pointer;
  user-select: none;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

#goto-anything ul.results li p {
  white-space: nowrap;
  padding: 0;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

#goto-anything ul.results li.content .main-text {
  color: var(--text-color);
  opacity: 0.8;
}

#goto-anything ul.results li p.meta {
  font-size: 9pt;
  color: var(--text-muted);
}

#goto-anything ul.results li.selected {
  background: var(--hover-bg);
}

:deep(.goto-highlight) {
  font-weight: bold;
  color: var(--primary-color);
}

#goto-anything .ancestor {
  color: var(--text-muted);
}
</style>
