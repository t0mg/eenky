import { describe, it, expect } from 'vitest';
import { InkFileSymbols } from '../core/inkFileSymbols';
import { InkLanguage } from '@mavnn/codemirror-lang-ink';

describe('InkFileSymbols Knot Parsing', () => {
  it('parses knots and stitches with leading numbers', () => {
    const text = `
== 1test
= 1stitch
Some text here.

=== 2nd_knot ===
= 2nd_stitch
More text.

=== function 3rd_func(x) ===
~ return x
`;
    const mockFile = {
      getValue: () => text
    };
    const symbolsObj = new InkFileSymbols(mockFile, { includesChanged: () => {} });
    symbolsObj.parse();

    const symbols = symbolsObj.getSymbols();
    expect(symbols['1test']).toBeDefined();
    expect(symbols['1test'].name).toBe('1test');
    expect(symbols['1test'].innerSymbols['1stitch']).toBeDefined();
    expect(symbols['1test'].innerSymbols['1stitch'].name).toBe('1stitch');

    expect(symbols['2nd_knot']).toBeDefined();
    expect(symbols['2nd_knot'].name).toBe('2nd_knot');
    expect(symbols['2nd_knot'].innerSymbols['2nd_stitch']).toBeDefined();
    expect(symbols['2nd_knot'].innerSymbols['2nd_stitch'].name).toBe('2nd_stitch');

    expect(symbols['3rd_func']).toBeDefined();
    expect(symbols['3rd_func'].name).toBe('3rd_func');
    expect(symbols['3rd_func'].isfunc).toBe(true);
  });

  it('parses purely numeric knot and stitch names', () => {
    const text = '=== 123 ===\n= 456\nContent';
    const mockFile = {
      getValue: () => text
    };
    const symbolsObj = new InkFileSymbols(mockFile, { includesChanged: () => {} });
    symbolsObj.parse();

    const symbols = symbolsObj.getSymbols();
    expect(symbols['123']).toBeDefined();
    expect(symbols['123'].name).toBe('123');
    expect(symbols['123'].innerSymbols['456']).toBeDefined();
    expect(symbols['123'].innerSymbols['456'].name).toBe('456');
  });

  it('correctly parses multiple includes and keeps symbols intact', () => {
    const text = `
INCLUDE chapter1.ink
INCLUDE chapter2.ink // second chapter
INCLUDE "subfolder/chapter3.ink"
INCLUDE 'chapter4.ink'

VAR player_health = 100
CONST MAX_GOLD = 999

=== start_knot ===
= intro_stitch
Welcome to the story!
-> chapter1_knot
`;
    const mockFile = {
      getValue: () => text
    };
    let callbackIncludes = null;
    const symbolsObj = new InkFileSymbols(mockFile, {
      includesChanged: (inc) => { callbackIncludes = inc; }
    });
    symbolsObj.parse();

    expect(symbolsObj.includes).toEqual([
      'chapter1.ink',
      'chapter2.ink',
      'subfolder/chapter3.ink',
      'chapter4.ink'
    ]);
    expect(callbackIncludes).toEqual([
      'chapter1.ink',
      'chapter2.ink',
      'subfolder/chapter3.ink',
      'chapter4.ink'
    ]);

    const symbols = symbolsObj.getSymbols();
    expect(symbols['start_knot']).toBeDefined();
    expect(symbols['start_knot'].name).toBe('start_knot');
    expect(symbols['start_knot'].innerSymbols['intro_stitch']).toBeDefined();
  });
});
