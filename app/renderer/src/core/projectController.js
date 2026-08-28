import { useProjectStore } from '../stores/projectStore';
import { useUiStore } from '../stores/uiStore';
import { InkFileSymbols } from './inkFileSymbols';
import { LiveCompiler } from './liveCompiler';

let fileIdCounter = 0;

export const ProjectController = {
  init() {
    window.api.receive('set-project-main-ink-filepath', (filePath) => {
      console.log("[DEBUG] Renderer received set-project-main-ink-filepath:", filePath);
      this.loadProject(filePath);
    });

    window.api.receive('project-export', () => { this.exportProject('json'); });
    window.api.receive('project-export-for-web', () => { this.exportProject('web'); });
    window.api.receive('project-export-js-only', () => { this.exportProject('js'); });

    window.api.receive('project-save', async () => {
      await this.saveAll();
    });

    window.api.receive('project-tryClose', async () => {
      const store = useProjectStore();
      const uiStore = useUiStore();
      const hasUnsavedChanges = store.hasUnsavedChanges;

      if (hasUnsavedChanges) {
        uiStore.openModal('close-confirm');
        const choice = await new Promise((resolve) => {
          uiStore.modalState.resolve = resolve;
        });

        if (choice === 'save') {
          const success = await this.saveAll();
          if (success) {
            window.api.send("project-final-close");
          } else {
            window.api.send("project-cancelled-close");
          }
        } else if (choice === 'dontsave') {
          window.api.send("project-final-close");
        } else {
          window.api.send("project-cancelled-close");
        }
      } else {
        window.api.send("project-final-close");
      }
    });

    window.api.receive('open-main-ink', () => {
      const store = useProjectStore();
      if (store.mainInkFile) {
        store.setActiveFile(store.mainInkFile);
      }
    });

    window.api.receive('project-settings-changed', (settings) => {
      const store = useProjectStore();
      if (store.instructionPrefix !== settings.instructionPrefix) {
        store.instructionPrefix = settings.instructionPrefix;
      }
    });

    if (window.api.fs && window.api.fs.onWatcherEvent) {
      window.api.fs.onWatcherEvent(async (eventData) => {
        const store = useProjectStore();
        const { eventName, path: absFilePath } = eventData;
        const normalizedAbsFilePath = absFilePath.replace(/[\\]/g, '/');
        const file = store.files.find(f => (f.absolutePath || '').replace(/[\\]/g, '/') === normalizedAbsFilePath);

        if (file && eventName === 'change') {
          if (file.justSaved) {
            file.justSaved = false;
            return;
          }
          if (!file.hasUnsavedChanges) {
            await this.loadFileContent(file);
          }
        }
      });
    }
  },

  _basename(p) { return p ? p.split(/[\\/]/).pop() : ''; },
  _dirname(p) {
    if (!p) return '';
    const parts = p.split(/[\\/]/);
    parts.pop();
    return parts.join('/') || '/';
  },
  _join(...args) {
    return args.join('/').replace(/[\\]/g, '/').replace(/\/+/g, '/');
  },

  async loadProject(mainInkFilePath) {
    const store = useProjectStore();
    store.closeProject();

    const file = this.createFile(mainInkFilePath || null, mainInkFilePath === undefined);
    file.isMain = true;

    if (mainInkFilePath === undefined) {
      file.content = "/*\n  @title Untitled Story\n  @author Unknown\n  @font sans\n*/\n\n";
    }

    store.setProjectInfo({
      files: [file],
      mainInkFile: file,
      instructionPrefix: "// "
    });
    store.setActiveFile(file);

    await this.loadFileContent(store.mainInkFile);
    await this.loadIncludes(store.mainInkFile);
    await this.loadUnusedFiles(store.mainInkFile);

    LiveCompiler.setProject(store);
    LiveCompiler.reload();
  },

  async loadUnusedFiles(mainFile) {
    if (!mainFile || !mainFile.absolutePath) {
      this.refreshUnusedStatus();
      return;
    }
    const store = useProjectStore();
    const mainDir = this._dirname(mainFile.absolutePath);
    try {
      const files = await window.api.fs.readdir(mainDir);
      for (const filename of files) {
        if (filename.endsWith('.ink')) {
          const absPath = this._join(mainDir, filename);
          const normalizedAbsPath = absPath.replace(/[\\]/g, '/');
          let existing = store.files.find(f => (f.absolutePath || '').replace(/[\\]/g, '/') === normalizedAbsPath);
          if (!existing) {
            const rawFile = this.createFile(absPath, false);
            rawFile.relPath = filename;
            store.addFile(rawFile);
            let incFile = store.files.find(f => f.id === rawFile.id);
            await this.loadFileContent(incFile);
          }
        }
      }
    } catch (err) {
      console.error("Could not load unused files", err);
    }
    this.refreshUnusedStatus();
  },

  refreshUnusedStatus() {
    const store = useProjectStore();
    const mainFile = store.mainInkFile;
    if (!mainFile) return;

    const includedIds = new Set();
    const queue = [mainFile];
    includedIds.add(mainFile.id);

    while (queue.length > 0) {
      const curr = queue.shift();
      const dir = this._dirname(curr.absolutePath || '');
      const includesList = curr.includes || [];
      for (const inc of includesList) {
        const absPath = this._join(dir, inc);
        const normalizedAbsPath = absPath.replace(/[\\]/g, '/');
        const incFile = store.files.find(f => {
          const fAbs = (f.absolutePath || '').replace(/[\\]/g, '/');
          const fRel = (f.relPath || '').replace(/[\\]/g, '/');
          const incNorm = inc.replace(/[\\]/g, '/');
          return fAbs === normalizedAbsPath || fRel === incNorm;
        });
        if (incFile && !includedIds.has(incFile.id)) {
          includedIds.add(incFile.id);
          queue.push(incFile);
        }
      }
    }

    for (const f of store.files) {
      f.isUnused = !includedIds.has(f.id);
    }
  },

  async loadIncludes(mainFile) {
    const store = useProjectStore();
    const mainDir = this._dirname(mainFile.absolutePath || '');
    const includesList = mainFile.includes || [];
    for (const inc of includesList) {
      const absPath = this._join(mainDir, inc);
      const normalizedAbsPath = absPath.replace(/[\\]/g, '/');
      let incFile = store.files.find(f => {
        const fAbs = (f.absolutePath || '').replace(/[\\]/g, '/');
        const fRel = (f.relPath || '').replace(/[\\]/g, '/');
        const incNorm = inc.replace(/[\\]/g, '/');
        return fAbs === normalizedAbsPath || fRel === incNorm;
      });
      if (!incFile) {
        const rawFile = this.createFile(absPath, false);
        rawFile.relPath = inc;
        store.addFile(rawFile);
        incFile = store.files.find(f => f.id === rawFile.id); // get Proxy
        await this.loadFileContent(incFile);
        await this.loadIncludes(incFile); // recursive
      } else if (!incFile.content && !incFile.isLoading) {
        await this.loadFileContent(incFile);
        await this.loadIncludes(incFile);
      }
    }
  },

  createFile(anyPath, isBrandNew) {
    const file = {
      id: fileIdCounter++,
      isMain: false,
      isBrandNew,
      absolutePath: anyPath,
      relPath: anyPath ? this._basename(anyPath) : 'Untitled.ink',
      content: '',
      savedContent: '',
      get hasUnsavedChanges() {
        if (this.isBrandNew) return true;
        return this.content !== this.savedContent;
      },
      symbols: {},
      includes: [],
      isLoading: !isBrandNew,
      isActive: false,
      isUnused: false
    };
    return file;
  },

  async loadFileContent(file) {
    if (file.isBrandNew) {
      file.isLoading = false;
      return;
    }

    try {
      let data = await window.api.fs.readFile(file.absolutePath, 'utf8');
      data = data.replace(/^\uFEFF/, '');
      file.content = data;
      file.savedContent = data;
      file.isLoading = false;

      this.parseSymbols(file);
    } catch (err) {
      console.error("Failed to load file:", err);
      file.savedContent = null;
      file.isLoading = false;
    }
  },

  updateFileContent(file, newContent) {
    file.content = newContent;
    file.compilerVersionDirty = true;
    this.parseSymbols(file);
    LiveCompiler.setEdited();
  },

  addNewInclude(mainFile, newIncludeRelPath) {
    if (!mainFile) return;

    // Add include line to main file content
    const includeText = "INCLUDE " + newIncludeRelPath + "\n";

    // Find last include row if any, or just prepend
    let newContent = mainFile.content || "";
    const lastIncludeIdx = newContent.lastIndexOf("INCLUDE ");

    if (lastIncludeIdx === -1) {
      newContent = includeText + newContent;
    } else {
      const nextLineIdx = newContent.indexOf("\n", lastIncludeIdx);
      if (nextLineIdx === -1) {
        newContent += "\n" + includeText.trim();
      } else {
        newContent = newContent.substring(0, nextLineIdx + 1) + includeText + newContent.substring(nextLineIdx + 1);
      }
    }

    this.updateFileContent(mainFile, newContent);

    // Create the new empty file POJO
    const store = useProjectStore();
    const newFile = this.createFile(this._join(this._dirname(mainFile.absolutePath), newIncludeRelPath), true);
    newFile.relPath = newIncludeRelPath;
    store.addFile(newFile);
    return newFile;
  },

  async renameFile(file, newName) {
    if (!newName || newName === file.relPath) return;
    if (!newName.endsWith('.ink')) newName += '.ink';

    const store = useProjectStore();
    const oldRelPath = file.relPath;
    const oldAbsolutePath = file.absolutePath;

    // Check if new name already exists
    if (store.files.some(f => f.relPath === newName)) {
      await useUiStore().alert({ title: 'File Exists', message: 'A file with this name already exists.', isError: true });
      return;
    }

    const fileDirectory = this._dirname(oldAbsolutePath);
    const newAbsolutePath = await window.api.path.join(fileDirectory, newName);

    try {
      const exists = await window.api.fs.exists(oldAbsolutePath);
      if (exists) {
        await window.api.fs.rename(oldAbsolutePath, newAbsolutePath);
      }
    } catch (err) {
      await useUiStore().alert({ title: 'Rename Failed', message: 'Failed to rename file on disk: ' + err, isError: true });
      return;
    }

    file.relPath = newName;
    file.absolutePath = newAbsolutePath;

    const mainFile = store.mainInkFile;
    if (mainFile && mainFile !== file) {
      const escapedOldPath = oldRelPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`^(\\s*INCLUDE\\s+)${escapedOldPath}(\\s*)$`, 'gm');
      if (regex.test(mainFile.content)) {
        const newContent = mainFile.content.replace(regex, `$1${newName}$2`);
        this.updateFileContent(mainFile, newContent);
      }
    }
  },

  parseSymbols(file) {
    if (!file._symbolsObj) {
      // Mock the inkFile interface expected by InkFileSymbols
      const mockInkFile = {
        getValue: () => file.content,
      };
      file._symbolsObj = new InkFileSymbols(mockInkFile, {
        includesChanged: () => {
          this.refreshUnusedStatus();
        }
      });
    }
    file._symbolsObj.parse();
    file.symbols = file._symbolsObj.getSymbols();
    file.includes = file._symbolsObj.includes || [];
    this.refreshUnusedStatus();
  },

  async exportProject(exportType) {
    const store = useProjectStore();
    const uiStore = useUiStore();
    if (!store.mainInkFile) {
      await uiStore.alert({ title: 'Project Loading', message: 'Project not quite fully loaded! Please try exporting again in a couple of seconds...' });
      return;
    }

    if (exportType === "eenk") {
      const inkPath = store.mainInkFile.absolutePath;
      if (!inkPath) {
        await uiStore.alert({ title: 'Unsaved Project', message: 'Please save your project first.' });
        return;
      }

      let defaultExportPath = inkPath;
      if (defaultExportPath) {
        const pathObj = await window.api.path.parse(defaultExportPath);
        pathObj.ext = ".eenk";
        pathObj.base = pathObj.name + ".eenk";
        defaultExportPath = await window.api.path.format(pathObj);
      }

      const saveOptions = {
        defaultPath: defaultExportPath,
        filters: [
          { name: "eenk Story Package", extensions: ["eenk"] },
          { name: "eenk Story Binary", extensions: ["bin"] }
        ]
      };
      const dialogResult = await window.api.invoke('showSaveDialog', saveOptions);
      const targetSavePath = dialogResult ? dialogResult.filePath : null;
      if (!targetSavePath) {
        return; // User cancelled
      }

      try {
        store.compilerBusy = true;
        const result = await window.api.invoke('eenk:compile', inkPath, { isTemp: true });

        const isEenkPackage = targetSavePath.toLowerCase().endsWith('.eenk');

        if (isEenkPackage && result.eenkPackageFile) {
          // Copy single .eenk zip bundle
          await window.api.fs.copyFile(result.eenkPackageFile, targetSavePath);
        } else {
          // Copy generated .bin file
          await window.api.fs.copyFile(result.binFile, targetSavePath);

          const targetDir = await window.api.path.dirname(targetSavePath);
          const targetParsed = await window.api.path.parse(targetSavePath);
          const targetStem = targetParsed.name;

          // Copy .media sidecar if present
          if (result.mediaFile) {
            const targetMedia = await window.api.path.join(targetDir, `${targetStem}.media`);
            await window.api.fs.copyFile(result.mediaFile, targetMedia);
          }

          // Copy any generated .epdfont sidecar files
          if (result.fontFiles && Array.isArray(result.fontFiles)) {
            for (const fontFile of result.fontFiles) {
              const fontBase = await window.api.path.basename(fontFile);
              const targetFont = await window.api.path.join(targetDir, fontBase);
              await window.api.fs.copyFile(fontFile, targetFont);
            }
          }
        }

        if (result.warnings && result.warnings.length > 0) {
          await uiStore.alert({ title: 'Compilation Warnings', message: result.warnings.join("\n\n") });
        }

        const sizeKb = (result.totalFileSize / 1024).toFixed(1);
        const heapKb = (result.heapRequirement / 1024).toFixed(1);
        const formatName = isEenkPackage ? "Package (.eenk)" : "Binary (.bin)";
        const summaryMsg = `Exported ${formatName} successfully to:\n${targetSavePath}\n\n• Binary Size: ${sizeKb} KB (${result.totalFileSize.toLocaleString()} bytes)\n• Containers: ${result.numContainers}\n• Runtime State Heap: ~${heapKb} KB`;

        await uiStore.alert({ title: 'Compilation Successful', message: summaryMsg });
        console.log('Compiled and exported successfully to: ' + targetSavePath);
      } catch (e) {
        await uiStore.alert({ title: 'Compilation Failed', message: 'Compilation failed: ' + e, isError: true });
      } finally {
        store.compilerBusy = false;
      }
      return;
    }

    // Always start by building the JSON
    const inkJsCompatible = exportType === "js" || exportType === "web";

    let compiledJsonTempPath;
    try {
      compiledJsonTempPath = await new Promise((resolve, reject) => {
        LiveCompiler.exportJson(inkJsCompatible, (err, path) => {
          if (err) reject(err);
          else resolve(path);
        });
      });
    } catch (err) {
      await uiStore.alert({ title: 'Export Error', message: `Could not export: ${err}`, isError: true });
      return;
    }

    let defaultExportPath = store.mainInkFile.absolutePath;
    if (defaultExportPath) {
      const pathObj = await window.api.path.parse(defaultExportPath);
      if (exportType === "json") {
        pathObj.ext = ".json";
      } else if (exportType === "js") {
        if (pathObj.ext !== ".js") {
          pathObj.base = await window.api.path.basename(await this.jsFilename(store.mainInkFile));
        }
        pathObj.ext = ".js";
      } else {
        // Strip existing extension
        pathObj.base = await window.api.path.basename(pathObj.base, pathObj.ext);
        pathObj.ext = "";
      }
      defaultExportPath = await window.api.path.format(pathObj);
    }

    let targetSavePath;

    if (exportType === "web") {
      const result = await window.api.invoke('eenk:open-file-dialog', {
        title: "Select Export Folder",
        defaultPath: defaultExportPath,
        properties: ['openDirectory', 'createDirectory', 'promptToCreate']
      });
      if (!result.canceled && result.filePaths.length > 0) {
        targetSavePath = result.filePaths[0];
      }
    } else {
      const saveOptions = { defaultPath: defaultExportPath };

      if (exportType === "json") {
        saveOptions.filters = [{ name: "JSON files", extensions: ["json"] }];
      } else if (exportType === "js") {
        saveOptions.filters = [{ name: "JavaScript files", extensions: ["js"] }];
      }
      const result = await window.api.invoke('showSaveDialog', saveOptions);
      targetSavePath = result.filePath;
    }

    if (targetSavePath) {
      if (exportType === "json" || exportType === "js") {
        try {
          const stats = await window.api.fs.stat(targetSavePath).catch(() => null);
          if (stats && stats.isDirectory) {
            await uiStore.alert({ title: 'Save Error', message: 'Could not save because directory exists with the given name', isError: true });
            return;
          }
          if (stats) {
            await window.api.fs.unlink(targetSavePath);
          }

          if (exportType === "js") {
            await this.convertJSONToJS(compiledJsonTempPath, targetSavePath);
          } else {
            await window.api.fs.copyFile(compiledJsonTempPath, targetSavePath);
          }
        } catch (err) {
          await uiStore.alert({ title: 'Save Error', message: `Sorry, could not save to ${targetSavePath}`, isError: true });
        }
      } else {
        // Web export
        await this.buildForWeb(compiledJsonTempPath, targetSavePath, store);
      }
    }
  },

  async jsFilename(mainInkFile) {
    let mainInkRootName = mainInkFile.relPath || "untitled";
    if (await window.api.path.extname(mainInkRootName) === ".ink") {
      mainInkRootName = await window.api.path.basename(mainInkRootName, ".ink");
    }
    let jsContentFilename = mainInkRootName + ".js";

    if (jsContentFilename === "main.js") {
      jsContentFilename = "story.js";
    }
    return jsContentFilename;
  },

  async convertJSONToJS(jsonFilePath, targetJSPath) {
    const jsonContent = await window.api.fs.readFile(jsonFilePath, "utf8");
    const jsContent = `var storyContent = ${jsonContent};`;
    await window.api.fs.writeFile(targetJSPath, jsContent, "utf8");
  },

  async copyDir(src, dest) {
    const stats = await window.api.fs.stat(dest).catch(() => null);
    if (!stats) {
      await window.api.fs.mkdir(dest);
    }
    const files = await window.api.fs.readdir(src);
    for (const file of files) {
      const srcFile = await window.api.path.join(src, file);
      const destFile = await window.api.path.join(dest, file);
      const stat = await window.api.fs.stat(srcFile);
      if (stat.isDirectory) {
        await this.copyDir(srcFile, destFile);
      } else {
        await window.api.fs.copyFile(srcFile, destFile);
      }
    }
  },

  async buildForWeb(jsonFilePath, targetDirectory, store) {
    const templateDir = await window.api.invoke("get-template-dir");
    const storyTitle = await window.api.path.basename(targetDirectory);

    try {
      const stats = await window.api.fs.stat(targetDirectory).catch(() => null);
      if (stats && !stats.isDirectory) {
        await useUiStore().alert({ title: 'Export Error', message: 'Could not save because a file exists with the given name', isError: true });
        return;
      }

      if (!stats) {
        await window.api.fs.mkdir(targetDirectory);
      }

      await this.copyDir(templateDir, targetDirectory);

      let indexHtmlPath = await window.api.path.join(targetDirectory, "index.html");
      let htmlContent = await window.api.fs.readFile(indexHtmlPath, "utf8");
      htmlContent = htmlContent.replace(/##STORY TITLE##/g, storyTitle);

      let jsContentFilename = await this.jsFilename(store.mainInkFile);
      htmlContent = htmlContent.replace(/##JAVASCRIPT FILENAME##/g, jsContentFilename);

      await window.api.fs.writeFile(indexHtmlPath, htmlContent, "utf8");

      let targetJsPath = await window.api.path.join(targetDirectory, jsContentFilename);
      await this.convertJSONToJS(jsonFilePath, targetJsPath);
    } catch (err) {
      console.error("Export for Web failed:", err);
      await useUiStore().alert({ title: 'Export Failed', message: 'Failed to export for web: ' + err, isError: true });
    }
  },

  async saveAll() {
    const store = useProjectStore();
    const dirtyFiles = store.files.filter(f => f.hasUnsavedChanges);
    if (dirtyFiles.length === 0) return true;

    // If main file is brand new (no absolutePath), save it first so save dialog is shown once
    // and the project directory is established for any new includes.
    const mainFile = dirtyFiles.find(f => f.isMain && !f.absolutePath);
    if (mainFile) {
      const mainSaved = await this.saveFile(mainFile.id);
      if (!mainSaved) return false;
    }

    const remainingDirty = store.files.filter(f => f.hasUnsavedChanges);
    if (remainingDirty.length === 0) return true;

    const results = await Promise.all(remainingDirty.map(file => this.saveFile(file.id)));
    return results.every(Boolean);
  },

  async saveFile(fileId) {
    console.log("[DEBUG] ProjectController.saveFile called for fileId:", fileId);
    const store = useProjectStore();
    const file = store.files.find(f => f.id === fileId);
    if (!file) {
      console.log("[DEBUG] saveFile aborted: file not found in store");
      return false;
    }

    // If this is an include file and main file has an absolutePath, resolve absolutePath if needed
    if (!file.isMain && store.mainInkFile && store.mainInkFile.absolutePath) {
      const mainDir = this._dirname(store.mainInkFile.absolutePath);
      if (!file.absolutePath || file.absolutePath.startsWith('/' + file.relPath)) {
        file.absolutePath = this._join(mainDir, file.relPath);
      }
    }

    try {
      console.log("[DEBUG] Attempting to save file. absolutePath:", file.absolutePath);
      if (file.absolutePath) {
        const fileDirectory = this._dirname(file.absolutePath);
        console.log("[DEBUG] creating directory:", fileDirectory);
        await window.api.fs.mkdir(fileDirectory);
        console.log("[DEBUG] writing file to disk:", file.absolutePath);
        await window.api.fs.writeFile(file.absolutePath, file.content || "", "utf8");

        file.savedContent = file.content;
        file.isBrandNew = false;
        file.justSaved = true; // flag to ignore watcher

        if (file.isMain) {
          console.log("[DEBUG] sending main-file-saved IPC...");
          window.api.send('main-file-saved', file.absolutePath);
        }
        return true;
      } else {
        console.log("[DEBUG] File has no absolutePath, showing save dialog...");
        const result = await window.api.invoke("showSaveDialog");
        console.log("[DEBUG] showSaveDialog result:", result);
        if (result && !result.canceled && result.filePath) {
          file.absolutePath = result.filePath;
          file.relPath = await window.api.path.basename(result.filePath);
          if (file.isMain) {
            store.mainInkFile.absolutePath = file.absolutePath;
          }
          return await this.saveFile(file.id);
        }
        return false;
      }
    } catch (err) {
      console.error("[DEBUG] Save failed:", err);
      return false;
    }
  },
};
