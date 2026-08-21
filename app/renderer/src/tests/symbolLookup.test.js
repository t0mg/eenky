import { describe, it, expect } from 'vitest';
import { findSymbolDeclaration } from '../core/symbolLookup';

describe('Symbol Lookup (Definition Jumping)', () => {
  const mainFile = {
    id: 1,
    isMain: true,
    relPath: 'main.ink',
    absolutePath: '/project/main.ink',
    content: `
VAR score = 100
CONST MAX_LIVES = 3

=== function add_points(pts) ===
~ score = score + pts

=== intro_scene ===
= part_one
This is intro part one.
-> chapter_two.forest
    `,
    symbols: {
      add_points: { name: 'add_points', isfunc: true, row: 4, column: 0 },
      intro_scene: {
        name: 'intro_scene',
        row: 7,
        column: 0,
        innerSymbols: {
          part_one: { name: 'part_one', row: 8, column: 0 }
        }
      }
    }
  };

  const includeFile = {
    id: 2,
    isMain: false,
    relPath: 'chapter_two.ink',
    absolutePath: '/project/chapter_two.ink',
    content: `
=== chapter_two ===
= forest
You are in the forest.
    `,
    symbols: {
      chapter_two: {
        name: 'chapter_two',
        row: 1,
        column: 0,
        innerSymbols: {
          forest: { name: 'forest', row: 2, column: 0 }
        }
      }
    }
  };

  const allFiles = [mainFile, includeFile];

  it('finds top-level knot in active file', () => {
    const result = findSymbolDeclaration('intro_scene', mainFile, allFiles);
    expect(result).not.toBeNull();
    expect(result.file).toBe(mainFile);
    expect(result.row).toBe(7);
  });

  it('finds function in active file', () => {
    const result = findSymbolDeclaration('add_points', mainFile, allFiles);
    expect(result).not.toBeNull();
    expect(result.file).toBe(mainFile);
    expect(result.row).toBe(4);
  });

  it('finds stitch in active file using dotted path', () => {
    const result = findSymbolDeclaration('intro_scene.part_one', mainFile, allFiles);
    expect(result).not.toBeNull();
    expect(result.file).toBe(mainFile);
    expect(result.row).toBe(8);
  });

  it('finds knot and stitch across include files', () => {
    const resultKnot = findSymbolDeclaration('chapter_two', mainFile, allFiles);
    expect(resultKnot).not.toBeNull();
    expect(resultKnot.file).toBe(includeFile);
    expect(resultKnot.row).toBe(1);

    const resultStitch = findSymbolDeclaration('chapter_two.forest', mainFile, allFiles);
    expect(resultStitch).not.toBeNull();
    expect(resultStitch.file).toBe(includeFile);
    expect(resultStitch.row).toBe(2);
  });

  it('finds variable and constant declarations via text search fallback', () => {
    const resultVar = findSymbolDeclaration('score', mainFile, allFiles);
    expect(resultVar).not.toBeNull();
    expect(resultVar.file).toBe(mainFile);
    expect(resultVar.row).toBe(1);

    const resultConst = findSymbolDeclaration('MAX_LIVES', mainFile, allFiles);
    expect(resultConst).not.toBeNull();
    expect(resultConst.file).toBe(mainFile);
    expect(resultConst.row).toBe(2);
  });

  it('returns null for unknown symbols', () => {
    const result = findSymbolDeclaration('nonexistent_symbol', mainFile, allFiles);
    expect(result).toBeNull();
  });
});
