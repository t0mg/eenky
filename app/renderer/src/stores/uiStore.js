import { defineStore } from 'pinia'

export const useUiStore = defineStore('ui', {
  state: () => ({
    activeView: 'home', // 'home', 'editor'
    animationEnabled: true,
    showSimulator: false,
    showFileBrowser: true,
    showKnotBrowser: true,
    showToolbar: true,
    isFullscreen: false,
    theme: 'light',
    zoom: '100',
    autoCompleteDisabled: false,
    lineWrap: true,
    sidebarWidth: 250,
    simulatorWidth: 350,
    selectedText: '',
    modalState: {
      isOpen: false,
      type: '',
      data: null,
      resolve: null,
    }
  }),
  actions: {
    setLineWrap(wrap) {
      this.lineWrap = wrap;
    },
    setAnimationEnabled(enabled) {
      this.animationEnabled = enabled;
      document.body.classList.toggle('no-animations', !enabled);
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
    setIsFullscreen(full) {
      this.isFullscreen = full;
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
      this.modalState = { isOpen: true, type, data, resolve: null };
    },
    alert(options) {
      const opts = typeof options === 'string' ? { message: options } : (options || {});
      return new Promise((resolve) => {
        this.modalState = {
          isOpen: true,
          type: 'alert',
          data: {
            title: opts.title || 'Notification',
            message: opts.message || '',
            okText: opts.okText || 'OK',
            isError: opts.isError || false,
          },
          resolve,
        };
      });
    },
    confirm(options) {
      const opts = typeof options === 'string' ? { message: options } : (options || {});
      return new Promise((resolve) => {
        this.modalState = {
          isOpen: true,
          type: 'confirm',
          data: {
            title: opts.title || 'Confirm',
            message: opts.message || '',
            okText: opts.okText || 'OK',
            cancelText: opts.cancelText || 'Cancel',
            dangerous: opts.dangerous || false,
          },
          resolve,
        };
      });
    },
    closeModal(result = null) {
      if (this.modalState.resolve) {
        this.modalState.resolve(result);
      }
      this.modalState = { isOpen: false, type: '', data: null, resolve: null };
    }
  }
});
