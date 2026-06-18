const path = require("path");
const electron = require("electron");
const ipc = electron.ipcRenderer;
const _ = require("lodash");
const {filter, wrap, score} = require("fuzzaldrin-plus");

const InkProject = require("./inkProject.js").InkProject;
const EditorView = require("./editorView.js").EditorView;

const i18n = require("./i18n.js");

var gotoEl = null;
var gotoContainerEl = null;
var inputEl = null;
var resultsEl = null;

var selectedResultEl = null;

var lastMousePos = null;

var cachedFiles = null;
var cachedSymbols = null;
var cachedActiveFileSymbols = null;
var cachedLineGroups = null;
const linesPerGroup = 20000;

var resultsBuildInterval = null;

var events = {
    gotoFile: () => {},
    lookupRuntimePath: () => {}
};

function show() {

    EditorView.saveCursorPos();

    // Immediately focus the input box even if it's not
    // quite visible yet so that if you CMD-P and start typing immediately
    // the text goes in the right place.
    inputEl.focus();

    document.addEventListener("keydown", gotoGlobalKeyHandler);

    // Show goto view
    gotoEl.classList.remove("hidden");
    gotoContainerEl.classList.remove("ignore-events");
    inputEl.value = "";

    // Deselect any previously selected result
    select(null);

    // Collect all files
    var files = InkProject.currentProject.files;
    cachedFiles = _.map(files, file => ({
        name: file.filename(),
        file: file
    }));

    // Collect all symbols
    var allSymbols = [];
    var activeFileSymbols = [];
    for(var i=0; i<files.length; i++) {
        var file = files[i];
        var fileSymbols = file.symbols.getSymbols();

        if( file == InkProject.currentProject.activeInkFile ) {
            collectSymbols(activeFileSymbols, fileSymbols, true);
        } else {
            collectSymbols(allSymbols, fileSymbols, false);
        }
    }
    cachedSymbols = allSymbols;
    cachedActiveFileSymbols = activeFileSymbols;

    // Collect individual lines of all files
    // First, put the active file at the start so it gets searched first
    var filesSorted = [];
    filesSorted.push(InkProject.currentProject.activeInkFile);
    for(var i=0; i<files.length; i++) {
        var f = files[i];
        if( f != InkProject.currentProject.activeInkFile )
            filesSorted.push(f);
    }

    // Split files into lines for faster repeated searchability
    cachedLineGroups = [];
    var currentLines = [];
    for(var i=0; i<filesSorted.length; i++) {
        var file = filesSorted[i];
        var lines = file.getValue().split("\n");
        for(var row=0; row<lines.length; row++) {
            var line = lines[row];
            currentLines.push({
                line: line,
                lineLower: line.toLowerCase(),
                row: row,
                file: file
            });
            if( currentLines.length > linesPerGroup ) {
                cachedLineGroups.push(currentLines);
                currentLines = [];
            }
        }
    }
    cachedLineGroups.push(currentLines);
}

function collectSymbols(allSymbols, symbolsObj, recurse)
{
    var symbols = _.values(symbolsObj);
    allSymbols.push.apply(allSymbols, symbols);

    if( !recurse ) return;

    for(var j=0; j<symbols.length; j++) {
        var sym = symbols[j];
        if( sym.innerSymbols )
            collectSymbols(allSymbols, sym.innerSymbols, recurse);
    }
}

function hide({restoreCursor=true}={}) {
    document.removeEventListener("keydown", gotoGlobalKeyHandler);

    gotoEl.classList.add("hidden");
    gotoContainerEl.classList.add("ignore-events");

    if( restoreCursor ) {
        EditorView.focus();
        EditorView.restoreCursorPos();
    }
}

function toggle() {
    if( gotoEl.classList.contains("hidden") )
        show();
    else
        hide();
}

function addThoseWithMinScore(allResults, results, searchStr, minScore)
{
    for(var i=0; i<results.length; i++) {
        var result = results[i];
        var resScore = score(result.name, searchStr);
        result.score = resScore;
        if( resScore > minScore )
            allResults.push(result);
    }
}

function refresh() {

    var searchStr = inputEl.value;

    resultsEl.innerHTML = "";

    select(null);

    if( !searchStr ) return;

    // Cancel previous build of results
    if( resultsBuildInterval != null ) {
        clearInterval(resultsBuildInterval);
        resultsBuildInterval = null;
    }

    resultsEl.scrollTop = 0;

    var results = [];

    var lineNumMatch = searchStr.match(/^\s*(\d+)\s*$/);
    if( lineNumMatch ) {
        var lineNum = parseInt(lineNumMatch[1]);
        var file = InkProject.currentProject.activeInkFile;
        results.push({
            line: lineNum-1,
            lineContent: file.aceDocument.getLine(lineNum-1),
            file: file
        });
    }

    var runtimePathMatch = searchStr.match(/^(?:(?:[\w-]+)\.)+[\w-]+$/);
    if( runtimePathMatch ) {
        var path = runtimePathMatch[0];
        events.lookupRuntimePath(path, result => {
            if( result && result.filename && result.lineNumber ) {
                var lineNum = result.lineNumber;
                var file = InkProject.currentProject.inkFileWithRelativePath(result.filename);
                results.push({
                    runtimePath: path,
                    line: lineNum-1,
                    lineContent: file.aceDocument.getLine(lineNum-1),
                    file: file
                });
            }
        });
    }

    var fileResults = filter(cachedFiles, searchStr, {key: "name"});
    var activeFileSymResults = filter(cachedActiveFileSymbols, searchStr, {key: "name"});
    var symResults = filter(cachedSymbols, searchStr, {key: "name"});

    addThoseWithMinScore(results, fileResults, searchStr, 6000);
    addThoseWithMinScore(results, activeFileSymResults, searchStr, 6000);
    addThoseWithMinScore(results, symResults, searchStr, 6000);
    
    // Spread the rendering of the results over multiple frames
    // so that we don't have one big hit when there are lots of results.
    const buildInterval = 35;           // add more every X ms
    const maxResultsPerInterval = 10;   // how many results to add each interval

    var currentResultIdx = 0;
    var currentLineGroupIdx = 0;

    var resultBuildTick = () => {

        // Search the text of more lines?
        if( currentLineGroupIdx < cachedLineGroups.length ) {
            var linesToSearch = cachedLineGroups[currentLineGroupIdx];
            var searchStrLower = searchStr.toLowerCase();
            for(var i=0; i<linesToSearch.length; i++) {
                var line = linesToSearch[i];
                if( line.lineLower.indexOf(searchStrLower) != -1 )
                    results.push(line);
            }
            currentLineGroupIdx++;
        }

        // Render more results?
        var maxResultIdxToRenderNow = Math.min(results.length, currentResultIdx+maxResultsPerInterval) - 1;
        while(currentResultIdx <= maxResultIdxToRenderNow) {
            addResult(results[currentResultIdx], searchStr);
            currentResultIdx++;
        }

        // Done building results?
        const maxEverResults = 1000;
        if( currentResultIdx >= results.length-1 && currentLineGroupIdx >= cachedLineGroups.length || currentResultIdx >= maxEverResults ) {
            clearInterval(resultsBuildInterval);
            resultsBuildInterval = null;
        }
    };

    // Run the first build tick immediately to fill up the view
    resultBuildTick();
    resultsBuildInterval = setInterval(resultBuildTick, buildInterval);
}

function addResult(result, searchStr)
{
    var resultContent = result.name || result.line;

    var wrappedResult = wrap(String(resultContent), searchStr, { wrap: {
        tagOpen: "<span class='goto-highlight'>",
        tagClose: "</span>"
    }});


    var type = resultType(result);
    var resultEl = document.createElement("li");

    if( type == "file" ) {
        var dirStr = "";
        var file = result.file;
        var dirName = path.dirname(file.relativePath());
        if( dirName != "." )
            dirStr = `<span class='ancestor'>${dirName}/</span>`;
        resultEl.className = "file";
        resultEl.innerHTML = `📄 ${dirStr}${wrappedResult}`;
    }

    else if( type == "gotoLine" ) {
        resultEl.className = "gotoLine";
        resultEl.innerHTML = `<p>➡︎ ${i18n._("Go to line")} ${result.line+1}</p><p class='meta'>${result.lineContent}</p>`;
    }

    else if( type == "runtimePath" ) {
        resultEl.className = "runtimePath";
        resultEl.innerHTML = `<p>🔎 ${result.lineContent}</p><p class='meta'>${result.file.filename()} - ${i18n._("line")} ${result.line+1} (${i18n._("looked up internal runtime path")} ${result.runtimePath})</p>`;
    }

    else if( type == "symbol" ) {
        var ancestorStr = "";
        var ancestor = result.parent
        while(ancestor && ancestor.name) {
            ancestorStr = ancestor.name + "." + ancestorStr;
            ancestor = ancestor.parent;
        }
        if( ancestorStr )
            ancestorStr = `<span class='ancestor'>${ancestorStr}</span>`;

        var filePath = result.inkFile.relativePath();
        var lineNo = result.row+1;
        resultEl.className = "symbol";
        resultEl.innerHTML = `<p>✎ ${ancestorStr}${wrappedResult}</p><p class='meta'>${filePath} - ${i18n._("line")} ${lineNo}</p>`;
    }

    else if( type == "content" ) {
        var filePath = result.file.relativePath();
        var lineNo = result.row+1;
        resultEl.className = "content";
        resultEl.innerHTML = `<p>${wrappedResult}</p><p class='meta'>${filePath} - ${i18n._("line")} ${lineNo}</p>`;
    }

    resultEl._result = result;
    resultEl.addEventListener("click", (e) => { choose(resultEl); e.preventDefault(); return false; });
    resultEl.addEventListener("mousemove", (e) => {
        // Only mouse-over something if it's really the mouse that moved rather than
        // just the document scrolling under the mouse.
        if( lastMousePos == null || lastMousePos.pageX != e.pageX || lastMousePos.pageY != e.pageY ) {
            lastMousePos = { pageX: e.pageX, pageY: e.pageY };
            select(resultEl);
        }
    });
    resultsEl.appendChild(resultEl);
}

function select(resultEl)
{
    if( selectedResultEl != null )
        selectedResultEl.classList.remove("selected");

    selectedResultEl = resultEl;

    if( selectedResultEl != null )
        selectedResultEl.classList.add("selected");
}

function resultType(result)
{   
    if( typeof result.runtimePath != 'undefined' )
        return "runtimePath";

    if( typeof result.lineContent != 'undefined' )
        return "gotoLine";

    // Text content of line result
    if( typeof result.line !== 'undefined' )
        return "content";

    // File name
    if( result.file )
        return "file";

    // Symbol
    else if( typeof result.row !== 'undefined' )
        return "symbol";

    return null;
}

function choose(resultEl)
{
    var result = resultEl._result;
    var type = resultType(result);

    // Text content of line result
    if( type == "content" )
        events.gotoFile(result.file, result.row);

    // Go to line number / runtime path
    else if( type == "gotoLine" || type == "runtimePath" )
        events.gotoFile(result.file, result.line);

    // File name
    if( type == "file" )
        events.gotoFile(result.file);

    // Symbol
    else if( type == "symbol" )
        events.gotoFile(result.inkFile, result.row);

    // done!
    hide({restoreCursor: false});
}

function nextResult() {

    // Select very first (after input being active)
    if( selectedResultEl == null ) {
        var first = resultsEl.children[0];
        if( first )
            select(first);
        inputEl.blur();
        return;
    }

    var next = selectedResultEl.nextElementSibling;
    if( next )
        select(next);
}

function previousResult() {
    if( selectedResultEl == null ) return;
    var prev = selectedResultEl.previousElementSibling;
    if( prev )
        select(prev);
}

function scrollToRevealResult() {
    if( selectedResultEl != null ) {
        var container = selectedResultEl.parentElement;
        var containerRect = container.getBoundingClientRect();
        var itemRect = selectedResultEl.getBoundingClientRect();
        if( itemRect.top < containerRect.top || itemRect.bottom > containerRect.bottom ) {
            selectedResultEl.scrollIntoView(itemRect.top < (containerRect.top + containerRect.height/2));
        }
    }
}

function gotoGlobalKeyHandler(e) {

    // down
    if( e.keyCode == 40 ) {
        e.preventDefault();
        nextResult();
        scrollToRevealResult();
    } 

    // up
    else if( e.keyCode == 38 ) {
        e.preventDefault();
        previousResult();
        scrollToRevealResult();
    }

    // return
    else if( e.keyCode == 13 ) {
        e.preventDefault();
        if( selectedResultEl != null )
            choose(selectedResultEl);
    }

    // escape
    else if( e.keyCode == 27 ) {
        e.preventDefault();
        hide();
    }
}

window.addEventListener("DOMContentLoaded", () => {
    gotoEl = document.getElementById("goto-anything");
    gotoContainerEl = document.getElementById("goto-anything-container");
    inputEl = gotoEl.querySelector("input");
    resultsEl = gotoEl.querySelector(".results");
    inputEl.addEventListener("input", refresh);
    inputEl.addEventListener("focus", () => select(null));

    gotoContainerEl.addEventListener("click", (e) => {
        if (e.target === gotoContainerEl) hide();
    });

    // Some other events are handled global document handler
    inputEl.addEventListener("keydown", (e) => {
        if( e.keyCode == 13 ) {
            nextResult();
            e.preventDefault();
        }
    });
});

ipc.on("goto-anything", (event) => {
    toggle();
});

exports.GotoAnything = {
    setEvents: e => events = e,
}