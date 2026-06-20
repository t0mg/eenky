import { defineStore } from 'pinia'
import { useUiStore } from './uiStore'

export const useProjectStore = defineStore('project', {
  state: () => ({
    files: [],
    mainInkFile: null,
    activeInkFile: null,
    hasUnsavedChanges: false,
    compilerBusy: false,
    issues: [],
    ready: false,
    instructionPrefix: "",
  }),
  actions: {
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
    setHasUnsavedChanges(unsaved) {
      this.hasUnsavedChanges = unsaved;
    },
    closeProject() {
      this.files = [];
      this.mainInkFile = null;
      this.activeInkFile = null;
      this.hasUnsavedChanges = false;
      this.compilerBusy = false;
      this.issues = [];
      this.ready = false;
      const uiStore = useUiStore();
      uiStore.setActiveView('home');
    }
  }
});
