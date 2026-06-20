<template>
  <div id="simulator-container">
    <div class="toolbar">
      <button class="icon-btn" @click="rewind" title="Restart story">
        <span class="material-symbols-outlined">restart_alt</span>
      </button>
      <button class="icon-btn" @click="stepBack" title="Step back">
        <span class="material-symbols-outlined">undo</span>
      </button>
    </div>
    
    <div class="expressionWatch" v-if="watchExpressions.length > 0">
      <table class="expressionTable" style="width: 100%; border-collapse: collapse;">
        <tr v-for="(watchObj, index) in watchExpressions" :key="index">
          <td class="expressionLabel" style="width: 80px; font-size: 0.9em; color: var(--text-muted, #777); padding-left: 8px;">Every turn:</td>
          <td class="expressionInput" style="display: flex; align-items: center; justify-content: space-between;">
            <input 
              type="text" 
              v-model="watchObj.expr" 
              @change="evaluateAllWatches"
              placeholder="x is {x}"
              style="flex: 1; border: none; background: transparent; color: inherit; padding: 4px; outline: none; font-family: monospace;"
            />
            <button class="removeButton icon-btn" @click="removeWatch(index)" style="background: none; border: none; color: inherit; cursor: pointer; padding: 4px; display: flex; align-items: center; justify-content: center;">
              <span class="material-symbols-outlined" style="font-size: 16px;">cancel</span>
            </button>
          </td>
        </tr>
      </table>
      <div v-if="watchResults.length > 0" class="evaluationResults">
        <div v-for="(res, i) in watchResults" :key="i" class="evaluationResult" :class="{ error: res.error }">
          <span v-if="res.result !== null">{{ res.result }}</span>
        </div>
      </div>
    </div>
    
    <div class="player-content" ref="scrollContainer">
      <div v-for="(block, index) in blocks" :key="index" class="story-block">
        <div v-if="block.type === 'text'" class="story-text" v-html="formatText(block.text)"></div>
        <div v-else-if="block.type === 'tags'" class="story-tags">
          <span v-for="tag in block.tags" :key="tag" class="tag"># {{ tag }}</span>
        </div>
        <div v-else-if="block.type === 'choice'" class="story-choice">
          <button @click="makeChoice(block.choice)" class="choice-btn">
            {{ block.choice.choice.text }}
          </button>
        </div>
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
import { ref, onMounted, nextTick } from 'vue';
import { LiveCompiler } from '../core/liveCompiler.js';
import { useProjectStore } from '../stores/projectStore';

const projectStore = useProjectStore();
const blocks = ref([]);
const scrollContainer = ref(null);
const watchExpressions = ref([]);
const watchResults = ref([]);

const evaluateAllWatches = () => {
  if (watchExpressions.value.length === 0) {
    watchResults.value = [];
    return;
  }
  
  // Create a clean copy of the expressions to evaluate
  const expressionsToEval = watchExpressions.value.map(w => w.expr);
  watchResults.value = new Array(expressionsToEval.length).fill({ result: null, error: false });
  
  // Evaluate them sequentially since the backend only supports one callback at a time
  const evalNext = (index) => {
    if (index >= expressionsToEval.length) return;
    
    const expr = expressionsToEval[index];
    if (!expr || expr.trim() === '') {
      watchResults.value[index] = { result: null, error: false };
      evalNext(index + 1);
      return;
    }
    
    LiveCompiler.evaluateExpression(expr, (result, error) => {
      if (error) {
        watchResults.value[index] = { result: error, error: true };
      } else {
        watchResults.value[index] = { result: result, error: false };
      }
      evalNext(index + 1);
    });
  };
  
  evalNext(0);
};

const addWatchExpression = () => {
  watchExpressions.value.push({ expr: '' });
  watchResults.value.push({ result: null, error: false });
};

const removeWatch = (index) => {
  watchExpressions.value.splice(index, 1);
  watchResults.value.splice(index, 1);
  evaluateAllWatches();
};

window.api.receive("add-watch-expression", () => {
  addWatchExpression();
});

const scrollToBottom = async () => {
  await nextTick();
  if (scrollContainer.value) {
    scrollContainer.value.scrollTop = scrollContainer.value.scrollHeight;
  }
};

onMounted(() => {
  LiveCompiler.setEvents({
    resetting: (sessionId) => {
      blocks.value = [];
    },
    compilerBusyChanged: (isBusy) => {
      projectStore.setCompilerBusy(isBusy);
    },
    textAdded: (text) => {
      blocks.value.push({ type: 'text', text });
      scrollToBottom();
    },
    tagsAdded: (tags) => {
      blocks.value.push({ type: 'tags', tags });
      scrollToBottom();
    },
    choiceAdded: (choice, isLatestTurn) => {
      if (isLatestTurn) {
        blocks.value.push({ type: 'choice', choice });
        scrollToBottom();
      }
      evaluateAllWatches();
    },
    errorsAdded: (errors) => {
      projectStore.setIssues(errors);
    },
    storyCompleted: () => {
      blocks.value.push({ type: 'end' });
      scrollToBottom();
    },
    playerPrompt: (replaying, callback) => {
      evaluateAllWatches();
      if (replaying) {
        callback();
      }
    },
    exitDueToError: () => {
      blocks.value.push({ type: 'error', message: 'Story exited due to error.' });
      scrollToBottom();
    },
    unexpectedError: (err) => {
      blocks.value.push({ type: 'error', message: 'Unexpected Error: ' + err });
      scrollToBottom();
    }
  });
});

const makeChoice = (choice) => {
  // Clear choices from this turn
  blocks.value = blocks.value.filter(b => b.type !== 'choice');
  LiveCompiler.choose(choice);
};

const rewind = () => {
  LiveCompiler.rewind();
};

const stepBack = () => {
  LiveCompiler.stepBack();
};

const formatText = (text) => {
  // Replace newlines with <br>
  return text.replace(/\n/g, '<br>');
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
  font-family: 'Georgia', serif;
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
</style>
