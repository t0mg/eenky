const electron = require('electron');
const ipc = electron.ipcMain;
const dialog = electron.dialog;
const BrowserWindow = electron.BrowserWindow;
const path = require("path");
const fs = require("fs");
const Inklecate = require("./inklecate.js").Inklecate;
const Menu = electron.Menu;
const i18n = require("./i18n/i18n.js");

var electronWindowOptions = {
  width: 1300,
  height: 730,
  minWidth: 350,
  minHeight: 250,
  webPreferences: {
    preload: path.join(__dirname, 'preload.js'),
    nodeIntegration: false,
    contextIsolation: true,
    webSecurity: false
  },
  
};


if( process.platform == "darwin" ) {
    electronWindowOptions.titleBarStyle = 'hiddenInset';
    electronWindowOptions.titleBarOverlay = true;
}

var windows = [];

const recentFilesPath = path.join(electron.app.getPath("userData"), "recent-files.json");

const viewSettingsPath = path.join(electron.app.getPath("userData"), "view-settings.json");


// Overriden by main.js
var events = {
    onRecentFilesChanged:    (files) => {},
    onProjectSettingsChanged: (settings) => {},
    onViewSettingsChanged:   (settings) => {}
};


function ProjectWindow(filePath) {
    const getThemeFromMenu = () => Menu.getApplicationMenu().items.find(
        e => e.label.toLowerCase() === '&view'
    ).submenu.items.find(
        e => e.label.toLowerCase() === 'theme'
    ).submenu.items.find(
        e => e.checked
    ).label.toLowerCase();

    electronWindowOptions.title = i18n._("Inky");
    this.browserWindow = new BrowserWindow(electronWindowOptions);
    
    this.browserWindow.on('enter-full-screen', () => {
        this.browserWindow.webContents.send('set-fullscreen', true);
    });

    this.browserWindow.on('leave-full-screen', () => {
        this.browserWindow.webContents.send('set-fullscreen', false);
    });
    
    // Check if we are running in development by looking for the default electron app
    const isDev = process.defaultApp || /[\\/]electron-prebuilt[\\/]/.test(process.execPath) || /[\\/]electron[\\/]/.test(process.execPath);
    if (isDev) {
        this.browserWindow.loadURL("http://localhost:5173");
    } else {
        this.browserWindow.loadURL("file://" + __dirname + "/../renderer/dist/index.html");
    }
    
    this.browserWindow.setSheetOffset(49);

    // Open DevTools only in development
    if (isDev) {
        this.browserWindow.webContents.openDevTools();
    }

    this.safeToClose = false;
    this.mainInkAbsPath = filePath;

    // Existing project at specific path
    if( filePath ) {
        this.browserWindow.webContents.on('dom-ready', () => {
            this.browserWindow.setRepresentedFilename(filePath);
            this.browserWindow.webContents.send('set-project-main-ink-filepath', filePath);

            // Try to load settings 
            this.refreshProjectSettings(filePath);
        });
    }
    
    // New project, new settings
    else {
        this.settings = {};
        if( events.onProjectSettingsChanged )
            events.onProjectSettingsChanged({});
    }

    windows.push(this);

    let self = this;
    this.browserWindow.on('close', function (event) {
        console.log("[DEBUG] browserWindow close event fired. isSafeToClose:", self.isSafeToClose);
        if( self.isSafeToClose ) {
            // Already saved, or nothing to save
        } else {
            event.preventDefault();
            console.log("[DEBUG] Calling self.tryClose()...");
            self.tryClose();
        }
    });

    this.browserWindow.on("closed", () => {
        var idx = windows.indexOf(this);
        if( idx != -1 )
            windows.splice(idx, 1);
    });

    // Set up theme/zoom from settings
    this.browserWindow.webContents.on('dom-ready', () => {
        this.browserWindow.send("change-theme", getThemeFromMenu());

        let settings = ProjectWindow.getViewSettings();
        this.zoom(settings.zoom);
        this.browserWindow.webContents.send('set-autocomplete-disabled', !!settings.autoCompleteDisabled);
        this.browserWindow.webContents.send('toggle-toolbar', settings.showToolbar !== false);
        this.browserWindow.webContents.send('toggle-file-browser', settings.showFileBrowser !== false);
        this.browserWindow.webContents.send('toggle-knot-browser', settings.showKnotBrowser === true);
        this.browserWindow.webContents.send('toggle-preview', settings.showPreview === true);
        this.browserWindow.webContents.send('toggle-line-wrap', settings.lineWrap !== false);
    });

    // Project settings may affect menus etc, so we refresh that
    // when changing focus between different windows
    this.browserWindow.on("focus", () => {
        if( events.onProjectSettingsChanged )
            events.onProjectSettingsChanged(this.settings);
    });
}

ProjectWindow.prototype.newInclude = function() {
    this.browserWindow.webContents.send('project-new-include');
}

ProjectWindow.prototype.save = function() {
    console.log("[DEBUG] ProjectWindow.prototype.save called. Sending project-save to renderer...");
    this.browserWindow.webContents.send('project-save');
}

ProjectWindow.prototype.exportJson = function() {
    this.browserWindow.webContents.send('project-export');
}

ProjectWindow.prototype.exportForWeb = function() {
    this.browserWindow.webContents.send('project-export-for-web');
}

ProjectWindow.prototype.exportJSOnly = function() {
    this.browserWindow.webContents.send('project-export-js-only');
}

ProjectWindow.prototype.tryClose = function() {
    this.browserWindow.webContents.send('project-tryClose');
}

ProjectWindow.prototype.stats = function() {
    this.browserWindow.webContents.send('project-stats');
}

ProjectWindow.prototype.keyboardShortcuts = function() {
    this.browserWindow.webContents.send('keyboard-shortcuts');
}

ProjectWindow.prototype.finalClose = function() {
    this.isSafeToClose = true;
    this.safeToClose = true; // just in case
    Inklecate.killSessions(this.browserWindow);
    this.browserWindow.close();
}

ProjectWindow.prototype.openDevTools = function() {
    this.browserWindow.webContents.openDevTools();
}

ProjectWindow.prototype.zoom = function(amount) {
    this.browserWindow.webContents.send('zoom', amount);
}

// Try to load up an optional <ink_root_file_name>.settings.json file
ProjectWindow.prototype.refreshProjectSettings = function(rootInkFilePath) {
    
    let self = this;


    const resolvedRootPath = path.resolve(rootInkFilePath);
    let basePath = rootInkFilePath;
    if( path.extname(resolvedRootPath) == ".ink" ) {
        basePath = rootInkFilePath.substring(0, resolvedRootPath.length-4)
    }
    const settingsPath = basePath + ".settings.json";


    function completeSettings(settings, err) {
        if( events.onProjectSettingsChanged ) {
            events.onProjectSettingsChanged(settings);
        }

        self.browserWindow.send("project-settings-changed", self.settings);

        if( err ) {
            dialog.showErrorBox("Project Settings Error", err);
        }
    }

    fs.stat(settingsPath, (err, stats) => {
        if( err || !stats.isFile() ) { 
            events.onProjectSettingsChanged({});
            return;
        }

        fs.readFile(settingsPath, "utf8", (err, fileContent) => {

            if( err ) {
                completeSettings({}, "File read error - failed to load project settings file at: "+settingsPath);
                return;
            }
            if( !fileContent ) {
                completeSettings({}, "Project settings file appeared to be empty: "+settingsPath);
                return;
            }

            let settings = {};
            try {
                settings = JSON.parse(fileContent);
            } catch(error) {
                completeSettings({}, "Project settings file appeared to be invalid JSON: "+settingsPath+": "+error);
                return;
            }

            self.settings = settings;

            completeSettings(settings);
        });

    });
}


ProjectWindow.all = () => windows;

ProjectWindow.setEvents = function(newEvents) {
    events = newEvents
}


ProjectWindow.createEmpty = function() {
    return new ProjectWindow();
}

ProjectWindow.focused = function() {
    let win = BrowserWindow.getFocusedWindow();
    if( win ) {
        let pwin = windows.find(pwin => pwin.browserWindow === win);
        if (pwin) return pwin;
    }
    // Fallback: Since it's a single-window app now, return the first window
    return windows.length > 0 ? windows[0] : null;
}


ProjectWindow.withWebContents = function(webContents) {
    if (!webContents) return null;
    return windows.find(pwin => pwin.browserWindow && pwin.browserWindow.webContents && pwin.browserWindow.webContents.id === webContents.id);
}


ProjectWindow.withMainkInkPath = function(absPath) {
    if( !absPath ) return null;

    for(var i=0; i<windows.length; i++) {
        if( windows[i].mainInkAbsPath == absPath )
            return windows[i];
    }
    return null;
}


ProjectWindow.getRecentFiles = function() {
    if(!fs.existsSync(recentFilesPath)) {
        return [];
    }
    const json = fs.readFileSync(recentFilesPath, "utf-8");
    try {
        return JSON.parse(json);
    } catch(e) {
        console.error("Error in recent files JSON parsing:", e);
        return [];
    }
}

ProjectWindow.clearRecentFiles = function() {
    if(fs.existsSync(recentFilesPath)) {
        fs.unlinkSync(recentFilesPath);
    }
}

function addRecentFile(filePath) {
    const resolvedFilePath = path.resolve(filePath);
    const recentFiles = ProjectWindow.getRecentFiles();
    const newRecentFiles = recentFiles.indexOf(resolvedFilePath) >= 0 ?
        recentFiles :
        [resolvedFilePath].concat(recentFiles).slice(0, 5);
    fs.writeFileSync(recentFilesPath, JSON.stringify(newRecentFiles), {
        encoding: "utf-8"
    });

    if( events.onRecentFilesChanged ) {
        events.onRecentFilesChanged(newRecentFiles);
    }
}

ProjectWindow.open = async function(filePath) {
    console.log("[DEBUG] ProjectWindow.open called with filePath:", filePath);
    if (typeof filePath !== 'string') {
        filePath = null;
    }
    
    if( !filePath ) {
        console.log("[DEBUG] No filePath provided, showing dialog...");
        var result = await dialog.showOpenDialog({
            title: i18n._("Open main ink file"),
            properties: ['openFile'],
            filters: [
                { name: i18n._('Ink files'), extensions: ['ink'] }
            ]
        });
        console.log("[DEBUG] dialog returned:", result.filePaths);
        if( result && !result.canceled && result.filePaths.length > 0 )
            filePath = result.filePaths[0];
    }

    if( filePath) {
        console.log("[DEBUG] filePath selected:", filePath);
        addRecentFile(filePath);
        let win = ProjectWindow.focused() || (windows.length > 0 ? windows[0] : null);

        if (win) {
            console.log("[DEBUG] using existing window");
            win.mainInkAbsPath = filePath;
            win.browserWindow.setRepresentedFilename(filePath);
            win.browserWindow.webContents.send('set-project-main-ink-filepath', filePath);
            win.refreshProjectSettings(filePath);
            return win;
        } else {
            console.log("[DEBUG] creating new window");
            return new ProjectWindow(filePath);
        }
    } else {
        console.log("[DEBUG] No filePath selected, aborting.");
    }
}

ProjectWindow.getViewSettings = function() {
    let viewSettingDefaults = { theme:'light', zoom:'100', animationEnabled:true };

    if(!fs.existsSync(viewSettingsPath)) {
        return viewSettingDefaults;
    }
    
    const json = fs.readFileSync(viewSettingsPath, "utf-8");
    try {
        let loadedSettings = JSON.parse(json);

        // if we've added a new setting or one is missing, make sure they all exist
        for(requiredKey in viewSettingDefaults) {
            if(loadedSettings[requiredKey] === undefined) {
                loadedSettings[requiredKey] = viewSettingDefaults[requiredKey];
            }
        }

        return loadedSettings;
    } catch(e) {
        console.error('Error in view settings JSON parsing:', e);
        return viewSettingDefaults;
    }
}

ProjectWindow.addOrChangeViewSetting = function(name, data){
    const viewSettings = ProjectWindow.getViewSettings();
    viewSettings[name] = data;
    fs.writeFileSync(viewSettingsPath, JSON.stringify(viewSettings), {
        encoding: "utf-8"
    });
    if(events.onViewSettingsChanged) {
        events.onViewSettingsChanged(viewSettings);
    }
}


ipc.on("main-file-saved", (event, absFilePath) => {
    addRecentFile(absFilePath);

    var win = ProjectWindow.withWebContents(event.sender);
    win.mainInkAbsPath = absFilePath;
    win.refreshProjectSettings(absFilePath);
});

ipc.on("project-final-close", (event) => {
    console.log("[DEBUG] project-final-close received! webContents id:", event.sender ? event.sender.id : 'none');
    var win = ProjectWindow.withWebContents(event.sender);
    console.log("[DEBUG] withWebContents returned win?", !!win);
    if (win) win.finalClose();
});

ipc.on("project-settings-needs-reload", (event, rootInkFilePath) => {
    var win = ProjectWindow.withWebContents(event.sender);
    win.refreshProjectSettings(rootInkFilePath);
});

ipc.on("set-native-window-title", (event, newWindowTitle) => {
    var win = ProjectWindow.withWebContents(event.sender);
    win.browserWindow.title = newWindowTitle;
});

exports.ProjectWindow = ProjectWindow;
