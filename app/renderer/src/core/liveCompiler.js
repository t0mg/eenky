import i18n from './i18n.js';
import { AutoPlayer } from './autoPlayer.js';

const ipc = window.api.liveCompiler;

let namespace = null;
let sessionIdx = 0;

let currentPlaySessionId = null;
let currentExportSessionId = null;
let currentStatsSessionId = null;
const exportCallbacks = new Map();
let exportCompleteCallback = null;
let statsCompleteCallback = null;

let lastEditorChange = null;
let reloadPending = false;

let choiceSequence = [];
let currentTurnIdx = -1;
let replaying = false;

let issues = [];
let selectedIssueIdx = -1;

let locationInSourceCallbackObj = null;
let expressionEvaluationObj = null;

let project = null;
let events = {};

let compilerBusy = false;
let currentRngSeed = null;

function setRngSeed(seed) {
    currentRngSeed = seed;
}

function getRngSeed() {
    return currentRngSeed;
}

function setProject(p) {
    project = p;
    if (!project || !project.mainInkFile) return;
    var namespaceCode = Math.random().toString(36).substring(7);
    var filename = project.mainInkFile.relPath ? project.mainInkFile.relPath.split(/[\\/]/).pop() : "Untitled";
    namespace = filename.replace(/\./g, "_") + "_" + namespaceCode;
    reloadPending = true;
}

function resetErrors() {
    issues = [];
    selectedIssueIdx = -1;
}

function buildCompileInstruction() {
    sessionIdx += 1;
    var filename = project.mainInkFile.relPath ? project.mainInkFile.relPath.split(/[\\/]/).pop() : "Untitled";
    var compileInstruction = {
        mainName: filename,
        updatedFiles: {},
        sessionId: `${namespace}_${sessionIdx}`,
        namespace: namespace
    };

    project.files.forEach((inkFile) => {
        // Force evaluation of proxies to primitive strings
        const relPathStr = String(inkFile.relPath || "");
        const contentStr = String(inkFile.content || "");
        compileInstruction.updatedFiles[relPathStr] = contentStr;
        inkFile.compilerVersionDirty = false;
    });

    return JSON.parse(JSON.stringify(compileInstruction));
}

function sessionIsCurrent(id) {
    return id == currentPlaySessionId || id == currentExportSessionId;
}

function updateCompilerIsBusy(isBusy) {
    if( isBusy != compilerBusy ) {
        compilerBusy = isBusy;
        if (events.compilerBusyChanged) {
            events.compilerBusyChanged(compilerBusy);
        }
    }
}

function stopInklecateSession(idToStop) {
    ipc.send("play-stop-ink", idToStop);
    updateCompilerIsBusy(false);
}

function stop() {
    if (currentPlaySessionId) {
        stopInklecateSession(currentPlaySessionId);
        currentPlaySessionId = null;
    }
}

function reloadInklecateSession() {
    if( project == null || !project.mainInkFile || project.mainInkFile.isLoading ) {
        reloadPending = true;
        updateCompilerIsBusy(true);
        return;
    }

    if (project.files && project.files.some(f => f.isLoading)) {
        reloadPending = true;
        updateCompilerIsBusy(true);
        return;
    }

    lastEditorChange = null;
    reloadPending = false;

    if( currentPlaySessionId  )
        stopInklecateSession(currentPlaySessionId);

    replaying = true;
    currentTurnIdx = 0;

    var instr = buildCompileInstruction();
    instr.play = true;

    // Apply locked RNG seed if playing and not locked in script
    const isScriptLocked = project && project.isScriptRngSeedLocked;
    if (!isScriptLocked) {
        if (currentRngSeed === null) {
            if (project && project.rollNewRngSeed) {
                currentRngSeed = project.rollNewRngSeed();
            } else {
                currentRngSeed = Math.floor(Math.random() * 1000000) + 1;
            }
        } else if (project && project.setCurrentRngSeed && project.currentRngSeed !== currentRngSeed) {
            project.setCurrentRngSeed(currentRngSeed);
        }
        instr.seed = currentRngSeed;
    }

    if (events.resetting) events.resetting(instr.sessionId);
    resetErrors();

    currentPlaySessionId = instr.sessionId;
    ipc.send("compile", instr);
    updateCompilerIsBusy(true);
}

function exportJson(inkJsCompatible, callback) {
    var instr = buildCompileInstruction();
    instr.export = true;
    instr.inkJsCompatible = inkJsCompatible;
    currentExportSessionId = instr.sessionId;
    if (callback) {
        exportCallbacks.set(instr.sessionId, callback);
    }
    ipc.send("compile", instr);
    updateCompilerIsBusy(true);
}

function getStats(callback) {
    statsCompleteCallback = callback;
    var instr = buildCompileInstruction();
    instr.stats = true;
    instr.inkJsCompatible = false;
    currentStatsSessionId = instr.sessionId;
    ipc.send("compile", instr);
    updateCompilerIsBusy(true);
}

function completeExport(error, path, sessionId) {
    if (sessionId && exportCallbacks.has(sessionId)) {
        const callback = exportCallbacks.get(sessionId);
        exportCallbacks.delete(sessionId);
        if (callback) {
            if (error) callback(error.message || error);
            else callback(null, path);
        }
    } else if (exportCompleteCallback) {
        var callback = exportCompleteCallback;
        exportCompleteCallback = null;
        if (callback) {
            if( error ) callback(error.message || error);
            else callback(null, path);
        }
    }
    updateCompilerIsBusy(false);
}

function choose(choice) {
    ipc.send("play-continue-with-choice-number", choice.number, choice.sourceSessionId);
    choiceSequence.push(choice.number);
    currentTurnIdx++;
}

function rewind() {
    choiceSequence = [];
    currentTurnIdx = -1;
    const isScriptLocked = project && project.isScriptRngSeedLocked;
    if (!isScriptLocked) {
        if (project && project.rollNewRngSeed) {
            currentRngSeed = project.rollNewRngSeed();
        } else {
            currentRngSeed = Math.floor(Math.random() * 1000000) + 1;
        }
    }
    reloadInklecateSession();
}

function stepBack() {
    if( choiceSequence.length > 0 )
        choiceSequence.splice(-1, 1);
    reloadInklecateSession();
}

function setChoiceSequence(seq) {
    choiceSequence = Array.isArray(seq) ? seq.slice() : [];
    currentTurnIdx = 0;
}

function getChoiceSequence() {
    return choiceSequence.slice();
}

function getLocationInSource(offset, callback) {
    ipc.send("get-location-in-source", offset, currentPlaySessionId);
    locationInSourceCallbackObj = { callback: callback, sessionId: currentPlaySessionId };
}

function getRuntimePathInSource(runtimePath, callback) {
    ipc.send("get-runtime-path-in-source", runtimePath, currentPlaySessionId);
    locationInSourceCallbackObj = { callback: callback, sessionId: currentPlaySessionId };
}

function evaluateExpression(expressionText, callback) {
    ipc.send("evaluate-expression", expressionText, currentPlaySessionId);
    expressionEvaluationObj = { callback: callback,  sessionId: currentPlaySessionId };
}

setInterval(() => {
    if( lastEditorChange !== null && Date.now() - lastEditorChange > 500 || reloadPending ) {
        reloadInklecateSession();
    }
}, 250);

ipc.on("next-issue", () => {
    if( issues.length > 0 ) {
        selectedIssueIdx++;
        if( selectedIssueIdx >= issues.length )
            selectedIssueIdx = 0;

        if (events.selectIssue) events.selectIssue(issues[selectedIssueIdx]);
    }
});

ipc.on("compile-complete", (fromSessionId) => {
    if( fromSessionId != currentPlaySessionId ) return;
    updateCompilerIsBusy(false);
    if (events.compileComplete) events.compileComplete(fromSessionId);

    const hasErrors = issues.some(i => i.type === 'ERROR' || i.type === 'error');
    if (!hasErrors) {
        exportJson(true, async (err, jsonPath) => {
            if (!err && jsonPath && window.api && window.api.fs) {
                try {
                    const jsonText = await window.api.fs.readFile(jsonPath, 'utf8');
                    const parsed = JSON.parse(jsonText);
                    AutoPlayer.onStoryCompiled(parsed);
                } catch (e) {
                    console.warn('AutoPlayer failed to load compiled JSON:', e);
                }
            }
        });
    }
});

ipc.on("play-generated-text", (result, fromSessionId) => {
    if( fromSessionId != currentPlaySessionId ) return;
    updateCompilerIsBusy(false);
    if (events.textAdded) events.textAdded(result);
});

ipc.on("play-generated-errors", (errors, fromSessionId) => {
    if( !sessionIsCurrent(fromSessionId) ) return;
    updateCompilerIsBusy(false);
    issues = errors;
    if (events.errorsAdded) events.errorsAdded(errors);
});

ipc.on("play-generated-tags", (tags, fromSessionId) => {
    if( fromSessionId != currentPlaySessionId ) return;
    updateCompilerIsBusy(false);
    if (events.tagsAdded) events.tagsAdded(tags);
});

ipc.on("play-generated-choice", (choice, fromSessionId) => {
    if( fromSessionId != currentPlaySessionId ) return;
    choice.sourceSessionId = fromSessionId;
    updateCompilerIsBusy(false);
    var turnCount = choiceSequence.length+1;
    var isLatestTurn = currentTurnIdx >= turnCount-1;
    if (events.choiceAdded) events.choiceAdded(choice, isLatestTurn);
});

ipc.on("play-requires-input", (fromSessionId) => {
    if( fromSessionId != currentPlaySessionId ) return;
    updateCompilerIsBusy(false);

    var justCompletedReplay = false;
    if( replaying && currentTurnIdx >= choiceSequence.length ) {
        replaying = false;
        justCompletedReplay = true;
    }

    if (events.playerPrompt) {
        events.playerPrompt(replaying, () => {
            if( replaying ) {
                var replayChoiceNumber = choiceSequence[currentTurnIdx];
                currentTurnIdx++;
                ipc.send("play-continue-with-choice-number", replayChoiceNumber, fromSessionId);
            } 
            if( justCompletedReplay && events.replayComplete ) 
                events.replayComplete(currentPlaySessionId);
        });
    }
});

ipc.on("inklecate-complete", (fromSessionId, exportJsonPath) => {
    if( fromSessionId == currentPlaySessionId ) {
        if (events.storyCompleted) events.storyCompleted();
        updateCompilerIsBusy(false);
        if( replaying ) {
            replaying = false;
            if (events.replayComplete) events.replayComplete(currentPlaySessionId);
        }
    }
    else {
        completeExport(null, exportJsonPath, fromSessionId);
    }
});

ipc.on("play-exit-due-to-error", (exitCode, fromSessionId) => {
    if( !sessionIsCurrent(fromSessionId) && !exportCallbacks.has(fromSessionId) ) return;

    if( fromSessionId == currentExportSessionId || exportCallbacks.has(fromSessionId) ) {
        completeExport({message: i18n._("Ink has errors - please fix them before exporting.")}, null, fromSessionId);
    } else {
        if( replaying ) {
            replaying = false;
            if (events.replayComplete) events.replayComplete();
        }
        if (events.exitDueToError) events.exitDueToError();
        updateCompilerIsBusy(false);
    }
});

ipc.on("play-story-unexpected-error", (error, fromSessionId) => {
    if( !sessionIsCurrent(fromSessionId) && !exportCallbacks.has(fromSessionId) ) return;

    if( fromSessionId == currentExportSessionId || exportCallbacks.has(fromSessionId) ) {
        completeExport({message: i18n._("Unexpected error")}, null, fromSessionId);
    } else {
        if( replaying ) {
            replaying = false;
            if (events.replayComplete) events.replayComplete(fromSessionId);
        }
        if (events.unexpectedError) events.unexpectedError(error);
        updateCompilerIsBusy(false);
    }
});

ipc.on("play-story-stopped", (fromSessionId) => {
    //
});

ipc.on("return-location-from-source", (fromSessionId, locationInfo) => {
    if( locationInSourceCallbackObj && fromSessionId == locationInSourceCallbackObj.sessionId ) {
        var callback = locationInSourceCallbackObj.callback;
        locationInSourceCallbackObj = null;
        if (callback) callback(locationInfo);
    }
});

ipc.on("play-evaluated-expression", (textResult, fromSessionId) => {
    if( expressionEvaluationObj && fromSessionId == expressionEvaluationObj.sessionId ) {
        var callback = expressionEvaluationObj.callback;
        expressionEvaluationObj = null;
        if (callback) callback(textResult);
    }
});

ipc.on("play-evaluated-expression-error", (errorMessage, fromSessionId) => {
    if( expressionEvaluationObj && fromSessionId == expressionEvaluationObj.sessionId ) {
        var callback = expressionEvaluationObj.callback;
        expressionEvaluationObj = null;
        if (callback) callback(null, errorMessage);
    }
});

ipc.on("return-stats", (statsObj, fromSessionId) => {
    if( fromSessionId != currentStatsSessionId ) return;
    var callback = statsCompleteCallback;
    statsCompleteCallback = null;
    if (callback) callback(statsObj);
    updateCompilerIsBusy(false);
    currentStatsSessionId = null
});

export const LiveCompiler = {
    setProject: setProject,
    reload: reloadInklecateSession,
    stop: stop,
    exportJson: exportJson,
    setEdited: () => {
        lastEditorChange = Date.now();
        AutoPlayer.onStoryEdited();
    },
    setEvents: (e) => { Object.assign(events, e); },
    get events() { return events; },
    getIssues: () => { return issues; },
    getIssuesForFilename: (filename) => issues.filter(i => i.filename == filename),
    choose: choose,
    rewind: rewind,
    stepBack: stepBack,
    getLocationInSource: getLocationInSource,
    getRuntimePathInSource: getRuntimePathInSource,
    evaluateExpression: evaluateExpression,
    getStats: getStats,
    setChoiceSequence: setChoiceSequence,
    getChoiceSequence: getChoiceSequence,
    setRngSeed: setRngSeed,
    getRngSeed: getRngSeed
};
