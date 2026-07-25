const { app, BrowserWindow, session } = require('electron');
const path = require('path');
const { AppMenus } = require('./appmenus.js');
const isDev = process.env.NODE_ENV !== 'production';

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
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
        autoHideMenuBar: true
    });

    // Remove the default system menu for this window
    deviceWindow.setMenu(null);


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
