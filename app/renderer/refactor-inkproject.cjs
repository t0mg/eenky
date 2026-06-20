const fs = require('fs');

let content = fs.readFileSync('src/core/inkProject.js', 'utf8');

// Replace imports
content = content.replace(/const {ipcRenderer} = require\("electron"\);/g, "import { useProjectStore } from '../stores/projectStore.js';\nimport { useUiStore } from '../stores/uiStore.js';\nimport path from 'path-browserify';\nimport i18n from './i18n.js';\nimport { InkFile } from './inkFile.js';\nimport { LiveCompiler } from './liveCompiler.js';");
content = content.replace(/const path = require\("path"\);/g, "");
content = content.replace(/const fs = require\("fs"\);/g, "");
content = content.replace(/const _ = require\("lodash"\);/g, "");
content = content.replace(/const chokidar = require\('chokidar'\);/g, "");
content = content.replace(/const mkdirp = require\('mkdirp'\);/g, "");
content = content.replace(/const i18n = require\('\.\/i18n\.js'\);/g, "");
content = content.replace(/const { PlayerView } = require\('\.\/playerView\.js'\);/g, "");
content = content.replace(/const EditorView = require\("\.\/editorView\.js"\)\.EditorView;/g, "");
content = content.replace(/const NavView = require\("\.\/navView\.js"\)\.NavView;/g, "");
content = content.replace(/const InkFile = require\("\.\/inkFile\.js"\)\.InkFile;/g, "");
content = content.replace(/const LiveCompiler = require\("\.\/liveCompiler\.js"\)\.LiveCompiler;/g, "");

// Replace exports
content = content.replace(/exports\.InkProject = InkProject;/g, "export { InkProject };");

// EditorView / NavView replacements
content = content.replace(/EditorView\.setFiles\(this\.files\);/g, "useProjectStore().setProjectInfo({ files: this.files, mainInkFile: this.mainInk, instructionPrefix: this.inkMode.instructionPrefix });");
content = content.replace(/if\( inkFile\.includes\.length > 0  \)\s*NavView\.initialShow\(\);/g, "/* NavView.initialShow(); */");
content = content.replace(/NavView\.initialShow\(\);/g, "/* NavView.initialShow(); */");
content = content.replace(/NavView\.setFiles\(this\.mainInk, this\.files\);/g, "/* NavView.setFiles */");
content = content.replace(/EditorView\.focus\(\);/g, "/* EditorView.focus(); */");
content = content.replace(/EditorView\.saveReady\(\);/g, "/* EditorView.saveReady(); */");

// fs replacements
content = content.replace(/fs\.existsSync/g, "await window.api.fs.exists");
content = content.replace(/fs\.exists/g, "window.api.fs.exists"); // Will need manual await
content = content.replace(/fs\.statSync/g, "await window.api.fs.stat");
content = content.replace(/fs\.stat\(/g, "window.api.fs.stat(");
content = content.replace(/fs\.readFileSync/g, "await window.api.fs.readFile");
content = content.replace(/fs\.readFile/g, "window.api.fs.readFile");
content = content.replace(/fs\.writeFileSync/g, "await window.api.fs.writeFile");
content = content.replace(/fs\.writeFile\(/g, "window.api.fs.writeFile(");
content = content.replace(/fs\.unlinkSync/g, "await window.api.fs.unlink");
content = content.replace(/fs\.unlink/g, "window.api.fs.unlink");
content = content.replace(/mkdirp\.sync/g, "await window.api.fs.mkdir");
content = content.replace(/mkdirp\(/g, "window.api.fs.mkdir(");

// lodash replacements (basic ones used)
content = content.replace(/_\.filter\((.*?), (.*?)\)/g, "($1).filter($2)");
content = content.replace(/_\.find\((.*?), (.*?)\)/g, "($1).find($2)");
content = content.replace(/_\.every\((.*?), (.*?)\)/g, "($1).every($2)");
content = content.replace(/_\.some\((.*?), (.*?)\)/g, "($1).some($2)");
content = content.replace(/_\.map\((.*?), (.*?)\)/g, "($1).map($2)");
content = content.replace(/_\.without\((.*?), (.*?)\)/g, "($1).filter(x => x !== ($2))");

// ipcRenderer
content = content.replace(/ipcRenderer\.send/g, "window.api.invoke");

// chokidar watch
content = content.replace(/chokidar\.watch\((.*?),\s*\{(.*?)\}\)/gs, "window.api.fs.watch($1)");
content = content.replace(/this\.fileWatcher\.on\('add', \w+ => \{\s*\w+\(\);\s*\}\);/g, "");
content = content.replace(/this\.fileWatcher\.on\('change', \w+ => \{\s*\w+\(\);\s*\}\);/g, "");
content = content.replace(/this\.fileWatcher\.on\('unlink', \w+ => \{\s*\w+\(\);\s*\}\);/g, "");
content = content.replace(/this\.fileWatcher\.on\('ready', \w+ => \{\s*\w+\(\);\s*\}\);/g, "");
content = content.replace(/this\.fileWatcher = /g, "// this.fileWatcher = ");

// Add IPC event listener for watch
content += `\nwindow.api.fs.onWatcherEvent(({dirPath, eventName, path}) => {
    if (InkProject.currentProject && InkProject.currentProject.mainInk && InkProject.currentProject.mainInk.projectDir === dirPath) {
        if (eventName === 'add' || eventName === 'change' || eventName === 'unlink' || eventName === 'ready') {
            InkProject.currentProject.refreshIncludes();
        }
    }
});\n`;

fs.writeFileSync('src/core/inkProject.js', content, 'utf8');
console.log('Refactor complete');
