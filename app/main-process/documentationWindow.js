const electron = require('electron');
const BrowserWindow = electron.BrowserWindow;
const path = require("path");
const fs = require("fs");

const defaultIconPath = (() => {
  const icoCandidate = path.join(__dirname, '../../resources/icon.ico');
  const pngCandidate = path.join(__dirname, '../../resources/icon.png');
  const rendererIcon = path.join(__dirname, '../renderer/public/assets/favicon.png');
  if (process.platform === 'win32' && fs.existsSync(icoCandidate)) return icoCandidate;
  if (fs.existsSync(pngCandidate)) return pngCandidate;
  if (fs.existsSync(rendererIcon)) return rendererIcon;
  return undefined;
})();

const electronWindowOptions = {
  width: 1000,
  height: 650,
  minWidth: 700,
  minHeight: 300,
  title: "Documentation",
  icon: defaultIconPath,
  autoHideMenuBar: true,
  webPreferences: {
    preload: path.join(__dirname, 'preload.js'),
    nodeIntegration: false,
    contextIsolation: true
  }
};

var documentationWindow = null;

function DocumentationWindow(theme) {
  electronWindowOptions.theme = theme;
  var w = new BrowserWindow(electronWindowOptions);

  const isDev = process.defaultApp || /[\\/]electron-prebuilt[\\/]/.test(process.execPath) || /[\\/]electron[\\/]/.test(process.execPath);
  if (isDev) {
    w.loadURL("http://localhost:5173/documentation/window.html");
  } else {
    w.loadURL("file://" + __dirname + "/../renderer/dist/documentation/window.html");
  }

  // w.webContents.openDevTools();

  w.webContents.on("did-finish-load", () => {
    w.webContents.send("change-theme", theme);
    w.setMenu(null);
    w.show();
  });

  this.browserWindow = w;

  w.on("close", () => {
    documentationWindow = null;
  });
}

DocumentationWindow.openDocumentation = function (theme) {

  if (documentationWindow == null) {
    documentationWindow = new DocumentationWindow(theme);
  }
  return documentationWindow;
}


DocumentationWindow.changeTheme = function (theme) {
  if (documentationWindow != null) {
    documentationWindow.browserWindow.webContents.send("change-theme", theme);
  }
}

exports.DocumentationWindow = DocumentationWindow;
