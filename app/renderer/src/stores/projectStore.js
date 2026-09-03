import { defineStore } from 'pinia'
import { useUiStore } from './uiStore'

export const useProjectStore = defineStore('project', {
  state: () => ({
    files: [],
    mainInkFile: null,
    activeInkFile: null,
    compilerBusy: false,
    issues: [],
    ready: false,
    instructionPrefix: "",
    autoPlayerEnabled: true,
    autoPlayerStatus: 'idle', // 'idle', 'running', 'paused', 'complete'
    autoPlayerIssues: [],
    autoPlayerStats: {
      runsCompleted: 0,
      uniqueIssuesCount: 0,
      meanLength: 0,
      stdDevLength: 0,
      milestonesDiscoveredCount: 0,
      milestonesList: [],
      maxCheckpointsInSingleRun: 0
    },
    compiledStoryJson: null,
    currentRngSeed: null,
  }),
  getters: {
    hasUnsavedChanges(state) {
      return state.files.some(f => f.hasUnsavedChanges);
    },
    isScriptRngSeedLocked(state) {
      const stripComments = (str) => {
        if (!str) return '';
        return str
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/\/\/.*/g, '');
      };
      const regex = /\bSEED_RANDOM\s*\(/i;
      for (const f of state.files) {
        if (f.content && regex.test(stripComments(f.content))) {
          return true;
        }
      }
      if (state.compiledStoryJson) {
        const jsonStr = typeof state.compiledStoryJson === 'string'
          ? state.compiledStoryJson
          : JSON.stringify(state.compiledStoryJson);
        if (jsonStr.includes('"srnd"')) {
          return true;
        }
      }
      return false;
    }
  },
  actions: {
    setAutoPlayerEnabled(enabled) {
      this.autoPlayerEnabled = enabled;
    },
    setAutoPlayerStatus(status) {
      this.autoPlayerStatus = status;
    },
    setAutoPlayerIssues(issues) {
      this.autoPlayerIssues = issues;
    },
    setAutoPlayerStats(stats) {
      this.autoPlayerStats = { ...this.autoPlayerStats, ...stats };
    },
    setCompiledStoryJson(json) {
      this.compiledStoryJson = json;
    },
    clearAutoPlayerIssues() {
      this.autoPlayerIssues = [];
      this.autoPlayerStats = {
        runsCompleted: 0,
        uniqueIssuesCount: 0,
        meanLength: 0,
        stdDevLength: 0,
        milestonesDiscoveredCount: 0,
        milestonesList: [],
        maxCheckpointsInSingleRun: 0
      };
    },
    setProjectInfo({ files, mainInkFile, instructionPrefix }) {
      this.files = files;
      this.mainInkFile = mainInkFile;
      this.instructionPrefix = instructionPrefix;
      
      const uiStore = useUiStore();
      if (this.mainInkFile) {
        uiStore.setActiveView('editor');
      } else {
        uiStore.setActiveView('home');
      }
    },
    setActiveFile(file) {
      if (this.activeInkFile) {
        this.activeInkFile.isActive = false;
      }
      this.activeInkFile = file;
      if (this.activeInkFile) {
        this.activeInkFile.isActive = true;
      }
    },
    addFile(file) {
      if (!this.files.find(f => f.id === file.id)) {
        this.files.push(file);
      }
    },
    removeFile(fileId) {
      this.files = this.files.filter(f => f.id !== fileId);
      if (this.activeInkFile && this.activeInkFile.id === fileId) {
        this.setActiveFile(this.mainInkFile);
      }
    },
    setCompilerBusy(busy) {
      this.compilerBusy = busy;
    },
    setIssues(issues) {
      this.issues = issues;
    },
    setCurrentRngSeed(seed) {
      this.currentRngSeed = seed;
    },
    rollNewRngSeed() {
      const newSeed = Math.floor(Math.random() * 1000000) + 1;
      this.currentRngSeed = newSeed;
      return newSeed;
    },
    closeProject() {
      this.files = [];
      this.mainInkFile = null;
      this.activeInkFile = null;
      this.compilerBusy = false;
      this.issues = [];
      this.ready = false;
      this.autoPlayerIssues = [];
      this.autoPlayerStatus = 'idle';
      this.compiledStoryJson = null;
      this.currentRngSeed = null;
      const uiStore = useUiStore();
      uiStore.setActiveView('home');
    }
  }
});
