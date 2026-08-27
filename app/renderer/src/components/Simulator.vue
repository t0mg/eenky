<template>
  <div id="simulator-container">
    <component is="style" v-if="fontStyle">{{ fontStyle }}</component>
    <div class="toolbar">
      <button class="icon-btn" @click="rewind" title="Restart story">
        <span class="material-symbols-outlined">restart_alt</span>
      </button>
      <button class="icon-btn" @click="stepBack" title="Step back">
        <span class="material-symbols-outlined">undo</span>
      </button>
    </div>
    
    <div class="expressionWatch" v-if="watchExpressions.length > 0" style="border-bottom: 1px solid var(--border-color, #e0e0e0);">
      <table class="expressionTable" style="width: 100%; border-collapse: collapse;">
        <tr v-for="(watchObj, index) in watchExpressions" :key="index">
          <td class="expressionLabel" style="width: 80px; font-size: 0.9em; color: var(--text-muted, #777); padding-left: 8px;">Every turn:</td>
          <td class="expressionInput" style="display: flex; align-items: center; justify-content: space-between;">
            <input 
              type="text" 
              v-model="watchObj.expr" 
              @change="() => evaluateAllWatches()"
              placeholder="x is {x}"
              style="flex: 1; border: none; background: transparent; color: inherit; padding: 4px; outline: none; font-family: monospace;"
            />
            <button class="removeButton icon-btn" @click="removeWatch(index)" style="background: none; border: none; color: inherit; cursor: pointer; padding: 4px; display: flex; align-items: center; justify-content: center;">
              <span class="material-symbols-outlined" style="font-size: 16px;">cancel</span>
            </button>
          </td>
        </tr>
      </table>
    </div>
    
    <div class="player-content" ref="scrollContainer">
      <div v-for="(block, index) in blocks" :key="index" class="story-block">
        <div v-if="block.type === 'text'" class="story-text" v-html="formatText(block.text)"></div>
        <div v-else-if="block.type === 'tags'" class="story-tags">
          <span v-for="tag in block.tags" :key="tag" class="tag"># {{ tag }}</span>
        </div>
        <div v-else-if="block.type === 'watch-result'" class="story-watch-result">
          <div v-for="(res, i) in block.results" :key="i" class="watch-pill" :class="{ error: res.error }" :title="res.expr">
            {{ res.result }}
          </div>
        </div>
        <div v-else-if="block.type === 'choice'" class="story-choice">
          <button @click="makeChoice(block.choice)" class="choice-btn" v-html="formatText(block.choice.choice.text)">
          </button>
        </div>
        <div v-else-if="block.type === 'chosen-choice'" class="story-chosen-choice">
          <span class="choice-bullet">&gt;</span> <span v-html="formatText(block.text)"></span>
        </div>
        <div v-else-if="block.type === 'fuzzer-issue'" class="story-fuzzer-issue" :class="block.issue.type">
          <div class="fuzzer-issue-banner">
            <span class="material-symbols-outlined issue-banner-icon">{{ getIssueIcon(block.issue.type) }}</span>
            <div class="issue-banner-text">
              <div class="issue-banner-title">{{ getIssueLabel(block.issue.type) }}</div>
              <div class="issue-banner-msg">{{ block.message }}</div>
              <div class="issue-banner-sub">Turn {{ block.issue.turnCount }} &bull; {{ block.issue.knotOrPath }}</div>
            </div>
          </div>
        </div>
        <hr v-else-if="block.type === 'divider'" class="story-divider" />
        <div v-else-if="block.type === 'error'" class="story-error">
          {{ block.message }}
        </div>
        <div v-else-if="block.type === 'end'" class="story-end">
          --- End of story ---
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick, computed, watch } from 'vue';
import inkjs from 'inkjs';
import { LiveCompiler } from '../core/liveCompiler.js';
import { AutoPlayer } from '../core/autoPlayer.js';
import { useProjectStore } from '../stores/projectStore';
const projectStore = useProjectStore();

const storyFontRaw = computed(() => {
  const content = projectStore.mainInkFile?.content || '';
  const match = content.match(/@font(?::|\s)\s*([^\n\r*]+)/i);
  return match ? match[1].trim() : '';
});

const debouncedStoryFont = ref('');

watch(storyFontRaw, (newVal) => {
  if (debouncedStoryFont.timeoutId) clearTimeout(debouncedStoryFont.timeoutId);
  debouncedStoryFont.timeoutId = setTimeout(() => {
    debouncedStoryFont.value = newVal;
  }, 500);
}, { immediate: true });

const fontStyle = computed(() => {
  const originalFont = debouncedStoryFont.value;
  const font = originalFont.toLowerCase();
  
  if (font === 'sans') return '.player-content { font-family: sans-serif !important; }';
  if (font === 'serif') {
    return `
      @font-face {
        font-family: 'Literata';
        src: url('/fonts/Literata-VariableFont_opsz,wght.ttf') format('truetype');
        font-style: normal;
      }
      @font-face {
        font-family: 'Literata';
        src: url('/fonts/Literata-Italic-VariableFont_opsz,wght.ttf') format('truetype');
        font-style: italic;
      }
      .player-content { font-family: 'Literata', serif !important; }
    `;
  }
  if (originalFont) {
    // Sideloaded TTF
    const dir = projectStore.mainInkFile.absolutePath.replace(/[^\\/]+$/, '');
    const fontUrl = `file:///${dir}${originalFont}.ttf`.replace(/\\/g, '/');
    return `
      @font-face {
        font-family: '${originalFont}';
        src: url('${fontUrl}') format('truetype');
      }
      .player-content { font-family: '${originalFont}', sans-serif !important; }
    `;
  }
  return '';
});

const blocks = ref([]);
const scrollContainer = ref(null);
const watchExpressions = ref([]);

// Fuzzer Replay State
const isFuzzerReplayMode = ref(false);
const activeReplayIssue = ref(null);
const fuzzerHistory = ref([]);
const fuzzerCurrentStepIdx = ref(-1);
const activeStory = ref(null);

const getIssueIcon = (type) => {
  switch (type) {
    case 'runtime_error': return 'error';
    case 'loose_end': return 'call_split';
    case 'infinite_loop': return 'sync_problem';
    case 'outlier': return 'query_stats';
    default: return 'report_problem';
  }
};

const getIssueLabel = (type) => {
  switch (type) {
    case 'runtime_error': return 'Runtime Error';
    case 'loose_end': return 'Loose End (Out of Flow)';
    case 'infinite_loop': return 'Potential Infinite Loop';
    case 'outlier': return 'Statistical Outlier';
    default: return 'Anomaly';
  }
};

const evaluateAllWatches = (onComplete) => {
  if (watchExpressions.value.length === 0) {
    if (onComplete) onComplete();
    return;
  }
  
  const expressionsToEval = watchExpressions.value.filter(w => w.expr && w.expr.trim() !== '');
  if (expressionsToEval.length === 0) {
    if (onComplete) onComplete();
    return;
  }
  
  const results = [];
  
  const evalNext = (index) => {
    if (index >= expressionsToEval.length) {
      blocks.value.push({ type: 'watch-result', results });
      scrollToBottom();
      if (onComplete) onComplete();
      return;
    }
    
    const expr = expressionsToEval[index].expr;
    if (isFuzzerReplayMode.value && activeStory.value) {
      try {
        let val = activeStory.value.variablesState ? activeStory.value.variablesState[expr] : undefined;
        if (val === undefined) {
          val = 'null';
        }
        results.push({
          expr,
          result: String(val),
          error: false
        });
      } catch (err) {
        results.push({
          expr,
          result: String(err),
          error: true
        });
      }
      evalNext(index + 1);
    } else {
      LiveCompiler.evaluateExpression(expr, (result, error) => {
        results.push({
          expr,
          result: error ? error : result,
          error: !!error
        });
        evalNext(index + 1);
      });
    }
  };
  
  evalNext(0);
};

const addWatchExpression = () => {
  watchExpressions.value.push({ expr: '' });
};

const removeWatch = (index) => {
  watchExpressions.value.splice(index, 1);
  evaluateAllWatches();
};

if (window.api && window.api.receive) {
  window.api.receive("add-watch-expression", () => {
    addWatchExpression();
  });
}

const scrollToBottom = async () => {
  await nextTick();
  if (scrollContainer.value) {
    scrollContainer.value.scrollTop = scrollContainer.value.scrollHeight;
  }
};

const injectFuzzerReplay = (issue, storyJson) => {
  if (!issue || !issue.stateHistory) return;

  isFuzzerReplayMode.value = true;
  activeReplayIssue.value = issue;
  fuzzerHistory.value = JSON.parse(JSON.stringify(issue.stateHistory));
  fuzzerCurrentStepIdx.value = fuzzerHistory.value.length - 1;

  const jsonToUse = storyJson || projectStore.compiledStoryJson;
  if (jsonToUse) {
    const StoryClass = inkjs.Story || inkjs;
    try {
      activeStory.value = new StoryClass(jsonToUse);
    } catch (e) {
      console.warn('Could not construct inkjs.Story for replay:', e);
    }
  }

  renderFuzzerUpToStep(fuzzerCurrentStepIdx.value);
};

const renderFuzzerUpToStep = (stepIdx) => {
  blocks.value = [];
  if (stepIdx < 0 || stepIdx >= fuzzerHistory.value.length) return;

  for (let i = 0; i <= stepIdx; i++) {
    const step = fuzzerHistory.value[i];
    if (step.text) {
      blocks.value.push({ type: 'text', text: step.text });
    }
    if (step.tags && step.tags.length > 0) {
      blocks.value.push({ type: 'tags', tags: step.tags });
    }

    if (i < stepIdx) {
      if (step.chosenIndex !== null && step.choices && step.choices[step.chosenIndex]) {
        blocks.value.push({
          type: 'chosen-choice',
          text: step.choices[step.chosenIndex].text
        });
      }
      addDivider();
    } else {
      // Current active step
      if (activeStory.value && step.stateJson) {
        try {
          activeStory.value.state.LoadJson(step.stateJson);
        } catch (e) {
          console.warn('Failed to load state JSON into story:', e);
        }
      }

      // If at the final step where the anomaly happened, show banner
      if (stepIdx === fuzzerHistory.value.length - 1 && activeReplayIssue.value) {
        blocks.value.push({
          type: 'fuzzer-issue',
          issue: activeReplayIssue.value,
          message: activeReplayIssue.value.message
        });
      }

      // Render remaining choices if any
      if (step.choices && step.choices.length > 0) {
        for (const c of step.choices) {
          blocks.value.push({
            type: 'choice',
            choice: {
              number: c.index + 1,
              choice: c,
              isFuzzerChoice: true
            }
          });
        }
      }
    }
  }

  scrollToBottom();
};

onMounted(() => {
  AutoPlayer.setEvents({
    replayIssue: injectFuzzerReplay
  });

  LiveCompiler.setEvents({
    resetting: (sessionId) => {
      isFuzzerReplayMode.value = false;
      activeStory.value = null;
      blocks.value = [];
    },
    compilerBusyChanged: (isBusy) => {
      projectStore.setCompilerBusy(isBusy);
    },
    textAdded: (text) => {
      if (!isFuzzerReplayMode.value) {
        blocks.value.push({ type: 'text', text });
        scrollToBottom();
      }
    },
    tagsAdded: (tags) => {
      if (!isFuzzerReplayMode.value) {
        blocks.value.push({ type: 'tags', tags });
        scrollToBottom();
      }
    },
    choiceAdded: (choice, isLatestTurn) => {
      if (!isFuzzerReplayMode.value && isLatestTurn) {
        blocks.value.push({ type: 'choice', choice });
        scrollToBottom();
      }
    },
    errorsAdded: (errors) => {
      projectStore.setIssues(errors);
    },
    storyCompleted: () => {
      if (!isFuzzerReplayMode.value) {
        evaluateAllWatches(() => {
          blocks.value.push({ type: 'end' });
          scrollToBottom();
        });
      }
    },
    playerPrompt: (replaying, callback) => {
      if (!isFuzzerReplayMode.value) {
        evaluateAllWatches(() => {
          if (replaying) {
            addDivider();
            callback();
          }
        });
      }
    },
    exitDueToError: () => {
      if (!isFuzzerReplayMode.value) {
        blocks.value.push({ type: 'error', message: 'Story exited due to error.' });
        scrollToBottom();
      }
    },
    unexpectedError: (err) => {
      if (!isFuzzerReplayMode.value) {
        blocks.value.push({ type: 'error', message: 'Unexpected Error: ' + err });
        scrollToBottom();
      }
    }
  });
});

const addDivider = () => {
  if (blocks.value.length > 0 && blocks.value[blocks.value.length - 1].type !== 'divider') {
    blocks.value.push({ type: 'divider' });
    scrollToBottom();
  }
};

const makeChoice = (choice) => {
  // Clear choices from this turn
  blocks.value = blocks.value.filter(b => b.type !== 'choice');
  addDivider();

  if (isFuzzerReplayMode.value && activeStory.value) {
    try {
      const chosenIdx = choice.choice.index;
      activeStory.value.ChooseChoiceIndex(chosenIdx);

      let text = '';
      while (activeStory.value.canContinue) {
        const chunk = activeStory.value.Continue();
        if (chunk) text += chunk;
      }
      const tags = activeStory.value.currentTags || [];
      const choices = (activeStory.value.currentChoices || []).map((c, i) => ({
        text: c.text,
        index: c.index !== undefined ? c.index : i
      }));
      const stateJson = activeStory.value.state.ToJson();

      // Trim any future steps and append new step
      fuzzerHistory.value = fuzzerHistory.value.slice(0, fuzzerCurrentStepIdx.value + 1);
      fuzzerHistory.value[fuzzerCurrentStepIdx.value].chosenIndex = chosenIdx;

      fuzzerHistory.value.push({
        text,
        tags,
        choices,
        chosenIndex: null,
        stateJson
      });
      fuzzerCurrentStepIdx.value++;
      activeReplayIssue.value = null; // Cleared error state on new branch

      renderFuzzerUpToStep(fuzzerCurrentStepIdx.value);
    } catch (e) {
      blocks.value.push({ type: 'error', message: 'Runtime Error: ' + (e.message || String(e)) });
      scrollToBottom();
    }
  } else {
    LiveCompiler.choose(choice);
  }
};

const rewind = () => {
  isFuzzerReplayMode.value = false;
  activeStory.value = null;
  LiveCompiler.rewind();
};

const stepBack = () => {
  if (isFuzzerReplayMode.value) {
    if (fuzzerCurrentStepIdx.value > 0) {
      fuzzerCurrentStepIdx.value--;
      renderFuzzerUpToStep(fuzzerCurrentStepIdx.value);
    }
  } else {
    LiveCompiler.stepBack();
  }
};

const formatText = (text) => {
  let formatted = text || '';
  // Bold
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  formatted = formatted.replace(/__(.*?)__/g, '<strong>$1</strong>');
  // Italic
  formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
  formatted = formatted.replace(/_(.*?)_/g, '<em>$1</em>');
  // Replace newlines with <br>
  return formatted.replace(/\n/g, '<br>');
};
</script>

<style scoped>
#simulator-container {
  width: 400px;
  background-color: var(--bg-color);
  border-left: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
}

.toolbar {
  display: flex;
  padding: 2px 10px;
  border-bottom: 1px solid var(--border-color);
  justify-content: flex-end;
  background-color: var(--sidebar-bg);
}

.icon-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  color: var(--text-color);
}

.icon-btn:hover {
  background-color: var(--hover-bg);
}

.player-content {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  font-family: 'Georgia', serif; /* fallback */
  font-size: calc(16px * var(--zoom-factor, 1));
  line-height: 1.6;
  color: var(--text-color);
}

.story-block {
  margin-bottom: 12px;
}

.story-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: -8px;
  margin-bottom: 12px;
}

.tag {
  font-size: calc(12px * var(--zoom-factor, 1));
  background-color: var(--tag-bg, #e0e0e0);
  color: var(--tag-color, #555);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: sans-serif;
}

.story-choice {
  margin-top: 16px;
  margin-bottom: 8px;
}

.choice-btn {
  background: none;
  border: none;
  color: var(--primary-color, #1976d2);
  cursor: pointer;
  font-family: inherit;
  font-size: inherit;
  text-align: left;
  padding: 4px 0;
  transition: opacity 0.2s;
}

.choice-btn:hover {
  opacity: 0.7;
}

.story-chosen-choice {
  margin: 8px 0;
  font-style: italic;
  color: var(--text-muted, #777);
  display: flex;
  gap: 6px;
}

.choice-bullet {
  font-weight: bold;
  color: var(--primary-color, #1976d2);
}

.story-divider {
  border: 0;
  border-top: 1px solid var(--border-color, #e0e0e0);
  margin: 16px 0;
}

.story-end {
  text-align: center;
  margin-top: 30px;
  font-style: italic;
  color: var(--text-muted, #888);
}

.story-error {
  color: var(--error-color, #d32f2f);
  font-weight: bold;
}

.story-fuzzer-issue {
  margin: 16px 0;
}

.fuzzer-issue-banner {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--border-color, #e0e0e0);
  background-color: var(--hover-bg, rgba(0, 0, 0, 0.03));
}

.story-fuzzer-issue.runtime_error .fuzzer-issue-banner {
  border-color: var(--error-color, #d32f2f);
  background-color: rgba(211, 47, 47, 0.08);
}
.story-fuzzer-issue.runtime_error .issue-banner-icon {
  color: var(--error-color, #d32f2f);
}

.story-fuzzer-issue.loose_end .fuzzer-issue-banner {
  border-color: var(--warning-color, #f57c00);
  background-color: rgba(245, 124, 0, 0.08);
}
.story-fuzzer-issue.loose_end .issue-banner-icon {
  color: var(--warning-color, #f57c00);
}

.story-fuzzer-issue.infinite_loop .fuzzer-issue-banner {
  border-color: #9c27b0;
  background-color: rgba(156, 39, 176, 0.08);
}
.story-fuzzer-issue.infinite_loop .issue-banner-icon {
  color: #9c27b0;
}

.story-fuzzer-issue.outlier .fuzzer-issue-banner {
  border-color: #0288d1;
  background-color: rgba(2, 136, 209, 0.08);
}
.story-fuzzer-issue.outlier .issue-banner-icon {
  color: #0288d1;
}

.issue-banner-icon {
  font-size: 24px;
  flex-shrink: 0;
  margin-top: 2px;
}

.issue-banner-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.issue-banner-title {
  font-weight: 700;
  font-size: calc(13px * var(--zoom-factor, 1));
}

.issue-banner-msg {
  font-size: calc(13px * var(--zoom-factor, 1));
  word-break: break-word;
}

.issue-banner-sub {
  font-size: calc(11px * var(--zoom-factor, 1));
  color: var(--text-muted, #777);
  margin-top: 4px;
}

.story-watch-result {
  text-align: center;
  margin: 16px 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.watch-pill {
  background-color: var(--watch-bg, #e0e0e0);
  color: var(--watch-color, #555);
  padding: 4px 16px;
  border-radius: 16px;
  font-size: calc(13px * var(--zoom-factor, 1));
  display: inline-block;
  font-family: monospace;
}

.watch-pill.error {
  background-color: var(--error-color, #d32f2f);
  color: white;
}
</style>
