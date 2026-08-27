import { FuzzerEngine } from './fuzzerEngine.js';

let isRunning = false;
let currentEngine = null;
let currentStoryJson = null;
let batchTimeoutId = null;

self.onmessage = function (e) {
  const data = e.data;
  if (!data) return;

  if (data.type === 'start') {
    stopCurrent();
    currentStoryJson = data.storyJson;
    currentEngine = new FuzzerEngine(data.config || {});
    isRunning = true;
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

  const batchSize = currentEngine.batchSize || 50;
  for (let i = 0; i < batchSize; i++) {
    if (!isRunning) break;

    const result = currentEngine.runSingleSimulation(currentStoryJson);
    currentEngine.recordSimulationResult(result);

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
  }

  if (isRunning) {
    self.postMessage({
      type: 'progress',
      issues: currentEngine.getIssuesList(),
      stats: currentEngine.getStats()
    });

    // Schedule next batch with 0ms delay to yield to message loop
    batchTimeoutId = setTimeout(runNextBatch, 0);
  }
}
