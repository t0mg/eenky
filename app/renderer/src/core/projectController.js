import { useProjectStore } from '../stores/projectStore';
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
      const store = useProjectStore();
      for (const file of store.files) {
        if (file.hasUnsavedChanges) {
          await this.saveFile(file.id);
        }
      }
    });

    window.api.receive('project-tryClose', async () => {
      const store = useProjectStore();
      const hasUnsavedChanges = store.files.some(f => f.hasUnsavedChanges);
      
      if (hasUnsavedChanges) {
        const responseObject = await window.api.invoke("try-close");
        const response = responseObject.response;
        
        if (response == 0) { // Save
          for (const file of store.files) {
            if (file.hasUnsavedChanges) {
              await this.saveFile(file.id);
            }
          }
          window.api.send("project-final-close");
        } 
        else if (response == 1) { // Don't save
          window.api.send("project-final-close");
        } 
        else { // Cancel
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
        const file = store.files.find(f => f.absolutePath === absFilePath);
        
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
    if(!p) return ''; 
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
    
    store.setProjectInfo({
      files: [file],
      mainInkFile: file,
      instructionPrefix: "// "
    });
    store.setActiveFile(file);
    
    LiveCompiler.setProject(store);
    
    await this.loadFileContent(store.mainInkFile);
    await this.loadIncludes(store.mainInkFile);
  },

  async loadIncludes(mainFile) {
    const store = useProjectStore();
    const mainDir = this._dirname(mainFile.absolutePath);
    for (const inc of mainFile.includes) {
      const absPath = this._join(mainDir, inc);
      let incFile = store.files.find(f => f.absolutePath === absPath);
      if (!incFile) {
        const rawFile = this.createFile(absPath, false);
        rawFile.relPath = inc; 
        store.addFile(rawFile);
        incFile = store.files.find(f => f.id === rawFile.id); // get Proxy
        await this.loadFileContent(incFile);
        await this.loadIncludes(incFile); // recursive
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
      symbols: {},
      includes: [],
      hasUnsavedChanges: isBrandNew,
      isLoading: !isBrandNew,
      isActive: false
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
      file.hasUnsavedChanges = false;
      file.isLoading = false;
      
      this.parseSymbols(file);
    } catch(err) {
      console.error("Failed to load file:", err);
      file.hasUnsavedChanges = true;
      file.isLoading = false;
    }
  },

  updateFileContent(file, newContent) {
    file.content = newContent;
    file.hasUnsavedChanges = true;
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
        alert("A file with this name already exists.");
        return;
    }

    const fileDirectory = this._dirname(oldAbsolutePath);
    const newAbsolutePath = await window.api.path.join(fileDirectory, newName);

    try {
        const exists = await window.api.fs.exists(oldAbsolutePath);
        if (exists) {
            await window.api.fs.rename(oldAbsolutePath, newAbsolutePath);
        }
    } catch(err) {
        alert("Failed to rename file on disk: " + err);
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
          // Trigger include refresh here in the future
        }
      });
    }
    file._symbolsObj.parse();
    file.symbols = file._symbolsObj.getSymbols();
    file.includes = file._symbolsObj.includes || [];
  },

  async exportProject(exportType) {
    const store = useProjectStore();
    if (!store.mainInkFile) {
        alert("Project not quite fully loaded! Please try exporting again in a couple of seconds...");
        return;
    }

    if (exportType === "eenk") {
        const inkPath = store.mainInkFile.absolutePath;
        if (!inkPath) {
            alert("Please save your project first.");
            return;
        }
        try {
            store.compilerBusy = true;
            const result = await window.api.invoke('eenk:compile', inkPath);
            console.log('Compiled successfully to: ' + result.binFile);
        } catch (e) {
            alert('Compilation failed: ' + e);
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
    } catch(err) {
        alert(`Could not export: ${err}`);
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
                    alert("Could not save because directory exists with the given name");
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
                alert(`Sorry, could not save to ${targetSavePath}`);
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
            alert("Could not save because a file exists with the given name");
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
    } catch(err) {
        console.error("Export for Web failed:", err);
        alert("Failed to export for web: " + err);
    }
  },

  async saveFile(fileId) {
    console.log("[DEBUG] ProjectController.saveFile called for fileId:", fileId);
    const store = useProjectStore();
    const file = store.files.find(f => f.id === fileId);
    if (!file) {
        console.log("[DEBUG] saveFile aborted: file not found in store");
        return false;
    }

    try {
      console.log("[DEBUG] Attempting to save file. absolutePath:", file.absolutePath);
      if (file.absolutePath) {
        const fileDirectory = this._dirname(file.absolutePath);
        console.log("[DEBUG] creating directory:", fileDirectory);
        await window.api.fs.mkdir(fileDirectory);
        console.log("[DEBUG] writing file to disk:", file.absolutePath);
        await window.api.fs.writeFile(file.absolutePath, file.content || "", "utf8");
        
        file.hasUnsavedChanges = false;
        file.justSaved = true; // flag to ignore watcher
        
        console.log("[DEBUG] sending main-file-saved IPC...");
        window.api.send('main-file-saved', file.absolutePath);
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
