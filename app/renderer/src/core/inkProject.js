import { useProjectStore } from '../stores/projectStore.js';
import { useUiStore } from '../stores/uiStore.js';
import path from 'path-browserify';
import i18n from './i18n.js';
import _ from 'lodash';
import { InkFile } from './inkFile.js';
import { LiveCompiler } from './liveCompiler.js';

// removed Ace dependency








// -----------------------------------------------------------------
// InkProject
// -----------------------------------------------------------------

InkProject.events = {};
InkProject.currentProject = null;

// mainInkFilePath is optional, if creating a brand new untitled project
// Can also be absolute, if loading a project.
function InkProject(mainInkFilePath) {
    this.files = [];
    this.hasUnsavedChanges = false;
    this.unsavedFiles = [];

    this.inkMode = { instructionPrefix: "// " };

    this.mainInk = null;
    this.mainInk = this.createInkFile(mainInkFilePath || null, mainInkFilePath === undefined);

    useProjectStore().setProjectInfo({ files: this.files, mainInkFile: this.mainInk, instructionPrefix: this.inkMode.instructionPrefix });
    useProjectStore().setActiveFile(this.mainInk);

    this.ready = false;
    this.saveActive = false;

    this.startFileWatching();
}

InkProject.prototype.createInkFile = function(anyPath, isBrandNew, loadErrorCallback) {
    var inkFile = new InkFile(anyPath || null, this.mainInk, isBrandNew, this.inkMode, {
        fileChanged: () => { 
            if( inkFile.hasUnsavedChanges && !this.unsavedFiles.includes(inkFile) ) {
                this.unsavedFiles.push(inkFile);
                this.refreshUnsavedChanges();
            }
            this.refreshIncludes();
        },
        includesChanged: () => {         
            this.refreshIncludes();
        },
        loadError: err => {
            if( loadErrorCallback )
                loadErrorCallback(err);
        }
    });

    this.files.push(inkFile);

    this.sortFileList();
    
    return inkFile;
}

InkProject.prototype.addNewInclude = function(newIncludePath, addToMainInk) {

    // Convert new include path to relative if it's not already
    if( path.isAbsolute(newIncludePath) ) {
        assert(this.mainInkFile.projectDir, "Main ink needs to be saved before we start loading includes with absolute paths.");
        newIncludePath = path.relative(this.mainInk.projectDir, newIncludePath);
    }

    // Make sure it doesn't already exist
    var alreadyExists = (this.files).some((f) => f.relativePath() == newIncludePath);
    if( alreadyExists ) {
        alert(`${i18n._("Could not create new include file at")} ${newIncludePath} ${i18n._("because it already exists!")}`);
        return null;
    }

    var newIncludeFile = this.createInkFile(newIncludePath || null, isBrandNew = true);

    if( addToMainInk )
        this.mainInk.addIncludeLine(newIncludeFile.relativePath());

    /* NavView.setFiles */
    useProjectStore().setProjectInfo({ files: this.files, mainInkFile: this.mainInk, instructionPrefix: this.inkMode.instructionPrefix });
    return newIncludeFile;
}

// - Load any newly discovered includes
// - Refresh nav hierarchy in sidebar
InkProject.prototype.refreshIncludes = function() {

    var existingRelFilePaths = this.files.map(f => f.relativePath()).filter(x => x !== this.mainInk.relativePath());

    var relPathsFromINCLUDEs = [];
    var addIncludePathsFromFile = (inkFile) => {
        if( inkFile.includes.length == 0 )
            return;

        inkFile.includes.forEach(incPath => {
            
            // fix include relative path on windows
            // on windows path should be either always stored using the same folder separator (\\ or /).
            // mixing them can create unexpected behaviours.
            incPath = path.format(path.parse(incPath));

            let alreadyDone = relPathsFromINCLUDEs.contains(incPath);

            relPathsFromINCLUDEs.push(incPath);

            var recurseInkFile = this.inkFileWithRelativePath(incPath);
            if( recurseInkFile && !alreadyDone )
                addIncludePathsFromFile(recurseInkFile);
        });
    }
    addIncludePathsFromFile(this.mainInk);

    // Includes that we don't have in this.files yet that are mentioned in other files
    var includeRelPathsToLoad = _.difference(relPathsFromINCLUDEs, existingRelFilePaths)

    // Files that are in this.files that aren't actually mentioned anywhere
    var spareRelFilePaths = _.difference(existingRelFilePaths,  relPathsFromINCLUDEs);

    // Mark files that are spare, so they go in a special category at the bottom
    this.files.forEach(f => {
        f.isSpare = spareRelFilePaths.indexOf(f.relativePath()) != -1;
    });

    // Load up newly mentioned include files, if they exist
    if( this.mainInk.projectDir ) {
        includeRelPathsToLoad.forEach(newIncludeRelPath => {
            let absPath = path.join(this.mainInk.projectDir, newIncludeRelPath);
            window.api.fs.stat(absPath, (err, stats) => {
                // If it exists, and double check that it hasn't already been created during the async fs.stat
                if( !!stats && stats.isFile() &&  !(this.files).some(f => f.relativePath() == newIncludeRelPath) ) {
                    let newFile = this.createInkFile(newIncludeRelPath, isBrandNew = false, err => {
                        alert(`${i18n._("Failed to load ink file:")} ${err}`);
                        this.files.remove(newFile);
                        this.refreshIncludes();
                    });
                }
            });
            
        });

        this.sortFileList();
    }

    /* NavView.setFiles */
    useProjectStore().setProjectInfo({ files: this.files, mainInkFile: this.mainInk, instructionPrefix: this.inkMode.instructionPrefix });
    LiveCompiler.setEdited();
}

InkProject.prototype.sortFileList = function() {
    var mainInkFile = this.mainInk;
    this.files.sort(function(a,b) {
        return mainInkFile.includes.indexOf(a.relPath) - mainInkFile.includes.indexOf(b.relPath) 
    } );
}

InkProject.prototype.refreshUnsavedChanges = function() {

    this.hasUnsavedChanges = this.unsavedFiles.length > 0;

    // Update NavView for whether files are bold or not
    // TODO: This could be faster if it simply refreshes the state rather than
    // rebuilding the entire nav view hierarchy
    /* NavView.setFiles */

    // Overall, are there *any* unsaved changes, and has the state changed?
    // Change the dot in the Mac close window button
    window.api.invoke("change-mac-dot", this.hasUnsavedChanges);
}

InkProject.setupGlobalWatcherListener = function() {
    if (InkProject.hasGlobalWatcherListener) return;
    InkProject.hasGlobalWatcherListener = true;
    
    window.api.fs.onWatcherEvent((eventData) => {
        if (InkProject.currentProject) {
            InkProject.currentProject.handleWatcherEvent(eventData);
        }
    });
};

InkProject.prototype.handleWatcherEvent = function(eventData) {
    const { eventName, path: absFilePath } = eventData;
    
    if( this.saveActive ) return;

    const tryUpdateSettingsFile = fileAbsPath => {
        const mainInkPath = this.mainInk.absolutePath();
        let basePath = mainInkPath;
        if( basePath && window.api.path.extname(basePath) == ".ink" ) {
            basePath = basePath.substring(0, basePath.length-4);
        }
        
        let expectedSettingsPath = basePath + ".settings.json";
        if( expectedSettingsPath != fileAbsPath ) {
            return false;
        }

        window.api.invoke("project-settings-needs-reload", mainInkPath);
        return true; 
    }

    const isInkFile = fileAbsPath => fileAbsPath.split(".").pop() == "ink";

    if (eventName === 'ready') {
        this.ready = true;
        return;
    }

    if (tryUpdateSettingsFile(absFilePath)) return;
    if (!isInkFile(absFilePath)) return;

    const projectDir = this.mainInk.projectDir.replace(/\\/g, '/');
    const normalizedAbsPath = absFilePath.replace(/\\/g, '/');
    
    let relPath = normalizedAbsPath;
    if (normalizedAbsPath.startsWith(projectDir)) {
        relPath = normalizedAbsPath.substring(projectDir.length);
        if (relPath.startsWith('/')) relPath = relPath.substring(1);
    }

    if (eventName === 'add') {
        var existingFile = (this.files).find(f => f.relativePath().replace(/\\/g, '/') == relPath);
        if( !existingFile ) {
            let newFile = this.createInkFile(absFilePath, false, err => {
                alert("Failed to load ink file: " + err);
                this.files.remove(newFile);
                this.refreshIncludes();
            });
            this.refreshIncludes();
        }
    } else if (eventName === 'change') {
        var inkFile = (this.files).find(f => f.relativePath().replace(/\\/g, '/') == relPath);
        if( inkFile && !inkFile.hasUnsavedChanges ) {
            inkFile.tryLoadFromDisk(err => {});
        }
    } else if (eventName === 'unlink') {
        var inkFile = (this.files).find(f => f.relativePath().replace(/\\/g, '/') == relPath);
        if( inkFile && !inkFile.hasUnsavedChanges && inkFile != this.mainInk ) {
            this.deleteInkFile(inkFile);
        }
    }
}

InkProject.prototype.startFileWatching = function() {
    if( !this.mainInk || !this.mainInk.projectDir ) {
        this.ready = true;
        return;
    }

    InkProject.setupGlobalWatcherListener();
    window.api.fs.watch(this.mainInk.projectDir);
}

InkProject.prototype.showInkFile = function(inkFile) {

    if( _.isString(inkFile) )
        inkFile = this.inkFileWithRelativePath(inkFile);

    if( inkFile && inkFile != this.activeInkFile ) {
        if( this.activeInkFile )
            this.activeInkFile.isActive = false;

        this.activeInkFile = inkFile;

        if( this.activeInkFile )
            this.activeInkFile.isActive = true;

        useProjectStore().setActiveFile(inkFile);
    }
}

InkProject.prototype.save = function(afterSaveCallback) {

    // Make saving atomic, don't save again if we're already saving
    if( this.saveActive ) return;
    this.saveActive = true;

    var wasUnsaved = !this.mainInk.projectDir;

    var filesRemaining = this.files.length;
    var includeFiles = (this.files).filter(f => f != this.mainInk);

    var allSuccess = true;

    var singleFileSaveComplete = (file, success) => {
        allSuccess = allSuccess && success;
        if( success ) this.unsavedFiles.remove(file);

        filesRemaining--;
        if( filesRemaining == 0 ) {
            this.refreshUnsavedChanges();
            
            useProjectStore().setProjectInfo({ files: [...this.files], mainInkFile: this.mainInk, instructionPrefix: this.inkMode.instructionPrefix });

            this.saveActive = false;
            if (typeof afterSaveCallback === 'function') {
                afterSaveCallback(allSuccess);
            }
        }
    }

    // Save main ink to ensure the other files have a base directory path
    this.mainInk.save(success => {
        singleFileSaveComplete(this.mainInk, success);

        window.api.invoke("main-file-saved", this.mainInk.absolutePath());

        // May not be a success if cancelled, in which case we stop early
        if( success ) {

            if( wasUnsaved ) this.startFileWatching();

            includeFiles.forEach(f => f.save(success => singleFileSaveComplete(f, success)));
        } 
        
        // Cancel the save process because main ink file save failed
        else {
            this.saveActive = false;
        }
    });
}

// Helper to copy a file whilst optionally transforming the content
function copyFile(source, destination, transform) {
    window.api.fs.readFile(source, "utf8", (err, fileContent) => {
        if( !err && fileContent ) {
            if( transform ) fileContent = transform(fileContent);
            if( fileContent.length < 1 ) throw "Trying to write (copy) empty file!";
            
            window.api.fs.writeFile(destination, fileContent, "utf8", err => {
                if( err ) alert(`Failed to save file '${destination}'`);
            });
        }
    });
}

// exportType is "json", "web", or "js"
InkProject.prototype.export = function(exportType) {

    if( !this.ready ) {
        alert(i18n._("Project not quite fully loaded! Please try exporting again in a couple of seconds..."));
        return;
    }

    // Always start by building the JSON
    var inkJsCompatible = exportType == "js" || exportType == "web";
    LiveCompiler.exportJson(inkJsCompatible, (err, compiledJsonTempPath) => {
        if( err ) {
            alert(`${i18n._("Could not export:")} ${err}`);
            return;
        }

        if( !this.defaultExportPath && this.mainInk.absolutePath() ) {
            this.defaultExportPath = this.mainInk.absolutePath();
        }

        if( this.defaultExportPath ) {
            var pathObj = path.parse(this.defaultExportPath);
            if( exportType == "json" ) {
                pathObj.ext = ".json";
            } else if( exportType == "js" ) {
                // If we already have a default export path specifically for JS files
                // then we use that, otherwise let's use the standard JS naming scheme
                if( pathObj.ext != ".js" )
                    pathObj.base = path.basename(this.jsFilename());
                pathObj.ext = ".js";
            } else {
                // Strip existing extension
                pathObj.base = path.basename(pathObj.base, pathObj.ext);
                pathObj.ext = "";
            }

            this.defaultExportPath = path.format(pathObj);
        }

        var saveOptions = {
            defaultPath: this.defaultExportPath
        }

        if( exportType == "json" ) {
            saveOptions.filters = [
                { name: i18n._("JSON files"), extensions: ["json"] }
            ]
        } else if( exportType == "js" ) {
            saveOptions.filters = [
                { name: i18n._("JavaScript files"), extensions: ["js"] }
            ]
        }

        window.api.invoke('showSaveDialog', saveOptions).then((result) => {
            let targetSavePath = result.filePath;
            if( targetSavePath ) { 
                this.defaultExportPath = targetSavePath;
    
                // JSON export - simply move compiled json into place
                if( exportType == "json" || exportType == "js" ) {
                    window.api.fs.stat(targetSavePath, async (err, stats) => {
    
                        // File already exists, or there's another error
                        // (error when code == ENOENT means file doens't exist, which is fine)
                        if( !err || err.code != "ENOENT" ) {
                            if( err ) alert(`${i18n._("Sorry, could not save to")} ${targetSavePath}`);
    
                            if( stats && stats.isFile() ) await window.api.fs.unlink(targetSavePath);
    
                            if( stats.isDirectory() ) {
                                alert(i18n._("Could not save because directory exists with the given name"));
                                return
                            }
                        }
    
                        // JS file: 
                        if( exportType == "js" ) {
                            this.convertJSONToJS(compiledJsonTempPath, targetSavePath);
                        } 
    
                        // JSON: Just copy into p
                        else {
                            copyFile(compiledJsonTempPath, targetSavePath);
                        }
    
                    });
                }
    
                // Web export
                else {
                    this.buildForWeb(compiledJsonTempPath, targetSavePath);
                }
            }
        });

    });
}

InkProject.prototype.exportJson = function() {
    this.export("json");
}

InkProject.prototype.exportForWeb = function() {
    this.export("web");
}

InkProject.prototype.exportJSOnly = function() {
    this.export("js");
}

InkProject.prototype.jsFilename = function() {
    // Derive story content js file from root ink filename
    // Remove .ink extension if it's ".ink"
    var mainInkRootName = this.mainInk.filename();
    if( path.extname(mainInkRootName) == ".ink" )
        mainInkRootName = path.basename(mainInkRootName, ".ink");
    var jsContentFilename = mainInkRootName+".js";

    // Avoid naming collision with our own main.js
    // (if user chose "main.ink" for their root ink)
    if( jsContentFilename == "main.js" ) {
        jsContentFilename = "story.js";
    }

    return jsContentFilename;
}

// Convert JSON to JS file with "var storyContent = "
InkProject.prototype.convertJSONToJS = function(jsonFilePath, targetJSPath) {
    copyFile(jsonFilePath, targetJSPath, (jsonContent) => {
        return `var storyContent = ${jsonContent};`;
    });
}

InkProject.prototype.buildForWeb = async function(jsonFilePath, targetDirectory) {

    var templateDir = path.join(__dirname, "../export-for-web-template");

    // Derive story title from save name
    var storyTitle = path.basename(targetDirectory);
    
    // Unless the writer explicitly provided a tag with the title
    var mainInkTagDict = this.mainInk.symbols.globalDictionaryStyleTags;
    if( mainInkTagDict && mainInkTagDict["title"] ) {
        storyTitle = mainInkTagDict["title"];
    }

    // Create target directory name
    await window.api.fs.mkdir(targetDirectory);

    // Create JS story file with correct name
    var jsFullPath = path.join(targetDirectory, this.jsFilename());
    this.convertJSONToJS(jsonFilePath, jsFullPath);

    // Copy index.html:
    //  - inserting the filename as the <title> and <h1>
    //  - Inserting the correct name of the javascript file
    copyFile(path.join(templateDir, "index.html"), 
             path.join(targetDirectory, "index.html"), 
             (fileContent) => {
        fileContent = fileContent.replace(/##STORY TITLE##/g, storyTitle);
        fileContent = fileContent.replace(/##JAVASCRIPT FILENAME##/g, this.jsFilename());
        return fileContent;
    });

    // Copy other files verbatim
    copyFile(path.join(__dirname, "../node_modules/inkjs/dist/ink.js"),
             path.join(targetDirectory, "ink.js"));

    copyFile(path.join(templateDir, "style.css"), 
             path.join(targetDirectory, "style.css"));

    copyFile(path.join(templateDir, "main.js"), 
         path.join(targetDirectory, "main.js"));
}

InkProject.prototype.tryClose = function() {
    if( this.hasUnsavedChanges ) {
        window.api.invoke("try-close").then((responseObject) => {
            var response = responseObject.response;
            if( response == 0 ) {
                this.save(() => {
                    this.closeImmediate();
                });
            }
            
            // Don't save
            else if( response == 1 ) {
                this.closeImmediate();
            }
            
            // Cancel
            else { 
                window.api.send("project-cancelled-close");
            }
            })
    }
    // Nothing to save, just exit
    else {
        this.closeImmediate();
    }
}

// Response from the close menu


InkProject.prototype.closeImmediate = function() {
    window.api.send("project-final-close");
}

InkProject.prototype.inkFileWithRelativePath = function(relativePath) {
    return (this.files).find(f => f.relativePath().replace('\\', '/') == relativePath);
}

InkProject.prototype.inkFileWithId = function(id) {
    return (this.files).find(f => f.id == id);
}

InkProject.prototype.deleteInkFile = function(inkFile) {

    if( this.activeInkFile == inkFile )
        this.showInkFile(this.mainInk);

    inkFile.deleteFromDisk();

    this.files.remove(inkFile);

    /* NavView.setFiles */
    useProjectStore().setProjectInfo({ files: this.files, mainInkFile: this.mainInk, instructionPrefix: this.inkMode.instructionPrefix });
}

InkProject.prototype.findSymbol = function(name, posContext) {

    // Name components
    var nameComps = name.split(".");
    var baseName = nameComps[0];
    var tailNameComps = nameComps.slice(1);

    // Find starting symbol based on the context
    var symbolContext = this.activeInkFile.symbols.symbolAtPos(posContext);

    // Helper function to search downward into a symbol to find a single name
    function findWithinSymbolDeep(withinSymbol, targetName) {
        if( withinSymbol.innerSymbols ) {
            var foundSym = withinSymbol.innerSymbols[targetName];
            if( foundSym ) {
                return foundSym;
            } else {
                for(var innerSymName in withinSymbol.innerSymbols) {
                    foundSym = findWithinSymbolDeep(withinSymbol.innerSymbols[innerSymName])
                    if( foundSym )
                        return foundSym;
                }
            }
        }
    }

    // Try searching towards leaves first
    var baseSymbol = findWithinSymbolDeep(symbolContext, baseName);

    // Otherwise, work our way up to a broader and broader scope to
    // find the a symbol that contains the base name we're looking for
    if( !baseSymbol ) {
        while(symbolContext) {
            if( symbolContext.innerSymbols ) {
                var found = symbolContext.innerSymbols[baseName];
                if( found ) {
                    baseSymbol = found;
                    break;
                }
            }
            symbolContext = symbolContext.parent;
        }
    }

    // Finally, try to search within all files scope
    if( !baseSymbol ) {

        // Collect all symbols
        var allSymbols = {};
        for(var i=0; i<this.files.length; i++) {
            var file = this.files[i];
            var fileSymbols = file.symbols.getSymbols();
            var found = fileSymbols[baseName];
            if( found ) {
                baseSymbol = found;
                break;
            }
        }
    }
    
    if( !baseSymbol ) {
        console.log("Failed to find base symbol: "+baseName);
        return null;
    }

    // Resolve the rest of the path
    var symbol = baseSymbol;
    for(var i=0; i<tailNameComps.length; i++) {
        var tailComp = tailNameComps[i];
        var tailSymbol = findWithinSymbolDeep(symbol, tailComp);
        if( !tailSymbol ) {
            console.log("Failed to find complete path due to not finding: "+tailComp);
            return symbol;
        }
        
        symbol = tailSymbol;
    }

    console.log("Found "+symbol.name);
    return symbol;
}


InkProject.prototype.refreshProjectSettings = function(newProjectSettings) {
    if( this.instructionPrefix != newProjectSettings.instructionPrefix ) {
        this.instructionPrefix = newProjectSettings.instructionPrefix;

        // PlayerView.setInstructionPrefix(this.instructionPrefix);
        
        // Refresh the InkMode, which affects syntax highlighting.
        this.inkMode = { instructionPrefix: this.instructionPrefix };

        for(let inkFile of this.files) {
            inkFile.setInkMode(this.inkMode);
        }
    }
}

InkProject.setEvents = function(e) {
    InkProject.events = e;
}

InkProject.startNew = function() {
    InkProject.setProject(new InkProject());
}

InkProject.loadProject = function(mainInkPath) {
    InkProject.setProject(new InkProject(mainInkPath));
}

InkProject.setProject = function(project) {
    InkProject.currentProject = project;
}

window.api.receive('set-project-main-ink-filepath', (filePath) => {
    InkProject.loadProject(filePath);
});

window.api.receive('open-main-ink', () => {
    if( InkProject.currentProject ) {
        InkProject.currentProject.showInkFile(InkProject.currentProject.mainInk);
    }
});

window.api.receive('project-new-include', () => {
    if( InkProject.currentProject ) {
        // NavView.show();
        // NavView.showAddIncludeForm();
    }
});

window.api.receive('project-save', () => {
    if( InkProject.currentProject ) {
        InkProject.currentProject.save();
    }
});

window.api.receive('project-export', () => {
    if( InkProject.currentProject ) {
        InkProject.currentProject.exportJson();
    }
});

window.api.receive('project-export-for-web', () => {
    if( InkProject.currentProject ) {
        InkProject.currentProject.exportForWeb();
    }
});

window.api.receive('project-export-js-only', () => {
    if( InkProject.currentProject ) {
        InkProject.currentProject.exportJSOnly();
    }
});

window.api.receive('project-tryClose', () => {
    if( InkProject.currentProject ) {
        InkProject.currentProject.tryClose();
    }
});

window.api.receive('project-settings-changed', (settings) => {
    if( InkProject.currentProject ) {
        InkProject.currentProject.refreshProjectSettings(settings);
    }
});

export { InkProject };

window.api.fs.onWatcherEvent(({dirPath, eventName, path}) => {
    if (InkProject.currentProject && InkProject.currentProject.mainInk && InkProject.currentProject.mainInk.projectDir === dirPath) {
        if (eventName === 'add' || eventName === 'change' || eventName === 'unlink' || eventName === 'ready') {
            InkProject.currentProject.refreshIncludes();
        }
    }
});
