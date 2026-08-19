import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { insertNewlineAndIndent } from '@codemirror/commands';
import { InkLanguageSupport } from '@mavnn/codemirror-lang-ink';
import { indentService } from '@codemirror/language';

describe('Editor Indentation on New Line', () => {
  const inkIndentService = indentService.of((context, pos) => {
    const line = context.lineAt(pos, -1);
    return context.lineIndent(line.from, -1);
  });

  function simulateNewline(doc, cursorOffset) {
    const state = EditorState.create({
      doc,
      selection: { anchor: cursorOffset, head: cursorOffset },
      extensions: [
        InkLanguageSupport(),
        inkIndentService
      ]
    });

    let resultDoc = state.doc.toString();
    insertNewlineAndIndent({
      state,
      dispatch: (tr) => {
        resultDoc = tr.newDoc.toString();
      }
    });

    return resultDoc;
  }

  it('replicates indentation from the previous line when pressing Enter at line end', () => {
    const initial = '    * Choice 1';
    const output = simulateNewline(initial, initial.length);
    expect(output).toBe('    * Choice 1\n    ');
  });

  it('replicates indentation when pressing Enter in the middle of a line', () => {
    const initial = '    * Choice 1';
    const output = simulateNewline(initial, 6);
    expect(output).toBe('    * \n    Choice 1');
  });

  it('does not add indentation on unindented lines', () => {
    const initial = '=== knot_name ===';
    const output = simulateNewline(initial, initial.length);
    expect(output).toBe('=== knot_name ===\n');
  });

  it('handles deeper nested indentation correctly', () => {
    const initial = '    * Choice 1\n        * Nested choice';
    const output = simulateNewline(initial, initial.length);
    expect(output).toBe('    * Choice 1\n        * Nested choice\n        ');
  });
});
