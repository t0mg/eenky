const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    // Basic IPC
    send: (channel, data) => {
        let validChannels = ['show-context-menu', 'project-stats', 'app-state-changed', 'project-final-close', 'project-cancelled-close', 'main-file-saved'];
        if (validChannels.includes(channel)) {
            ipcRenderer.send(channel, data);
        }
    },
    receive: (channel, func) => {
        let validChannels = [
            'change-theme', 'set-animation-enabled', 'set-autocomplete-disabled',
            'project-new-include', 'project-save', 'project-export',
            'project-export-for-web', 'project-export-js-only', 'project-tryClose',
            'set-project-main-ink-filepath', 'open-main-ink', 'project-settings-changed',
            'insertSnippet', 'eenk:trigger-compile', 'eenk:launch-simulator',
            'toggle-toolbar', 'toggle-file-browser', 'toggle-knot-browser', 'toggle-preview',
            'zoom', 'goto-anything', 'add-watch-expression', 'set-tags-visible',
            'keyboard-shortcuts', 'project-stats', 'find', 'replace', 'show-about'
        ];
        if (validChannels.includes(channel)) {
            // Deliberately strip event as it includes `sender` 
            ipcRenderer.on(channel, (event, ...args) => func(...args));
        }
    },
    invoke: (channel, data, data2) => {
        let validChannels = ['eenk:open-file-dialog', 'eenk:get-recent-files', 'eenk:open-project', 'eenk:new-project', 'showSaveDialog', 'try-close', 'launch-simulator', 'eenk:compile', 'eenk:sim-launch', 'get-template-dir', 'change-theme', 'set-view-setting'];
        if (validChannels.includes(channel)) {
            return ipcRenderer.invoke(channel, data, data2);
        }
    },

    // File System operations
    fs: {
        readFile: (filePath, options) => ipcRenderer.invoke('fs:readFile', filePath, options),
        writeFile: (filePath, data, options) => ipcRenderer.invoke('fs:writeFile', filePath, data, options),
        exists: (filePath) => ipcRenderer.invoke('fs:exists', filePath),
        unlink: (filePath) => ipcRenderer.invoke('fs:unlink', filePath),
        stat: (filePath) => ipcRenderer.invoke('fs:stat', filePath),
        mkdir: (dirPath) => ipcRenderer.invoke('fs:mkdir', dirPath),
        copyFile: (src, dest) => ipcRenderer.invoke('fs:copyFile', src, dest),
        readdir: (dirPath) => ipcRenderer.invoke('fs:readdir', dirPath),
        rename: (oldPath, newPath) => ipcRenderer.invoke('fs:rename', oldPath, newPath),
        watch: (dirPath) => ipcRenderer.invoke('fs:watch', dirPath),
        unwatch: (dirPath) => ipcRenderer.invoke('fs:unwatch', dirPath),
        onWatcherEvent: (func) => ipcRenderer.on('fs:watcher-event', (event, ...args) => func(...args)),
    },
    
    // Path operations
    path: {
        join: (...paths) => ipcRenderer.invoke('path:join', ...paths),
        basename: (p, ext) => ipcRenderer.invoke('path:basename', p, ext),
        dirname: (p) => ipcRenderer.invoke('path:dirname', p),
        relative: (from, to) => ipcRenderer.invoke('path:relative', from, to),
        extname: (p) => ipcRenderer.invoke('path:extname', p),
        resolve: (...paths) => ipcRenderer.invoke('path:resolve', ...paths),
        format: (pathObject) => ipcRenderer.invoke('path:format', pathObject),
        parse: (p) => ipcRenderer.invoke('path:parse', p),
    },

    // Compiler IPCs
    compiler: {
        sendCompile: (data) => ipcRenderer.send('eenk:compile', data),
        onCompileComplete: (func) => ipcRenderer.on('eenk:compile-complete', (event, ...args) => func(...args)),
        onCompileError: (func) => ipcRenderer.on('eenk:compile-error', (event, ...args) => func(...args)),
        // live compiler
        onLiveCompileStatus: (func) => ipcRenderer.on('eenk:live-compile-status', (event, ...args) => func(...args)),
    },

    i18n: {
        _: (msgid) => ipcRenderer.sendSync('i18n._', msgid)
    },

    liveCompiler: {
        send: (channel, ...args) => {
            const valid = ['compile', 'play-stop-ink', 'play-continue-with-choice-number', 'get-location-in-source', 'get-runtime-path-in-source', 'evaluate-expression'];
            if (valid.includes(channel)) ipcRenderer.send(channel, ...args);
        },
        on: (channel, func) => {
            const valid = ['next-issue', 'compile-complete', 'play-generated-text', 'play-generated-errors', 'play-generated-tags', 'play-generated-choice', 'play-requires-input', 'inklecate-complete', 'play-exit-due-to-error', 'play-story-unexpected-error', 'play-story-stopped', 'return-location-from-source', 'play-evaluated-expression', 'play-evaluated-expression-error', 'return-stats'];
            if (valid.includes(channel)) ipcRenderer.on(channel, (event, ...args) => func(...args));
        }
    },

    onThemeChange: (func) => ipcRenderer.on('change-theme', (event, theme) => func(theme)),
    onShowModal: (func) => ipcRenderer.on('show-modal', (event, type, data) => func(type, data)),
    onSetAboutData: (func) => ipcRenderer.on('set-about-data', (event, data) => func(data))
});
