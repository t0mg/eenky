<template>
  <div id="editor-container" ref="editorContainer" @contextmenu.prevent="showContextMenu"></div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import { useProjectStore } from '../stores/projectStore';
import { useUiStore } from '../stores/uiStore';
import { ProjectController } from '../core/projectController.js';

import { EditorView, drawSelection, dropCursor, highlightActiveLine, highlightActiveLineGutter, lineNumbers, keymap } from "@codemirror/view";
import { EditorState, Compartment } from "@codemirror/state";
import { defaultKeymap, indentWithTab, history, undo, redo, undoSelection, redoSelection } from "@codemirror/commands";
const customHistoryKeymap = [
  {key: "Mod-z", run: undo, preventDefault: true},
  {key: "Mod-Shift-z", run: redo, preventDefault: true},
  {key: "Mod-u", run: undoSelection, preventDefault: true},
  {key: "Alt-u", run: redoSelection, preventDefault: true}
];
import { syntaxHighlighting, HighlightStyle, indentService } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { autocompletion, acceptCompletion, completionKeymap } from "@codemirror/autocomplete";
import { linter, lintGutter, setDiagnostics } from "@codemirror/lint";
import { InkLanguageSupport } from "@mavnn/codemirror-lang-ink";
import { inkCompletionSource } from "../core/inkCompleter.js";
import { search, searchKeymap, openSearchPanel } from "@codemirror/search";
import { findSymbolDeclaration } from "../core/symbolLookup.js";

const projectStore = useProjectStore();
const uiStore = useUiStore();
const editorContainer = ref(null);
let view = null;

let isNavigatingBack = false;
let ignoreNextJump = false;
let lastRecordedFile = null;
let lastRecordedLine = null;

const showContextMenu = () => {
  if (window.api && window.api.send) {
    window.api.send('show-context-menu', { type: 'editor' });
  }
};

const themeCompartment = new Compartment();
const languageCompartment = new Compartment();
const autocompleteCompartment = new Compartment();
const lineWrapCompartment = new Compartment();

const inkHighlightStyle = HighlightStyle.define([
  { tag: tags.heading1, color: "var(--cm-knot-color)", fontWeight: "bold" },
  { tag: tags.heading2, color: "var(--cm-stitch-color)", fontWeight: "bold" },
  { tag: tags.keyword, color: "var(--cm-keyword-color)" },
  { tag: tags.operatorKeyword, color: "var(--cm-keyword-color)" },
  { tag: tags.controlOperator, color: "var(--cm-control-color)" },
  { tag: tags.operator, color: "var(--cm-operator-color)" },
  { tag: tags.comment, color: "var(--cm-comment-color)", fontStyle: "italic" },
  { tag: tags.labelName, color: "var(--cm-tag-color)", class: "cm-tag" },
  { tag: tags.brace, color: "var(--cm-brace-color)" },
  { tag: tags.squareBracket, color: "var(--cm-bracket-color)" },
  { tag: tags.string, color: "var(--cm-string-color)" },
  { tag: tags.number, color: "var(--cm-number-color)" },
  { tag: tags.bool, color: "var(--cm-bool-color)" }
]);

const inkEditorTheme = EditorView.theme({
  "&": {
    height: "100%",
    width: "100%",
    color: "var(--cm-text-color)",
    backgroundColor: "var(--cm-background-color)",
    fontSize: "var(--cm-font-size, 14px)",
    fontFamily: "monospace"
  },
  ".cm-content": {
    caretColor: "var(--cm-text-color)",
    fontFamily: "inherit"
  },
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "var(--cm-text-color)"
  },
  "&.cm-focused": {
    outline: "none"
  },
  ".cm-gutters": {
    backgroundColor: "var(--cm-gutter-background-color)",
    color: "var(--cm-gutter-text-color)",
    borderRight: "none"
  },
  ".cm-gutterElement": {
    paddingLeft: "8px",
    paddingRight: "8px"
  },
  ".cm-activeLine": {
    backgroundColor: "var(--cm-active-line-bg, rgba(0, 0, 0, 0.05))"
  },
  ".cm-activeLineGutter": {
    backgroundColor: "var(--cm-active-line-bg, rgba(0, 0, 0, 0.05))"
  },
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground": {
    backgroundColor: "var(--cm-selection-bg, rgba(0, 0, 0, 0.2))"
  },
  ".cm-selectionBackground": {
    backgroundColor: "var(--cm-selection-bg, rgba(0, 0, 0, 0.2))"
  },
  ".cm-selectionMatch": {
    backgroundColor: "var(--cm-selection-match-bg, rgba(0, 0, 0, 0.1))"
  },
  ".cm-matchingBracket, .cm-nonmatchingBracket": {
    backgroundColor: "var(--cm-matching-bracket-bg, rgba(0, 0, 0, 0.1))",
    color: "inherit"
  },
  ".cm-tooltip": {
    backgroundColor: "var(--bg-color)",
    border: "1px solid var(--border-color)",
    color: "var(--cm-text-color)"
  },
  ".cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected]": {
    backgroundColor: "var(--primary-color)",
    color: "#ffffff"
  },
  ".cm-panels": {
    backgroundColor: "var(--bg-color)",
    color: "var(--text-color)"
  },
  ".cm-panel.cm-search": {
    padding: "10px",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    flexWrap: "wrap",
    backgroundColor: "var(--bg-color)",
    color: "var(--text-color)",
    fontFamily: "var(--font-family, sans-serif)",
    fontSize: "var(--cm-font-size, 14px)"
  },
  ".cm-panel.cm-search [name=close]": {
    padding: "9px 3px",
  },
  ".cm-search input": {
    background: "var(--input-bg, transparent)",
    color: "var(--text-color)",
    border: "1px solid var(--border-color)",
    padding: "6px",
    borderRadius: "4px",
    fontSize: "inherit",
    fontFamily: "inherit"
  },
  ".cm-search button": {
    background: "var(--button-bg, transparent)",
    color: "var(--text-color)",
    border: "1px solid var(--border-color)",
    padding: "6px 12px",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "inherit",
    fontFamily: "inherit"
  },
  ".cm-search button:hover": {
    background: "var(--hover-bg, rgba(0,0,0,0.1))"
  },
  ".cm-search label": {
    display: "flex",
    alignItems: "center",
    gap: "4px"
  },
  ".cm-search [name=close]": {
    fontSize: "1.5em",
    cursor: "pointer",
    padding: "0 8px",
    border: "none",
    background: "none"
  }
});

const onUpdate = EditorView.updateListener.of((update) => {
  if (update.selectionSet || update.docChanged) {
    if (update.selectionSet && !update.docChanged && projectStore.activeInkFile) {
      const mainSel = update.state.selection.main;
      const doc = update.state.doc;
      const currentLine = doc.lineAt(mainSel.from).number - 1;

      if (!isNavigatingBack && !ignoreNextJump) {
        if (lastRecordedLine !== null && Math.abs(currentLine - lastRecordedLine) > 1) {
          // A jump of more than 1 line happened in the same file
          uiStore.pushJumpHistory({
            file: projectStore.activeInkFile,
            line: lastRecordedLine
          });
        }
      }

      lastRecordedFile = projectStore.activeInkFile;
      lastRecordedLine = currentLine;
      ignoreNextJump = false;
    }

    const mainSel = update.state.selection.main;
    if (!mainSel.empty) {
      const selected = update.state.sliceDoc(mainSel.from, mainSel.to);
      if (selected && !selected.includes('\n') && selected.length <= 100) {
        uiStore.selectedText = selected.trim();
      } else {
        uiStore.selectedText = '';
      }
    } else {
      uiStore.selectedText = '';
    }
  }

  if (update.docChanged && projectStore.activeInkFile) {
    // Prevent recursive updates and ignore newline-only differences
    const fileContent = projectStore.activeInkFile.content || "";
    if (fileContent.replace(/\r\n/g, '\n') !== update.state.doc.toString()) {
      ProjectController.updateFileContent(projectStore.activeInkFile, update.state.doc.toString());
    }
  }
});

const inkIndentService = indentService.of((context, pos) => {
  const line = context.lineAt(pos, -1);
  return context.lineIndent(line.from, -1);
});

const domClickHandlers = EditorView.domEventHandlers({
  click(event, view) {
    const isModifier = event.ctrlKey || event.altKey || event.metaKey;
    if (!isModifier) return false;

    const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
    if (pos === null) return false;

    const line = view.state.doc.lineAt(pos);
    const col = pos - line.from;
    const text = line.text;

    let start = col;
    while (start > 0 && /[\w.]/.test(text[start - 1])) {
      start--;
    }
    let end = col;
    while (end < text.length && /[\w.]/.test(text[end])) {
      end++;
    }
    let token = text.slice(start, end).trim();
    token = token.replace(/^\.+|\.+$/g, '');
    if (!token || /^\d+$/.test(token)) return false;

    const target = findSymbolDeclaration(
      token,
      projectStore.activeInkFile,
      projectStore.files,
      line.number - 1
    );

    if (!target) return false;

    event.preventDefault();
    event.stopPropagation();

    if (target.file && target.file !== projectStore.activeInkFile) {
      uiStore.pushJumpHistory({
        file: projectStore.activeInkFile,
        line: view.state.doc.lineAt(view.state.selection.main.from).number - 1
      });
      projectStore.setActiveFile(target.file);
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('editor-jump-to-line', { detail: { line: target.row, fromClick: true } }));
      }, 50);
    } else {
      uiStore.pushJumpHistory({
        file: projectStore.activeInkFile,
        line: view.state.doc.lineAt(view.state.selection.main.from).number - 1
      });
      ignoreNextJump = true;
      const doc = view.state.doc;
      const targetLineNum = target.row + 1;
      if (targetLineNum >= 1 && targetLineNum <= doc.lines) {
        const lineObj = doc.line(targetLineNum);
        view.dispatch({
          selection: { anchor: lineObj.from, head: lineObj.from },
          effects: EditorView.scrollIntoView(lineObj.from, { y: 'center' })
        });
        view.focus();
      }
    }
    return true;
  }
});

const getEditorExtensions = () => [
  lineNumbers(),
  highlightActiveLineGutter(),
  history(),
  drawSelection(),
  dropCursor(),
  EditorState.allowMultipleSelections.of(true),
  syntaxHighlighting(inkHighlightStyle),
  inkEditorTheme,
  highlightActiveLine(),
  inkIndentService,
  keymap.of([
    { key: "Tab", run: acceptCompletion },
    ...completionKeymap,
    { key: "Mod-s", run: () => { ProjectController.saveAll(); return true; } },
    ...defaultKeymap,
    ...customHistoryKeymap,
    ...searchKeymap,
    indentWithTab
  ]),
  search({top: true}),
  lintGutter(),
  languageCompartment.of(InkLanguageSupport()),
  autocompleteCompartment.of(uiStore.autoCompleteDisabled ? [] : autocompletion({ override: [inkCompletionSource] })),
  lineWrapCompartment.of(uiStore.lineWrap ? EditorView.lineWrapping : []),
  domClickHandlers,
  onUpdate
];

onMounted(() => {
  view = new EditorView({
    state: EditorState.create({
      doc: projectStore.activeInkFile ? (projectStore.activeInkFile.content || "") : "",
      extensions: getEditorExtensions()
    }),
    parent: editorContainer.value
  });

  window.addEventListener('editor-jump-to-line', (e) => {
    if (!view) return;
    if (e.detail.fromClick) {
      ignoreNextJump = true;
    } else if (!e.detail.isBack) {
      // It's a programmatic jump (e.g., from knot browser, goto anything) not initiated by clicking a symbol in the editor.
      // We should record the current position before jumping.
      if (!isNavigatingBack) {
        uiStore.pushJumpHistory({
          file: projectStore.activeInkFile,
          line: view.state.doc.lineAt(view.state.selection.main.from).number - 1
        });
      }
      ignoreNextJump = true;
    }

    const lineNumber = e.detail.line + 1; // CodeMirror is 1-indexed, symbols might be 0-indexed. Let's assume 0-indexed row.
    const doc = view.state.doc;
    if (lineNumber >= 1 && lineNumber <= doc.lines) {
      const line = doc.line(lineNumber);
      view.dispatch({
        selection: { anchor: line.from, head: line.from },
        effects: EditorView.scrollIntoView(line.from, { y: 'center' })
      });
      view.focus();
    }
  });

  window.addEventListener('editor-go-back', () => {
    const historyItem = uiStore.popJumpHistory();
    if (historyItem && historyItem.file) {
      isNavigatingBack = true;
      if (historyItem.file !== projectStore.activeInkFile) {
        projectStore.setActiveFile(historyItem.file);
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('editor-jump-to-line', { detail: { line: historyItem.line, isBack: true } }));
          setTimeout(() => { isNavigatingBack = false; }, 50);
        }, 50);
      } else {
        window.dispatchEvent(new CustomEvent('editor-jump-to-line', { detail: { line: historyItem.line, isBack: true } }));
        setTimeout(() => { isNavigatingBack = false; }, 50);
      }
    }
  });

  watch(() => [projectStore.issues, projectStore.activeInkFile], () => {
    if (!view) return;
    const activeFilename = projectStore.activeInkFile?.relPath ? projectStore.activeInkFile.relPath.split(/[/\\]/).pop() : "Untitled.ink";
    const diagnostics = (projectStore.issues || [])
      .filter(issue => issue.filename === activeFilename)
      .map(issue => {
        let lineNumber = Math.max(1, Math.min(issue.lineNumber || 1, view.state.doc.lines));
        let lineStr = view.state.doc.line(lineNumber);
        return {
          from: lineStr.from,
          to: lineStr.to,
          severity: issue.type === 'error' ? 'error' : 'warning',
          message: issue.message
        };
      });
    view.dispatch(setDiagnostics(view.state, diagnostics));
  }, { deep: true });

  watch(() => uiStore.autoCompleteDisabled, (disabled) => {
    if (view) {
      view.dispatch({
        effects: autocompleteCompartment.reconfigure(disabled ? [] : autocompletion({ override: [inkCompletionSource] }))
      });
    }
  });

  watch(() => uiStore.lineWrap, (wrap) => {
    if (view) {
      view.dispatch({
        effects: lineWrapCompartment.reconfigure(wrap ? EditorView.lineWrapping : [])
      });
    }
  });

  if (window.api && window.api.receive) {
    window.api.receive('insertSnippet', (snippet) => {
      if (!view) return;
      try {
        const normalizedSnippet = snippet.replace(/\r\n/g, '\n');
        const range = view.state.selection.main;
        view.dispatch({
          changes: {
            from: range.from,
            to: range.to,
            insert: normalizedSnippet
          },
          selection: { anchor: range.from + normalizedSnippet.length }
        });
        view.focus();
      } catch (e) {
        console.error("Failed to insert snippet:", e);
      }
    });

    window.api.receive('find', () => {
      if (view) {
        openSearchPanel(view);
        view.focus();
      }
    });

    window.api.receive('replace', () => {
      if (view) {
        openSearchPanel(view);
        view.focus();
      }
    });
  }
});

onBeforeUnmount(() => {
  if (view) {
    view.destroy();
    view = null;
  }
});

// Watch for active file changes (switching tabs)
watch(() => projectStore.activeInkFile, (newFile, oldFile) => {
  if (view && newFile) {
    if (oldFile && !isNavigatingBack && view.state.doc.toString() === (oldFile.content || "")) {
      // Record position when switching files via tabs or file browser if we have a valid selection
      const ranges = view.state.selection.ranges;
      if (ranges && ranges.length > 0) {
          const fromPos = ranges[0].from;
          if (fromPos <= view.state.doc.length) {
              const prevLine = view.state.doc.lineAt(fromPos).number - 1;
              uiStore.pushJumpHistory({
                file: oldFile,
                line: prevLine
              });
          }
      }
    }

    const text = newFile.content || "";
    if (view.state.doc.toString() !== text) {
      // File changed its content completely (different file loaded)
      ignoreNextJump = true;
      view.setState(EditorState.create({
        doc: text,
        extensions: getEditorExtensions()
      }));
    } else {
       // Switching back to a file we already had loaded without resetting state completely
       ignoreNextJump = true;
    }
  }
});

// Watch for content changes from external sources (e.g. disk load)
watch(() => projectStore.activeInkFile?.content, (newContent) => {
    if (view && newContent !== undefined && view.state.doc.toString() !== newContent) {
      // Create new state to avoid adding initial load to undo history
      view.setState(EditorState.create({
        doc: newContent,
        extensions: getEditorExtensions()
      }));
    }
});

</script>

<style scoped>
#editor-container {
  flex: 1;
  height: 100%;
  overflow: hidden;
  background-color: var(--cm-background-color);
}
</style>
