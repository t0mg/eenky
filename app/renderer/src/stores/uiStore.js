import { defineStore } from 'pinia'

export const useUiStore = defineStore('ui', {
  state: () => ({
    activeView: 'home', // 'home', 'editor'
    showSimulator: true,
    showFileBrowser: true,
    showKnotBrowser: true,
    showSimulator: false,
    showToolbar: true,
    theme: 'light',
    zoom: '100',
    autoCompleteDisabled: false,
    lineWrap: true,
    sidebarWidth: 250,
    simulatorWidth: 350,
    modalState: {
      isOpen: false,
      type: '',
      data: null
    }
  }),
  actions: {
    setLineWrap(wrap) {
      this.lineWrap = wrap;
    },
    setActiveView(view) {
      this.activeView = view;
    },
    toggleSimulator() {
      this.showSimulator = !this.showSimulator;
    },
    toggleFileBrowser() {
      this.showFileBrowser = !this.showFileBrowser;
    },
    toggleKnotBrowser() {
      this.showKnotBrowser = !this.showKnotBrowser;
    },
    setTheme(theme) {
      this.theme = theme;
      if (theme === 'system' || theme === 'os') {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.body.className = isDark ? 'dark' : 'light';
      } else {
        document.body.className = theme;
      }
    },
    setAutoCompleteDisabled(disabled) {
      this.autoCompleteDisabled = disabled;
    },
    setShowToolbar(show) {
      this.showToolbar = show;
    },
    setShowFileBrowser(show) {
      this.showFileBrowser = show;
    },
    setShowKnotBrowser(show) {
      this.showKnotBrowser = show;
    },
    setShowPreview(show) {
      this.showPreview = show;
    },
    setZoom(zoom) {
      this.zoom = zoom;
      const zoomFactor = parseInt(zoom) / 100;
      document.documentElement.style.setProperty('--cm-font-size', (14 * zoomFactor) + 'px');
      document.documentElement.style.setProperty('--zoom-factor', zoomFactor);
      document.body.style.zoom = ''; // Reset any legacy zoom
    },
    setSidebarWidth(width) {
      this.sidebarWidth = width;
    },
    setSimulatorWidth(width) {
      this.simulatorWidth = width;
    },
    openModal(type, data = null) {
      this.modalState = { isOpen: true, type, data };
    },
    closeModal() {
      this.modalState = { isOpen: false, type: '', data: null };
    }
  }
});
