import { syntaxTree } from "@codemirror/language";
import { useProjectStore } from '../stores/projectStore';

function union(sets) {
    const u = new Set();
    for (const set of sets) {
        if (set) {
            for (const elem of set) {
                u.add(elem);
            }
        }
    }
    return u;
}

// Helper function that gets all the divert targets from a list of InkFiles
function getAllDivertTargets(files) {
    return union(files.map((file) => file._symbolsObj ? file._symbolsObj.getCachedDivertTargets() : []));
}

// Helper function that gets all the variable names from a list of InkFiles
function getAllVariables(files) {
    return union(files.map((file) => file._symbolsObj ? file._symbolsObj.getCachedVariables() : []));
}

// Helper function that gets all the vocabulary words from a list of InkFiles
function getAllVocabWords(files) {
    return union(files.map((file) => file._symbolsObj ? file._symbolsObj.getCachedVocabWords() : []));
}

function getAllDivertTargetCompletions(files) {
    const targets = getAllDivertTargets(files);
    return Array.from(targets).map(target => ({
        label: target,
        type: "class",
        detail: "Divert Target"
    }));
}

function getAllVariableCompletions(files) {
    const variables = getAllVariables(files);
    return Array.from(variables).map(variable => ({
        label: variable,
        type: "variable",
        detail: "Variable"
    }));
}

function getAllVocabCompletions(files) {
    const vocabWords = getAllVocabWords(files);
    return Array.from(vocabWords).map(vocabWord => ({
        label: vocabWord,
        type: "text",
        detail: "Vocabulary"
    }));
}

export function inkCompletionSource(context) {
    const word = context.matchBefore(/[\w]*/);
    if (!word) return null;
    if (word.from === word.to && !context.explicit) return null;

    const { state, pos } = context;
    const node = syntaxTree(state).resolveInner(pos, -1);
    
    let isDivert = false;
    let isLogic = false;
    let curr = node;
    while (curr) {
        const name = curr.name;
        if (name === "Divert" || name === "DivertTarget" || name === "DivertArrow" || name === "Path") {
            isDivert = true;
        }
        if (name === "Conditional" || name === "BlockConditional" || name === "InlineSequence" || name === "InlineDisplayVariable" || name === "VariableAssignment" || name === "ConstDeclaration" || name === "VariableDeclaration") {
            isLogic = true;
        }
        curr = curr.parent;
    }

    const projectStore = useProjectStore();
    const files = projectStore.files || [];

    let options = [];
    if (isDivert) {
        options = getAllDivertTargetCompletions(files);
    } else if (isLogic) {
        options = getAllDivertTargetCompletions(files)
            .concat(getAllVariableCompletions(files))
            .concat(getAllVocabCompletions(files));
    } else {
        options = getAllVocabCompletions(files);
    }

    return {
        from: word.from,
        options: options
    };
}
