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
    autoPlayerStats: { runsCompleted: 0, uniqueIssuesCount: 0, meanLength: 0, stdDevLength: 0 },
    compiledStoryJson: null,
  }),
  getters: {
    hasUnsavedChanges(state) {
      return state.files.some(f => f.hasUnsavedChanges);
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
      this.autoPlayerStats = { runsCompleted: 0, uniqueIssuesCount: 0, meanLength: 0, stdDevLength: 0 };
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
      const uiStore = useUiStore();
      uiStore.setActiveView('home');
    }
  }
});
