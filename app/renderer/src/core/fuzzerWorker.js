import { FuzzerEngine } from './fuzzerEngine.js';

let isRunning = false;
let currentEngine = null;
let currentStoryJson = null;
let batchTimeoutId = null;
let lastProgressPostTime = 0;
const PROGRESS_THROTTLE_MS = 500;
const TIME_SLICE_MS = 100;

self.onmessage = function (e) {
  const data = e.data;
  if (!data) return;

  if (data.type === 'start') {
    stopCurrent();
    currentStoryJson = data.storyJson;
    currentEngine = new FuzzerEngine(data.config || {});
    isRunning = true;
    lastProgressPostTime = Date.now();
    runNextBatch();
  } else if (data.type === 'stop') {
    stopCurrent();
    self.postMessage({ type: 'stopped' });
  }
};

function stopCurrent() {
  isRunning = false;
  if (batchTimeoutId) {
    clearTimeout(batchTimeoutId);
    batchTimeoutId = null;
  }
}

function runNextBatch() {
  if (!isRunning || !currentEngine || !currentStoryJson) return;

  const sliceStart = Date.now();
  const maxRunsPerSlice = currentEngine.batchSize || 50;
  let runsInSlice = 0;
  let newIssueFound = false;

  while (isRunning && runsInSlice < maxRunsPerSlice) {
    const result = currentEngine.runSingleSimulation(currentStoryJson);
    const isNew = currentEngine.recordSimulationResult(result);
    if (isNew) {
      newIssueFound = true;
    }
    runsInSlice++;

    const termCheck = currentEngine.shouldTerminate();
    if (termCheck.shouldStop) {
      isRunning = false;
      self.postMessage({
        type: 'complete',
        reason: termCheck.reason,
        issues: currentEngine.getIssuesList(),
        stats: currentEngine.getStats()
      });
      return;
    }

    // Yield slice if time budget exceeded so the worker message loop stays responsive
    if (Date.now() - sliceStart >= TIME_SLICE_MS) {
      break;
    }
  }

  if (isRunning) {
    const now = Date.now();
    const runs = currentEngine.runsCompleted;
    // Post progress if:
    // 1) First run just finished (so UI immediately jumps from 0 to 1 run)
    // 2) A new issue was discovered
    // 3) Enough time has elapsed since last progress post (500ms)
    if (runs === 1 || newIssueFound || (now - lastProgressPostTime >= PROGRESS_THROTTLE_MS)) {
      lastProgressPostTime = now;
      self.postMessage({
        type: 'progress',
        issues: currentEngine.getIssuesList(),
        stats: currentEngine.getStats()
      });
    }

    // Schedule next slice with 0ms delay to yield to message loop
    batchTimeoutId = setTimeout(runNextBatch, 0);
  }
}
