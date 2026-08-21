import { InkLanguage } from "@mavnn/codemirror-lang-ink";

export function InkFileSymbols(inkFile, events) {
    this.inkFile = inkFile;
    this.events = events;

    this.dirty = true;
    this.parseTimeout = null;

    this.divertTargets = new Set();
    this.variables = new Set();
    this.externals = new Set();
    this.vocabWords = new Set();
}

InkFileSymbols.prototype.scheduleParse = function() {
    if( this.parseTimeout ) 
        clearTimeout(this.parseTimeout);

    this.parseTimeout = setTimeout(() => {
        this.parseTimeout = null;
        this.parse();
    }, 200);
}

InkFileSymbols.prototype.parse = function() {
    var includes = [];
    var lastIncludeRow = -1;

    var symbolStack = [{
        flowType: { level: 0 },
        innerSymbols: {},
        rangeIndex: []
    }];
    symbolStack.currentElement = function() {
        return this[this.length-1];
    }

    var globalTags = [];
    var globalDictionaryStyleTags = {};

    var divertTargets = new Set();
    var variables = new Set();
    var externals = new Set();
    var vocabWords = new Set();

    const textContent = this.inkFile.getValue() || "";
    
    const tree = InkLanguage.parser.parse(textContent);

    let isfunc = false;

    // Helper to get row and column
    const lineOffsets = [];
    for (let i = 0; i < textContent.length; i++) {
        if (i === 0 || textContent[i - 1] === '\n') {
            lineOffsets.push(i);
        }
    }
    function getLineCol(pos) {
        let line = 0;
        while (line < lineOffsets.length && lineOffsets[line] <= pos) {
            line++;
        }
        line = Math.max(0, line - 1);
        return {
            row: line,
            column: pos - lineOffsets[line]
        };
    }

    const lines = textContent.split('\n');
    const handledFlowLines = new Set();

    const processFlowSymbol = (symbolName, isKnot, isFuncOnLine, row, col) => {
        const level = isKnot ? 1 : 2;
        const flowType = {
            name: isKnot ? "Knot" : "Stitch",
            code: isKnot ? "Knot" : "Stitch",
            level: level
        };

        while (level <= symbolStack.currentElement().flowType.level) {
            symbolStack.pop();
        }

        var symbol = {
            name: symbolName,
            isfunc: isFuncOnLine,
            flowType: flowType,
            row: row,
            column: col,
            inkFile: this.inkFile
        };

        var parent = symbolStack.currentElement();
        if (parent !== symbolStack[0]) {
            symbol.parent = parent;
        }

        if (!parent.innerSymbols) {
            parent.innerSymbols = {};
            parent.rangeIndex = [];
        }
        parent.innerSymbols[symbolName] = symbol;
        parent.rangeIndex.push({
            rowStart: symbol.row,
            symbol: symbol
        });
        symbolStack.push(symbol);
        divertTargets.add(symbolName);
    };

    tree.iterate({
        enter: (node) => {
            const name = node.name;
            const from = node.from;
            const to = node.to;
            const value = textContent.slice(from, to);

            if (name === "function") {
                isfunc = true;
            }

            const pos = getLineCol(from);
            const row = pos.row;

            if (name === "Knot" || name === "KnotName" || name === "Stitch" || name === "StitchName") {
                if (!handledFlowLines.has(row)) {
                    const lineText = lines[row] || "";
                    const knotMatch = lineText.match(/^\s*==+\s*(?:function\s+)?(\w+)/);
                    const stitchMatch = lineText.match(/^\s*=\s*(\w+)/);

                    if (knotMatch) {
                        const symName = knotMatch[1];
                        const isKnotFunc = /^\s*==+\s*function\b/.test(lineText) || isfunc;
                        const col = lineText.indexOf(symName);
                        processFlowSymbol(symName, true, isKnotFunc, row, col);
                        handledFlowLines.add(row);
                        isfunc = false;
                    } else if (stitchMatch) {
                        const symName = stitchMatch[1];
                        const col = lineText.indexOf(symName);
                        processFlowSymbol(symName, false, false, row, col);
                        handledFlowLines.add(row);
                        isfunc = false;
                    }
                }
            }
            else if (name === "VariableDeclaration" || name === "ConstDeclaration") {
                const match = value.match(/(?:VAR|CONST)\s+(\w+)/i);
                if (match) {
                    variables.add(match[1]);
                }
            }
            else if (name === "Temp") {
                const match = value.match(/temp\s+(\w+)/i);
                if (match) {
                    variables.add(match[1]);
                }
            }
            else if (name === "DivertTarget") {
                if (value.trim().length > 0) {
                    divertTargets.add(value.trim());
                }
            }
            else if (name === "Include") {
                const pathMatch = value.match(/INCLUDE\s+(.+)/i);
                if (pathMatch) {
                    let filePath = pathMatch[1].trim();
                    filePath = filePath.replace(/\/\/.*$/, '').trim();
                    filePath = filePath.replace(/^["']|["']$/g, '').trim();
                    if (filePath && !includes.includes(filePath)) {
                        includes.push(filePath);
                        lastIncludeRow = getLineCol(from).row;
                    }
                }
            }
            else if (name === "Tag") {
                const tagContent = value.substring(1).trim();
                if (symbolStack.currentElement().flowType.level === 0) {
                    globalTags.push(tagContent);
                    var dictStyleMatches = tagContent.match(/\s*(\w+)\s*:\s*(.+)/);
                    if (dictStyleMatches) {
                        var dictKey = dictStyleMatches[1];
                        var dictContent = dictStyleMatches[2];
                        globalDictionaryStyleTags[dictKey] = dictContent;
                    }
                }
            }
            else if (name === "ContentLine" || name === "SequenceContent" || name === "PreweaveChoiceContent" || name === "PostweaveChoiceContent") {
                var words = value.split(/\W+/);
                words.forEach(word => {
                    if (word.length >= 3) {
                        vocabWords.add(word);
                    }
                });
            }
        }
    });

    // Fallback: capture any INCLUDE declarations or purely numeric knot/stitch declarations
    const includeRegex = /^\s*INCLUDE\s+([^\r\n]+)/gim;
    let incMatch;
    while ((incMatch = includeRegex.exec(textContent)) !== null) {
        let filePath = incMatch[1].trim();
        filePath = filePath.replace(/\/\/.*$/, '').trim();
        filePath = filePath.replace(/^["']|["']$/g, '').trim();
        if (filePath && !includes.includes(filePath)) {
            includes.push(filePath);
            const pos = getLineCol(incMatch.index);
            lastIncludeRow = Math.max(lastIncludeRow, pos.row);
        }
    }

    for (let r = 0; r < lines.length; r++) {
        if (!handledFlowLines.has(r)) {
            const lineText = lines[r] || "";
            const knotMatch = lineText.match(/^\s*==+\s*(?:function\s+)?(\w+)/);
            const stitchMatch = lineText.match(/^\s*=\s*(\w+)/);
            if (knotMatch) {
                const symName = knotMatch[1];
                const isKnotFunc = /^\s*==+\s*function\b/.test(lineText);
                const col = lineText.indexOf(symName);
                processFlowSymbol(symName, true, isKnotFunc, r, col);
                handledFlowLines.add(r);
            } else if (stitchMatch) {
                const symName = stitchMatch[1];
                const col = lineText.indexOf(symName);
                processFlowSymbol(symName, false, false, r, col);
                handledFlowLines.add(r);
            }
        }
    }

    this.symbols = symbolStack[0].innerSymbols;
    this.rangeIndex = symbolStack[0].rangeIndex;

    this.globalTags = globalTags;
    this.globalDictionaryStyleTags = globalDictionaryStyleTags;

    this.divertTargets = divertTargets;
    this.variables = variables;
    this.externals = externals;
    this.vocabWords = vocabWords;

    // Detect whether the includes actually changed at all
    var oldIncludes = this.includes || [];
    this.includes = includes;
    this.lastIncludeRow = lastIncludeRow;

    var includesChanged = false;
    if (includes.length != oldIncludes.length) {
        includesChanged = true;
    } else {
        var beforeAndAfter = [...new Set([...includes, ...oldIncludes])];
        includesChanged = beforeAndAfter.length != includes.length;
    }

    if (includesChanged)
        this.events.includesChanged(this.includes);

    this.dirty = false;
}

InkFileSymbols.prototype.flowAtPos = function(pos){
    if (this.dirty) this.parse();
    return symbolsWithinIndex(this.rangeIndex, pos);
}
 
InkFileSymbols.prototype.symbolAtPos = function(pos) {
    if( this.dirty ) this.parse();
    return symbolWithinIndex(this.rangeIndex, pos);
}

// Range index is an index of all the symbols by row number,
// nested into a hierarchy. 
function symbolWithinIndex(rangeIndex, pos, includeFlows=true, includeVars=true) {
    if( !rangeIndex )
        return null;

    for(var i=0; i<rangeIndex.length; i++) {
        var nextRangeElement = null;
        var isValidSymbol = false;
        if( i < rangeIndex.length-1 ) {
            nextRangeElement = rangeIndex[i+1];
            isValidSymbol = ((nextRangeElement.symbol.flowType && includeFlows) || (nextRangeElement.symbol.varType && includeVars))
        }
        if( (!nextRangeElement || pos.row < nextRangeElement.rowStart )) {
            var symbol = rangeIndex[i].symbol;
            isValidSymbol = ((symbol.flowType && includeFlows) || (symbol.varType && includeVars))
            if (isValidSymbol){
                return symbolWithinIndex(symbol.rangeIndex, pos) || symbol;
            }
        }
    }

    return null;
}

function symbolsWithinIndex(rangeIndex, pos) {
    if( !rangeIndex )
        return null;
    var symbols = {};
    var start = 0;
    var end = rangeIndex.length-1;
    while (rangeIndex && start <= end) {
        var nextRangeElement = null;
        if( start < end ) {
            nextRangeElement = rangeIndex[start+1];
        }
        if( (!nextRangeElement || pos.row < nextRangeElement.rowStart )) {
            var symbol = rangeIndex[start].symbol;
            if (pos.row >= symbol.row){
                symbols[symbol.flowType.name] = symbol;
            }
            rangeIndex = symbol.rangeIndex;
            start = 0;
            end = (rangeIndex)? rangeIndex.length - 1 : 0; 
        }
        else{
            start += 1;
        }
    }
    return symbols;
}

InkFileSymbols.prototype.getSymbols = function() {
    if( this.dirty ) this.parse();
    return this.symbols;
}

InkFileSymbols.prototype.getIncludes = function() {
    if( this.dirty ) this.parse();
    return this.includes;
}

InkFileSymbols.prototype.getLastIncludeRow = function() {
    if( this.dirty ) this.parse();
    return this.lastIncludeRow;
}

InkFileSymbols.prototype.getCachedDivertTargets = function() {
    return this.divertTargets;
}

InkFileSymbols.prototype.getCachedVariables = function() {
    return this.variables;
}

InkFileSymbols.prototype.getCachedExternals = function() {
    return this.externals;
}

InkFileSymbols.prototype.getCachedVocabWords = function() {
    return this.vocabWords;
}

