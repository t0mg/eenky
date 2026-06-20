import { InkFileSymbols } from "./inkFileSymbols.js";

const path = {
    isAbsolute: (p) => /^(?:[a-zA-Z]:[\\\/]|\/)/.test(p),
    basename: (p) => p.match(/[\\\/]?([^\\\/]+)$/)?.[1] || p,
    dirname: (p) => {
        const m = p.match(/^(.*)[\\\/][^\\\/]*$/);
        return m ? m[1] : "";
    },
    relative: (from, to) => {
        // Simple fallback: just return basename if relative fails
        from = from.replace(/\\/g, '/');
        to = to.replace(/\\/g, '/');
        if (to.startsWith(from)) {
            let rel = to.substring(from.length);
            if (rel.startsWith('/')) rel = rel.substring(1);
            return rel;
        }
        return path.basename(to);
    },
    join: (a, b) => {
        if (!a) return b;
        if (!b) return a;
        return a.replace(/[\\\/]$/, '') + '/' + b.replace(/^[\\\/]/, '');
    }
};

const assert = (condition, message) => {
    if (!condition) throw new Error(message || "Assertion failed");
};

let fileIdCounter = 0;

// -----------------------------------------------------------------
//   InkFile
// -----------------------------------------------------------------

// anyPath can be relative or absolute
export function InkFile(anyPath, mainInkFile, isBrandNew, inkMode, events) {
    
    this.id = fileIdCounter++;
    this.inkMode = inkMode;

    // Default filename if creating a new file, and passed null to constructor
    anyPath = anyPath || "Untitled.ink";

    this.mainInkFile = mainInkFile;

    // Obtain relative path by looking at main ink file
    if( path.isAbsolute(anyPath) ) {
        if( this.isMain() ) {
            this.relPath = path.basename(anyPath);
            this.projectDir = path.dirname(anyPath);
        } else {
            assert(this.mainInkFile.projectDir, "Main ink needs to be saved before we start loading includes with absolute paths.");
            this.relPath = path.relative(this.mainInkFile.projectDir, anyPath);
        }
    } 
    // Already relative
    else {
        this.relPath = anyPath;
    }

    this.events = events;

    var initialContent = "";
    if( mainInkFile == null ) {
        initialContent = "Once upon a time...\n\n"
            + " * There were two choices.\n"
            + " * There were four lines of content.\n\n"
            + "- They lived happily ever after.\n"
            + "    -> END\n"
    }
    this.textContent = initialContent;

    this.includes = [];

    this.justLoadedContent = false;
    this.compilerVersionDirty = true;
    this.justSaved = false;

    this.symbols = new InkFileSymbols(this, {
        includesChanged: (includes) => {
            this.includes = includes.slice();
            if (this.events && this.events.includesChanged) this.events.includesChanged();
        }
    });

    this.hasUnsavedChanges = isBrandNew;
    this.isLoading = !isBrandNew;

    this.tryLoadFromDisk(err => {
        if( err ) {
            this.hasUnsavedChanges = true;
            if (this.events && this.events.loadError) this.events.loadError(err);
        } else {
            this.hasUnsavedChanges = false;
            this.isLoading = false;
        }
    });
    
    this.onContentChanged = () => {
        this.hasUnsavedChanges = true;
        this.compilerVersionDirty = true;
        this.justSaved = false;
        this.symbols.dirty = true;
        this.symbols.scheduleParse();
        
        if( !this.justLoadedContent && this.events.fileChanged) 
            this.events.fileChanged();
    };
}

InkFile.prototype.isMain = function() {
    return this.mainInkFile == null;
}

InkFile.prototype.filename = function() {
    return path.basename(this.relPath);
}

InkFile.prototype.relativePath = function() {
    return this.relPath;
}

InkFile.prototype.absolutePath = function() {
    var mainInk = this.isMain() ? this : this.mainInkFile;

    if( !mainInk.projectDir )
        return null;
    
    return path.join(mainInk.projectDir, this.relPath);
}

InkFile.prototype.getValue = function() {
    return this.textContent;
}

InkFile.prototype.setValue = function(text) {
    this.textContent = text;
    this.onContentChanged();
}

InkFile.prototype.getLine = function(lineIndex) {
    const lines = this.textContent.split("\n");
    return lines[lineIndex] || "";
}

InkFile.prototype.save = async function(afterSaveCallback) {
    assert(this.isMain() || this.mainInkFile.projectDir, "Main ink file must be saved before we can save include files.");

    if( !this.absolutePath() ) {
        const result = await window.api.invoke("showSaveDialog", { filters: [
            { name: 'Ink files', extensions: ['ink'] },
            { name: 'Text files', extensions: ['txt'] }
        ]});
        
        let savedPath = result && result.filePath;
        if( savedPath ) {
            assert(this.isMain());
            this.relPath = path.basename(savedPath);
            this.projectDir = path.dirname(savedPath);

            this.save(afterSaveCallback);
        } else {
            if( afterSaveCallback )
                afterSaveCallback(false);
        }
    }
    else {
        this.justSaved = true;
        var fileContent = this.textContent || "";
        var fileAbsPath = this.absolutePath();
        var fileDirectory = path.dirname(fileAbsPath);
        
        try {
            await window.api.fs.mkdir(fileDirectory);
            await window.api.fs.writeFile(fileAbsPath, fileContent, "utf8");
            this.hasUnsavedChanges = false;
            if( afterSaveCallback ) afterSaveCallback(true);
        } catch(err) {
            if( afterSaveCallback ) afterSaveCallback(false);
        }
    }
}

InkFile.prototype.deleteFromDisk = async function() {
    var absPath = this.absolutePath();
    if( absPath ) {
        const exists = await window.api.fs.exists(absPath);
        if (exists) await window.api.fs.unlink(absPath);
    }
}

InkFile.prototype.tryLoadFromDisk = async function(loadCallback) {
    if( this.justSaved ) {
        this.justSaved = false;
        return;
    }

    loadCallback = loadCallback || (err => {});

    var absPath = this.absolutePath();
    if( !absPath ) {
        loadCallback("File doesn't yet have a project directory");
        return;
    }

    try {
        const stats = await window.api.fs.stat(absPath);
        if (stats.size > 2 * 1024 * 1024) {
            console.warn(`File ${absPath} is ${stats.size} bytes. Too large to auto-load. Ignoring.`);
            loadCallback("File too large");
            return;
        }

        let data = await window.api.fs.readFile(absPath, 'utf8');
        data = data.replace(/^\uFEFF/, '');

        loadCallback(null);

        this.justLoadedContent = true;

        this.textContent = data;
        this.hasUnsavedChanges = false;

        this.symbols.parse();
        
        window.dispatchEvent(new CustomEvent('ink-file-loaded', { detail: this.id }));
        window.dispatchEvent(new CustomEvent('ink-file-changed'));

        if (this.events.fileChanged) this.events.fileChanged();

        if (this.events.contentLoaded) {
            this.events.contentLoaded();
        }

        this.justLoadedContent = false;

    } catch(err) {
        console.error("Failed to load include at: "+absPath);
        loadCallback(err.message || "ink file not found");
    }
}

InkFile.prototype.addIncludeLine = function(relativePath) {
    this.includes.push(relativePath);
    if (this.events && this.events.includesChanged) this.events.includesChanged();

    var includeText = "INCLUDE "+relativePath+"\n";
    var lastIncludeRow = this.symbols.getLastIncludeRow();

    if( lastIncludeRow === -1 ) {
        this.textContent = includeText + this.textContent;
    } else {
        const lines = this.textContent.split("\n");
        lines.splice(lastIncludeRow + 1, 0, includeText.trim());
        this.textContent = lines.join("\n");
    }
    this.onContentChanged();
}

InkFile.prototype.setInkMode = function(newInkMode)
{
    this.inkMode = newInkMode;
}
