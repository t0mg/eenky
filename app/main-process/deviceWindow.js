const { app, BrowserWindow, session } = require('electron');
const path = require('path');
const fs = require('fs');
const { AppMenus } = require('./appmenus.js');

const defaultIconPath = (() => {
    const icoCandidate = path.join(__dirname, '../../resources/icon.ico');
    const pngCandidate = path.join(__dirname, '../../resources/icon.png');
    const rendererIcon = path.join(__dirname, '../renderer/public/assets/favicon.png');
    if (process.platform === 'win32' && fs.existsSync(icoCandidate)) return icoCandidate;
    if (fs.existsSync(pngCandidate)) return pngCandidate;
    if (fs.existsSync(rendererIcon)) return rendererIcon;
    return undefined;
})();

let deviceWindow = null;

function open() {
    if (deviceWindow) {
        deviceWindow.focus();
        return;
    }

    deviceWindow = new BrowserWindow({
        width: 800,
        height: 600,
        minWidth: 600,
        minHeight: 400,
        title: 'Device Manager — eenky',
        icon: defaultIconPath,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
        autoHideMenuBar: true
    });

    // Remove the default system menu for this window
    deviceWindow.setMenu(null);


    const isDev = process.defaultApp || /[\\/]electron-prebuilt[\\/]/.test(process.execPath) || /[\\/]electron[\\/]/.test(process.execPath);
    if (isDev) {
        deviceWindow.loadURL('http://localhost:5173/device.html');
    } else {
        deviceWindow.loadFile(path.join(__dirname, '..', 'renderer', 'dist', 'device.html'));
    }

    deviceWindow.webContents.on('did-finish-load', () => {
        deviceWindow.webContents.send('change-theme', AppMenus.getTheme());
    });

    deviceWindow.on('closed', () => {
        deviceWindow = null;
    });
}

function close() {
    if (deviceWindow) {
        deviceWindow.close();
    }
}
function getBrowserWindow() {
    return deviceWindow;
}

function changeTheme(theme) {
    if (deviceWindow) {
        deviceWindow.webContents.send('change-theme', theme);
    }
}

module.exports = { open, close, getBrowserWindow, changeTheme };
