const {app, BrowserWindow, ipcMain, dialog, ipcRenderer, Menu, session} = require('electron')
const path = require('path');
const isDev = process.env.NODE_ENV !== 'production';

if (isDev) {
    process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';
}

const i18n = require("./i18n/i18n.js")
const {ProjectWindow} = require("./projectWindow.js");
const {DocumentationWindow} = require("./documentationWindow.js");
const {AboutWindow} = require("./aboutWindow.js");
const {AppMenus} = require('./appmenus.js');
const {onForceQuit} = require('./forceQuitDetect');
const {Inklecate} = require("./inklecate.js");
const { fstat } = require('original-fs');
const fs = require("fs");

// Set the app name so that the OS and default menus display "EENKY" instead of "Electron"
app.setName('EENKY');

// ── EENK extensions ───────────────────────────────────────────────────────────
require('./eenkCompiler.js');   // registers eenk:compile IPC
const { stopSimulator } = require('./simulator.js'); // registers eenk:sim-* IPC

// IPC: open file dialog (used by compiler + simulator panels)
ipcMain.handle('eenk:open-file-dialog', async (event, opts) => {
    return dialog.showOpenDialog(opts || {});
});

ipcMain.handle('eenk:get-recent-files', async () => {
    return ProjectWindow.getRecentFiles();
});
ipcMain.handle('eenk:open-project', async (event, filePath) => {
    ProjectWindow.open(filePath);
});
ipcMain.handle('eenk:new-project', async () => {
    ProjectWindow.createEmpty();
});


function inkJSNeedsUpdating() {
    return false;
    // dialog.showMessageBox({
    //   type: 'error',
    //   buttons: ['Okay'],
    //   title: 'Export for web unavailable',
    //   message: "Sorry, export for web is currently disabled, until inkjs is updated to support the latest version of ink. You can download a previous version of Inky that supports inkjs and use that instead, although some of the latest features of ink may be missing."
    // });
    // return true;
}

// main
let pendingPathToOpen = null;
let hasFinishedLaunch = false;

// main
ipcMain.on('show-context-menu', (event, options) => {
    const template = [
        {
            label: 'Cut',
            role: 'cut' 
        },
        {
            label: 'Copy',
            role: 'copy' 
        },
        {
            label: 'Paste',
            role: 'paste' 
        }
    ];

    if (options && options.type === 'editor') {
        template.push({ type: 'separator' });
        template.push({ 
            label: 'Find / Replace', 
            click: () => { event.sender.send("find"); } 
        });
    }

    const menu = Menu.buildFromTemplate(template);
    menu.popup(BrowserWindow.fromWebContents(event.sender));
});


ipcMain.handle("showSaveDialog", async (event, options) => {
    return await dialog.showSaveDialog(BrowserWindow.fromWebContents(event.sender), options);
});

ipcMain.handle('change-theme', async (event, nextTheme) => {
    // We update the view settings
    ProjectWindow.addOrChangeViewSetting('theme', nextTheme);
    AboutWindow.changeTheme(nextTheme);
    DocumentationWindow.changeTheme(nextTheme);

    // Let the main menu know
    AppMenus.setTheme(nextTheme);
    AppMenus.refresh(AppMenus.currentState);

    for (let window of ProjectWindow.all()) {
        window.browserWindow.webContents.send('change-theme', nextTheme);
    }
});

ipcMain.handle('set-view-setting', async (event, key, value) => {
    ProjectWindow.addOrChangeViewSetting(key, value);
});

ipcMain.handle("showMessageBox", async (event, options) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    return dialog.showMessageBox(win, options);
})

ipcMain.handle("try-close", async (event) =>{
    return dialog.showMessageBox({
        type: "warning",
        message: i18n._("Would you like to save changes before exiting?"),
        detail: i18n._("Your changes will be lost if you don't save."),
        buttons: [
            i18n._("Save"),
            i18n._("Don't save"),
            i18n._("Cancel")
        ],
        defaultId: 0
    })
    
})

ipcMain.on("compile", (event, compileInstruction) => {
    console.log("Received compile IPC, session: ", compileInstruction.sessionId);
    Inklecate.compile(compileInstruction, event.sender);
});

app.on('web-contents-created', (event, contents) => {
    contents.on('console-message', (event, level, message, line, sourceId) => {
        console.log(`[Renderer] ${sourceId}:${line} - ${message}`);
    });
});

app.on('will-finish-launching', function () {
    app.on("open-file", function (event, path) {
        ProjectWindow.open(path);
        event.preventDefault();
    });

});

let isQuitting = false;

app.on("open-file", function (event, path) {

    // e.g. Drag and drop onto app to open it.
    // "open-file" seems to come before "will-finish-launching"
    if( !hasFinishedLaunch ) {
        pendingPathToOpen = path;
    }
    
    // Drag and drop onto app while it's already open
    else {

        // See if this root file is already open in an existing window
        let existingWin = ProjectWindow.withMainkInkPath(path);
        if( existingWin ) {
            existingWin.browserWindow.focus();
            existingWin.browserWindow.webContents.send('open-main-ink');
        } else {
            ProjectWindow.open(path);       
        }
    }
    
    event.preventDefault();
});

app.on('before-quit', function () {
    // We need this to differentiate between pressing quit (which should quit) or closing all windows
    // (which leaves the app open)
    isQuitting = true;
});

ipcMain.on("project-cancelled-close", (event) => {
    isQuitting = false;
    var win = ProjectWindow.withBrowserWindow(event.sender.getOwnerBrowserWindow());
    if( win ) win.cancelClose();
});

ipcMain.handle("get-template-dir", () => {
    return path.join(__dirname, "..", "export-for-web-template");
});

ipcMain.on('app-state-changed', (event, state) => {
    AppMenus.refresh(state);
});



ipcMain.handle('launch-simulator', async (event) => {
    var win = ProjectWindow.withBrowserWindow(event.sender.getOwnerBrowserWindow());
    if (win) win.browserWindow.webContents.send('eenk:launch-simulator');
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', function () {

    // ── Web Serial permission (required for esp-web-tools flasher) ────────────
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
        if (permission === 'serial') {
            callback(true);
        } else {
            callback(false);
        }
    });
    session.defaultSession.setDevicePermissionHandler((details) => {
        if (details.deviceType === 'serial') return true;
        return false;
    });

    session.defaultSession.on('select-serial-port', (event, portList, webContents, callback) => {
        event.preventDefault();
        
        let callbackFired = false;
        const safeCallback = (portId) => {
            if (!callbackFired) {
                callbackFired = true;
                callback(portId);
            }
        };

        if (portList && portList.length > 0) {
            const template = portList.map(port => ({
                label: port.displayName || port.portName || port.portId,
                click: () => {
                    safeCallback(port.portId);
                }
            }));
            template.push({ type: 'separator' });
            template.push({
                label: 'Cancel',
                click: () => { safeCallback(''); }
            });

            const menu = Menu.buildFromTemplate(template);
            const win = BrowserWindow.fromWebContents(webContents);
            if (win) {
                menu.popup({
                    window: win,
                    callback: () => {
                        // Fired when menu is closed (either by clicking outside or after an item click)
                        safeCallback('');
                    }
                });
            } else {
                safeCallback('');
            }
        } else {
            safeCallback('');
        }
    });

    
    app.on('window-all-closed', function () {
        if (process.platform != 'darwin' || isQuitting) {
            app.quit();
        }
    });
    
    AppMenus.setCallbacks({
        new: () => {
            ProjectWindow.createEmpty();
        },
        newInclude: () => {
            var win = ProjectWindow.focused();
            if (win) win.newInclude();
        },
        open: () => {
            console.log("Test!")
            ProjectWindow.open();
        },
        clearRecent: () => {
            ProjectWindow.clearRecentFiles();
            AppMenus.setRecentFiles([]);
            AppMenus.refresh();
        },
        save: () => {
            var win = ProjectWindow.focused();
            if (win) win.save();
        },
        exportJson: () => {
            var win = ProjectWindow.focused();
            if (win) win.exportJson();
        },
        exportForWeb: () => {
            if( inkJSNeedsUpdating() ) return;
            var win = ProjectWindow.focused();
            if (win) win.exportForWeb();
        },
        exportJSOnly: () => {
            if( inkJSNeedsUpdating() ) return;
            var win = ProjectWindow.focused();
            if (win) win.exportJSOnly();
        },
        compileEenkBin: () => {
            var win = ProjectWindow.focused();
            if (win) win.browserWindow.webContents.send('eenk:trigger-compile');
        },
        openDeviceManagement: () => {
            var win = ProjectWindow.focused();
            if (win) win.browserWindow.webContents.send('eenk:open-device-management');
        },
        launchSimulator: () => {
            var win = ProjectWindow.focused();
            if (win) win.browserWindow.webContents.send('eenk:launch-simulator');
        },
        toggleTags: (item, focusedWindow, event) => {
            focusedWindow.webContents.send("set-tags-visible", item.checked);
        },
        nextIssue: (item, focusedWindow) => {
            focusedWindow.webContents.send("next-issue");
        },
        gotoAnything: (item, focusedWindow) => {
            focusedWindow.webContents.send("goto-anything");
        },
        addWatchExpression: (item, focusedWindow) => {
            focusedWindow.webContents.send("add-watch-expression");
        },
        find: (item, focusedWindow) => {
            if (focusedWindow) focusedWindow.webContents.send("find");
        },
        showDocs: () => {
            DocumentationWindow.openDocumentation(ProjectWindow.getViewSettings().theme);
        },
        showAbout: () => {
            var win = ProjectWindow.focused();
            if (win) {
                const versionFilePath = "ink/version.txt";
                const eenkVersionFilePath = "ink/eenk_version.txt";
                const inklecateRootPathRelease = path.join(__dirname, "../../app.asar.unpacked/main-process");
                const inklecateRootPathDev = __dirname;
                
                var fullVersionFilePath = path.join(inklecateRootPathRelease, versionFilePath);
                try { fs.accessSync(versionFilePath) } catch (e) {
                    fullVersionFilePath = path.join(inklecateRootPathDev, versionFilePath);
                }
                
                var fullEenkVersionFilePath = path.join(inklecateRootPathRelease, eenkVersionFilePath);
                try { fs.accessSync(eenkVersionFilePath) } catch (e) {
                    fullEenkVersionFilePath = path.join(inklecateRootPathDev, eenkVersionFilePath);
                }

                var inkVersion = "Unknown";
                try { inkVersion = fs.readFileSync(fullVersionFilePath, "utf8").trim(); } catch(e){}
                
                var eenkVersion = "Unknown";
                try { eenkVersion = fs.readFileSync(fullEenkVersionFilePath, "utf8").trim(); } catch(e){}
                
                let inkjsVersion = "Unknown";
                try { inkjsVersion = require('inkjs/package.json').version; } catch(e){}
                
                win.browserWindow.webContents.send('show-about', {
                    eenkyVersion: app.getVersion(),
                    inkVersion: inkVersion,
                    inkjsVersion: inkjsVersion,
                    eenkVersion: eenkVersion
                });
            }
        },
        keyboardShortcuts: () => {
            var win = ProjectWindow.focused();
            if (win) win.keyboardShortcuts();
        },
        stats: () => {
            var win = ProjectWindow.focused();
            if (win) win.stats();
        },
        zoomIn: () => {
            var win = ProjectWindow.focused();
            if (win != null) {
                // Convert change from font size to zoom percentage
                let zoom = ProjectWindow.getViewSettings().zoom;
                zoom = (parseInt(zoom) + Math.floor(2*100/12)).toString();
                ProjectWindow.addOrChangeViewSetting('zoom', zoom);
            }
        },
        zoomOut: () => {
          var win = ProjectWindow.focused();
          if (win != null) {
              // Convert change from font size to zoom percentage
              let zoom = ProjectWindow.getViewSettings().zoom
              zoom = (parseInt(zoom) - Math.floor(2*100/12)).toString();
              ProjectWindow.addOrChangeViewSetting('zoom', zoom);
            }
        },
        zoomReset: () => {
          var win = ProjectWindow.focused();
          if (win != null) {
              ProjectWindow.addOrChangeViewSetting('zoom', '100');
          }
        },
        zoom: (zoom_percent) => {
            var win = ProjectWindow.focused();
            if (win != null) {
                let zoom = zoom_percent.toString();
                ProjectWindow.addOrChangeViewSetting('zoom', zoom)
            }
        },
        toggleToolbar: () => {
            let win = ProjectWindow.focused();
            if (win) {
                let showToolbar = !ProjectWindow.getViewSettings().showToolbar;
                ProjectWindow.addOrChangeViewSetting('showToolbar', showToolbar);
                win.browserWindow.webContents.send("toggle-toolbar", showToolbar);
                AppMenus.setShowToolbar(showToolbar);
                AppMenus.refresh(AppMenus.currentState);
            }
        },
        toggleFileBrowser: () => {
            let win = ProjectWindow.focused();
            if (win) {
                let showFileBrowser = !ProjectWindow.getViewSettings().showFileBrowser;
                ProjectWindow.addOrChangeViewSetting('showFileBrowser', showFileBrowser);
                win.browserWindow.webContents.send("toggle-file-browser", showFileBrowser);
                AppMenus.setShowFileBrowser(showFileBrowser);
                AppMenus.refresh(AppMenus.currentState);
            }
        },
        toggleKnotBrowser: () => {
            let win = ProjectWindow.focused();
            if (win) {
                let showKnotBrowser = !ProjectWindow.getViewSettings().showKnotBrowser;
                ProjectWindow.addOrChangeViewSetting('showKnotBrowser', showKnotBrowser);
                win.browserWindow.webContents.send("toggle-knot-browser", showKnotBrowser);
                AppMenus.setShowKnotBrowser(showKnotBrowser);
                AppMenus.refresh(AppMenus.currentState);
            }
        },
        togglePreview: () => {
            let win = ProjectWindow.focused();
            if (win) {
                let showPreview = !ProjectWindow.getViewSettings().showPreview;
                ProjectWindow.addOrChangeViewSetting('showPreview', showPreview);
                win.browserWindow.webContents.send("toggle-preview", showPreview);
                AppMenus.setShowPreview(showPreview);
                AppMenus.refresh(AppMenus.currentState);
            }
        },
        toggleAutoComplete: () => {
            let autoCompleteDisabled = !ProjectWindow.getViewSettings().autoCompleteDisabled;
            ProjectWindow.addOrChangeViewSetting('autoCompleteDisabled', autoCompleteDisabled)

            for(let i=0; i<ProjectWindow.all().length; i++) {
                let eachWindow = ProjectWindow.all()[i];
                eachWindow.browserWindow.webContents.send("set-autocomplete-disabled", autoCompleteDisabled);
            }
        },
        insertSnippet: (focussedWindow, snippet) => {
            if( focussedWindow )
            focussedWindow.webContents.send('insertSnippet', snippet);
        },
        changeTheme: (newTheme) => {
            AboutWindow.changeTheme(newTheme);
            DocumentationWindow.changeTheme(newTheme);
            ProjectWindow.addOrChangeViewSetting('theme', newTheme)
        }
    });
    
    console.log("Testing!")
    AppMenus.setRecentFiles(ProjectWindow.getRecentFiles());
    AppMenus.setTheme(ProjectWindow.getViewSettings().theme);
    AppMenus.setZoom(ProjectWindow.getViewSettings().zoom);
    AppMenus.setShowToolbar(ProjectWindow.getViewSettings().showToolbar !== false);
    AppMenus.setShowFileBrowser(ProjectWindow.getViewSettings().showFileBrowser !== false);
    AppMenus.setShowKnotBrowser(ProjectWindow.getViewSettings().showKnotBrowser === true);
    AppMenus.setShowPreview(ProjectWindow.getViewSettings().showPreview === true);
    AppMenus.setAutoCompleteDisabled(ProjectWindow.getViewSettings().autoCompleteDisabled);

    AppMenus.refresh();
    ProjectWindow.setEvents({
        onRecentFilesChanged: (recentFiles) => {
            AppMenus.setRecentFiles(recentFiles);
            AppMenus.refresh();
        },
        onProjectSettingsChanged: (settings) => {
            settings = settings || {};
            AppMenus.setCustomSnippetMenus(settings.customInkSnippets || []);
            AppMenus.refresh();
        },
        onViewSettingsChanged: (viewSettings) => {
            AppMenus.setTheme(viewSettings.theme);
            AppMenus.setZoom(viewSettings.zoom);
            AppMenus.setShowToolbar(viewSettings.showToolbar !== false);
            AppMenus.setShowFileBrowser(viewSettings.showFileBrowser !== false);
            AppMenus.setShowKnotBrowser(viewSettings.showKnotBrowser === true);
            AppMenus.setShowPreview(viewSettings.showPreview === true);
            AppMenus.setAutoCompleteDisabled(viewSettings.autoCompleteDisabled);
            AppMenus.refresh();
            
            // Broadcast zoom to all windows
            for (let window of ProjectWindow.all()) {
                window.browserWindow.webContents.send('zoom', viewSettings.zoom);
            }
        }
    });

    // Windows passed file to open on command line?
    if (process.platform == "win32" && process.argv.length > 1 && !pendingPathToOpen) {
        for (let i = 1; i < process.argv.length; i++) {
            var arg = process.argv[i].toLowerCase();
            if (arg.endsWith(".ink")) {
                pendingPathToOpen = process.argv[i];
                break;
            }
        }
    }

    // Opened Inky with specific file (e.g. drag and drop or windows command line)
    if( pendingPathToOpen ) {
        ProjectWindow.open(pendingPathToOpen);
        pendingPathToOpen = null;
    }
    
    // Otherwise, show new empty window
    else {
        ProjectWindow.createEmpty();
    }

    // Setup last stored theme
    let theme = ProjectWindow.getViewSettings().theme;
    AboutWindow.changeTheme(theme);
    DocumentationWindow.changeTheme(theme);

    hasFinishedLaunch = true;

    // Debug
    //w.openDevTools();
});

function finalQuit() {
    Inklecate.killSessions();
    stopSimulator();
}

onForceQuit(finalQuit);
app.on("will-quit", finalQuit);


// --- File System Operations via IPC ---
ipcMain.handle('fs:readFile', async (event, filePath, options) => {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, options, (err, data) => {
            if (err) reject(err);
            else resolve(data);
        });
    });
});

ipcMain.handle('fs:writeFile', async (event, filePath, data, options) => {
    return new Promise((resolve, reject) => {
        fs.writeFile(filePath, data, options, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
});

ipcMain.handle('fs:exists', async (event, filePath) => {
    return new Promise((resolve) => {
        fs.exists(filePath, (exists) => resolve(exists));
    });
});

ipcMain.handle('fs:unlink', async (event, filePath) => {
    return new Promise((resolve, reject) => {
        fs.unlink(filePath, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
});

ipcMain.handle('fs:stat', async (event, filePath) => {
    return new Promise((resolve, reject) => {
        fs.stat(filePath, (err, stats) => {
            if (err) reject(err);
            else resolve({
                isFile: stats.isFile(),
                isDirectory: stats.isDirectory(),
                mtimeMs: stats.mtimeMs,
                size: stats.size
            });
        });
    });
});

// --- Path Operations via IPC ---
ipcMain.handle('path:join', (event, ...paths) => path.join(...paths));
ipcMain.handle('path:basename', (event, p, ext) => path.basename(p, ext));
ipcMain.handle('path:dirname', (event, p) => path.dirname(p));
ipcMain.handle('path:relative', (event, from, to) => path.relative(from, to));
ipcMain.handle('path:extname', (event, p) => path.extname(p));
ipcMain.handle('path:resolve', (event, ...paths) => path.resolve(...paths));
ipcMain.handle('path:format', (event, pathObject) => path.format(pathObject));
ipcMain.handle('path:parse', (event, p) => path.parse(p));

ipcMain.handle('fs:mkdir', async (event, dirPath) => {
    return new Promise((resolve, reject) => {
        console.log("IN FS:MKDIR, fs is:", typeof fs, "dirPath:", dirPath);
        if (!fs) {
            console.error("fs is undefined! Using require('fs') locally");
            require('fs').mkdir(dirPath, { recursive: true }, (err) => {
                if (err) reject(err);
                else resolve();
            });
            return;
        }
        fs.mkdir(dirPath, { recursive: true }, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
});

ipcMain.handle('fs:copyFile', async (event, src, dest) => {
    return new Promise((resolve, reject) => {
        fs.copyFile(src, dest, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
});

ipcMain.handle('fs:readdir', async (event, dirPath) => {
    return new Promise((resolve, reject) => {
        fs.readdir(dirPath, (err, files) => {
            if (err) reject(err);
            else resolve(files);
        });
    });
});

ipcMain.handle('fs:rename', async (event, oldPath, newPath) => {
    return new Promise((resolve, reject) => {
        fs.rename(oldPath, newPath, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
});

const chokidar = require('chokidar');
let watchers = {};
ipcMain.handle('fs:watch', (event, dirPath) => {
    if (watchers[dirPath]) return;
    const watcher = chokidar.watch(dirPath, {
        disableGlobbing: true,
        ignored: [
            /(^|[\/\\])\../,
            "**/node_modules/**",
            "**/bin/**",
            "**/build/**",
            "**/Inky-win32-x64/**"
        ]
    });
    const sender = event.sender;
    const emit = (eventName, path) => {
        if (!sender.isDestroyed()) {
            sender.send('fs:watcher-event', { dirPath, eventName, path });
        }
    };
    watcher.on('add', (p) => emit('add', p));
    watcher.on('change', (p) => emit('change', p));
    watcher.on('unlink', (p) => emit('unlink', p));
    watcher.on('ready', () => emit('ready', null));
    watchers[dirPath] = watcher;
});

ipcMain.handle('fs:unwatch', (event, dirPath) => {
    if (watchers[dirPath]) {
        watchers[dirPath].close();
        delete watchers[dirPath];
    }
});

