import { useProjectStore } from '../stores/projectStore.js';
import { useUiStore } from '../stores/uiStore.js';
import { FuzzerEngine } from './fuzzerEngine.js';

class AutoPlayerController {
  constructor() {
    this.worker = null;
    this.idleTimer = null;
    this.idleDelayMs = 1500;
    this.currentStoryJson = null;
    this.directEngine = null;
    this.events = {};
  }

  init() {
    // Listen for menu toggle IPC from main process
    if (window.api && window.api.receive) {
      window.api.receive('toggle-auto-player', () => {
        this.toggle();
      });
    }
  }

  setEvents(e) {
    Object.assign(this.events, e);
  }

  get isEnabled() {
    const store = useProjectStore();
    return store.autoPlayerEnabled;
  }

  setEnabled(enabled) {
    const store = useProjectStore();
    store.setAutoPlayerEnabled(enabled);

    if (!enabled) {
      this.stop();
      store.setAutoPlayerStatus('paused');
    } else {
      store.setAutoPlayerStatus('idle');
      if (this.currentStoryJson) {
        this.scheduleStart();
      }
    }
  }

  toggle() {
    this.setEnabled(!this.isEnabled);
  }

  onStoryEdited() {
    this.stop();
    const store = useProjectStore();
    if (store.autoPlayerEnabled) {
      store.setAutoPlayerStatus('idle');
    }
  }

  onStoryCompiled(storyJson) {
    this.currentStoryJson = storyJson;
    const store = useProjectStore();
    store.setCompiledStoryJson(storyJson);

    if (!store.autoPlayerEnabled) {
      store.setAutoPlayerStatus('paused');
      return;
    }

    this.scheduleStart();
  }

  scheduleStart() {
    this.stop();
    const store = useProjectStore();
    store.setAutoPlayerStatus('idle');

    if (!this.currentStoryJson || !store.autoPlayerEnabled) return;

    this.idleTimer = setTimeout(() => {
      this.start();
    }, this.idleDelayMs);
  }

  start() {
    if (!this.currentStoryJson || !this.isEnabled) return;

    const store = useProjectStore();
    store.clearAutoPlayerIssues();
    store.setAutoPlayerStatus('running');

    // Use Web Worker if available, otherwise fallback to asynchronous chunks
    if (typeof Worker !== 'undefined') {
      try {
        if (!this.worker) {
          this.worker = new Worker(new URL('./fuzzerWorker.js', import.meta.url), { type: 'module' });
          this.worker.onmessage = (e) => this.handleWorkerMessage(e.data);
          this.worker.onerror = (err) => {
            console.error('Fuzzer worker error, falling back to direct runner:', err);
            this.worker = null;
            this.startDirect();
          };
        }

        this.worker.postMessage({
          type: 'start',
          storyJson: this.currentStoryJson,
          config: {
            maxTurnsPerRun: 10000,
            maxTotalRuns: 5000,
            stableRunsThreshold: 5000,
            batchSize: 50
          }
        });
        return;
      } catch (err) {
        console.warn('Could not initialize fuzzer Web Worker, using direct engine:', err);
      }
    }

    this.startDirect();
  }

  startDirect() {
    const store = useProjectStore();
    this.directEngine = new FuzzerEngine({
      maxTurnsPerRun: 10000,
      maxTotalRuns: 5000,
      stableRunsThreshold: 5000,
      batchSize: 50
    });

    const runChunk = () => {
      if (store.autoPlayerStatus !== 'running' || !this.directEngine) return;

      const batchSize = this.directEngine.batchSize;
      for (let i = 0; i < batchSize; i++) {
        const result = this.directEngine.runSingleSimulation(this.currentStoryJson);
        this.directEngine.recordSimulationResult(result);

        const term = this.directEngine.shouldTerminate();
        if (term.shouldStop) {
          store.setAutoPlayerIssues(this.directEngine.getIssuesList());
          store.setAutoPlayerStats(this.directEngine.getStats());
          store.setAutoPlayerStatus('complete');
          return;
        }
      }

      store.setAutoPlayerIssues(this.directEngine.getIssuesList());
      store.setAutoPlayerStats(this.directEngine.getStats());

      setTimeout(runChunk, 10);
    };

    runChunk();
  }

  handleWorkerMessage(data) {
    if (!data) return;
    const store = useProjectStore();

    if (data.type === 'progress') {
      store.setAutoPlayerIssues(data.issues || []);
      store.setAutoPlayerStats(data.stats || {});
      store.setAutoPlayerStatus('running');
    } else if (data.type === 'complete') {
      store.setAutoPlayerIssues(data.issues || []);
      store.setAutoPlayerStats(data.stats || {});
      store.setAutoPlayerStatus('complete');
    }
  }

  stop() {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }

    if (this.worker) {
      this.worker.postMessage({ type: 'stop' });
    }

    this.directEngine = null;
  }

  restart() {
    this.scheduleStart();
  }

  replayIssue(issue) {
    if (!issue) return;

    const uiStore = useUiStore();
    uiStore.setShowPreview(true);

    if (this.events.replayIssue) {
      this.events.replayIssue(issue, this.currentStoryJson);
    }
  }
}

export const AutoPlayer = new AutoPlayerController();
