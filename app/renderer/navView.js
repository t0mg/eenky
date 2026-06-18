const path = require("path");
const _ = require("lodash");
const i18n = require("./i18n.js");
const InkFile = require("./inkFile.js").InkFile;

const slideAnimDuration = 200;
var sidebarWidth = 200;

var sidebarEl = null;
var fileNavWrapperEl = null;
var knotStichNavWrapperEl = null;
var twoPaneEl = null;
var sidebarSplitEl = null;
var footerEl = null;
var newIncludeFormEl = null;

var visible = false;
var hasBeenShown = false;
var events = {};

window.addEventListener("DOMContentLoaded", () => {
    //Assign each variable to the allocated class/id.
    sidebarEl = document.querySelector(".sidebar");
    fileNavWrapperEl = sidebarEl.querySelector("#file-nav-wrapper");
    knotStichNavWrapperEl = sidebarEl.querySelector("#knot-stitch-wrapper");
    twoPaneEl = document.querySelector(".twopane");
    sidebarSplitEl = document.querySelector("#main > .split");
    if (sidebarSplitEl) {
        sidebarSplitEl.style.display = "none";
        sidebarSplitEl.style.left = "0px";
    }
    footerEl = sidebarEl.querySelector(".footer");

    // Clicking on navigation item
    fileNavWrapperEl.addEventListener("click", function(event) {
        var item = event.target.closest(".nav-group-item");
        if (item && fileNavWrapperEl.contains(item)) {
            event.preventDefault();
            highlightNavGroupItem(item);
            var fileId = parseInt(item.getAttribute("data-file-id"));
            events.clickFileId(fileId);
        }
    });

    knotStichNavWrapperEl.addEventListener("click", function(event) {
        var item = event.target.closest(".nav-group-item");
        if (item && knotStichNavWrapperEl.contains(item)) {
            event.preventDefault();
            var row = item.getAttribute("row");
            events.jumpToRow(parseInt(row));
        }
    });

    // Add new include interactions
    newIncludeFormEl = footerEl.querySelector(".new-include-form");
    
    var addIncludeBtn = sidebarEl.querySelector(".add-include-button");
    if (addIncludeBtn) {
        addIncludeBtn.addEventListener("click", function(event) {
            setIncludeFormVisible(true);
            event.preventDefault();
        });
    }

    var cancelAddIncludeBtn = sidebarEl.querySelector("#cancel-add-include");
    if (cancelAddIncludeBtn) {
        cancelAddIncludeBtn.addEventListener("click", function(event) {
            setIncludeFormVisible(false);
            event.preventDefault();
        });
    }

    function confirmAddInclude() {
        var inputBox = newIncludeFormEl.querySelector("input[type='text']");
        var addToMainInkCheckbox = newIncludeFormEl.querySelector(".add-to-main-ink input");

        var confirmedFilename = inputBox.value;
        if( !confirmedFilename || confirmedFilename.trim().length == 0 ) {
            inputBox.classList.add("error");
            setImmediate(() => inputBox.focus());
        } else {
            var shouldAddToMainInk = addToMainInkCheckbox.checked;
            var success = events.addInclude(confirmedFilename, shouldAddToMainInk);
            if( success ) setIncludeFormVisible(false);
        }
    }

    sidebarEl.addEventListener("keypress", function(event) {
        if (event.target.tagName === "INPUT") {
            const returnKey = 13;
            if( event.which == returnKey ) {
                confirmAddInclude();
                event.preventDefault();
            }
        }
    });

    var addIncludeConfirmBtn = sidebarEl.querySelector("#add-include");
    if (addIncludeConfirmBtn) {
        addIncludeConfirmBtn.addEventListener("click", function(event) {
            event.preventDefault();
            confirmAddInclude();
        });
    }

    // Unfortunately you can't capture escape from the input itself
    document.addEventListener("keyup", function(e) {
        const escape = 27;
        if (e.keyCode == escape) {
            var input = newIncludeFormEl.querySelector("input");
            if( input && document.activeElement === input ) {
                e.preventDefault();
                setIncludeFormVisible(false);
            }
        }
    });

    document.addEventListener("click", function(e) {
        if( footerEl.classList.contains("showingForm") && !e.target.closest(".footer") && !e.target.closest(".split") ) {
            setIncludeFormVisible(false);
            e.preventDefault();
        }
    });
});

function setMainInkFilename(name) {
    var fnEl = fileNavWrapperEl.querySelector(".nav-group.main-ink .nav-group-item .filename");
    if (fnEl) fnEl.textContent = name;
}

function setKnots(mainInk){
    mainInk.symbols.parse();
    var ranges = mainInk.symbols.rangeIndex;

    knotStichNavWrapperEl.innerHTML = "";

    if (ranges.length == 0) {
        var contentLoc = i18n._('Content');
        var descriptionLoc = i18n._('Knots, stitches and functions are indexed here');

        knotStichNavWrapperEl.innerHTML = `
            <nav class="nav-group"><h5 class="nav-group-title">${contentLoc}</h5></nav>
            <nav class="nav-group"><span class="nav-group-item nav-tooltip">${descriptionLoc}</span></nav>
        `;
        return;
    }
    
    var externalsList = getExternals(mainInk);
    
    var contentNav = document.createElement("nav");
    contentNav.className = "nav-group";
    contentNav.innerHTML = `<h5 class="nav-group-title">Content</h5>`;

    var functionsNav = document.createElement("nav");
    functionsNav.className = "nav-group";
    functionsNav.innerHTML = `<h5 class="nav-group-title">Functions</h5>`;

    var externalsNav = document.createElement("nav");
    externalsNav.className = "nav-group";
    externalsNav.innerHTML = `<h5 class="nav-group-title">Externals</h5>`;

    var foundContent = false; 
    var foundFunctions = false;

    //For every knots
    ranges.forEach(range => {
        var symbol = range.symbol;
        var extraClass = "knot";
        if (symbol.isfunc) foundFunctions = true; else foundContent = true;
        var icon = symbol.isfunc ? "ink-icon icon-function-scaled" : "ink-icon icon-knot-scaled";
        var items = `<span class="nav-group-item ${extraClass}" row="${symbol.row}">
            <span class="icon ${icon}"></span>
            <span class="filename">${symbol.name}</span>
        </span>`;
        //If the knot has any symbols inside of it.
        if (symbol.innerSymbols){
            //For every stitch inside the knot
            Object.keys(symbol.innerSymbols).forEach((innerSymbolName) => {
                var innerSymbol = symbol.innerSymbols[innerSymbolName];
                if (innerSymbol.flowType.name == "Stitch"){
                    var extraClass = "stitch";
                    items += 
                    `<span class="nav-group-item ${extraClass}" row="${innerSymbol.row}">
                    <span class="icon ink-icon icon-stitch-scaled"></span>
                            <span class="filename">${innerSymbol.name}</span>
                        </span>`;
                }
            });
        }

        var groupNav = document.createElement("nav");
        groupNav.className = "nav-group";
        groupNav.innerHTML = items;

        if (symbol.isfunc) {
            if (externalsList.has(symbol.name)) 
                externalsNav.appendChild(groupNav);
            else
                functionsNav.appendChild(groupNav);
        }
        else 
            contentNav.appendChild(groupNav);
    });

    if (foundContent)
        knotStichNavWrapperEl.appendChild(contentNav);
    if (foundFunctions)
        knotStichNavWrapperEl.appendChild(functionsNav);
    if (externalsList.size > 0) 
        knotStichNavWrapperEl.appendChild(externalsNav);
}

function updateCurrentKnot(mainInk, cursorPos){
    var symbols = mainInk.symbols.flowAtPos(cursorPos);
    if (!symbols) return;

    let currentKnotEl = null;
    if ("Knot" in symbols){
        currentKnotEl = knotStichNavWrapperEl.querySelector(`[row="${symbols["Knot"].row}"]`);
        if (currentKnotEl && symbols["Knot"].isfunc){
            currentKnotEl.classList.add("function");
        }
    }

    let currentStitchEl = null;
    if ("Stitch" in symbols){
        currentStitchEl = knotStichNavWrapperEl.querySelector(`[row="${symbols["Stitch"].row}"]`);
    }

    if ((currentKnotEl && currentKnotEl.classList.contains("active")) && (currentStitchEl && currentStitchEl.classList.contains("active")))
        return;

    knotStichNavWrapperEl.querySelectorAll(".nav-group-item.active").forEach(item => item.classList.remove("active"));
    if (currentKnotEl){
        currentKnotEl.classList.add("active");
        if (typeof currentKnotEl.scrollIntoViewIfNeeded === "function") {
            currentKnotEl.scrollIntoViewIfNeeded();
        }
    }
    if (currentStitchEl){
        currentStitchEl.classList.add("active");
        if (typeof currentStitchEl.scrollIntoViewIfNeeded === "function") {
            currentStitchEl.scrollIntoViewIfNeeded();
        }
    }
}

function setFiles(mainInk, allFiles) {
    var unusedFiles = _.filter(allFiles, f => f.isSpare);
    var normalIncludes = _.filter(allFiles, f => !f.isSpare && f != mainInk);
    var groupedIncludes = _.groupBy(normalIncludes, f => { 
        var dirName = path.dirname(f.relativePath());
        if( dirName == "." )
            dirName = "";
        return dirName;
    });

    var groupsArray = _.map(groupedIncludes, (group, name) => { return {name: name, files: group}; });
    groupsArray.sort((a,b) => a.name.localeCompare(b.name));

    if( unusedFiles.length > 0 )
        groupsArray.push({
            name: i18n._("Unused files"),
            files: unusedFiles
        });

    fileNavWrapperEl.innerHTML = "";
    
    var extraClass = "";
    if( mainInk.hasUnsavedChanges ) extraClass = "unsaved";
    if( mainInk.isLoading ) extraClass += " loading";

    var mainEl = document.createElement("nav");
    mainEl.className = "nav-group main-ink";
    mainEl.innerHTML = `
        <h5 class="nav-group-title">Main ink file</h5>
        <a class="nav-group-item ${extraClass}" data-file-id="${mainInk.id}">
            <span class="icon icon-book"></span>
            <span class="filename">${mainInk.filename()}</span>
        </a>
    `;
    fileNavWrapperEl.appendChild(mainEl);
    
    groupsArray.forEach(group => {
        var items = "";

        group.files.forEach((file) => {
            var name = file.isSpare ? file.relativePath() : file.filename();
            
            var extraClass = "";
            if( file.hasUnsavedChanges ) extraClass = "unsaved";
            if( file.isLoading ) extraClass += " loading";
            
            items = items + `<span class="nav-group-item ${extraClass}" data-file-id="${file.id}">
            <span class="icon icon-doc-text"></span>
            <span class="filename">${name}</span>
            </span>`;
        });

        var groupClass = "";
        if( group.files === unusedFiles )
            groupClass = "unused";

        var groupEl = document.createElement("nav");
        groupEl.className = `nav-group ${groupClass}`;
        groupEl.innerHTML = `<h5 class="nav-group-title">${group.name}</h5> ${items}`;
        fileNavWrapperEl.appendChild(groupEl);
    });
}

function highlightNavGroupItem(navGroupItem) {
    fileNavWrapperEl.querySelectorAll(".nav-group-item").forEach(item => {
        if (item !== navGroupItem) {
            item.classList.remove("active");
        }
    });
    navGroupItem.classList.add("active");
}

function highlightRelativePath(relativePath) {
    var dirName = path.dirname(relativePath);
    if( dirName == "." )
        dirName = "";

    var filename = path.basename(relativePath);

    var groups = Array.from(fileNavWrapperEl.querySelectorAll(".nav-group"));
    var groupEl = groups.find(el => {
        var title = el.querySelector(".nav-group-title");
        return title && title.textContent === dirName;
    });
    if( dirName == "" && !groupEl ) {
        groupEl = fileNavWrapperEl.querySelector(".nav-group.main-ink");
    }

    if (groupEl) {
        var fileEl = Array.from(groupEl.querySelectorAll(".nav-group-item .filename")).find(el => el.textContent === filename);
        if (fileEl) {
            var navGroupItem = fileEl.closest(".nav-group-item");
            highlightNavGroupItem(navGroupItem);
        }
    }
}

function hideSidebar() {
    if( !visible )
        return;
    
    animateSidebar(0);
    visible = false;
}

function showSidebar(columns) {
    if (!columns) columns = 1;    
    if( ! visible )
    {
        hasBeenShown = true;

        // hidden class only exists in initial state
        sidebarEl.classList.remove("hidden");
        sidebarSplitEl.classList.remove("hidden");

        sidebarEl.style.display = "block";
        sidebarSplitEl.style.display = "block";
    }
    animateSidebar(columns);
    visible = true;
}

function animateSidebar(columns) {
    
    sidebarEl.style.transition = `width ${slideAnimDuration}ms ease-in-out`;
    twoPaneEl.style.transition = `left ${slideAnimDuration}ms ease-in-out`;
    sidebarSplitEl.style.transition = `left ${slideAnimDuration}ms ease-in-out`;

    sidebarEl.style.width = ((columns * sidebarWidth) - 1) + "px";
    twoPaneEl.style.left = (columns * sidebarWidth) + "px";
    sidebarSplitEl.style.left = (columns * sidebarWidth) + "px";

    setTimeout(() => {
        if (columns == 0) {
            sidebarEl.style.display = "none";
        }
    }, slideAnimDuration);

    if (columns > 0) {
        var navElements = document.querySelectorAll(".nav-wrapper");
        var widthStepPercent = (100 / columns);

        let widthCss = "calc("+widthStepPercent+"% - 1px)"; // leave space for border
        footerEl.style.width = widthCss;
        navElements.forEach(el => el.style.width = widthCss);

        var leftPosPercent = 0;
        navElements.forEach(el => {
            if (!el.classList.contains("hidden")) {
                el.style.transition = `left ${slideAnimDuration}ms ease-in-out`;
                el.style.left = leftPosPercent + "%";
                leftPosPercent += widthStepPercent;
            }
        });
    }
}

function setIncludeFormVisible(visible) {
    var inputBox = newIncludeFormEl.querySelector("input[type='text']");
    if( visible ) {
        inputBox.value = "";
        inputBox.classList.remove("error");
        footerEl.classList.add("showingForm");
        inputBox.focus();
    } else {
        inputBox.blur();
        inputBox.classList.remove("error");
        footerEl.classList.remove("showingForm");
    }
}

function toggle(id, buttonId){

    var button = document.querySelector("#toolbar " + buttonId);
    var thisPanel = document.querySelector(id);

    var columns = 2 - document.querySelectorAll(".nav-wrapper.hidden").length;
    if (columns > 0 && sidebarSplitEl) {
        sidebarWidth = sidebarSplitEl.offsetLeft / columns; 
    }

    if (thisPanel.classList.contains("hidden")) {
        columns++;
        thisPanel.classList.remove("hidden");
        if (thisPanel.classList.contains("hasFooter")) 
            footerEl.classList.remove("hidden");
        if (button) button.classList.add("selected");
    } else {
        columns--;
        thisPanel.classList.add("hidden");
        if (thisPanel.classList.contains("hasFooter")) 
            footerEl.classList.add("hidden"); 
        if (button) button.classList.remove("selected");     
    }

    if (columns == 0) {
        hideSidebar();
    } else { 
        showSidebar(columns);
    }
}

// Helper function that gets all the external function names from a list of InkFiles
function getExternals(file) {
    return file.symbols.getCachedExternals();
}

exports.NavView = {
    setMainInkFilename: setMainInkFilename,
    setFiles: setFiles,
    setKnots: setKnots,
    updateCurrentKnot: updateCurrentKnot,
    highlightRelativePath: highlightRelativePath,
    setEvents: e => events = e,
    hide: hideSidebar,
    show: showSidebar,
    initialShow: () => { if( !hasBeenShown ) 
        toggle("#file-nav-wrapper");
    },
    toggle: toggle,
    showAddIncludeForm: () => setIncludeFormVisible(true)
}

